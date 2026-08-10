/**
 * Controle de Vouchers — backend seguro em Google Sheets.
 *
 * Implantação:
 * 1. execute configurarBanco();
 * 2. execute obterChaveInstalacao() e guarde a chave exibida no registro;
 * 3. publique como Aplicativo da Web (executar como "Eu", acesso "Qualquer pessoa").
 *
 * O endereço /exec pode aparecer no DevTools e não é tratado como segredo.
 * A proteção real é feita por autenticação, autorização, sessões com token
 * armazenado somente como hash, limitação de tentativas e validação no servidor.
 */

var ABAS = {
  Usuarios: ['id', 'nome', 'email', 'usuario', 'papel', 'senhaHash', 'salt', 'ativo', 'criadoEm', 'ultimoAcesso'],
  Vouchers: ['id', 'codigo', 'clientes', 'pessoas', 'hotel', 'telefone', 'contatoExtra', 'passeios',
             'servicos', 'datas', 'total', 'tipoDesconto', 'desconto', 'entrada', 'aReceber', 'formaPagamento', 'observacoes', 'status', 'criadoEm'],
  Gastos: ['id', 'descricao', 'categoria', 'valor', 'data', 'observacao', 'criadoEm'], 
  Config: ['chave', 'valor', 'atualizadoEm'],
  Sessoes: ['id', 'token', 'usuarioId', 'expiraEm', 'criadoEm'],
  Auditoria: ['id', 'usuarioId', 'usuario', 'acao', 'recurso', 'recursoId', 'detalhes', 'criadoEm']
};

var SEGURANCA = {
  // Enviada ao painel em todas as respostas. Quando o número aqui for menor
  // que o esperado pelo site, o painel avisa que a implantação está velha.
  // v4: desconto (tipoDesconto/desconto) gravado na planilha + migração
  //     automática de abas criadas com layout antigo.
  versao: '5',
  tamanhoMaximoRequisicao: 300000,
  horasSessao: 8,
  maxTentativasLogin: 5,
  bloqueioLoginSegundos: 15 * 60,
  maxRegistrosAuditoria: 5000
};

// Status aceitos pelo app. O 'confirmado' de versões antigas foi removido e é
// tratado como 'pendente' para não quebrar vouchers já gravados na planilha.
var STATUS_VALIDOS = ['pendente', 'concluido', 'cancelado'];

var CONFIG_PADRAO = {
  empresa: 'Vem Pra Porto',
  cnpj: '',
  instagram: '@vempraporto.ps',
  telefone: '',
  mensagemVoucher: '{saudacao}! 🌴 Segue o seu voucher com todos os detalhes do passeio. Qualquer dúvida estamos à disposição. 😊',
  politicaCancelamento: 'Prezados(as),\n\nInformamos que cancelamentos realizados com até 18 horas de antecedência do horário do passeio estarão sujeitos à cobrança integral do valor do passeio.\n\nA exceção será apenas em casos de doença, mediante apresentação de atestado médico válido.\n\nAgradecemos pela compreensão e permanecemos à disposição.',
  servicos: JSON.stringify([
    {
      id: 's1',
      nome: 'Praia do Espelho + Caraíva',
      preco: 300,
      oQueLevar: '• Protetor solar, boné/chapéu\n• Roupa de banho + toalha\n• Câmera / celular carregado\n• Dinheiro / cartão para compras',
      pontoRetorno: 'Retorno previsto no mesmo ponto de embarque (Hotel / Pousada). Horário aproximado de retorno: conforme roteiro.',
      informacoesAdicionais: 'Em caso de atraso ou imprevisto, entre em contato com nossa central pelo WhatsApp da empresa. Obrigado por escolher a Vem Pra Porto!'
    },
    {
      id: 's2',
      nome: 'Trancoso + Quadrado',
      preco: 180,
      oQueLevar: '• Protetor solar, boné/chapéu\n• Calçado confortável\n• Câmera / celular carregado\n• Dinheiro / cartão para compras',
      pontoRetorno: 'Retorno previsto no mesmo ponto de embarque (Hotel / Pousada). Horário aproximado de retorno: conforme roteiro.',
      informacoesAdicionais: 'Em caso de atraso ou imprevisto, entre em contato com nossa central pelo WhatsApp da empresa. Obrigado por escolher a Vem Pra Porto!'
    },
    {
      id: 's3',
      nome: "Arraial d'Ajuda",
      preco: 150,
      oQueLevar: '• Protetor solar, boné/chapéu\n• Roupa de banho + toalha\n• Dinheiro / cartão para compras',
      pontoRetorno: 'Retorno previsto no mesmo ponto de embarque (Hotel / Pousada). Horário aproximado de retorno: conforme roteiro.',
      informacoesAdicionais: 'Em caso de atraso ou imprevisto, entre em contato com nossa central pelo WhatsApp da empresa. Obrigado por escolher a Vem Pra Porto!'
    }
  ])
};

/* ---------------- Entrada HTTP ---------------- */

/**
 * GET não executa ações nem recebe credenciais: serve apenas para o painel
 * confirmar que a implantação está no ar. Se o navegador receber HTML ou 404
 * aqui, a implantação está desatualizada ou não está aberta a "Qualquer pessoa".
 */
function doGet() {
  return responder({ ok: true, data: { servico: 'Controle de Vouchers', versao: SEGURANCA.versao } });
}

function doPost(e) {
  var conteudo = (e && e.postData && e.postData.contents) || '';
  if (!conteudo || conteudo.length > SEGURANCA.tamanhoMaximoRequisicao) {
    return responder({ ok: false, error: 'Requisição inválida ou muito grande.' });
  }

  var body = {};
  try {
    body = JSON.parse(conteudo);
  } catch (err) {
    return responder({ ok: false, error: 'JSON inválido.' });
  }
  return responder(processar(body));
}

function responder(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function processar(req) {
  try {
    configurarBanco();
    if (!req || Object.prototype.toString.call(req) !== '[object Object]')
      throw new Error('Requisição inválida.');

    var acao = texto(req.acao, 40, true, 'Ação');

    // Somente estas três ações existem antes da autenticação.
    if (acao === 'status') return ok({ temAdmin: temAdmin(), versao: SEGURANCA.versao });
    if (acao === 'criarPrimeiroAdmin') return ok(criarPrimeiroAdmin(req));
    if (acao === 'entrar') return ok(entrar(req));

    var auth = exigirSessao(req.token);

    switch (acao) {
      case 'eu':
        return ok(publico(auth.usuario));

      case 'sair':
        auditar(auth.usuario, 'SAIR', 'Sessao', auth.sessao.id, 'Sessão encerrada');
        remover('Sessoes', auth.sessao.id);
        return ok(null);

      case 'dados':
        return ok({ vouchers: lerVouchers(), gastos: lerGastos(), config: lerConfig(), versao: SEGURANCA.versao });

      case 'salvarVoucher': {
        var voucher = salvarVoucher(req.voucher);
        auditar(auth.usuario, 'SALVAR', 'Voucher', voucher.id, voucher.codigo);
        return ok(voucher);
      }

      case 'removerVoucher': {
        var voucherId = identificador(req.id, 'Voucher');
        remover('Vouchers', voucherId);
        auditar(auth.usuario, 'REMOVER', 'Voucher', voucherId, '');
        return ok(null);
      }

      case 'salvarGasto': {
        var gasto = salvarGasto(req.gasto);
        auditar(auth.usuario, 'SALVAR', 'Gasto', gasto.id, gasto.descricao);
        return ok(gasto);
      }

      case 'removerGasto': {
        var gastoId = identificador(req.id, 'Gasto');
        remover('Gastos', gastoId);
        auditar(auth.usuario, 'REMOVER', 'Gasto', gastoId, '');
        return ok(null);
      }

      case 'salvarConfig': {
        exigirAdmin(auth.usuario);
        var config = salvarConfig(req.config);
        auditar(auth.usuario, 'SALVAR', 'Config', 'geral', 'Configurações atualizadas');
        return ok(config);
      }

      case 'listarUsuarios':
        exigirAdmin(auth.usuario);
        return ok(registros('Usuarios').map(publico));

      case 'criarUsuario': {
        exigirAdmin(auth.usuario);
        var usuarioNovo = criarUsuario(req.usuarioNovo);
        auditar(auth.usuario, 'CRIAR', 'Usuario', usuarioNovo.id, usuarioNovo.usuario);
        return ok(usuarioNovo);
      }

      case 'alternarUsuario': {
        exigirAdmin(auth.usuario);
        var usuarioAlterado = alternarUsuario(auth.usuario, req.id, req.ativo);
        auditar(
          auth.usuario,
          usuarioAlterado.ativo ? 'ATIVAR' : 'DESATIVAR',
          'Usuario',
          usuarioAlterado.id,
          usuarioAlterado.usuario
        );
        return ok(usuarioAlterado);
      }

      default:
        throw new Error('Ação não permitida.');
    }
  } catch (err) {
    // Nunca devolve stack trace, nomes de abas ou detalhes internos ao navegador.
    return { ok: false, error: mensagemErro(err) };
  }
}

function ok(data) {
  return { ok: true, data: data };
}

function mensagemErro(err) {
  var msg = err && err.message ? String(err.message) : 'Não foi possível concluir a operação.';
  return msg.length <= 240 ? msg : 'Não foi possível concluir a operação.';
}

/* ---------------- Planilha ---------------- */

function configurarBanco() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(ABAS).forEach(function (nome) {
    var abaAtual = ss.getSheetByName(nome) || ss.insertSheet(nome);
    if (abaAtual.getLastRow() === 0) {
      abaAtual.getRange(1, 1, 1, ABAS[nome].length).setValues([ABAS[nome]]);
      abaAtual.setFrozenRows(1);
      abaAtual.getRange(1, 1, 1, ABAS[nome].length).setFontWeight('bold');
    } else {
      migrarCabecalho(abaAtual, nome);
    }
  });

  inicializarSegredos();

  if (registros('Config').length === 0) {
    Object.keys(CONFIG_PADRAO).forEach(function (chave) {
      gravar('Config', { chave: chave, valor: CONFIG_PADRAO[chave], atualizadoEm: agora() });
    });
  }
}

/**
 * Atualiza abas criadas por versões antigas do Code.gs para o esquema atual.
 *
 * O cabeçalho só era escrito quando a aba nascia vazia; por isso planilhas
 * antigas podem não ter as colunas novas (ex.: tipoDesconto e desconto). Com
 * o cabeçalho defasado, cada gravação posiciona os valores pelo esquema ATUAL
 * enquanto a leitura de linhas antigas usa o esquema em que foram gravadas —
 * era isso que fazia o desconto "sumir" depois de salvar.
 *
 * A migração compara o cabeçalho com ABAS e, se estiver diferente, reescreve
 * o cabeçalho e move cada valor para a coluna de mesmo nome. Colunas novas
 * nascem vazias; colunas que não existem mais são descartadas. Roda sozinha
 * na primeira requisição após reimplantar o Code.gs novo.
 */
function migrarCabecalho(s, nome) {
  var cols = ABAS[nome];
  var ultimaLinha = s.getLastRow();
  var largura = Math.max(s.getLastColumn(), cols.length);

  var cabAtual = s.getRange(1, 1, 1, largura).getValues()[0].map(function (c) {
    return String(c === null || c === undefined ? '' : c).trim();
  });

  var igual = cabAtual.length === cols.length;
  for (var c = 0; igual && c < cols.length; c++) {
    if (cabAtual[c] !== cols[c]) igual = false;
  }
  if (igual) return;

  var linhas = ultimaLinha > 1 ? s.getRange(2, 1, ultimaLinha - 1, largura).getValues() : [];
  var novas = linhas
    .filter(function (linha) {
      return linha.some(function (v) { return v !== '' && v !== null; });
    })
    .map(function (linha) {
      return cols.map(function (col) {
        var origem = cabAtual.indexOf(col);
        var valor = origem >= 0 ? linha[origem] : '';
        return valor === null || valor === undefined ? '' : valor;
      });
    });

  s.getRange(1, 1, ultimaLinha, largura).clearContent();
  s.getRange(1, 1, 1, cols.length).setValues([cols]);
  s.getRange(1, 1, 1, cols.length).setFontWeight('bold');
  s.setFrozenRows(1);
  if (novas.length) s.getRange(2, 1, novas.length, cols.length).setValues(novas);
}

/**
 * Execute manualmente no editor do Apps Script antes do primeiro acesso.
 * A chave também aparece no registro de execução e é apagada após criar o admin.
 */
function obterChaveInstalacao() {
  configurarBanco();
  if (temAdmin()) {
    Logger.log('O administrador principal já foi criado.');
    return 'O administrador principal já foi criado.';
  }
  var chave = PropertiesService.getScriptProperties().getProperty('SETUP_KEY');
  Logger.log('CHAVE DE INSTALAÇÃO: ' + chave);
  return chave;
}

function inicializarSegredos() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SESSION_PEPPER'))
    props.setProperty('SESSION_PEPPER', aleatorioSeguro());
  if (!props.getProperty('PASSWORD_PEPPER'))
    props.setProperty('PASSWORD_PEPPER', aleatorioSeguro());
  if (!temAdmin() && !props.getProperty('SETUP_KEY'))
    props.setProperty('SETUP_KEY', gerarChaveInstalacao());
}

function aleatorioSeguro() {
  return [Utilities.getUuid(), Utilities.getUuid(), Utilities.getUuid(), Utilities.getUuid()].join('-');
}

function gerarChaveInstalacao() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 32).toUpperCase();
}

function segredo(nome) {
  var valor = PropertiesService.getScriptProperties().getProperty(nome);
  if (!valor) throw new Error('Configuração de segurança ausente. Execute configurarBanco().');
  return valor;
}

function aba(nome) {
  if (!ABAS[nome]) throw new Error('Operação de banco inválida.');
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!s) throw new Error('Banco de dados não configurado.');
  return s;
}

function registros(nome) {
  var s = aba(nome);
  var ultima = s.getLastRow();
  if (ultima < 2) return [];
  var cols = ABAS[nome];
  return s.getRange(2, 1, ultima - 1, cols.length).getValues()
    .filter(function (linha) {
      return linha.some(function (v) { return v !== '' && v !== null; });
    })
    .map(function (linha) {
      var reg = {};
      cols.forEach(function (col, i) {
        reg[col] = lerCelula(linha[i]);
      });
      return reg;
    });
}

/** Impede que texto controlado pelo usuário vire fórmula no Google Sheets. */
function valorCelula(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  var valor = String(v);
  return /^[=+\-@]/.test(valor) ? "'" + valor : valor;
}

function lerCelula(v) {
  var valor = v === null || v === undefined ? '' : String(v);
  return /^'[=+\-@]/.test(valor) ? valor.slice(1) : valor;
}

function gravar(nome, registro) {
  if (!registro || typeof registro !== 'object') throw new Error('Registro inválido.');
  var s = aba(nome);
  var cols = ABAS[nome];
  var chaveCol = nome === 'Config' ? 'chave' : 'id';
  if (nome !== 'Config' && !registro.id) registro.id = Utilities.getUuid();
  var chave = String(registro[chaveCol] || '');
  if (!chave) throw new Error('Registro sem identificador.');

  var idx = cols.indexOf(chaveCol);
  var ultima = s.getLastRow();
  var linhas = ultima > 1 ? s.getRange(2, 1, ultima - 1, cols.length).getValues() : [];
  var alvo = -1;
  for (var i = 0; i < linhas.length; i++) {
    if (lerCelula(linhas[i][idx]) === chave) { alvo = i + 2; break; }
  }

  var valores = cols.map(function (col) { return valorCelula(registro[col]); });
  if (alvo === -1) s.appendRow(valores);
  else s.getRange(alvo, 1, 1, cols.length).setValues([valores]);
  return registro;
}

function remover(nome, id) {
  var s = aba(nome);
  var cols = ABAS[nome];
  var idx = cols.indexOf('id');
  var ultima = s.getLastRow();
  if (idx < 0 || ultima < 2) return null;
  var linhas = s.getRange(2, 1, ultima - 1, cols.length).getValues();
  for (var i = linhas.length - 1; i >= 0; i--) {
    if (lerCelula(linhas[i][idx]) === String(id)) s.deleteRow(i + 2);
  }
  return null;
}

function porId(nome, id) {
  var lista = registros(nome);
  for (var i = 0; i < lista.length; i++) {
    if (String(lista[i].id) === String(id)) return lista[i];
  }
  return null;
}

function booleano(v) {
  return String(v).toLowerCase() === 'true' || String(v) === '1';
}

function jsonSeguro(valor, padrao) {
  try {
    var v = JSON.parse(valor || '');
    return v || padrao;
  } catch (e) {
    return padrao;
  }
}

/* ---------------- Validação ---------------- */

function texto(valor, maximo, obrigatorio, rotulo) {
  if (valor !== null && typeof valor === 'object') throw new Error((rotulo || 'Campo') + ' inválido.');
  var saida = String(valor === undefined || valor === null ? '' : valor).trim();
  if (obrigatorio && !saida) throw new Error((rotulo || 'Campo') + ' é obrigatório.');
  if (saida.length > maximo) throw new Error((rotulo || 'Campo') + ' excede o limite permitido.');
  return saida;
}

function identificador(valor, rotulo) {
  var id = texto(valor, 100, true, rotulo || 'Identificador');
  if (!/^[A-Za-z0-9._:-]+$/.test(id)) throw new Error((rotulo || 'Identificador') + ' inválido.');
  return id;
}

function numero(valor, minimo, maximo, rotulo) {
  var n = Number(valor);
  if (!isFinite(n) || n < minimo || n > maximo)
    throw new Error((rotulo || 'Número') + ' inválido.');
  return n;
}

/** Valor do desconto em reais sobre o total (aceita % ou valor fixo R$). */
function descontoValorGs(total, tipo, valor) {
  if (valor <= 0) return 0;
  if (tipo === 'fixo') return Math.min(valor, total);
  return total * (valor / 100);
}

function lista(valor, maximo, rotulo) {
  if (Object.prototype.toString.call(valor) !== '[object Array]')
    throw new Error((rotulo || 'Lista') + ' inválida.');
  if (valor.length > maximo) throw new Error((rotulo || 'Lista') + ' excede o limite permitido.');
  return valor;
}

function dataSegura(valor) {
  var data = texto(valor, 10, true, 'Data');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data inválida.');
  return data;
}

/** Igual a dataSegura, mas aceita vazio — usado na data de volta. */
function dataOpcional(valor) {
  var data = texto(valor, 10, false, 'Data');
  if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data inválida.');
  return data;
}

function horaSegura(valor) {
  var hora = texto(valor, 5, false, 'Hora');
  if (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new Error('Hora inválida.');
  return hora;
}

function limparVoucher(v) {
  if (!v || Object.prototype.toString.call(v) !== '[object Object]')
    throw new Error('Voucher inválido.');

  var clientes = lista(v.clientes, 50, 'Clientes').map(function (nome) {
    return texto(nome, 120, true, 'Nome do cliente');
  });
  if (!clientes.length) throw new Error('Informe pelo menos um cliente.');

  var passeios = lista(v.passeios, 30, 'Passeios').map(function (p) {
    if (!p || Object.prototype.toString.call(p) !== '[object Object]')
      throw new Error('Passeio inválido.');
    // Todos os campos preenchidos na tela precisam ser gravados. Qualquer campo
    // ausente aqui é silenciosamente descartado e some do voucher e do PDF.
    return {
      id: p.id ? identificador(p.id, 'Passeio') : Utilities.getUuid(),
      nome: texto(p.nome, 160, true, 'Nome do passeio'),
      data: dataSegura(p.data),
      hora: horaSegura(p.hora),
      dataVolta: dataOpcional(p.dataVolta),
      horaVolta: horaSegura(p.horaVolta),
      local: texto(p.local, 250, false, 'Ponto de encontro'),
      oQueLevar: texto(p.oQueLevar || '', 1000, false, 'O que levar'),
      informacoesAdicionais: texto(p.informacoesAdicionais || '', 2000, false, 'Informações adicionais')
    };
  });
  if (!passeios.length) throw new Error('Informe pelo menos um passeio.');

  var status = texto(v.status || 'pendente', 20, true, 'Status');
  // Clientes/abas antigas podem ainda enviar 'confirmado'; trata como pendente.
  if (status === 'confirmado') status = 'pendente';
  if (STATUS_VALIDOS.indexOf(status) === -1)
    throw new Error('Status inválido.');

  var codigo = texto(v.codigo, 30, true, 'Código').toUpperCase();
  if (!/^[A-Z0-9-]+$/.test(codigo)) throw new Error('Código do voucher inválido.');

  var criadoEm = texto(v.criadoEm || agora(), 40, true, 'Data de criação');
  if (isNaN(new Date(criadoEm).getTime())) criadoEm = agora();

  var total = numero(v.total || 0, 0, 100000000, 'Valor total');
  var entrada = numero(v.entrada || 0, 0, total, 'Valor da entrada');
  var tipoDesconto = v.tipoDesconto === 'fixo' ? 'fixo' : 'percentual';
  var desconto = numero(v.desconto || 0, 0, 100000000, 'Desconto');
  if (desconto > 0 && tipoDesconto === 'percentual' && desconto > 100)
    throw new Error('Desconto percentual não pode passar de 100%.');

  return {
    id: identificador(v.id, 'Voucher'),
    codigo: codigo,
    clientes: clientes,
    pessoas: Math.floor(numero(v.pessoas || clientes.length, 1, 1000, 'Quantidade de pessoas')),
    hotel: texto(v.hotel, 200, false, 'Hotel'),
    telefone: texto(v.telefone, 40, false, 'Telefone'),
    contatoExtra: texto(v.contatoExtra, 300, false, 'Contato adicional'),
    passeios: passeios,
    total: total,
    tipoDesconto: tipoDesconto,
    desconto: desconto,
    entrada: entrada,
    formaPagamento: texto(v.formaPagamento, 200, false, 'Forma de pagamento'),
    observacoes: texto(v.observacoes, 2000, false, 'Observações'),
    status: status,
    criadoEm: criadoEm
  };
}

function limparConfig(config) {
  if (!config || Object.prototype.toString.call(config) !== '[object Object]')
    throw new Error('Configuração inválida.');

  var servicos = lista(config.servicos || [], 200, 'Serviços').map(function (s) {
    if (!s || Object.prototype.toString.call(s) !== '[object Object]')
      throw new Error('Serviço inválido.');
    return {
      id: s.id ? identificador(s.id, 'Serviço') : Utilities.getUuid(),
      nome: texto(s.nome, 160, true, 'Nome do serviço'),
      preco: numero(s.preco || 0, 0, 100000000, 'Preço do serviço'),
      oQueLevar: texto(s.oQueLevar || '', 1000, false, 'O que levar'),
      pontoRetorno: texto(s.pontoRetorno || '', 1000, false, 'Ponto de retorno'),
      informacoesAdicionais: texto(s.informacoesAdicionais || '', 2000, false, 'Informações adicionais')
    };
  });

  return {
    empresa: texto(config.empresa, 160, true, 'Nome da empresa'),
    cnpj: texto(config.cnpj, 30, false, 'CNPJ'),
    instagram: texto(config.instagram, 100, false, 'Instagram'),
    telefone: texto(config.telefone, 40, false, 'Telefone'),
    mensagemVoucher: texto(config.mensagemVoucher, 2000, false, 'Mensagem do voucher'),
    politicaCancelamento: texto(config.politicaCancelamento, 10000, false, 'Política de cancelamento'),
    servicos: servicos
  };
}

/* ---------------- Vouchers ---------------- */

function lerVouchers() {
  return registros('Vouchers').map(function (v) {
    return {
      id: v.id,
      codigo: v.codigo,
      clientes: jsonSeguro(v.clientes, v.clientes ? [v.clientes] : []),
      pessoas: Number(v.pessoas || 1),
      hotel: v.hotel,
      telefone: v.telefone,
      contatoExtra: v.contatoExtra,
      passeios: jsonSeguro(v.passeios, []),
      total: Number(v.total || 0),
      tipoDesconto: v.tipoDesconto === 'fixo' ? 'fixo' : 'percentual',
      desconto: Number(v.desconto || 0),
      entrada: Number(v.entrada || 0),
      formaPagamento: v.formaPagamento,
      observacoes: v.observacoes,
      // Nunca devolve um status desconhecido (ex.: 'confirmado' de versões
      // antigas) para o app — isso derrubava a tela de Vouchers.
      status: STATUS_VALIDOS.indexOf(v.status) !== -1 ? v.status : 'pendente',
      criadoEm: v.criadoEm
    };
  });
}

function salvarVoucher(entrada) {
  var v = limparVoucher(entrada);
  var servicos = v.passeios.map(function (p) { return p.nome; }).filter(String).join(' + ');
  var datas = v.passeios.map(function (p) { return p.data; }).filter(String).sort().join(' | ');

  gravar('Vouchers', {
    id: v.id,
    codigo: v.codigo,
    clientes: JSON.stringify(v.clientes),
    pessoas: v.pessoas,
    hotel: v.hotel,
    telefone: v.telefone,
    contatoExtra: v.contatoExtra,
    passeios: JSON.stringify(v.passeios),
    servicos: servicos,
    datas: datas,
    total: v.total,
    tipoDesconto: v.tipoDesconto,
    desconto: v.desconto,
    entrada: v.entrada,
    aReceber: Math.max(0, v.total - v.entrada - descontoValorGs(v.total, v.tipoDesconto, v.desconto)),
    formaPagamento: v.formaPagamento,
    observacoes: v.observacoes,
    status: v.status,
    criadoEm: v.criadoEm
  });
  return v;
}

/* ---------------- Gastos operacionais ---------------- */

function lerGastos() {
  return registros('Gastos').map(function (g) {
    return { id: g.id, descricao: g.descricao, categoria: g.categoria, valor: Number(g.valor || 0), data: g.data, observacao: g.observacao || '', criadoEm: g.criadoEm };
  });
}

function salvarGasto(entrada) {
  if (!entrada || Object.prototype.toString.call(entrada) !== '[object Object]') throw new Error('Gasto inválido.');
  var gasto = {
    id: entrada.id ? identificador(entrada.id, 'Gasto') : Utilities.getUuid(),
    descricao: texto(entrada.descricao, 200, true, 'Descrição'),
    categoria: texto(entrada.categoria, 80, true, 'Categoria'),
    valor: numero(entrada.valor, 0.01, 100000000, 'Valor'),
    data: dataSegura(entrada.data),
    observacao: texto(entrada.observacao || '', 1000, false, 'Observação'),
    criadoEm: texto(entrada.criadoEm || agora(), 40, true, 'Data de criação')
  };
  gravar('Gastos', gasto);
  return gasto;
}

/* ---------------- Config ---------------- */

function lerConfig() {
  var saida = {
    empresa: CONFIG_PADRAO.empresa,
    cnpj: CONFIG_PADRAO.cnpj,
    instagram: CONFIG_PADRAO.instagram,
    telefone: CONFIG_PADRAO.telefone,
    mensagemVoucher: CONFIG_PADRAO.mensagemVoucher,
    politicaCancelamento: CONFIG_PADRAO.politicaCancelamento,
    servicos: []
  };
  registros('Config').forEach(function (item) {
    if (item.chave === 'servicos') {
      saida.servicos = jsonSeguro(item.valor, []);
    } else if (saida.hasOwnProperty(item.chave)) {
      saida[item.chave] = item.valor;
    }
  });
  if (!saida.servicos.length) saida.servicos = jsonSeguro(CONFIG_PADRAO.servicos, []);
  return saida;
}

function salvarConfig(entrada) {
  var config = limparConfig(entrada);
  ['empresa', 'cnpj', 'instagram', 'telefone', 'mensagemVoucher', 'politicaCancelamento']
    .forEach(function (chave) {
      gravar('Config', { chave: chave, valor: config[chave], atualizadoEm: agora() });
    });
  gravar('Config', {
    chave: 'servicos', valor: JSON.stringify(config.servicos), atualizadoEm: agora()
  });
  return lerConfig();
}

/* ---------------- Autenticação ---------------- */

function temAdmin() {
  return registros('Usuarios').some(function (u) { return u.papel === 'admin'; });
}

function criarPrimeiroAdmin(req) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (registros('Usuarios').length > 0) throw new Error('O primeiro usuário já foi criado.');
    var esperada = segredo('SETUP_KEY');
    var recebida = texto(req.chaveInstalacao, 100, true, 'Chave de instalação').toUpperCase();
    if (!seguroIgual(esperada, recebida)) throw new Error('Chave de instalação inválida.');

    validarUsuario(req);
    var u = montarUsuario(req, 'admin');
    gravar('Usuarios', u);
    PropertiesService.getScriptProperties().deleteProperty('SETUP_KEY');
    auditar(u, 'CRIAR', 'Usuario', u.id, 'Administrador principal');
    return novaSessao(u);
  } finally {
    lock.releaseLock();
  }
}

function entrar(req) {
  var id = texto(req.usuario, 160, true, 'Usuário').toLowerCase();
  var senha = senhaRecebida(req.senha);
  verificarLimiteLogin(id);

  var achado = null;
  registros('Usuarios').forEach(function (u) {
    if (u.usuario.toLowerCase() === id || u.email.toLowerCase() === id) achado = u;
  });

  var valido = false;
  if (achado && booleano(achado.ativo)) {
    if (String(achado.senhaHash).indexOf('v2$') === 0) {
      valido = seguroIgual(hashSenha(senha, achado.salt), achado.senhaHash);
    } else {
      // Migração transparente dos hashes da versão anterior no primeiro login.
      valido = seguroIgual(hashLegado(senha, achado.salt), achado.senhaHash);
      if (valido) {
        achado.senhaHash = hashSenha(senha, achado.salt);
        gravar('Usuarios', achado);
      }
    }
  }

  if (!valido) {
    registrarFalhaLogin(id);
    Utilities.sleep(150);
    throw new Error('Usuário ou senha inválidos.');
  }

  limparFalhasLogin(id);
  achado.ultimoAcesso = agora();
  gravar('Usuarios', achado);
  auditar(achado, 'ENTRAR', 'Sessao', '', 'Login realizado');
  return novaSessao(achado);
}

function chaveLogin(id) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(id),
    Utilities.Charset.UTF_8
  );
  return 'login_' + Utilities.base64EncodeWebSafe(digest).slice(0, 40);
}

function verificarLimiteLogin(id) {
  var total = Number(CacheService.getScriptCache().get(chaveLogin(id)) || 0);
  if (total >= SEGURANCA.maxTentativasLogin)
    throw new Error('Muitas tentativas de acesso. Tente novamente em 15 minutos.');
}

function registrarFalhaLogin(id) {
  var cache = CacheService.getScriptCache();
  var chave = chaveLogin(id);
  var total = Number(cache.get(chave) || 0) + 1;
  cache.put(chave, String(total), SEGURANCA.bloqueioLoginSegundos);
}

function limparFalhasLogin(id) {
  CacheService.getScriptCache().remove(chaveLogin(id));
}

function novaSessao(usuario) {
  var token = aleatorioSeguro();
  var expiraEm = new Date(Date.now() + SEGURANCA.horasSessao * 60 * 60 * 1000).toISOString();
  gravar('Sessoes', {
    id: Utilities.getUuid(),
    // Nunca grava o token utilizável na planilha; apenas seu HMAC.
    token: hashToken(token),
    usuarioId: usuario.id,
    expiraEm: expiraEm,
    criadoEm: agora()
  });
  limparSessoes();
  return { token: token, usuario: publico(usuario), expiraEm: expiraEm };
}

function hashToken(token) {
  var bytes = Utilities.computeHmacSha256Signature(
    String(token),
    segredo('SESSION_PEPPER'),
    Utilities.Charset.UTF_8
  );
  return 'v2$' + Utilities.base64Encode(bytes);
}

function exigirSessao(token) {
  var recebido = texto(token, 300, true, 'Sessão');
  var procurado = hashToken(recebido);
  var achada = null;
  registros('Sessoes').forEach(function (s) {
    if (seguroIgual(s.token, procurado)) achada = s;
  });
  if (!achada || new Date(achada.expiraEm).getTime() < Date.now())
    throw new Error('Sessão expirada. Entre novamente.');
  var usuario = porId('Usuarios', achada.usuarioId);
  if (!usuario || !booleano(usuario.ativo)) throw new Error('Usuário inativo.');
  return { sessao: achada, usuario: usuario };
}

function limparSessoes() {
  registros('Sessoes').forEach(function (s) {
    if (new Date(s.expiraEm).getTime() < Date.now()) remover('Sessoes', s.id);
  });
}

function exigirAdmin(usuario) {
  if (!usuario || usuario.papel !== 'admin')
    throw new Error('Acesso permitido somente para administradores.');
}

function senhaRecebida(valor) {
  if (valor !== null && typeof valor === 'object') throw new Error('Senha inválida.');
  var senha = String(valor === undefined || valor === null ? '' : valor);
  if (!senha || senha.length > 200) throw new Error('Senha inválida.');
  return senha;
}

function validarUsuario(dados) {
  var nome = texto(dados && dados.nome, 160, true, 'Nome');
  var email = texto(dados && dados.email, 160, true, 'E-mail').toLowerCase();
  var usuario = texto(dados && dados.usuario, 50, true, 'Usuário').toLowerCase();
  var senha = senhaRecebida(dados && dados.senha);
  if (nome.length < 2) throw new Error('Informe o nome completo.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido.');
  if (!/^[a-z0-9._-]{3,50}$/.test(usuario))
    throw new Error('O usuário deve ter de 3 a 50 caracteres, sem espaços.');
  if (senha.length < 10) throw new Error('A senha precisa ter pelo menos 10 caracteres.');
}

function montarUsuario(dados, papel) {
  var usuario = texto(dados.usuario, 50, true, 'Usuário').toLowerCase();
  var email = texto(dados.email, 160, true, 'E-mail').toLowerCase();
  var duplicado = registros('Usuarios').some(function (u) {
    return u.usuario.toLowerCase() === usuario || u.email.toLowerCase() === email;
  });
  if (duplicado) throw new Error('Usuário ou e-mail já cadastrado.');
  var salt = Utilities.getUuid();
  return {
    id: Utilities.getUuid(),
    nome: texto(dados.nome, 160, true, 'Nome'),
    email: email,
    usuario: usuario,
    papel: papel === 'admin' ? 'admin' : 'operador',
    senhaHash: hashSenha(String(dados.senha), salt),
    salt: salt,
    ativo: 'true',
    criadoEm: agora(),
    ultimoAcesso: ''
  };
}

function criarUsuario(dados) {
  validarUsuario(dados);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var u = montarUsuario(dados, dados.papel === 'admin' ? 'admin' : 'operador');
    gravar('Usuarios', u);
    return publico(u);
  } finally {
    lock.releaseLock();
  }
}

function alternarUsuario(atual, id, ativo) {
  var alvo = porId('Usuarios', identificador(id, 'Usuário'));
  if (!alvo) throw new Error('Usuário não encontrado.');
  var ligar = ativo === true || String(ativo) === 'true';
  if (alvo.id === atual.id && !ligar)
    throw new Error('Você não pode desativar o seu próprio usuário.');
  if (alvo.papel === 'admin' && !ligar) {
    var admins = registros('Usuarios').filter(function (u) {
      return u.papel === 'admin' && booleano(u.ativo);
    });
    if (admins.length <= 1) throw new Error('Mantenha pelo menos um administrador ativo.');
  }
  alvo.ativo = ligar ? 'true' : 'false';
  gravar('Usuarios', alvo);
  return publico(alvo);
}

function publico(u) {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    usuario: u.usuario,
    papel: u.papel === 'admin' ? 'admin' : 'operador',
    ativo: booleano(u.ativo),
    criadoEm: u.criadoEm,
    ultimoAcesso: u.ultimoAcesso || undefined
  };
}

/** Hash com salt e segredo exclusivo, mantido fora da planilha. */
function hashSenha(senha, salt) {
  var bytes = Utilities.computeHmacSha256Signature(
    String(salt) + ':' + String(senha),
    segredo('PASSWORD_PEPPER'),
    Utilities.Charset.UTF_8
  );
  return 'v2$' + Utilities.base64Encode(bytes);
}

/** Compatibilidade apenas para migrar senhas criadas pela versão anterior. */
function hashLegado(senha, salt) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(salt) + ':' + String(senha),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64Encode(bytes);
}

function seguroIgual(a, b) {
  var x = String(a || '');
  var y = String(b || '');
  var diferenca = x.length ^ y.length;
  var tamanho = Math.max(x.length, y.length);
  for (var i = 0; i < tamanho; i++)
    diferenca |= (x.charCodeAt(i % Math.max(1, x.length)) || 0) ^
                 (y.charCodeAt(i % Math.max(1, y.length)) || 0);
  return diferenca === 0;
}

/* ---------------- Auditoria ---------------- */

function auditar(usuario, acao, recurso, recursoId, detalhes) {
  try {
    gravar('Auditoria', {
      id: Utilities.getUuid(),
      usuarioId: usuario && usuario.id ? usuario.id : '',
      usuario: usuario && usuario.usuario ? usuario.usuario : '',
      acao: texto(acao, 40, true, 'Ação'),
      recurso: texto(recurso, 60, true, 'Recurso'),
      recursoId: texto(recursoId, 100, false, 'Recurso'),
      detalhes: texto(detalhes, 300, false, 'Detalhes'),
      criadoEm: agora()
    });

    var s = aba('Auditoria');
    var excedentes = s.getLastRow() - 1 - SEGURANCA.maxRegistrosAuditoria;
    if (excedentes > 0) s.deleteRows(2, excedentes);
  } catch (e) {
    // Uma falha no histórico não pode impedir a operação principal.
  }
}

function agora() {
  return new Date().toISOString();
}
