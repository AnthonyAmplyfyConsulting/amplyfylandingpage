const te=new TextEncoder();
export function toBase64(bytes){let out='';for(const b of bytes)out+=String.fromCharCode(b);return btoa(out)}
export function fromBase64(value){return Uint8Array.from(atob(value),c=>c.charCodeAt(0))}
async function key(secret){if(!secret)throw new Error('Wallet storage is not configured.');return crypto.subtle.importKey('raw',fromBase64(secret),{name:'AES-GCM'},false,['encrypt','decrypt'])}
export async function seal(value,secret){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:te.encode('AMPLYFY-WALLET-v1')},await key(secret),te.encode(JSON.stringify(value)));return JSON.stringify({version:1,iv:toBase64(iv),data:toBase64(new Uint8Array(encrypted))})}
export async function unseal(value,secret){const box=JSON.parse(value);const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(box.iv),additionalData:te.encode('AMPLYFY-WALLET-v1')},await key(secret),fromBase64(box.data));return JSON.parse(new TextDecoder().decode(bytes))}
