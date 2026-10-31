const J=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
const day=(o=0)=>new Date(Date.now()+3*36e5-o*864e5).toISOString().slice(0,10);
const txt=(v,n)=>String(v??"").slice(0,n),num=v=>Math.max(0,Number(v)||0);
const clean=b=>({categories:(Array.isArray(b.categories)?b.categories:[]).slice(0,20).map(c=>({name:txt(c.name,60),items:(Array.isArray(c.items)?c.items:[]).slice(0,100).map(i=>({id:txt(i.id,20).replace(/[^\w-]/g,""),name:txt(i.name,80),desc:txt(i.desc,300),price:num(i.price),img:i.img==="b"||i.img==="c"?i.img:"",drink:!!i.drink,soldOut:!!i.soldOut,photo:/^[\w-]{8,64}$/.test(i.photo||"")?i.photo:""}))})),popular:(Array.isArray(b.popular)?b.popular:[]).slice(0,12).map(x=>txt(x,20))});
let ready;
const init=async DB=>{ready??=DB.batch([DB.prepare("CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY,v TEXT)"),DB.prepare("CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,t TEXT,day TEXT,d TEXT)"),DB.prepare("CREATE TABLE IF NOT EXISTS photos(id TEXT PRIMARY KEY,b TEXT)")]);await ready};
const sk=(DB,k,v)=>DB.prepare("INSERT OR REPLACE INTO kv VALUES(?,?)").bind(k,JSON.stringify(v)).run();
const parse=m=>{const items=[];for(const l of m.split("\n")){const x=l.match(/^(\d+) × (.+) – (\d+) ₺$/);if(x)items.push({name:x[2],qty:+x[1],price:+x[3]/+x[1]})}
const g=r=>(m.match(r)||[])[1]||"";return{items,total:+g(/Toplam: (\d+)/),type:/^Yeni masa/.test(m)?"masa":"paket",table:g(/Masa (\d+)/),name:g(/^Ad: (.+)$/m),phone:g(/^Tel: (.+)$/m),address:g(/^Adres: (.+)$/m)}};
async function api(req,env,u){
 const DB=env.DB;if(!DB)return J({error:"db"},500);await init(DB);
 const p=u.pathname.replace(/^\/api\/?/,""),m=req.method;
 const admin=!!env.ADMIN_PASSWORD&&req.headers.get("x-admin-key")===env.ADMIN_PASSWORD;
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
   try{await fetch("https://api.pushover.net/1/messages.json",{method:"POST",body:new URLSearchParams({token:env.PUSHOVER_TOKEN,user:env.PUSHOVER_USER,title:x.type=="masa"?"🍔 Yeni MASA siparişi":"🍔 Yeni PAKET sipariş",message:(L.join("\n")+"\nWhatsApp mesajını kontrol edin.").slice(0,1000),priority:"2",retry:"30",expire:"900",sound:"business"})})}catch(e){}}
  return J({ok:true})}
 if(!admin)return J({error:"auth"},401);
 if(p==="check")return J({ok:true});
 if(p==="orders"&&m==="GET"){const n=Math.min(90,Math.max(1,+u.searchParams.get("days")||1));const r=await DB.prepare("SELECT d FROM orders WHERE day>=? ORDER BY t DESC").bind(day(n-1)).all();return J({orders:r.results.map(x=>JSON.parse(x.d))})}
 if(p==="menu"&&m==="PUT"){await sk(DB,"menu",clean(await req.json()));return J({ok:true})}
 if(p==="settings"&&m==="PUT"){const b=await req.json();await sk(DB,"settings",{open:b.open!==false,from:txt(b.from,5),to:txt(b.to,5)});return J({ok:true})}
 if(p==="photo"&&m==="POST"){const b=String((await req.json()).b||"");if(!b||b.length>1100000||!/^[A-Za-z0-9+/=]+$/.test(b))return J({error:"size"},413);const id=crypto.randomUUID();await DB.prepare("INSERT INTO photos VALUES(?,?)").bind(id,b).run();return J({id})}
 return J({error:"404"},404)}
export default{async fetch(req,env){const u=new URL(req.url);
 if(u.pathname.startsWith("/api/")){try{return await api(req,env,u)}catch(e){return J({error:"server"},500)}}
 const r=await env.ASSETS.fetch(req);
 if((r.headers.get("content-type")||"").includes("text/html"))return new HTMLRewriter().on("body",{element(e){e.append('<script src="/menu.js"></script>',{html:true})}}).transform(r);
 return r}};
