const $ = id => document.getElementById(id);

async function api(path, opts){
  const res = await fetch(path, { headers:{"Content-Type":"application/json"}, ...opts });
  if(!res.ok){ const b = await res.json().catch(()=>({})); throw new Error(b.error||"เกิดข้อผิดพลาด"); }
  return res.json();
}

// ---------- HOME ----------
async function loadHome(){
  const orders = await api("/api/orders");
  const products = await api("/api/products");
  const paid = orders.filter(o=>o.status==="paid");
  $("h-sales").textContent = "฿"+paid.reduce((s,o)=>s+Number(o.total),0).toLocaleString();
  $("h-orders").textContent = orders.length;
  $("h-pending").textContent = orders.filter(o=>o.status==="pending").length;
  $("h-stock").textContent = products.reduce((s,p)=>s+p.stock,0)+" ตัว";
  // bank
  try{
    const bank = await api("/api/bank-account");
    if(bank){ $("h-bank-bk").textContent = bank.bank_name + (bank.promptpay_id?" · พร้อมเพย์":""); $("h-bank-no").textContent = bank.account_number; }
  }catch(e){}
}

// ---------- SALE / FEED ----------
async function loadFeed(){
  const logs = await api("/api/comment-logs?limit=30");
  const el = $("feed"); $("feed-count").textContent = logs.length;
  if(!logs.length){ el.innerHTML='<div class="empty">ยังไม่มีคอมเมนต์ — พิมพ์ทดสอบด้านบน</div>'; return; }
  el.innerHTML="";
  logs.forEach(l=>{
    const d=document.createElement("div");
    let cls="",res="";
    if(l.is_order_created){ cls="ok"; res=`<div class="fi-res ok">✓ ออกออเดอร์ ${l.items.map(i=>i.code+"×"+i.quantity).join(", ")} — ฿${Number(l.total).toLocaleString()}</div><div class="fi-bank">↳ ส่งเลขบัญชี + QR ให้ลูกค้าแล้ว</div>`; }
    else if(l.matched_code){ cls="warn"; res=`<div class="fi-res warn">⚠ ${l.matched_code} สต็อกหมด/ไม่พบรหัส</div>`; }
    d.className="fi "+cls;
    const t=new Date(l.time).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
    d.innerHTML=`<div class="fi-top"><span>${l.customer_name}</span><span>${t}</span></div><div class="fi-msg num">"${l.message}"</div>${res}`;
    el.appendChild(d);
  });
}
$("sim-send").onclick=async()=>{
  const v=$("sim-input").value.trim(); if(!v)return; $("sim-input").value="";
  try{ await api("/api/simulate-comment",{method:"POST",body:JSON.stringify({customerName:"คุณทดสอบ",message:v})}); }catch(e){ showToast(e.message); }
  refresh();
};
$("sim-input").addEventListener("keydown",e=>{if(e.key==="Enter")$("sim-send").click();});

// ---------- ORDERS ----------
let orderFilter="all", allOrders=[];
async function loadOrders(){ allOrders = await api("/api/orders"); renderOrders(); }
function renderOrders(){
  const q=($("order-search").value||"").trim();
  let list=allOrders.filter(o=>orderFilter==="all"||o.status===orderFilter);
  if(q) list=list.filter(o=>o.customer_name.includes(q));
  const body=$("orders-body"); body.innerHTML="";
  if(!list.length){ body.innerHTML='<tr><td colspan="4" class="empty">ไม่มีออเดอร์</td></tr>'; return; }
  list.forEach(o=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><b>${o.customer_name}</b><div class="oitems">${o.items.map(i=>i.code+"×"+i.quantity).join(", ")}</div></td>
      <td class="num">฿${Number(o.total).toLocaleString()}</td>
      <td><span class="spill ${o.status}">${o.status==="paid"?"ชำระแล้ว":"รอชำระ"}</span></td>
      <td>${o.status==="pending"?`<button class="btn btn-sm btn-ink" data-pay="${o.id}">โอนแล้ว</button>`:""}</td>`;
    body.appendChild(tr);
  });
  body.querySelectorAll("[data-pay]").forEach(b=>b.onclick=async()=>{ await api(`/api/orders/${b.dataset.pay}/status`,{method:"PATCH",body:JSON.stringify({status:"paid"})}); refresh(); });
}
$("order-search").addEventListener("input",renderOrders);
$("ofilters").querySelectorAll(".filt").forEach(b=>b.onclick=()=>{$("ofilters").querySelectorAll(".filt").forEach(x=>x.classList.remove("active"));b.classList.add("active");orderFilter=b.dataset.f;renderOrders();});

// ---------- CHECK / REMINDERS ----------
async function loadUnpaid(){
  const unpaid = await api("/api/reminders/unpaid");
  $("c-unpaid").textContent=unpaid.length;
  $("c-amount").textContent="฿"+unpaid.reduce((s,o)=>s+Number(o.total),0).toLocaleString();
  const all = allOrders.length?allOrders:await api("/api/orders");
  $("c-paid").textContent=all.filter(o=>o.status==="paid").length;
  $("remind-all").disabled=!unpaid.length;
  const list=$("unpaid-list");
  if(!unpaid.length){ list.innerHTML='<div class="empty">ไม่มีออเดอร์ค้างชำระ ✦</div>'; return; }
  list.innerHTML="";
  unpaid.forEach(o=>{
    const late=o.minutes_waiting>15;
    const div=document.createElement("div"); div.className="ord";
    div.innerHTML=`<div class="ord-top"><div class="ord-cust"><div class="av">${o.customer_name.slice(0,1)}</div>
      <div><div style="font-weight:600">${o.customer_name}</div><div class="oitems">${o.items.map(i=>i.code).join(", ")}</div></div></div>
      <div class="ord-amt">฿${Number(o.total).toLocaleString()}</div></div>
      <div class="ord-bot"><span class="wait ${late?"late":"ok"}">ค้าง ${o.minutes_waiting} นาที${late?" (เกินกำหนด)":""}${o.reminder_count?` · ทวงแล้ว ${o.reminder_count} ครั้ง`:""}</span>
      <div style="display:flex;gap:6px;"><button class="btn btn-sm btn-out" data-remind="${o.id}">🔔 ทวง</button><button class="btn btn-sm btn-ink" data-paid="${o.id}">โอนแล้ว</button></div></div>`;
    list.appendChild(div);
  });
  list.querySelectorAll("[data-remind]").forEach(b=>b.onclick=async()=>{ const r=await api(`/api/reminders/${b.dataset.remind}/remind`,{method:"POST"}); showToast(`ทวง "${r.message}" ไปหา ${r.customer_name}`); refresh(); });
  list.querySelectorAll("[data-paid]").forEach(b=>b.onclick=async()=>{ await api(`/api/orders/${b.dataset.paid}/status`,{method:"PATCH",body:JSON.stringify({status:"paid"})}); refresh(); });
}
$("remind-all").onclick=async()=>{ const r=await api("/api/reminders/remind-all",{method:"POST"}); showToast(`ทวงลูกค้าค้างชำระ ${r.count} คนแล้ว`); refresh(); };

// ---------- STOCK ----------
async function loadStock(){
  const products = await api("/api/products");
  const el=$("stock-list"); el.innerHTML="";
  if(!products.length){ el.innerHTML='<div class="empty">ยังไม่มีสินค้า กด "＋ เพิ่มสินค้า"</div>'; return; }
  products.forEach(p=>{
    const div=document.createElement("div"); div.className="prow";
    div.innerHTML=`<div><div class="pcode">${p.code}</div><div class="pname">${p.name}</div><div class="pprice num">฿${p.price}</div></div>
      <span class="pill ${p.stock===0?"zero":""}">${p.stock}</span>`;
    div.querySelector(".pill").onclick=()=>openStockModal(p.code,p.stock);
    el.appendChild(div);
  });
}
$("toggle-add").onclick=()=>{const f=$("addform");f.style.display=f.style.display==="none"?"flex":"none";};
$("np-save").onclick=async()=>{
  $("np-err").style.display="none";
  try{
    await api("/api/products",{method:"POST",body:JSON.stringify({code:$("np-code").value.trim(),name:$("np-name").value.trim(),price:parseFloat($("np-price").value),stock:parseInt($("np-stock").value||"0",10)})});
    ["np-code","np-name","np-price","np-stock"].forEach(i=>$(i).value="");
    $("addform").style.display="none"; refresh(); showToast("เพิ่มสินค้าแล้ว");
  }catch(e){ $("np-err").textContent=e.message; $("np-err").style.display="block"; }
};
let editingCode=null;
function openStockModal(code,stock){ editingCode=code; $("sm-title").textContent="แก้สต็อก "+code; $("sm-input").value=stock; $("stock-modal").classList.add("open"); $("sm-input").focus(); }
$("sm-cancel").onclick=()=>$("stock-modal").classList.remove("open");
$("sm-save").onclick=async()=>{ await api(`/api/products/${editingCode}/stock`,{method:"PATCH",body:JSON.stringify({stock:$("sm-input").value})}); $("stock-modal").classList.remove("open"); refresh(); showToast("อัปเดตสต็อกแล้ว"); };

// ---------- REPORT ----------
async function loadBest(){
  const orders = await api("/api/orders");
  const tally={};
  orders.forEach(o=>o.items.forEach(i=>{tally[i.code]=tally[i.code]||{name:i.product_name,qty:0};tally[i.code].qty+=i.quantity;}));
  const arr=Object.entries(tally).map(([code,v])=>({code,...v})).sort((a,b)=>b.qty-a.qty);
  const el=$("best-list");
  if(!arr.length){ el.innerHTML='<div class="empty">ยังไม่มียอดขาย</div>'; return; }
  const max=arr[0].qty; el.innerHTML="";
  arr.forEach((p,i)=>{
    const div=document.createElement("div"); div.className="bar-row";
    div.innerHTML=`<div class="bar-rank">${i+1}</div><div class="bar-info"><div class="bar-name"><span class="pcode">${p.code}</span> ${p.name}</div><div class="bar-track"><div class="bar-fill" style="width:${p.qty/max*100}%"></div></div></div><div class="bar-qty">${p.qty} ชิ้น</div>`;
    el.appendChild(div);
  });
}

// ---------- SETTINGS ----------
$("set-bank-save").onclick=async()=>{
  try{
    await api("/api/bank-account",{method:"POST",body:JSON.stringify({bank_name:$("set-bank").value.trim(),account_number:$("set-acc").value.trim(),account_name:$("set-accname").value.trim(),promptpay_id:$("set-pp").value.trim()})});
    showToast("บันทึกบัญชีแล้ว"); goto("home");
  }catch(e){ showToast(e.message); }
};
$("set-remind-save").onclick=async()=>{ try{ await api("/api/reminders/message",{method:"PUT",body:JSON.stringify({message:$("set-remind-msg").value.trim()})}); showToast("บันทึกข้อความทวงแล้ว"); }catch(e){ showToast(e.message); } };
$("set-page-save").onclick=async()=>{ try{ await api("/api/pages",{method:"POST",body:JSON.stringify({facebook_page_id:$("set-pageid").value.trim(),page_name:$("set-pagename").value.trim(),access_token:$("set-token").value.trim()})}); showToast("บันทึกเพจแล้ว"); }catch(e){ showToast(e.message); } };

// ---------- nav ----------
const MAIN=["home","sale","orders","check"];
function goto(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  ($("page-"+page)||$("page-soon")).classList.add("active");
  document.querySelectorAll(".tab[data-page]").forEach(t=>t.classList.toggle("active",t.dataset.page===page));
  if(!MAIN.includes(page)){document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));$("tab-more").classList.add("active");}
  window.scrollTo(0,0); closeSheet(); refresh();
}
document.querySelectorAll(".tab[data-page]").forEach(t=>t.onclick=()=>goto(t.dataset.page));
document.querySelectorAll(".si[data-page]").forEach(s=>s.onclick=()=>goto(s.dataset.page));
document.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>goto(b.dataset.goto));
function openSheet(){$("sheet").classList.add("open");$("sheet-scrim").classList.add("open");}
function closeSheet(){$("sheet").classList.remove("open");$("sheet-scrim").classList.remove("open");}
$("tab-more").onclick=openSheet; $("sheet-scrim").onclick=closeSheet;

function showToast(t){const el=$("toast");el.textContent=t;el.classList.add("show");clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove("show"),2600);}

// refresh active page data
async function refresh(){
  try{
    const active=document.querySelector(".page.active").id;
    if(active==="page-home") await loadHome();
    else if(active==="page-sale"){ await loadFeed(); }
    else if(active==="page-orders") await loadOrders();
    else if(active==="page-check"){ await loadOrders(); await loadUnpaid(); }
    else if(active==="page-stock") await loadStock();
    else if(active==="page-report") await loadBest();
  }catch(e){ console.error(e); }
}

loadHome();
setInterval(()=>{ const a=document.querySelector(".page.active").id; if(a==="page-sale"||a==="page-check") refresh(); }, 4000);
