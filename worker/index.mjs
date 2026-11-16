import {readRound,createStoredRound,updateStoredRound} from './store.mjs';
import assets from './assets.generated.mjs';
import {createRound,revealTile,BASE_REWARD,SAFE_COUNT} from '../public/game-engine.mjs';
import {seal,unseal,fromBase64} from './vault.mjs';
import {importIdentity,createPass} from './pass.mjs';
import {adminPage} from './admin.mjs';
import {boundedBody,jsonBody,rateLimit,secureResponse,HttpError} from './security.mjs';
const CONFIG='private/wallet-identity-v1';
const te=new TextEncoder();
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
const cookie=(req)=>req.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-amplyfy-round=([a-f0-9-]{36}\.[a-f0-9]{64})/)?.[1];
const owner=(req,env)=>!!env.WALLET_OWNER_EMAIL&&req.headers.get('oai-authenticated-user-email')?.toLowerCase()===env.WALLET_OWNER_EMAIL.toLowerCase();
const safeState=r=>({id:r.id,gems:r.gems,amount:r.amount,ended:r.ended,cleared:r.cleared,claimed:r.claimed||false,revealed:r.revealed.map(i=>({index:i,mine:r.mines.includes(i)}))});
async function hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('')}
async function current(req,env){const value=cookie(req);if(!value)return null;const [id,secret]=value.split('.');const state=await readRound(env,id);if(!state||state.r.secretHash!==await hash(secret))return null;return state}
function bytes(path){const a=assets[path];if(!a)throw new Error('Missing pass asset');return fromBase64(a.data)}
const intermediate=()=>new TextDecoder().decode(bytes('/wallet/wwdr.pem'));
async function identity(env){const obj=await env.BUCKET.get(CONFIG);return obj?unseal(await obj.text(),env.WALLET_VAULT_KEY):null}
function passResponse(value,name){return new Response(value,{headers:{'content-type':'application/vnd.apple.pkpass','content-disposition':'attachment; filename="'+name+'.pkpass"','cache-control':'private, no-store','x-content-type-options':'nosniff'}})}
function signedPass(id,round,origin){return createPass({identity:id,intermediatePem:intermediate(),round,origin,images:{'icon.png':bytes('/wallet/icon.png'),'icon@2x.png':bytes('/wallet/icon@2x.png'),'icon@3x.png':bytes('/wallet/icon@3x.png')}})}
async function handle(req,env){try{
 const url=new URL(req.url),path=url.pathname;
 if(req.method==='POST'&&req.headers.get('Origin')!==url.origin)return json({error:'This request must come from the same site.'},403);
 const isAdmin=path==='/admin/wallet'||path.startsWith('/api/admin/');
 if(isAdmin&&!owner(req,env))return new Response('This setup page is available only to the site owner. Sign in with the ChatGPT account that owns this site.',{status:403,headers:{'cache-control':'no-store'}});
 if(path.startsWith('/api/'))await rateLimit(req,env,'api',5000);
 if(path==='/api/wallet/pass.pkpass')await rateLimit(req,env,'wallet',1200);
 if(isAdmin&&req.method==='POST')await rateLimit(req,env,'admin',5);
 if(path==='/admin/wallet'&&req.method==='GET') {const nonce=crypto.randomUUID();return new Response(adminPage(nonce),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':`default-src 'self'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,'referrer-policy':'no-referrer','x-content-type-options':'nosniff'}})}
 if(path==='/api/admin/wallet'&&req.method==='GET'){const id=await identity(env);return json({ready:!!id,expires:id?.expires||null})}
 if(path==='/api/admin/wallet'&&req.method==='POST'){
  if(Number(req.headers.get('content-length')||0)>100000)return json({error:'Please upload a .p12 smaller than 64 KB.'},413);
  const payload=await boundedBody(req,100000);const form=await new Response(payload,{headers:{'content-type':req.headers.get('content-type')||''}}).formData();const file=form.get('identity'),password=form.get('password');
  if(!file||typeof file==='string'||file.size>65536||typeof password!=='string'||password.length>1024)return json({error:'Choose your .p12 file and enter its export password.'},400);
  let id;try{id=importIdentity(new Uint8Array(await file.arrayBuffer()),password,intermediate())}catch(error){return json({error:error.message},400)}
  await env.BUCKET.put(CONFIG,await seal(id,env.WALLET_VAULT_KEY),{httpMetadata:{contentType:'application/json'}});return json({ready:true,expires:id.expires});
 }
 if(path==='/api/admin/wallet/test.pkpass'&&req.method==='GET'){const id=await identity(env);if(!id)return json({error:'Connect your signing file first.'},503);return passResponse(signedPass(id,{id:'OWNER-TEST',amount:50},url.origin),'AMPLYFY-TEST')}
 if(path==='/api/wallet/status'&&req.method==='GET'){return json({ready:!!await env.BUCKET.head(CONFIG)})}
 if(path==='/api/game/round'&&req.method==='GET'){const state=await current(req,env);return state?json(safeState(state.r)):json({error:'Start a new round.'},404)}
 if(path==='/api/game/round'&&req.method==='POST'){
  const options=await jsonBody(req);const existing=await current(req,env);if(existing&&(!options.newRound||!existing.r.ended))return json(safeState(existing.r));
  if(existing&&Date.now()-Date.parse(existing.r.created)<20*60*1000)return json({...safeState(existing.r),notice:'Your reward is saved. You can play again in 20 minutes.'});
  await rateLimit(req,env,'start',120);
  const game=createRound(),id=crypto.randomUUID(),secret=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('');
  const r={id,secretHash:await hash(secret),mines:[...game.mines],revealed:[],gems:0,amount:BASE_REWARD,ended:false,cleared:false,claimed:false,created:new Date().toISOString()};await createStoredRound(env,r);
  return json(safeState(r),200,{'set-cookie':'__Host-amplyfy-round='+id+'.'+secret+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000'});
 }
 if((path==='/api/game/reveal'||path==='/api/game/claim')&&req.method==='POST'){
  const state=await current(req,env);if(!state)return json({error:'Start a new round first.'},404);let {r,version}=state;await rateLimit(req,env,'session',180,60,r.id);
  if(path.endsWith('/claim')){await jsonBody(req);if(!r.claimed){r.claimed=true;r.ended=true;if(!await updateStoredRound(env,r,version))return json({error:'Your round changed. Please try again.'},409)}return json(safeState(r));}
  const body=await jsonBody(req);if(r.claimed||r.ended)return json({error:'This round has ended.',state:safeState(r)},409);
  const game={...r,mines:new Set(r.mines),revealed:new Set(r.revealed)};const result=revealTile(game,body.index);if(!result)return json({error:'Choose an unopened tile.'},400);
  r={...r,gems:game.gems,amount:game.amount,ended:game.ended,cleared:game.cleared,revealed:[...game.revealed]};if(!await updateStoredRound(env,r,version))return json({error:'Another tile is being revealed. Try again.'},409);return json({...safeState(r),result,index:body.index});
 }
 if(path==='/api/wallet/pass.pkpass'&&req.method==='GET'){
  const state=await current(req,env);if(!state?.r.claimed)return json({error:'Claim your game reward before adding it to Wallet.'},403);
  await rateLimit(req,env,'session-wallet',12,60,state.r.id);
  const cacheKey='passes/'+state.r.id+'.pkpass';const cached=await env.BUCKET.get(cacheKey);if(cached)return passResponse(await cached.arrayBuffer(),'AMPLYFY-'+state.r.id.slice(0,8));
  const id=await identity(env);if(!id)return json({error:'Apple Wallet setup is almost ready. Please try again later.'},503);
  const pass=signedPass(id,state.r,url.origin);await env.BUCKET.put(cacheKey,pass,{onlyIf:new Headers({'If-None-Match':'*'}),httpMetadata:{contentType:'application/vnd.apple.pkpass'}});
  return passResponse(pass,'AMPLYFY-'+state.r.id.slice(0,8));
 }
 if(path.startsWith('/api/'))return json({error:'Not found'},404);
 if(req.method!=='GET'&&req.method!=='HEAD')return new Response('Method not allowed',{status:405});
 const a=assets[path==='/'?'/index.html':path];if(!a||path.startsWith('/wallet/'))return new Response('Not found',{status:404});
 return new Response(req.method==='HEAD'?null:fromBase64(a.data),{headers:{'content-type':a.type,'cache-control':path.endsWith('.png')?'public, max-age=86400':'no-cache','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'}});
 }catch(error){if(error instanceof HttpError)return json({error:error.message},error.status,error.status===429?{'retry-after':'60'}:{});console.error('Wallet request failed',error?.name||'Error');return json({error:'This request could not be completed. Please try again.'},500)}}
export default {async fetch(req,env){return secureResponse(await handle(req,env))}};
