/**
 * Vita Nova — página de acesso da turma paga.
 *
 * A página é estática e não tem como validar compra. A proteção é o caminho
 * ser secreto: só /acesso/<token> responde 200, e o token vive num secret do
 * Cloudflare (ACCESS_TOKEN), nunca no repositório — este repo é público.
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

/** Comparação em tempo constante, para o token não vazar por timing. */
function tokenMatches(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": NOINDEX,
      "cache-control": NO_CACHE,
    },
  });
}

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
      return new Response(ROBOTS, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "x-robots-tag": NOINDEX,
          "cache-control": NO_CACHE,
        },
      });
    }

    const token = env.ACCESS_TOKEN;
    if (!token) {
      // Secret não configurado: não serve a página, e diz por quê no log.
      console.error("ACCESS_TOKEN não configurado — nenhuma página será servida.");
      return notFound();
    }

    // Aceita /acesso/<token> e /acesso/<token>/ e nada mais.
    if (path.startsWith(PREFIX)) {
      const rest = path.slice(PREFIX.length).replace(/\/$/, "");
      if (tokenMatches(rest, token)) {
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

    return notFound();
  },
};
