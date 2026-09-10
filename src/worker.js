/**
 * Vita Nova — página de acesso da turma paga.
 *
 * A página é estática e não tem como validar compra. A proteção é o caminho
 * ser secreto: só /acesso/<token> responde 200.
 *
 * O repositório guarda apenas o SHA-256 do token (em wrangler.toml). O Worker
 * faz o hash do que vier na URL e compara. Hash não abre a página, então o
 * repo pode ser público e nada precisa ser configurado no dashboard: o token
 * de verdade só existe no e-mail de entrega e no bolso de quem comprou.
 *
 * Qualquer outro caminho, inclusive /acesso e /acesso/<token errado>, dá 404.
 */

import PAGE from "../page/index.html";

const PREFIX = "/acesso/";

// noindex reforçado no header, além do que já existe no HTML.
const NOINDEX = "noindex, nofollow, noarchive, nosnippet, noimageindex";

// O link é trocado a cada turma: nada pode ficar preso em cache intermediário.
const NO_CACHE = "private, no-cache, no-store, must-revalidate, max-age=0";

const ROBOTS = `User-agent: *
Disallow: /acesso/
Disallow: /
`;

const HEX = "0123456789abcdef";

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  const b = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < b.length; i++) out += HEX[b[i] >> 4] + HEX[b[i] & 15];
  return out;
}

/** Comparação em tempo constante, para o hash não vazar por timing. */
function sameHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function textResponse(body, status) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": NOINDEX,
      "cache-control": NO_CACHE,
    },
  });
}

const notFound = () => textResponse("Not found", 404);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { allow: "GET, HEAD", "x-robots-tag": NOINDEX },
      });
    }

    if (path === "/robots.txt") {
      return textResponse(ROBOTS, 200);
    }

    const expected = (env.ACCESS_TOKEN_SHA256 || "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(expected)) {
      /* Só acontece se alguém apagar ou estragar a linha do wrangler.toml.
         404 aqui faria parecer token errado, e a pessoa iria caçar o token
         quando o problema é outro. Não vaza nada: é um hash que falta. */
      console.error("ACCESS_TOKEN_SHA256 ausente ou inválido em wrangler.toml.");
      return textResponse(
        "ACCESS_TOKEN_SHA256 ausente ou invalido em wrangler.toml.\n" +
          "Rode: npm run turma\n",
        503
      );
    }

    // Aceita /acesso/<token> e /acesso/<token>/ e nada mais.
    if (path.startsWith(PREFIX)) {
      const rest = path.slice(PREFIX.length).replace(/\/$/, "");
      // Limite defensivo: não gastar hash com caminho absurdo.
      if (rest.length > 0 && rest.length <= 200 && !rest.includes("/")) {
        if (sameHex(await sha256Hex(rest), expected)) {
          return new Response(PAGE, {
            headers: {
              "content-type": "text/html; charset=utf-8",
              "x-robots-tag": NOINDEX,
              "cache-control": NO_CACHE,
              // Impede o token vazar no Referer ao clicar no botão do WhatsApp.
              "referrer-policy": "no-referrer",
              "x-content-type-options": "nosniff",
            },
          });
        }
      }
    }

    return notFound();
  },
};
