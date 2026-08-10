import { useEffect, useState } from "react";
import type { Sessao } from "@/types";
import { api, modoLocal } from "@/api";
import { Icon } from "@/components/Icon";
import { Aviso, Botao, Campo, Entrada } from "@/components/ui";
import { LogoIcon } from "@/components/Logo";

const vazio = {
  nome: "",
  email: "",
  usuario: "",
  senha: "",
  confirmar: "",
  chaveInstalacao: "",
};

export default function Login({ aoEntrar }: { aoEntrar: (s: Sessao) => void }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [form, setForm] = useState(vazio);
  const [criando, setCriando] = useState(false);
  const [temAdmin, setTemAdmin] = useState<boolean | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const local = modoLocal();

  useEffect(() => {
    api
      .status()
      .then((r) => setTemAdmin(r.temAdmin))
      .catch(() => setTemAdmin(null));
  }, []);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro("");
    try {
      aoEntrar(await api.entrar(usuario.trim(), senha));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setCarregando(false);
    }
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 p-4">
      <div className="absolute -top-40 -left-32 size-[28rem] rounded-full bg-sky-500/20 blur-3xl" />
      <div className="absolute -right-32 -bottom-40 size-[28rem] rounded-full bg-amber-400/15 blur-3xl" />

      <div className="anim-up relative w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="flex justify-center">
            <LogoIcon size={72} />
          </div>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">Vem Pra Porto</h1>
          <p className="mt-1 text-sm text-slate-500">Painel administrativo</p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-xl shadow-slate-300/40 ring-1 ring-slate-200">
          <div className="mb-5 flex items-center gap-2">
            <Icon name={criando ? "user" : "lock"} className="size-4 text-sky-600" />
            <h2 className="font-bold text-slate-900">
              {criando ? "Criar administrador" : "Entrar no sistema"}
            </h2>
          </div>

          {criando ? (
            <form onSubmit={criarAdmin} className="space-y-3.5">
              <Aviso tom="info">
                Crie o administrador principal. Depois disso, novos usuários só podem ser
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
                  placeholder="admin@empresa.com"
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
                className="w-full text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Voltar para o login
              </button>
            </form>
          ) : (
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
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    <Icon name={verSenha ? "eyeOff" : "eye"} className="size-4" />
                  </button>
                </div>
              </Campo>

              <Botao icone="logout" carregando={carregando} className="w-full py-3">
                Entrar
              </Botao>

              {temAdmin === false && (
                <button
                  type="button"
                  onClick={() => {
                    setCriando(true);
                    setErro("");
                  }}
                  className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-sky-700"
                >
                  <Icon name="plus" className="size-3.5" /> Primeiro acesso: criar administrador
                </button>
              )}
            </form>
          )}

          {erro && (
            <div className="mt-4">
              <Aviso tom="erro">{erro}</Aviso>
            </div>
          )}

          {local && (
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              Entre como administrador e conecte o Google Sheets em{" "}
              <b className="text-slate-500">Configurações → Banco de dados</b>. Você também pode
              definir a variável <code className="font-mono">VITE_APPS_SCRIPT_URL</code> no GitHub.
            </p>
          )}

        </div>
      </div>
    </div>
  );
}
