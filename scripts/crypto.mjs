// Criptografia AES-256-GCM compatível com o app (WebCrypto no navegador).
// Formato do arquivo: JSON { v: 1, iv: base64, ct: base64 }.
import { webcrypto as crypto } from 'node:crypto';

export function keyFromBase64url(b64url) {
  const raw = Buffer.from(b64url.trim(), 'base64url');
  if (raw.length !== 32) throw new Error('APP_KEY inválida: precisa ter 32 bytes (base64url).');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptJson(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  return JSON.stringify({ v: 1, iv: Buffer.from(iv).toString('base64'), ct: Buffer.from(ct).toString('base64') });
}

export async function decryptJson(key, text) {
  const { iv, ct } = JSON.parse(text);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Buffer.from(iv, 'base64') }, key, Buffer.from(ct, 'base64'));
  return JSON.parse(new TextDecoder().decode(pt));
}
