import { useMemo, useState } from "react";
import { useStore } from "@/store";
import type { Passeio, Voucher } from "@/types";
import { Icon } from "@/components/Icon";
import { Botao, BotaoIcone, Busca, Cartao, Selecao, Selo, Vazio } from "@/components/ui";
import {
  aReceber,
  addDays,
  brl,
  dataBR,
  dataCurta,
  DIAS_CURTOS,
  hoje,
  iso,
  nomesClientes,
  normalizar,
  parseISO,
  rotuloRelativo,
  startOfWeek,
  STATUS_META,
  statusMeta,
  totalComDesconto,
  totalPessoas,
} from "@/lib/utils";
import {
  baixarEAbrirWhatsApp,
  compartilharPDFVoucher,
  linkGoogleAgenda,
} from "@/lib/voucherDoc";
import { cn } from "@/utils/cn";

interface Evento {
  v: Voucher;
  p: Passeio;
}

export default function Agenda({ ir }: { ir: (r: string) => void }) {
  const { vouchers, config, notificar } = useStore();
  const [visao, setVisao] = useState<"semana" | "lista">("semana");
  const [ancora, setAncora] = useState(() => startOfWeek(new Date()));
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState<"todos" | Voucher["status"]>("todos");
  const [aberto, setAberto] = useState<Evento | null>(null);

  /** Envia o voucher pelo WhatsApp: anexa o PDF no celular; no PC baixa e abre o WhatsApp. */
  const enviar = async (v: Voucher) => {
    const r = await compartilharPDFVoucher(v, config);
    if (r === "sem-suporte") {
      baixarEAbrirWhatsApp(v, config);
      notificar(
        "PDF baixado. Escolha o contato no WhatsApp e anexe o arquivo que acabou de baixar.",
        "info",
      );
    }
  };

  const eventos = useMemo<Evento[]>(
    () =>
      vouchers.flatMap((v) =>
        (v.passeios || []).filter((p) => p.data).map((p) => ({ v, p })),
      ),
    [vouchers],
  );

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => iso(addDays(ancora, i))), [ancora]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, Evento[]>();
    dias.forEach((d) => mapa.set(d, []));
    eventos.forEach((e) => {
      if (mapa.has(e.p.data)) mapa.get(e.p.data)!.push(e);
    });
    mapa.forEach((l) => l.sort((a, b) => (a.p.hora || "").localeCompare(b.p.hora || "")));
    return mapa;
  }, [eventos, dias]);

  const lista = useMemo(() => {
    const q = normalizar(busca.trim());
    return eventos
      .filter((e) => {
        if (fStatus !== "todos" && e.v.status !== fStatus) return false;
        if (!q) return true;
        return normalizar(
          `${nomesClientes(e.v)} ${e.p.nome} ${e.v.hotel} ${e.v.codigo}`,
        ).includes(q);
      })
      .sort((a, b) => `${a.p.data}${a.p.hora}`.localeCompare(`${b.p.data}${b.p.hora}`));
  }, [eventos, busca, fStatus]);

  const totais = useMemo(() => {
    const doPeriodo = eventos.filter(
      (e) => dias.includes(e.p.data) && e.v.status !== "cancelado",
    );
    const ids = new Set(doPeriodo.map((e) => e.v.id));
    return {
      passeios: doPeriodo.length,
      pessoas: doPeriodo.reduce((s, e) => s + totalPessoas(e.v), 0),
      receita: [...ids].reduce((s, id) => {
        const v = vouchers.find((vv) => vv.id === id);
        return s + (v ? totalComDesconto(v) : 0);
      }, 0),
    };
  }, [eventos, dias, vouchers]);

  return (
    <div className="space-y-5">
      <header className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Agenda</h1>
          <p className="text-sm text-slate-500">
            Todos os passeios dos vouchers organizados por dia e hora.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {(["semana", "lista"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVisao(v)}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-bold capitalize transition",
                  visao === v ? "bg-white text-sky-700 shadow-sm" : "text-slate-500",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <BotaoIcone
            icone="print"
            titulo="Imprimir roteiro"
            className="bg-white ring-1 ring-slate-200"
            onClick={() => window.print()}
          />
          <Botao icone="plus" onClick={() => ir("vouchers")}>
            Criar voucher
          </Botao>
        </div>
      </header>

      {visao === "semana" ? (
        <>
          <Cartao className="no-print flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex items-center gap-1">
              <BotaoIcone
                icone="left"
                titulo="Semana anterior"
                onClick={() => setAncora(addDays(ancora, -7))}
              />
              <button
                onClick={() => setAncora(startOfWeek(new Date()))}
                className="rounded-lg px-3 py-1.5 text-xs font-bold text-sky-600 hover:bg-sky-50"
              >
                Hoje
              </button>
              <BotaoIcone
                icone="right"
                titulo="Próxima semana"
                onClick={() => setAncora(addDays(ancora, 7))}
              />
              <p className="ml-2 text-sm font-bold text-slate-800">
                {dataCurta(dias[0])} — {dataCurta(dias[6])}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
              <span className="flex items-center gap-1.5">
                <Icon name="ticket" className="size-3.5 text-sky-500" /> {totais.passeios} passeios
              </span>
              <span className="flex items-center gap-1.5">
                <Icon name="users" className="size-3.5 text-amber-500" /> {totais.pessoas} pessoas
              </span>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1">{brl(totais.receita)}</span>
            </div>
          </Cartao>

          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[980px] grid-cols-7 gap-3">
              {dias.map((d) => {
                const evs = porDia.get(d) ?? [];
                const ehHoje = d === hoje();
                const data = parseISO(d);
                const pessoas = evs.reduce((s, e) => s + totalPessoas(e.v), 0);
                return (
                  <div
                    key={d}
                    className={cn(
                      "flex min-h-[400px] flex-col rounded-2xl bg-white ring-1 transition",
                      ehHoje
                        ? "shadow-md ring-2 shadow-sky-500/10 ring-sky-500"
                        : "ring-slate-200/80",
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center justify-between rounded-t-2xl px-3 py-2.5",
                        ehHoje ? "bg-sky-600 text-white" : "bg-slate-50 text-slate-600",
                      )}
                    >
                      <div>
                        <p className="text-[11px] font-bold tracking-wider uppercase">
                          {DIAS_CURTOS[data.getDay()]}
                        </p>
                        <p className="text-lg leading-none font-extrabold">{data.getDate()}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={cn(
                            "block rounded-full px-2 py-0.5 text-[11px] font-bold",
                            ehHoje ? "bg-white/20" : "bg-white text-slate-500 ring-1 ring-slate-200",
                          )}
                        >
                          {evs.length}
                        </span>
                        {pessoas > 0 && (
                          <span
                            className={cn(
                              "mt-1 block text-[10px] font-bold",
                              ehHoje ? "text-sky-100" : "text-slate-400",
                            )}
                          >
                            {pessoas} pax
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 space-y-2 overflow-y-auto p-2">
                      {evs.map((e) => (
                        <button
                          key={e.p.id}
                          onClick={() => setAberto(e)}
                          className={cn(
                            "w-full rounded-xl border-l-4 p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-md",
                            e.v.status === "cancelado"
                              ? "border-slate-300 bg-slate-50 opacity-60"
                              : e.v.status === "pendente"
                                ? "border-amber-500 bg-amber-50/70 hover:bg-amber-50"
                                : "border-sky-500 bg-sky-50/70 hover:bg-sky-50",
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <Icon name="clock" className="size-3.5 text-slate-500" />
                            <span className="text-[11px] font-extrabold text-slate-700">
                              {e.p.hora ? `${e.p.hora} (ida)` : "sem hora"}{e.p.horaVolta ? ` · volta ${e.p.horaVolta}` : ""}
                            </span>
                            <span className="ml-auto text-[10px] font-bold text-slate-400">
                              {totalPessoas(e.v)} pax
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs font-bold text-slate-800">
                            {nomesClientes(e.v)}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">{e.p.nome}</p>
                        </button>
                      ))}
                      {!evs.length && (
                        <p className="py-8 text-center text-[11px] text-slate-300">livre</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          <Cartao className="no-print p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <Busca
                valor={busca}
                aoMudar={setBusca}
                placeholder="Buscar por cliente, passeio, hotel ou código..."
                className="flex-1"
              />
              <Selecao
                value={fStatus}
                onChange={(e) => setFStatus(e.target.value as typeof fStatus)}
                className="lg:w-48"
              >
                <option value="todos">Todos os status</option>
                {(["pendente", "concluido", "cancelado"] as const).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </Selecao>
            </div>
          </Cartao>

          {lista.length === 0 ? (
            <Cartao>
              <Vazio
                icone="calendar"
                titulo="Nenhum passeio encontrado"
                texto="Os passeios aparecem aqui automaticamente quando você cria um voucher."
                acao={
                  <Botao icone="plus" onClick={() => ir("vouchers")}>
                    Criar voucher
                  </Botao>
                }
              />
            </Cartao>
          ) : (
            <Cartao className="print-full overflow-hidden">
              <div className="hidden grid-cols-[1fr_1.6fr_1.4fr_1fr_auto] gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-[11px] font-bold tracking-wider text-slate-500 uppercase lg:grid">
                <span>Data / hora</span>
                <span>Cliente</span>
                <span>Passeio</span>
                <span>Status</span>
                <span className="w-24 text-right">Ações</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {lista.map((e) => (
                  <li
                    key={e.p.id}
                    className="grid grid-cols-1 gap-3 px-5 py-4 transition-colors hover:bg-slate-50/70 lg:grid-cols-[1fr_1.6fr_1.4fr_1fr_auto] lg:items-center lg:gap-4"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">{dataBR(e.p.data)}</p>
                      <p className="text-xs text-slate-400">
                        {e.p.hora ? `${e.p.hora} (ida)` : "sem hora"}{e.p.horaVolta ? ` · volta ${e.p.horaVolta}` : ""} · {rotuloRelativo(e.p.data)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {nomesClientes(e.v)}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {totalPessoas(e.v)} pessoa(s) · {e.v.hotel || "sem hotel"}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-700">{e.p.nome}</p>
                      <p className="truncate font-mono text-[11px] text-slate-400">{e.v.codigo}</p>
                    </div>
                    <div>
                      <Selo className={statusMeta(e.v.status).chip}>
                        <i className={cn("size-1.5 rounded-full", statusMeta(e.v.status).dot)} />
                        {statusMeta(e.v.status).label}
                      </Selo>
                    </div>
                    <div className="no-print flex justify-end gap-1">
                      <BotaoIcone
                        icone="info"
                        titulo="Ver detalhes"
                        onClick={() => setAberto(e)}
                      />
                      <button
                        type="button"
                        title="Enviar PDF no WhatsApp (escolher contato)"
                        onClick={() => enviar(e.v)}
                        className="inline-grid size-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                      >
                        <Icon name="send" className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </>
      )}

      {/* Detalhe rápido do passeio */}
      {aberto && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setAberto(null)} />
          <aside className="anim-slide relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
              <div className="min-w-0">
                <p className="font-mono text-xs font-bold text-sky-600">{aberto.v.codigo}</p>
                <h2 className="truncate text-lg font-bold text-slate-900">{aberto.p.nome}</h2>
                <p className="text-sm text-slate-500">
                  {dataBR(aberto.p.data)}{aberto.p.hora ? ` às ${aberto.p.hora} (ida)` : ""}
                  {aberto.p.dataVolta && aberto.p.dataVolta !== aberto.p.data ? ` | Volta ${dataBR(aberto.p.dataVolta)}` : ""}
                  {aberto.p.horaVolta ? ` às ${aberto.p.horaVolta}` : ""}
                </p>
              </div>
              <BotaoIcone icone="close" titulo="Fechar" onClick={() => setAberto(null)} />
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Cliente</p>
                <p className="font-semibold text-slate-900">{nomesClientes(aberto.v)}</p>
                <p className="text-xs text-slate-500">{totalPessoas(aberto.v)} pessoa(s)</p>
              </div>

              {aberto.v.hotel && (
                <p className="flex items-start gap-2 text-slate-700">
                  <Icon name="pin" className="mt-0.5 size-4 text-slate-400" /> {aberto.v.hotel}
                </p>
              )}
              {aberto.v.telefone && (
                <p className="flex items-center gap-2 text-slate-700">
                  <Icon name="phone" className="size-4 text-slate-400" /> {aberto.v.telefone}
                </p>
              )}
              {aberto.p.local && (
                <p className="flex items-center gap-2 text-slate-700">
                  <Icon name="info" className="size-4 text-slate-400" /> Encontro: {aberto.p.local}
                </p>
              )}

              <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-900 p-4 text-center text-white">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">VALOR TOTAL</p>
                  <p className="text-sm font-bold text-amber-300">{brl(totalComDesconto(aberto.v))}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">ENTRADA PAGA</p>
                  <p className="text-sm font-bold">{brl(aberto.v.entrada)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">A RECEBER</p>
                  <p className="text-sm font-bold">{brl(aReceber(aberto.v))}</p>
                </div>
              </div>

              {aberto.v.observacoes && (
                <div className="rounded-xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200">
                  {aberto.v.observacoes}
                </div>
              )}
            </div>

            <footer className="grid grid-cols-3 gap-2 border-t border-slate-100 p-4">
              <Botao variante="sucesso" icone="send" onClick={() => enviar(aberto.v)} className="text-xs">
                WhatsApp
              </Botao>
              <a
                href={linkGoogleAgenda(aberto.v, config)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
              >
                <Icon name="calendar" className="size-4" /> Agenda
              </a>
              <Botao icone="ticket" onClick={() => ir("vouchers")} className="text-xs">
                Voucher
              </Botao>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
