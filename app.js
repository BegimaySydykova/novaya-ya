const KEY="days365_v1";
const defaultHabits=[
 {id:"water",icon:"💧",title:"2 литра воды",meta:"Цель: 2 000 мл"},
 {id:"lemon",icon:"🍋",title:"Вода с лимоном",meta:"Утром"},
 {id:"wake",icon:"⏰",title:"Подъём в 7:00",meta:"Начать день вовремя"},
 {id:"exercise",icon:"☀️",title:"Утренняя зарядка",meta:"Ежедневно"},
 {id:"steps",icon:"👣",title:"10 000 шагов",meta:"Можно указать фактическое количество"},
 {id:"food",icon:"🍽️",title:"Записать всё съеденное",meta:"Питание за день"},
 {id:"dinner",icon:"🥛",title:"Лёгкая замена ужина",meta:"Можно изменить в настройках"},
 {id:"book",icon:"📖",title:"20 страниц книги",meta:"Можно указать фактическое число"},
 {id:"screenmeal",icon:"📵",title:"Без телефона и ТВ во время еды",meta:"Осознанное питание"},
 {id:"entertainment",icon:"🎬",title:"Развлекательный контент ≤ 1 часа",meta:"Можно указать минуты"},
 {id:"sleep",icon:"😴",title:"Сон 23:00–00:00",meta:""},
];
const rewardDefs=[
 {id:"kg5",icon:"💆",title:"Стоматолог или косметолог",rule:"Каждые −5 кг",type:"kg",value:5},
 {id:"kg10",icon:"🍕",title:"Читмил",rule:"Каждые −10 кг",type:"kg",value:10},
 {id:"75",icon:"💋",title:"Сделать губы",rule:"75 кг",type:"weight",value:75},
 {id:"65",icon:"📸",title:"Профессиональная фотосессия",rule:"65 кг",type:"weight",value:65},
 {id:"60",icon:"✈️🛍️",title:"Путешествие + шопинг",rule:"60 кг",type:"weight",value:60},
 {id:"30days",icon:"🏊‍♀️",title:"Бассейн / SPA",rule:"30 дней без срыва",type:"streak",value:30}
];

function blankUser(name){
 return {name,startDate:"2026-08-20",days:{},weights:[],measurements:[],goals:{socials:[],alcohol:false,wishlist:false,vision:false},rewards:{},notes:{}};
}
function load(){
 let s=localStorage.getItem(KEY);
 if(s) return JSON.parse(s);
 const state={active:"Бека",users:{Бека:blankUser("Бека"),Айжана:blankUser("Айжана")}};
 localStorage.setItem(KEY,JSON.stringify(state)); return state;
}
let state=load(), currentView="today", calCursor=new Date();
if(state.users["Подруга"] && !state.users["Айжана"]){ state.users["Айжана"]=state.users["Подруга"]; state.users["Айжана"].name="Айжана"; delete state.users["Подруга"]; save(); }

function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function user(){return state.users[state.active]}
function iso(d){return d.toISOString().slice(0,10)}
function today(){return iso(new Date())}
function dayNum(date){
 const start=new Date(user().startDate+"T00:00:00"), d=new Date(date+"T00:00:00");
 return Math.floor((d-start)/86400000)+1;
}
function eligible(date){return dayNum(date)>=1}
function dayData(date){return user().days[date]||{checks:{},steps:"",pages:"",minutes:""}}
function yoga(date){const n=dayNum(date); return n>=1 && n%2===1}
function habitsFor(date){return [...defaultHabits,...(yoga(date)?[{id:"yoga",icon:"🧘",title:"Йога 15 минут",meta:"Сегодня день йоги"}]:[])];}
function statsFor(date){
 const d=dayData(date), hs=habitsFor(date), done=hs.filter(h=>d.checks[h.id]).length;
 return {done,total:hs.length,pct:hs.length?Math.round(done/hs.length*100):0};
}
function challengeDays(){
 const start=new Date(user().startDate+"T00:00:00"), now=new Date(today()+"T00:00:00");
 return Math.max(0,Math.floor((now-start)/86400000)+1);
}
function currentStreak(){
 let n=0, d=new Date(today()+"T00:00:00");
 for(let i=0;i<10000;i++){let s=iso(d); if(!eligible(s)) break; if(statsFor(s).pct===100)n++; else break; d.setDate(d.getDate()-1);}
 return n;
}
function bestStreak(){
 let best=0, run=0, start=new Date(user().startDate+"T00:00:00"), end=new Date(today()+"T00:00:00");
 for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){let p=statsFor(iso(d)).pct;if(p===100){run++;best=Math.max(best,run)}else run=0}
 return best;
}
function overall(){
 let total=0,sum=0,full=0;
 const start=new Date(user().startDate+"T00:00:00"), end=new Date(today()+"T00:00:00");
 for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){let s=statsFor(iso(d));sum+=s.pct;total++;if(s.pct===100)full++}
 return {days:total,avg:total?Math.round(sum/total):0,full};
}
function lastWeight(){return user().weights.length?user().weights[user().weights.length-1].value:null}
function initialWeight(){return user().weights.length?user().weights[0].value:null}
function lostKg(){const a=initialWeight(), b=lastWeight(); return a!=null&&b!=null?Math.max(0,a-b):0}
function beautyFund(){return Math.floor(lostKg())*1000}
function habitRate(id){
 const start=new Date(user().startDate+"T00:00:00"), end=new Date(today()+"T00:00:00"); let total=0,done=0;
 for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){const s=iso(d);if(habitsFor(s).some(h=>h.id===id)){total++;if(dayData(s).checks[id])done}}
 return total?Math.round(done/total*100):0;
}
function fmtDate(s){return new Date(s+"T00:00:00").toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric"})}

function render(){
 document.getElementById("profileBtn").textContent=`${state.active} ▾`;
 document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
 document.getElementById("view-"+currentView).classList.add("active");
 document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===currentView));
 ({today:renderToday,calendar:renderCalendar,progress:renderProgress,rewards:renderRewards,us:renderUs}[currentView])();
}
function renderToday(){
 const s=statsFor(today()), u=user(), n=dayNum(today());
 document.getElementById("view-today").innerHTML=`
 <div class="hero">
  <div class="hero-row"><div><div class="muted">${new Date().toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"})}</div><div class="big-day">${n>0?"День "+n:"До старта"}</div><div class="muted">Старт: ${fmtDate(u.startDate)}</div></div>
  <div style="text-align:right"><div class="kpi">${s.pct}%</div><div class="muted">${s.done}/${s.total} задач</div></div></div>
  <div class="progress-track" style="margin-top:18px"><div class="progress-fill" style="width:${s.pct}%"></div></div>
  <div class="stats"><div class="stat">🔥 Серия<strong>${currentStreak()}</strong></div><div class="stat">📆 Дней<strong>${challengeDays()}</strong></div><div class="stat">🏆 Лучшая<strong>${bestStreak()}</strong></div></div>
 </div>
 <div class="card"><div class="row"><h2>Сегодня</h2><span class="tag">${yoga(today())?"🧘 День йоги":"🌿 Обычный день"}</span></div>${n<1?`<p class="muted">Дата старта ещё не наступила. Можно изменить её в профиле.</p>`:habitsFor(today()).map(h=>habitHtml(h,today())).join("")}</div>
 <div class="grid">
  <div class="card"><h2>🍽️ Питание</h2><textarea id="meal" placeholder="Что сегодня ела?">${dayData(today()).meal||""}</textarea><button class="btn" style="margin-top:9px" onclick="saveMeal()">Сохранить питание</button></div>
  <div class="card"><h2>📝 Заметка</h2><textarea id="note" placeholder="Как прошёл день?">${u.notes[today()]||""}</textarea><button class="btn" style="margin-top:9px" onclick="saveNote()">Сохранить заметку</button></div>
  <div class="card"><h2>⚙️ Настройки</h2><div class="field"><label>Дата начала</label><input class="input" id="startDate" type="date" value="${u.startDate}"></div><button class="btn secondary" onclick="changeStart()">Изменить дату старта</button></div>
 </div>`;
}
function habitHtml(h,date){
 const d=dayData(date), checked=!!d.checks[h.id];
 let extra="";
 if(h.id==="steps") extra=`<input class="input" style="width:120px" type="number" placeholder="шаги" value="${d.steps||""}" onchange="setExtra('${date}','steps',this.value)">`;
 if(h.id==="book") extra=`<input class="input" style="width:110px" type="number" placeholder="страниц" value="${d.pages||""}" onchange="setExtra('${date}','pages',this.value)">`;
 if(h.id==="entertainment") extra=`<input class="input" style="width:110px" type="number" placeholder="минут" value="${d.minutes||""}" onchange="setExtra('${date}','minutes',this.value)">`;
 return `<div class="habit"><input type="checkbox" ${checked?"checked":""} onchange="toggleHabit('${date}','${h.id}',this.checked)"><div style="flex:1"><div class="habit-title">${h.icon} ${h.title}</div><div class="habit-meta">${h.meta}</div></div>${extra}</div>`;
}
function toggleHabit(date,id,val){if(!user().days[date])user().days[date]={checks:{}};if(!user().days[date].checks)user().days[date].checks={};user().days[date].checks[id]=val;save();render()}
function setExtra(date,key,val){if(!user().days[date])user().days[date]={checks:{}};user().days[date][key]=val;save()}
function saveNote(){user().notes[today()]=document.getElementById("note").value;save();toast("Заметка сохранена ✨")}
function saveMeal(){if(!user().days[today()])user().days[today()]={checks:{}};user().days[today()].meal=document.getElementById("meal").value;save();toast("Питание сохранено 🍽️")}
function changeStart(){const v=document.getElementById("startDate").value;if(v){user().startDate=v;save();render();toast("Дата старта обновлена")}}

function renderCalendar(){
 const y=calCursor.getFullYear(),m=calCursor.getMonth(), first=new Date(y,m,1), days=new Date(y,m+1,0).getDate(), offset=(first.getDay()+6)%7;
 let cells=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(x=>`<div class="weekday">${x}</div>`).join("");
 for(let i=0;i<offset;i++)cells+=`<div class="daycell out"></div>`;
 for(let d=1;d<=days;d++){const date=iso(new Date(y,m,d)), st=eligible(date)?statsFor(date):null;let cls="daycell";if(date===today())cls+=" current";if(st?.pct===100)cls+=" done";else if(st?.pct>0)cls+=" partial";cells+=`<button class="${cls}" onclick="openDay('${date}')"><div class="daynum">${d}</div><div class="daystatus">${st?`День ${dayNum(date)} · ${st.pct}%`: "до старта"}</div></button>`}
 document.getElementById("view-calendar").innerHTML=`<div class="card"><div class="calendar-head"><button class="btn secondary" onclick="moveMonth(-1)">‹</button><h2>${new Date(y,m,1).toLocaleDateString("ru-RU",{month:"long",year:"numeric"})}</h2><button class="btn secondary" onclick="moveMonth(1)">›</button></div><div class="month-grid">${cells}</div><p class="muted" style="margin-bottom:0">🟢 100% · 🟡 частично · ⚪ пусто · 🔵 сегодня</p></div>`;
}
function moveMonth(x){calCursor.setMonth(calCursor.getMonth()+x);renderCalendar()}
function openDay(date){const st=statsFor(date),d=dayData(date);openModal(`<h2>${fmtDate(date)} · День ${dayNum(date)}</h2><div class="kpi">${st.pct}%</div><p class="muted">${st.done}/${st.total} выполнено</p>${habitsFor(date).map(h=>`<div class="habit"><span>${d.checks[h.id]?"✅":"○"}</span><div><b>${h.icon} ${h.title}</b></div></div>`).join("")}<h3>📝 Заметка</h3><p>${user().notes[date]||"Нет заметки."}</p>`)}
function renderProgress(){
 const o=overall(), u=user(), a=initialWeight(), b=lastWeight();
 const rates=defaultHabits.map(h=>`<div class="metric-row"><div>${h.icon} ${h.title}</div><div><b>${habitRate(h.id)}%</b></div><div class="bar"><i style="width:${habitRate(h.id)}%"></i></div></div>`).join("");
 document.getElementById("view-progress").innerHTML=`
 <div class="grid"><div class="card"><div class="muted">Среднее выполнение</div><div class="kpi">${o.avg}%</div><p>${o.full} полностью выполненных дней из ${o.days}</p></div>
 <div class="card"><div class="muted">Серия</div><div class="kpi">🔥 ${currentStreak()}</div><p>Лучшая: ${bestStreak()} дней</p></div></div>
 <div class="card"><h2>📊 Привычки</h2><div class="table-like">${rates}</div></div>
 <div class="card"><h2>⚖️ Вес и замеры</h2><div class="grid">
 <div><div class="muted">Начальный вес</div><div class="kpi">${a??"—"} кг</div></div><div><div class="muted">Текущий вес</div><div class="kpi">${b??"—"} кг</div></div>
 </div><p>${a!=null&&b!=null?`Результат: <b>${(b-a).toFixed(1)} кг</b>`:"Добавь первую запись веса."}</p>
 <button class="btn" onclick="weightModal()">Добавить вес / замеры</button></div>
 <div class="card"><h2>💄 Фонд красоты</h2><div class="kpi">${beautyFund().toLocaleString("ru-RU")} сом</div><p class="muted">+1 000 сом за каждый полный потерянный килограмм.</p></div>`;
}
function weightModal(){openModal(`<h2>⚖️ Еженедельный контроль</h2><div class="field"><label>Вес, кг</label><input id="w" class="input" type="number" step="0.1"></div><div class="grid">${["Грудь","Талия","Живот","Бёдра"].map((x,i)=>`<div class="field"><label>${x}, см</label><input id="m${i}" class="input" type="number" step="0.1"></div>`).join("")}</div><button class="btn" onclick="saveWeight()">Сохранить</button>`)}
function saveWeight(){const v=parseFloat(document.getElementById("w").value);if(!v)return;user().weights.push({date:today(),value:v});const names=["chest","waist","belly","hips"], vals={};names.forEach((n,i)=>{const x=parseFloat(document.getElementById("m"+i).value);if(!isNaN(x))vals[n]=x});user().measurements.push({date:today(),...vals});save();closeModal();render();toast("Данные сохранены")}
function rewardCount(type,value){
 const lost=lostKg(), st=currentStreak();
 if(type==="kg") return Math.floor(lost/value);
 if(type==="streak") return Math.floor(st/value);
 return 0;
}
function rewardKey(type,value,index){return `${type}_${value}_${index}`}
function renderRewards(){
 const lost=lostKg(), w=lastWeight(), st=currentStreak();
 let cards=[];

 // Повторяющиеся награды: каждые 5 кг, каждые 10 кг и каждые 30 дней серии.
 const repeatDefs=[
  {type:"kg",value:5,icon:"💆",title:"Стоматолог или косметолог",label:"за каждые −5 кг"},
  {type:"kg",value:10,icon:"🍕",title:"Читмил",label:"за каждые −10 кг"},
  {type:"streak",value:30,icon:"🏊‍♀️",title:"Бассейн / SPA",label:"за каждые 30 дней без срыва"}
 ];
 repeatDefs.forEach(r=>{
   const count=rewardCount(r.type,r.value);
   for(let i=1;i<=Math.max(count,1);i++){
     const unlocked=i<=count, key=rewardKey(r.type,r.value,i), claimed=!!user().rewards[key];
     cards.push(`<div class="card reward ${unlocked?"unlocked":"locked"}">
       <div class="reward-icon">${r.icon}</div>
       <div style="flex:1"><h3>${r.title} ${i>1?`№${i}`:""}</h3>
       <div class="muted">${r.label} · порог ${r.value*i}${r.type==="kg"?" кг":" дней"}</div></div>
       <div>${claimed?"☑️":unlocked?"🎉":"🔒"}</div>
       ${unlocked&&!claimed?`<button class="btn" onclick="claim('${key}')">Получена</button>`:""}
     </div>`);
   }
 });

 // Одноразовые награды за конкретный вес.
 [
  {id:"75",icon:"💋",title:"Сделать губы",rule:"Достичь 75 кг",value:75},
  {id:"65",icon:"📸",title:"Профессиональная фотосессия",rule:"Достичь 65 кг",value:65},
  {id:"60",icon:"✈️🛍️",title:"Путешествие + шопинг",rule:"Достичь 60 кг",value:60}
 ].forEach(r=>{
   const unlocked=w!=null&&w<=r.value, claimed=!!user().rewards[r.id];
   cards.push(`<div class="card reward ${unlocked?"unlocked":"locked"}">
    <div class="reward-icon">${r.icon}</div><div style="flex:1"><h3>${r.title}</h3><div class="muted">${r.rule}</div></div>
    <div>${claimed?"☑️":unlocked?"🎉":"🔒"}</div>
    ${unlocked&&!claimed?`<button class="btn" onclick="claim('${r.id}')">Получена</button>`:""}
   </div>`);
 });

 document.getElementById("view-rewards").innerHTML=`<div class="hero">
  <div class="muted">💄 Фонд красоты</div><div class="kpi">${beautyFund().toLocaleString("ru-RU")} сом</div>
  <p class="muted">Потеряно: ${lost.toFixed(1)} кг · текущая серия: 🔥 ${st} дней</p>
 </div>
 <h2 style="margin:20px 0 12px">🏆 Награды</h2>${cards.join("")}`;
}
function claim(id){user().rewards[id]=true;save();render();toast("Награда отмечена 🎉")}
function renderUs(){
 const people=Object.values(state.users);
 const cards=people.map(u=>{
   const old=state.active;
   state.active=u.name;
   const s=statsFor(today()), st=currentStreak(), w=lastWeight(), a=initialWeight();
   const todayData=dayData(today());
   const note=u.notes[today()]||"";
   const meal=todayData.meal||"";
   const measures=u.measurements.length?u.measurements[u.measurements.length-1]:null;
   state.active=old;

   const habits=habitsFor(today()).map(h=>
     `<div class="habit" style="padding:8px 0"><span>${todayData.checks[h.id]?"✅":"○"}</span><div><b>${h.icon} ${h.title}</b></div></div>`
   ).join("");

   return `<div class="card">
     <div class="row"><h2>${u.name}</h2><span class="tag">${u.name===old?"Ты":"Общий доступ"}</span></div>
     <div class="stats">
       <div class="stat">Сегодня<strong>${s.done}/${s.total}</strong></div>
       <div class="stat">Процент<strong>${s.pct}%</strong></div>
       <div class="stat">Серия<strong>🔥 ${st}</strong></div>
     </div>
     <div class="grid" style="margin-top:12px">
       <div class="stat"><div class="muted">⚖️ Вес</div><strong>${w!=null?w+" кг":"—"}</strong><small>${a!=null?`старт ${a} кг`:"нет данных"}</small></div>
       <div class="stat"><div class="muted">💄 Фонд</div><strong>${beautyFund().toLocaleString("ru-RU")} сом</strong></div>
     </div>

     <details style="margin-top:14px">
       <summary><b>📋 Привычки сегодня</b></summary>
       ${habits}
       ${todayData.steps?`<p class="muted">👣 Шаги: ${todayData.steps}</p>`:""}
       ${todayData.pages?`<p class="muted">📖 Страниц: ${todayData.pages}</p>`:""}
       ${todayData.minutes?`<p class="muted">🎬 Развлекательный контент: ${todayData.minutes} мин</p>`:""}
     </details>

     <details style="margin-top:12px">
       <summary><b>🍽️ Питание</b></summary>
       <p>${meal||"Сегодня ничего не записано."}</p>
     </details>

     <details style="margin-top:12px">
       <summary><b>📝 Заметка за сегодня</b></summary>
       <p>${note||"Сегодня заметки нет."}</p>
     </details>

     <details style="margin-top:12px">
       <summary><b>📏 Последние замеры</b></summary>
       ${measures?`<p>Грудь: ${measures.chest??"—"} см · Талия: ${measures.waist??"—"} см · Живот: ${measures.belly??"—"} см · Бёдра: ${measures.hips??"—"} см</p>`:"<p>Замеры пока не внесены.</p>"}
     </details>
   </div>`;
 }).join("");

 document.getElementById("view-us").innerHTML=`
   <div class="hero">
     <h2>👯‍♀️ Мы вдвоём</h2>
     <p class="muted">Полный общий доступ: вес, замеры, питание, заметки, привычки, серии и награды.</p>
   </div>
   ${cards}
   <div class="card">
    <h2>🎯 Цели</h2>
    <div class="field"><label>Социальные сети до Нового года</label>
    ${["Instagram","TikTok","Threads","Другое"].map(x=>`<label style="display:block;margin:7px 0"><input type="checkbox" ${user().goals.socials.includes(x)?"checked":""} onchange="toggleSocial('${x}',this.checked)"> ${x}</label>`).join("")}</div>
    <label class="habit"><input type="checkbox" ${user().goals.alcohol?"checked":""} onchange="user().goals.alcohol=this.checked;save();render()"> <span>🍷 Не употреблять алкоголь до Нового года</span></label>
    <label class="habit"><input type="checkbox" ${user().goals.vision?"checked":""} onchange="user().goals.vision=this.checked;save();render()"> <span>🗺️ Сделать карту желаний</span></label>
    <label class="habit"><input type="checkbox" ${user().goals.wishlist?"checked":""} onchange="user().goals.wishlist=this.checked;save();render()"> <span>📝 Составить список желаний</span></label>
   </div>`;
}
function toggleSocial(x,v){const a=user().goals.socials;if(v&&!a.includes(x))a.push(x);if(!v){const i=a.indexOf(x);if(i>=0)a.splice(i,1)}save()}
function openModal(html){document.getElementById("modalContent").innerHTML=html;document.getElementById("modal").classList.remove("hidden")}
function closeModal(){document.getElementById("modal").classList.add("hidden")}
function toast(t){const x=document.createElement("div");x.className="toast";x.textContent=t;document.body.appendChild(x);setTimeout(()=>x.remove(),1800)}
document.getElementById("modalClose").onclick=closeModal;
document.getElementById("modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>{currentView=b.dataset.view;render()});
document.getElementById("profileBtn").onclick=()=>openModal(`<h2>👤 Профиль</h2><p>Выбери пользователя.</p>${Object.keys(state.users).map(n=>`<button class="btn ${n===state.active?"":"secondary"}" style="width:100%;margin:6px 0" onclick="state.active='${n}';save();closeModal();render()">${n}</button>`).join("")}<hr><p class="muted">Сейчас локальная версия хранит данные только в этом браузере. Для совместной работы через интернет следующим этапом подключается Supabase.</p>`);
render();
