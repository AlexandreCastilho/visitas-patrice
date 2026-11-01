// Uso: APP_KEY=... node scripts/encrypt-carteira.mjs carteira.json
// Gera data/carteira.enc a partir de um JSON [{grupo,posicao,nome,total,mesesAtivos}].
// Rode de novo sempre que a carteira ABC for atualizada.
import { readFile, writeFile } from 'node:fs/promises';
import { keyFromBase64url, encryptJson } from './crypto.mjs';
const key = await keyFromBase64url(process.env.APP_KEY || '');
const carteira = JSON.parse(await readFile(process.argv[2], 'utf8'));
await writeFile(new URL('../data/carteira.enc', import.meta.url), await encryptJson(key, carteira));
console.log(`carteira.enc gerado com ${carteira.length} médicos.`);
