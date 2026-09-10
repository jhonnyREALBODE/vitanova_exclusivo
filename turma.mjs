#!/usr/bin/env node
/**
 * Abre uma turma nova: gera um token, grava o hash dele no wrangler.toml e
 * imprime a URL para o e-mail de entrega.
 *
 * O token aparece uma vez, aqui na tela. Ele não é gravado em lugar nenhum —
 * nem no repositório, nem no Cloudflare. Copie antes de fechar o terminal.
 *
 *   node turma.mjs                 gera token novo
 *   node turma.mjs --link <url>    troca também o convite do WhatsApp
 */

import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const TOML = join(ROOT, "wrangler.toml");
const PAGE = join(ROOT, "page", "index.html");

// Sem vogais nem caracteres ambíguos: o token vai por e-mail e pode ser lido
// em voz alta ou digitado à mão sem confundir 0/O, 1/l, i/j.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const LENGTH = 26; // ~128 bits

function novoToken() {
  let s = "";
  // rejeita bytes na cauda irregular, senão as primeiras letras saem mais prováveis
  const limite = 256 - (256 % ALPHABET.length);
  while (s.length < LENGTH) {
    for (const b of randomBytes(LENGTH)) {
      if (b >= limite) continue;
      s += ALPHABET[b % ALPHABET.length];
      if (s.length === LENGTH) break;
    }
  }
  return s;
}

const args = process.argv.slice(2);
const linkIdx = args.indexOf("--link");
const novoLink = linkIdx !== -1 ? args[linkIdx + 1] : null;

if (linkIdx !== -1 && !novoLink) {
  console.error("Faltou a URL depois de --link.");
  process.exit(1);
}
if (novoLink && !/^https:\/\/chat\.whatsapp\.com\//.test(novoLink)) {
  console.error(`Isso nao parece um convite de grupo do WhatsApp:\n  ${novoLink}`);
  process.exit(1);
}

// ---- token + hash ----
const token = novoToken();
const hash = createHash("sha256").update(token).digest("hex");

const toml = readFileSync(TOML, "utf8");
const linha = /^ACCESS_TOKEN_SHA256\s*=\s*".*"$/m;
if (!linha.test(toml)) {
  console.error("Nao achei a linha ACCESS_TOKEN_SHA256 no wrangler.toml.");
  process.exit(1);
}
writeFileSync(TOML, toml.replace(linha, `ACCESS_TOKEN_SHA256 = "${hash}"`));

// ---- link do grupo, se pedido ----
let linkAtual = null;
const html = readFileSync(PAGE, "utf8");
const btn = /(<a class="cta[^"]*"[^>]*href=")([^"]+)(")/;
const m = html.match(btn);
if (m) linkAtual = m[2].replace(/&amp;/g, "&");

if (novoLink) {
  if (!m) {
    console.error("Nao achei o botao do grupo em page/index.html.");
    process.exit(1);
  }
  const escapado = novoLink.replace(/&/g, "&amp;");
  writeFileSync(PAGE, html.replace(btn, `$1${escapado}$3`));
  linkAtual = novoLink;
}

// ---- resultado ----
const w = "─".repeat(72);
console.log(`\n${w}`);
console.log("  TURMA NOVA");
console.log(w);
console.log("\n  Caminho (cole no e-mail de entrega da Cakto):\n");
console.log(`    /acesso/${token}\n`);
console.log("  URL completa, trocando pelo seu dominio:\n");
console.log(`    https://vitanova-acesso.<subdominio>.workers.dev/acesso/${token}\n`);
console.log(`  Grupo: ${linkAtual ?? "(nao encontrado)"}`);
if (!novoLink) console.log("         (para trocar: node turma.mjs --link <convite>)");
console.log(`\n${w}`);
console.log("  O token acima aparece uma vez so. Copie agora.");
console.log("  Depois:  git commit -am \"turma nova\" && git push");
console.log("  O Cloudflare faz o deploy sozinho. Nada a fazer no dashboard.");
console.log(`${w}\n`);
