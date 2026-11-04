import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const expectedFiles = new Set([
  '.github/workflows/pages.yml',
  '.nojekyll',
  'CNAME',
  'README.md',
  'index.html',
  'smoke.mjs',
]);

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = resolve(directory, entry.name);
    if (lstatSync(fullPath).isSymbolicLink()) throw new Error('RULE-TREE-SYMLINK');
    return entry.isDirectory() ? filesUnder(fullPath) : [relative(root, fullPath).replaceAll('\\', '/')];
  });
}

const actualFiles = filesUnder(root).filter((file) => !file.startsWith('.git/'));
for (const file of actualFiles) {
  if (!expectedFiles.has(file)) throw new Error(`RULE-TREE-UNEXPECTED: ${file}`);
}
for (const file of expectedFiles) {
  const fullPath = resolve(root, file);
  if (!existsSync(fullPath) || !statSync(fullPath).isFile()) throw new Error(`RULE-TREE-MISSING: ${file}`);
  if (statSync(fullPath).size > 100_000) throw new Error(`RULE-SIZE: ${file}`);
}

const html = readFileSync(resolve(root, 'index.html'), 'utf8');
for (const value of [
  '<html lang="en">',
  '<title>Codicent CRM AI',
  'The customer card that keeps the deal moving.',
  'What you get',
  'Activities and follow-up',
  'Quotations, service and documents',
  'AI support in the right context',
  'mailto:info@codicent.com',
]) {
  if (!html.includes(value)) throw new Error('RULE-CONTENT-REQUIRED');
}

const publishedFiles = actualFiles.filter((file) => file !== 'smoke.mjs');
const rules = [
  ['RULE-PRIVATE-MARKER', /#(?:data|crmjson|offertjson|customer2)\b/i],
  ['RULE-TECHNICAL-COPY', /\b(?:mcp|api|endpoint|tenant|docker|database|server|dynamics|salesforce|infor)\b/i],
  ['RULE-PRIVATE-FILE', /(?:\.env(?:\.[a-z0-9_-]+)?|dockerfile|compose\.ya?ml|credentials?\.json)/i],
  ['RULE-SECRET-ASSIGNMENT', /(?:client[_-]?secret|api[_-]?key|password|authorization)\s*[=:]/i],
  ['RULE-TOKEN-SHAPE', /(?:github_pat_|ghp_|sk-)[a-z0-9_-]{12,}/i],
  ['RULE-JWT-SHAPE', /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\b/],
  ['RULE-PRIVATE-KEY', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i],
  ['RULE-PRIVATE-ADDRESS', /\b(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)\b/i],
  ['RULE-UNIQUE-ID', /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i],
  ['RULE-REMOTE-URL', /https?:\/\/(?!crm\.codicent\.ai\/?(?:["'\s<]|$))/i],
];
const copyRules = [
  ['RULE-UNVERIFIED-METRIC', /\b\d+(?:[.,]\d+)?\s*(?:%|x|×)(?=\s|[.,;:!?<]|$)/i],
  ['RULE-UNVERIFIED-ABSOLUTE', /\b(?:garanterad|alltid|aldrig|automatiskt|realtid|gdpr|krypterad|guaranteed|always|never|automatically|real-?time|encrypted)\b/i],
];
for (const file of publishedFiles) {
  const text = readFileSync(resolve(root, file), 'utf8').normalize('NFKC');
  for (const [rule, pattern] of rules) {
    if (pattern.test(text)) throw new Error(`${rule}: ${file}`);
  }
  if (file === 'index.html' || file === 'README.md') {
    const copy = file === 'index.html' ? text.replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ') : text;
    for (const [rule, pattern] of copyRules) {
      if (pattern.test(copy)) throw new Error(`${rule}: ${file}`);
    }
  }
}

if ((html.match(/<h1\b/g) ?? []).length !== 1) throw new Error('RULE-HTML-H1');
if (/<script\b/i.test(html)) throw new Error('RULE-HTML-SCRIPT');
if (/<(?:form|input|textarea|iframe)\b/i.test(html)) throw new Error('RULE-HTML-ACTIVE');
if (/<link\b[^>]*rel=["']stylesheet["']/i.test(html)) throw new Error('RULE-HTML-REMOTE-STYLE');

console.log('CRM AI public-site safeguards passed');
