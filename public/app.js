import {amountFor,BASE_REWARD,SAFE_COUNT} from './game-engine.mjs';
const $=s=>document.querySelector(s),board=$('.board');
const gemIcon='<svg aria-hidden="true"><use href="#gem"/></svg>',mineIcon='<svg aria-hidden="true"><use href="#mine"/></svg>';
let round,busy=false;
async function api(path,body){const r=await fetch(path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Please try again.');return d;}
function renderScore(){
 $('#multiplier').textContent=(round.amount/BASE_REWARD).toFixed(2)+'×';$('#reward-value').textContent='$'+round.amount;
 $('#next-value').textContent=round.ended?(round.cleared?'Maximum reward unlocked':'Your reward is safe'):'Next gem: $'+amountFor(round.gems+1);
 $('#gem-count').textContent=round.gems+' / '+SAFE_COUNT+' gems';
 $('#game-status').textContent=round.cleared?'All gems found! $500 off setup is yours.':round.claimed?'Your reward is ready to save.':round.ended?'You hit a mine. Your $'+round.amount+' reward is still yours.':round.gems?'Great find. Keep going or claim your reward.':'Every player wins. Tap a tile to begin.';
 $('#claim').disabled=busy;
 board.querySelectorAll('button').forEach((b,i)=>b.disabled=busy||round.ended||round.revealed.some(x=>x.index===i));
}
function revealVisual(button,mine){button.classList.add('revealed',mine?'mine':'gem-found');button.innerHTML=mine?mineIcon:'<span class="gem-animation">'+gemIcon+'</span><span class="gem-sparkles" aria-hidden="true">✦</span>';button.setAttribute('aria-label',mine?'Mine revealed':'Gem revealed');}
async function reset(fresh=false){busy=true;$('#claim').disabled=true;$('#game-status').textContent='Getting your game ready…';board.innerHTML='';try{
 round=await api('/api/game/round',{newRound:fresh});board.classList.remove('board-won','board-ended');$('.game-shell').classList.remove('jackpot');
 for(let i=0;i<16;i++){const b=document.createElement('button');b.className='tile';b.setAttribute('aria-label','Reveal tile '+(i+1));b.onclick=()=>reveal(b,i);board.append(b);const old=round.revealed.find(x=>x.index===i);if(old)revealVisual(b,old.mine);}
 $('#claim').innerHTML='<span>Claim reward</span>';$('#reset').hidden=true;busy=false;renderScore();return true;
 }catch(error){busy=false;$('#game-status').textContent=error.message+' Refresh to try again.';return false;}}
async function reveal(button,index){if(busy||round.ended||button.disabled)return;busy=true;renderScore();try{const state=await api('/api/game/reveal',{index});round=state;revealVisual(button,state.result==='mine');if(round.ended){board.classList.add(round.cleared?'board-won':'board-ended');if(round.cleared)$('.game-shell').classList.add('jackpot');}$('#reward-value').classList.remove('reward-bump');requestAnimationFrame(()=>$('#reward-value').classList.add('reward-bump'));}catch(error){$('#game-status').textContent=error.message;busy=false;$('#claim').disabled=false;board.querySelectorAll('button').forEach((b,i)=>b.disabled=round.ended||round.revealed.some(x=>x.index===i));return;}busy=false;renderScore();}
function page(which){$('#play-page').hidden=which!=='play';$('#reward-page').hidden=which!=='reward';window.scrollTo({top:0,behavior:'instant'});document.title=which==='reward'?'Your reward | AMPLYFY':'AMPLYFY | Turn visits into repeat business';}
function showCoupon(){$('#coupon-amount').textContent=round.amount;$('#coupon-earned').textContent=round.amount===500?'ALL GEMS FOUND · MAXIMUM REWARD':'YOUR GUARANTEED REWARD';}
async function claim(){if(busy||!round)return;busy=true;$('#claim').disabled=true;try{round=await api('/api/game/claim',{});showCoupon();page('reward');history.pushState({page:'reward'},'','#reward');}catch(error){$('#game-status').textContent=error.message;}finally{busy=false;$('#claim').disabled=false;}}
$('#claim').onclick=claim;$('#reset').onclick=()=>reset(true);
$('#back').onclick=$('#play-again').onclick=async()=>{page('play');history.replaceState({},'',location.pathname);await reset(true);};
window.onpopstate=()=>{if(location.hash==='#meeting')return;if(location.hash==='#reward'&&round?.claimed){showCoupon();page('reward');}else page('play');};
$('#wallet').onclick=async()=>{const button=$('#wallet');button.disabled=true;$('#wallet-note').textContent='Preparing your Apple Wallet pass…';try{const status=await api('/api/wallet/status');if(!status.ready)throw new Error('Apple Wallet is being connected. Please try again shortly.');window.location.assign('/api/wallet/pass.pkpass');$('#wallet-note').textContent='Open the downloaded pass on your iPhone and tap Add.';}catch(error){$('#wallet-note').textContent=error.message;}finally{button.disabled=false;}};
(async()=>{const requested=location.hash;if(await reset()){if(['#reward','#meeting'].includes(requested)&&round.claimed){showCoupon();page('reward');if(requested==='#meeting')$('#meeting').scrollIntoView();}else if(['#reward','#meeting'].includes(requested)){page('play');history.replaceState({},'',location.pathname);}}})();
