(async function(){
var d;try{d=await(await fetch("/api/menu")).json()}catch(e){return}
var m=d.menu,st=d.settings||{};
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function render(){T.innerHTML="";M.innerHTML="";
S.forEach(function(s,i){var b=document.createElement("button");b.textContent=s[0];b.id="t"+i;b.onclick=function(){document.getElementById("s"+i).scrollIntoView({behavior:"smooth"})};T.appendChild(b);
var sec=document.createElement("section");sec.id="s"+i;var h=HC[i%HC.length];sec.innerHTML="<h2 style='color:"+h+";border-bottom:3px solid "+h+";padding-bottom:4px;display:inline-block'>"+esc(s[0])+"</h2>";
s[1].forEach(function(id){var p=D[id],c=document.createElement("div");c.className="it";c.dataset.id=id;var im=p[6]?"/api/photo/"+p[6]:IMG[p[3]],sd=p[5];
c.innerHTML=(im?"<img src='"+im+"' alt=''>":"")+"<div class='tx'><b>"+esc(p[0])+"</b>"+(p[1]?"<small>"+esc(p[1])+"</small>":"")+"<span class='pr'>"+p[2]+" ₺</span>"+(p[4]&&!sd?"<select aria-label='İçecek'><option value=''>İçecek seçiniz</option>"+DR.map(function(x){return"<option>"+x+"</option>"}).join("")+"</select><div class='ie'></div>":"")+(sd?"<div class='ie'>Tükendi</div>":"")+"<div class='ad'></div></div><div class='st'"+(sd?" style='display:none'":"")+"><button class='mi' aria-label='Azalt'>−</button><span class='n'>0</span><button class='pl' aria-label='Artır'>+</button></div>";
var se=c.querySelector("select");if(se)se.onchange=function(){var ie=c.querySelector(".ie"),pl=c.querySelector(".pl");se.style.borderColor="";if(se.value){ie.textContent="Eklemek için + düğmesine basın →";pl.classList.add("hl")}else{ie.textContent="";pl.classList.remove("hl")}};
c.querySelector(".pl").onclick=function(){var e=c.querySelector("select");if(e&&!e.value){c.querySelector(".ie").textContent="İçecek seçimi yapmadınız.";e.style.borderColor="#c0392b";c.scrollIntoView({block:"center",behavior:"smooth"});return}L.push({id:id,d:e?e.value:""});if(e){e.value="";c.querySelector(".ie").textContent="";c.querySelector(".pl").classList.remove("hl")}upd()};
c.querySelector(".mi").onclick=function(){for(var k=L.length-1;k>=0;k--)if(L[k].id==id){L.splice(k,1);break}upd()};
sec.appendChild(c)});M.appendChild(sec)});cur=-1;upd();spy()}
if(!m.categories.length){fetch("/api/seed",{method:"POST",body:JSON.stringify({popular:S[0][1],categories:S.slice(1).map(function(s){return{name:s[0],items:s[1].map(function(id){var p=D[id];return{id:id,name:p[0],desc:p[1],price:p[2],img:p[3],drink:!!p[4]}})}})})}).catch(function(){})}
else{var nD={},nS=[];
m.categories.forEach(function(c){var ids=[];c.items.forEach(function(i){if(!i.id)return;nD[i.id]=[i.name,i.desc,i.price,i.img,i.drink?1:0,i.soldOut,i.photo];ids.push(i.id)});nS.push([c.name,ids])});
if(m.popular&&m.popular.length)nS.unshift(["Popüler Lezzetler",m.popular.filter(function(x){return nD[x]})]);
D=nD;S=nS;render()}
var hp=document.querySelector("header p");
if(st.from&&st.to&&!MASA)hp.textContent=hp.textContent.replace(/\d\d:\d\d-\d\d:\d\d/,st.from+"-"+st.to);
if(st.open===false){var gb=document.getElementById("go"),u0=upd;upd=function(){u0();gb.disabled=true;gb.textContent="Şu an sipariş alınmıyor"};hp.insertAdjacentHTML("afterend","<p class='warn'>Şu an sipariş alınmıyor.</p>");upd()}
window.ping=function(){try{fetch("/api/order",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({m:MG}),keepalive:true}).catch(function(){})}catch(e){}};
})();
