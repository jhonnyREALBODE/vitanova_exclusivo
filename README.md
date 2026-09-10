# Vita Nova — página de acesso da turma

Página de acesso pós-compra: para onde a compradora é enviada depois que o
pagamento é aprovado na Cakto. O link vai no e-mail de entrega e leva ao grupo
fechado da turma no WhatsApp.

HTML puro, sem build e sem dependências. Servido por um Worker do Cloudflare
que existe só para três coisas: esconder a página atrás de um caminho secreto,
mandar os headers certos e devolver 404 em todo o resto.

**Nada é configurado no dashboard do Cloudflare.** Tudo mora no repositório;
o push faz o deploy.

## Abrindo uma turma nova

```sh
npm run turma
git commit -am "turma nova" && git push
```

O script imprime a URL. Cole no e-mail de entrega da Cakto. Acabou.

Para trocar também o convite do WhatsApp, no mesmo comando:

```sh
npm run turma -- --link "https://chat.whatsapp.com/XXXXXXXX"
```

O token aparece **uma vez só**, na saída do comando. Ele não é gravado em
lugar nenhum — nem aqui, nem no Cloudflare. Copie antes de fechar o terminal.
Se perder, é só rodar de novo e gerar outro.

Trocar de turma invalida a turma anterior no mesmo instante: quem tem o link
antigo passa a receber 404.

## Como a proteção funciona

São arquivos estáticos: não há como validar compra. A proteção é o caminho ser
secreto.

- Só `/acesso/<token>` responde 200. Todo o resto — inclusive `/acesso`,
  `/acesso/` e tokens errados — dá 404. Não existe índice, link ou
  redirecionamento que revele o caminho.
- **O token não fica no repositório.** O que fica é o SHA-256 dele, em
  `wrangler.toml`. O Worker faz o hash do que vier na URL e compara. Hash não
  abre a página, então o repo pode ser público sem risco.
- Isso é o que dispensa o dashboard: um secret do Cloudflare precisaria ser
  gravado à mão a cada turma; um hash versionado viaja junto com o push.
- O token tem 26 caracteres de um alfabeto de 31 (~128 bits), sem vogais nem
  caracteres ambíguos — pode ser lido em voz alta ou digitado à mão sem
  confundir `0`/`O` ou `1`/`l`.
- A comparação é em tempo constante.
- `Referrer-Policy: no-referrer` — sem isso o token vazaria no header
  `Referer` no instante em que a compradora clica no botão do WhatsApp.
- `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` em toda
  resposta, além do `noindex` que já existe no HTML.
- `robots.txt` bloqueia `/acesso/` e `/`. Ele revela o prefixo, nunca o token.

## Cache

`Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`.

O link muda a cada turma. Nada pode ficar preso em cache intermediário, senão
uma compradora nova recebe a página da turma anterior — com o link do grupo
errado.

## Estrutura

```
page/index.html   a página aprovada (não alterar conteúdo, textos, design ou animação)
src/worker.js     roteamento, hash do token e headers
wrangler.toml     configuração do Worker + hash da turma atual
turma.mjs         gera o token da turma nova e grava o hash
```

## Primeiro deploy

No dashboard, uma vez só, para conectar o repositório:

> Workers & Pages › Create › **Import a repository** › escolha este repo

O `wrangler.toml` cuida do resto. Deixe **Build command vazio** — este projeto
não tem build. Cada push na branch conectada vira um deploy.

O endereço sai na forma `https://vitanova-exclusivos.joaoreche9.workers.dev`, e a
página fica em `/acesso/<token>`. A raiz é 404 de propósito.

Pelo terminal, se preferir: `npx wrangler login && npx wrangler deploy`.

## Conferindo depois de publicar

```sh
HOST=https://vitanova-exclusivos.joaoreche9.workers.dev
TOKEN=<o token que o npm run turma imprimiu>

curl -s -o /dev/null -w "pagina:  %{http_code}\n" "$HOST/acesso/$TOKEN"  # 200
curl -s -o /dev/null -w "prefixo: %{http_code}\n" "$HOST/acesso"         # 404
curl -s -o /dev/null -w "errado:  %{http_code}\n" "$HOST/acesso/errado"  # 404
```

Abra a URL no celular e confirme: a animação roda, o botão leva ao grupo certo,
e cabe na tela sem rolagem.

## Se der "Not found" / tela preta

"Not found" é a resposta do próprio Worker — ele está no ar. A tela preta é só
o navegador em modo escuro mostrando texto puro. Duas causas:

**1. Você abriu a raiz.** `/` é 404 de propósito. A página só existe no caminho
completo, com o token.

**2. O deploy é anterior ao seu último `npm run turma`.** O hash no Cloudflare
ainda é o da turma passada. Confirme que o push subiu e que o deploy terminou.

Para saber qual é:

```sh
curl -i https://vitanova-exclusivos.joaoreche9.workers.dev/robots.txt
```

- **200** com `Disallow: /acesso/` → Worker saudável; é caminho ou deploy velho.
- **503** → a linha `ACCESS_TOKEN_SHA256` sumiu do `wrangler.toml`; rode
  `npm run turma`.
- Outra coisa → o repo foi conectado como projeto **Pages** em vez de
  **Worker**. Refaça por Create › Import a repository escolhendo Worker.

## Teste local

```sh
npm run dev
```

Sobe em `http://127.0.0.1:8787`. Usa o mesmo hash do `wrangler.toml`, então o
token da turma atual funciona igual.
