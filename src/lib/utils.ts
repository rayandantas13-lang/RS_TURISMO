import type { Config, Passeio, StatusVoucher, Voucher } from "@/types";

export const uid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Date -> "yyyy-mm-dd" (local) */
export const iso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const hoje = () => iso(new Date());

export const parseISO = (s: string) => {
  const [y, m, d] = (s || hoje()).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const startOfWeek = (d: Date) => addDays(d, -d.getDay());

export const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const DIAS_LONGOS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
export const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** "2026-07-29" -> "29/07" */
export const dataCurta = (s: string) => {
  const d = parseISO(s);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

/** "2026-07-29" -> "29/07/2026" */
export const dataBR = (s: string) => {
  if (!s) return "";
  const d = parseISO(s);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export const dataLonga = (s: string) => {
  const d = parseISO(s);
  return `${DIAS_CURTOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
};

export const dataCompleta = (s: string) => {
  const d = parseISO(s);
  return `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
};

export const diasEntre = (a: string, b: string) =>
  Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);

export const rotuloRelativo = (s: string) => {
  const diff = diasEntre(hoje(), s);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  if (diff > 1 && diff < 7) return `em ${diff} dias`;
  if (diff < -1 && diff > -7) return `há ${Math.abs(diff)} dias`;
  return dataCurta(s);
};

export const brl = (n: number) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const mascaraTelefone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

/** Máscara de CNPJ: 00.000.000/0001-00 */
export const mascaraCnpj = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

/* ---------------- WhatsApp ---------------- */

/** Saudação conforme o horário do dia: 5h–11h "Bom dia", 12h–17h "Boa tarde", senão "Boa noite". */
export const saudacaoDoDia = (agora = new Date()) => {
  const h = agora.getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
};

/** Modelo padrão da mensagem que acompanha o PDF do voucher no WhatsApp. */
export const MENSAGEM_VOUCHER_PADRAO =
  "{saudacao}! 🌴 Segue o seu voucher com todos os detalhes do passeio. Qualquer dúvida estamos à disposição. 😊";

/**
 * Monta a mensagem curta que vai junto com o PDF no WhatsApp.
 * Atalhos aceitos no modelo: {saudacao}, {cliente}, {codigo} e {empresa}.
 */
export function mensagemVoucher(v: Voucher, config: Config) {
  const modelo = (config.mensagemVoucher || "").trim() || MENSAGEM_VOUCHER_PADRAO;
  const primeiro = (v.clientes || []).map((n) => n.trim()).filter(Boolean)[0] || "";
  return modelo
    .replace(/\{saudacao\}/g, saudacaoDoDia())
    .replace(/\{cliente\}/g, primeiro)
    .replace(/\{codigo\}/g, v.codigo || "")
    .replace(/\{empresa\}/g, config.empresa || "")
    .trim();
}

/**
 * Link oficial do WhatsApp SEM número: abre o app/web já com o texto,
 * para a pessoa escolher para qual contato enviar.
 */
export const linkAbrirWhatsApp = (texto = "") =>
  `https://wa.me/${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;

export const iniciais = (nome: string) =>
  (nome || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

const CORES = [
  "from-sky-500 to-amber-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-sky-500 to-blue-500",
  "from-fuchsia-500 to-purple-500",
];

export const corAvatar = (id: string) => {
  let h = 0;
  for (let i = 0; i < (id || "x").length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CORES[h % CORES.length];
};

/* ---------------- Voucher ---------------- */

export const STATUS_META: Record<
  StatusVoucher,
  { label: string; chip: string; dot: string }
> = {
  pendente: {
    label: "Pendente",
    chip: "bg-amber-50 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
  },
  concluido: {
    label: "Concluído",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  cancelado: {
    label: "Cancelado",
    chip: "bg-slate-100 text-slate-500 ring-slate-200",
    dot: "bg-slate-400",
  },
};

export const STATUS_LISTA: StatusVoucher[] = [
  "pendente",
  "concluido",
  "cancelado",
];

/** Status aceitos atualmente (o "confirmado" de versões antigas foi removido). */
const STATUS_VALIDOS = new Set<string>(STATUS_LISTA);

/**
 * Metadados visuais de um status SEM nunca derrubar a tela: se o valor vier
 * desconhecido (ex.: "confirmado" gravado na planilha por versões antigas),
 * mostra um selo neutro com o texto original em vez de lançar erro.
 */
export const statusMeta = (status: string) =>
  STATUS_META[status as StatusVoucher] ?? {
    label: status ? status.charAt(0).toUpperCase() + status.slice(1) : "Pendente",
    chip: "bg-slate-100 text-slate-600 ring-slate-200",
    dot: "bg-slate-400",
  };

/**
 * Normaliza o status vindo do banco: valores que não existem mais
 * (ex.: "confirmado") viram "pendente" para o app funcionar normalmente.
 */
export const normalizarStatus = (status: string): StatusVoucher =>
  STATUS_VALIDOS.has(status) ? (status as StatusVoucher) : "pendente";

/** Nomes dos clientes formatados: "A, B e C" */
export const nomesClientes = (v: Voucher) => {
  const l = (v.clientes || []).map((n) => n.trim()).filter(Boolean);
  if (!l.length) return "";
  if (l.length === 1) return l[0];
  return `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}`;
};

/** Serviços contratados: "Praia do Espelho + Caraíva" */
export const nomesPasseios = (v: Voucher) =>
  (v.passeios || [])
    .map((p) => p.nome.trim())
    .filter(Boolean)
    .join(" + ");

/** Datas dos passeios: "29/07/2026 e 30/07/2026" (considera ida + volta) */
export const datasPasseios = (v: Voucher) => {
  const datas = (v.passeios || [])
    .flatMap((p) => [p.data, p.dataVolta].filter((d): d is string => !!d));
  const l = [...new Set(datas)].sort();
  return l.map(dataBR).join(" e ");
};

/** Primeira data (usada para ordenação e agenda) – prioriza ida */
export const primeiraData = (v: Voucher) => {
  const datas = (v.passeios || [])
    .flatMap((p) => [p.data, p.dataVolta].filter((d): d is string => !!d))
    .sort();
  return datas[0] || "";
};

/** Valor do desconto em reais sobre o total. Aceita desconto em % ou valor fixo (R$). */
export const valorDesconto = (v: Voucher) => {
  const total = Number(v.total) || 0;
  const valor = Number(v.desconto) || 0;
  if (valor <= 0) return 0;
  if (v.tipoDesconto === "fixo") return Math.min(valor, total);
  // percentual
  return total * (valor / 100);
};

/** Total já com o desconto aplicado. */
export const totalComDesconto = (v: Voucher) =>
  Math.max(0, (Number(v.total) || 0) - valorDesconto(v));

export const aReceber = (v: Voucher) =>
  Math.max(0, totalComDesconto(v) - (Number(v.entrada) || 0));

export const totalPessoas = (v: Voucher) =>
  Number(v.pessoas) || (v.clientes || []).filter((n) => n.trim()).length || 1;

export const gerarCodigo = (prefixo = "VP") => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const numeros = new Uint32Array(5);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function")
    crypto.getRandomValues(numeros);
  else for (let i = 0; i < numeros.length; i++) numeros[i] = Math.floor(Math.random() * 2 ** 32);
  const codigo = [...numeros].map((n) => chars[n % chars.length]).join("");
  return `${prefixo}-${codigo}`;
};

export const passeioVazio = (data = hoje()): Passeio => ({
  id: uid(),
  nome: "",
  data,
  hora: "",
  dataVolta: "",
  horaVolta: "",
  local: "",
});

export const normalizar = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");



export const gerarHorarios = (inicio = "05:00", fim = "22:00") => {
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };
  const out: string[] = [];
  for (let t = toMin(inicio); t <= toMin(fim); t += 30)
    out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  return out;
};
