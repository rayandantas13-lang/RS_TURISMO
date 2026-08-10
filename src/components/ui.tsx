import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/cn";
import { Icon, type IconName } from "@/components/Icon";

/* ---------------- Botão ---------------- */
type Variante = "primario" | "suave" | "contorno" | "fantasma" | "perigo" | "sucesso";
const VAR: Record<Variante, string> = {
  primario:
    "bg-sky-600 text-white shadow-sm shadow-sky-600/25 hover:bg-sky-700 active:bg-sky-800",
  suave: "bg-sky-50 text-sky-700 hover:bg-sky-100",
  contorno: "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300",
  fantasma: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  perigo: "bg-rose-600 text-white hover:bg-rose-700",
  sucesso: "bg-emerald-600 text-white hover:bg-emerald-700",
};

export function Botao({
  children,
  variante = "primario",
  icone,
  carregando,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  icone?: IconName;
  carregando?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || carregando}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        VAR[variante],
        className,
      )}
    >
      {carregando ? (
        <Icon name="refresh" className="size-4 animate-spin" />
      ) : (
        icone && <Icon name={icone} className="size-4" />
      )}
      {children}
    </button>
  );
}

export function BotaoIcone({
  icone,
  titulo,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icone: IconName; titulo: string }) {
  return (
    <button
      {...props}
      title={titulo}
      aria-label={titulo}
      className={cn(
        "inline-grid size-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-sky-500 outline-none",
        className,
      )}
    >
      <Icon name={icone} className="size-4" />
    </button>
  );
}

/* ---------------- Campos ---------------- */
export const BASE_CAMPO =
  "w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-sm text-slate-900 ring-1 ring-slate-200 transition placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 outline-none disabled:bg-slate-50 disabled:text-slate-400";

export function Campo({
  rotulo,
  dica,
  erro,
  children,
  className,
}: {
  rotulo?: string;
  dica?: string;
  erro?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      {rotulo && (
        <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
          {rotulo}
          {dica && <span className="font-normal text-slate-400">{dica}</span>}
        </span>
      )}
      {children}
      {erro && <span className="mt-1 block text-xs font-medium text-rose-600">{erro}</span>}
    </label>
  );
}

export function Entrada({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(BASE_CAMPO, className)} />;
}

export function Selecao({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        BASE_CAMPO,
        "cursor-pointer appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9",
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
    >
      {children}
    </select>
  );
}

export function AreaTexto({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(BASE_CAMPO, "resize-y", className)} />;
}

export function Busca({
  valor,
  aoMudar,
  placeholder,
  className,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Icon
        name="search"
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400"
      />
      <input
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        className={cn(BASE_CAMPO, "pl-10")}
      />
      {valor && (
        <button
          onClick={() => aoMudar("")}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Limpar busca"
        >
          <Icon name="close" className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/* ---------------- Superfícies ---------------- */
export function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white shadow-sm shadow-slate-200/60 ring-1 ring-slate-200/80",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Selo({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide whitespace-nowrap ring-1 ring-inset",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({
  nome,
  cor,
  className,
}: {
  nome: string;
  cor: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-bold text-white shadow-sm",
        cor,
        className,
      )}
    >
      {nome}
    </div>
  );
}

export function Vazio({
  icone = "search",
  titulo,
  texto,
  acao,
}: {
  icone?: IconName;
  titulo: string;
  texto?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon name={icone} className="size-6" />
      </div>
      <div>
        <p className="font-semibold text-slate-800">{titulo}</p>
        {texto && <p className="mt-1 max-w-sm text-sm text-slate-500">{texto}</p>}
      </div>
      {acao}
    </div>
  );
}

export function Aviso({
  tom,
  children,
  icone,
}: {
  tom: "ok" | "erro" | "info" | "alerta";
  children: ReactNode;
  icone?: IconName;
}) {
  const map = {
    ok: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    erro: "bg-rose-50 text-rose-700 ring-rose-200",
    info: "bg-sky-50 text-sky-800 ring-sky-200",
    alerta: "bg-amber-50 text-amber-800 ring-amber-200",
  } as const;
  const padrao: Record<string, IconName> = {
    ok: "check",
    erro: "alert",
    info: "info",
    alerta: "alert",
  };
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium ring-1",
        map[tom],
      )}
    >
      <Icon name={icone ?? padrao[tom]} className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  subtitulo,
  children,
  rodape,
  largura = "max-w-2xl",
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: string;
}) {
  useEffect(() => {
    if (!aberto) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  /*
   * O modal vai para o <body> via portal: assim o `position: fixed` fica
   * sempre relativo à tela, mesmo se algum ancestral tiver transform
   * (ex.: animações .anim-up), que antes deixava o rodapé fora da área
   * visível sem como rolar até os botões.
   */
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain"
      style={{
        WebkitOverflowScrolling: "touch",
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingRight: "max(0.75rem, env(safe-area-inset-right))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
      }}
    >
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={aoFechar}
        aria-hidden="true"
      />
      <div className="relative flex min-h-full items-start justify-center py-2 sm:py-6">
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "modal-panel anim-pop relative flex w-full max-w-full flex-col overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10",
            largura,
          )}
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{titulo}</h2>
              {subtitulo && <p className="mt-0.5 text-sm text-slate-500">{subtitulo}</p>}
            </div>
            <BotaoIcone icone="close" titulo="Fechar" onClick={aoFechar} />
          </header>
          <div className="modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            {children}
          </div>
          {rodape && (
            <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 shadow-[0_-8px_16px_-12px_rgba(15,23,42,0.35)] sm:px-6">
              {rodape}
            </footer>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function Progresso({ pct, cor = "bg-sky-500" }: { pct: number; cor?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn("h-full rounded-full transition-all duration-500", cor)}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}
