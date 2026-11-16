import {consumeLimit} from './store.mjs';
const encoder=new TextEncoder();
export class HttpError extends Error {constructor(status,message){super(message);this.status=status}}
export async function boundedBody(req,max){
 if(Number(req.headers.get('content-length')||0)>max)throw new HttpError(413,'Request too large.');
 const reader=req.body?.getReader();if(!reader)return new Uint8Array();let size=0;const chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new HttpError(413,'Request too large.')}chunks.push(value)}
 const out=new Uint8Array(size);let i=0;for(const part of chunks){out.set(part,i);i+=part.length}return out;
}
export async function jsonBody(req){if(!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||''))throw new HttpError(415,'Send JSON data.');try{const value=JSON.parse(new TextDecoder().decode(await boundedBody(req,2048)));if(!value||Array.isArray(value)||typeof value!=='object')throw new Error();return value}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'Invalid request data.')}}
export async function rateLimit(req,env,group,limit,seconds=60,sessionId){
 const ip=sessionId||req.headers.get('cf-connecting-ip');if(!ip)return; // Only trust the platform-supplied address, never forwarded client headers.
 const window=Math.floor(Date.now()/1000/seconds);
 const digest=await crypto.subtle.digest('SHA-256',encoder.encode(env.WALLET_VAULT_KEY+'|'+ip));
 const key='limits/'+group+'/'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
 if(!await consumeLimit(env,key,window,limit))throw new HttpError(429,'Too many requests. Please wait a minute and try again.');
}
export function secureResponse(response){const h=new Headers(response.headers);h.set('x-content-type-options','nosniff');h.set('referrer-policy','strict-origin-when-cross-origin');h.set('permissions-policy','camera=(), microphone=(), geolocation=()');h.set('strict-transport-security','max-age=31536000');if(!h.has('content-security-policy'))h.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-src https://calendar.google.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com");return new Response(response.body,{status:response.status,headers:h})}
