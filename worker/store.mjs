// D1 owns mutable game state. R2 retains encrypted signing credentials and issued files.
export async function readRound(env,id){
 let record=await env.DB.prepare('SELECT state, version FROM game_rounds WHERE id = ?').bind(id).first();
 if(!record){
  // Lazy, create-only migration preserves coupons earned before the D1 rollout.
  const legacy=await env.BUCKET.get('rounds/'+id);
  if(legacy){const state=await legacy.text();await env.DB.prepare('INSERT INTO game_rounds (id,state,version) VALUES (?,?,0) ON CONFLICT(id) DO NOTHING').bind(id,state).run();record=await env.DB.prepare('SELECT state, version FROM game_rounds WHERE id = ?').bind(id).first()}
 }
 return record?{r:JSON.parse(record.state),version:record.version}:null;
}
export async function createStoredRound(env,r){await env.DB.prepare('INSERT INTO game_rounds (id,state,version) VALUES (?,?,0)').bind(r.id,JSON.stringify(r)).run()}
export async function updateStoredRound(env,r,version){const result=await env.DB.prepare('UPDATE game_rounds SET state = ?, version = version + 1 WHERE id = ? AND version = ?').bind(JSON.stringify(r),r.id,version).run();return result.meta.changes===1}
export async function consumeLimit(env,key,window,limit){
 const result=await env.DB.prepare(`INSERT INTO request_limits (key,window,count) VALUES (?,?,1)
 ON CONFLICT(key) DO UPDATE SET window=excluded.window, count=CASE WHEN request_limits.window=excluded.window THEN request_limits.count+1 ELSE 1 END
 WHERE request_limits.window != excluded.window OR request_limits.count < ? RETURNING count`).bind(key,window,limit).first();return !!result;
}
