import type { Config, Voucher } from "@/types";
import { addDays, gerarCodigo, iso, MENSAGEM_VOUCHER_PADRAO, uid } from "@/lib/utils";

const hj = new Date();
const d = (n: number) => iso(addDays(hj, n));

export const CONFIG_PADRAO: Config = {
  empresa: "Vem Pra Porto",
  cnpj: "",
  instagram: "@vempraporto.ps",
  telefone: "",
  mensagemVoucher: MENSAGEM_VOUCHER_PADRAO,
  politicaCancelamento:
    "Prezados(as),\n\nInformamos que cancelamentos realizados com até 18 horas de antecedência do horário do passeio estarão sujeitos à cobrança integral do valor do passeio.\n\nA exceção será apenas em casos de doença, mediante apresentação de atestado médico válido.\n\nAgradecemos pela compreensão e permanecemos à disposição.",
  servicos: [
    {
      id: "s1",
      nome: "Praia do Espelho + Caraíva",
      preco: 300,
      oQueLevar: "• Protetor solar, boné/chapéu\n• Roupa de banho + toalha\n• Câmera / celular carregado\n• Dinheiro / cartão para compras",
      pontoRetorno: "Retorno previsto no mesmo ponto de embarque (Hotel / Pousada). Horário aproximado de retorno: conforme roteiro.",
      informacoesAdicionais: "Em caso de atraso ou imprevisto, entre em contato com nossa central pelo WhatsApp da empresa. Obrigado por escolher a Vem Pra Porto!",
    },
    {
      id: "s2",
      nome: "Trancoso + Quadrado",
      preco: 180,
      oQueLevar: "• Protetor solar, boné/chapéu\n• Calçado confortável\n• Câmera / celular carregado\n• Dinheiro / cartão para compras",
      pontoRetorno: "Retorno previsto no mesmo ponto de embarque (Hotel / Pousada). Horário aproximado de retorno: conforme roteiro.",
      informacoesAdicionais: "Em caso de atraso ou imprevisto, entre em contato com nossa central pelo WhatsApp da empresa. Obrigado por escolher a Vem Pra Porto!",
    },
    {
      id: "s3",
      nome: "Arraial d'Ajuda",
      preco: 150,
      oQueLevar: "• Protetor solar, boné/chapéu\n• Roupa de banho + toalha\n• Dinheiro / cartão para compras",
      pontoRetorno: "Retorno previsto no mesmo ponto de embarque (Hotel / Pousada). Horário aproximado de retorno: conforme roteiro.",
      informacoesAdicionais: "Em caso de atraso ou imprevisto, entre em contato com nossa central pelo WhatsApp da empresa. Obrigado por escolher a Vem Pra Porto!",
    },
    {
      id: "s4",
      nome: "Recife de Fora",
      preco: 220,
      oQueLevar: "• Protetor solar, boné/chapéu\n• Roupa de banho + toalha\n• Máscara e snorkel (opcional)\n• Documento de identificação",
      pontoRetorno: "Retorno previsto no mesmo ponto de embarque (Cais do Porto).",
      informacoesAdicionais: "Passeio sujeito à tábua de marés. Em caso de atraso ou imprevisto, entre em contato com nossa central.",
    },
    {
      id: "s5",
      nome: "Passeio de Escuna",
      preco: 200,
      oQueLevar: "• Protetor solar, boné/chapéu\n• Roupa de banho + toalha\n• Óculos de sol",
      pontoRetorno: "Retorno previsto no mesmo píer de embarque.",
      informacoesAdicionais: "Em case de atraso ou imprevisto, entre em contato com nossa central pelo WhatsApp.",
    },
    {
      id: "s6",
      nome: "City Tour Porto Seguro",
      preco: 120,
      oQueLevar: "• Calçado confortável\n• Protetor solar\n• Câmera fotográfica",
      pontoRetorno: "Retorno previsto no mesmo hotel / pousada.",
      informacoesAdicionais: "Acompanhamento de guia turístico credenciado inclusos. Obrigado!",
    },
  ],


};

export function criarVouchersExemplo(): Voucher[] {
  return [
    {
      id: uid(),
      codigo: gerarCodigo(),
      clientes: ["Ronaldo Alves", "Cida Lima"],
      pessoas: 2,
      hotel: "Paraíso Mar Hotel (Arraial)",
      telefone: "(73) 99999-1111",
      contatoExtra: "Fone para contato: (73) 98888-2222",
      passeios: [
        {
          id: uid(),
          nome: "Praia do Espelho + Caraíva",
          data: d(0),
          hora: "07:30",
          dataVolta: d(0),
          horaVolta: "17:00",
          local: "Recepção do hotel",
        },
      ],
      total: 300,
      entrada: 100,
      formaPagamento: "PIX na entrada, restante no dia do passeio",
      observacoes: "",
      status: "concluido",
      criadoEm: d(-3),
    },
    {
      id: uid(),
      codigo: gerarCodigo(),
      clientes: ["Marcos Pereira", "Ana Paula Pereira", "Lucas Pereira"],
      pessoas: 3,
      hotel: "Pousada Vila do Sol (Trancoso)",
      telefone: "(11) 97777-3333",
      contatoExtra: "",
      passeios: [
        { id: uid(), nome: "Trancoso + Quadrado", data: d(2), hora: "08:00", local: "Portaria" },
        { id: uid(), nome: "Recife de Fora", data: d(4), hora: "09:00", local: "Cais do porto" },
      ],
      total: 720,
      entrada: 300,
      formaPagamento: "Cartão em 2x",
      observacoes: "Criança de 8 anos no grupo.",
      status: "concluido",
      criadoEm: d(-1),
    },
    {
      id: uid(),
      codigo: gerarCodigo(),
      clientes: ["Fernanda Costa"],
      pessoas: 1,
      hotel: "Hotel Porto Bello",
      telefone: "(21) 96666-4444",
      contatoExtra: "",
      passeios: [
        { id: uid(), nome: "Passeio de Escuna", data: d(6), hora: "10:00", local: "Píer 1" },
      ],
      total: 200,
      entrada: 0,
      formaPagamento: "Pagamento integral no dia",
      observacoes: "Aguardando confirmação do pagamento.",
      status: "pendente",
      criadoEm: d(0),
    },
    {
      id: uid(),
      codigo: gerarCodigo(),
      clientes: ["Roberto Dias", "Sandra Dias"],
      pessoas: 2,
      hotel: "Resort Costa Brasilis",
      telefone: "(31) 95555-7777",
      contatoExtra: "",
      passeios: [
        { id: uid(), nome: "Arraial d'Ajuda", data: d(-5), hora: "08:30", local: "Lobby" },
      ],
      total: 300,
      entrada: 300,
      formaPagamento: "Pago integralmente via PIX",
      observacoes: "",
      status: "concluido",
      criadoEm: d(-9),
    },
  ];
}
