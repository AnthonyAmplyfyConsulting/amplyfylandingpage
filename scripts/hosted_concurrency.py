import json,sys,termios,urllib.request,urllib.error,http.cookiejar,time,concurrent.futures,statistics
settings=termios.tcgetattr(sys.stdin);settings[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin,termios.TCSANOW,settings)
print('Ready for bounded hosted verification',flush=True)
c=json.loads(input());base=c['url'];headers={'OAI-Sites-Authorization':'Bearer '+c['token']};latencies=[]
def visitor(n):
 jar=http.cookiejar.CookieJar();opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
 def req(path,body=None):
  h=dict(headers);data=None
  if body is not None:h.update({'content-type':'application/json','Origin':base});data=json.dumps(body).encode()
  start=time.monotonic()
  try:
   with opener.open(urllib.request.Request(base+path,data=data,headers=h),timeout=45) as r:status=r.status;raw=r.read();rh=r.headers
  except urllib.error.HTTPError as e:status=e.code;raw=e.read();rh=e.headers
  latencies.append((time.monotonic()-start)*1000)
  return status,json.loads(raw) if 'application/json' in rh.get('content-type','') else raw,rh
 s,r,h=req('/api/game/round',{});assert s==200,(s,r);rid=r['id'];assert 'mines'not in r and 'secretHash'not in r
 s,reveal,_=req('/api/game/reveal',{'index':n%16});assert s==200,(s,reveal)
 s,claim,_=req('/api/game/claim',{'amount':500000});assert s==200,(s,claim);assert claim['id']==rid and claim['amount']==reveal['amount'] and claim['claimed']
 s,final,_=req('/api/game/round');assert s==200 and final['id']==rid and final['amount']==claim['amount']
 assert h.get('content-security-policy') and 'HttpOnly'in h.get('set-cookie','')
 return rid
start=time.monotonic()
with concurrent.futures.ThreadPoolExecutor(max_workers=30) as pool:ids=list(pool.map(visitor,range(30)))
assert len(set(ids))==30
sortedlat=sorted(latencies)
print(json.dumps({'visitors':30,'concurrency':30,'requests':len(latencies),'unique_rounds':len(set(ids)),'errors':0,'elapsed_seconds':round(time.monotonic()-start,2),'request_p50_ms':round(statistics.median(latencies)),'request_p95_ms':round(sortedlat[int(len(sortedlat)*.95)-1]),'scope':'Hosted Sites routing + D1 game APIs; no bookings or Wallet signatures.'}),flush=True)
