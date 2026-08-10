const state = {
  balance: Number(localStorage.getItem("lifehub_balance") || 25430),
  goals: JSON.parse(localStorage.getItem("lifehub_goals") || "[]"),
  wishes: JSON.parse(localStorage.getItem("lifehub_wishes") || "[]"),
  transactions: JSON.parse(localStorage.getItem("lifehub_transactions") || "[]"),
  notes: JSON.parse(localStorage.getItem("lifehub_notes") || "[]"),
  journal: JSON.parse(localStorage.getItem("lifehub_journal") || "[]"),
  tasks: JSON.parse(localStorage.getItem("lifehub_tasks") || "[]")
};

const quotes = [
  "Small systems create a bigger life.",
  "Make today easier for tomorrow-you.",
  "Protect your attention like you protect your money.",
  "A calm life is built, not found.",
  "Keep what matters close. Let the rest stay simple."
];

const searchIndex = [
  ["Finances","Money & budgets","finances"],["Goals & projects","Direction and progress","goals"],
  ["Wishlist","Things you want","wishlist"],["Family & people","Relationships and important dates","family"],
  ["Journal","Memories and reflections","journal"],["Notes","Quick capture and ideas","notes"],
  ["Habits & routines","Recurring systems","habits"],["Calendar & planning","Events and time","calendar"],
  ["Private vault","Sensitive information","vault"],["Documents","Important files","documents"],
  ["Wellbeing","Energy and routines","health"],["Life plan","Values and long-term direction","life-plan"],
  ["Tasks & inbox","Actions and reminders","tasks"],["Assets & subscriptions","Things you own and recurring bills","assets"],
  ["Life insights","Patterns across your life","insights"],["Settings","Privacy, backup and preferences","settings"]
];

const pageMeta = {
  finances:["MONEY","Finances"], goals:["DIRECTION","Goals & projects"], wishlist:["WANT","Wishlist"],
  family:["PEOPLE","Family & people"], journal:["MEMORY","Journal"], notes:["CAPTURE","Notes"],
  habits:["SYSTEMS","Habits & routines"], calendar:["TIME","Calendar & planning"], vault:["PRIVATE","Private vault"],
  documents:["ASSETS","Documents"], health:["WELLBEING","Wellbeing"], "life-plan":["VISION","Life plan"],
  tasks:["ACTION","Tasks & inbox"], assets:["LIFE ADMIN","Assets & subscriptions"],
  insights:["REFLECTION","Life insights"], settings:["CONTROL","Settings"]
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function save(){
  localStorage.setItem("lifehub_balance", state.balance);
  localStorage.setItem("lifehub_goals", JSON.stringify(state.goals));
  localStorage.setItem("lifehub_wishes", JSON.stringify(state.wishes));
  localStorage.setItem("lifehub_transactions", JSON.stringify(state.transactions));
  localStorage.setItem("lifehub_notes", JSON.stringify(state.notes));
  localStorage.setItem("lifehub_journal", JSON.stringify(state.journal));
  localStorage.setItem("lifehub_tasks", JSON.stringify(state.tasks));
}

function money(n){ return "₹" + Number(n).toLocaleString("en-IN"); }
function today(){
  const d = new Date();
  return d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
}
function toast(msg){
  const el=$("#toast"); el.textContent=msg; el.classList.add("show");
  clearTimeout(window.toastTimer); window.toastTimer=setTimeout(()=>el.classList.remove("show"),2200);
}
function updateHome(){
  $("#balance").textContent=money(state.balance);
  $("#goalCount").textContent=state.goals.length || 3;
  $("#wishCount").textContent=state.wishes.length || 8;
}
function updateAttention(){
  const pendingTasks = state.tasks.filter(t=>!t.done).length;
  const goalCount = state.goals.length || 3;
  const text = pendingTasks ? `${pendingTasks} unfinished task${pendingTasks===1?"":"s"} are waiting in your inbox.` :
    `${goalCount} active goals, upcoming dates and money items can be reviewed here.`;
  $("#attentionTitle").textContent = pendingTasks ? `${pendingTasks} task${pendingTasks===1?"":"s"} worth checking today` : "3 things worth checking today";
  $("#attentionText").textContent = text;
}
function greeting(){
  const h=new Date().getHours();
  $("#greeting").textContent=h<12?"GOOD MORNING":h<18?"GOOD AFTERNOON":"GOOD EVENING";
  $("#dailyQuote").textContent=quotes[new Date().getDate()%quotes.length];
}
function openSearch(){
  $("#searchOverlay").classList.add("open");
  $("#searchOverlay").setAttribute("aria-hidden","false");
  setTimeout(()=>$("#globalSearch").focus(),80);
  renderSearch("");
}
function closeSearch(){
  $("#searchOverlay").classList.remove("open");
  $("#searchOverlay").setAttribute("aria-hidden","true");
}
function renderSearch(query){
  const q=query.trim().toLowerCase();
  const results=searchIndex.filter(x=>!q || x[0].toLowerCase().includes(q) || x[1].toLowerCase().includes(q));
  $("#searchResults").innerHTML=results.length
    ? results.map(x=>`<button class="search-result" data-search-page="${x[2]}"><b>${x[0]}</b><small>${x[1]}</small></button>`).join("")
    : `<div class="empty"><strong>Nothing found</strong>Try another word or create it with +.</div>`;
}
function openDrawer(){ $("#drawer").classList.add("open"); }
function closeDrawer(){ $("#drawer").classList.remove("open"); }

function openPage(page){
  if(page==="home"){ closePage(); return; }
  closeDrawer();
  const meta=pageMeta[page]||["LIFE","Life Hub"];
  $("#pageKicker").textContent=meta[0]; $("#pageTitle").textContent=meta[1];
  $("#pageLayer").classList.add("open"); $("#pageLayer").setAttribute("aria-hidden","false");
  renderPage(page);
  $("#pageAction").onclick=()=>openAddFor(page);
}
function closePage(){ $("#pageLayer").classList.remove("open"); $("#pageLayer").setAttribute("aria-hidden","true"); }
function renderPage(page){
  const c=$("#pageContent");
  const renderers={finances:renderFinances,goals:renderGoals,wishlist:renderWishlist,family:renderFamily,
    journal:renderJournal,notes:renderNotes,habits:renderHabits,calendar:renderCalendar,vault:renderVault,
    documents:renderDocuments,health:renderHealth,"life-plan":renderLifePlan,tasks:renderTasks,assets:renderAssets,
    insights:renderInsights,settings:renderSettings};
  c.innerHTML=(renderers[page]||renderGeneric)();
  bindDynamic();
}
function shellIntro(title,desc){return `<div class="page-hero"><span class="section-kicker">LIFE HUB</span><h3>${title}</h3><p>${desc}</p></div>`}
function renderFinances(){
  const tx=state.transactions.length?state.transactions:[
    {title:"Salary",cat:"Income",amount:40000,type:"in"},
    {title:"Parents",cat:"Family",amount:-20000,type:"out"},
    {title:"Monthly expenses",cat:"Living",amount:-1430,type:"out"}
  ];
  return shellIntro("Know where your money is going.","A simple financial command center. Add income, expenses, recurring bills and future purchases without making money feel complicated.")
  + `<div class="data-grid"><div class="data-card glass"><small>AVAILABLE</small><b>${money(state.balance)}</b></div><div class="data-card glass"><small>THIS MONTH</small><b>${money(Math.abs(tx.filter(x=>x.type==="out").reduce((a,x)=>a+x.amount,0)))}</b></div></div>
  <div class="chart glass">${[45,65,35,80,58,72,52,88,64,74,49,61].map(x=>`<span class="bar" style="height:${x}%"></span>`).join("")}</div>
  <div class="action-row"><button class="primary" id="addExpense">+ Expense</button><button class="secondary" id="addIncome">+ Income</button></div>
  <div class="list">${tx.map(x=>`<div class="list-row glass"><div class="main-copy"><b>${x.title}</b><small>${x.cat} · ${today()}</small></div><span class="value ${x.type==="in"?"positive":"negative"}">${x.type==="in"?"+":"-"}${money(Math.abs(x.amount))}</span></div>`).join("")}</div>`;
}
function renderGoals(){
  const goals=state.goals.length?state.goals:[
    {title:"Build emergency fund",progress:62,target:"₹1,50,000"},
    {title:"Get stronger & healthier",progress:44,target:"12 month system"},
    {title:"Level up my career",progress:28,target:"Next role"}
  ];
  return shellIntro("Turn intentions into visible progress.","Goals become easier when they have a clear outcome, next action and a date.")
  + `<div class="list">${goals.map(g=>`<div class="list-row glass" style="display:block"><div style="display:flex;justify-content:space-between"><div class="main-copy"><b>${g.title}</b><small>${g.target||"Personal goal"}</small></div><span class="value positive">${g.progress}%</span></div><div class="progress"><span style="width:${g.progress}%"></span></div></div>`).join("")}</div>`;
}
function renderWishlist(){
  const wishes=state.wishes.length?state.wishes:[
    {title:"Something worth saving for",price:25000,priority:"High"},
    {title:"New experience",price:5000,priority:"Medium"},
    {title:"Upgrade a useful tool",price:12000,priority:"Low"}
  ];
  return shellIntro("Want it? Give it a place.","Wishlist items can eventually connect to your budget, savings goals and purchase plans.")
  + `<div class="list">${wishes.map(w=>`<div class="list-row glass"><div class="main-copy"><b>${w.title}</b><small>${w.priority} priority</small></div><span class="value">${money(w.price||0)}</span></div>`).join("")}</div>`;
}
function renderFamily(){
  const people=["Mom","Dad","Ana","Alisha","Nagma","Family"];
  return shellIntro("People are part of the system.","Keep birthdays, important dates, notes, gift ideas, shared plans and little things you don't want to forget.")
  + `<div class="data-grid">${people.map((p,i)=>`<div class="data-card glass"><span class="tag">${i<2?"FAMILY":"CLOSE"} </span><b style="font-size:16px">${p}</b><small>Open profile →</small></div>`).join("")}</div>
  <div class="list"><div class="list-row glass"><div class="main-copy"><b>Upcoming</b><small>Remember the people who matter</small></div><span class="value positive">3 dates</span></div></div>`;
}
function renderJournal(){
  const entries=state.journal.length?state.journal:[{title:"Today",text:"A place for honest thoughts, lessons and memories.",date:today()}];
  return shellIntro("Your private memory.","Journal entries, reflections, gratitude, lessons learned and meaningful moments — searchable later.")
  + `<div class="action-row"><button class="primary" id="newJournal">+ New entry</button></div><div class="list">${entries.map(e=>`<div class="list-row glass"><div class="main-copy"><b>${e.title}</b><small>${e.date||today()}</small><p style="color:#b5c5ba;font-size:11px;line-height:1.5">${e.text||""}</p></div></div>`).join("")}</div>`;
}
function renderNotes(){
  const notes=state.notes.length?state.notes:[{title:"Inbox",text:"Capture anything before deciding where it belongs."}];
  return shellIntro("Capture first. Organize later.","One fast inbox for ideas, reminders, links, thoughts and things you need to process.")
  + `<div class="action-row"><button class="primary" id="newNote">+ Quick note</button></div><div class="list">${notes.map(n=>`<div class="list-row glass"><div class="main-copy"><b>${n.title}</b><small>${n.date||today()}</small><p style="color:#b5c5ba;font-size:11px">${n.text||""}</p></div></div>`).join("")}</div>`;
}
function renderHabits(){
  const habits=[["Drink enough water",5],["Move / exercise",4],["Read",3],["Plan tomorrow",6]];
  return shellIntro("Build the person you want to be.","Habits are small recurring votes for the life you want.")
  + `<div class="list">${habits.map(h=>`<div class="list-row glass"><div class="main-copy"><b>${h[0]}</b><small>Current streak</small></div><span class="value positive">🔥 ${h[1]}d</span></div>`).join("")}</div>`;
}
function renderCalendar(){
  return shellIntro("Your time is your life.","See the commitments, focus blocks and important dates that shape your week.")
  + `<div class="data-grid"><div class="data-card glass"><small>TODAY</small><b>4</b><small>planned items</small></div><div class="data-card glass"><small>THIS WEEK</small><b>12</b><small>events & tasks</small></div></div>
  <div class="list">${["Morning reset","Work & learn","Read 20 pages","Plan tomorrow"].map((x,i)=>`<div class="list-row glass"><div class="main-copy"><b>${x}</b><small>${["07:00","10:00","19:00","22:00"][i]}</small></div><span class="value positive">${i===0?"Done":"Plan"}</span></div>`).join("")}</div>`;
}
function renderVault(){
  return shellIntro("Private vault.","A future-ready encrypted area for credentials, recovery codes and other secrets. This prototype intentionally does not store real passwords.")
  + `<div class="data-card glass"><span class="tag">LOCKED</span><b>Private essentials</b><small>Web Crypto + server-side encryption should be added before real secrets are stored.</small></div>
  <div class="action-row"><button class="secondary" id="vaultInfo">Security checklist</button></div>`;
}
function renderDocuments(){
  return shellIntro("Never hunt for an important document again.","Organize IDs, certificates, contracts, receipts, warranties and other important files.")
  + `<div class="data-grid">${["Identity","Work","Finance","Education","Home","Receipts"].map(x=>`<div class="data-card glass"><span class="tag">FOLDER</span><b style="font-size:16px">${x}</b><small>0 files</small></div>`).join("")}</div>`;
}
function renderHealth(){
  return shellIntro("Energy, not obsession.","Track simple wellbeing signals such as sleep, movement, energy and routines. Keep it supportive rather than medical.")
  + `<div class="data-grid"><div class="data-card glass"><small>SLEEP</small><b>—</b><small>Log tonight</small></div><div class="data-card glass"><small>ENERGY</small><b>—</b><small>How do you feel?</small></div><div class="data-card glass"><small>MOVEMENT</small><b>—</b><small>Today</small></div><div class="data-card glass"><small>MOOD</small><b>—</b><small>Check in</small></div></div>`;
}
function renderLifePlan(){
  return shellIntro("Design the life behind the dashboard.","This is the layer above tasks: values, long-term direction, ideal life, yearly themes, priorities and decisions.")
  + `<div class="list">${[
    ["North star","What does a great life look like?"],
    ["This year","The 3–5 outcomes that matter most"],
    ["5-year picture","Where do you want life to be heading?"],
    ["Values","What should guide your decisions?"],
    ["Someday","Ideas that don't need attention yet"]
  ].map(x=>`<div class="list-row glass"><div class="main-copy"><b>${x[0]}</b><small>${x[1]}</small></div><span class="value">→</span></div>`).join("")}</div>`;
}
function renderTasks(){
  const tasks=state.tasks.length?state.tasks:[{title:"Finish important thing",done:false},{title:"Reply to someone",done:false},{title:"Review finances",done:true}];
  return shellIntro("Everything you need to do.","A single action inbox connected to goals, people, finances and calendar.")
  + `<div class="list">${tasks.map((t,i)=>`<div class="list-row glass"><div class="main-copy"><b>${t.title}</b><small>${t.done?"Completed":"Next action"}</small></div><button class="check interactive-check ${t.done?"completed":""}" data-task-index="${i}">${t.done?"✓":"○"}</button></div>`).join("")}</div>`;
}
function renderAssets(){
  return shellIntro("Know what you own and what bills you.","Track devices, vehicles, subscriptions, warranties, memberships, recurring bills and renewal dates.")
  + `<div class="list">${["Subscriptions","Devices & electronics","Warranties","Memberships","Recurring bills"].map(x=>`<div class="list-row glass"><div class="main-copy"><b>${x}</b><small>Keep renewal dates and costs visible</small></div><span class="value">→</span></div>`).join("")}</div>`;
}
function renderInsights(){
  return shellIntro("See patterns, not just numbers.","The long-term value of Life Hub is connecting your information so you can notice what is changing.")
  + `<div class="data-grid"><div class="data-card glass"><small>FINANCIAL</small><b>Stable</b><small>Spending within plan</small></div><div class="data-card glass"><small>GOALS</small><b>Growing</b><small>3 active</small></div><div class="data-card glass"><small>ROUTINES</small><b>71%</b><small>Consistency</small></div><div class="data-card glass"><small>PEOPLE</small><b>91</b><small>Connection score</small></div></div>
  <div class="list"><div class="list-row glass"><div class="main-copy"><b>Weekly reflection</b><small>What worked? What drained you? What deserves attention next?</small></div><span class="value positive">Start →</span></div></div>`;
}
function renderSettings(){
  return shellIntro("Make it yours.","Your Life Hub should feel personal, calm and private.")
  + `<div class="list">
    <div class="list-row glass"><div class="main-copy"><b>Background</b><small>Current: forest rain</small></div><span class="value">Active</span></div>
    <div class="list-row glass"><div class="main-copy"><b>Local storage</b><small>Prototype data stays in this browser</small></div><span class="value positive">On</span></div>
    <div class="list-row glass" id="exportRow"><div class="main-copy"><b>Export my data</b><small>Download a JSON backup of prototype data</small></div><span class="value">→</span></div>
    <div class="list-row glass" id="resetRow"><div class="main-copy"><b>Reset prototype data</b><small>Clear local demo entries</small></div><span class="value negative">Reset</span></div>
  </div>`;
}
function renderGeneric(){return shellIntro("Your life, organized.","This module is ready to become part of the Life Hub system.");}

function openModal(title,kicker,body){
  $("#modalTitle").textContent=title; $("#modalKicker").textContent=kicker; $("#modalBody").innerHTML=body;
  $("#modal").classList.add("open"); $("#modal").setAttribute("aria-hidden","false");
}
function closeModal(){ $("#modal").classList.remove("open"); $("#modal").setAttribute("aria-hidden","true"); }
function openQuickCapture(){
  openModal("What do you want to add?","QUICK CAPTURE",`
    <div class="capture-grid">
      <button class="capture-option" data-add="expense"><b>₹ Expense</b><small>Log spending</small></button>
      <button class="capture-option" data-add="income"><b>＋ Income</b><small>Log money in</small></button>
      <button class="capture-option" data-add="goal"><b>◎ Goal</b><small>Create a target</small></button>
      <button class="capture-option" data-add="note"><b>≡ Note</b><small>Capture an idea</small></button>
      <button class="capture-option" data-add="journal"><b>◫ Journal</b><small>Write a reflection</small></button>
      <button class="capture-option" data-add="wishlist"><b>♡ Wishlist</b><small>Save something</small></button>
      <button class="capture-option" data-add="task"><b>✓ Task</b><small>Remember an action</small></button>
      <button class="capture-option" data-add="person"><b>♧ Person</b><small>Remember someone</small></button>
    </div>`);
}
function openAddFor(page){
  const map={finances:"expense",goals:"goal",wishlist:"wishlist",notes:"note",journal:"journal",tasks:"task"};
  openEntryForm(map[page]||"note");
}
function openEntryForm(type){
  const configs={
    expense:["ADD EXPENSE","Money",`<div class="form"><div class="field"><label>WHAT?</label><input id="fTitle" placeholder="e.g. Groceries"></div><div class="field"><label>AMOUNT (₹)</label><input id="fAmount" type="number" placeholder="0"></div><div class="field"><label>CATEGORY</label><input id="fCat" placeholder="Food, travel, bills..."></div><div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="saveExpense">Save expense</button></div></div>`],
    income:["ADD INCOME","Money",`<div class="form"><div class="field"><label>WHAT?</label><input id="fTitle" placeholder="e.g. Salary"></div><div class="field"><label>AMOUNT (₹)</label><input id="fAmount" type="number" placeholder="0"></div><div class="field"><label>NOTE</label><input id="fCat" placeholder="Optional"></div><div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="saveIncome">Save income</button></div></div>`],
    goal:["NEW GOAL","Direction",`<div class="form"><div class="field"><label>GOAL</label><input id="fTitle" placeholder="What do you want to achieve?"></div><div class="field"><label>TARGET / WHY</label><input id="fCat" placeholder="Why does this matter?"></div><div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="saveGoal">Create goal</button></div></div>`],
    note:["QUICK NOTE","Capture",`<div class="form"><div class="field"><label>TITLE</label><input id="fTitle" placeholder="Note title"></div><div class="field"><label>NOTE</label><textarea id="fText" placeholder="Write anything..."></textarea></div><div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="saveNote">Save note</button></div></div>`],
    journal:["JOURNAL ENTRY","Memory",`<div class="form"><div class="field"><label>TITLE</label><input id="fTitle" placeholder="How was today?"></div><div class="field"><label>REFLECTION</label><textarea id="fText" placeholder="Write honestly..."></textarea></div><div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="saveJournal">Save entry</button></div></div>`],
    wishlist:["WISHLIST ITEM","Want",`<div class="form"><div class="field"><label>ITEM</label><input id="fTitle" placeholder="What do you want?"></div><div class="field"><label>PRICE (₹)</label><input id="fAmount" type="number" placeholder="0"></div><div class="field"><label>PRIORITY</label><select id="fCat"><option>High</option><option>Medium</option><option>Low</option></select></div><div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="saveWishlist">Save item</button></div></div>`],
    task:["NEW TASK","Action",`<div class="form"><div class="field"><label>NEXT ACTION</label><input id="fTitle" placeholder="What needs to happen?"></div><div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="saveTask">Add task</button></div></div>`],
    person:["ADD PERSON","People",`<div class="form"><div class="field"><label>NAME</label><input id="fTitle" placeholder="Name"></div><div class="field"><label>RELATION / NOTE</label><input id="fCat" placeholder="Family, friend, colleague..."></div><div class="form-actions"><button class="secondary" data-close-modal>Cancel</button><button class="primary" id="savePerson">Save</button></div></div>`]
  };
  const cfg=configs[type]||configs.note; openModal(cfg[0],cfg[1],cfg[2]);
  bindForms(type);
}
function bindForms(type){
  const closeBtns=$$("[data-close-modal]"); closeBtns.forEach(b=>b.onclick=closeModal);
  const saveAnd=(fn,msg)=>{fn();save();closeModal();updateHome();toast(msg);};
  if(type==="expense") $("#saveExpense").onclick=()=>saveAnd(()=>{const a=Number($("#fAmount").value||0);state.balance-=a;state.transactions.unshift({title:$("#fTitle").value||"Expense",cat:$("#fCat").value||"General",amount:-a,type:"out"})},"Expense saved");
  if(type==="income") $("#saveIncome").onclick=()=>saveAnd(()=>{const a=Number($("#fAmount").value||0);state.balance+=a;state.transactions.unshift({title:$("#fTitle").value||"Income",cat:$("#fCat").value||"Income",amount:a,type:"in"})},"Income saved");
  if(type==="goal") $("#saveGoal").onclick=()=>saveAnd(()=>state.goals.unshift({title:$("#fTitle").value||"New goal",target:$("#fCat").value||"Personal",progress:0}),"Goal created");
  if(type==="note") $("#saveNote").onclick=()=>saveAnd(()=>state.notes.unshift({title:$("#fTitle").value||"Untitled",text:$("#fText").value||"",date:today()}),"Note saved");
  if(type==="journal") $("#saveJournal").onclick=()=>saveAnd(()=>state.journal.unshift({title:$("#fTitle").value||today(),text:$("#fText").value||"",date:today()}),"Journal saved");
  if(type==="wishlist") $("#saveWishlist").onclick=()=>saveAnd(()=>state.wishes.unshift({title:$("#fTitle").value||"Wishlist item",price:Number($("#fAmount").value||0),priority:$("#fCat").value}),"Wishlist saved");
  if(type==="task") $("#saveTask").onclick=()=>saveAnd(()=>state.tasks.unshift({title:$("#fTitle").value||"New task",done:false}),"Task added");
  if(type==="person") $("#savePerson").onclick=()=>{closeModal();toast("Person saved — profile view can be added next.");};
}

function bindDynamic(){
  $$(".interactive-check").forEach(btn=>btn.onclick=()=>{
    btn.classList.toggle("completed"); btn.textContent=btn.classList.contains("completed")?"✓":"○"; toast(btn.classList.contains("completed")?"Done ✓":"Marked incomplete");
  });
  $("#addExpense")?.addEventListener("click",()=>openEntryForm("expense"));
  $("#addIncome")?.addEventListener("click",()=>openEntryForm("income"));
  $("#newNote")?.addEventListener("click",()=>openEntryForm("note"));
  $("#newJournal")?.addEventListener("click",()=>openEntryForm("journal"));
  $("#vaultInfo")?.addEventListener("click",()=>toast("Use real encryption + WebAuthn before storing secrets."));
  $("#exportRow")?.addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="life-hub-backup.json";a.click();URL.revokeObjectURL(a.href);toast("Backup exported");
  });
  $("#resetRow")?.addEventListener("click",()=>{
    if(confirm("Reset all prototype data stored in this browser?")){localStorage.clear();location.reload();}
  });
}

document.addEventListener("click",e=>{
  const pageBtn=e.target.closest("[data-page]");
  if(pageBtn) openPage(pageBtn.dataset.page);
  const add=e.target.closest("[data-add]");
  if(add) openEntryForm(add.dataset.add);
  if(e.target.matches("[data-close-modal]")) closeModal();
});
$("#menuBtn").onclick=openDrawer; $("#closeDrawer").onclick=closeDrawer; $("#drawerBackdrop").onclick=closeDrawer;
$("#searchBtn").onclick=openSearch; $("#closeSearch").onclick=closeSearch;
$("#globalSearch").addEventListener("input",e=>renderSearch(e.target.value));
$("#backBtn").onclick=closePage; $("#fab").onclick=openQuickCapture;
$("#moreNav").onclick=openDrawer; $("#profileBtn").onclick=()=>openPage("settings");
$("#attentionBtn").onclick=()=>openPage("insights");
$("#globalSearch").addEventListener("keydown",e=>{if(e.key==="Escape")closeSearch();});
document.addEventListener("click",e=>{
  const result=e.target.closest("[data-search-page]");
  if(result){closeSearch();openPage(result.dataset.searchPage);}
});
$("#customizeBtn").onclick=()=>toast("Dashboard customization is ready for the next build.");
$$(".nav-item[data-page]").forEach(n=>n.addEventListener("click",()=>{ $$(".nav-item").forEach(x=>x.classList.remove("active"));n.classList.add("active"); }));

// Escape closes transient UI.
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeModal();closeDrawer();closePage();}});

greeting(); updateHome(); updateAttention(); bindDynamic();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
