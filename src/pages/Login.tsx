import { useEffect, useState } from "react";
import type { Sessao } from "@/types";
import { api, modoLocal } from "@/api";
import { Icon } from "@/components/Icon";
import { Aviso, Botao, Campo, Entrada } from "@/components/ui";
import { LogoIcon } from "@/components/Logo";
import * as biometria from "@/lib/biometria";
import type { CredencialBiometrica } from "@/lib/biometria";

const vazio = {
  nome: "",
  email: "",
  usuario: "",
  senha: "",
  confirmar: "",
  chaveInstalacao: "",
};

/** Traduz erros do WebAuthn (DOMException) para mensagens amigáveis. */
function mensagemBiometria(err: unknown) {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError")
      return "Leitura biométrica cancelada ou não reconhecida. Tente novamente ou use usuário e senha.";
    if (err.name === "SecurityError")
      return "A biometria não está disponível neste contexto (é preciso HTTPS).";
    if (err.name === "NotSupportedError")
      return "Este navegador ou dispositivo não suporta biometria.";
  }
  return err instanceof Error ? err.message : "Não foi possível entrar com a biometria.";
}

export default function Login({ aoEntrar }: { aoEntrar: (s: Sessao) => void }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [form, setForm] = useState(vazio);
  const [criando, setCriando] = useState(false);
  const [temAdmin, setTemAdmin] = useState<boolean | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  // Biometria (WebAuthn): suporte do navegador/aparelho e dispositivos já
  // registrados neste navegador (a tela de login reconhece o aparelho).
  const [biometriaPronta, setBiometriaPronta] = useState(false);
  const [credenciais, setCredenciais] = useState<CredencialBiometrica[]>([]);
  const [biometriaCarregando, setBiometriaCarregando] = useState(false);
  const [ativacaoPendente, setAtivacaoPendente] = useState<Sessao | null>(null);

  const local = modoLocal();

  useEffect(() => {
    api
      .status()
      .then((r) => setTemAdmin(r.temAdmin))
      .catch(() => setTemAdmin(null));
  }, []);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const suporta = biometria.suportada();
      const plataforma = suporta ? await biometria.plataformaDisponivel() : false;
      if (!ativo) return;
      setBiometriaPronta(suporta && plataforma);
      if (suporta) setCredenciais(biometria.credenciaisSalvas());
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro("");
    try {
      const s = await api.entrar(usuario.trim(), senha);
      // Login por senha validado. Se o aparelho suporta biometria e ainda não
      // foi ativada para este usuário, oferece a ativação antes de entrar.
      if (biometriaPronta && !biometria.jaAtivada(s.usuario.id)) {
        setAtivacaoPendente(s);
        setSenha("");
      } else {
        aoEntrar(s);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setCarregando(false);
    }
  };

  /** Ativa a biometria: janela nativa (Face ID/Touch ID/digital) + vínculo do
   * token do usuário com a chave pública deste dispositivo. */
  const ativar = async () => {
    const s = ativacaoPendente;
    if (!s) return;
    setCarregando(true);
    setErro("");
    try {
      const rpId = window.location.hostname;
      const origem = window.location.origin;
      const { desafio } = await api.biometriaIniciarRegistro(s.token, rpId, origem);
      const registro = await biometria.registrar({
        desafio,
        rpId,
        usuario: s.usuario,
        credenciaisExistentes: biometria.credenciaisSalvas().map((c) => c.credentialId),
      });
      const { refreshToken } = await api.biometriaConcluirRegistro(s.token, {
        credentialId: registro.credentialId,
        attestationObject: registro.attestationObject,
        clientDataJSON: registro.clientDataJSON,
        rpId,
        origem,
      });
      biometria.salvarCredencial({
        usuarioId: s.usuario.id,
        usuario: s.usuario.usuario,
        nome: s.usuario.nome,
        credentialId: registro.credentialId,
        chavePublica: registro.chavePublica,
        contador: registro.contador,
        rpId,
        origem,
        refreshToken,
        criadoEm: new Date().toISOString(),
      });
      aoEntrar(s);
    } catch {
      // Ativar biometria é opcional: o login por senha já foi validado.
      aoEntrar(s);
    } finally {
      setCarregando(false);
    }
  };

  /** Login rápido: leitura biométrica + sessão emitida sem digitar senha. */
  const entrarComBiometria = async () => {
    setErro("");
    setBiometriaCarregando(true);
    try {
      const lista = biometria.credenciaisSalvas();
      if (!lista.length)
        throw new Error("Nenhum dispositivo com biometria ativada neste navegador.");
      const alvo = lista[0];
      const rpId = window.location.hostname;
      const { desafio } = await api.biometriaDesafioLogin(alvo.credentialId);
      const prova = await biometria.autenticar({
        desafio,
        rpId,
        credencialIds: lista.map((c) => c.credentialId),
      });
      const escolhida = lista.find((c) => c.credentialId === prova.credentialId) ?? alvo;
      const sessao = await api.biometriaEntrar({
        credentialId: prova.credentialId,
        refreshToken: escolhida.refreshToken,
        clientDataJSON: prova.clientDataJSON,
        authenticatorData: prova.authenticatorData,
        signature: prova.signature,
      });
      aoEntrar(sessao);
    } catch (err) {
      setErro(mensagemBiometria(err));
    } finally {
      setBiometriaCarregando(false);
    }
  };

  const removerDispositivo = async () => {
    const lista = biometria.credenciaisSalvas();
    if (!lista.length) return;
    const nomes = [...new Set(lista.map((c) => c.nome || c.usuario))].join(", ");
    const ok = window.confirm(
      `Remover a biometria deste dispositivo (${nomes})? Os próximos logins voltam a pedir usuário e senha.`,
    );
    if (!ok) return;
    for (const c of lista) {
      await api.biometriaRemover(c.credentialId, c.refreshToken).catch(() => {});
    }
    biometria.removerTodasLocais();
    setCredenciais([]);
  };

  const criarAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.senha.length < 10) return setErro("A senha precisa ter pelo menos 10 caracteres.");
    if (!local && !form.chaveInstalacao.trim())
      return setErro("Informe a chave de instalação gerada no Apps Script.");
    if (form.senha !== form.confirmar) return setErro("As senhas não conferem.");
    setCarregando(true);
    setErro("");
    try {
      const st = await api.status();
      if (st.temAdmin) {
        setTemAdmin(true);
        setCriando(false);
        throw new Error("Já existe um administrador. Entre com o seu usuário.");
      }
      aoEntrar(
        await api.criarPrimeiroAdmin({
          nome: form.nome.trim(),
          email: form.email.trim(),
          usuario: form.usuario.trim(),
          senha: form.senha,
          chaveInstalacao: form.chaveInstalacao.trim(),
        }),
      );
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível criar o administrador.");
    } finally {
      setCarregando(false);
    }
  };
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0A0A] p-4">
      <div className="absolute -top-40 -left-32 size-[28rem] rounded-full bg-orange-500/20 blur-3xl" />
      <div className="absolute -right-32 -bottom-40 size-[28rem] rounded-full bg-orange-400/10 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 size-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-orange-500/5 via-transparent to-transparent blur-3xl" />

      <div className="anim-up relative w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="flex justify-center">
            <LogoIcon size={80} className="ring-2 ring-orange-500/20 shadow-xl shadow-orange-500/10" />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-white">RS TURISMO</h1>
          <p className="mt-1 flex items-center justify-center gap-2 text-sm text-zinc-400">
            <span className="size-1.5 rounded-full bg-orange-500" />
            Painel administrativo
            <span className="size-1.5 rounded-full bg-orange-500" />
          </p>
          <p className="mt-1 text-[11px] font-semibold tracking-widest text-orange-400 uppercase">Preto • Laranja • Branco</p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-2xl shadow-black/50 ring-1 ring-zinc-200">
          <div className="mb-5 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-orange-50 text-orange-600 ring-1 ring-orange-100">
              <Icon name={criando ? "user" : "lock"} className="size-4" />
            </span>
            <h2 className="font-bold text-zinc-900">
              {criando ? "Criar administrador" : "Entrar no sistema"}
            </h2>
          </div>

          {criando ? (
            <form onSubmit={criarAdmin} className="space-y-3.5">
              <Aviso tom="info">
                Crie o administrador principal da RS TURISMO. Depois disso, novos usuários só podem ser
                cadastrados dentro de Configurações.
              </Aviso>
              {!local && (
                <Campo rotulo="Chave de instalação *" dica="execute obterChaveInstalacao() no Apps Script">
                  <Entrada
                    required
                    type="password"
                    value={form.chaveInstalacao}
                    onChange={(e) => setForm({ ...form, chaveInstalacao: e.target.value })}
                    placeholder="Chave exibida no registro de execução"
                    autoComplete="off"
                  />
                </Campo>
              )}
              <Campo rotulo="Nome completo *">
                <Entrada
                  required
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Seu nome"
                />
              </Campo>
              <Campo rotulo="E-mail *">
                <Entrada
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@rsturismo.com"
                />
              </Campo>
              <Campo rotulo="Usuário *">
                <Entrada
                  required
                  value={form.usuario}
                  onChange={(e) => setForm({ ...form, usuario: e.target.value })}
                  placeholder="admin"
                  autoComplete="username"
                />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="Senha *">
                  <Entrada
                    required
                    type="password"
                    minLength={10}
                    value={form.senha}
                    onChange={(e) => setForm({ ...form, senha: e.target.value })}
                    placeholder="mín. 10"
                    autoComplete="new-password"
                  />
                </Campo>
                <Campo rotulo="Confirmar *">
                  <Entrada
                    required
                    type="password"
                    minLength={10}
                    value={form.confirmar}
                    onChange={(e) => setForm({ ...form, confirmar: e.target.value })}
                    placeholder="repita"
                    autoComplete="new-password"
                  />
                </Campo>
              </div>
              <Botao icone="check" carregando={carregando} className="w-full py-3">
                Criar administrador
              </Botao>
              <button
                type="button"
                onClick={() => {
                  setCriando(false);
                  setErro("");
                }}
                className="w-full text-xs font-semibold text-zinc-500 hover:text-zinc-800"
              >
                Voltar para o login
              </button>
            </form>
          ) : ativacaoPendente ? (
            <div className="space-y-3.5">
              <div className="flex items-start gap-3 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 p-4 ring-1 ring-orange-200">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#FF6B00] to-[#FF8C33] text-white shadow-md shadow-orange-600/30">
                  <Icon name="key" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-zinc-900">Ativar Face ID / Digital?</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                    Faça os próximos logins instantaneamente usando a biometria nativa deste
                    dispositivo.
                  </p>
                </div>
              </div>

              <Botao icone="key" carregando={carregando} onClick={ativar} className="w-full py-3">
                Ativar Biometria e Entrar
              </Botao>
              <button
                type="button"
                onClick={() => aoEntrar(ativacaoPendente)}
                className="w-full text-xs font-semibold text-zinc-500 hover:text-zinc-800"
              >
                Agora não, entrar sem biometria
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {credenciais.length > 0 && (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={entrarComBiometria}
                    disabled={biometriaCarregando}
                    className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-br from-[#FF6B00] to-[#FF8C33] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-600/25 transition-all hover:shadow-orange-600/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {biometriaCarregando ? (
                      <Icon name="refresh" className="size-5 animate-spin" />
                    ) : (
                      <Icon name="key" className="size-5" />
                    )}
                    {biometriaCarregando ? "Lendo biometria..." : "Entrar com Face ID / Digital"}
                  </button>
                  <p className="text-center text-[11px] text-zinc-400">
                    Reconhecemos este dispositivo
                    {credenciais[0] && ` · ${credenciais[0].nome || credenciais[0].usuario}`}
                    {credenciais.length > 1 ? ` e mais ${credenciais.length - 1}` : ""}
                  </p>
                  <button
                    type="button"
                    onClick={removerDispositivo}
                    className="mx-auto flex items-center gap-1 text-[11px] font-semibold text-zinc-400 transition hover:text-rose-600"
                  >
                    <Icon name="trash" className="size-3" />
                    Remover este dispositivo
                  </button>
                  <div className="flex items-center gap-3 pt-1">
                    <span className="h-px flex-1 bg-zinc-100" />
                    <span className="text-[10px] font-bold tracking-widest text-zinc-300 uppercase">
                      ou entre com senha
                    </span>
                    <span className="h-px flex-1 bg-zinc-100" />
                  </div>
                </div>
              )}

              <form onSubmit={entrar} className="space-y-3.5">
                <Campo rotulo="Usuário ou e-mail">
                  <Entrada
                    required
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    placeholder="admin"
                    autoComplete="username"
                    autoFocus
                  />
                </Campo>
                <Campo rotulo="Senha">
                  <div className="relative">
                    <Entrada
                      required
                      type={verSenha ? "text" : "password"}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setVerSenha(!verSenha)}
                      className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                      aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                    >
                      <Icon name={verSenha ? "eyeOff" : "eye"} className="size-4" />
                    </button>
                  </div>
                </Campo>

                <Botao icone="logout" carregando={carregando} className="w-full py-3">
                  Entrar na RS TURISMO
                </Botao>

                {temAdmin === false && (
                  <button
                    type="button"
                    onClick={() => {
                      setCriando(true);
                      setErro("");
                    }}
                    className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-orange-600"
                  >
                    <Icon name="plus" className="size-3.5" /> Primeiro acesso: criar administrador
                  </button>
                )}
              </form>
            </div>
          )}

          {erro && (
            <div className="mt-4">
              <Aviso tom="erro">{erro}</Aviso>
            </div>
          )}

          {local && (
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
              Entre como administrador e conecte o Google Sheets em{" "}
              <b className="text-zinc-500">Configurações → Banco de dados</b>. Você também pode
              definir a variável <code className="font-mono">VITE_APPS_SCRIPT_URL</code> no GitHub.
            </p>
          )}

          <div className="mt-6 flex items-center justify-center gap-2 border-t border-zinc-100 pt-4 text-[11px] text-zinc-400">
            <span className="size-1.5 rounded-full bg-black" />
            <span className="size-1.5 rounded-full bg-orange-500" />
            <span className="size-1.5 rounded-full bg-white ring-1 ring-zinc-200" />
            <span className="ml-1 font-semibold tracking-wide text-zinc-500">RS TURISMO • Preto Laranja Branco</span>
          </div>
        </div>
      </div>
    </div>
  );
}
