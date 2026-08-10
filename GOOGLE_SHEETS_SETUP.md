# Controle de Vouchers — como usar e publicar

Sistema para quem fecha o serviço pelo WhatsApp: **não existe cadastro de cliente**. Você cria o voucher já com os nomes das pessoas, envia o **PDF por WhatsApp escolhendo o contato na hora** e o cliente salva os passeios no Google Agenda por um link.

## Telas

| Tela | O que faz |
| --- | --- |
| **Início** | Passeios de hoje, pessoas atendidas, faturamento e valores a receber |
| **Vouchers** | Criar, enviar o PDF por WhatsApp, baixar PDF, mudar status |
| **Agenda** | Todos os passeios dos vouchers por dia e hora (semana ou lista) |
| **Configurações** | Empresa, mensagem do WhatsApp, política de cancelamento, passeios, banco e usuários (só admin) |

## Como funciona o voucher

Ao criar um voucher você informa:

- **Clientes** — quantos nomes quiser (o principal e os acompanhantes)
- **Nº de pessoas** — preenchido sozinho conforme os nomes
- **Hotel**, **WhatsApp** e **outros contatos**
- **Passeios** — um ou vários, cada um com serviço, data, hora e ponto de encontro
- **Valor total**, **desconto** (em % ou R$, opcional) e **entrada** — o "a receber" é calculado automaticamente
- **Forma de pagamento** e **observações**

O envio é sempre **PDF + mensagem curta**, sem número fixo: o WhatsApp abre e você escolhe para qual contato mandar.

- **No celular** — o PDF é gerado e anexado automaticamente; o menu de compartilhamento abre com a mensagem pronta. É só escolher o WhatsApp e o contato.
- **No computador** — o PDF é baixado e o WhatsApp abre já com a mensagem; anexe o arquivo baixado e escolha o contato.

A mensagem é editável em **Configurações → Mensagem do WhatsApp** e aceita atalhos:

| Atalho | Vira |
| --- | --- |
| `{saudacao}` | **Bom dia** (5h–11h), **Boa tarde** (12h–17h) ou **Boa noite**, conforme o horário |
| `{cliente}` | nome da primeira pessoa do voucher |
| `{codigo}` | código do voucher (ex.: VP-A7K2M) |
| `{empresa}` | nome da empresa |

Padrão: `{saudacao}! 🌴 Segue o seu voucher com todos os detalhes do passeio. Qualquer dúvida estamos à disposição. 😊`

Os botões de cada voucher:

- **Enviar WhatsApp** — PDF anexado + mensagem, escolhendo o contato no WhatsApp
- **Baixar PDF** — arquivo com cabeçalho da empresa, dados, pagamento, link do Google Agenda clicável e a política de cancelamento
- **Google Agenda** (ícone de calendário) — abre o evento pronto para salvar

Também há **pré-visualizar** (mostra o PDF anexado e a mensagem como o cliente vai receber).

## Primeiro acesso

Não existe mais usuário ou senha padrão. No primeiro acesso, crie o administrador com uma senha de pelo menos 10 caracteres.

Sem conectar o Google Sheets, o sistema abre em **modo local** com vouchers fictícios de exemplo. Esse modo serve para demonstração; dados reais devem ser armazenados no Google Sheets.

## Conectar o Google Sheets

1. Crie uma planilha e abra **Extensões → Apps Script**
2. Cole o arquivo `google-apps-script/Code.gs`
3. Execute a função **`configurarBanco`** e autorize
4. Execute **`obterChaveInstalacao`** e copie a chave exibida no registro de execução
5. **Implantar → Nova implantação → Aplicativo da Web**
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
6. Copie a URL terminada em `/exec`
7. No primeiro acesso, informe a chave para criar o administrador principal; ela é invalidada automaticamente depois do uso

Abas criadas automaticamente: `Usuarios`, `Vouchers`, `Config`, `Sessoes`, `Auditoria`.

Na aba `Vouchers`, além dos dados brutos, as colunas **servicos**, **datas** e **aReceber** são preenchidas sozinhas para você conseguir ler e filtrar direto na planilha.

### Sempre que o `Code.gs` mudar, reimplante

O Google continua servindo a **versão publicada** do script: salvar o arquivo no editor não muda nada para o site. Se a implantação estiver velha, o painel conecta normalmente, mas o Apps Script **descarta campos que ainda não conhece** ao gravar — foi o que fez o **desconto** sumir depois de atualizar a página (e, antes dele, "O que levar", "Informações adicionais" e a data/hora de volta).

Planilhas criadas com o Code.gs antigo também são corrigidas sozinhas: na primeira requisição com o script novo, o cabeçalho da aba `Vouchers` ganha as colunas que faltam (ex.: `tipoDesconto` e `desconto`) e os dados já gravados são movidos para as colunas certas pelo nome do cabeçalho, sem perder nada.

Por isso o script informa a própria versão ao painel. Quando ela está atrás da esperada, aparece um aviso amarelo no topo e a etapa **Versão do Apps Script** falha em **Configurações → Banco de dados → Testar conexão**.

Para atualizar: cole o `Code.gs` novo e vá em **Implantar → Gerenciar implantações → ✏️ → Versão: Nova versão → Implantar**. Depois **saia e entre novamente** no painel.

### Onde colar a URL

**Opção A — variável do GitHub (recomendada)**

Em **Settings → Secrets and variables → Actions → aba Variables → New repository variable**:

```text
Name:  VITE_APPS_SCRIPT_URL
Value: https://script.google.com/macros/s/SEU_ID/exec
```

O workflow `.github/workflows/deploy.yml` já injeta isso no build.

**Opção B — no painel**

Entre como admin em **Configurações → Banco de dados**, cole a URL, clique em **Testar conexão** e depois em **Salvar URL**. Essa opção tem prioridade sobre a variável do GitHub.

Depois use **Enviar vouchers locais para a planilha** para migrar o que já foi criado no modo local.

### A URL precisa estar exatamente neste formato

```text
https://script.google.com/macros/s/SEU_ID/exec
```

O painel corrige sozinho os desvios mais comuns (barra no fim, `?usp=sharing`, `/u/0/`, `/u/1/` e o formato do Workspace), mas vale conferir na origem:

| Não use | Por quê |
| --- | --- |
| `.../macros/u/0/s/SEU_ID/exec` | O `/u/0/` amarra a URL à conta logada no seu navegador e quebra para todo mundo |
| `.../macros/s/SEU_ID/dev` | É a URL de teste: só abre para o dono do script, logado |
| A URL copiada da barra de endereços | Costuma vir com parâmetros extras |

## Erro 404 em `script.googleusercontent.com/macros/echo`

Esse é o erro mais comum e **quase nunca é problema do site**. Entender o caminho ajuda:

1. o painel chama `https://script.google.com/macros/s/SEU_ID/exec`;
2. o Google responde `302` e manda o navegador para um endereço de uso único em `https://script.googleusercontent.com/macros/echo?user_content_key=...`;
3. o conteúdo (o JSON) é entregue nesse segundo endereço.

A troca de domínio é normal e esperada — é assim que o Google separa conteúdo gerado por usuários. Quando aparece **404** nessa segunda etapa, significa que o Google aceitou a chamada mas não encontrou uma implantação válida para responder.

Vá em **Configurações → Banco de dados → Testar conexão**: o painel mostra em qual das etapas a conexão quebrou. Depois siga a causa correspondente:

| Causa | Como resolver |
| --- | --- |
| **Implantação desatualizada** (mais comum) | No Apps Script: **Implantar → Gerenciar implantações → ícone de lápis (✏️) → Versão: Nova versão → Implantar**. Só salvar o `Code.gs` não republica nada |
| **Acesso restrito** | Na mesma tela: **Executar como: Eu** e **Quem tem acesso: Qualquer pessoa**. A opção "Qualquer pessoa com Conta do Google" **não** funciona aqui |
| **URL com `/u/0/` ou `/u/1/`** | Remova esse trecho. O painel já faz isso sozinho, mas corrija também a variável `VITE_APPS_SCRIPT_URL` no GitHub |
| **URL de teste `/dev`** | Use a URL da implantação, terminada em `/exec` |
| **Implantação excluída ou arquivada** | Crie uma **Nova implantação** e atualize a URL nos dois lugares |
| **Várias contas Google logadas** | Teste numa janela anônima. Se funcionar, o problema é a troca de conta no navegador |
| **Falha momentânea do Google** | O endereço `/macros/echo` é de uso único e às vezes falha sem motivo. O painel já repete sozinho as chamadas seguras uma vez; se persistir, aguarde alguns minutos |

Depois de reimplantar, **saia e entre novamente** no painel para recarregar os dados.

> Se você alterou o `Code.gs`, a reimplantação com **Nova versão** é obrigatória. É o passo esquecido na maioria dos casos de 404.

## Perfis

| Recurso | Administrador | Operador |
| --- | --- | --- |
| Início, Vouchers, Agenda | Sim | Sim |
| Configurações e usuários | Sim | Não |

O menu fica oculto para operadores e o Apps Script bloqueia a chamada no servidor.

## Segurança

- Todo o tráfego usa HTTPS e o Google também protege os arquivos armazenados na infraestrutura dele
- No modo conectado, senhas nunca são gravadas em texto: ficam como HMAC SHA-256 com salt e um segredo exclusivo guardado nas propriedades privadas do Apps Script
- Tokens de sessão nunca são gravados em formato utilizável na planilha; somente o HMAC do token é armazenado
- A sessão expira no servidor em 8 horas, fica apenas na aba atual e é encerrada após 30 minutos sem atividade
- Cinco tentativas incorretas bloqueiam temporariamente novas tentativas para o mesmo usuário
- A criação do primeiro administrador exige uma chave de instalação aleatória e de uso único
- Toda entrada é validada no servidor e textos são neutralizados para impedir injeção de fórmulas na planilha
- Alterações importantes são registradas na aba `Auditoria`
- Não dá para desativar o próprio usuário nem o último administrador
- Configurações e usuários continuam restritos ao perfil administrador
- Mantenha a planilha privada e não compartilhe o projeto do Apps Script

### Sobre o F12 / DevTools

O endereço público do Apps Script e os dados que a tela precisa exibir podem aparecer no DevTools do **próprio usuário autenticado**. Isso é normal em qualquer aplicação web: o navegador precisa receber os dados para mostrá-los. A URL `/exec` não é uma senha e conhecê-la não libera os vouchers.

A proteção contra pessoas externas é feita no servidor: sem uma sessão válida, as ações de leitura e gravação são recusadas. Criptografar novamente o conteúdo dentro do HTTPS apenas esconderia visualmente o painel *Network*, mas a chave também teria de estar no navegador e não criaria segurança real.

## Desenvolvimento

```bash
npm install
npm run dev
```
