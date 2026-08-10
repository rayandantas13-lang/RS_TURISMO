import { useMemo, useState } from "react";
import { useStore } from "@/store";
import type { StatusVoucher, Voucher } from "@/types";
import { Icon } from "@/components/Icon";
import {
  AreaTexto,
  Aviso,
  Botao,
  BotaoIcone,
  Busca,
  Campo,
  Cartao,
  Entrada,
  Modal,
  Selecao,
  Selo,
  Vazio,
} from "@/components/ui";
import {
  aReceber,
  brl,
  dataBR,
  datasPasseios,
  gerarCodigo,
  gerarHorarios,
  hoje,
  mascaraTelefone,
  mensagemVoucher,
  nomesClientes,
  nomesPasseios,
  normalizar,
  passeioVazio,
  primeiraData,
  rotuloRelativo,
  STATUS_LISTA,
  STATUS_META,
  statusMeta,
  totalComDesconto,
  totalPessoas,
  uid,
  valorDesconto,
} from "@/lib/utils";
import {
  baixarEAbrirWhatsApp,
  baixarPDFVoucher,
  compartilharPDFVoucher,
  linkGoogleAgenda,
  nomeArquivoPDF,
} from "@/lib/voucherDoc";
import { cn } from "@/utils/cn";

const HORARIOS = gerarHorarios("04:00", "23:00");

const novoVoucher = (): Voucher => ({
  id: uid(),
  codigo: gerarCodigo(),
  clientes: [""],
  pessoas: 1,
  hotel: "",
  telefone: "",
  contatoExtra: "",
  passeios: [passeioVazio()],
  total: 0,
  tipoDesconto: "percentual",
  desconto: 0,
  entrada: 0,
  formaPagamento: "",
  observacoes: "",
  status: "pendente",
  criadoEm: new Date().toISOString(),
});

export default function Vouchers() {
  const { vouchers, config, salvarVoucher, removerVoucher, mudarStatus, notificar } = useStore();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | StatusVoucher>("todos");
  const [form, setForm] = useState<Voucher | null>(null);
  const [erro, setErro] = useState("");
  const [excluir, setExcluir] = useState<Voucher | null>(null);
  const [previa, setPrevia] = useState<Voucher | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);

  const lista = useMemo(() => {
    const q = normalizar(busca.trim());
    return vouchers
      .filter((v) => {
        if (filtro !== "todos" && v.status !== filtro) return false;
        if (!q) return true;
        return normalizar(
          `${v.codigo} ${nomesClientes(v)} ${nomesPasseios(v)} ${v.hotel} ${v.telefone}`,
        ).includes(q);
      })
      .sort((a, b) => (primeiraData(b) || b.criadoEm).localeCompare(primeiraData(a) || a.criadoEm));
  }, [vouchers, busca, filtro]);

  const stats = useMemo(() => {
    const ativos = vouchers.filter((v) => v.status !== "cancelado");
    return {
      total: vouchers.length,
      pessoas: ativos.reduce((s, v) => s + totalPessoas(v), 0),
      faturado: ativos.reduce((s, v) => s + totalComDesconto(v), 0),
      receber: ativos
        .filter((v) => v.status !== "concluido")
        .reduce((s, v) => s + aReceber(v), 0),
    };
  }, [vouchers]);

  /* ---------------- formulário ---------------- */
  const set = (p: Partial<Voucher>) => setForm((f) => (f ? { ...f, ...p } : f));

  const setCliente = (i: number, valor: string) => {
    if (!form) return;
    const l = [...form.clientes];
    l[i] = valor;
    set({ clientes: l, pessoas: Math.max(form.pessoas, l.filter((n) => n.trim()).length) });
  };

  const addCliente = () => form && set({ clientes: [...form.clientes, ""] });

  const removeCliente = (i: number) => {
    if (!form) return;
    const l = form.clientes.filter((_, idx) => idx !== i);
    set({ clientes: l.length ? l : [""] });
  };

  const setPasseio = (i: number, p: Partial<Voucher["passeios"][number]>) => {
    if (!form) return;
    const l = form.passeios.map((x, idx) => (idx === i ? { ...x, ...p } : x));
    set({ passeios: l });
  };

  const escolherServico = (i: number, nome: string) => {
    if (!form) return;
    const s = config.servicos.find((x) => x.nome === nome);
    setPasseio(i, {
      nome,
      oQueLevar: s?.oQueLevar ?? form.passeios[i].oQueLevar,
      local: s?.pontoRetorno ?? form.passeios[i].local,
      informacoesAdicionais: s?.informacoesAdicionais ?? form.passeios[i].informacoesAdicionais,
    });
    if (s) set({ total: s.preco * (form.pessoas || 1) });
  };

  const addPasseio = () =>
    form && set({ passeios: [...form.passeios, passeioVazio(primeiraData(form) || hoje())] });

  const removePasseio = (i: number) => {
    if (!form) return;
    const l = form.passeios.filter((_, idx) => idx !== i);
    set({ passeios: l.length ? l : [passeioVazio()] });
  };

  const salvar = () => {
    if (!form) return;
    const clientes = form.clientes.map((n) => n.trim()).filter(Boolean);
    if (!clientes.length) return setErro("Informe pelo menos o nome de um cliente.");
    const passeios = form.passeios.filter((p) => p.nome.trim() && p.data);
    if (!passeios.length) return setErro("Informe pelo menos um passeio com nome e data.");
    if (form.entrada > totalComDesconto(form))
      return setErro("A entrada não pode ser maior que o total (com desconto).");

    salvarVoucher({
      ...form,
      clientes,
      passeios,
      pessoas: Math.max(1, Number(form.pessoas) || clientes.length),
      codigo: form.codigo.trim().toUpperCase(),
    });
    setForm(null);
    setErro("");
  };

  /**
   * Envia o voucher pelo WhatsApp:
   * - no celular, anexa o PDF e abre a lista de contatos;
   * - no computador, baixa o PDF e abre o WhatsApp com a mensagem pronta.
   * Sem número fixo: a escolha do contato é feita no próprio WhatsApp.
   */
  const enviar = async (v: Voucher) => {
    if (enviando) return;
    setEnviando(v.id);
    try {
      const r = await compartilharPDFVoucher(v, config);
      if (r === "sem-suporte") {
        baixarEAbrirWhatsApp(v, config);
        notificar(
          "PDF baixado. Escolha o contato no WhatsApp e anexe o arquivo que acabou de baixar.",
          "info",
        );
      }
    } finally {
      setEnviando(null);
    }
  };

  const baixar = (v: Voucher) => {
    try {
      baixarPDFVoucher(v, config);
      notificar(`PDF do voucher ${v.codigo} gerado.`);
    } catch {
      notificar("Falha ao gerar o PDF.", "erro");
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Vouchers</h1>
          <p className="text-sm text-slate-500">
            Crie seu voucher!
          </p>
        </div>
        <Botao
          icone="plus"
          onClick={() => {
            setForm(novoVoucher());
            setErro("");
          }}
        >
          Criar voucher
        </Botao>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { l: "Vouchers", v: String(stats.total), i: "ticket" as const, c: "text-sky-600 bg-sky-50" },
          { l: "Pessoas atendidas", v: String(stats.pessoas), i: "users" as const, c: "text-amber-600 bg-amber-50" },
          { l: "Total dos vouchers", v: brl(stats.faturado), i: "money" as const, c: "text-emerald-600 bg-emerald-50" },
          { l: "A receber", v: brl(stats.receber), i: "clock" as const, c: "text-amber-600 bg-amber-50" },
        ].map((k) => (
          <Cartao key={k.l} className="flex items-center gap-4 p-5">
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", k.c)}>
              <Icon name={k.i} className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-extrabold text-slate-900">{k.v}</p>
              <p className="text-xs font-semibold text-slate-500">{k.l}</p>
            </div>
          </Cartao>
        ))}
      </div>

      <Cartao className="p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Busca
            valor={busca}
            aoMudar={setBusca}
            placeholder="Buscar por cliente, código, passeio ou hotel..."
            className="flex-1"
          />
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
            {(["todos", ...STATUS_LISTA] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition",
                  filtro === f
                    ? "bg-white text-sky-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                {f === "todos" ? "Todos" : STATUS_META[f].label}
              </button>
            ))}
          </div>
        </div>
      </Cartao>

      {lista.length === 0 ? (
        <Cartao>
          <Vazio
            icone="ticket"
            titulo="Nenhum voucher encontrado"
            texto="Crie o primeiro voucher com os dados que você recebeu pelo WhatsApp."
            acao={
              <Botao icone="plus" onClick={() => setForm(novoVoucher())}>
                Criar voucher
              </Botao>
            }
          />
        </Cartao>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {lista.map((v) => {
            const data = primeiraData(v);
            return (
              <div
                key={v.id}
                className="anim-up flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80 transition hover:shadow-lg"
              >
                <div
                  className={cn(
                    "flex items-start justify-between gap-3 px-5 py-4",
                    v.status === "cancelado"
                      ? "bg-slate-200 text-slate-600"
                      : "bg-gradient-to-br from-sky-600 to-amber-600 text-white",
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold tracking-wider opacity-80">
                      {v.codigo}
                    </p>
                    <p className="truncate text-lg font-extrabold">{nomesClientes(v)}</p>
                    <p className="truncate text-xs opacity-90">
                      {totalPessoas(v)} pessoa(s) · {v.hotel || "sem hotel"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {valorDesconto(v) > 0 ? (
                      <>
                        {/* Total original riscado + total com desconto */}
                        <p
                          className={cn(
                            "text-base leading-none font-bold line-through decoration-rose-300",
                            v.status === "cancelado" ? "text-slate-500" : "text-white/80",
                          )}
                        >
                          {brl(v.total)}
                        </p>
                        <p className="mt-0.5 text-xl leading-none font-extrabold">
                          {brl(totalComDesconto(v))}
                        </p>
                      </>
                    ) : (
                      <p className="text-xl leading-none font-extrabold">{brl(v.total)}</p>
                    )}
                    {aReceber(v) > 0 && (
                      <p className="mt-1 text-[11px] font-bold opacity-90">
                        receber {brl(aReceber(v))}
                      </p>
                    )}
                  </div>
                </div>

                <div className="ticket-notch h-4 bg-white" />

                <div className="flex flex-1 flex-col gap-3 px-5 pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Selo className={statusMeta(v.status).chip}>
                      <i className={cn("size-1.5 rounded-full", statusMeta(v.status).dot)} />
                      {statusMeta(v.status).label}
                    </Selo>
                    {data && (
                      <Selo className="bg-slate-100 text-slate-600 ring-slate-200">
                        <Icon name="calendar" className="size-3" /> {rotuloRelativo(data)}
                      </Selo>
                    )}
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <p className="flex items-start gap-2 text-slate-700">
                      <Icon name="pin" className="mt-0.5 size-4 shrink-0 text-sky-500" />
                      <span className="font-semibold">{nomesPasseios(v) || "—"}</span>
                    </p>
                    <p className="flex items-center gap-2 text-xs text-slate-500">
                      <Icon name="calendar" className="size-3.5 shrink-0" />
                      {datasPasseios(v) || "sem data"}
                    </p>
                    {v.telefone && (
                      <p className="flex items-center gap-2 text-xs text-slate-500">
                        <Icon name="phone" className="size-3.5 shrink-0" />
                        {v.telefone}
                      </p>
                    )}
                  </div>

                  <div className="mt-auto space-y-2 border-t border-slate-100 pt-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => enviar(v)}
                        disabled={enviando === v.id}
                        title="Abre o compartilhamento com o PDF anexado para você escolher o contato"
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <Icon name="send" className="size-4" />
                        {enviando === v.id ? "Abrindo..." : "Enviar WhatsApp"}
                      </button>
                      <button
                        onClick={() => baixar(v)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
                      >
                        <Icon name="download" className="size-4" /> Baixar PDF
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      <a
                        href={linkGoogleAgenda(v, config)}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir no Google Agenda"
                        className="inline-grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-sky-50 hover:text-sky-600"
                      >
                        <Icon name="calendar" className="size-4" />
                      </a>
                      <BotaoIcone
                        icone="eye"
                        titulo="Pré-visualizar envio"
                        onClick={() => setPrevia(v)}
                      />
                      <BotaoIcone
                        icone="edit"
                        titulo="Editar"
                        onClick={() => {
                          setForm({ ...v, clientes: [...v.clientes], passeios: [...v.passeios] });
                          setErro("");
                        }}
                      />
                      <BotaoIcone
                        icone="trash"
                        titulo="Excluir"
                        className="hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => setExcluir(v)}
                      />

                      <Selecao
                        value={v.status}
                        onChange={(e) => mudarStatus(v.id, e.target.value as StatusVoucher)}
                        className="ml-auto w-auto min-w-28 px-2 py-1.5 text-[11px] font-bold"
                      >
                        {STATUS_LISTA.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_META[s].label}
                          </option>
                        ))}
                      </Selecao>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------------- Formulário ---------------- */}
      <Modal
        aberto={!!form}
        aoFechar={() => setForm(null)}
        titulo={vouchers.some((v) => v.id === form?.id) ? "Editar voucher" : "Criar voucher"}
        subtitulo="Preencha com os dados que o cliente passou pelo WhatsApp."
        largura="max-w-3xl"
        rodape={
          <>
            {form && vouchers.some((v) => v.id === form.id) && (
              <Botao
                variante="fantasma"
                icone="trash"
                className="mr-auto text-rose-600 hover:bg-rose-50"
                onClick={() => {
                  setExcluir(form);
                  setForm(null);
                }}
              >
                Excluir
              </Botao>
            )}
            <Botao variante="contorno" onClick={() => setForm(null)}>
              Cancelar
            </Botao>
            <Botao icone="check" onClick={salvar}>
              Salvar voucher
            </Botao>
          </>
        }
      >
        {form && (
          <div className="space-y-5">
            {erro && <Aviso tom="erro">{erro}</Aviso>}

            {/* Código e status */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo rotulo="Código do voucher">
                <div className="flex gap-2">
                  <Entrada
                    value={form.codigo}
                    onChange={(e) => set({ codigo: e.target.value.toUpperCase() })}
                    className="font-mono uppercase"
                  />
                  <BotaoIcone
                    icone="refresh"
                    titulo="Gerar novo código"
                    className="shrink-0 bg-slate-100"
                    onClick={() => set({ codigo: gerarCodigo() })}
                  />
                </div>
              </Campo>
              <Campo rotulo="Status">
                <Selecao
                  value={form.status}
                  onChange={(e) => set({ status: e.target.value as StatusVoucher })}
                >
                  {STATUS_LISTA.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </Selecao>
              </Campo>
              <Campo rotulo="Nº de pessoas" dica="total do grupo">
                <Entrada
                  type="number"
                  min={1}
                  value={form.pessoas}
                  onChange={(e) => set({ pessoas: Number(e.target.value) })}
                />
              </Campo>
            </div>

            {/* Clientes */}
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Icon name="users" className="size-4 text-sky-600" /> Clientes do serviço
                </p>
                <Botao variante="suave" icone="plus" onClick={addCliente} className="px-2.5 py-1.5 text-xs">
                  Adicionar pessoa
                </Botao>
              </div>
              <div className="space-y-2">
                {form.clientes.map((nome, i) => (
                  <div key={i} className="flex gap-2">
                    <Entrada
                      value={nome}
                      onChange={(e) => setCliente(i, e.target.value)}
                      placeholder={i === 0 ? "Nome do cliente principal" : `Acompanhante ${i}`}
                    />
                    {form.clientes.length > 1 && (
                      <BotaoIcone
                        icone="close"
                        titulo="Remover"
                        className="shrink-0 hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => removeCliente(i)}
                      />
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                No voucher aparece: <b>{nomesClientes(form) || "—"}</b> ({totalPessoas(form)} pessoa
                {totalPessoas(form) > 1 ? "s" : ""})
              </p>
            </div>

            {/* Contato */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Hotel / pousada">
                <Entrada
                  value={form.hotel}
                  onChange={(e) => set({ hotel: e.target.value })}
                  placeholder="Paraíso Mar Hotel (Arraial)"
                />
              </Campo>
              <Campo rotulo="WhatsApp do cliente" dica="vai impresso no PDF">
                <Entrada
                  value={form.telefone}
                  onChange={(e) => set({ telefone: mascaraTelefone(e.target.value) })}
                  placeholder="(73) 99999-0000"
                  inputMode="tel"
                />
              </Campo>
              <Campo rotulo="Outros contatos" className="sm:col-span-2">
                <Entrada
                  value={form.contatoExtra}
                  onChange={(e) => set({ contatoExtra: e.target.value })}
                  placeholder="Fone para contato: (73) 98888-0000 — Cida"
                />
              </Campo>
            </div>

            {/* Passeios */}
            <div className="rounded-2xl bg-sky-50/60 p-4 ring-1 ring-sky-100">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-bold text-sky-800">
                  <Icon name="pin" className="size-4" /> Passeios contratados
                </p>
                <Botao variante="suave" icone="plus" onClick={addPasseio} className="px-2.5 py-1.5 text-xs">
                  Adicionar passeio
                </Botao>
              </div>

              <div className="space-y-3">
                {form.passeios.map((p, i) => (
                  <div key={p.id} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                    <div className="grid gap-2 sm:grid-cols-[2fr_1fr_0.9fr_1fr_0.9fr_auto]">
                      <Campo rotulo={i === 0 ? "Serviço" : undefined}>
                        <Entrada
                          list="lista-servicos"
                          value={p.nome}
                          onChange={(e) => escolherServico(i, e.target.value)}
                          placeholder="Praia do Espelho + Caraíva"
                        />
                      </Campo>
                      <Campo rotulo={i === 0 ? "Data IDA" : undefined}>
                        <Entrada
                          type="date"
                          value={p.data}
                          onChange={(e) => setPasseio(i, { data: e.target.value })}
                        />
                      </Campo>
                      <Campo rotulo={i === 0 ? "Hora IDA" : undefined}>
                        <Selecao
                          value={p.hora}
                          onChange={(e) => setPasseio(i, { hora: e.target.value })}
                        >
                          <option value="">—</option>
                          {HORARIOS.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </Selecao>
                      </Campo>
                      <Campo rotulo={i === 0 ? "Data VOLTA" : undefined}>
                        <Entrada
                          type="date"
                          value={p.dataVolta || ""}
                          onChange={(e) => setPasseio(i, { dataVolta: e.target.value || undefined })}
                        />
                      </Campo>
                      <Campo rotulo={i === 0 ? "Hora VOLTA" : undefined}>
                        <Selecao
                          value={p.horaVolta || ""}
                          onChange={(e) => setPasseio(i, { horaVolta: e.target.value || undefined })}
                        >
                          <option value="">—</option>
                          {HORARIOS.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </Selecao>
                      </Campo>
                      <div className={cn("flex items-end", i === 0 && "pb-0.5")}>
                        <BotaoIcone
                          icone="trash"
                          titulo="Remover passeio"
                          className="hover:bg-rose-50 hover:text-rose-600"
                          onClick={() => removePasseio(i)}
                        />
                      </div>
                    </div>
                    <Entrada
                      value={p.local}
                      onChange={(e) => setPasseio(i, { local: e.target.value })}
                      placeholder="Ponto de encontro (ex.: recepção do hotel)"
                      className="mt-2 text-xs"
                    />
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <AreaTexto rows={2} value={p.oQueLevar || ""} onChange={(e) => setPasseio(i, { oQueLevar: e.target.value })} placeholder="O que levar neste passeio..." className="text-xs" />
                      <AreaTexto rows={2} value={p.informacoesAdicionais || ""} onChange={(e) => setPasseio(i, { informacoesAdicionais: e.target.value })} placeholder="Informações adicionais deste passeio..." className="text-xs" />
                    </div>
                  </div>
                ))}
              </div>

              <datalist id="lista-servicos">
                {config.servicos.map((s) => (
                  <option key={s.id} value={s.nome} />
                ))}
              </datalist>
            </div>

            {/* Pagamento */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Valor total (R$)">
                <Entrada
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.total}
                  onChange={(e) => set({ total: Number(e.target.value) })}
                />
              </Campo>
              <Campo
                rotulo="Desconto"
                dica={
                  form.desconto && form.desconto > 0
                    ? `−${brl(totalComDesconto(form))}`
                    : undefined
                }
              >
                <div className="flex gap-2">
                  <Selecao
                    value={form.tipoDesconto}
                    onChange={(e) => set({ tipoDesconto: e.target.value as "percentual" | "fixo" })}
                    aria-label="Tipo do desconto"
                    className="w-[76px] shrink-0 text-center"
                  >
                    <option value="percentual">%</option>
                    <option value="fixo">R$</option>
                  </Selecao>
                  <Entrada
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.desconto}
                    onChange={(e) => set({ desconto: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
              </Campo>
              <Campo rotulo="Valor da entrada (R$)">
                <Entrada
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.entrada}
                  onChange={(e) => set({ entrada: Number(e.target.value) })}
                />
              </Campo>
              <Campo rotulo="A receber">
                <div className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm font-extrabold text-amber-700 ring-1 ring-amber-200">
                  {brl(aReceber(form))}
                </div>
              </Campo>
              <Campo rotulo="Forma de pagamento" className="sm:col-span-2">
                <Entrada
                  value={form.formaPagamento}
                  onChange={(e) => set({ formaPagamento: e.target.value })}
                  placeholder="PIX na entrada, restante no dia do passeio"
                />
              </Campo>
            </div>

            <Campo rotulo="Observações">
              <AreaTexto
                rows={2}
                value={form.observacoes}
                onChange={(e) => set({ observacoes: e.target.value })}
                placeholder="Ex.: criança de 8 anos, buscar 15 min antes..."
              />
            </Campo>

            <Aviso tom="info">
              Os dados de cada passeio (ponto de encontro, o que levar e informações adicionais) entram automaticamente no PDF. A
              mensagem enviada junto com o PDF no WhatsApp é editada em <b>Configurações</b>.
            </Aviso>
          </div>
        )}
      </Modal>

      {/* ---------------- Prévia ---------------- */}
      <Modal
        aberto={!!previa}
        aoFechar={() => setPrevia(null)}
        titulo="Prévia do envio"
        subtitulo="O PDF vai anexado e a mensagem vai junto — você escolhe o contato no WhatsApp"
        largura="max-w-lg"
        rodape={
          previa ? (
            <>
              <Botao variante="contorno" icone="download" onClick={() => baixar(previa)}>
                Baixar PDF
              </Botao>
              <Botao
                variante="sucesso"
                icone="send"
                carregando={enviando === previa.id}
                onClick={() => enviar(previa)}
              >
                Enviar no WhatsApp
              </Botao>
            </>
          ) : null
        }
      >
        {previa && (
          <div className="space-y-2 rounded-2xl bg-[#e5ddd5] p-4">
            {/* PDF anexado */}
            <div className="mr-auto w-fit max-w-full rounded-xl rounded-tl-sm bg-white p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-rose-600 text-[9px] font-black tracking-wide text-white">
                  PDF
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-slate-800">
                    {nomeArquivoPDF(previa)}
                  </p>
                  <p className="text-[10px] text-slate-400">documento anexado</p>
                </div>
              </div>
            </div>
            {/* Mensagem */}
            <div className="mr-auto w-fit max-w-full rounded-xl rounded-tl-sm bg-white p-4 shadow-sm">
              <pre className="font-sans text-[13px] leading-relaxed break-words whitespace-pre-wrap text-slate-800">
                {mensagemVoucher(previa, config)}
              </pre>
              <p className="mt-2 text-right text-[10px] text-slate-400">{dataBR(hoje())} ✓✓</p>
            </div>
            <p className="pt-1 text-center text-[11px] text-slate-500">
              A mensagem é definida em <b>Configurações → Mensagem do WhatsApp</b>
            </p>
          </div>
        )}
      </Modal>

      {/* ---------------- Exclusão ---------------- */}
      <Modal
        aberto={!!excluir}
        aoFechar={() => setExcluir(null)}
        titulo="Excluir voucher?"
        largura="max-w-md"
        rodape={
          <>
            <Botao variante="contorno" onClick={() => setExcluir(null)}>
              Manter
            </Botao>
            <Botao
              variante="perigo"
              icone="trash"
              onClick={() => {
                if (excluir) removerVoucher(excluir.id);
                setExcluir(null);
              }}
            >
              Excluir
            </Botao>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          O voucher <strong className="font-mono text-slate-900">{excluir?.codigo}</strong> de{" "}
          <strong className="text-slate-900">{excluir ? nomesClientes(excluir) : ""}</strong> será
          removido, junto com os passeios dele na agenda.
        </p>
      </Modal>
    </div>
  );
}
