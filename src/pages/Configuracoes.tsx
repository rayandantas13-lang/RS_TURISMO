import { useState } from "react";
import { useStore } from "@/store";
import type { Config, Servico, Usuario, Voucher } from "@/types";
import {
  api,
  definirUrlApi,
  diagnosticarUrl,
  migrarParaSheets,
  modoLocal,
  origemApi,
  urlAmbienteBruta,
  urlDoAmbiente,
  urlManual,
  type PassoDiagnostico,
} from "@/api";
import { exportarBancoLocal, limparBancoLocal } from "@/localBackend";
import { Icon } from "@/components/Icon";
import {
  AreaTexto,
  Aviso,
  Botao,
  BotaoIcone,
  Campo,
  Cartao,
  Entrada,
  Modal,
  Selecao,
  Selo,
} from "@/components/ui";
import {
  iniciais,
  mascaraCnpj,
  mascaraTelefone,
  MENSAGEM_VOUCHER_PADRAO,
  mensagemVoucher,
  saudacaoDoDia,
  uid,
} from "@/lib/utils";
import { cn } from "@/utils/cn";

/** Voucher fictício usado na prévia da mensagem do WhatsApp. */
const voucherExemplo: Voucher = {
  id: "exemplo",
  codigo: "VP-A1B2C",
  clientes: ["Maria Silva", "João Silva"],
  pessoas: 2,
  hotel: "",
  telefone: "",
  contatoExtra: "",
  passeios: [],
  total: 0,
  entrada: 0,
  formaPagamento: "",
  observacoes: "",
  status: "concluido",
  criadoEm: new Date().toISOString(),
};

const usuarioVazio = {
  nome: "",
  email: "",
  usuario: "",
  senha: "",
  papel: "operador" as Usuario["papel"],
};

export default function Configuracoes() {
  const { config, salvarConfig, sessao, ehAdmin, recarregar, notificar } = useStore();

  const [form, setForm] = useState<Config>(config);
  const [novoServico, setNovoServico] = useState({ nome: "", preco: "" });
  const set = (p: Partial<Config>) => setForm((f) => ({ ...f, ...p }));

  const envUrl = urlDoAmbiente();
  const envBruta = urlAmbienteBruta();
  /** A variável do GitHub existe mas está num formato que o Google recusa. */
  const envInvalida = !!envBruta && !envUrl;
  const [url, setUrl] = useState(urlManual());
  const [origem, setOrigem] = useState(origemApi());
  const [testando, setTestando] = useState(false);
  const [migrando, setMigrando] = useState(false);
  const [msgConexao, setMsgConexao] = useState("");
  const [erroConexao, setErroConexao] = useState("");
  const [passos, setPassos] = useState<PassoDiagnostico[]>([]);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);
  const [usuariosCarregados, setUsuariosCarregados] = useState(false);
  const [modalUsuario, setModalUsuario] = useState(false);
  const [formUsuario, setFormUsuario] = useState(usuarioVazio);
  const [salvandoUsuario, setSalvandoUsuario] = useState(false);
  const [erroUsuario, setErroUsuario] = useState("");

  const token = sessao?.token ?? "";

  const carregarUsuarios = async () => {
    if (!ehAdmin) return;
    setCarregandoUsuarios(true);
    try {
      setUsuarios(await api.listarUsuarios(token));
      setUsuariosCarregados(true);
    } catch (e) {
      notificar(e instanceof Error ? e.message : "Falha ao carregar usuários.", "erro");
      setUsuariosCarregados(true);
    } finally {
      setCarregandoUsuarios(false);
    }
  };

  if (ehAdmin && !usuariosCarregados && !carregandoUsuarios) void carregarUsuarios();

  const addServico = () => {
    if (!novoServico.nome.trim()) return notificar("Informe o nome do passeio.", "erro");
    const s: Servico = {
      id: uid(),
      nome: novoServico.nome.trim(),
      preco: Number(novoServico.preco) || 0,
      oQueLevar: "",
      pontoRetorno: "",
      informacoesAdicionais: "",
    };
    set({ servicos: [...form.servicos, s] });
    setNovoServico({ nome: "", preco: "" });
  };

  const testar = async () => {
    setTestando(true);
    setMsgConexao("");
    setErroConexao("");
    setPassos([]);
    try {
      const resultado = await diagnosticarUrl(url || envBruta || envUrl);
      setPassos(resultado);
      const ultimo = resultado[resultado.length - 1];
      if (resultado.every((p) => p.ok)) setMsgConexao(ultimo.detalhe);
      else setErroConexao("A conexão falhou. Veja abaixo em qual etapa o Google recusou.");
    } catch (e) {
      setErroConexao(e instanceof Error ? e.message : "Falha ao testar a conexão.");
    } finally {
      setTestando(false);
    }
  };

  const salvarUrl = () => {
    try {
      definirUrlApi(url);
      const salva = urlManual();
      setUrl(salva);
      setOrigem(origemApi());
      setErroConexao("");
      setPassos([]);
      setMsgConexao(
        salva
          ? "URL salva! Saia e entre novamente para carregar os dados do Google Sheets."
          : "URL removida. O sistema volta a usar a variável do GitHub ou o modo local.",
      );
    } catch (e) {
      setMsgConexao("");
      setPassos([]);
      setErroConexao(e instanceof Error ? e.message : "URL inválida.");
    }
  };

  const migrar = async () => {
    setMigrando(true);
    setMsgConexao("");
    setErroConexao("");
    try {
      const total = await migrarParaSheets(token, exportarBancoLocal());
      limparBancoLocal();
      setMsgConexao(
        `${total} voucher(s) enviados para o Google Sheets. A cópia local foi removida deste navegador.`,
      );
      recarregar();
    } catch (e) {
      setErroConexao(e instanceof Error ? e.message : "Falha ao migrar os dados.");
    } finally {
      setMigrando(false);
    }
  };

  const criarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formUsuario.senha.length < 10)
      return setErroUsuario("A senha precisa ter pelo menos 10 caracteres.");
    setSalvandoUsuario(true);
    setErroUsuario("");
    try {
      const criado = await api.criarUsuario(token, formUsuario);
      setUsuarios((l) => [...l, criado]);
      setFormUsuario(usuarioVazio);
      setModalUsuario(false);
      notificar("Usuário criado com sucesso.");
    } catch (err) {
      setErroUsuario(err instanceof Error ? err.message : "Não foi possível criar o usuário.");
    } finally {
      setSalvandoUsuario(false);
    }
  };

  const alternarUsuario = async (u: Usuario) => {
    try {
      const atualizado = await api.alternarUsuario(token, u.id, !u.ativo);
      setUsuarios((l) => l.map((x) => (x.id === u.id ? atualizado : x)));
    } catch (e) {
      notificar(e instanceof Error ? e.message : "Falha ao atualizar o usuário.", "erro");
    }
  };

  const selo = {
    local: {
      icone: "database" as const,
      titulo: "Modo local",
      texto: "Os dados existem apenas neste navegador.",
      cor: "bg-amber-50 text-amber-700 ring-amber-200",
    },
    github: {
      icone: "branch" as const,
      titulo: "Variável do GitHub",
      texto: "URL vinda de VITE_APPS_SCRIPT_URL no build.",
      cor: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    },
    manual: {
      icone: "cloud" as const,
      titulo: "URL manual",
      texto: "URL salva neste navegador.",
      cor: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    },
  }[origem];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500">
          Dados da empresa, mensagem do WhatsApp, política de cancelamento, passeios, banco de
          dados e usuários.
        </p>
      </header>

      {/* Empresa + política */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Cartao className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-600">
              <Icon name="settings" className="size-4" />
            </span>
            <div>
              <h2 className="font-bold text-slate-900">Dados da empresa</h2>
              <p className="text-xs text-slate-500">Aparecem no topo do voucher e do PDF.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome da empresa" className="sm:col-span-2">
              <Entrada value={form.empresa} onChange={(e) => set({ empresa: e.target.value })} />
            </Campo>
            <Campo rotulo="CNPJ">
              <Entrada
                value={form.cnpj}
                onChange={(e) => set({ cnpj: mascaraCnpj(e.target.value) })}
                placeholder="00.000.000/0001-00"
              />
            </Campo>
            <Campo rotulo="Instagram">
              <Entrada
                value={form.instagram}
                onChange={(e) => set({ instagram: e.target.value })}
                placeholder="@suaempresa"
              />
            </Campo>
            <Campo rotulo="Telefone da empresa" className="sm:col-span-2">
              <Entrada
                value={form.telefone}
                onChange={(e) => set({ telefone: mascaraTelefone(e.target.value) })}
              />
            </Campo>
          </div>
          <div className="mt-4 flex justify-end">
            <Botao icone="check" onClick={() => salvarConfig(form)}>
              Salvar dados
            </Botao>
          </div>
        </Cartao>

        <Cartao className="flex flex-col p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-rose-50 text-rose-600">
              <Icon name="alert" className="size-4" />
            </span>
            <div>
              <h2 className="font-bold text-slate-900">Política de cancelamento</h2>
              <p className="text-xs text-slate-500">Vai no final de todo voucher e PDF.</p>
            </div>
          </div>
          <AreaTexto
            rows={12}
            value={form.politicaCancelamento}
            onChange={(e) => set({ politicaCancelamento: e.target.value })}
            className="modal-scroll h-48 flex-1 resize-y text-sm"
          />
          <div className="mt-4 flex justify-end">
            <Botao icone="check" onClick={() => salvarConfig(form)}>
              Salvar política
            </Botao>
          </div>
        </Cartao>
      </div>

      {/* Mensagem do WhatsApp */}
      <Cartao className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <Icon name="send" className="size-4" />
          </span>
          <div>
            <h2 className="font-bold text-slate-900">Mensagem do WhatsApp</h2>
            <p className="text-xs text-slate-500">
              Único texto enviado junto com o PDF do voucher — o WhatsApp abre para você escolher o
              contato.
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <AreaTexto
              rows={5}
              value={form.mensagemVoucher}
              onChange={(e) => set({ mensagemVoucher: e.target.value })}
              placeholder={MENSAGEM_VOUCHER_PADRAO}
              className="resize-y text-sm"
            />
            <div className="mt-3 space-y-1.5 text-xs leading-relaxed text-slate-500">
              <p>
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">{"{saudacao}"}</code>{" "}
                vira <b className="text-slate-700">{saudacaoDoDia()}</b> agora — muda sozinho
                conforme o horário (Bom dia até 12h, Boa tarde até 18h, depois Boa noite).
              </p>
              <p>
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">{"{cliente}"}</code>{" "}
                nome da 1ª pessoa ·{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">{"{codigo}"}</code>{" "}
                código do voucher ·{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">{"{empresa}"}</code>{" "}
                nome da empresa.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Botao
                variante="fantasma"
                icone="refresh"
                onClick={() => set({ mensagemVoucher: MENSAGEM_VOUCHER_PADRAO })}
              >
                Restaurar padrão
              </Botao>
              <Botao icone="check" onClick={() => salvarConfig(form)}>
                Salvar mensagem
              </Botao>
            </div>
          </div>

          {/* Prévia */}
          <div className="h-fit rounded-2xl bg-[#e5ddd5] p-4">
            <p className="mb-2 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
              Prévia da mensagem agora
            </p>
            <div className="w-fit max-w-full rounded-xl rounded-tl-sm bg-white p-4 shadow-sm">
              <pre className="font-sans text-[13px] leading-relaxed break-words whitespace-pre-wrap text-slate-800">
                {mensagemVoucher(voucherExemplo, { ...config, mensagemVoucher: form.mensagemVoucher })}
              </pre>
              <p className="mt-2 text-right text-[10px] text-slate-400">✓✓</p>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
              <Icon name="clip" className="mt-0.5 size-3.5 shrink-0" />
              A mensagem vai acompanhada do PDF do voucher. No celular o PDF já vai anexado; no
              computador ele é baixado e o WhatsApp abre para você anexar e escolher o contato.
            </p>
          </div>
        </div>
      </Cartao>

      {/* Passeios */}
      <Cartao className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <Icon name="pin" className="size-4" />
          </span>
          <div>
            <h2 className="font-bold text-slate-900">Passeios, preços e textos do PDF</h2>
            <p className="text-xs text-slate-500">
              Configure os passeios, preços e os textos padrão (O que levar, Ponto de retorno e Informações adicionais) que sairão no PDF.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {form.servicos.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <Entrada
                  value={s.nome}
                  onChange={(e) =>
                    set({
                      servicos: form.servicos.map((x) =>
                        x.id === s.id ? { ...x, nome: e.target.value } : x,
                      ),
                    })
                  }
                  placeholder="Nome do passeio"
                  className="min-w-48 flex-1 font-semibold"
                />
                <div className="flex items-center gap-1.5 text-sm font-bold text-slate-600">
                  R$
                  <Entrada
                    type="number"
                    step="0.01"
                    value={s.preco}
                    onChange={(e) =>
                      set({
                        servicos: form.servicos.map((x) =>
                          x.id === s.id ? { ...x, preco: Number(e.target.value) } : x,
                        ),
                      })
                    }
                    className="w-28 text-right"
                  />
                </div>
                <BotaoIcone
                  icone="trash"
                  titulo="Remover"
                  className="hover:bg-rose-50 hover:text-rose-600"
                  onClick={() => set({ servicos: form.servicos.filter((x) => x.id !== s.id) })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Campo rotulo="O que levar (padrão)">
                  <AreaTexto
                    rows={3}
                    value={s.oQueLevar || ""}
                    onChange={(e) =>
                      set({
                        servicos: form.servicos.map((x) =>
                          x.id === s.id ? { ...x, oQueLevar: e.target.value } : x,
                        ),
                      })
                    }
                    placeholder="Ex: Protetor solar, toalha..."
                    className="text-xs"
                  />
                </Campo>
                <Campo rotulo="Ponto de retorno / encontro (padrão)">
                  <AreaTexto
                    rows={3}
                    value={s.pontoRetorno || ""}
                    onChange={(e) =>
                      set({
                        servicos: form.servicos.map((x) =>
                          x.id === s.id ? { ...x, pontoRetorno: e.target.value } : x,
                        ),
                      })
                    }
                    placeholder="Ex: Recepção do hotel..."
                    className="text-xs"
                  />
                </Campo>
                <Campo rotulo="Informações adicionais (padrão)">
                  <AreaTexto
                    rows={3}
                    value={s.informacoesAdicionais || ""}
                    onChange={(e) =>
                      set({
                        servicos: form.servicos.map((x) =>
                          x.id === s.id ? { ...x, informacoesAdicionais: e.target.value } : x,
                        ),
                      })
                    }
                    placeholder="Ex: Em caso de atraso..."
                    className="text-xs"
                  />
                </Campo>
              </div>
            </div>
          ))}
          {!form.servicos.length && (
            <div className="rounded-xl bg-slate-50 py-6 text-center text-sm text-slate-400">
              Nenhum passeio cadastrado.
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <Entrada
            placeholder="Novo passeio"
            value={novoServico.nome}
            onChange={(e) => setNovoServico({ ...novoServico, nome: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && addServico()}
            className="min-w-40 flex-1"
          />
          <Entrada
            type="number"
            step="0.01"
            placeholder="0,00"
            value={novoServico.preco}
            onChange={(e) => setNovoServico({ ...novoServico, preco: e.target.value })}
            className="w-28"
          />
          <Botao variante="contorno" icone="plus" onClick={addServico}>
            Adicionar
          </Botao>
          <Botao icone="check" onClick={() => salvarConfig(form)} className="ml-auto">
            Salvar passeios
          </Botao>
        </div>
      </Cartao>

      {/* Banco de dados */}
      <Cartao className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600">
              <Icon name="database" className="size-4" />
            </span>
            <div>
              <h2 className="font-bold text-slate-900">Banco de dados · Google Sheets</h2>
              <p className="text-xs text-slate-500">{selo.texto}</p>
            </div>
          </div>
          <Selo className={selo.cor}>
            <Icon name={selo.icone} className="size-3" /> {selo.titulo}
          </Selo>
        </div>

        <div className="space-y-4 p-5">
          {envUrl && (
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                <Icon name="branch" className="size-3" /> VITE_APPS_SCRIPT_URL · variável do
                repositório
              </p>
              <p className="font-mono text-xs break-all text-emerald-700">{envUrl}</p>
            </div>
          )}

          {envInvalida && (
            <Aviso tom="erro">
              A variável <code className="font-mono">VITE_APPS_SCRIPT_URL</code> do GitHub está em
              um formato que o Google recusa e por isso foi ignorada:{" "}
              <span className="font-mono break-all">{envBruta}</span>. Ela precisa ser o endereço
              da implantação, no formato{" "}
              <span className="font-mono">https://script.google.com/macros/s/SEU_ID/exec</span> —
              sem <code className="font-mono">/u/0/</code>, sem <code className="font-mono">/dev</code>{" "}
              e sem parâmetros depois de <code className="font-mono">/exec</code>.
            </Aviso>
          )}

          <Campo
            rotulo="URL do aplicativo web do Apps Script"
            dica={envUrl ? "sobrescreve a variável do GitHub" : "termina com /exec"}
          >
            <Entrada
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/AKfy.../exec"
              className="font-mono text-xs"
            />
          </Campo>

          <div className="flex flex-wrap gap-2">
            <Botao icone="check" onClick={salvarUrl}>
              Salvar URL
            </Botao>
            <Botao
              variante="contorno"
              icone="plug"
              carregando={testando}
              disabled={!url && !envBruta}
              onClick={testar}
            >
              Testar conexão
            </Botao>
            {!modoLocal() && (
              <Botao variante="contorno" icone="upload" carregando={migrando} onClick={migrar}>
                Enviar vouchers locais para a planilha
              </Botao>
            )}
            <Botao
              variante="fantasma"
              icone="trash"
              className="text-rose-600 hover:bg-rose-50"
              onClick={() => {
                limparBancoLocal();
                setMsgConexao("Dados locais apagados. O admin padrão volta no próximo acesso.");
                recarregar();
              }}
            >
              Limpar dados locais
            </Botao>
          </div>

          {msgConexao && <Aviso tom="ok">{msgConexao}</Aviso>}
          {erroConexao && <Aviso tom="erro">{erroConexao}</Aviso>}

          {passos.length > 0 && (
            <ol className="space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              {passos.map((p) => (
                <li key={p.titulo} className="flex items-start gap-2.5 text-xs">
                  <Icon
                    name={p.ok ? "check" : "alert"}
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      p.ok ? "text-emerald-600" : "text-rose-600",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-700">{p.titulo}</p>
                    <p className="leading-relaxed break-words text-slate-500">{p.detalhe}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {modoLocal() && (
            <Aviso tom="alerta">
              O sistema está em <b>modo local</b>: tudo fica só neste navegador. Cole a URL do Apps
              Script acima ou crie a variável <code className="font-mono">VITE_APPS_SCRIPT_URL</code>{" "}
              no GitHub para usar o Google Sheets.
            </Aviso>
          )}
        </div>
      </Cartao>

      {/* Usuários */}
      <Cartao>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600">
              <Icon name="users" className="size-4" />
            </span>
            <div>
              <h2 className="font-bold text-slate-900">Usuários e acessos</h2>
              <p className="text-xs text-slate-500">Somente administradores gerenciam usuários.</p>
            </div>
          </div>
          <Botao
            icone="plus"
            onClick={() => {
              setErroUsuario("");
              setModalUsuario(true);
            }}
          >
            Novo
          </Botao>
        </div>

        <ul className="divide-y divide-slate-50">
          {usuarios.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-5 py-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-500 text-xs font-bold text-white">
                {iniciais(u.nome)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">{u.nome}</p>
                  <Selo
                    className={
                      u.papel === "admin"
                        ? "bg-sky-50 text-sky-700 ring-sky-200"
                        : "bg-slate-100 text-slate-600 ring-slate-200"
                    }
                  >
                    {u.papel === "admin" ? "Administrador" : "Operador"}
                  </Selo>
                </div>
                <p className="truncate text-xs text-slate-400">
                  @{u.usuario} · {u.email}
                </p>
              </div>
              <button
                onClick={() => alternarUsuario(u)}
                className={cn(
                  "shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition",
                  u.ativo
                    ? "bg-emerald-50 text-emerald-700 hover:bg-rose-50 hover:text-rose-600"
                    : "bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700",
                )}
              >
                {u.ativo ? "Ativo" : "Inativo"}
              </button>
            </li>
          ))}
          {!usuarios.length && (
            <li className="px-5 py-10 text-center text-sm text-slate-400">
              {carregandoUsuarios ? "Carregando usuários..." : "Nenhum usuário encontrado."}
            </li>
          )}
        </ul>
      </Cartao>

      {/* Publicação */}
      <Cartao className="overflow-hidden">
        <div className="flex items-center gap-3 bg-slate-900 px-5 py-4 text-white">
          <Icon name="branch" className="size-5" />
          <div>
            <h2 className="font-bold">Publicar no GitHub Pages</h2>
            <p className="text-xs text-slate-400">
              O build gera um único <code>index.html</code> — 100% compatível.
            </p>
          </div>
        </div>
        <ol className="space-y-3 p-5 text-sm text-slate-600">
          {[
            <>
              Cole o arquivo{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                google-apps-script/Code.gs
              </code>{" "}
              em <b>Extensões → Apps Script</b> da planilha. Execute{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                configurarBanco
              </code>{" "}
              e depois <code className="font-mono">obterChaveInstalacao</code>; guarde a chave exibida.
            </>,
            <>
              Publique em <b>Implantar → Nova implantação → Aplicativo da Web</b>, com acesso para{" "}
              <b>Qualquer pessoa</b>, e copie a URL <code className="font-mono">/exec</code>.
            </>,
            <>
              No repositório, crie a variável{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                VITE_APPS_SCRIPT_URL
              </code>{" "}
              em <b>Settings → Secrets and variables → Actions → Variables</b>, ou cole a URL no
              campo acima.
            </>,
            <>
              Ative <b>Settings → Pages → GitHub Actions</b>. O workflow publica sozinho a cada push
              na <b>main</b>.
            </>,
          ].map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                {i + 1}
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </Cartao>

      <Modal
        aberto={modalUsuario}
        aoFechar={() => setModalUsuario(false)}
        titulo="Cadastrar usuário"
        subtitulo="Operadores não acessam Configurações."
        largura="max-w-xl"
      >
        <form onSubmit={criarUsuario} className="modal-scroll max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          {erroUsuario && <Aviso tom="erro">{erroUsuario}</Aviso>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome completo *" className="sm:col-span-2">
              <Entrada
                required
                value={formUsuario.nome}
                onChange={(e) => setFormUsuario({ ...formUsuario, nome: e.target.value })}
                placeholder="Nome do usuário"
              />
            </Campo>
            <Campo rotulo="Usuário *">
              <Entrada
                required
                value={formUsuario.usuario}
                onChange={(e) => setFormUsuario({ ...formUsuario, usuario: e.target.value })}
                placeholder="usuario"
                autoComplete="off"
              />
            </Campo>
            <Campo rotulo="E-mail *">
              <Entrada
                required
                type="email"
                value={formUsuario.email}
                onChange={(e) => setFormUsuario({ ...formUsuario, email: e.target.value })}
                placeholder="email@empresa.com"
              />
            </Campo>
            <Campo rotulo="Senha *">
              <Entrada
                required
                type="password"
                minLength={10}
                value={formUsuario.senha}
                onChange={(e) => setFormUsuario({ ...formUsuario, senha: e.target.value })}
                placeholder="mínimo 10 caracteres"
                autoComplete="new-password"
              />
            </Campo>
            <Campo rotulo="Perfil *">
              <Selecao
                value={formUsuario.papel}
                onChange={(e) =>
                  setFormUsuario({ ...formUsuario, papel: e.target.value as Usuario["papel"] })
                }
              >
                <option value="operador">Operador</option>
                <option value="admin">Administrador</option>
              </Selecao>
            </Campo>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Botao variante="contorno" type="button" onClick={() => setModalUsuario(false)}>
              Cancelar
            </Botao>
            <Botao icone="key" carregando={salvandoUsuario}>
              Criar usuário
            </Botao>
          </div>
        </form>
      </Modal>
    </div>
  );
}
