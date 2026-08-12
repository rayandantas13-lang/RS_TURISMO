import { useMemo, useState } from "react";
import { useStore } from "@/store";
import { Icon } from "@/components/Icon";
import { brl, hoje, totalComDesconto, uid } from "@/lib/utils";

const PERIODOS = [
  { id: "diario", label: "Diário", dias: 1 }, { id: "semanal", label: "Semanal", dias: 7 },
  { id: "mensal", label: "Mensal", dias: 31 }, { id: "trimestral", label: "Trimestral", dias: 92 },
  { id: "anual", label: "Anual", dias: 366 },
] as const;
const CATEGORIAS = ["Combustível", "Manutenção", "Veículos", "Alimentação", "Marketing", "Administrativo", "Outros"];
const campo = "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-3 focus:ring-orange-100";

const codigoVoucher = (codigo: string) => {
  const limpo = codigo.trim().toUpperCase();
  if (limpo.includes("-")) return limpo;
  return limpo.startsWith("RS") ? `RS-${limpo.slice(2)}` : `RS-${limpo}`;
};

export default function Financeiro() {
  const { vouchers, gastos, salvarGasto, removerGasto } = useStore();
  const [periodo, setPeriodo] = useState<typeof PERIODOS[number]["id"]>("mensal");
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({ descricao: "", categoria: "Combustível", valor: "", data: hoje(), observacao: "", voucherId: "" });
  const inicio = useMemo(() => {
    const dias = PERIODOS.find((p) => p.id === periodo)!.dias;
    const d = new Date(`${hoje()}T12:00:00`); d.setDate(d.getDate() - dias + 1);
    return d.toISOString().slice(0, 10);
  }, [periodo]);
  const dados = useMemo(() => {
    const gastosPeriodo = gastos.filter(g => g.data >= inicio && g.data <= hoje());
    const faturamento = vouchers.filter(v => v.status !== "cancelado" && (v.passeios || []).some(p => p.data >= inicio && p.data <= hoje())).reduce((s, v) => s + totalComDesconto(v), 0);
    const despesas = gastosPeriodo.reduce((s, g) => s + g.valor, 0);
    const porCategoria = CATEGORIAS.map(c => ({ categoria: c, valor: gastosPeriodo.filter(g => g.categoria === c).reduce((s, g) => s + g.valor, 0) })).filter(x => x.valor > 0).sort((a,b) => b.valor-a.valor);
    return { gastosPeriodo, faturamento, despesas, resultado: faturamento-despesas, porCategoria };
  }, [gastos, vouchers, inicio]);
  const salvar = async (e: React.FormEvent) => { e.preventDefault(); const valor = Number(form.valor.replace(",", ".")); if (!form.descricao.trim() || !valor || valor <= 0) return; await salvarGasto({ id: uid(), descricao: form.descricao.trim(), categoria: form.categoria, valor, data: form.data, observacao: form.observacao.trim(), voucherId: form.voucherId, criadoEm: new Date().toISOString() }); setForm({ descricao: "", categoria: "Combustível", valor: "", data: hoje(), observacao: "", voucherId: "" }); setAberto(false); };
  const max = Math.max(...dados.porCategoria.map(x => x.valor), 1);
  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-3xl bg-[#0A0A0A] p-6 text-white shadow-xl border border-zinc-800 sm:p-8">
      <div className="absolute -right-8 -top-10 size-48 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="absolute -left-12 -bottom-10 size-56 rounded-full bg-white/5 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-5"><div><p className="flex items-center gap-2 text-xs font-bold tracking-[.18em] text-orange-400 uppercase"><span className="size-1.5 rounded-full bg-orange-500"/> Saúde do negócio · RS TURISMO</p><h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">Seu resultado real, sem achismos.</h2><p className="mt-2 text-sm text-zinc-400">Faturamento menos custos operacionais no período escolhido.</p></div><button onClick={() => setAberto(!aberto)} className="inline-flex items-center gap-2 rounded-xl bg-[#FF6B00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#E55A00] shadow-lg shadow-orange-600/20"><Icon name="plus" className="size-4"/> Registrar gasto</button></div>
    </section>
    {aberto && <form onSubmit={salvar} className="anim-up rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-orange-50 text-orange-600"><Icon name="money" className="size-4"/></span> Novo gasto operacional</h3><p className="text-xs text-zinc-500">Registre tudo que impacta o resultado da RS TURISMO.</p></div><button type="button" onClick={()=>setAberto(false)} className="text-zinc-400 hover:text-zinc-600"><Icon name="close"/></button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><input required value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} className={campo} placeholder="Ex.: Abastecimento van"/><select value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})} className={campo}>{CATEGORIAS.map(c=><option key={c}>{c}</option>)}</select><select value={form.voucherId} onChange={e=>setForm({...form,voucherId:e.target.value})} className={campo}><option value="">Gasto do voucher (opcional)</option>{vouchers.map(v=><option key={v.id} value={v.id}>{codigoVoucher(v.codigo)}</option>)}</select>
<input required min="0.01" step="0.01" inputMode="decimal" value={form.valor} onChange={e=>setForm({...form,valor:e.target.value})} className={campo} placeholder="Valor (R$)"/><input type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})} className={campo}/><button className="rounded-xl bg-[#FF6B00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#E55A00]">Salvar gasto</button></div><input value={form.observacao} onChange={e=>setForm({...form,observacao:e.target.value})} className={campo+" mt-3"} placeholder="Observação (opcional)"/></form>}
    <div className="flex flex-wrap gap-2">{PERIODOS.map(p=><button key={p.id} onClick={()=>setPeriodo(p.id)} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${periodo===p.id ? "bg-[#0A0A0A] text-white shadow-sm ring-1 ring-zinc-800" : "bg-white text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-50"}`}>{p.label}</button>)}</div>
    <div className="grid gap-4 sm:grid-cols-3"><Resumo titulo="Faturamento" valor={dados.faturamento} icon="trend" cor="emerald"/><Resumo titulo="Gastos operacionais" valor={dados.despesas} icon="money" cor="rose"/><Resumo titulo="Resultado real" valor={dados.resultado} icon="sparkles" cor={dados.resultado >= 0 ? "orange" : "rose"}/></div>
    <div className="grid gap-6 xl:grid-cols-5"><section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 xl:col-span-2"><h3 className="font-bold text-zinc-900">Para onde foi o dinheiro?</h3><p className="mb-5 text-xs text-zinc-500">Gastos por categoria</p>{dados.porCategoria.length ? <div className="space-y-4">{dados.porCategoria.map(x=><div key={x.categoria}><div className="mb-1.5 flex justify-between text-sm"><span className="font-medium text-zinc-600">{x.categoria}</span><b>{brl(x.valor)}</b></div><div className="h-2 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-600" style={{width:`${x.valor/max*100}%`}}/></div></div>)}</div> : <p className="py-10 text-center text-sm text-zinc-400">Nenhum gasto neste período.</p>}</section><section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 xl:col-span-3"><div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4"><div><h3 className="font-bold">Lançamentos recentes</h3><p className="text-xs text-zinc-500">{dados.gastosPeriodo.length} registro(s) no período</p></div><span className="grid size-8 place-items-center rounded-lg bg-orange-50 text-orange-600"><Icon name="money"/></span></div>{dados.gastosPeriodo.length ? <div className="divide-y divide-zinc-100">{dados.gastosPeriodo.sort((a,b)=>b.data.localeCompare(a.data)).map(g=><div key={g.id} className="flex items-center gap-3 px-5 py-3.5"><div className="grid size-10 place-items-center rounded-xl bg-zinc-900 text-white"><Icon name={g.categoria === "Combustível" ? "truck" : "money"} className="size-4"/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{g.descricao}</p><p className="text-xs text-zinc-500">{g.categoria} · {new Date(g.data+"T12:00:00").toLocaleDateString("pt-BR")}</p></div><b className="text-sm text-rose-600">− {brl(g.valor)}</b><button onClick={()=>removerGasto(g.id)} title="Excluir" className="p-1 text-zinc-300 hover:text-rose-600"><Icon name="trash" className="size-4"/></button></div>)}</div> : <p className="py-14 text-center text-sm text-zinc-400">Comece registrando um gasto para acompanhar sua margem.</p>}</section></div>
  </div>;
}
function Resumo({titulo, valor, icon, cor}:{titulo:string;valor:number;icon:any;cor:string}) { const cls=cor==="emerald"?"bg-emerald-50 text-emerald-600":cor==="rose"?"bg-rose-50 text-rose-600":cor==="orange"?"bg-orange-50 text-orange-600 ring-1 ring-orange-100":"bg-zinc-900 text-white"; return <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200"><div className={`grid size-10 place-items-center rounded-xl ${cls}`}><Icon name={icon} className="size-5"/></div><p className="mt-4 text-xs font-bold tracking-wide text-zinc-500 uppercase">{titulo}</p><p className={`mt-1 text-2xl font-extrabold ${titulo==="Resultado real" && valor<0 ? "text-rose-600":"text-zinc-900"}`}>{brl(valor)}</p></div> }
