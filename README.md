# Vita Nova — página de acesso da turma

Página de acesso pós-compra: para onde a compradora é enviada depois que o
pagamento é aprovado na Cakto. O link vai no e-mail de entrega e leva ao grupo
fechado da turma no WhatsApp.

HTML puro, sem build e sem dependências. Servido por um Worker do Cloudflare
que existe só para três coisas: esconder a página atrás de um caminho secreto,
mandar os headers certos e devolver 404 em todo o resto.

## Como funciona a proteção

São arquivos estáticos: não há como validar compra. A proteção é o caminho ser
secreto.

- Só `/acesso/<token>` responde 200. Todo o resto — inclusive `/acesso`,
  `/acesso/` e tokens errados — dá 404.
- **O token não fica no repositório.** Ele é um secret do Cloudflare
  (`ACCESS_TOKEN`). Este repo é público: se o token estivesse num caminho de
  arquivo, qualquer pessoa leria ele aqui no GitHub, e a proteção acabava.
- A comparação do token é em tempo constante.
- `Referrer-Policy: no-referrer` — sem isso o token vazaria no header `Referer`
  no momento em que a compradora clica no botão do WhatsApp.
- `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` em toda
  resposta, além do `noindex` que já existe no HTML.
- `robots.txt` bloqueia `/acesso/` e `/`. Ele revela o prefixo, nunca o token.
- Nenhum índice é publicado: não existe página em `/` que liste caminhos.

## Cache

`Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`.

O link muda a cada turma. Nada pode ficar preso em cache intermediário, senão
uma compradora nova recebe a página da turma anterior — com o link do grupo
errado.

## Estrutura

```
page/index.html   a página aprovada (não alterar conteúdo, textos, design ou animação)
src/worker.js     roteamento, token e headers
wrangler.toml     configuração do Worker
```

## Deploy

Uma vez, na conta do Cloudflare. A ordem importa: o secret só pode ser
gravado depois que o Worker existe.

```sh
npx wrangler login
npx wrangler deploy                    # cria o Worker (ainda da 404 em tudo)
npx wrangler secret put ACCESS_TOKEN   # cola o token quando pedir
```

Enquanto o `ACCESS_TOKEN` não estiver gravado, o Worker responde 404 em todo
caminho — inclusive no certo. Isso é proposital: sem token, nada é servido.

O endereço sai no fim do `deploy`, na forma
`https://vitanova-acesso.<seu-subdominio>.workers.dev`. A página fica em
`/acesso/<token>` — a raiz é 404 de propósito.

---

## Deu "Not found" / tela preta

O Worker está no ar e respondendo — "Not found" é a resposta dele. Duas causas:

**1. O secret não foi configurado.** Deploy pelo dashboard conectado ao Git
não leva secrets junto: eles são gravados à parte, uma vez só. Nesse estado o
Worker responde **503** com a instrução na tela. Para gravar pelo dashboard:

> Cloudflare › Workers & Pages › `vitanova-acesso` › Settings ›
> Variables and Secrets › Add › tipo **Secret** › nome `ACCESS_TOKEN` › Deploy

Ou pelo terminal: `npx wrangler secret put ACCESS_TOKEN`.

O secret sobrevive aos deploys seguintes — só se grava de novo ao trocar de
turma.

**2. Você abriu a raiz do site.** `/` é 404 de propósito. A página só existe em
`/acesso/<token>`. Não há índice, nem link, nem redirecionamento — é isso que
mantém o caminho secreto.

Para saber qual dos dois é, sem adivinhar:

```sh
curl -i https://<seu-worker>.workers.dev/robots.txt
```

- **200** com `Disallow: /acesso/` → o Worker está certo; é secret ou caminho.
- **503** → é o secret, e o corpo da resposta diz o que fazer.
- Qualquer outra coisa → o repositório foi conectado como projeto **Pages** em
  vez de **Worker**. Refaça em Workers & Pages › Create › Import a repository,
  escolhendo Worker; o `wrangler.toml` cuida do resto.

## Abrindo uma turma nova

Duas coisas mudam a cada turma: **o link do grupo** e **o token**. Sempre as
duas — token novo garante que quem tem o link da turma passada perde o acesso.

### 1. Trocar o link do grupo

O link vive dentro de `page/index.html`, no botão principal. Procure por
`chat.whatsapp.com`:

```sh
grep -n "chat.whatsapp.com" page/index.html
```

Troque a URL pelo convite do grupo novo. Não mexa em mais nada do arquivo — a
página está aprovada.

### 2. Gerar e trocar o token

```sh
node -e "const c=require('crypto'),A='abcdefghjkmnpqrstuvwxyz23456789';let s='';for(const x of c.randomBytes(26))s+=A[x%A.length];console.log(s)"
```

Guarde o que sair. Depois:

```sh
npx wrangler secret put ACCESS_TOKEN   # cola o token novo
```

### 3. Publicar

```sh
npx wrangler deploy
```

O secret vale na hora. O `deploy` só é necessário se você mexeu no HTML ou no
worker — trocar só o token não pede deploy.

### 4. Conferir antes de mandar o e-mail

```sh
TOKEN=<token novo>
HOST=https://vitanova-acesso.<seu-subdominio>.workers.dev

curl -s -o /dev/null -w "pagina:  %{http_code}\n" "$HOST/acesso/$TOKEN"   # 200
curl -s -o /dev/null -w "prefixo: %{http_code}\n" "$HOST/acesso"          # 404
curl -s -o /dev/null -w "errado:  %{http_code}\n" "$HOST/acesso/errado"   # 404
curl -s -o /dev/null -w "antigo:  %{http_code}\n" "$HOST/acesso/<token antigo>"  # 404
```

Abra `/acesso/$TOKEN` no celular e confirme: a animação roda, o botão leva ao
grupo certo, e cabe na tela sem rolagem.

### 5. Atualizar o e-mail de entrega na Cakto

O link novo é `https://.../acesso/<token novo>`. Enquanto o e-mail apontar para
o token antigo, as compradoras novas caem num 404.

## Teste local

```sh
echo "ACCESS_TOKEN=$(node -e "const c=require('crypto'),A='abcdefghjkmnpqrstuvwxyz23456789';let s='';for(const x of c.randomBytes(26))s+=A[x%A.length];console.log(s)")" > .dev.vars
npx wrangler dev --local
```

`.dev.vars` está no `.gitignore` e nunca vai para o repositório.
