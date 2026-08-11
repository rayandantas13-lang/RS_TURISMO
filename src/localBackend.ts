import type { Config, GastoOperacional, Sessao, Usuario, Voucher } from "@/types";
import { CONFIG_PADRAO, criarVouchersExemplo } from "@/data/seed";
import { uid } from "@/lib/utils";
import {
  deBase64Url,
  extrairCredencialDoRegistro,
  toBase64Url,
  verificarAutenticacao,
} from "@/lib/biometria";

/**
 * Banco local (modo demonstração).
 *
 * Usado enquanto a URL do Google Apps Script não estiver configurada.
 * A estrutura é idêntica à das abas do Google Sheets.
 */

const DB_KEY = "vempraporto.local.v2";
const ADMIN_DEMO_LEGADO = { usuario: "admin", senhaHash: "local_oqacq9_17" };

interface UsuarioLocal extends Usuario {
  senhaHash: string;
}

/** Espelha a aba "Biometria" do Google Sheets (chave pública + HMAC do token). */
interface RegistroBiometricoLocal {
  id: string;
  usuarioId: string;
  credentialId: string;
  chavePublica: string;
  contador: number;
  rpId: string;
  origem: string;
  refreshTokenHash: string;
  ativo: boolean;
  criadoEm: string;
  ultimoUso: string;
}

/** Desafio de uso único (como o CacheService no Apps Script). */
interface DesafioBiometricoLocal {
  id: string;
  tipo: "reg" | "login";
  usuarioId?: string;
  credentialId?: string;
  desafio: string;
  rpId: string;
  origem: string;
  expiraEm: string;
}

interface BancoLocal {
  usuarios: UsuarioLocal[];
  vouchers: Voucher[];
  gastos: GastoOperacional[];
  config: Config;
  sessoes: { token: string; usuarioId: string; expiraEm: string }[];
  biometria: RegistroBiometricoLocal[];
  desafios: DesafioBiometricoLocal[];
}

const MAX_DISPOSITIVOS = 10;
const DESAFIO_MS = 5 * 60 * 1000;

function hashRefreshToken(token: string) {
  return hash(`bio::${token}`);
}

function novoDesafio() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

function iguais(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function hash(senha: string) {
  let v = 0;
  const s = `voucher::${senha}`;
  for (let i = 0; i < s.length; i++) {
    v = (v << 5) - v + s.charCodeAt(i);
    v |= 0;
  }
  return `local_${Math.abs(v).toString(36)}_${s.length}`;
}

function criarBanco(): BancoLocal {
  return {
    usuarios: [],
    vouchers: criarVouchersExemplo(),
    gastos: [],
    config: CONFIG_PADRAO,
    sessoes: [],
    biometria: [],
    desafios: [],
  };
}

function ler(): BancoLocal {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      const novo = criarBanco();
      gravar(novo);
      return novo;
    }
    const p = JSON.parse(raw) as BancoLocal;
    if (!Array.isArray(p.usuarios)) p.usuarios = [];
    if (!Array.isArray(p.sessoes)) p.sessoes = [];
    if (!Array.isArray(p.biometria)) p.biometria = [];
    if (!Array.isArray(p.desafios)) p.desafios = [];
    // Desafios expirados são descartados a cada leitura (como o CacheService).
    p.desafios = p.desafios.filter((d) => new Date(d.expiraEm).getTime() > Date.now());

    // Remove a credencial pública que existia apenas nas versões antigas de demonstração,
    // preservando vouchers e configurações locais já criados.
    const idsLegados = new Set(
      p.usuarios
        .filter(
          (u) =>
            u.usuario === ADMIN_DEMO_LEGADO.usuario &&
            u.email === "admin@empresa.com" &&
            u.senhaHash === ADMIN_DEMO_LEGADO.senhaHash,
        )
        .map((u) => u.id),
    );
    if (idsLegados.size) {
      p.usuarios = p.usuarios.filter((u) => !idsLegados.has(u.id));
      p.sessoes = p.sessoes.filter((s) => !idsLegados.has(s.usuarioId));
    }

    // Mescla com o padrão para que campos novos existam em bancos antigos.
    p.config = { ...CONFIG_PADRAO, ...(p.config ?? {}) };
    if (!p.vouchers) p.vouchers = [];
    if (!Array.isArray(p.gastos)) p.gastos = [];
    gravar(p);
    return p;
  } catch {
    const novo = criarBanco();
    gravar(novo);
    return novo;
  }
}

function gravar(db: BancoLocal) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* ignora */
  }
}

function publico(u: UsuarioLocal): Usuario {
  const { senhaHash: _s, ...resto } = u;
  return resto;
}

function autenticar(db: BancoLocal, token: unknown): UsuarioLocal {
  const s = db.sessoes.find((x) => x.token === String(token));
  if (!s || new Date(s.expiraEm).getTime() < Date.now())
    throw new Error("Sessão expirada. Entre novamente.");
  const u = db.usuarios.find((x) => x.id === s.usuarioId);
  if (!u || !u.ativo) throw new Error("Usuário inativo.");
  return u;
}

function exigirAdmin(u: UsuarioLocal) {
  if (u.papel !== "admin") throw new Error("Acesso permitido somente para administradores.");
}

function novaSessao(db: BancoLocal, u: UsuarioLocal): Sessao {
  const token = `local-${uid()}-${uid()}`;
  const expiraEm = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  db.sessoes = db.sessoes.filter((s) => new Date(s.expiraEm).getTime() > Date.now());
  db.sessoes.push({ token, usuarioId: u.id, expiraEm });
  return { token, usuario: publico(u), expiraEm };
}

export function limparBancoLocal() {
  localStorage.removeItem(DB_KEY);
}

export function exportarBancoLocal() {
  const db = ler();
  return { vouchers: db.vouchers, config: db.config };
}

export async function requisicaoLocal<T>(payload: Record<string, unknown>): Promise<T> {
  const db = ler();
  const acao = String(payload.acao || "");
  let saida: unknown = null;

  switch (acao) {
    case "status":
      saida = { temAdmin: db.usuarios.some((u) => u.papel === "admin") };
      break;

    case "criarPrimeiroAdmin": {
      if (db.usuarios.length) throw new Error("O primeiro usuário já foi criado.");
      const nome = String(payload.nome || "").trim();
      const email = String(payload.email || "").trim().toLowerCase();
      const usuario = String(payload.usuario || "").trim().toLowerCase();
      const senha = String(payload.senha || "");
      if (nome.length < 2) throw new Error("Informe o nome completo.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
      if (!/^[a-z0-9._-]{3,50}$/.test(usuario))
        throw new Error("O usuário deve ter de 3 a 50 caracteres, sem espaços.");
      if (senha.length < 10) throw new Error("A senha precisa ter pelo menos 10 caracteres.");
      const novo: UsuarioLocal = {
        id: uid(),
        nome,
        email,
        usuario,
        papel: "admin",
        ativo: true,
        criadoEm: new Date().toISOString(),
        senhaHash: hash(senha),
      };
      db.usuarios.push(novo);
      saida = novaSessao(db, novo);
      break;
    }

    case "entrar": {
      const id = String(payload.usuario || "").trim().toLowerCase();
      const u = db.usuarios.find(
        (x) => x.usuario.toLowerCase() === id || x.email.toLowerCase() === id,
      );
      if (!u || !u.ativo || u.senhaHash !== hash(String(payload.senha || "")))
        throw new Error("Usuário ou senha inválidos.");
      u.ultimoAcesso = new Date().toISOString();
      saida = novaSessao(db, u);
      break;
    }

    case "eu":
      saida = publico(autenticar(db, payload.token));
      break;

    case "sair":
      db.sessoes = db.sessoes.filter((s) => s.token !== String(payload.token));
      break;

    /* -------- Biometria (WebAuthn) -------- */

    case "biometriaIniciarRegistro": {
      const uReg = autenticar(db, payload.token);
      const rpId = String(payload.rpId || "").trim();
      const origem = String(payload.origem || "").trim();
      if (!rpId || !origem) throw new Error("Site ou origem inválidos.");
      if (db.biometria.filter((r) => r.usuarioId === uReg.id && r.ativo).length >= MAX_DISPOSITIVOS)
        throw new Error("Limite de dispositivos com biometria atingido.");
      const desafio = novoDesafio();
      db.desafios.push({
        id: uid(),
        tipo: "reg",
        usuarioId: uReg.id,
        desafio,
        rpId,
        origem,
        expiraEm: new Date(Date.now() + DESAFIO_MS).toISOString(),
      });
      saida = { desafio };
      break;
    }

    case "biometriaConcluirRegistro": {
      const uConc = autenticar(db, payload.token);
      const rpId = String(payload.rpId || "").trim();
      const origem = String(payload.origem || "").trim();
      const credentialId = String(payload.credentialId || "");
      const pendente = db.desafios.find(
        (d) => d.tipo === "reg" && d.usuarioId === uConc.id,
      );
      if (!pendente) throw new Error("Solicitação de biometria expirada. Tente novamente.");

      const cdj = JSON.parse(new TextDecoder().decode(deBase64Url(String(payload.clientDataJSON || "")))) as {
        type?: string;
        challenge?: string;
        origin?: string;
      };
      if (cdj.type !== "webauthn.create") throw new Error("Registro inválido.");
      if (cdj.challenge !== pendente.desafio) throw new Error("Desafio do registro não confere.");
      if (cdj.origin !== origem || pendente.origem !== origem || pendente.rpId !== rpId)
        throw new Error("Origem do registro não confere.");

      const extraido = extrairCredencialDoRegistro(deBase64Url(String(payload.attestationObject || "")));
      if ((extraido.flags & 0x04) === 0) throw new Error("Verificação biométrica não realizada.");
      const rpIdHash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rpId)));
      if (!iguais(extraido.rpIdHash, Array.from(rpIdHash)))
        throw new Error("Site do registro não confere.");
      if (toBase64Url(extraido.credentialId) !== credentialId)
        throw new Error("Credencial divergente.");
      if (db.biometria.some((r) => r.credentialId === credentialId))
        throw new Error("Dispositivo já cadastrado.");

      const refreshToken = `${uid()}${uid()}${uid()}`;
      db.biometria.push({
        id: uid(),
        usuarioId: uConc.id,
        credentialId,
        chavePublica: toBase64Url(extraido.chavePublicaCose),
        contador: extraido.contador,
        rpId,
        origem,
        refreshTokenHash: hashRefreshToken(refreshToken),
        ativo: true,
        criadoEm: new Date().toISOString(),
        ultimoUso: "",
      });
      db.desafios = db.desafios.filter((d) => d.id !== pendente.id);
      saida = { refreshToken };
      break;
    }

    case "biometriaDesafioLogin": {
      const credentialId = String(payload.credentialId || "");
      const registro = db.biometria.find((r) => r.credentialId === credentialId && r.ativo);
      if (!registro) throw new Error("Dispositivo não reconhecido.");
      const usuario = db.usuarios.find((u) => u.id === registro.usuarioId);
      if (!usuario || !usuario.ativo) throw new Error("Usuário inativo.");
      const desafio = novoDesafio();
      db.desafios.push({
        id: uid(),
        tipo: "login",
        credentialId,
        desafio,
        rpId: registro.rpId,
        origem: registro.origem,
        expiraEm: new Date(Date.now() + DESAFIO_MS).toISOString(),
      });
      saida = { desafio };
      break;
    }

    case "biometriaEntrar": {
      const credentialId = String(payload.credentialId || "");
      const registro = db.biometria.find((r) => r.credentialId === credentialId && r.ativo);
      if (!registro) throw new Error("Dispositivo não reconhecido.");
      const pendente = db.desafios.find(
        (d) => d.tipo === "login" && d.credentialId === credentialId,
      );
      if (!pendente) throw new Error("Solicitação de biometria expirada. Tente novamente.");
      if (hashRefreshToken(String(payload.refreshToken || "")) !== registro.refreshTokenHash)
        throw new Error("Dispositivo não reconhecido.");

      const usuario = db.usuarios.find((u) => u.id === registro.usuarioId);
      if (!usuario || !usuario.ativo) throw new Error("Usuário inativo.");

      const valido = await verificarAutenticacao(registro, {
        credentialId,
        clientDataJSON: String(payload.clientDataJSON || ""),
        authenticatorData: String(payload.authenticatorData || ""),
        signature: String(payload.signature || ""),
      }, pendente.desafio);
      if (!valido) throw new Error("Assinatura biométrica inválida.");

      db.desafios = db.desafios.filter((d) => d.id !== pendente.id);
      registro.ultimoUso = new Date().toISOString();
      saida = novaSessao(db, usuario);
      break;
    }

    case "biometriaRemover": {
      const credentialId = String(payload.credentialId || "");
      const registro = db.biometria.find((r) => r.credentialId === credentialId);
      if (!registro || hashRefreshToken(String(payload.refreshToken || "")) !== registro.refreshTokenHash)
        throw new Error("Dispositivo não reconhecido.");
      db.biometria = db.biometria.filter((r) => r.id !== registro.id);
      break;
    }

    case "dados":
      autenticar(db, payload.token);
      saida = { vouchers: db.vouchers, gastos: db.gastos, config: db.config };
      break;

    case "salvarVoucher": {
      autenticar(db, payload.token);
      const v = payload.voucher as Voucher;
      const i = db.vouchers.findIndex((x) => x.id === v.id);
      if (i === -1) db.vouchers.unshift(v);
      else db.vouchers[i] = v;
      saida = v;
      break;
    }

    case "removerVoucher":
      autenticar(db, payload.token);
      db.vouchers = db.vouchers.filter((v) => v.id !== String(payload.id));
      break;

    case "salvarGasto": {
      autenticar(db, payload.token);
      const gasto = payload.gasto as GastoOperacional;
      const i = db.gastos.findIndex((x) => x.id === gasto.id);
      if (i === -1) db.gastos.unshift(gasto); else db.gastos[i] = gasto;
      saida = gasto;
      break;
    }
    case "removerGasto":
      autenticar(db, payload.token);
      db.gastos = db.gastos.filter((g) => g.id !== String(payload.id));
      break;

    case "salvarConfig":
      exigirAdmin(autenticar(db, payload.token));
      db.config = { ...db.config, ...(payload.config as Config) };
      saida = db.config;
      break;

    case "listarUsuarios":
      exigirAdmin(autenticar(db, payload.token));
      saida = db.usuarios.map(publico);
      break;

    case "criarUsuario": {
      exigirAdmin(autenticar(db, payload.token));
      const dados = payload.usuarioNovo as {
        nome: string;
        email: string;
        usuario: string;
        senha: string;
        papel: Usuario["papel"];
      };
      if (String(dados.senha || "").length < 10)
        throw new Error("A senha precisa ter pelo menos 10 caracteres.");
      const usuario = String(dados.usuario).trim().toLowerCase();
      const email = String(dados.email).trim().toLowerCase();
      if (
        db.usuarios.some(
          (u) => u.usuario.toLowerCase() === usuario || u.email.toLowerCase() === email,
        )
      )
        throw new Error("Usuário ou email já cadastrado.");
      const novo: UsuarioLocal = {
        id: uid(),
        nome: dados.nome.trim(),
        email,
        usuario,
        papel: dados.papel === "admin" ? "admin" : "operador",
        ativo: true,
        criadoEm: new Date().toISOString(),
        senhaHash: hash(dados.senha),
      };
      db.usuarios.push(novo);
      saida = publico(novo);
      break;
    }

    case "alternarUsuario": {
      const atual = autenticar(db, payload.token);
      exigirAdmin(atual);
      const alvo = db.usuarios.find((u) => u.id === String(payload.id));
      if (!alvo) throw new Error("Usuário não encontrado.");
      const ativo = payload.ativo === true || String(payload.ativo) === "true";
      if (alvo.id === atual.id && !ativo)
        throw new Error("Você não pode desativar o seu próprio usuário.");
      if (
        alvo.papel === "admin" &&
        !ativo &&
        db.usuarios.filter((u) => u.papel === "admin" && u.ativo).length <= 1
      )
        throw new Error("Mantenha pelo menos um administrador ativo.");
      alvo.ativo = ativo;
      saida = publico(alvo);
      break;
    }

    default:
      throw new Error(`Ação "${acao}" não reconhecida no modo local.`);
  }

  gravar(db);
  return saida as T;
}
