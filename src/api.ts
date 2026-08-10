import type { Config, DadosApi, GastoOperacional, Sessao, Usuario, Voucher } from "@/types";


interface RespostaApi<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

const URL_KEY = "vempraporto.apps_script_url";
const HOST_SCRIPT = "script.google.com";
/**
 * O Apps Script nunca devolve o conteúdo direto de script.google.com: ele
 * responde 302 e entrega o JSON em um endereço de uso único em
 * script.googleusercontent.com/macros/echo. Quando esse segundo endereço
 * responde 404, o problema está na implantação (versão antiga, acesso
 * restrito ou URL presa a uma conta), não no painel.
 */
const HOST_CONTEUDO = "script.googleusercontent.com";

/**
 * Versão do google-apps-script/Code.gs que este site espera encontrar
 * publicado. Quando a planilha responde uma versão menor, o Apps Script no ar
 * é anterior aos campos novos (desconto, o que levar, informações adicionais,
 * data/hora de volta) e descarta silenciosamente esses dados ao salvar — era
 * isso que fazia o desconto sumir depois de atualizar a página. Nesse caso o
 * painel avisa em vez de deixar o usuário perder dados sem perceber.
 */
export const VERSAO_ESPERADA = 5;

/** true quando a implantação publicada é anterior à esperada por este site. */
export function versaoDesatualizada(versao: unknown) {
  const numero = Number(versao);
  return !Number.isFinite(numero) || numero < VERSAO_ESPERADA;
}

export const AVISO_IMPLANTACAO_ANTIGA =
  "O Apps Script publicado está desatualizado: o desconto (e os campos “O que " +
  "levar”, “Informações adicionais” e a data/hora de volta) não é gravado na " +
  "planilha — por isso ele some depois de atualizar a página. Abra o Apps " +
  "Script, cole o Code.gs mais recente e use Implantar → Gerenciar implantações " +
  "→ ✏️ → Versão: Nova versão.";

/** Ações que podem ser repetidas sem risco de duplicar dados na planilha. */
const ACOES_REPETIVEIS = new Set([
  "status",
  "eu",
  "dados",
  "listarUsuarios",
  "salvarVoucher",
  "removerVoucher",
  "salvarConfig",
  "alternarUsuario",
]);

class ErroApi extends Error {
  readonly temporario: boolean;

  constructor(mensagem: string, temporario = false) {
    super(mensagem);
    this.name = "ErroApi";
    this.temporario = temporario;
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Aceita todos os formatos de URL que o Google entrega ao implantar e devolve
 * sempre a forma canônica terminada em /exec.
 *
 * Formatos aceitos:
 * - https://script.google.com/macros/s/<id>/exec
 * - https://script.google.com/macros/u/0/s/<id>/exec        (conta ativa)
 * - https://script.google.com/a/macros/<dominio>/s/<id>/exec (Workspace)
 * - https://script.google.com/a/<dominio>/macros/s/<id>/exec (Workspace antigo)
 *
 * O trecho "/u/0/" ou "/u/1/" identifica a conta logada no navegador e é a
 * causa mais comum do erro 404 em script.googleusercontent.com; ele é sempre
 * removido. Parâmetros extras (?usp=sharing) e barras finais também caem.
 */
export function normalizarUrlAppsScript(valor: unknown): string {
  if (typeof valor !== "string") return "";
  const bruto = valor.trim().replace(/^[<"'\s]+|[>"'\s]+$/g, "");
  if (!bruto) return "";

  let alvo: URL;
  try {
    alvo = new URL(bruto);
  } catch {
    return "";
  }
  if (alvo.protocol !== "https:" || alvo.hostname !== HOST_SCRIPT) return "";

  const caminho = alvo.pathname.replace(/\/u\/\d+\//g, "/").replace(/\/+$/, "");

  const comDominio = caminho.match(
    /^\/a\/(?:macros\/)?([^/]+)\/(?:macros\/)?s\/([A-Za-z0-9_-]+)\/exec$/,
  );
  if (comDominio) {
    return `https://${HOST_SCRIPT}/a/macros/${comDominio[1]}/s/${comDominio[2]}/exec`;
  }

  const simples = caminho.match(/^\/macros\/s\/([A-Za-z0-9_-]+)\/exec$/);
  if (simples) return `https://${HOST_SCRIPT}/macros/s/${simples[1]}/exec`;

  return "";
}

/** A URL de teste (/dev) só abre para o dono logado e nunca funciona no painel. */
export function ehUrlDeTeste(valor: string) {
  return /^https:\/\/script\.google\.com\/.+\/dev\/?$/.test(valor.trim());
}

/** Valor cru da variável do GitHub — usado para avisar quando ela está inválida. */
export function urlAmbienteBruta() {
  const valor = import.meta.env.VITE_APPS_SCRIPT_URL;
  return typeof valor === "string" ? valor.trim() : "";
}

/** URL vinda da variável do repositório GitHub (injetada no build pelo Vite). */
export function urlDoAmbiente() {
  return normalizarUrlAppsScript(urlAmbienteBruta());
}

/** URL salva manualmente pelo administrador neste navegador. */
export function urlManual() {
  const salva = localStorage.getItem(URL_KEY) || "";
  if (!salva) return "";
  const segura = normalizarUrlAppsScript(salva);
  // Corrige no armazenamento URLs antigas com "/u/1/" ou parâmetros extras.
  if (!segura) localStorage.removeItem(URL_KEY);
  else if (segura !== salva) localStorage.setItem(URL_KEY, segura);
  return segura;
}

/** URL efetiva: a manual tem prioridade sobre a variável do GitHub. */
export function urlApi() {
  return urlManual() || urlDoAmbiente();
}

export function definirUrlApi(url: string) {
  const informada = url.trim();
  if (!informada) {
    localStorage.removeItem(URL_KEY);
    return;
  }
  if (ehUrlDeTeste(informada))
    throw new Error(
      "Essa é a URL de teste (/dev), que só abre para o dono da conta. Use a URL da implantação, terminada em /exec.",
    );
  const segura = normalizarUrlAppsScript(informada);
  if (!segura) throw new Error("Use uma URL válida do Apps Script terminada em /exec.");
  localStorage.setItem(URL_KEY, segura);
}

export type OrigemApi = "manual" | "github" | "local";

export function origemApi(): OrigemApi {
  if (urlManual()) return "manual";
  if (urlDoAmbiente()) return "github";
  return "local";
}

export function modoLocal() {
  return !urlApi();
}

/* ---------------- Transporte ---------------- */

function opcoes(payload?: Record<string, unknown>): RequestInit {
  return {
    method: payload ? "POST" : "GET",
    // text/plain evita o preflight (OPTIONS), que o Apps Script não responde.
    headers: payload ? { "Content-Type": "text/plain;charset=utf-8" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    redirect: "follow",
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
  };
}

/** Traduz o código HTTP levando em conta em qual servidor do Google ele ocorreu. */
function mensagemDeStatus(status: number, urlFinal: string) {
  const noConteudo = urlFinal.includes(HOST_CONTEUDO);

  if (status === 404 || status === 405) {
    return noConteudo
      ? "O Google recebeu a chamada, mas não entregou a resposta (404 em script.googleusercontent.com). " +
          "Quase sempre é implantação desatualizada ou fechada: no Apps Script use Implantar → Gerenciar implantações → " +
          "ícone de lápis → Versão: Nova versão, com “Executar como: Eu” e “Quem tem acesso: Qualquer pessoa”."
      : `Implantação não encontrada (${status}). Confira se a URL termina em /exec e se a implantação continua ativa em “Gerenciar implantações”.`;
  }
  if (status === 401 || status === 403) {
    return `Acesso negado pelo Google (${status}). Reimplante o aplicativo web com “Quem tem acesso: Qualquer pessoa” — a opção “Qualquer pessoa com conta do Google” não funciona no painel.`;
  }
  if (status === 429) {
    return "O Apps Script recusou por excesso de chamadas (429). Aguarde alguns instantes e tente de novo.";
  }
  if (status >= 500) {
    return `O Google Apps Script está instável no momento (${status}). Tente novamente em alguns instantes.`;
  }
  return `Falha na comunicação com a planilha (${status}).`;
}

function pareceHtml(corpo: string) {
  const inicio = corpo.trimStart().slice(0, 200).toLowerCase();
  return inicio.startsWith("<!doctype") || inicio.startsWith("<html") || inicio.includes("<head");
}

function ehTemporario(status: number) {
  return status === 404 || status === 405 || status === 429 || status >= 500;
}

async function umaTentativa<T>(url: string, payload: Record<string, unknown>): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(url, opcoes(payload));
  } catch {
    throw new ErroApi(
      "Não foi possível conectar ao Google Apps Script. Verifique a internet, a URL e se a implantação está publicada para “Qualquer pessoa”.",
      true,
    );
  }

  const urlFinal = resposta.url || url;
  const corpo = await resposta.text().catch(() => "");

  if (!resposta.ok)
    throw new ErroApi(mensagemDeStatus(resposta.status, urlFinal), ehTemporario(resposta.status));

  if (pareceHtml(corpo))
    throw new ErroApi(
      "O Google devolveu uma página de login no lugar dos dados. Reimplante o Apps Script com “Executar como: Eu” e “Quem tem acesso: Qualquer pessoa”.",
    );

  let json: RespostaApi<T>;
  try {
    json = JSON.parse(corpo) as RespostaApi<T>;
  } catch {
    throw new ErroApi("Resposta inválida da API. Reimplante o Apps Script e tente novamente.");
  }

  if (!json || typeof json !== "object")
    throw new ErroApi("Resposta inválida da API. Reimplante o Apps Script e tente novamente.");

  if (!json.ok) throw new ErroApi(json.error || "A planilha retornou um erro.");
  return json.data as T;
}

/**
 * O endereço de conteúdo do Apps Script é de uso único e falha esporadicamente.
 * Ações que não duplicam dados são repetidas uma vez antes de mostrar o erro.
 */
async function enviar<T>(url: string, payload: Record<string, unknown>): Promise<T> {
  const tentativas = ACOES_REPETIVEIS.has(String(payload.acao ?? "")) ? 2 : 1;

  for (let tentativa = 1; ; tentativa++) {
    try {
      return await umaTentativa<T>(url, payload);
    } catch (erro) {
      const falha = erro instanceof ErroApi ? erro : null;
      if (tentativa >= tentativas || !falha?.temporario) throw erro;
      await esperar(900);
    }
  }
}

async function req<T>(payload: Record<string, unknown>): Promise<T> {
  const url = urlApi();
  if (!url) throw new ErroApi("URL do Apps Script não configurada. Vá em Configurações → Banco de dados e cole a URL terminada em /exec para que os dados fiquem salvos em todos os acessos.", false);
  return enviar<T>(url, payload);
}

/* ---------------- Diagnóstico da conexão ---------------- */

export interface PassoDiagnostico {
  titulo: string;
  ok: boolean;
  detalhe: string;
}

/**
 * Testa a URL sem salvá-la, separando cada etapa para mostrar exatamente onde
 * a conexão quebra: formato da URL, publicação (GET) e leitura da planilha (POST).
 */
export async function diagnosticarUrl(valor: string): Promise<PassoDiagnostico[]> {
  const bruto = valor.trim();
  if (!bruto) throw new Error("Informe a URL do Apps Script.");
  if (ehUrlDeTeste(bruto))
    throw new Error(
      "Essa é a URL de teste (/dev), que só abre para o dono da conta. Use a URL da implantação, terminada em /exec.",
    );

  const url = normalizarUrlAppsScript(bruto);
  if (!url)
    throw new Error(
      "A URL precisa ser do Apps Script (script.google.com) e terminar com /exec.",
    );

  const passos: PassoDiagnostico[] = [
    {
      titulo: "Formato da URL",
      ok: true,
      detalhe:
        url === bruto.replace(/\/+$/, "")
          ? "Endereço no formato correto."
          : `Endereço corrigido para ${url}`,
    },
  ];

  try {
    const resposta = await fetch(url, opcoes());
    const corpo = await resposta.text().catch(() => "");
    if (!resposta.ok) {
      passos.push({
        titulo: "Publicação (GET)",
        ok: false,
        detalhe: mensagemDeStatus(resposta.status, resposta.url || url),
      });
    } else if (pareceHtml(corpo)) {
      passos.push({
        titulo: "Publicação (GET)",
        ok: false,
        detalhe:
          "A implantação respondeu uma página HTML de login. Publique com “Executar como: Eu” e “Quem tem acesso: Qualquer pessoa”.",
      });
    } else {
      passos.push({
        titulo: "Publicação (GET)",
        ok: true,
        detalhe: "A implantação está no ar e respondendo.",
      });
    }
  } catch {
    passos.push({
      titulo: "Publicação (GET)",
      ok: false,
      detalhe:
        "Não foi possível alcançar o endereço. Verifique a internet, bloqueadores de anúncios e a URL.",
    });
  }

  try {
    const dados = await enviar<{ temAdmin: boolean; versao?: string }>(url, { acao: "status" });
    passos.push({
      titulo: "Leitura da planilha (POST)",
      ok: true,
      detalhe: dados.temAdmin
        ? "Conexão funcionando! A planilha já tem administrador cadastrado."
        : "Conexão funcionando! A planilha está vazia — crie o administrador no primeiro acesso.",
    });

    // Conectar não basta: uma implantação antiga responde normalmente mas
    // descarta os campos novos ao gravar.
    passos.push(
      versaoDesatualizada(dados.versao)
        ? {
            titulo: "Versão do Apps Script",
            ok: false,
            detalhe: AVISO_IMPLANTACAO_ANTIGA,
          }
        : {
            titulo: "Versão do Apps Script",
            ok: true,
            detalhe: `Implantação atualizada (versão ${dados.versao}). Todos os campos são gravados na planilha.`,
          },
    );
  } catch (erro) {
    passos.push({
      titulo: "Leitura da planilha (POST)",
      ok: false,
      detalhe: erro instanceof Error ? erro.message : "Falha ao chamar a planilha.",
    });
  }

  return passos;
}

export const api = {
  status: () => req<{ temAdmin: boolean; versao?: string }>({ acao: "status" }),
  entrar: (usuario: string, senha: string) => req<Sessao>({ acao: "entrar", usuario, senha }),
  criarPrimeiroAdmin: (p: {
    nome: string;
    email: string;
    usuario: string;
    senha: string;
    chaveInstalacao?: string;
  }) => req<Sessao>({ acao: "criarPrimeiroAdmin", ...p }),
  eu: (token: string) => req<Usuario>({ acao: "eu", token }),
  sair: (token: string) => req<void>({ acao: "sair", token }),

  dados: (token: string) => req<DadosApi>({ acao: "dados", token }),

  salvarVoucher: (token: string, voucher: Voucher) =>
    req<Voucher>({ acao: "salvarVoucher", token, voucher }),
  removerVoucher: (token: string, id: string) => req<void>({ acao: "removerVoucher", token, id }),
  salvarGasto: (token: string, gasto: GastoOperacional) => req<GastoOperacional>({ acao: "salvarGasto", token, gasto }),
  removerGasto: (token: string, id: string) => req<void>({ acao: "removerGasto", token, id }),

  salvarConfig: (token: string, config: Config) =>
    req<Config>({ acao: "salvarConfig", token, config }),

  listarUsuarios: (token: string) => req<Usuario[]>({ acao: "listarUsuarios", token }),
  criarUsuario: (
    token: string,
    usuarioNovo: {
      nome: string;
      email: string;
      usuario: string;
      senha: string;
      papel: Usuario["papel"];
    },
  ) => req<Usuario>({ acao: "criarUsuario", token, usuarioNovo }),
  alternarUsuario: (token: string, id: string, ativo: boolean) =>
    req<Usuario>({ acao: "alternarUsuario", token, id, ativo }),
};

/** Envia os vouchers do modo local para o Google Sheets já configurado. */
export async function migrarParaSheets(token: string, dados: { vouchers: Voucher[] }) {
  const url = urlApi();
  if (!url) throw new Error("Configure a URL do Google Apps Script antes de migrar.");
  for (const voucher of dados.vouchers) await enviar(url, { acao: "salvarVoucher", token, voucher });
  return dados.vouchers.length;
}
