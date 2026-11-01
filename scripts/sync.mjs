// Robô diário: entra no minhavisita, baixa os check-ins, cruza com a carteira ABC
// e grava os dados criptografados em _site/data.enc para o app.
//
// Variáveis de ambiente (GitHub → Settings → Secrets and variables → Actions):
//   MV_EMAIL, MV_SENHA   login da Patrice no minhavisita
//   APP_KEY              chave do app (32 bytes em base64url)
// Opcionais:
//   MV_API_KEY           chave pública do portal (por padrão é lida do próprio portal)
//   DESDE                data inicial do histórico (padrão 2024-01-01)
//
// IMPORTANTE: o repositório é público e os logs do Actions também.
// Nunca imprima nomes de médicos, observações ou credenciais aqui.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { keyFromBase64url, encryptJson, decryptJson } from './crypto.mjs';
import { montarDados } from './build.mjs';

const PORTAL = 'https://minhavisita.com.br/portal/';
const LOGIN_URL = 'https://minhavisita.com.br/admin/api_public/lastest/login';
const GRAPHQL_URL = 'https://mvapi.minhavisita.com.br/graphql';
const VERSAO = '4.1.3';
const PAGINA = 500;

const QUERY = `query findChecks($deviceCheckDate: DateRange, $active: Boolean, $pagination: PaginationInput, $ordination: CheckOrdination) {
  findCheck(deviceCheckDate: $deviceCheckDate, active: $active, pagination: $pagination, ordination: $ordination) {
    id deviceCheckinDate activity { name } customer { id name address latitude longitude }
  }
}`;

function exigir(nome) {
  const v = process.env[nome];
  if (!v) throw new Error(`Falta o segredo ${nome} nas configurações do repositório.`);
  return v;
}

async function lerApiKey() {
  if (process.env.MV_API_KEY) return process.env.MV_API_KEY;
  const html = await (await fetch(PORTAL)).text();
  const scripts = [...html.matchAll(/<script[^>]*\bsrc=["']?([^"' >]+\.js)/g)]
    .map((m) => new URL(m[1], PORTAL).href)
    .sort((a, b) => /\/app\./.test(b) - /\/app\./.test(a)); // app.*.js primeiro
  for (const src of scripts) {
    const js = await (await fetch(src)).text();
    const m = js.match(/["']api-key["']\s*:\s*["']([^"']+)["']/);
    if (m) return m[1];
  }
  throw new Error('Não encontrei a api-key no portal do minhavisita. O portal pode ter mudado.');
}

async function login(apiKey) {
  const r = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      email: exigir('MV_EMAIL'),
      senha: exigir('MV_SENHA'),
      version_app: VERSAO,
      version_os: '',
      platform: 'web',
    }),
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok || corpo.status !== 200 || !corpo.dados) {
    throw new Error(`Login recusado pelo minhavisita (HTTP ${r.status}). Confira MV_EMAIL e MV_SENHA.`);
  }
  const d = corpo.dados;
  if (d.mfa) throw new Error('O minhavisita pediu verificação em duas etapas (MFA). O robô não consegue passar por ela.');
  if (!d.access_key || !d.id_usuario) throw new Error('Resposta de login sem access_key/id_usuario. O portal pode ter mudado.');
  return { accessKey: d.access_key, userId: String(d.id_usuario) };
}

async function baixarChecks(apiKey, sessao) {
  const [maj, min, pat] = VERSAO.split('.');
  const headers = {
    Accept: 'application/json', 'Content-Type': 'application/json',
    'api-key': apiKey, 'user-id': sessao.userId, 'access-key': sessao.accessKey,
    'X-Frontend-Version-Major': maj, 'X-Frontend-Version-Minor': min, 'X-Frontend-Version-Patch': pat,
  };
  const desde = (process.env.DESDE || '2024-01-01') + ' 00:00:00';
  const ate = new Date(Date.now() + 864e5).toISOString().slice(0, 10) + ' 23:59:59';
  const todos = [];
  for (let page = 1; page <= 100; page++) {
    const r = await fetch(GRAPHQL_URL, {
      method: 'POST', headers,
      body: JSON.stringify({
        query: QUERY,
        variables: {
          ordination: { field: 'CREATED_AT', direction: 'DESC' },
          deviceCheckDate: { gte: desde, lte: ate },
          active: true,
          pagination: { page, pageSize: PAGINA },
        },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.errors) throw new Error(`Erro ao buscar check-ins (HTTP ${r.status}, página ${page}).`);
    const lote = j.data.findCheck || [];
    todos.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return todos;
}

async function main() {
  const key = await keyFromBase64url(exigir('APP_KEY'));
  const carteira = await decryptJson(key, await readFile(new URL('../data/carteira.enc', import.meta.url), 'utf8'));
  const apiKey = await lerApiKey();
  const sessao = await login(apiKey);
  const checks = await baixarChecks(apiKey, sessao);
  const dados = montarDados(carteira, checks);
  await mkdir('_site', { recursive: true });
  await writeFile('_site/data.enc', await encryptJson(key, dados));
  const achados = dados.medicos.filter((m) => m.u).length;
  console.log(`OK: ${checks.length} check-ins, ${achados}/${dados.medicos.length} médicos da carteira com visita registrada.`);
}

main().catch((e) => {
  console.error('Falha no robô:', e.message);
  process.exit(1);
});
