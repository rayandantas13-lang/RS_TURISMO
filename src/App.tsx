import { useEffect, useMemo, useState } from "react";
import { StoreProvider, useStore } from "@/store";
import { Icon, type IconName } from "@/components/Icon";
import { LogoMarca, LogoIcon } from "@/components/Logo";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Agenda from "@/pages/Agenda";
import Vouchers from "@/pages/Vouchers";
import Configuracoes from "@/pages/Configuracoes";
import Financeiro from "@/pages/Financeiro";
import { AVISO_IMPLANTACAO_ANTIGA } from "@/api";
import { dataCompleta, hoje, iniciais, totalPessoas } from "@/lib/utils";
import { cn } from "@/utils/cn";

const NAV: { id: string; label: string; icone: IconName; desc: string; admin?: boolean }[] = [
  { id: "inicio", label: "Início", icone: "grid", desc: "Visão geral do dia" },
  { id: "vouchers", label: "Vouchers", icone: "ticket", desc: "Criar, enviar e gerar PDF" },
  { id: "agenda", label: "Agenda", icone: "calendar", desc: "Passeios por dia e hora" },
  { id: "financeiro", label: "Financeiro", icone: "money", desc: "Gastos e resultado real" },
  {
    id: "config",
    label: "Configurações",
    icone: "settings",
    desc: "Empresa, política e banco",
    admin: true,
  },
];

function useRota() {
  const [rota, setRota] = useState(() => window.location.hash.replace("#/", "") || "inicio");
  useEffect(() => {
    const h = () => setRota(window.location.hash.replace("#/", "") || "inicio");
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  const ir = (r: string) => {
    window.location.hash = `/${r}`;
    setRota(r);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return [rota, ir] as const;
}

function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="no-print pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "anim-up pointer-events-auto flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg",
            t.tone === "ok" && "bg-emerald-600",
            t.tone === "erro" && "bg-rose-600",
            t.tone === "info" && "bg-slate-900",
          )}
        >
          <Icon
            name={t.tone === "ok" ? "check" : t.tone === "erro" ? "alert" : "info"}
            className="size-4"
          />
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function Painel() {
  const [rota, ir] = useRota();
  const [menuAberto, setMenuAberto] = useState(false);
  const { config, vouchers, usuario, ehAdmin, sair, carregando, erroCarga, local, apiDesatualizada } =
    useStore();

  const hojeInfo = useMemo(() => {
    const h = hoje();
    const evs = vouchers
      .filter((v) => v.status !== "cancelado")
      .flatMap((v) => (v.passeios || []).filter((p) => p.data === h).map((p) => ({ v, p })));
    return {
      passeios: evs.length,
      pessoas: evs.reduce((s, e) => s + totalPessoas(e.v), 0),
    };
  }, [vouchers]);

  const itens = NAV.filter((n) => !n.admin || ehAdmin);
  const atual = itens.find((n) => n.id === rota) ?? itens[0];

  useEffect(() => {
    if (rota === "config" && !ehAdmin) ir("inicio");
  }, [rota, ehAdmin]);

  const pagina = () => {
    switch (atual.id) {
      case "vouchers":
        return <Vouchers />;
      case "agenda":
        return <Agenda ir={ir} />;
      case "financeiro":
        return <Financeiro />;
      case "config":
        return ehAdmin ? <Configuracoes /> : null;
      default:
        return <Dashboard ir={ir} />;
    }
  };

  const Nav = () => (
    <nav className="space-y-1">
      {itens.map((n) => {
        const ativo = n.id === atual.id;
        return (
          <button
            key={n.id}
            onClick={() => {
              ir(n.id);
              setMenuAberto(false);
            }}
            className={cn(
              "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
              ativo
                ? "bg-white/10 text-white shadow-sm ring-1 ring-white/10"
                : "text-slate-400 hover:bg-white/5 hover:text-white",
            )}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
                ativo
                  ? "bg-gradient-to-br from-sky-500 to-amber-500 text-white"
                  : "bg-white/5 text-slate-400 group-hover:text-white",
              )}
            >
              <Icon name={n.icone} className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{n.label}</span>
              <span className="block truncate text-[11px] text-slate-500">{n.desc}</span>
            </span>
            {ativo && <i className="size-1.5 rounded-full bg-sky-400" />}
          </button>
        );
      })}
    </nav>
  );

  const Marca = () => (
    <LogoMarca
      size={40}
      subtitulo={local ? "Modo local" : "Controle de vouchers"}
      subClassName={local ? "text-amber-400" : "text-sky-300"}
    />
  );

  return (
    <div className="min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-72 flex-col justify-between overflow-hidden bg-gradient-to-b from-[#0C2D48] via-[#0F3460] to-[#0C2D48] p-4 lg:flex">
        {/* Onda decorativa no fundo do sidebar */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 opacity-[0.04]">
          <svg viewBox="0 0 288 120" fill="none" className="w-full">
            <path d="M0 60 C48 30, 96 90, 144 60 C192 30, 240 90, 288 60 V120 H0 Z" fill="white"/>
            <path d="M0 80 C48 55, 96 105, 144 80 C192 55, 240 105, 288 80 V120 H0 Z" fill="white" opacity="0.5"/>
          </svg>
        </div>
        <div className="space-y-6">
          <Marca />
          <Nav />
        </div>
        <div className="space-y-3">
          <div className="rounded-2xl bg-gradient-to-br from-sky-600 via-sky-700 to-cyan-800 p-4 text-white shadow-lg shadow-sky-900/30">
            <p className="text-[11px] font-bold tracking-wider text-amber-300 uppercase">Hoje</p>
            <p className="mt-1 text-2xl font-extrabold">{hojeInfo.passeios} passeios</p>
            <p className="text-xs text-sky-100">{hojeInfo.pessoas} pessoas para atender</p>
            <button
              onClick={() => ir("vouchers")}
              className="mt-3 w-full rounded-lg bg-white/15 py-2 text-xs font-bold ring-1 ring-white/20 transition hover:bg-white/25"
            >
              Criar voucher
            </button>
          </div>
          <p className="px-2 text-[11px] text-slate-500">
            {local ? "Local" : "On"}
          </p>
        </div>
      </aside>

      {menuAberto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60" onClick={() => setMenuAberto(false)} />
          <aside className="anim-slide absolute inset-y-0 left-0 flex w-72 flex-col justify-between bg-gradient-to-b from-[#0C2D48] via-[#0F3460] to-[#0C2D48] p-4">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Marca />
                <button
                  onClick={() => setMenuAberto(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  <Icon name="close" className="size-5" />
                </button>
              </div>
              <Nav />
            </div>
            <button
              onClick={sair}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <Icon name="logout" className="size-4" /> Sair
            </button>
          </aside>
        </div>
      )}

      <div className="lg:pl-72">
        <header className="no-print sticky top-0 z-20 border-b border-slate-200/70 bg-slate-50/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6">
            <button
              onClick={() => setMenuAberto(true)}
              className="grid size-10 place-items-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200 lg:hidden"
              aria-label="Abrir menu"
            >
              <Icon name="menu" className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold text-slate-900">{atual.label}</h1>
              <p className="truncate text-xs text-slate-500 capitalize">{dataCompleta(hoje())}</p>
            </div>

            <div
              className={cn(
                "hidden items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold ring-1 sm:flex",
                local ? "text-amber-700 ring-amber-200" : "text-slate-600 ring-slate-200",
              )}
              title={local ? "Dados apenas neste navegador" : "Salvando no Google Sheets"}
            >
              <span className="relative flex size-2">
                {!local && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={cn(
                    "relative inline-flex size-2 rounded-full",
                    local ? "bg-amber-500" : "bg-emerald-500",
                  )}
                />
              </span>
              {local ? "Local" : "On"}
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-white p-1.5 ring-1 ring-slate-200">
              <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-600 text-xs font-bold text-white">
                {iniciais(usuario?.nome ?? "?")}
              </span>
              <span className="hidden max-w-24 truncate text-xs font-semibold text-slate-700 sm:block">
                {usuario?.usuario}
              </span>
              <button
                onClick={sair}
                title="Sair"
                aria-label="Sair"
                className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              >
                <Icon name="logout" className="size-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="print-full mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
          {carregando ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-400">
              <Icon name="refresh" className="size-7 animate-spin text-sky-500" />
              <span className="text-sm font-medium">
                {local ? "Carregando dados..." : "Carregando dados do Google Sheets..."}
              </span>
            </div>
          ) : (
            <div key={atual.id} className="anim-up space-y-5">
              {apiDesatualizada && (
                <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
                  <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p>{AVISO_IMPLANTACAO_ANTIGA}</p>
                    {ehAdmin && (
                      <button
                        onClick={() => ir("config")}
                        className="text-xs font-bold text-amber-900 underline underline-offset-2 hover:text-amber-950"
                      >
                        Abrir Configurações → Banco de dados
                      </button>
                    )}
                  </div>
                </div>
              )}
              {erroCarga && (
                <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
                  <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p>{erroCarga}</p>
                    {ehAdmin && (
                      <button
                        onClick={() => ir("config")}
                        className="text-xs font-bold text-rose-800 underline underline-offset-2 hover:text-rose-950"
                      >
                        Abrir Configurações → Banco de dados e testar a conexão
                      </button>
                    )}
                  </div>
                </div>
              )}
              {pagina()}
            </div>
          )}
        </main>

        <footer className="no-print mx-auto max-w-[1400px] px-4 pb-8 text-center text-xs text-slate-400 sm:px-6">
          {config.empresa} · controle de vouchers — pronto para GitHub Pages
        </footer>
      </div>

      <Toasts />
    </div>
  );
}

function Porta() {
  const { sessao, verificando, entrar } = useStore();

  if (verificando)
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100">
        <Icon name="refresh" className="size-7 animate-spin text-sky-500" />
      </div>
    );

  if (!sessao) return <Login aoEntrar={entrar} />;
  return <Painel />;
}

export default function App() {
  return (
    <StoreProvider>
      <Porta />
    </StoreProvider>
  );
}
