import { LifeDB, LifeFirebase } from "./data.js?v=18";

const state = {
  balance: 0,
  people: [],
  events: [],
  habits: [],
  goals: [],
  wishes: [],
  transactions: [],
  notes: [],
  journal: [],
  tasks: [],
  projects: [],
  subscriptions: [],
  assets: [],
  profile: null
};

let currentPage = "home";
let currentContext = null;
let toastTimer = null;

const pageMeta = {
  finances:["MONEY","Finances"], goals:["DIRECTION","Goals & projects"], wishlist:["WANT","Wishlist"],
  family:["PEOPLE","People & relationships"], journal:["MEMORY","Journal"], notes:["CAPTURE","Notes"],
  habits:["SYSTEMS","Habits & routines"], calendar:["TIME","Plan"], vault:["PRIVATE","Private vault"],
  documents:["ASSETS","Documents"], health:["WELLBEING","Wellbeing"], "life-plan":["VISION","Life plan"],
  tasks:["ACTION","Tasks"], assets:["LIFE ADMIN","Assets & subscriptions"], reminders:["ATTENTION","Reminders"],
  insights:["REFLECTION","Life insights"], settings:["CONTROL","Settings"]
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function esc(v){
  return String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function money(n){ return "₹" + Number(n || 0).toLocaleString("en-IN"); }
function uid(prefix){ return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
function now(){ return new Date().toISOString(); }
function fmtDate(v){
  if(!v) return "Not scheduled";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) :
    d.toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
}
function toast(msg){
  const el=$("#toast");
  if(!el) return;
  el.textContent=msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove("show"),2300);
}
function fireError(error){
  return LifeFirebase?.firebaseError ? LifeFirebase.firebaseError(error) : (error?.message || "Firebase request failed.");
}

async function create(store, record){
  if(!LifeDB?.create) throw new Error("Firebase data service is unavailable.");
  return LifeDB.create(store, {...record, id:record.id || uid(store.replace(/s$/,""))});
}
async function link(fromType,fromId,relation,toType,toId){
  return LifeDB.link(fromType,fromId,relation,toType,toId);
}

async function hydrate(){
  try{
    const stored = await LifeDB.initialize();
    Object.assign(state, stored);
    state.subscriptions = await LifeDB.all("subscriptions");
    state.assets = await LifeDB.all("assets");
    state.profile = await LifeDB.getUserProfile();
    if(!state.profile){
      state.profile = {displayName:"Arish",createdAt:now()};
      await LifeDB.saveUserProfile(state.profile);
    }
    subscribeLiveState();
  }catch(error){
    console.error("Firebase bootstrap failed:",error);
    toast(fireError(error));
  }
}

function subscribeLiveState(){
  const map = {
    people:"people", projects:"projects", goals:"goals", wishes:"wishlist",
    transactions:"transactions", notes:"notes", journal:"journal",
    tasks:"tasks", events:"events", habits:"habits",
    subscriptions:"subscriptions", assets:"assets"
  };
  Object.entries(map).forEach(([stateKey,store])=>{
    LifeDB.subscribe(store,(rows,error)=>{
      if(error){ console.error(`Live ${store} failed`,error); return; }
      state[stateKey]=rows;
      if(store==="transactions"){
        const income=rows.filter(x=>x.type==="in").reduce((a,x)=>a+Number(x.amount||0),0);
        const expense=rows.filter(x=>x.type==="out").reduce((a,x)=>a+Math.abs(Number(x.amount||0)),0);
        state.balance=income-expense;
      }
      updateHome();
      if(currentPage!=="home") refreshCurrentView();
    });
  });
}

function greeting(){
  const h=new Date().getHours();
  $("#greeting").textContent=h<12?"GOOD MORNING":h<18?"GOOD AFTERNOON":"GOOD EVENING";
  $("#dailyQuote").textContent=[
    "A calm life is built, not found.",
    "Make today easier for tomorrow-you.",
    "Small systems create a bigger life.",
    "Protect your attention like you protect your money."
  ][new Date().getDate()%4];
}

function updateHome(){
  $("#balance").textContent=money(state.balance);
  $("#goalCount").textContent=state.goals.length;
  $("#wishCount").textContent=state.wishes.length;
  $("#familyCount").textContent=state.people.length;
  renderToday();
  renderUpcoming();
  renderAttention();
  renderPulse();
}

function renderToday(){
  const box=$("#todayFocusItems"); if(!box)return;
  const nowDate=new Date();
  const overdue=state.tasks.filter(t=>!t.done&&t.dueAt&&new Date(t.dueAt)<nowDate).sort((a,b)=>new Date(a.dueAt)-new Date(b.dueAt));
  const today=state.tasks.filter(t=>!t.done&&t.dueAt&&new Date(t.dueAt).toDateString()===nowDate.toDateString());
  const events=state.events.filter(e=>e.startAt&&new Date(e.startAt)>=nowDate).sort((a,b)=>new Date(a.startAt)-new Date(b.startAt));
  const main=[...overdue,...today,...events].slice(0,6);
  const summary=`<div class="today-summary"><span><b>${overdue.length}</b><small>Overdue</small></span><span><b>${today.length}</b><small>Today</small></span><span><b>${events.filter(e=>(new Date(e.startAt)-nowDate)/36e5<=48).length}</b><small>48h</small></span><span><b>${state.goals.filter(g=>Number(g.progress||0)<100).length}</b><small>Goals</small></span></div>`;
  const rows=main.length?main.map(x=>{
    const type=x.startAt?"event":"task", meta=x.startAt?fmtDate(x.startAt):(x.dueAt?fmtDate(x.dueAt):"Next action");
    return `<button class="focus-item" data-open-record="${type}" data-id="${esc(x.id)}"><span>${type==="task"?"○":"◷"}</span><b>${esc(x.title)}</b><small>${esc(meta)}</small></button>`;
  }).join(""):`<button class="today-empty" id="todayEmptyAdd"><span>＋</span><strong>No plans yet</strong><small>Add a task or event</small></button>`;
  box.innerHTML=summary+rows;
}

function renderUpcoming(){
  const box=$("#upcomingItems");
  if(!box) return;
  const events=state.events.filter(e=>e.startAt && new Date(e.startAt)>=new Date())
    .sort((a,b)=>new Date(a.startAt)-new Date(b.startAt)).slice(0,3);
  box.innerHTML=events.length ? events.map(e=>{
    const d=new Date(e.startAt);
    return `<button class="upcoming glass" data-open-record="event" data-id="${esc(e.id)}">
      <span class="date-pill">${d.getDate()}<br><small>${d.toLocaleString("en",{month:"short"}).toUpperCase()}</small></span>
      <div><b>${esc(e.title)}</b><small>${esc(fmtDate(e.startAt))}</small></div>
    </button>`;
  }).join("") :
  `<div class="empty"><strong>Nothing upcoming</strong><span>Add an event when something matters.</span></div>`;
}

function attentionItems(){
  const nowDate=new Date(), items=[];
  const push=(priority,type,title,meta,id)=>items.push({priority,type,title,meta,id});
  state.tasks.filter(t=>!t.done).forEach(t=>{
    if(!t.dueAt){push(1,"task",t.title,"Open task",t.id);return;}
    const d=new Date(t.dueAt); if(Number.isNaN(d.getTime())) return;
    const hrs=(d-nowDate)/36e5;
    if(hrs<0) push(5,"task",t.title,`Overdue · ${fmtDate(t.dueAt)}`,t.id);
    else if(hrs<=24) push(4,"task",t.title,`Due today · ${fmtDate(t.dueAt)}`,t.id);
    else if(hrs<=72) push(2,"task",t.title,`Due soon · ${fmtDate(t.dueAt)}`,t.id);
  });
  state.events.forEach(e=>{
    const d=e.startAt?new Date(e.startAt):null; if(!d||Number.isNaN(d.getTime())) return;
    const hrs=(d-nowDate)/36e5; if(hrs>=0&&hrs<=48) push(3,"event",e.title,`Coming up · ${fmtDate(e.startAt)}`,e.id);
  });
  state.subscriptions.forEach(s=>{
    const d=s.renewalDate?new Date(s.renewalDate):null; if(!d||Number.isNaN(d.getTime())) return;
    const days=(d-nowDate)/864e5; if(days>=-1&&days<=7) push(3,"subscription",s.name||s.title,`Renewal · ${fmtDate(s.renewalDate)}`,s.id);
  });
  state.people.forEach(p=>{
    if(!p.birthday)return; const b=new Date(p.birthday); if(Number.isNaN(b.getTime()))return;
    const d=new Date(nowDate.getFullYear(),b.getMonth(),b.getDate()); let days=Math.round((d-nowDate)/864e5); if(days<0)days+=365;
    if(days<=14)push(2,"person",p.name||"Birthday",`Birthday · ${d.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}`,p.id);
  });
  state.goals.forEach(g=>{
    if(!g.targetDate)return; const d=new Date(g.targetDate); if(Number.isNaN(d.getTime()))return;
    const days=(d-nowDate)/864e5; if(days>=0&&days<=14&&Number(g.progress||0)<100)push(4,"goal",g.title,`Deadline · ${fmtDate(g.targetDate)}`,g.id);
  });
  return items.sort((a,b)=>b.priority-a.priority).slice(0,8);
}
function renderAttention(){
  const items=attentionItems();
  if(!items.length){
    $("#attentionTitle").textContent="Your attention queue is empty";
    $("#attentionText").textContent="Nothing urgent is asking for you right now.";
    $("#attentionCard")?.classList.remove("attention-hot");
    return;
  }
  $("#attentionTitle").textContent=`${items.length} things worth checking`;
  $("#attentionText").textContent=items.slice(0,2).map(x=>x.title).join(" · ");
  $("#attentionCard")?.classList.add("attention-hot");
}

function renderPulse(){
  const moneyScore=state.transactions.length ? Math.max(0,Math.min(100,Math.round((state.balance||0)/1000))) : 0;
  const goalScore=state.goals.length ? Math.round(state.goals.reduce((a,g)=>a+Number(g.progress||0),0)/state.goals.length) : 0;
  const habitScore=state.habits.length ? 100 : 0;
  const peopleScore=Math.min(100,state.people.length*10);
  const avg=Math.round((moneyScore+goalScore+habitScore+peopleScore)/4);
  $("#pulseScore").textContent=`${avg}%`;
  $("#pulseBar").style.width=`${avg}%`;
  $("#pulseMoney").textContent=moneyScore;
  $("#pulseGoals").textContent=goalScore;
  $("#pulseHabits").textContent=habitScore;
  $("#pulsePeople").textContent=peopleScore;
}

function openDrawer(){ $("#drawer").classList.add("open"); }
function closeDrawer(){ $("#drawer").classList.remove("open"); }
function openSearch(){
  $("#searchOverlay").classList.add("open");
  $("#searchOverlay").setAttribute("aria-hidden","false");
  $("#globalSearch").focus();
  $("#searchResults").innerHTML=`<div class="empty"><strong>Search your life</strong><span>People, goals, tasks, money, notes and more.</span></div>`;
}
function closeSearch(){
  $("#searchOverlay").classList.remove("open");
  $("#searchOverlay").setAttribute("aria-hidden","true");
}
async function searchRecords(queryText){
  const box=$("#searchResults");
  const q=String(queryText||"").trim();
  if(!q){ box.innerHTML=`<div class="empty"><strong>Search your life</strong><span>People, goals, tasks, money, notes and more.</span></div>`; return; }
  box.innerHTML=`<div class="search-loading">Searching…</div>`;
  try{
    const results=await LifeDB.search(q);
    box.innerHTML=results.length ? results.map(r=>`
      <button class="search-result" data-result-store="${esc(r.store)}" data-result-id="${esc(r.id)}">
        <span class="search-result-type">${esc(r.type)}</span><b>${esc(r.title)}</b>${r.subtitle?`<small>${esc(r.subtitle)}</small>`:""}
      </button>`).join("") :
      `<div class="empty"><strong>Nothing found</strong><span>Try another name, title or amount.</span></div>`;
  }catch(error){ box.innerHTML=`<div class="empty"><strong>Search failed</strong><span>${esc(fireError(error))}</span></div>`; }
}

function openPage(page){
  if(page==="home"){ closePage(); return; }
  currentPage=page;
  closeDrawer();
  const meta=pageMeta[page]||["LIFE","Life Hub"];
  $("#pageKicker").textContent=meta[0]; $("#pageTitle").textContent=meta[1];
  $("#pageLayer").classList.add("open");
  $("#pageLayer").setAttribute("aria-hidden","false");
  renderPage(page);
}
function closePage(){
  currentContext=null;
  $("#pageLayer").classList.remove("open");
  $("#pageLayer").setAttribute("aria-hidden","true");
}
function shellIntro(title,desc){
  return `<div class="page-hero"><span class="section-kicker">LIFE HUB</span><h3>${esc(title)}</h3><p>${esc(desc)}</p></div>`;
}

function renderPage(page){
  const renderers={
    finances:renderFinances,goals:renderGoals,wishlist:renderWishlist,family:renderFamily,
    journal:renderJournal,notes:renderNotes,habits:renderHabits,calendar:renderCalendar,
    vault:renderVault,documents:renderDocuments,health:renderHealth,"life-plan":renderLifePlan,
    tasks:renderTasks,assets:renderAssets,reminders:renderReminders,insights:renderInsights,settings:renderSettings
  };
  $("#pageContent").innerHTML=(renderers[page]||renderGeneric)();
  $("#pageAction").onclick=()=>openAddFor(page);
  bindDynamic();
}

function renderGoals(){
  const goals=state.goals;
  const rows=goals.length?goals.map(g=>`
    <div class="list-row glass entity-row">
      <div class="main-copy"><span class="tag">${esc(g.area||"GOAL")}</span><b>${esc(g.title)}</b><small>${esc(g.target||"")}</small>
      <div class="progress"><span style="width:${Number(g.progress||0)}%"></span></div></div>
      <div class="entity-actions"><span class="value positive">${Number(g.progress||0)}%</span><button class="mini-action" data-open-goal="${esc(g.id)}">Open</button><button class="mini-action" data-edit-store="goals" data-edit-id="${esc(g.id)}">Edit</button><button class="mini-action danger-mini" data-delete-store="goals" data-delete-id="${esc(g.id)}" data-delete-label="goal">Delete</button></div>
    </div>`).join("") :
    `<div class="empty glass"><strong>No goals yet</strong><span>Create an outcome, then add projects, tasks and events.</span></div>`;
  return shellIntro("Goals that move your life","Goals are outcomes. Projects are the work. Tasks are the next actions.")
    +`<div class="action-row"><button class="primary" id="newGoalBtn">+ New goal</button></div><div class="list">${rows}</div>`;
}

function renderGoalDetail(id){
  const goal=state.goals.find(g=>g.id===id);
  if(!goal) return renderGoals();
  currentContext={type:"goal",id};
  const projects=state.projects.filter(p=>p.goalId===id);
  const tasks=state.tasks.filter(t=>t.goalId===id || projects.some(p=>p.id===t.projectId));
  const events=state.events.filter(e=>e.goalId===id || projects.some(p=>p.id===e.projectId));
  return shellIntro(goal.title,goal.target||"Goal")
    +`<div class="data-grid">
      <div class="data-card glass"><small>PROGRESS</small><b>${Number(goal.progress||0)}%</b></div>
      <div class="data-card glass"><small>PROJECTS</small><b>${projects.length}</b></div>
      <div class="data-card glass"><small>OPEN TASKS</small><b>${tasks.filter(t=>!t.done).length}</b></div>
      <div class="data-card glass"><small>EVENTS</small><b>${events.length}</b></div>
    </div>
    <div class="action-row"><button class="primary" id="addProjectBtn">+ Project</button><button class="secondary" id="addGoalTaskBtn">+ Task</button><button class="secondary" id="addGoalEventBtn">+ Event</button></div>
    <div class="section-mini"><span class="section-kicker">PROJECTS</span><h4>Work inside this goal</h4></div>
    <div class="list">${projects.length?projects.map(p=>`
      <button class="list-row glass project-row" data-open-project="${esc(p.id)}">
        <div class="main-copy"><b>${esc(p.title)}</b><small>${esc(p.description||"")}</small></div><span class="value">${tasks.filter(t=>t.projectId===p.id).length} tasks</span>
      </button>`).join(""):`<div class="empty glass"><strong>No projects yet</strong><span>Add the first project that moves this goal.</span></div>`}</div>
    <div class="section-mini"><span class="section-kicker">NEXT ACTIONS</span><h4>Concrete things to do</h4></div>
    <div class="list">${tasks.length?tasks.map(t=>`
      <div class="list-row glass"><div class="main-copy"><b>${esc(t.title)}</b><small>${esc(t.projectId?"Project action":"Goal action")}</small></div>
      <div class="entity-actions"><button class="check task-toggle ${t.done?"completed":""}" data-task-id="${esc(t.id)}">${t.done?"✓":"○"}</button><button class="mini-action" data-edit-store="tasks" data-edit-id="${esc(t.id)}">Edit</button><button class="mini-action danger-mini" data-delete-store="tasks" data-delete-id="${esc(t.id)}" data-delete-label="task">Delete</button></div></div>`).join(""):`<div class="empty glass"><strong>No tasks yet</strong><span>Create the next physical action.</span></div>`}</div>
    <div class="section-mini"><span class="section-kicker">TIME</span><h4>Events connected to this goal</h4></div>
    <div class="list">${events.length?events.map(e=>`<div class="list-row glass"><div class="main-copy"><b>${esc(e.title)}</b><small>${esc(fmtDate(e.startAt))}</small></div></div>`).join(""):`<div class="empty glass"><strong>No events yet</strong><span>Schedule a deadline, meeting, test or focus block.</span></div>`}</div>`;
}

function renderProjectDetail(id){
  const project=state.projects.find(p=>p.id===id);
  if(!project) return renderGoals();
  currentContext={type:"project",id};
  const tasks=state.tasks.filter(t=>t.projectId===id);
  const events=state.events.filter(e=>e.projectId===id);
  const goal=state.goals.find(g=>g.id===project.goalId);
  return shellIntro(project.title,project.description||"Project")
    +`<div class="data-grid">
      <div class="data-card glass"><small>GOAL</small><b>${esc(goal?.title||"—")}</b></div>
      <div class="data-card glass"><small>OPEN TASKS</small><b>${tasks.filter(t=>!t.done).length}</b></div>
      <div class="data-card glass"><small>DONE</small><b>${tasks.filter(t=>t.done).length}</b></div>
      <div class="data-card glass"><small>EVENTS</small><b>${events.length}</b></div>
    </div>
    <div class="action-row"><button class="primary" id="addProjectTaskBtn">+ Task</button><button class="secondary" id="addProjectEventBtn">+ Event</button></div>
    <div class="section-mini"><span class="section-kicker">TASKS</span><h4>Work to complete</h4></div>
    <div class="list">${tasks.length?tasks.map(t=>`<div class="list-row glass"><div class="main-copy"><b>${esc(t.title)}</b></div><div class="entity-actions"><button class="check task-toggle ${t.done?"completed":""}" data-task-id="${esc(t.id)}">${t.done?"✓":"○"}</button><button class="mini-action" data-edit-store="tasks" data-edit-id="${esc(t.id)}">Edit</button><button class="mini-action danger-mini" data-delete-store="tasks" data-delete-id="${esc(t.id)}" data-delete-label="task">Delete</button></div></div>`).join(""):`<div class="empty glass"><strong>No tasks yet</strong><span>Add the first concrete action.</span></div>`}</div>
    <div class="section-mini"><span class="section-kicker">EVENTS</span><h4>Time commitments</h4></div>
    <div class="list">${events.length?events.map(e=>`<div class="list-row glass"><div class="main-copy"><b>${esc(e.title)}</b><small>${esc(fmtDate(e.startAt))}</small></div></div>`).join(""):`<div class="empty glass"><strong>No events yet</strong><span>Add a deadline, meeting or focused block.</span></div>`}</div>`;
}

function renderTasks(){
  const rows=state.tasks.map(t=>`
    <div class="list-row glass"><div class="main-copy"><b>${esc(t.title)}</b><small>${esc(t.goalId?"Goal-linked":t.projectId?"Project-linked":"Standalone")}${t.dueAt?" · "+esc(fmtDate(t.dueAt)):""}</small></div>
    <div class="entity-actions"><button class="check task-toggle ${t.done?"completed":""}" data-task-id="${esc(t.id)}">${t.done?"✓":"○"}</button><button class="mini-action" data-edit-store="tasks" data-edit-id="${esc(t.id)}">Edit</button><button class="mini-action danger-mini" data-delete-store="tasks" data-delete-id="${esc(t.id)}" data-delete-label="task">Delete</button></div></div>`).join("");
  return shellIntro("Tasks that move things forward","Keep actions concrete, and link them when context helps.")
    +`<div class="action-row"><button class="primary" id="newTaskBtn">+ New task</button></div><div class="list">${rows||`<div class="empty glass"><strong>No tasks yet</strong><span>Add one clear next action.</span></div>`}</div>`;
}

function renderCalendar(){
  const events=state.events.slice().sort((a,b)=>String(a.startAt||"").localeCompare(String(b.startAt||"")));
  const rows=events.map(e=>`<div class="list-row glass"><button class="main-copy entity-main-button" data-open-record="event" data-id="${esc(e.id)}"><b>${esc(e.title)}</b><small>${esc(fmtDate(e.startAt))}</small></button><div class="entity-actions"><button class="mini-action" data-edit-store="events" data-edit-id="${esc(e.id)}">Edit</button><button class="mini-action danger-mini" data-delete-store="events" data-delete-id="${esc(e.id)}" data-delete-label="event">Delete</button></div></div>`).join("");
  return shellIntro("Plan the time that makes the rest possible","Events can connect to goals, projects and people.")
    +`<div class="action-row"><button class="primary" id="newEventBtn">+ New event</button></div><div class="list">${rows||`<div class="empty glass"><strong>No events yet</strong><span>Add a commitment, deadline or meaningful date.</span></div>`}</div>`;
}

function renderWishlist(){
  const rows=state.wishes.map(w=>`<div class="list-row glass">
    <div class="main-copy"><b>${esc(w.title)}</b><small>${esc(w.priority||"Unprioritized")} · ${w.price?money(w.price):"No price"}</small></div>
    <div class="entity-actions"><span class="value">${w.purchased?"Purchased":w.goalId?"Funded":"Unfunded"}</span>
      <button class="mini-action" data-fund-wish="${esc(w.id)}">${w.goalId?"Goal":"Fund it"}</button><button class="mini-action" data-edit-store="wishlist" data-edit-id="${esc(w.id)}">Edit</button><button class="mini-action danger-mini" data-delete-store="wishlist" data-delete-id="${esc(w.id)}" data-delete-label="wishlist item">Delete</button>
      ${!w.purchased?`<button class="mini-action" data-buy-wish="${esc(w.id)}">Purchase</button>`:""}
    </div>
  </div>`).join("");
  return shellIntro("Things worth having","Wishlist items can become savings goals, then real purchase transactions.")
    +`<div class="action-row"><button class="primary" id="newWishBtn">+ Add to wishlist</button></div><div class="list">${rows||`<div class="empty glass"><strong>Wishlist is empty</strong><span>Save a want without turning it into a commitment yet.</span></div>`}</div>`;
}

function renderFinances(){
  const tx=state.transactions;
  const income=tx.filter(x=>x.type==="in").reduce((a,x)=>a+Number(x.amount||0),0);
  const expense=tx.filter(x=>x.type==="out").reduce((a,x)=>a+Math.abs(Number(x.amount||0)),0);
  const rows=tx.slice().reverse().map(x=>`<div class="list-row glass"><div class="main-copy"><b>${esc(x.title)}</b><small>${esc(x.cat||"General")}${x.relatedWishlistId?" · Wishlist purchase":""}</small></div><span class="value ${x.type==="in"?"positive":"negative"}">${x.type==="in"?"+":"-"}${money(Math.abs(x.amount||0))}</span></div>`).join("");
  const subscriptions=state.subscriptions.map(s=>`<div class="list-row glass"><div class="main-copy"><b>${esc(s.name||s.title)}</b><small>${esc(s.frequency||"Recurring")} · ${money(s.amount||0)}</small></div><div class="entity-actions"><span class="value">Renewal</span><button class="mini-action" data-edit-store="subscriptions" data-edit-id="${esc(s.id)}">Edit</button><button class="mini-action danger-mini" data-delete-store="subscriptions" data-delete-id="${esc(s.id)}" data-delete-label="subscription">Delete</button></div></div>`).join("");
  return shellIntro("Money with context","Income, expenses, savings and recurring obligations in one place.")
    +`<div class="data-grid"><div class="data-card glass"><small>BALANCE</small><b>${money(state.balance)}</b></div><div class="data-card glass"><small>INCOME</small><b>${money(income)}</b></div><div class="data-card glass"><small>SPENT</small><b>${money(expense)}</b></div><div class="data-card glass"><small>NET</small><b>${money(income-expense)}</b></div></div>
    <div class="action-row"><button class="primary" id="addExpense">+ Expense</button><button class="secondary" id="addIncome">+ Income</button><button class="secondary" id="newSubscriptionBtn">+ Subscription</button></div>
    <div class="section-mini"><span class="section-kicker">TRANSACTIONS</span><h4>Money movement</h4></div>
    <div class="list">${rows||`<div class="empty glass"><strong>No transactions yet</strong><span>Add income or spending.</span></div>`}</div>
    <div class="section-mini"><span class="section-kicker">RECURRING</span><h4>Subscriptions</h4></div>
    <div class="list">${subscriptions||`<div class="empty glass"><strong>No subscriptions</strong><span>Add recurring services so renewals become visible.</span></div>`}</div>`;
}

function renderFamily(){
  const rows=state.people.map(p=>`<div class="list-row glass"><button class="main-copy entity-main-button" data-open-person="${esc(p.id)}"><b>${esc(p.name||p.title)}</b><small>${esc(p.relationship||"Person")}</small></button><div class="entity-actions"><button class="mini-action" data-edit-store="people" data-edit-id="${esc(p.id)}">Edit</button><button class="mini-action danger-mini" data-delete-store="people" data-delete-id="${esc(p.id)}" data-delete-label="person">Delete</button></div></div>`).join("");
  return shellIntro("People who matter","People are first-class records that can connect to events, notes and follow-ups.")
    +`<div class="action-row"><button class="primary" id="newPersonBtn">+ Add person</button></div><div class="list">${rows||`<div class="empty glass"><strong>No people yet</strong><span>Add someone when you want their information to have a home.</span></div>`}</div>`;
}

function renderPersonDetail(id){
  const person=state.people.find(p=>p.id===id);
  if(!person) return renderFamily();
  currentContext={type:"person",id};
  const events=state.events.filter(e=>e.personId===id);
  return shellIntro(person.name||"Person",person.relationship||"Relationship")
    +`<div class="data-grid"><div class="data-card glass"><small>RELATIONSHIP</small><b>${esc(person.relationship||"—")}</b></div><div class="data-card glass"><small>EVENTS</small><b>${events.length}</b></div></div>
    <div class="action-row"><button class="primary" id="addPersonEventBtn">+ Event</button><button class="secondary" id="addPersonTaskBtn">+ Task</button></div>
    <div class="section-mini"><span class="section-kicker">EVENTS</span><h4>Shared dates</h4></div>
    <div class="list">${events.length?events.map(e=>`<div class="list-row glass"><div class="main-copy"><b>${esc(e.title)}</b><small>${esc(fmtDate(e.startAt))}</small></div></div>`).join(""):`<div class="empty glass"><strong>No events yet</strong><span>Add a birthday, meeting or plan.</span></div>`}</div>`;
}

function renderNotes(){
  const rows=state.notes.map(n=>`<div class="list-row glass"><div class="main-copy"><b>${esc(n.title)}</b><small>${esc(n.text||"")}</small></div><div class="entity-actions"><button class="mini-action" data-edit-store="notes" data-edit-id="${esc(n.id)}">Edit</button><button class="mini-action danger-mini" data-delete-store="notes" data-delete-id="${esc(n.id)}" data-delete-label="note">Delete</button></div></div>`).join("");
  return shellIntro("Capture once, find forever","Quick notes stay searchable and can later connect to goals or people.")
    +`<div class="action-row"><button class="primary" id="newNoteBtn">+ New note</button></div><div class="list">${rows||`<div class="empty glass"><strong>No notes yet</strong><span>Capture an idea whenever it appears.</span></div>`}</div>`;
}

function renderJournal(){
  const rows=state.journal.map(e=>`<div class="list-row glass"><div class="main-copy"><b>${esc(e.title)}</b><small>${esc(e.date||"")}</small><p class="journal-snippet">${esc(e.text||"")}</p></div><div class="entity-actions"><button class="mini-action" data-edit-store="journal" data-edit-id="${esc(e.id)}">Edit</button><button class="mini-action danger-mini" data-delete-store="journal" data-delete-id="${esc(e.id)}" data-delete-label="journal entry">Delete</button></div></div>`).join("");
  return shellIntro("Your private memory","Reflections, lessons and memories that become part of your life history.")
    +`<div class="action-row"><button class="primary" id="newJournalBtn">+ New entry</button></div><div class="list">${rows||`<div class="empty glass"><strong>No journal entries</strong><span>Write when you have something worth remembering.</span></div>`}</div>`;
}

function renderHabits(){
  const rows=state.habits.map(h=>`<div class="list-row glass"><div class="main-copy"><b>${esc(h.title)}</b><small>${esc(h.frequency||"Recurring")}</small></div><span class="value">${Number(h.streak||0)}d</span></div>`).join("");
  return shellIntro("Build the person you want to be","Habits are recurring systems that can support a larger goal.")
    +`<div class="action-row"><button class="primary" id="newHabitBtn">+ New habit</button></div><div class="list">${rows||`<div class="empty glass"><strong>No habits yet</strong><span>Add a routine only when it deserves attention.</span></div>`}</div>`;
}

function renderAssets(){
  const rows=state.assets.map(a=>`<div class="list-row glass"><div class="main-copy"><b>${esc(a.name||a.title)}</b><small>${esc(a.category||"Asset")}</small></div><div class="entity-actions"><span class="value">${a.value?money(a.value):""}</span><button class="mini-action" data-edit-store="assets" data-edit-id="${esc(a.id)}">Edit</button><button class="mini-action danger-mini" data-delete-store="assets" data-delete-id="${esc(a.id)}" data-delete-label="asset">Delete</button></div></div>`).join("");
  const subs=state.subscriptions.map(s=>`<div class="list-row glass"><div class="main-copy"><b>${esc(s.name||s.title)}</b><small>${esc(s.frequency||"Recurring")} · ${money(s.amount||0)}</small></div><span class="value">${esc(s.renewalDate||"")}</span></div>`).join("");
  return shellIntro("Know what you own and what bills you","Assets, subscriptions, warranties and recurring commitments.")
    +`<div class="action-row"><button class="primary" id="newAssetBtn">+ Asset</button><button class="secondary" id="newSubscriptionBtn">+ Subscription</button></div>
      <div class="section-mini"><span class="section-kicker">ASSETS</span><h4>What you own</h4></div>
      <div class="list">${rows||`<div class="empty glass"><strong>No assets yet</strong><span>Add devices, vehicles, valuables or other important assets.</span></div>`}</div>
      <div class="section-mini"><span class="section-kicker">RECURRING</span><h4>Subscriptions</h4></div>
      <div class="list">${subs||`<div class="empty glass"><strong>No subscriptions</strong><span>Add recurring services and renewal dates.</span></div>`}</div>`;
}

function renderLifePlan(){
  const profile=state.profile||{};
  return shellIntro("Design the life behind the dashboard","Values, direction and long-range priorities sit above daily tasks.")
    +`<div class="data-grid"><div class="data-card glass"><small>VALUES</small><b>${profile.values?profile.values.length:0}</b></div><div class="data-card glass"><small>ACTIVE GOALS</small><b>${state.goals.length}</b></div></div>
      <div class="action-row"><button class="primary" id="editLifePlanBtn">+ Add direction</button></div>
      <div class="empty glass"><strong>Your Life Plan is still yours to define</strong><span>Keep it broad: the kind of person you want to be, what matters, and what you are building toward.</span></div>`;
}

function renderInsights(){
  const completed=state.tasks.filter(t=>t.done).length;
  const open=state.tasks.filter(t=>!t.done).length;
  const avgGoal=state.goals.length?Math.round(state.goals.reduce((a,g)=>a+Number(g.progress||0),0)/state.goals.length):0;
  return shellIntro("See patterns, not noise","Insights are derived from your actual Firestore records.")
    +`<div class="data-grid"><div class="data-card glass"><small>GOAL PROGRESS</small><b>${avgGoal}%</b></div><div class="data-card glass"><small>OPEN TASKS</small><b>${open}</b></div><div class="data-card glass"><small>COMPLETED</small><b>${completed}</b></div><div class="data-card glass"><small>UPCOMING EVENTS</small><b>${state.events.filter(e=>e.startAt&&new Date(e.startAt)>=new Date()).length}</b></div></div>`;
}


function renderRelationships(){
  const nodes=[["GOALS",state.goals.length,"goals"],["PROJECTS",state.projects.length,"goals"],["TASKS",state.tasks.length,"tasks"],["EVENTS",state.events.length,"calendar"],["PEOPLE",state.people.length,"family"],["MONEY",state.transactions.length,"finances"],["WISHLIST",state.wishes.length,"wishlist"],["NOTES",state.notes.length,"notes"]];
  const rel=[["Goal → Projects",state.projects.filter(p=>p.goalId).length],["Project → Tasks",state.tasks.filter(t=>t.projectId).length],["Goal → Tasks",state.tasks.filter(t=>t.goalId).length],["Goal → Events",state.events.filter(e=>e.goalId).length],["Person → Events",state.events.filter(e=>e.personId).length],["Wishlist → Purchases",state.transactions.filter(t=>t.relatedWishlistId).length]];
  return shellIntro("See how your life connects","Relationships are first-class records, not hidden links.")
    +`<div class="relationship-graph">${nodes.map(n=>`<button class="relation-node glass" data-page="${esc(n[2])}"><span>${esc(n[0])}</span><b>${n[1]}</b></button>`).join("")}</div>
    <div class="section-mini"><span class="section-kicker">RELATIONSHIPS</span><h4>Connected records</h4></div>
    <div class="list">${rel.map(r=>`<div class="list-row glass"><div class="main-copy"><b>${esc(r[0])}</b><small>Linked records</small></div><span class="value">${r[1]}</span></div>`).join("")}</div>`;
}
function renderMoneyPlan(){
  const income=state.transactions.filter(x=>x.type==="in").reduce((a,x)=>a+Number(x.amount||0),0);
  const expense=state.transactions.filter(x=>x.type==="out").reduce((a,x)=>a+Math.abs(Number(x.amount||0)),0);
  const recurring=state.subscriptions.reduce((a,x)=>a+Number(x.amount||0),0);
  return shellIntro("Money plan","Accounts, recurring commitments and goals in one financial context.")
    +`<div class="data-grid"><div class="data-card glass"><small>BALANCE</small><b>${money(state.balance)}</b></div><div class="data-card glass"><small>RECURRING</small><b>${money(recurring)}</b></div><div class="data-card glass"><small>IN</small><b>${money(income)}</b></div><div class="data-card glass"><small>OUT</small><b>${money(expense)}</b></div></div>
    <div class="action-row"><button class="primary" id="newAccountBtn">+ Account</button><button class="secondary" id="newBudgetBtn">+ Budget</button></div>
    <div class="list">${state.accounts.length?state.accounts.map(a=>`<div class="list-row glass"><div class="main-copy"><b>${esc(a.name)}</b><small>${esc(a.type||"Account")}</small></div><span class="value">${money(a.balance||0)}</span></div>`).join(""):`<div class="empty glass"><strong>No accounts yet</strong><span>Add HDFC, Axis, cash, cards or other real buckets.</span></div>`}</div>`;
}
function renderRoutines(){
  const rows=state.routines.map(r=>`<div class="list-row glass"><div class="main-copy"><b>${esc(r.title)}</b><small>${esc(r.frequency||"Routine")}</small></div><div class="entity-actions"><button class="mini-action" data-toggle-routine="${esc(r.id)}">${r.enabled===false?"Enable":"Pause"}</button><button class="mini-action danger-mini" data-delete-store="routines" data-delete-id="${esc(r.id)}" data-delete-label="routine">Delete</button></div></div>`).join("");
  return shellIntro("Routines","Repeatable sequences that shape your days.")+`<div class="action-row"><button class="primary" id="newRoutineBtn">+ Routine</button></div><div class="list">${rows||`<div class="empty glass"><strong>No routines yet</strong><span>Add a morning, work, evening or weekly reset routine.</span></div>`}</div>`;
}
function renderLifeReview(){
  const done=state.tasks.filter(t=>t.done).length, open=state.tasks.filter(t=>!t.done).length;
  const avg=state.goals.length?Math.round(state.goals.reduce((a,g)=>a+Number(g.progress||0),0)/state.goals.length):0;
  const net=state.transactions.reduce((a,x)=>a+Number(x.amount||0),0);
  return shellIntro("Life review","A simple mirror of your real progress, workload and money movement.")
    +`<div class="data-grid"><div class="data-card glass"><small>GOAL AVG</small><b>${avg}%</b></div><div class="data-card glass"><small>DONE</small><b>${done}</b></div><div class="data-card glass"><small>OPEN</small><b>${open}</b></div><div class="data-card glass"><small>NET</small><b>${money(net)}</b></div></div>
    <div class="list"><div class="list-row glass"><div class="main-copy"><b>What moved forward?</b><small>${done?`${done} completed task${done===1?"":"s"}.`:"Nothing completed yet."}</small></div></div>
    <div class="list-row glass"><div class="main-copy"><b>What is slipping?</b><small>${open?`${open} open task${open===1?"":"s"} remain.`:"No open tasks."}</small></div></div>
    <div class="list-row glass"><div class="main-copy"><b>What deserves more attention?</b><small>${attentionItems().slice(0,2).map(x=>x.title).join(" · ")||"Nothing urgent."}</small></div></div></div>`;
}


function renderReminders(){
  const rows=(state.reminders||[]).map(r=>`<div class="list-row glass">
    <div class="main-copy"><b>${esc(r.title)}</b><small>${esc(r.remindAt?fmtDate(r.remindAt):"No date")}${r.repeat?` · ${esc(r.repeat)}`:""}</small></div>
    <div class="entity-actions">
      <button class="mini-action" data-toggle-reminder="${esc(r.id)}">${r.enabled===false?"Off":"On"}</button>
      <button class="mini-action danger-mini" data-delete-store="reminders" data-delete-id="${esc(r.id)}" data-delete-label="reminder">Delete</button>
    </div>
  </div>`).join("");
  return shellIntro("Reminders","Simple reminders live in Firestore and are checked while Life Hub is open.")
    +`<div class="action-row"><button class="primary" id="newReminderBtn">+ Reminder</button><button class="secondary" id="notifyBtn">Enable notifications</button></div>
      <div class="list">${rows||`<div class="empty glass"><strong>No reminders yet</strong><span>Add a reminder when missing something would actually cost you.</span></div>`}</div>`;
}

function renderSettings(){
  const user=LifeFirebase?.getUser?.();
  return shellIntro("Make it yours","Life Hub is backed by Firebase Cloud Firestore.")
    +`<div class="list">
      <div class="list-row glass"><div class="main-copy"><b>Cloud database</b><small>Cloud Firestore is authoritative.</small></div><span class="value positive">Connected</span></div>
      <div class="list-row glass"><div class="main-copy"><b>Firebase identity</b><small>${user?`Authenticated · ${user.isAnonymous?"anonymous":"account"}`:"Not connected"}</small></div><span class="value ${user?"positive":"negative"}">${user?"Active":"Offline"}</span></div>
      <div class="list-row glass"><div class="main-copy"><b>Local development</b><small>Add <b>127.0.0.1</b> and <b>localhost</b> under Firebase → Authentication → Settings → Authorized domains for OAuth-ready local testing.</small></div><span class="value">Dev</span></div>
<div class="list-row glass"><div class="main-copy"><b>Password</b><small>Send a secure Firebase password-reset email to your account.</small></div><button class="mini-action" id="settingsResetPassword">Reset password</button></div>      <div class="list-row glass"><div class="main-copy"><b>Data model</b><small>Versioned entities and relationships.</small></div><span class="value positive">V4</span></div>
      <div class="list-row glass" id="exportRow"><div class="main-copy"><b>Export data</b><small>Download the complete Firestore snapshot as JSON.</small></div><span class="value">→</span></div>
<button class="settings-action-row glass" id="signOutRow" type="button">
        <div class="main-copy"><b>Sign out</b><small>Return to the Life Hub login page.</small></div>
        <span class="value">Sign out →</span>
      </button>
      <div class="list-row glass danger-row" id="resetRow"><div class="main-copy"><b>Reset all Life Hub data</b><small>Delete this user's local Firestore records.</small></div><span class="value negative">Reset</span></div>
    </div>`;
}

function renderVault(){
  return shellIntro("Private vault","Real secret storage stays disabled until encryption, key handling and a proper security model are implemented.")
    +`<div class="empty glass"><strong>Not enabled yet</strong><span>Keep passwords and recovery codes out of Life Hub for now.</span></div>`;
}
function renderDocuments(){
  return shellIntro("Important files","Document storage is the next data domain after the core daily loop.")
    +`<div class="empty glass"><strong>No documents yet</strong><span>Files will be wired once Storage and access rules are implemented.</span></div>`;
}
function renderHealth(){
  return shellIntro("Energy, not obsession","Track simple wellbeing signals only when they improve your daily system.")
    +`<div class="empty glass"><strong>No wellbeing records</strong><span>This area stays deliberately lightweight.</span></div>`;
}
function renderGeneric(){ return shellIntro("Ready when you are","This module becomes useful as its data model is connected."); }

function openModal(title,kicker,body){
  $("#modalTitle").textContent=title;
  $("#modalKicker").textContent=kicker;
  $("#modalBody").innerHTML=body;
  $("#modal").classList.add("open");
  $("#modal").setAttribute("aria-hidden","false");
  $$("[data-close-modal]").forEach(btn=>btn.onclick=closeModal);
}
function closeModal(){ $("#modal").classList.remove("open"); $("#modal").setAttribute("aria-hidden","true"); }

function goalOptions(selected=""){
  return `<option value="">No goal link</option>${state.goals.map(g=>`<option value="${esc(g.id)}" ${g.id===selected?"selected":""}>${esc(g.title)}</option>`).join("")}`;
}
function projectOptions(selected=""){
  return `<option value="">No project link</option>${state.projects.map(p=>`<option value="${esc(p.id)}" ${p.id===selected?"selected":""}>${esc(p.title)}</option>`).join("")}`;
}

function openQuickCapture(){
  openModal("What do you want to add?","QUICK CAPTURE",`
    <div class="capture-grid">
      <button class="capture-option" data-add="expense"><b>₹ Expense</b><small>Log spending</small></button>
      <button class="capture-option" data-add="income"><b>＋ Income</b><small>Log money in</small></button>
      <button class="capture-option" data-add="goal"><b>◎ Goal</b><small>Create an outcome</small></button>
      <button class="capture-option" data-add="project"><b>▱ Project</b><small>Work inside a goal</small></button>
      <button class="capture-option" data-add="task"><b>✓ Task</b><small>Add a next action</small></button>
      <button class="capture-option" data-add="event"><b>◷ Event</b><small>Put something on time</small></button>
      <button class="capture-option" data-add="wishlist"><b>♡ Wishlist</b><small>Save a future want</small></button>
      <button class="capture-option" data-add="person"><b>♧ Person</b><small>Add someone important</small></button>
      <button class="capture-option" data-add="note"><b>≡ Note</b><small>Capture an idea</small></button>
      <button class="capture-option" data-add="journal"><b>◫ Journal</b><small>Write a reflection</small></button>
    </div>`);
}

function openEntryForm(type){
  const actions=`<div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="saveForm">Save</button></div>`;
    reminder:["NEW REMINDER","Attention",`<div class="form"><div class="field"><label>REMINDER</label><input id="fTitle" placeholder="What do you want to remember?"></div><div class="field"><label>WHEN</label><input id="fDate" type="datetime-local"></div><div class="field"><label>REPEAT</label><select id="fRepeat"><option value="">One time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>${actions}</div>`],
  const forms={
    expense:["ADD EXPENSE","Money",`<div class="form"><div class="field"><label>WHAT?</label><input id="fTitle" placeholder="Groceries, fuel, bill..."></div><div class="field"><label>AMOUNT (₹)</label><input id="fAmount" type="number" min="0" placeholder="0"></div><div class="field"><label>CATEGORY</label><input id="fCat" placeholder="Living, travel, food..."></div>${actions}</div>`],
    income:["ADD INCOME","Money",`<div class="form"><div class="field"><label>WHAT?</label><input id="fTitle" placeholder="Salary, bonus, refund..."></div><div class="field"><label>AMOUNT (₹)</label><input id="fAmount" type="number" min="0" placeholder="0"></div>${actions}</div>`],
    goal:["NEW GOAL","Direction",`<div class="form"><div class="field"><label>GOAL</label><input id="fTitle" placeholder="What outcome do you want?"></div><div class="field"><label>WHY / TARGET</label><input id="fTarget" placeholder="Why it matters or what success means"></div><div class="field"><label>AREA</label><input id="fArea" placeholder="Career, money, family..."></div>${actions}</div>`],
    project:["NEW PROJECT","Goal",`<div class="form"><div class="field"><label>PROJECT</label><input id="fTitle" placeholder="What piece of work moves the goal?"></div><div class="field"><label>DESCRIPTION</label><input id="fDesc" placeholder="Outcome or scope"></div><div class="field"><label>GOAL</label><select id="fGoal">${goalOptions(currentContext?.type==="goal"?currentContext.id:"")}</select></div>${actions}</div>`],
    task:["NEW TASK","Action",`<div class="form"><div class="field"><label>NEXT ACTION</label><input id="fTitle" placeholder="What needs to happen?"></div><div class="field"><label>GOAL</label><select id="fGoal">${goalOptions(currentContext?.type==="goal"?currentContext.id:"")}</select></div><div class="field"><label>PROJECT</label><select id="fProject">${projectOptions(currentContext?.type==="project"?currentContext.id:"")}</select></div><div class="field"><label>DUE</label><input id="fDate" type="datetime-local"></div>${actions}</div>`],
    event:["NEW EVENT","Plan",`<div class="form"><div class="field"><label>EVENT</label><input id="fTitle" placeholder="Test drive, birthday, meeting..."></div><div class="field"><label>DATE / TIME</label><input id="fDate" type="datetime-local"></div><div class="field"><label>GOAL</label><select id="fGoal">${goalOptions(currentContext?.type==="goal"?currentContext.id:"")}</select></div><div class="field"><label>PROJECT</label><select id="fProject">${projectOptions(currentContext?.type==="project"?currentContext.id:"")}</select></div><div class="field"><label>PERSON</label><select id="fPerson"><option value="">No person link</option>${state.people.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></div>${actions}</div>`],
    wishlist:["WISHLIST ITEM","Want",`<div class="form"><div class="field"><label>ITEM</label><input id="fTitle" placeholder="What do you want?"></div><div class="field"><label>PRICE (₹)</label><input id="fAmount" type="number" min="0" placeholder="0"></div><div class="field"><label>PRIORITY</label><select id="fCat"><option>High</option><option>Medium</option><option>Low</option></select></div>${actions}</div>`],
    person:["ADD PERSON","People",`<div class="form"><div class="field"><label>NAME</label><input id="fTitle" placeholder="Name"></div><div class="field"><label>RELATIONSHIP</label><input id="fRelation" placeholder="Family, friend, colleague..."></div>${actions}</div>`],
    note:["QUICK NOTE","Capture",`<div class="form"><div class="field"><label>TITLE</label><input id="fTitle" placeholder="Note title"></div><div class="field"><label>NOTE</label><textarea id="fText" placeholder="Write anything..."></textarea></div>${actions}</div>`],
    journal:["JOURNAL ENTRY","Memory",`<div class="form"><div class="field"><label>TITLE</label><input id="fTitle" placeholder="How was today?"></div><div class="field"><label>REFLECTION</label><textarea id="fText" placeholder="Write honestly..."></textarea></div>${actions}</div>`],
    subscription:["NEW SUBSCRIPTION","Money",`<div class="form"><div class="field"><label>NAME</label><input id="fTitle" placeholder="Netflix, software, membership..."></div><div class="field"><label>AMOUNT (₹)</label><input id="fAmount" type="number" min="0" placeholder="0"></div><div class="field"><label>FREQUENCY</label><select id="fFreq"><option>Monthly</option><option>Yearly</option><option>Weekly</option></select></div><div class="field"><label>RENEWAL DATE</label><input id="fDate" type="date"></div>${actions}</div>`],
    asset:["NEW ASSET","Life admin",`<div class="form"><div class="field"><label>NAME</label><input id="fTitle" placeholder="Laptop, car, phone..."></div><div class="field"><label>CATEGORY</label><input id="fCat" placeholder="Electronics, vehicle, home..."></div><div class="field"><label>VALUE (₹)</label><input id="fAmount" type="number" min="0" placeholder="0"></div>${actions}</div>`],
    lifePlan:["LIFE DIRECTION","Vision",`<div class="form"><div class="field"><label>WHAT MATTERS?</label><input id="fTitle" placeholder="A value, direction or long-range intention"></div><div class="field"><label>DETAIL</label><textarea id="fText" placeholder="Write the kind of life you're trying to build."></textarea></div>${actions}</div>`]
  };
  const [title,kicker,body]=forms[type]||forms.note;
  openModal(title,kicker,body);
  $("#saveForm").onclick=()=>saveForm(type);
  $$("[data-close-modal]").forEach(b=>b.onclick=closeModal);
}

async function saveForm(type){
  try{
    let record;
    if(type==="expense"){
      const amount=Math.abs(Number($("#fAmount").value||0));
      record=await create("transactions",{title:$("#fTitle").value||"Expense",cat:$("#fCat").value||"General",amount:-amount,type:"out"});
      state.transactions.push(record); state.balance-=amount;
    } else if(type==="income"){
      const amount=Math.abs(Number($("#fAmount").value||0));
      record=await create("transactions",{title:$("#fTitle").value||"Income",amount,type:"in"});
      state.transactions.push(record); state.balance+=amount;
    } else if(type==="goal"){
      record=await create("goals",{title:$("#fTitle").value||"Goal",target:$("#fTarget").value||"",area:$("#fArea").value||"",progress:0});
      state.goals.push(record);
    } else if(type==="project"){
      const goalId=$("#fGoal").value || (currentContext?.type==="goal"?currentContext.id:null);
      record=await create("projects",{title:$("#fTitle").value||"Project",description:$("#fDesc").value||"",goalId});
      state.projects.push(record);
      if(goalId) await link("goal",goalId,"has","project",record.id);
    } else if(type==="task"){
      const goalId=$("#fGoal").value || (currentContext?.type==="goal"?currentContext.id:null);
      const projectId=$("#fProject").value || (currentContext?.type==="project"?currentContext.id:null);
      record=await create("tasks",{title:$("#fTitle").value||"Task",done:false,goalId,projectId,dueAt:$("#fDate").value||null});
      state.tasks.push(record);
      if(goalId) await link("goal",goalId,"supports","task",record.id);
      if(projectId) await link("project",projectId,"has","task",record.id);
    } else if(type==="event"){
      const goalId=$("#fGoal").value || (currentContext?.type==="goal"?currentContext.id:null);
      const projectId=$("#fProject").value || (currentContext?.type==="project"?currentContext.id:null);
      const personId=$("#fPerson").value || (currentContext?.type==="person"?currentContext.id:null);
      record=await create("events",{title:$("#fTitle").value||"Event",startAt:$("#fDate").value||null,goalId,projectId,personId});
      state.events.push(record);
      if(goalId) await link("goal",goalId,"has","event",record.id);
      if(projectId) await link("project",projectId,"scheduled-as","event",record.id);
      if(personId) await link("person",personId,"attends","event",record.id);
    } else if(type==="wishlist"){
      record=await create("wishlist",{title:$("#fTitle").value||"Wishlist item",price:Number($("#fAmount").value||0),priority:$("#fCat").value});
      state.wishes.push(record);
    } else if(type==="person"){
      record=await create("people",{name:$("#fTitle").value||"Person",relationship:$("#fRelation").value||""});
      state.people.push(record);
    } else if(type==="note"){
      record=await create("notes",{title:$("#fTitle").value||"Untitled note",text:$("#fText").value||"",date:now()});
      state.notes.push(record);
    } else if(type==="journal"){
      record=await create("journal",{title:$("#fTitle").value||"Journal entry",text:$("#fText").value||"",date:now()});
      state.journal.push(record);
    } else if(type==="subscription"){
      record=await create("subscriptions",{name:$("#fTitle").value||"Subscription",amount:Number($("#fAmount").value||0),frequency:$("#fFreq").value,renewalDate:$("#fDate").value||""});
      state.subscriptions.push(record);
    } else if(type==="asset"){
      record=await create("assets",{name:$("#fTitle").value||"Asset",category:$("#fCat").value||"",value:Number($("#fAmount").value||0)});
      state.assets.push(record);
    } else if(type==="reminder"){
      record=await create("reminders",{
        title:$("#fTitle").value||"Reminder",
        remindAt:$("#fDate").value||null,
        repeat:$("#fRepeat").value||"",
        enabled:true
      });
      state.reminders.push(record);
    } else if(type==="lifePlan"){
      const profile=state.profile||{};
      profile.values=[...(profile.values||[]),{title:$("#fTitle").value||"",detail:$("#fText").value||""}];
      state.profile=await LifeDB.saveUserProfile(profile);
    }

    closeModal();
    updateHome();
    toast("Saved to Firestore");
    refreshCurrentView();
  }catch(error){
    console.error(error);
    toast(fireError(error));
  }
}

async function toggleTask(id){
  const task=state.tasks.find(t=>t.id===id);
  if(!task) return;
  try{
    task.done=!task.done;
    await LifeDB.create("tasks",task);
    updateHome();
    refreshCurrentView();
    toast(task.done?"Task completed":"Task reopened");
  }catch(error){ task.done=!task.done; toast(fireError(error)); }
}

async function fundWishlist(id){
  const wish=state.wishes.find(w=>w.id===id);
  if(!wish) return;
  if(wish.goalId){ toast("This item already has a savings goal"); return; }
  try{
    const goal=await create("goals",{title:`Save for ${wish.title}`,target:money(wish.price),area:"Wishlist",progress:0,wishlistId:wish.id});
    wish.goalId=goal.id;
    await LifeDB.create("wishlist",wish);
    state.goals.push(goal);
    updateHome(); refreshCurrentView(); toast("Savings goal created");
  }catch(error){ toast(fireError(error)); }
}

async function purchaseWishlist(id){
  const wish=state.wishes.find(w=>w.id===id);
  if(!wish) return;
  openModal("Record purchase","MONEY",`
    <div class="form">
      <div class="field"><label>ITEM</label><input id="purchaseTitle" value="${esc(wish.title)}"></div>
      <div class="field"><label>AMOUNT (₹)</label><input id="purchaseAmount" type="number" min="0" value="${Number(wish.price||0)}"></div>
      <div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="confirmPurchase">Record purchase</button></div>
    </div>`);
  $$("[data-close-modal]").forEach(b=>b.onclick=closeModal);
  $("#confirmPurchase").onclick=async()=>{
    try{
      const amount=Math.abs(Number($("#purchaseAmount").value||0));
      const tx=await create("transactions",{title:$("#purchaseTitle").value||wish.title,amount:-amount,type:"out",cat:"Wishlist purchase",relatedWishlistId:wish.id});
      wish.purchased=true;
      await LifeDB.create("wishlist",wish);
      state.transactions.push(tx); state.balance-=amount;
      await link("wishlist",wish.id,"purchased-as","transaction",tx.id);
      closeModal(); updateHome(); refreshCurrentView(); toast("Purchase recorded");
    }catch(error){ toast(fireError(error)); }
  };
}

async function deleteRecord(store,id,label){
  if(!confirm(`Delete this ${label}? This cannot be undone.`)) return;
  try{
    await LifeDB.remove(store,id);
    toast(`${label} deleted`);
    refreshCurrentView();
  }catch(error){ toast(fireError(error)); }
}

function openEditForm(store,id,type){
  const collections={
    goals:state.goals, projects:state.projects, tasks:state.tasks, events:state.events,
    wishlist:state.wishes, people:state.people, notes:state.notes, journal:state.journal,
    subscriptions:state.subscriptions, assets:state.assets
  };
  const record=collections[store]?.find(x=>x.id===id);
  if(!record){ toast("Record not found"); return; }

  const field = (label,id,value,type="text") =>
    `<div class="field"><label>${label}</label><input id="${id}" type="${type}" value="${esc(value||"")}"></div>`;

  let body="";
  if(store==="goals"){
    body=`<div class="form">${field("GOAL","fTitle",record.title)}${field("WHY / TARGET","fTarget",record.target)}${field("AREA","fArea",record.area)}
      <div class="field"><label>PROGRESS (%)</label><input id="fProgress" type="number" min="0" max="100" value="${Number(record.progress||0)}"></div>
      <div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="saveEdit">Save</button></div></div>`;
  }else if(store==="projects"){
    body=`<div class="form">${field("PROJECT","fTitle",record.title)}${field("DESCRIPTION","fDesc",record.description)}
      <div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="saveEdit">Save</button></div></div>`;
  }else if(store==="tasks"){
    body=`<div class="form">${field("TASK","fTitle",record.title)}${field("DUE","fDate",record.dueAt,"datetime-local")}
      <div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="saveEdit">Save</button></div></div>`;
  }else if(store==="events"){
    body=`<div class="form">${field("EVENT","fTitle",record.title)}${field("DATE / TIME","fDate",record.startAt,"datetime-local")}
      <div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="saveEdit">Save</button></div></div>`;
  }else if(store==="wishlist"){
    body=`<div class="form">${field("ITEM","fTitle",record.title)}${field("PRICE (₹)","fAmount",record.price,"number")}
      <div class="field"><label>PRIORITY</label><select id="fCat"><option ${record.priority==="High"?"selected":""}>High</option><option ${record.priority==="Medium"?"selected":""}>Medium</option><option ${record.priority==="Low"?"selected":""}>Low</option></select></div>
      <div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="saveEdit">Save</button></div></div>`;
  }else if(store==="people"){
    body=`<div class="form">${field("NAME","fTitle",record.name)}${field("RELATIONSHIP","fRelation",record.relationship)}
      <div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="saveEdit">Save</button></div></div>`;
  }else if(store==="notes" || store==="journal"){
    body=`<div class="form">${field("TITLE","fTitle",record.title)}<div class="field"><label>TEXT</label><textarea id="fText">${esc(record.text||"")}</textarea></div>
      <div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="saveEdit">Save</button></div></div>`;
  }else if(store==="subscriptions"){
    body=`<div class="form">${field("NAME","fTitle",record.name||record.title)}${field("AMOUNT (₹)","fAmount",record.amount,"number")}${field("RENEWAL DATE","fDate",record.renewalDate,"date")}
      <div class="field"><label>FREQUENCY</label><select id="fFreq"><option ${record.frequency==="Monthly"?"selected":""}>Monthly</option><option ${record.frequency==="Yearly"?"selected":""}>Yearly</option><option ${record.frequency==="Weekly"?"selected":""}>Weekly</option></select></div>
      <div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="saveEdit">Save</button></div></div>`;
  }else if(store==="assets"){
    body=`<div class="form">${field("NAME","fTitle",record.name||record.title)}${field("CATEGORY","fCat",record.category)}${field("VALUE (₹)","fAmount",record.value,"number")}
      <div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="saveEdit">Save</button></div></div>`;
  }

  openModal(`Edit ${type}`,"EDIT",body);
  $$("[data-close-modal]").forEach(b=>b.onclick=closeModal);
  $("#saveEdit").onclick=async()=>{
    try{
      let updated={...record};
      if(store==="goals") Object.assign(updated,{title:$("#fTitle").value,target:$("#fTarget").value,area:$("#fArea").value,progress:Number($("#fProgress").value||0)});
      if(store==="projects") Object.assign(updated,{title:$("#fTitle").value,description:$("#fDesc").value});
      if(store==="tasks") Object.assign(updated,{title:$("#fTitle").value,dueAt:$("#fDate").value||null});
      if(store==="events") Object.assign(updated,{title:$("#fTitle").value,startAt:$("#fDate").value||null});
      if(store==="wishlist") Object.assign(updated,{title:$("#fTitle").value,price:Number($("#fAmount").value||0),priority:$("#fCat").value});
      if(store==="people") Object.assign(updated,{name:$("#fTitle").value,relationship:$("#fRelation").value});
      if(store==="notes" || store==="journal") Object.assign(updated,{title:$("#fTitle").value,text:$("#fText").value});
      if(store==="subscriptions") Object.assign(updated,{name:$("#fTitle").value,amount:Number($("#fAmount").value||0),renewalDate:$("#fDate").value||"",frequency:$("#fFreq").value});
      if(store==="assets") Object.assign(updated,{name:$("#fTitle").value,category:$("#fCat").value,value:Number($("#fAmount").value||0)});
      await LifeDB.create(store,updated);
      closeModal(); toast("Updated"); refreshCurrentView();
    }catch(error){ toast(fireError(error)); }
  };
}

function refreshCurrentView(){
  if(currentContext?.type==="goal"){
    $("#pageContent").innerHTML=renderGoalDetail(currentContext.id);
    bindDynamic();
  }else if(currentContext?.type==="project"){
    $("#pageContent").innerHTML=renderProjectDetail(currentContext.id);
    bindDynamic();
  }else if(currentContext?.type==="person"){
    $("#pageContent").innerHTML=renderPersonDetail(currentContext.id);
    bindDynamic();
  }else if(currentPage!=="home"){
    renderPage(currentPage);
  }else{
    updateHome();
  }
}



async function resetPasswordFromSettings(){
  const email=LifeFirebase.getUser?.()?.email;
  if(!email){ toast("This account has no email address."); return; }
  try{
    await LifeFirebase.sendPasswordReset(email);
    toast("Password reset email sent");
  }catch(error){ toast(fireError(error)); }
}

async function signOutAndLeave(){
  if(!confirm("Sign out of Life Hub?")) return;
  try{
    await LifeFirebase.disconnectSession();
    localStorage.removeItem("lifehub_auth_completed");
    localStorage.removeItem("lifehub_auth_provider");
    location.replace("login.html");
  }catch(error){
    toast(fireError(error));
  }
}

async function resetAll(){
  if(!confirm("Reset ALL Life Hub data in this browser/account? This cannot be undone.")) return;
  try{
    await LifeDB.reset();
    location.reload();
  }catch(error){ toast(fireError(error)); }
}

function openAddFor(page){
  const map={
    finances:"expense",goals:"goal",wishlist:"wishlist",family:"person",
    journal:"journal",notes:"note",calendar:"event",tasks:"task",
    assets:"asset",lifePlan:"lifePlan"
  };
  openEntryForm(map[page]||"note");
}

function openRecord(type,id){
  if(type==="event"){
    const e=state.events.find(x=>x.id===id);
    if(!e) return;
    openModal(e.title||"Event","EVENT",`
      <div class="list">
        <div class="list-row glass"><div class="main-copy"><b>When</b><small>${esc(fmtDate(e.startAt))}</small></div></div>
        <div class="list-row glass"><div class="main-copy"><b>Goal</b><small>${esc(state.goals.find(g=>g.id===e.goalId)?.title||"None")}</small></div></div>
        <div class="list-row glass"><div class="main-copy"><b>Project</b><small>${esc(state.projects.find(p=>p.id===e.projectId)?.title||"None")}</small></div></div>
      </div>
      <div class="form-actions"><button class="primary" data-close-modal>Close</button></div>`);
    $$("[data-close-modal]").forEach(b=>b.onclick=closeModal);
  }
}

function bindDynamic(){
  $("#newGoalBtn")?.addEventListener("click",()=>openEntryForm("goal"));
  $("#newTaskBtn")?.addEventListener("click",()=>openEntryForm("task"));
  $("#newEventBtn")?.addEventListener("click",()=>openEntryForm("event"));
  $("#newWishBtn")?.addEventListener("click",()=>openEntryForm("wishlist"));
  $("#newPersonBtn")?.addEventListener("click",()=>openEntryForm("person"));
  $("#newNoteBtn")?.addEventListener("click",()=>openEntryForm("note"));
  $("#newJournalBtn")?.addEventListener("click",()=>openEntryForm("journal"));
  $("#newSubscriptionBtn")?.addEventListener("click",()=>openEntryForm("subscription"));
  $("#newAssetBtn")?.addEventListener("click",()=>openEntryForm("asset"));
  $("#newReminderBtn")?.addEventListener("click",()=>openEntryForm("reminder"));
  $("#notifyBtn")?.addEventListener("click",requestNotifications);
  $("#editLifePlanBtn")?.addEventListener("click",()=>openEntryForm("lifePlan"));
  $("#addExpense")?.addEventListener("click",()=>openEntryForm("expense"));
  $("#addIncome")?.addEventListener("click",()=>openEntryForm("income"));

  $("#addProjectBtn")?.addEventListener("click",()=>openEntryForm("project"));
  $("#addGoalTaskBtn")?.addEventListener("click",()=>openEntryForm("task"));
  $("#addGoalEventBtn")?.addEventListener("click",()=>openEntryForm("event"));
  $("#addProjectTaskBtn")?.addEventListener("click",()=>openEntryForm("task"));
  $("#addProjectEventBtn")?.addEventListener("click",()=>openEntryForm("event"));
  $("#addPersonEventBtn")?.addEventListener("click",()=>openEntryForm("event"));
  $("#addPersonTaskBtn")?.addEventListener("click",()=>openEntryForm("task"));

  $$("[data-open-goal]").forEach(b=>b.onclick=()=>{
    currentContext={type:"goal",id:b.dataset.openGoal};
    $("#pageKicker").textContent="GOAL"; $("#pageTitle").textContent="Goal";
    refreshCurrentView();
  });
  $$("[data-open-project]").forEach(b=>b.onclick=()=>{
    currentContext={type:"project",id:b.dataset.openProject};
    $("#pageKicker").textContent="PROJECT"; $("#pageTitle").textContent="Project";
    refreshCurrentView();
  });
  $$("[data-open-person]").forEach(b=>b.onclick=()=>{
    currentContext={type:"person",id:b.dataset.openPerson};
    $("#pageKicker").textContent="PERSON"; $("#pageTitle").textContent="Person";
    refreshCurrentView();
  });
  $$(".task-toggle").forEach(b=>b.onclick=()=>toggleTask(b.dataset.taskId));
  $$("[data-fund-wish]").forEach(b=>b.onclick=()=>fundWishlist(b.dataset.fundWish));
  $$("[data-buy-wish]").forEach(b=>b.onclick=()=>purchaseWishlist(b.dataset.buyWish));
  $$("[data-open-record]").forEach(b=>b.onclick=()=>openRecord(b.dataset.openRecord,b.dataset.id));
  $$("[data-edit-store]").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    openEditForm(b.dataset.editStore,b.dataset.editId,
      b.dataset.editStore==="wishlist"?"wishlist item":b.dataset.editStore.slice(0,-1));
  });
  $$("[data-delete-store]").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    deleteRecord(b.dataset.deleteStore,b.dataset.deleteId,b.dataset.deleteLabel||"record");
  });
  $("#todayEmptyAdd")?.addEventListener("click",openQuickCapture);

  $("#exportRow")?.addEventListener("click",async()=>{
    try{
      const snapshot=await LifeDB.exportAll();
      const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:"application/json"});
      const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="life-hub-backup.json"; a.click(); URL.revokeObjectURL(a.href);
      toast("Backup exported");
    }catch(error){ toast(fireError(error)); }
  });
  $("#settingsResetPassword")?.addEventListener("click",resetPasswordFromSettings);
  $("#signOutRow")?.addEventListener("click",signOutAndLeave);
  $("#resetRow")?.addEventListener("click",resetAll);
}

document.addEventListener("click",e=>{
  const homeAdd=e.target.closest("#todayEmptyAdd");
  if(homeAdd){
    openQuickCapture();
    return;
  }
  const dynamicRecord=e.target.closest("[data-open-record]");
  if(dynamicRecord){
    openRecord(dynamicRecord.dataset.openRecord,dynamicRecord.dataset.id);
    return;
  }
  const closeControl=e.target.closest("[data-close-modal]");
  if(closeControl){
    e.preventDefault();
    closeModal();
    return;
  }
  if(e.target.classList.contains("modal-backdrop")){
    closeModal();
    return;
  }
  const page=e.target.closest("[data-page]");
  if(page) openPage(page.dataset.page);
  const add=e.target.closest("[data-add]");
  if(add){ closeModal(); openEntryForm(add.dataset.add); }
  const result=e.target.closest("[data-result-store]");
  if(result){
    closeSearch();
    const route={people:"family",goals:"goals",projects:"goals",tasks:"tasks",events:"calendar",transactions:"finances",wishlist:"wishlist",notes:"notes",journal:"journal",habits:"habits",assets:"assets",subscriptions:"assets"};
    openPage(route[result.dataset.resultStore]||"insights");
  }
});

$("#menuBtn").onclick=openDrawer;
$("#closeDrawer").onclick=closeDrawer;
$("#drawerBackdrop").onclick=closeDrawer;
$("#searchBtn").onclick=openSearch;
$("#closeSearch").onclick=closeSearch;
let searchTimer;
$("#globalSearch").addEventListener("input",e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>searchRecords(e.target.value),120);});
$("#globalSearch").addEventListener("keydown",e=>{if(e.key==="Escape")closeSearch();});
$("#backBtn").onclick=()=>{
  if(currentContext?.type==="goal"){currentContext=null;renderPage("goals");return;}
  if(currentContext?.type==="project"){currentContext=null;renderPage("goals");return;}
  if(currentContext?.type==="person"){currentContext=null;renderPage("family");return;}
  closePage();
};
$("#fab").onclick=openQuickCapture;
$("#moreNav").onclick=openDrawer;
$("#profileBtn").onclick=()=>openPage("settings");
$("#drawerResetBtn").onclick=resetAll;
$("#attentionBtn").onclick=()=>openPage("insights");
$$(".nav-item[data-page]").forEach(n=>n.addEventListener("click",()=>{
  $$(".nav-item").forEach(x=>x.classList.remove("active"));
  n.classList.add("active");
}));

document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){closeModal();closeDrawer();closePage();}
});

greeting();
hydrate().then(()=>{
  updateHome();
  if(currentPage!=="home") renderPage(currentPage);
});

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}

window.runLifeHubDiagnostics = async () => {
  const checks = [];
  const add = (name, pass, detail="") => checks.push({name, pass, detail});
  add("LifeDB available", !!LifeDB, "module import");
  add("Firebase available", !!LifeFirebase, "Firebase module");
  add("Create API", typeof LifeDB?.create === "function");
  add("Search API", typeof LifeDB?.search === "function");
  add("Realtime subscriptions", typeof LifeDB?.subscribe === "function");
  add("Reset API", typeof LifeDB?.reset === "function");
  try {
    const user = await Promise.race([
      LifeDB.initialize().then(()=>LifeFirebase?.getUser?.()),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error("Firebase diagnostics timed out after 12 seconds.")),12000))
    ]);
    add("Firebase authentication", !!user, user ? `UID: ${user.uid}` : "No authenticated user");
    add("Anonymous auth", !!user?.isAnonymous, user?.isAnonymous ? "Anonymous account active" : "Not anonymous");
  } catch (e) {
    add("Firebase authentication", false, LifeFirebase?.firebaseError ? LifeFirebase.firebaseError(e) : (e?.message || "Firebase diagnostic failed"));
  }
  return checks;
};
