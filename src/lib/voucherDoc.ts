import { jsPDF } from "jspdf";
import { logoDataUrl } from "@/assets/logoData";
import type { Config, StatusVoucher, Voucher } from "@/types";
import {
  aReceber,
  brl,
  dataBR,
  datasPasseios,
  linkAbrirWhatsApp,
  mascaraCnpj,
  mascaraTelefone,
  mensagemVoucher,
  nomesClientes,
  nomesPasseios,
  STATUS_META,
  totalComDesconto,
  totalPessoas,
  valorDesconto,
} from "@/lib/utils";

/* ============================================================
   CORES
   ============================================================ */
const CORES = {
  primaria: [3, 105, 161] as [number, number, number],      // azul oceano #0369A1
  secundaria: [217, 119, 6] as [number, number, number],    // dourado #D97706
  escuro: [15, 23, 42] as [number, number, number],
  cinza: [100, 116, 139] as [number, number, number],
  cinzaClaro: [148, 163, 184] as [number, number, number],
  fundo: [241, 245, 249] as [number, number, number],
  branco: [255, 255, 255] as [number, number, number],
  sucesso: [34, 197, 94] as [number, number, number],
  destaque: [251, 191, 36] as [number, number, number],     // dourado claro #FBBF24
};

/** Cor do selo de status no PDF (combinando com as cores do app). */
const CORES_STATUS: Record<StatusVoucher, [number, number, number]> = {
  pendente: [245, 158, 11], // âmbar
  concluido: [16, 185, 129], // esmeralda
  cancelado: [148, 163, 184], // cinza
};

/* ============================================================
   UTILITÁRIOS PDF
   ============================================================ */
class PDFVoucherBuilder {
  private doc: jsPDF;
  private readonly L = 210; // Largura A4
  private readonly M = 12; // Margem
  private readonly W: number;
  private y = 0;
  private readonly escala: number;
  private readonly MARGEM_FIM: number;
  private readonly MARGEM_INICIO: number;
  private readonly Y_RODAPE_LINHA: number;
  private readonly Y_RODAPE_TEXTO: number;

  constructor(compacto = false) {
    this.doc = new jsPDF({ unit: "mm", format: "a4" });
    this.W = this.L - this.M * 2;
    this.y = 0;

    // Modo compacto: reconstrói tudo a 90% do tamanho para caber em 1 página.
    // A escala é aplicada via matriz de transformação da página (cm), então
    // todas as coordenadas "de usuário" são divididas pela escala.
    this.escala = compacto ? 0.9 : 1;
    if (compacto) this.aplicarEscala();

    this.MARGEM_FIM = 287 / this.escala;
    this.MARGEM_INICIO = 18 / this.escala;
    this.Y_RODAPE_LINHA = 287 / this.escala;
    this.Y_RODAPE_TEXTO = 291.5 / this.escala;
  }

  /** Aplica escala uniforme ~90%: centraliza na horizontal e ancora no topo. */
  private aplicarEscala() {
    const s = this.escala;
    const k = 72 / 25.4; // pontos por mm
    const tx = 105 * (1 - s) * k;
    const ty = 297 * (1 - s) * k;
    this.doc.setCurrentTransformationMatrix(this.doc.Matrix(s, 0, 0, s, tx, ty));
  }

  private checkPageBreak(h: number) {
    if (this.y + h > this.MARGEM_FIM) {
      this.doc.addPage();
      if (this.escala !== 1) this.aplicarEscala(); // reescala a nova página
      this.y = this.MARGEM_INICIO;
      return true;
    }
    return false;
  }

  // Helper para texto
  private texto(
    texto: string,
    x: number,
    y: number,
    tamanho: number,
    estilo: "normal" | "bold" = "normal",
    cor: [number, number, number] = CORES.escuro,
    alinhamento: "left" | "center" | "right" = "left"
  ) {
    this.doc.setFont("helvetica", estilo);
    this.doc.setFontSize(tamanho);
    this.doc.setTextColor(...cor);
    this.doc.text(texto, x, y, { align: alinhamento });
  }

  // Helper para box com borda
  private box(
    x: number,
    y: number,
    w: number,
    h: number,
    cor: [number, number, number],
    borda = false,
    raio = 0
  ) {
    if (borda) {
      this.doc.setDrawColor(...cor);
      this.doc.roundedRect(x, y, w, h, raio, raio, "S");
    } else {
      this.doc.setFillColor(...cor);
      this.doc.roundedRect(x, y, w, h, raio, raio, "F");
    }
  }

  // Helper para linha horizontal
  private linha(x: number, y: number, w: number, cor: [number, number, number] = CORES.cinzaClaro) {
    this.doc.setDrawColor(...cor);
    this.doc.line(x, y, x + w, y);
  }

  /* ============================================================
     MÉTODOS DE CONSTRUÇÃO
     ============================================================ */

  // 1. CABEÇALHO
  private construirCabecalho(config: Config, voucher: Voucher) {
    const ALT_BANNER = 40;

    // Fundo azul oceano
    this.doc.setFillColor(...CORES.primaria);
    this.doc.rect(0, 0, this.L, ALT_BANNER, "F");

    // Detalhe triangular dourado
    this.doc.setFillColor(...CORES.secundaria);
    this.doc.triangle(this.L - 55, 0, this.L, 0, this.L, ALT_BANNER, "F");

    // Marca oficial (PNG leve e quadrado) embutida no bundle para offline.
    // Mantém proporção 1:1 para não espremer o círculo da logo.
    this.doc.addImage(logoDataUrl, "PNG", this.M - 1, 5, 30, 30, undefined, "FAST");


    // Nome da empresa
    this.texto(config.empresa, this.M + 34, 15, 18, "bold", CORES.branco);

    // Dados de contato/identificação da empresa abaixo do nome: Instagram
    // (dourado) e, se preenchidos nas Configurações, CNPJ e telefone (azul
    // claro). Números sem pontuação são formatados para exibição.
    const digitosCnpj = (config.cnpj || "").replace(/\D/g, "");
    const cnpj = digitosCnpj.length === 14 ? mascaraCnpj(digitosCnpj) : (config.cnpj || "").trim();
    const digitosTel = (config.telefone || "").replace(/\D/g, "");
    const tel =
      digitosTel.length >= 10 && digitosTel.length <= 11
        ? mascaraTelefone(digitosTel)
        : (config.telefone || "").trim();
    const contatos = [
      (config.instagram || "").trim(),
      cnpj ? `CNPJ: ${cnpj}` : "",
      tel ? `Tel: ${tel}` : "",
    ].filter(Boolean);

    contatos.slice(0, 3).forEach((linha, i) => {
      this.texto(
        linha,
        this.M + 34,
        24 + i * 7,
        9,
        "normal",
        i === 0 && (config.instagram || "").trim() ? [253, 230, 138] : [224, 242, 254]
      );
    });

    // Voucher à direita
    this.texto("VOUCHER", this.L - this.M, 9.5, 8, "bold", [253, 230, 138], "right");
    this.texto(voucher.codigo, this.L - this.M, 17.5, 16, "bold", CORES.branco, "right");
    this.texto(
      `Emitido em ${dataBR(voucher.criadoEm.slice(0, 10))}`,
      this.L - this.M,
      23.5,
      7.5,
      "normal",
      [253, 230, 138],
      "right"
    );

    this.y = ALT_BANNER + 7;
  }

  // 2. TÍTULO DO PASSEIO
  private construirTituloPasseio(voucher: Voucher) {
    this.checkPageBreak(26);

    // Nome do passeio (quebra em até 2 linhas)
    const nome = nomesPasseios(voucher) || "—";
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(13);
    const lines = (this.doc.splitTextToSize(nome, this.W - 10) as string[]).slice(0, 2);
    const altBox = 10 + lines.length * 7;

    // Box de fundo
    this.box(this.M, this.y, this.W, altBox, CORES.fundo, false, 2);

    // Rótulo
    this.texto("SERVIÇO CONTRATADO", this.M + 4, this.y + 6, 8, "bold", CORES.cinza);

    lines.forEach((t, i) => {
      this.texto(t, this.M + 4, this.y + 13 + i * 7, 13, "bold", CORES.primaria);
    });

    this.y += altBox + 4;
    this.linha(this.M, this.y, this.W, [226, 232, 240]);
    this.y += 4;
  }

  // 3. DADOS DA RESERVA (2 colunas)
  private construirDadosReserva(voucher: Voucher) {
    const pessoas = totalPessoas(voucher);
    const colWidth = (this.W - 6) / 2;

    const desenhaCampo = (rot: string, val: string, x: number, yy: number, larg: number) => {
      this.texto(rot.toUpperCase(), x, yy, 7, "bold", CORES.cinza);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(10.5);
      const lines = this.doc.splitTextToSize(val, larg - 2) as string[];
      this.texto(lines[0] || "—", x, yy + 6, 10.5, "bold", CORES.escuro);
      let extra = 0;
      lines.slice(1, 3).forEach((t, i) => {
        this.texto(t, x, yy + 11 + i * 5, 10.5, "bold", CORES.escuro);
        extra += 5;
      });
      return 9.5 + extra;
    };

    // Linha 1: Cliente (coluna inteira)
    this.checkPageBreak(20);
    const altCliente = desenhaCampo("Cliente", `${nomesClientes(voucher)}  (${pessoas} pessoa${pessoas > 1 ? "s" : ""})`, this.M, this.y, this.W);
    this.y += altCliente + 1;
    this.linha(this.M, this.y - 1, this.W, [226, 232, 240]);
    this.y += 3;

    // Linha 2: Hotel + Telefone lado a lado
    this.checkPageBreak(15);
    const altH = desenhaCampo("Hotel", voucher.hotel || "—", this.M, this.y, colWidth);
    const altT = desenhaCampo("Telefone", [voucher.telefone, voucher.contatoExtra].filter(Boolean).join(" · ") || "—", this.M + colWidth + 6, this.y, colWidth);
    this.y += Math.max(altH, altT) + 1;
    this.linha(this.M, this.y - 1, this.W, [226, 232, 240]);
    this.y += 3;

    // Linha 3: Data dos passeios
    this.checkPageBreak(13);
    const altD = desenhaCampo("Data dos passeios", datasPasseios(voucher) || "—", this.M, this.y, this.W);
    this.y += altD + 2;
  }

  // 4. ROTEIRO
  private construirRoteiro(voucher: Voucher) {
    const passeios = (voucher.passeios || []).filter(p => p.nome || p.data);
    if (!passeios.length) return;

    this.checkPageBreak(14);
    this.texto("ROTEIRO", this.M, this.y, 8, "bold", CORES.cinza);
    this.y += 5.5;

    passeios.forEach((p) => {
      this.checkPageBreak(7);
      // Marcador
      this.doc.setFillColor(...CORES.primaria);
      this.doc.circle(this.M + 1.2, this.y - 1.2, 1.1, "F");

      let txt = `${p.nome || "Passeio"} — ${dataBR(p.data)}`;
      if (p.hora) txt += ` às ${p.hora} (ida)`;

      if (p.dataVolta && p.dataVolta !== p.data) {
        txt += ` | Volta ${dataBR(p.dataVolta)}`;
        if (p.horaVolta) txt += ` às ${p.horaVolta}`;
      } else if (p.horaVolta) {
        txt += ` | Volta às ${p.horaVolta}`;
      }

      // Ponto de encontro NÃO entra no roteiro — já aparece em Informações
      // (evita duplicar o texto depois da data/hora).

      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(10);
      const lines = this.doc.splitTextToSize(txt, this.W - 8) as string[];
      this.texto(lines[0] || txt, this.M + 5, this.y, 10, "normal");
      this.y += 5.5;
    });

    this.y += 2.5;
  }

  // Selo colorido com o status do voucher (pago/pendente/cancelado...)
  private seloStatus(voucher: Voucher, yTopo: number) {
    const status = voucher.status;
    const rotulo = (STATUS_META[status]?.label ?? String(status)).toUpperCase();
    const cor = CORES_STATUS[status] ?? CORES.cinza;

    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(7.5);
    const larg = Math.max(this.doc.getTextWidth(rotulo) + 8, 24);
    const alt = 6.6;
    const x = this.L - this.M - larg;

    this.box(x, yTopo, larg, alt, cor, false, alt / 2);
    this.texto(rotulo, x + larg / 2, yTopo + 4.7, 7.5, "bold", CORES.branco, "center");
  }

  // 5. PAGAMENTO (com status do voucher)
  private construirPagamento(voucher: Voucher) {
    const total = Number(voucher.total) || 0;
    const entrada = Number(voucher.entrada) || 0;
    const desconto = valorDesconto(voucher);
    const comDesconto = totalComDesconto(voucher);
    const aReceberValor = aReceber(voucher);
    const temDesconto = desconto > 0;

    const boxH = temDesconto ? 29 : 22;
    this.checkPageBreak(boxH + 24);

    // Cabeçalho da seção + selo de status
    this.texto("PAGAMENTO", this.M, this.y + 4.7, 8, "bold", CORES.cinza);
    this.seloStatus(voucher, this.y);
    this.y += 8.5;

    // Box principal
    this.box(this.M, this.y, this.W, boxH, CORES.escuro, false, 2);

    const colWidth = this.W / 3;
    const cx = (i: number) => this.M + i * colWidth + colWidth / 2;

    // Ordem das colunas: VALOR TOTAL · ENTRADA PAGA · A RECEBER

    // VALOR TOTAL (esquerda)
    this.texto("VALOR TOTAL", cx(0), this.y + 7, 7, "normal", CORES.cinzaClaro, "center");
    if (temDesconto) {
      const original = brl(total);
      // Mede a largura DEPOIS de setar a fonte do texto (9pt bold) — se medir
      // antes, pega a fonte anterior e o risco sai maior que o texto e
      // descentralizado.
      this.texto(original, cx(0), this.y + 14.5, 9, "bold", CORES.cinzaClaro, "center");
      const tw = this.doc.getTextWidth(original);
      // Risco no meio dos dígitos: baseline (y+14.5) − ~1,1mm (33% do corpo de
      // 9pt ≈ 1,05mm). Coordenadas estão em mm; fonte em pt (9pt ≈ 3,2mm).
      this.linha(cx(0) - tw / 2, this.y + 13.4, tw, CORES.destaque);
      this.texto(brl(comDesconto), cx(0), this.y + 22, 14, "bold", CORES.destaque, "center");
    } else {
      this.texto(brl(total), cx(0), this.y + 16.5, 12, "bold", CORES.branco, "center");
    }

    // ENTRADA PAGA (meio)
    this.texto("ENTRADA PAGA", cx(1), this.y + 7, 7, "normal", CORES.cinzaClaro, "center");
    this.texto(brl(entrada), cx(1), this.y + (temDesconto ? 19 : 16.5), 12, "bold", CORES.branco, "center");

    // A RECEBER (direita)
    this.texto("A RECEBER", cx(2), this.y + 7, 7, "normal", CORES.cinzaClaro, "center");
    this.texto(
      brl(aReceberValor),
      cx(2),
      this.y + (temDesconto ? 19 : 16.5),
      temDesconto ? 14 : 15,
      "bold",
      CORES.destaque,
      "center"
    );

    this.y += boxH + 6;

    // Forma de pagamento
    if (voucher.formaPagamento) {
      this.texto(
        `Forma de pagamento: ${voucher.formaPagamento}`,
        this.M,
        this.y,
        8.5,
        "normal",
        CORES.cinza
      );
      this.y += 7;
    }
  }

  // 6. INSTRUÇÕES E INFORMAÇÕES (grade 2 colunas + observações)
  private construirInstrucoes(voucher: Voucher) {
    const colGap = 4;
    const halfCol = (this.W - colGap) / 2;
    const addSection = (titulo: string, conteudo: string | undefined, x: number, larg: number): number => {
      if (!conteudo?.trim()) return 0;
      const lines = (this.doc.splitTextToSize(conteudo.trim(), larg - 4) as string[]).slice(0, 5);
      this.texto(titulo, x, this.y, 7.5, "bold", CORES.cinza);
      lines.forEach((t, i) => this.texto(t, x + 1, this.y + 5 + i * 4, 8.2, "normal", CORES.escuro));
      return 7 + lines.length * 4;
    };
    (voucher.passeios || []).forEach((p) => {
      if (!p.local && !p.oQueLevar && !p.informacoesAdicionais) return;
      this.checkPageBreak(15);
      this.texto(`INFORMAÇÕES — ${p.nome || "PASSEIO"}`, this.M, this.y, 8, "bold", CORES.primaria);
      this.y += 5;
      const yIni = this.y;
      const a = addSection("O QUE LEVAR", p.oQueLevar, this.M, halfCol);
      const b = addSection("PONTO DE ENCONTRO", p.local, this.M + halfCol + colGap, halfCol);
      this.y = yIni + Math.max(a, b) + 1;
      const extra = addSection("INFORMAÇÕES ADICIONAIS", p.informacoesAdicionais, this.M, this.W);
      if (extra) this.y += extra + 1;
    });
    if (voucher.observacoes?.trim()) {
      this.checkPageBreak(14);
      const h = addSection("OBSERVAÇÕES", voucher.observacoes, this.M, this.W);
      this.y += h + 1;
    }
  }

  // 7. POLÍTICA DE CANCELAMENTO (caixa única; compacta se preciso p/ 1 página)
  private construirPoliticaCancelamento(config: Config) {
    if (!config.politicaCancelamento?.trim()) return;

    const texto = config.politicaCancelamento.trim();
    const lines = this.doc.splitTextToSize(texto, this.W - 10) as string[];
    const topoBox = 7.5;
    const padFim = 2;

    // Espaçamento padrão; se não couber na página, compacta as linhas
    let alturaLinha = 4;
    let fonteCorpo = 7.8;
    let altura = topoBox + lines.length * alturaLinha + padFim;
    if (this.y + altura + 3 > this.MARGEM_FIM) {
      const disponivel = this.MARGEM_FIM - this.y - 3;
      alturaLinha = Math.max((disponivel - topoBox - padFim) / lines.length, 3.4);
      fonteCorpo = Math.max(fonteCorpo * (alturaLinha / 4), 6.8);
      altura = topoBox + lines.length * alturaLinha + padFim;
    }

    this.checkPageBreak(altura + 4);

    // Fundo
    this.doc.setFillColor(254, 242, 242);
    this.doc.roundedRect(this.M, this.y, this.W, altura, 2, 2, "F");

    // Barra lateral
    this.doc.setFillColor(239, 68, 68);
    this.doc.roundedRect(this.M, this.y, 1.2, altura, 1, 1, "F");

    // Título
    this.texto(
      "POLÍTICA DE CANCELAMENTO",
      this.M + 5,
      this.y + 5,
      8,
      "bold",
      [185, 28, 28]
    );

    // Conteúdo
    lines.forEach((t, j) => {
      this.texto(t, this.M + 5, this.y + topoBox + 1.2 + j * alturaLinha, fonteCorpo, "normal", [127, 29, 29]);
    });

    this.y += altura + 3;
  }

  // 8. RODAPÉ
  private construirRodape(voucher: Voucher, config: Config) {
    const paginas = this.doc.getNumberOfPages();
    for (let p = 1; p <= paginas; p++) {
      this.doc.setPage(p);
      this.linha(this.M, this.Y_RODAPE_LINHA, this.W, [200, 200, 200]);

      this.texto(
        `${config.empresa} · Voucher ${voucher.codigo}`,
        this.M,
        this.Y_RODAPE_TEXTO,
        7.5,
        "normal",
        CORES.cinza
      );
      this.texto(
        `Página ${p} de ${paginas}`,
        this.L - this.M,
        this.Y_RODAPE_TEXTO,
        7.5,
        "normal",
        CORES.cinza,
        "right"
      );
    }
  }

  /* ============================================================
     CONSTRUIR PDF COMPLETO
     ============================================================ */
  construir(voucher: Voucher, config: Config): jsPDF {
    // 1. Cabeçalho
    this.construirCabecalho(config, voucher);

    // 2. Título do Passeio
    this.construirTituloPasseio(voucher);

    // 3. Dados da Reserva
    this.construirDadosReserva(voucher);

    // 4. Roteiro
    this.construirRoteiro(voucher);

    // 5. Pagamento (com selo de status)
    this.construirPagamento(voucher);

    // 6. Instruções e Informações (inclui observações)
    this.construirInstrucoes(voucher);

    // 7. Política de Cancelamento
    this.construirPoliticaCancelamento(config);

    // 8. Rodapé
    this.construirRodape(voucher, config);

    return this.doc;
  }
}

/* ============================================================
   FUNÇÕES EXPORTADAS
   ============================================================ */

/**
 * Recria o voucher completando, em cada passeio, os campos "o que levar",
 * "ponto de encontro" e "informações adicionais" que estiverem vazios,
 * usando o serviço de mesmo nome no catálogo (config.servicos).
 *
 * Esses três campos são exatamente os que o formulário "puxa" ao escolher o
 * serviço. Quando o voucher volta do Google Sheets sem eles (implantação do
 * Apps Script antiga, ou voucher salvo antes da última atualização), o nome do
 * passeio continua intacto — então recuperamos o texto a partir do catálogo,
 * que é a mesma origem do formulário, e o PDF sai completo.
 *
 * Campos já preenchidos (incluindo edições manuais) nunca são sobrescritos.
 */
function enriquecerPasseios(v: Voucher, config: Config): Voucher {
  const catalogo = new Map(
    (config.servicos ?? [])
      .map((s) => [(s.nome || "").trim(), s] as const)
      .filter(([nome]) => !!nome),
  );

  const passeios = (v.passeios ?? []).map((p) => {
    const s = catalogo.get((p.nome || "").trim());
    if (!s) return p;
    return {
      ...p,
      oQueLevar: p.oQueLevar?.trim() ? p.oQueLevar : (s.oQueLevar ?? p.oQueLevar),
      local: p.local?.trim() ? p.local : (s.pontoRetorno ?? p.local),
      informacoesAdicionais: p.informacoesAdicionais?.trim()
        ? p.informacoesAdicionais
        : (s.informacoesAdicionais ?? p.informacoesAdicionais),
    };
  });

  return { ...v, passeios };
}

export function gerarPDFVoucher(v: Voucher, config: Config) {
  // Completa os detalhes do passeio a partir do catálogo antes de renderizar,
  // para o PDF não sair sem "o que levar", ponto de encontro e informações.
  const enriquecido = enriquecerPasseios(v, config);
  const doc = new PDFVoucherBuilder().construir(enriquecido, config);
  // Se não couber em 1 página, reconstrói em modo compacto (tudo em 1 página)
  if (doc.getNumberOfPages() > 1) {
    return new PDFVoucherBuilder(true).construir(enriquecido, config);
  }
  return doc;
}

export function nomeArquivoPDF(v: Voucher) {
  return `voucher-${v.codigo}-${(nomesClientes(v) || "cliente")
    .split(" ")[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]/gi, "")}.pdf`;
}

export function arquivoPDFVoucher(v: Voucher, config: Config) {
  const blob = gerarPDFVoucher(v, config).output("blob");
  return new File([blob], nomeArquivoPDF(v), { type: "application/pdf" });
}

export function baixarPDFVoucher(v: Voucher, config: Config) {
  gerarPDFVoucher(v, config).save(nomeArquivoPDF(v));
}

export function abrirPDFVoucher(v: Voucher, config: Config) {
  const url = gerarPDFVoucher(v, config).output("bloburl");
  window.open(url, "_blank", "noopener,noreferrer");
}

/* ============================================================
   WHATSAPP E COMPARTILHAMENTO
   ============================================================ */

export type ResultadoCompartilhamento = "compartilhado" | "cancelado" | "sem-suporte";

export async function compartilharPDFVoucher(
  v: Voucher,
  config: Config
): Promise<ResultadoCompartilhamento> {
  try {
    const arquivo = arquivoPDFVoucher(v, config);
    if (
      typeof navigator === "undefined" ||
      typeof navigator.canShare !== "function" ||
      !navigator.canShare({ files: [arquivo] })
    ) {
      return "sem-suporte";
    }

    await navigator.share({
      files: [arquivo],
      title: `Voucher ${v.codigo}`,
      text: mensagemVoucher(v, config),
    });
    return "compartilhado";
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return "cancelado";
    return "sem-suporte";
  }
}

export function baixarEAbrirWhatsApp(v: Voucher, config: Config) {
  baixarPDFVoucher(v, config);
  window.open(linkAbrirWhatsApp(mensagemVoucher(v, config)), "_blank", "noopener,noreferrer");
}

/* ============================================================
   GOOGLE AGENDA
   ============================================================ */

const zzz = (n: number) => String(n).padStart(2, "0");

function carimbo(data: string, hora: string) {
  const [y, m, d] = data.split("-").map(Number);
  const [h, mi] = (hora || "08:00").split(":").map(Number);
  return `${y}${zzz(m)}${zzz(d)}T${zzz(h)}${zzz(mi)}00`;
}

function somarHoras(data: string, hora: string, horas: number) {
  const [y, m, d] = data.split("-").map(Number);
  const [h, mi] = (hora || "08:00").split(":").map(Number);
  const dt = new Date(y, m - 1, d, h + horas, mi);
  return `${dt.getFullYear()}${zzz(dt.getMonth() + 1)}${zzz(dt.getDate())}T${zzz(dt.getHours())}${zzz(dt.getMinutes())}00`;
}

export function linkGoogleAgenda(v: Voucher, config: Config) {
  const passeios = (v.passeios || []).filter((p) => p.data);
  if (!passeios.length) return "";

  const ordenados = [...passeios].sort((a, b) =>
    `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`)
  );
  const inicio = ordenados[0];
  const fim = ordenados[ordenados.length - 1];

  const fimData = fim.dataVolta || fim.data;
  const fimHora = fim.horaVolta || fim.hora || inicio.hora;

  let datas: string;
  if (inicio.hora) {
    datas = `${carimbo(inicio.data, inicio.hora)}/${somarHoras(fimData, fimHora, 8)}`;
  } else {
    const [y, m, d] = fimData.split("-").map(Number);
    const seguinte = new Date(y, m - 1, d + 1);
    datas = `${inicio.data.replace(/-/g, "")}/${seguinte.getFullYear()}${zzz(seguinte.getMonth() + 1)}${zzz(seguinte.getDate())}`;
  }

  const detalhes = [
    `Voucher: ${v.codigo}`,
    `Cliente: ${nomesClientes(v)} (${totalPessoas(v)} pessoa${totalPessoas(v) > 1 ? "s" : ""})`,
    v.hotel ? `Hotel: ${v.hotel}` : "",
    ordenados
      .map((p) => {
        let line = `• ${p.nome} — ${dataBR(p.data)}`;
        if (p.hora) line += ` às ${p.hora} (ida)`;
        if (p.dataVolta && p.dataVolta !== p.data) {
          line += ` | Volta ${dataBR(p.dataVolta)}`;
          if (p.horaVolta) line += ` às ${p.horaVolta}`;
        } else if (p.horaVolta) {
          line += ` | Volta às ${p.horaVolta}`;
        }
        return line;
      })
      .join("\n"),
    "",
    `Total: ${brl(v.total)} | Entrada: ${brl(v.entrada)} | A receber: ${brl(aReceber(v))}`,
    config.telefone ? `Contato: ${config.telefone}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${nomesPasseios(v) || "Passeio"} · ${config.empresa}`,
    dates: datas,
    details: detalhes,
    location: v.hotel || config.empresa,
    ctz: "America/Bahia",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
