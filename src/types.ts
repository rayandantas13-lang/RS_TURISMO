export type ID = string;

/* ---------------- Autenticação ---------------- */
export type Papel = "admin" | "operador";

export interface Usuario {
  id: ID;
  nome: string;
  email: string;
  usuario: string;
  papel: Papel;
  ativo: boolean;
  criadoEm: string;
  ultimoAcesso?: string;
}

export interface Sessao {
  token: string;
  usuario: Usuario;
  expiraEm: string;
}

/* ---------------- Voucher ---------------- */

/** Um passeio dentro do voucher (serviço + dia + hora).
 * Suporta ida + volta (data/hora separadas). */
export interface Passeio {
  id: ID;
  nome: string;
  /** Data e hora de IDA (mantido para compatibilidade) */
  data: string;
  hora: string;
  /** Data e hora de VOLTA (novo) */
  dataVolta?: string;
  horaVolta?: string;
  /** Ponto de encontro / observação do passeio */
  local: string;
  /** Informações específicas deste passeio, exibidas no PDF */
  oQueLevar?: string;
  informacoesAdicionais?: string;
}

export type StatusVoucher = "pendente" | "concluido" | "cancelado";

export interface Voucher {
  id: ID;
  codigo: string;
  /** Nomes das pessoas incluídas no serviço */
  clientes: string[];
  pessoas: number;
  hotel: string;
  /** WhatsApp principal, usado para enviar o voucher */
  telefone: string;
  /** Texto livre com outros contatos ("Fone para contato: ...") */
  contatoExtra: string;
  passeios: Passeio[];
  total: number;
  /** Tipo do desconto aplicado sobre o total: percentual (%) ou valor fixo (R$). */
  tipoDesconto?: "percentual" | "fixo";
  /** Valor do desconto — em % (percentual) ou em R$ (fixo). 0/ausente = sem desconto. */
  desconto?: number;
  entrada: number;
  formaPagamento: string;
  observacoes: string;
  status: StatusVoucher;
  criadoEm: string;
}

export interface Servico {
  id: ID;
  nome: string;
  preco: number;
  oQueLevar?: string;
  pontoRetorno?: string;
  informacoesAdicionais?: string;
}

export interface Config {
  empresa: string;
  cnpj: string;
  instagram: string;
  telefone: string;
  /** Mensagem enviada junto com o PDF do voucher no WhatsApp. Atalhos: {saudacao}, {cliente}, {codigo}, {empresa} */
  mensagemVoucher: string;
  politicaCancelamento: string;
  servicos: Servico[];

}

export interface GastoOperacional {
  id: ID;
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  observacao?: string;
  voucherId?: ID;
  criadoEm: string;
}

export interface DadosApi {
  vouchers: Voucher[];
  gastos?: GastoOperacional[];
  config: Config;
  /** Versão do Code.gs publicado. Ausente em implantações antigas. */
  versao?: string;
}
