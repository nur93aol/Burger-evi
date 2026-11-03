const J=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
const day=(o=0)=>new Date(Date.now()+3*36e5-o*864e5).toISOString().slice(0,10);
const txt=(v,n)=>String(v??"").slice(0,n),num=v=>Math.max(0,Number(v)||0);
const clean=b=>({categories:(Array.isArray(b.categories)?b.categories:[]).slice(0,20).map(c=>({name:txt(c.name,60),items:(Array.isArray(c.items)?c.items:[]).slice(0,100).map(i=>({id:txt(i.id,20).replace(/[^\w-]/g,""),name:txt(i.name,80),desc:txt(i.desc,300),price:num(i.price),img:i.img==="b"||i.img==="c"?i.img:"",drink:!!i.drink,soldOut:!!i.soldOut,photo:/^[\w-]{8,64}$/.test(i.photo||"")?i.photo:""}))})),popular:(Array.isArray(b.popular)?b.popular:[]).slice(0,12).map(x=>txt(x,20))});
let ready;
const init=async DB=>{ready??=DB.batch([DB.prepare("CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY,v TEXT)"),DB.prepare("CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,t TEXT,day TEXT,d TEXT)"),DB.prepare("CREATE TABLE IF NOT EXISTS photos(id TEXT PRIMARY KEY,b TEXT)"),DB.prepare("CREATE TABLE IF NOT EXISTS fails(ip TEXT,t INTEGER,k INTEGER)"),DB.prepare("CREATE INDEX IF NOT EXISTS fails_ip ON fails(ip,t)"),DB.prepare("CREATE INDEX IF NOT EXISTS orders_day ON orders(day,t)"),DB.prepare("CREATE TABLE IF NOT EXISTS log(t TEXT,w TEXT)"),DB.prepare("CREATE INDEX IF NOT EXISTS log_t ON log(t)")]);await ready};
const sk=(DB,k,v)=>DB.prepare("INSERT OR REPLACE INTO kv VALUES(?,?)").bind(k,JSON.stringify(v)).run();
const logw=async(DB,L)=>{if(!L.length)return;const t=new Date().toISOString();await DB.batch(L.map(w=>DB.prepare("INSERT INTO log VALUES(?,?)").bind(t,String(w).slice(0,200))));await DB.prepare("DELETE FROM log WHERE t<?").bind(new Date(Date.now()-180*864e5).toISOString()).run()};
const flat=m=>{const o={};(m.categories||[]).forEach(c=>(c.items||[]).forEach(i=>o[i.id]={...i,cat:c.name}));return o};
const diff=(a,b)=>{const L=[];let sens=false;const A=flat(a),B=flat(b),an=(a.categories||[]).map(c=>c.name),bn=(b.categories||[]).map(c=>c.name),rc=an.filter(n=>!bn.includes(n)),ac=bn.filter(n=>!an.includes(n));
 if(rc.length&&rc.length==ac.length)rc.forEach((n,i)=>L.push("Kategori adı: "+n+" → "+ac[i]));else{rc.forEach(n=>{L.push("Kategori silindi: "+n);sens=true});ac.forEach(n=>L.push("Kategori eklendi: "+(n||"(adsız)")))}
 for(const id in A)if(!B[id]){L.push("Ürün silindi: "+(A[id].name||"(adsız)")+" ("+A[id].price+" TL)");sens=true}
 for(const id in B){const y=B[id],x=A[id];if(!x){L.push("Ürün eklendi: "+(y.name||"(adsız)")+" ("+y.price+" TL)");continue}
  if(x.price!==y.price){L.push("Fiyat: "+y.name+" "+x.price+" → "+y.price+" TL");sens=true}
  if(x.name!==y.name)L.push("Ürün adı: "+x.name+" → "+y.name);
  if(!!x.soldOut!==!!y.soldOut)L.push((y.soldOut?"Tükendi işaretlendi: ":"Tükendi kaldırıldı: ")+y.name);
  if((x.photo||"")!==(y.photo||""))L.push("Fotoğraf değişti: "+y.name)}
 return{L,sens}};
const parse=m=>{const items=[];for(const l of m.split("\n")){const x=l.match(/^(\d+) × (.+) – (\d+) ₺$/);if(x)items.push({name:x[2],qty:+x[1],price:+x[3]/+x[1]})}
const g=r=>(m.match(r)||[])[1]||"";return{items,total:+g(/Toplam: (\d+)/),type:/^Yeni masa/.test(m)?"masa":"paket",table:g(/Masa (\d+)/),name:g(/^Ad: (.+)$/m),phone:g(/^Tel: (.+)$/m),address:g(/^Adres: (.+)$/m)}};
async function api(req,env,u){
 const DB=env.DB;if(!DB)return J({error:"db"},500);await init(DB);
 const p=u.pathname.replace(/^\/api\/?/,""),m=req.method;
 const admin=!!env.ADMIN_PASSWORD&&req.headers.get("x-admin-key")===env.ADMIN_PASSWORD&&(!env.ADMIN_USER||(req.headers.get("x-admin-user")||"").trim().toLowerCase()===env.ADMIN_USER.trim().toLowerCase());
 const rows=async()=>{const o={};(await DB.prepare("SELECT k,v FROM kv WHERE k IN ('menu','settings')").all()).results.forEach(r=>o[r.k]=JSON.parse(r.v));return o};
 if(p==="menu"&&m==="GET"){const o=await rows();return J({menu:o.menu||{categories:[],popular:[]},settings:o.settings||{open:true,from:"10:00",to:"00:00"}})}
 if(p==="seed"&&m==="POST"){if((await rows()).menu)return J({ok:false});try{await sk(DB,"menu",clean(await req.json()))}catch(e){return J({error:"bad"},400)}return J({ok:true})}
 if(p.startsWith("photo/")&&m==="GET"){const r=await DB.prepare("SELECT b FROM photos WHERE id=?").bind(p.slice(6)).first();if(!r)return new Response("",{status:404});const s=atob(r.b),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return new Response(a,{headers:{"content-type":"image/jpeg","cache-control":"public, max-age=31536000, immutable"}})}
 if(p==="order"&&m==="POST"){
  const o=await rows();if((o.settings||{}).open===false)return J({error:"closed"},403);
  let b;try{b=await req.json()}catch(e){return J({error:"bad"},400)}
  const t=String(b.m||"");if(t.length<10||t.length>1500||!/^Yeni (paket sipariş|masa siparişi)/.test(t))return J({error:"bad"},400);
  const x=parse(t),d=day(),id=crypto.randomUUID().slice(0,8),now=new Date().toISOString();
  await DB.prepare("INSERT INTO orders VALUES(?,?,?,?)").bind(id,now,d,JSON.stringify({id,time:now,...x})).run();
  await DB.prepare("DELETE FROM orders WHERE day<?").bind(day(180)).run();
  if(env.PUSHOVER_TOKEN&&env.PUSHOVER_USER){const L=t.split("\n").filter((l,i)=>i==0||/^\d+ × /.test(l)||/^Toplam/.test(l));
   try{await fetch("https://api.pushover.net/1/messages.json",{method:"POST",body:new URLSearchParams({token:env.PUSHOVER_TOKEN,user:env.PUSHOVER_USER,title:x.type=="masa"?"🍔 Yeni MASA siparişi":"🍔 Yeni PAKET sipariş",message:(L.join("\n")+"\nWhatsApp mesajını kontrol edin.").slice(0,1000),priority:"2",retry:"70",expire:"3600",sound:"business"})})}catch(e){}}
  return J({ok:true})}
 const ip=req.headers.get("cf-connecting-ip")||"x",ms=Date.now();
 const rec=async k=>{await DB.prepare("INSERT INTO fails VALUES(?,?,?)").bind(ip,ms,k).run();await DB.prepare("DELETE FROM fails WHERE t<?").bind(ms-2*864e5).run();
  const n=(await DB.prepare("SELECT COUNT(*) c FROM fails WHERE t>?").bind(ms-864e5).first()).c;
  if(n%30===0&&env.PUSHOVER_TOKEN&&env.PUSHOVER_USER){try{await fetch("https://api.pushover.net/1/messages.json",{method:"POST",body:new URLSearchParams({token:env.PUSHOVER_TOKEN,user:env.PUSHOVER_USER,title:"⚠️ Yönetim paneli: yanlış giriş denemesi",message:"Son 24 saatte "+n+" yanlış/engellenen giriş denemesi oldu.",priority:"1"})})}catch(e){}}};
 if((await DB.prepare("SELECT COUNT(*) c FROM fails WHERE ip=? AND k=0 AND t>?").bind(ip,ms-9e5).first()).c>=10){await rec(1);return J({error:"locked"},429)}
 const fail=async()=>{if(!(await DB.prepare("SELECT 1 x FROM fails WHERE ip=? AND k=0 AND t>?").bind(ip,ms-3000).first()))await rec(0);const c=(await DB.prepare("SELECT COUNT(*) c FROM fails WHERE ip=? AND k=0 AND t>?").bind(ip,ms-9e5).first()).c;return Math.max(0,10-c)};
 if(!admin)return J({error:"auth",left:await fail()},401);
 if(p==="check")return J({ok:true});
 if(p==="orders"&&m==="GET"){const re=/^\d{4}-\d{2}-\d{2}$/,a=u.searchParams.get("from"),b=u.searchParams.get("to");let r;
  if(a&&b){if(!re.test(a)||!re.test(b)||a>b||Date.parse(b)-Date.parse(a)>90*864e5)return J({error:"range"},400);r=await DB.prepare("SELECT d FROM orders WHERE day>=? AND day<=? ORDER BY t DESC").bind(a,b).all()}
  else{const n=Math.min(90,Math.max(1,+u.searchParams.get("days")||1));r=await DB.prepare("SELECT d FROM orders WHERE day>=? ORDER BY t DESC").bind(day(n-1)).all()}
  return J({orders:r.results.map(x=>JSON.parse(x.d))})}
 if(p==="log"&&m==="GET"){const r=await DB.prepare("SELECT t,w FROM log ORDER BY t DESC,rowid LIMIT 500").all();return J({log:r.results})}
 if(p==="menu"&&m==="PUT"){const nm=clean(await req.json()),om=(await rows()).menu||{categories:[]},{L,sens}=diff(om,nm);
  if(sens){const cf=req.headers.get("x-confirm")||"";if(!env.ADMIN_PASSWORD||cf!==env.ADMIN_PASSWORD){const left=cf?await fail():undefined;return J({error:"confirm",changes:L.filter(x=>/^(Ürün silindi|Kategori silindi|Fiyat)/.test(x)).slice(0,12),left},403)}}
  await sk(DB,"menu",nm);await logw(DB,L);return J({ok:true})}
 if(p==="settings"&&m==="PUT"){const b=await req.json(),os=(await rows()).settings||{open:true,from:"10:00",to:"00:00"},ns={open:b.open!==false,from:txt(b.from,5),to:txt(b.to,5)},L=[];
  if((os.open!==false)!==ns.open)L.push(ns.open?"Sipariş alımı açıldı":"Sipariş alımı kapatıldı");if(os.from!==ns.from||os.to!==ns.to)L.push("Çalışma saatleri: "+os.from+"-"+os.to+" → "+ns.from+"-"+ns.to);
  await sk(DB,"settings",ns);await logw(DB,L);return J({ok:true})}
 if(p==="photo"&&m==="POST"){const b=String((await req.json()).b||"");if(!b||b.length>1100000||!/^[A-Za-z0-9+/=]+$/.test(b))return J({error:"size"},413);const id=crypto.randomUUID();await DB.prepare("INSERT INTO photos VALUES(?,?)").bind(id,b).run();return J({id})}
 return J({error:"404"},404)}
export default{async fetch(req,env){const u=new URL(req.url);
 if(u.pathname.startsWith("/api/")){try{return await api(req,env,u)}catch(e){return J({error:"server"},500)}}
 const r=await env.ASSETS.fetch(req);
 if((r.headers.get("content-type")||"").includes("text/html"))return new HTMLRewriter().on("body",{element(e){e.append('<script src="/menu.js"></script>',{html:true})}}).transform(r);
 return r}};
