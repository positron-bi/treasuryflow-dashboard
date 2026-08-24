
const B=DATA.buckets, NB=B.length, COS=DATA.companies, CATS=DATA.cats;
const CATL={}; CATS.forEach(c=>CATL[c.id]=c.label);
CATL['np_past']='اسناد پرداختنی سررسیدگذشته'; CATL['loan_past']='تسهیلات سررسیدگذشته';
const fa=n=>new Intl.NumberFormat('fa-IR',{maximumFractionDigits:0}).format(Math.round(n));
const cell=v=>Math.abs(v)<0.5?'<span class="small">—</span>':`<span class="${v<0?'negmute':''}">${v<0?'('+fa(-v)+')':fa(v)}</span>`;
const coFa=k=>(COS.find(c=>c.key===k)||{fa:k}).fa;
let SEL=new Set(COS.map(c=>c.key));
let POL={}; COS.forEach(c=>POL[c.key]=(DATA.policy[c.key]||{min:0}).min);
Chart.defaults.font.family='Vazirmatn';
document.getElementById('verBadge').textContent=DATA.version||('v4.2 | داده تا '+DATA.report_date);
document.title='پیش‌بینی جریان نقدینگی — '+DATA.report_date;

// ---------- جدول‌های قابل‌سورت با کلیک روی هدر ----------
function parseFaNum(s){
 if(s==null) return NaN;
 s=String(s).trim();
 if(s===''||s==='—') return NaN;
 let neg=false;
 if(s.startsWith('(')&&s.endsWith(')')){neg=true;s=s.slice(1,-1);}
 const faD='۰۱۲۳۴۵۶۷۸۹';
 s=s.replace(/[۰-۹]/g,d=>faD.indexOf(d));
 s=s.replace(/[٬,]/g,'').replace(/[^\d.\-]/g,'');
 if(s==='') return NaN;
 const v=parseFloat(s);
 if(isNaN(v)) return NaN;
 return neg?-v:v;
}
function makeSortable(container){
 const table=container.querySelector?container.querySelector('table'):container;
 if(!table) return;
 const thead=table.querySelector('thead'), tbody=table.querySelector('tbody');
 if(!thead||!tbody) return;
 const ths=[...thead.querySelectorAll('th')];
 ths.forEach((th,idx)=>{
  th.classList.add('sortable');
  th.onclick=()=>{
   const dir=th.dataset.dir==='asc'?'desc':'asc';
   ths.forEach(t=>{delete t.dataset.dir;t.classList.remove('sort-asc','sort-desc');});
   th.dataset.dir=dir; th.classList.add(dir==='asc'?'sort-asc':'sort-desc');
   const allRows=[...tbody.querySelectorAll('tr')];
   const rows=allRows.filter(r=>!r.classList.contains('tot'));
   const totRows=allRows.filter(r=>r.classList.contains('tot'));
   rows.sort((a,b)=>{
    const ca=a.children[idx], cb=b.children[idx];
    if(!ca||!cb) return 0;
    const na=parseFaNum(ca.textContent), nb=parseFaNum(cb.textContent);
    let cmp;
    if(!isNaN(na)&&!isNaN(nb)) cmp=na-nb;
    else cmp=ca.textContent.trim().localeCompare(cb.textContent.trim(),'fa');
    return dir==='asc'?cmp:-cmp;
   });
   rows.forEach(r=>tbody.appendChild(r));
   totRows.forEach(r=>tbody.appendChild(r));
  };
 });
}

// ---------- filter ----------
const fEl=document.getElementById('coFilter');
COS.forEach(c=>{
 const btn=document.createElement('button');
 btn.type='button'; btn.className='co-pill'; btn.textContent=c.fa;
 btn.dataset.co=c.key;
 btn.onclick=(e)=>{
  const allBtns=[...fEl.querySelectorAll('.co-pill')];
  if(e.ctrlKey||e.metaKey){
   // Ctrl/Cmd+کلیک: افزودن یا حذف همین شرکت به انتخاب فعلی، بدون تغییر بقیه
   const isOff=btn.classList.toggle('off');
   if(isOff) SEL.delete(c.key); else SEL.add(c.key);
  } else if(SEL.size===1 && SEL.has(c.key)){
   // این تنها انتخاب فعلی بود → برگشت به حالت پیش‌فرض (همه انتخاب)
   COS.forEach(cc=>SEL.add(cc.key));
   allBtns.forEach(b=>b.classList.remove('off'));
  } else {
   // isolate: فقط همین شرکت انتخاب، بقیه دیم
   SEL.clear(); SEL.add(c.key);
   allBtns.forEach(b=>b.classList.toggle('off', b.dataset.co!==c.key));
  }
  renderAll();
 };
 fEl.appendChild(btn);
});

// ---------- tabs ----------
const TABS=[['داشبورد مدیریتی',0],['منابع و مصارف',0],['نمای ۱۳ هفته',1],['استرس‌تست',1],['ریسک نقدینگی',0],
 ['محرک‌های نقد',0],['تقویم خزانه',0],['ریز تسهیلات',0],['چرخه بعدی تسهیلات',1],['خط زمانی تسهیلات',1],['چک‌های برگشتی و معوق',0],['ورودی‌های دستی',0],
 ['کپکس و سرمایه‌گذاری',1],['خطوط اعتباری',1],['نقطه سر به سر ماهانه',0],['تغییرات نسبت به گزارش قبل',1],['مفروضات',1],['توضیحات',0]];
const tEl=document.getElementById('tabs');
TABS.forEach((t,i)=>{const d=document.createElement('div');d.className='tab'+(i?'':' act');
 d.textContent=t[0];d.onclick=()=>{document.querySelectorAll('.tab').forEach((x,j)=>x.classList.toggle('act',j===i));
 document.querySelectorAll('.pane').forEach((x,j)=>x.classList.toggle('act',j===i));
 if(t[0]==='خط زمانی تسهیلات') requestAnimationFrame(renderGantt);};tEl.appendChild(d);});
document.getElementById('p0').classList.add('act');

// ---------- core aggregation ----------
function catRow(cid){const out=new Array(NB).fill(0);const m=DATA.agg[cid]||{};
 for(const co of SEL){const a=m[co];if(a)for(let i=0;i<NB;i++)out[i]+=a[i];}return out;}
function catCo(cid,co){return (DATA.agg[cid]||{})[co]||new Array(NB).fill(0);}
function coSeries(co){
 const net=new Array(NB).fill(0);
 CATS.forEach(c=>{const a=catCo(c.id,co);for(let i=0;i<NB;i++)net[i]+=a[i];});
 let bal=DATA.opening[co]||0; const close=[];
 for(let i=0;i<NB;i++){bal+=net[i];close.push(bal);} return {net,close};}
function compute(){
 const rows={};CATS.forEach(c=>rows[c.id]=catRow(c.id));
 const tin=new Array(NB).fill(0),tout=new Array(NB).fill(0);
 CATS.filter(c=>c.dir==='in').forEach(c=>{for(let i=0;i<NB;i++)tin[i]+=rows[c.id][i];});
 CATS.filter(c=>c.dir==='out').forEach(c=>{for(let i=0;i<NB;i++)tout[i]+=rows[c.id][i];});
 let open=0;for(const co of SEL)open+=DATA.opening[co]||0;
 const net=tin.map((v,i)=>v+tout[i]);
 const openArr=[],closeArr=[];let bal=open;
 for(let i=0;i<NB;i++){openArr.push(bal);bal+=net[i];closeArr.push(bal);}
 return {rows,tin,tout,net,openArr,closeArr,open};
}
const dEnd=B.filter(b=>b.type==='d').length;
const idx30=B.findIndex(b=>b.doff>30)-1, idx7=B.findIndex(b=>b.doff>7)-1;
const idx90=(()=>{let k=NB-1;for(let i=0;i<NB;i++)if(B[i].doff>90){k=i-1;break;}return k;})();
const idx180=(()=>{let k=NB-1;for(let i=0;i<NB;i++)if(B[i].doff>180){k=i-1;break;}return k;})();
const selTx=()=>DATA.tx.filter(t=>SEL.has(t.co));
function bucketOfDate(d){return B.findIndex(x=>x.start<=d&&d<=x.end);}

// دیدگاه خالص واقعی: چون در مدل «هر قسط مستقل» عمداً دوباره‌شماری داریم (پرداخت کامل سپس
// تجدید اصل ۱-۲ روز بعد)، حداقل مانده خام گاهی توسط این نویز زمان‌بندی به‌شدت منفی نشان داده
// می‌شود، در حالی که اثر مالی واقعی فقط بهرهٔ پرداختی است (چون همان مبلغ فوراً برمی‌گردد).
// این تابع پرداخت+تجدید هر قسط واقعی و هر چرخهٔ برآوردی را در تاریخ سررسیدش خالص می‌کند
// (فقط بهره، چون اصل فوراً تجدید/برمی‌گردد؛ بهرهٔ چرخه‌های برآوردی از build_forecast.py با نرخ سالانهٔ تخمینی می‌آید).
function computeNetView(){
 const C=compute();
 const adj=new Array(NB).fill(0);
 DATA.loans.filter(l=>SEL.has(l.co)&&l.status==='due').forEach(l=>{
  const b=bucketOfDate(l.pay); if(b>=0) adj[b]-=(l.total-l.renew_amt);
 });
 // چرخه‌های برآوردی هم تجدید تسهیلات واقعی‌اند (فقط بهره اثر نقدی دارد) — باید مثل تسهیلات واقعی در «کل افق» لحاظ شوند
 DATA.projected.filter(p=>SEL.has(p.co)).forEach(p=>{
  const b=bucketOfDate(p.due); if(b>=0) adj[b]-=(p.interest||0);
 });
 const newNet=C.net.map((v,i)=>v-C.rows['loan'][i]-C.rows['renew'][i]+adj[i]);
 const newClose=[]; let bal=C.open;
 for(let i=0;i<NB;i++){bal+=newNet[i];newClose.push(bal);}
 const minAll=Math.min(...newClose), mi=newClose.indexOf(minAll);
 const totInterest=adj.reduce((a,b)=>a+b,0);
 return {newNet,newClose,minAll,mi,totInterest};
}

// ================= ۰: داشبورد مدیریتی =================
// پلاگین سبک محلی برای نمودارهای ستونی افقی ساده (indexAxis:'y') — عدد کنار انتهای هر ستون
const barEndLabels={
 id:'barEndLabels',
 afterDatasetsDraw(chart){
  const {ctx}=chart;
  chart.data.datasets.forEach((ds,di)=>{
   const meta=chart.getDatasetMeta(di);
   meta.data.forEach((bar,i)=>{
    const val=ds.data[i]; if(Math.abs(val)<0.5) return;
    ctx.save();
    ctx.font='600 11px Vazirmatn'; ctx.fillStyle='#2b3a4a';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText(fa(val), bar.x+6, bar.y);
    ctx.restore();
   });
  });
 }
};

let chCo=null,chBank=null,chLoanCo=null,chLoanBank=null,chBlockCo=null,chBlockBank=null;
const PALETTE=['#2c5f8a','#7d3c98','#1e8449','#c0392b','#d68910','#148f77','#7f8c8d','#a04000'];
function renderExec(C){
 const min90=Math.min(...C.closeArr.slice(0,idx90+1));
 const i90=C.closeArr.indexOf(min90);
 const v=document.getElementById('verdictBottom');
 if(min90<0){v.className='verdict bad';
  v.innerHTML=`پاسخ به پرسش کلیدی: خیر — گروه بدون تأمین مالی جدید یا وصولی فروش، ۹۰ روز آینده را نمی‌گذراند؛ کسری تجمعی تا ${B[i90].end} به <span style="direction:ltr;display:inline-block">(${fa(-min90)})</span> میلیون تومان می‌رسد.`;}
 else{v.className='verdict ok';
  v.innerHTML=`پاسخ به پرسش کلیدی: بله — با فرض‌های فعلی، نقد گروه در ۹۰ روز آینده مثبت می‌ماند (حداقل ${fa(min90)} م.ت).`;}
 const pastDue=-(C.rows['np_past'][0]+C.rows['loan_past'][0]);
 const net7=C.net.slice(0,idx7+1).reduce((a,b)=>a+b,0);
 const net30=C.net.slice(0,idx30+1).reduce((a,b)=>a+b,0);
 const firstNeg=C.closeArr.findIndex(x=>x<0);
 const minAll=Math.min(...C.closeArr), mi=C.closeArr.indexOf(minAll);
 const runway=firstNeg<0?'+۹۰':fa(B[firstNeg].doff);
 const totMin=[...SEL].reduce((a,c)=>a+(POL[c]||0),0);
 const buffer=C.open-totMin;
 const NV=computeNetView();

 // ریسک تمرکز بانکی
 const bkAll={};DATA.accounts.filter(a=>SEL.has(a.co)).forEach(a=>{bkAll[a.bank]=(bkAll[a.bank]||0)+a.bal;});
 const bkTotal=Object.values(bkAll).reduce((a,b)=>a+b,0)||1;
 const bkTop=Object.entries(bkAll).sort((a,b)=>b[1]-a[1])[0]||['—',0];
 const bkShare=bkTop[1]/bkTotal*100;

 const totalLoans=DATA.loans.filter(l=>SEL.has(l.co)).reduce((a,l)=>a+l.total,0);
 const totalBlocked=DATA.accounts.filter(a=>SEL.has(a.co)).reduce((a,x)=>a+(x.blocked||0),0);

 const k=[
  {t:'نقد در دسترس گروه',v:fa(C.open),d:'میلیون تومان',c:''},
  {t:'تعهدات سررسیدگذشته',v:'('+fa(pastDue)+')',c:'neg',d:(pastDue/C.open).toLocaleString('fa-IR',{maximumFractionDigits:1})+'× نقد در دسترس'},
  {t:'خالص جریان ۷ روز آینده',v:cell(net7),d:'',c:''},
  {t:'خالص جریان ۳۰ روز آینده',v:cell(net30),d:'',c:''},
  {t:'بهرهٔ خالص تسهیلات (کل افق)',v:cell(NV.totInterest),d:'اثر واقعی تجدید تسهیلات روی نقد',c:''},
  {t:'تمرکز بانکی',v:bkShare.toLocaleString('fa-IR',{maximumFractionDigits:0})+'٪',d:'در '+bkTop[0]+' — ریسک تمرکز',c:bkShare>60?'neg':''},
  {t:'حداقل مانده افق (خام)',v:minAll<0?'('+fa(-minAll)+')':fa(minAll),c:'',d:'شامل نویز دوباره‌شماری — برای عدد قابل‌ارائه از کارت خالص استفاده کنید'},
  {t:'حاشیه نقدینگی',v:totMin>0?cell(buffer):'—',d:totMin>0?('حداقل مصوب: '+fa(totMin)+' م.ت'):'⚠ حداقل نقد مصوب (Policy) هنوز تعریف نشده',c:''},
  {t:'اولین تاریخ منفی',v:firstNeg<0?'—':B[firstNeg].full,c:firstNeg<0?'pos':'neg',d:firstNeg<0?'در کل افق مثبت می‌ماند':'Cash Runway: '+runway+' روز'},
  {t:'حداقل مانده افق (خالص واقعی — فقط بهره)',v:NV.minAll<0?'('+fa(-NV.minAll)+')':fa(NV.minAll),c:NV.minAll<0?'neg':'pos',d:'در '+B[NV.mi].full+' · بدون نویز زمان‌بندی تجدید تسهیلات'},
  {t:'جمع کل تسهیلات (اصل+بهره)',v:fa(totalLoans),d:'مانده فعلی — میلیون تومان',c:''},
  {t:'مانده مسدود بانکی (تسهیلات)',v:fa(totalBlocked),d:'وثیقهٔ نقدی نزد بانک‌ها',c:totalBlocked>0?'neg':''},
 ];
 document.getElementById('kpis').innerHTML=k.map(x=>`<div class="kpi"><div class="t">${x.t}</div><div class="v ${x.c}">${x.v}</div><div class="d">${x.d}</div></div>`).join('');
 const cos=[...SEL];
 // تیتر پویا: شرکت با بیشترین سهم نقد گروه
 const openVals=cos.map(c=>DATA.opening[c]||0);
 const openTot=openVals.reduce((a,b)=>a+b,0)||1;
 const maxCoIdx=openVals.indexOf(Math.max(...openVals));
 const maxCoShare=openVals[maxCoIdx]/openTot*100;
 document.getElementById('chCoTitle').textContent=
  maxCoShare>=45 ? `${maxCoShare.toLocaleString('fa-IR',{maximumFractionDigits:0})}٪ نقد گروه در ${coFa(cos[maxCoIdx])} است`
                 : 'نقد در دسترس به تفکیک شرکت';
 if(chCo)chCo.destroy();
 chCo=new Chart(document.getElementById('chCo'),{type:'bar',
  data:{labels:cos.map(coFa),datasets:[{data:openVals,backgroundColor:cos.map((_,i)=>PALETTE[i%PALETTE.length])}]},
  plugins:[barEndLabels],
  options:{indexAxis:'y',maintainAspectRatio:false,layout:{padding:{right:60}},plugins:{legend:{display:false},
   tooltip:{rtl:true,callbacks:{label:c=>fa(c.raw)+' م.ت'}}},
   scales:{x:{ticks:{callback:v=>fa(v)}}},
   onClick:(e,el)=>{if(el.length){document.getElementById('drillCo').value=cos[el[0].index];renderDrill();}}}});

 // نمودار بانک: هرس بانک‌های زیر ۵٪ سهم به «سایر» تا نویز حذف شود
 const bk={};DATA.accounts.filter(a=>SEL.has(a.co)).forEach(a=>{bk[a.bank]=(bk[a.bank]||0)+a.bal;});
 const bkTotalAll=Object.values(bk).reduce((a,b)=>a+b,0)||1;
 const bkSorted=Object.entries(bk).sort((a,b)=>b[1]-a[1]);
 const bkMain=bkSorted.filter(([,v])=>v/bkTotalAll>=0.05);
 const bkOtherSum=bkSorted.filter(([,v])=>v/bkTotalAll<0.05).reduce((a,[,v])=>a+v,0);
 const top=bkOtherSum>0 ? [...bkMain,['سایر بانک‌ها (هرکدام <۵٪)',bkOtherSum]] : bkMain;
 const bkTopShare=bkSorted[0]?bkSorted[0][1]/bkTotalAll*100:0;
 document.getElementById('chBankTitle').textContent=
  bkTopShare>=50 ? `${bkTopShare.toLocaleString('fa-IR',{maximumFractionDigits:0})}٪ نقد گروه در ${bkSorted[0][0]} متمرکز است — ریسک تمرکز بالا`
                 : 'نقد در دسترس به تفکیک بانک';
 if(chBank)chBank.destroy();
 chBank=new Chart(document.getElementById('chBank'),{type:'bar',
  data:{labels:top.map(x=>x[0]),datasets:[{data:top.map(x=>x[1]),backgroundColor:top.map((x,i)=>x[0].startsWith('سایر')?'#b7c3cf':PALETTE[i%PALETTE.length])}]},
  plugins:[barEndLabels],
  options:{indexAxis:'y',maintainAspectRatio:false,layout:{padding:{right:60}},plugins:{legend:{display:false},
   tooltip:{rtl:true,callbacks:{label:c=>fa(c.raw)+' م.ت'}}},scales:{x:{ticks:{callback:v=>fa(v)}}}}});

 // مانده مسدود بانکی به تفکیک شرکت و بانک (شیت Cash — ستون مسدودی)
 const blkCo={},blkBank={};
 DATA.accounts.filter(a=>SEL.has(a.co)).forEach(a=>{
  blkCo[a.co]=(blkCo[a.co]||0)+(a.blocked||0); blkBank[a.bank]=(blkBank[a.bank]||0)+(a.blocked||0);});
 const blkCoE=Object.entries(blkCo).filter(([,v])=>v>0.5).sort((a,b)=>b[1]-a[1]);
 const blkBankE=Object.entries(blkBank).filter(([,v])=>v>0.5).sort((a,b)=>b[1]-a[1]);
 if(chBlockCo)chBlockCo.destroy();
 chBlockCo=new Chart(document.getElementById('chBlockCo'),{type:'bar',
  data:{labels:blkCoE.map(([co])=>coFa(co)),datasets:[{data:blkCoE.map(([,v])=>v),backgroundColor:blkCoE.map((_,i)=>PALETTE[i%PALETTE.length])}]},
  plugins:[barEndLabels],
  options:{indexAxis:'y',maintainAspectRatio:false,layout:{padding:{right:60}},plugins:{legend:{display:false},
   tooltip:{rtl:true,callbacks:{label:c=>fa(c.raw)+' م.ت'}}},scales:{x:{ticks:{callback:v=>fa(v)}}}}});
 if(chBlockBank)chBlockBank.destroy();
 chBlockBank=new Chart(document.getElementById('chBlockBank'),{type:'bar',
  data:{labels:blkBankE.map(([b])=>b),datasets:[{data:blkBankE.map(([,v])=>v),backgroundColor:blkBankE.map((_,i)=>PALETTE[i%PALETTE.length])}]},
  plugins:[barEndLabels],
  options:{indexAxis:'y',maintainAspectRatio:false,layout:{padding:{right:60}},plugins:{legend:{display:false},
   tooltip:{rtl:true,callbacks:{label:c=>fa(c.raw)+' م.ت'}}},scales:{x:{ticks:{callback:v=>fa(v)}}}}});
 const w=selTx().filter(t=>{const b=B.findIndex(x=>x.start<=t.d&&t.d<=x.end);return b>=0&&b<=idx30;});
 const mk=(list,el)=>{let h='<table><thead><tr><th>تاریخ</th><th class="lbl" style="min-width:180px">شرح</th><th>شرکت</th><th>مبلغ</th></tr></thead><tbody>';
  list.forEach(t=>{h+=`<tr><td class="n">${t.d}</td><td class="lbl" style="min-width:180px">${t.desc}</td><td>${coFa(t.co)}</td><td class="n">${cell(t.amt)}</td></tr>`;});
  document.getElementById(el).innerHTML=h+'</tbody></table>';};
 mk(w.filter(t=>t.amt<0).sort((a,b)=>a.amt-b.amt).slice(0,10),'topOut');
 mk(w.filter(t=>t.amt>0).sort((a,b)=>b.amt-a.amt).slice(0,10),'topIn');
 renderAlerts(C);
}
const dSel=document.getElementById('drillCo');
{const o=document.createElement('option');o.value='__ALL__';o.textContent='همه گروه';dSel.appendChild(o);}
COS.forEach(c=>{const o=document.createElement('option');o.value=c.key;o.textContent=c.fa;dSel.appendChild(o);});
dSel.onchange=renderDrill;
function renderDrill(){
 const co=dSel.value;
 const coMatch=a=>co==='__ALL__'?SEL.has(a.co):a.co===co;
 let h=co==='__ALL__'
  ?'<table><thead><tr><th style="width:70px">شرکت</th><th>بانک</th><th style="width:70px">حساب</th><th style="width:90px">مانده</th></tr></thead><tbody>'
  :'<table><thead><tr><th>بانک</th><th style="width:70px">حساب</th><th style="width:90px">مانده</th></tr></thead><tbody>';
 DATA.accounts.filter(coMatch).sort((a,b)=>b.bal-a.bal).forEach(a=>{
  h+=co==='__ALL__'
   ?`<tr><td style="font-size:12px">${coFa(a.co)}</td><td>${a.bank}</td><td class="n small">${a.acct}</td><td class="n small">${cell(a.bal)}</td></tr>`
   :`<tr><td>${a.bank}</td><td class="n small">${a.acct}</td><td class="n small">${cell(a.bal)}</td></tr>`;});
 document.getElementById('drillAcc').innerHTML=h+'</tbody></table>';
 let t=co==='__ALL__'
  ?'<table><thead><tr><th>تاریخ</th><th>شرکت</th><th>دسته</th><th>مبلغ</th><th>شرح</th></tr></thead><tbody>'
  :'<table><thead><tr><th>تاریخ</th><th>دسته</th><th>مبلغ</th><th>شرح</th></tr></thead><tbody>';
 DATA.tx.filter(coMatch).filter(x=>{const b=B.findIndex(y=>y.start<=x.d&&x.d<=y.end);return b>=0&&b<=idx30;})
  .sort((a,b)=>a.d<b.d?-1:1).forEach(x=>{
  t+=co==='__ALL__'
   ?`<tr><td class="n">${x.d}</td><td>${coFa(x.co)}</td><td>${CATL[x.cat]||x.cat}</td><td class="n">${cell(x.amt)}</td><td style="text-align:right;min-width:170px">${x.desc}</td></tr>`
   :`<tr><td class="n">${x.d}</td><td>${CATL[x.cat]||x.cat}</td><td class="n">${cell(x.amt)}</td><td style="text-align:right;min-width:170px">${x.desc}</td></tr>`;});
 document.getElementById('drillTx').innerHTML=t+'</tbody></table>';
}
function renderAlerts(C){
 const A=[];
 const pastDue=-(C.rows['np_past'][0]+C.rows['loan_past'][0]);
 if(pastDue>0)A.push(['crit',`تعهدات سررسیدگذشته ${fa(pastDue)} م.ت معادل ${(pastDue/C.open).toLocaleString('fa-IR',{maximumFractionDigits:1})} برابر نقد در دسترس است.`]);
 const negs=[],surp=[];
 for(const co of SEL){const s=coSeries(co);const fn=s.close.findIndex(v=>v<(POL[co]||0));
  const mn=Math.min(...s.close);
  if(fn>=0&&B[fn].doff<=30)negs.push([co,fn]); if(mn>0)surp.push([co,mn]);}
 negs.sort((a,b)=>a[1]-b[1]).forEach(([co,fn])=>A.push(['crit',`${coFa(co)} از ${B[fn].full} به زیر حداقل مصوب می‌رود (${fa(B[fn].doff)} روز دیگر).`]));
 surp.forEach(([co,mn])=>A.push(['info',`${coFa(co)} در کل افق حداقل ${fa(mn)} م.ت مازاد نگه می‌دارد.`]));
 const lr=C.rows['loan'];let mx=0,mi=0;for(let i=0;i<=Math.min(idx30,NB-1);i++)if(-lr[i]>mx){mx=-lr[i];mi=i;}
 if(mx>C.open*0.5)A.push(['warn',`تمرکز سررسید تسهیلات در ${B[mi].full}: پرداخت ${fa(mx)} م.ت.`]);
 const bnc=DATA.bounced.filter(r=>SEL.has(r.co)).reduce((a,r)=>a+r.amt,0);
 const net30=-C.net.slice(0,idx30+1).reduce((a,b)=>a+b,0);
 if(bnc>0&&net30>0)A.push(['warn',`${fa(bnc)} م.ت چک برگشتی و معوق دریافتنی قابل پیگیری است.`]);
 if(DATA.diff){
  if(DATA.diff.newly_past_loans.length)A.push(['crit',`${DATA.diff.newly_past_loans.length} قسط تسهیلات از گزارش ${DATA.diff.prev_date} تازه به فهرست معوق پیوسته‌اند — جزئیات در تب «تغییرات».`]);
  if(DATA.diff.new_bounced.length)A.push(['warn',`${DATA.diff.new_bounced.length} چک تازه به فهرست برگشتی/معوق اضافه شده است.`]);
 }
 document.getElementById('alerts').innerHTML=A.map(([s,t])=>`<div class="alert ${s}">${t}</div>`).join('')||'<div class="alert info">هشداری وجود ندارد.</div>';
}

// ================= ۱: منابع و مصارف =================
function renderMatrix(C){
 // این دسته‌ها طبق درخواست حذف شدند چون به هیچ منبع داده‌ای در گزارش وصل نیستند و خالی
 // می‌مانند؛ اگر بعداً منبع داده‌ای برایشان تعریف شود (مثلاً از ورودی دستی)، به همین لیست
 // اضافه‌شان کن تا دوباره در جدول دیده شوند.
 const HIDDEN_EMPTY_CATS = ['dep_release','intergroup','other_in','ap_petty','loan_fee']; // tax_ins دیگر خالی نیست (اصلاح دسته‌بندی مالیات)
 const inCats=CATS.filter(c=>c.dir==='in' && !HIDDEN_EMPTY_CATS.includes(c.id)),
       outCats=CATS.filter(c=>c.dir==='out' && !HIDDEN_EMPTY_CATS.includes(c.id));
 let h='<table><thead><tr><th class="lbl">شرح</th>';
 B.forEach(b=>{h+=`<th class="${b.off?'off':''}" title="${b.holiday||b.full}">${b.label}</th>`;});
 h+='</tr></thead><tbody>';
 const num=(v,b)=>`<td class="n ${b.off?'offc':''}">${cell(v)}</td>`;
 h+=`<tr class="bal"><td class="lbl">مانده ابتدای دوره</td>${B.map((b,i)=>num(C.openArr[i],b)).join('')}</tr>`;
 const catTr=(c)=>{
  const hasCo=[...SEL].filter(co=>catCo(c.id,co).some(v=>Math.abs(v)>0.5));
  let s=`<tr class="exp ${c.id==='nr'?'nr':''}" data-c="${c.id}"><td class="lbl">${c.label}${hasCo.length>1?'<span class="car">▸</span>':''}</td>${B.map((b,i)=>num(C.rows[c.id][i],b)).join('')}</tr>`;
  hasCo.forEach(co=>{s+=`<tr class="sub" data-p="${c.id}" style="display:none"><td class="lbl">${coFa(co)}</td>${B.map((b,i)=>num(catCo(c.id,co)[i],b)).join('')}</tr>`;});
  return s;};
 h+=`<tr class="sect"><td class="lbl">منابع</td>${B.map(()=>'<td></td>').join('')}</tr>`;
 inCats.forEach(c=>h+=catTr(c));
 h+=`<tr class="tot"><td class="lbl">جمع منابع</td>${B.map((b,i)=>num(C.tin[i],b)).join('')}</tr>`;
 h+=`<tr class="sect"><td class="lbl">مصارف</td>${B.map(()=>'<td></td>').join('')}</tr>`;
 outCats.forEach(c=>h+=catTr(c));
 h+=`<tr class="tot"><td class="lbl">جمع مصارف</td>${B.map((b,i)=>num(C.tout[i],b)).join('')}</tr>`;
 h+=`<tr class="tot"><td class="lbl">خالص جریان دوره</td>${B.map((b,i)=>num(C.net[i],b)).join('')}</tr>`;
 h+=`<tr class="bal"><td class="lbl">مانده پایان دوره</td>${B.map((b,i)=>num(C.closeArr[i],b)).join('')}</tr>`;
 h+='</tbody></table>';
 const el=document.getElementById('matrix');el.innerHTML=h;
 el.querySelectorAll('tr.exp').forEach(tr=>{tr.onclick=()=>{tr.classList.toggle('open');
  const open=tr.classList.contains('open');
  el.querySelectorAll(`tr.sub[data-p="${tr.dataset.c}"]`).forEach(s=>s.style.display=open?'':'none');};});
}
let CH=null;
function renderChart(C){
 const labels=B.map(b=>b.type!=='d'?b.label.replace('<br>',' '):b.full.slice(5));
 const min=Math.min(...C.closeArr),mi=C.closeArr.indexOf(min);
 const firstNeg=C.closeArr.findIndex(v=>v<0);
 const msg=document.getElementById('chartMsg');
 if(firstNeg>=0)msg.innerHTML=`با اجرای کامل تعهدات و بدون وصولی فروش، مانده گروه از <span class="hl">${B[firstNeg].full}</span> منفی می‌شود و در ${B[mi].full} به <span class="hl">(${fa(-min)})</span> میلیون تومان می‌رسد.`;
 else msg.innerHTML='مانده تجمعی در کل افق پیش‌بینی مثبت می‌ماند.';
 if(CH)CH.destroy();
 CH=new Chart(document.getElementById('mainChart'),{data:{labels,datasets:[
  {type:'bar',label:'منابع',data:C.tin,backgroundColor:'rgba(30,132,73,.55)',stack:'s'},
  {type:'bar',label:'مصارف',data:C.tout,backgroundColor:'rgba(192,57,43,.55)',stack:'s'},
  {type:'line',label:'مانده تجمعی',data:C.closeArr,borderColor:'#2c5f8a',pointRadius:0,borderWidth:2.5,tension:.2}]},
  options:{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
   plugins:{tooltip:{rtl:true,callbacks:{label:c=>`${c.dataset.label}: ${fa(c.raw)}`}}},
   scales:{x:{ticks:{maxTicksLimit:24}},
     y:{ticks:{callback:v=>fa(v)},grid:{color:c=>c.tick.value===0?'#c0392b':'#e3e8ef',lineWidth:c=>c.tick.value===0?2:1}}}}});
}

// ================= ۲: نمای غلتان ۱۳ هفته (جدید) =================
let chW13=null;
function renderW13(){
 const txs=selTx();
 const wins=[]; for(let w=0;w<13;w++)wins.push({s:w*7,e:w*7+6,in:0,out:0});
 txs.forEach(t=>{if(t.doff==null)return; const w=Math.floor(t.doff/7); if(w>=0&&w<13){t.amt>=0?wins[w].in+=t.amt:wins[w].out+=t.amt;}});
 let open=0;for(const co of SEL)open+=DATA.opening[co]||0;
 let bal=open; const closeArr=[];
 wins.forEach(w=>{bal+=w.in+w.out;closeArr.push(bal);});
 const minC=Math.min(...closeArr), mIdx=closeArr.indexOf(minC);
 document.getElementById('w13Msg').innerHTML= minC<0?
  `در نمای ۱۳ هفته‌ای، مانده گروه در هفته ${fa(mIdx+1)} به کمینه <span class="hl">(${fa(-minC)})</span> م.ت می‌رسد.`:
  `مانده گروه در تمام ۱۳ هفته آینده مثبت می‌ماند؛ کمینه: ${fa(minC)} م.ت در هفته ${fa(mIdx+1)}.`;
 const labels=wins.map((w,i)=>'هفته '+fa(i+1));
 if(chW13)chW13.destroy();
 chW13=new Chart(document.getElementById('chW13'),{data:{labels,datasets:[
  {type:'bar',label:'ورودی',data:wins.map(w=>w.in),backgroundColor:'rgba(30,132,73,.55)',stack:'s'},
  {type:'bar',label:'خروجی',data:wins.map(w=>w.out),backgroundColor:'rgba(192,57,43,.55)',stack:'s'},
  {type:'line',label:'مانده پایان هفته',data:closeArr,borderColor:'#2c5f8a',pointRadius:2,borderWidth:2.5,tension:.15}]},
  options:{maintainAspectRatio:false,plugins:{tooltip:{rtl:true,callbacks:{label:c=>`${c.dataset.label}: ${fa(c.raw)}`}}},
   scales:{y:{ticks:{callback:v=>fa(v)},grid:{color:c=>c.tick.value===0?'#c0392b':'#e3e8ef'}}}}});
 let h='<table><thead><tr><th class="lbl">هفته</th><th>بازه</th><th>ورودی</th><th>خروجی</th><th>خالص</th><th>مانده پایان هفته</th></tr></thead><tbody>';
 wins.forEach((w,i)=>{h+=`<tr><td class="lbl">هفته ${fa(i+1)}</td><td class="n small">${'روز '+fa(w.s)+' تا '+fa(w.e)}</td><td class="n">${cell(w.in)}</td><td class="n">${cell(w.out)}</td><td class="n">${cell(w.in+w.out)}</td><td class="n">${cell(closeArr[i])}</td></tr>`;});
 document.getElementById('w13Tbl').innerHTML=h+'</tbody></table>';
}

// ================= ۳: استرس‌تست تعاملی (جدید) =================
let chStress=null;
function computeScenario(collectPct, renewPct){
 const rows={};CATS.forEach(c=>rows[c.id]=catRow(c.id).slice());
 rows['nr']=rows['nr'].map(v=>v*collectPct/100);
 rows['renew']=rows['renew'].map(v=>v*renewPct/100);
 const tin=new Array(NB).fill(0),tout=new Array(NB).fill(0);
 CATS.filter(c=>c.dir==='in').forEach(c=>{for(let i=0;i<NB;i++)tin[i]+=rows[c.id][i];});
 CATS.filter(c=>c.dir==='out').forEach(c=>{for(let i=0;i<NB;i++)tout[i]+=rows[c.id][i];});
 let open=0;for(const co of SEL)open+=DATA.opening[co]||0;
 const net=tin.map((v,i)=>v+tout[i]);
 const closeArr=[];let bal=open;for(let i=0;i<NB;i++){bal+=net[i];closeArr.push(bal);}
 return {open,closeArr};
}
function renderStress(){
 const cPct=+document.getElementById('sldCollect').value, rPct=+document.getElementById('sldRenew').value;
 document.getElementById('vCollect').textContent=fa(cPct)+'٪'; document.getElementById('vRenew').textContent=fa(rPct)+'٪';
 const base=computeScenario(100,100), scen=computeScenario(cPct,rPct);
 const minB=Math.min(...base.closeArr), minS=Math.min(...scen.closeArr);
 const fnB=base.closeArr.findIndex(v=>v<0), fnS=scen.closeArr.findIndex(v=>v<0);
 const gapDelta=minS-minB;
 const k=[
  {t:'حداقل مانده — پایه',v:minB<0?'('+fa(-minB)+')':fa(minB),c:minB<0?'neg':'pos'},
  {t:'حداقل مانده — سناریو',v:minS<0?'('+fa(-minS)+')':fa(minS),c:minS<0?'neg':'pos'},
  {t:'اثر سناریو بر کف نقد',v:cell(gapDelta),c:gapDelta<0?'neg':'pos',d:'نسبت به پایه'},
  {t:'اولین تاریخ منفی — سناریو',v:fnS<0?'—':B[fnS].full,c:fnS<0?'pos':'neg',d:fnB<0?'':'پایه: '+(fnB<0?'—':B[fnB].full)},
 ];
 document.getElementById('stressKpis').innerHTML=k.map(x=>`<div class="kpi"><div class="t">${x.t}</div><div class="v ${x.c}">${x.v}</div><div class="d">${x.d||''}</div></div>`).join('');
 const labels=B.map(b=>b.type!=='d'?b.label.replace('<br>',' '):b.full.slice(5));
 if(chStress)chStress.destroy();
 chStress=new Chart(document.getElementById('chStress'),{data:{labels,datasets:[
  {type:'line',label:'مانده — پایه (۱۰۰٪/۱۰۰٪)',data:base.closeArr,borderColor:'#2c5f8a',borderDash:[5,4],pointRadius:0,borderWidth:2},
  {type:'line',label:`مانده — سناریو (${cPct}٪/${rPct}٪)`,data:scen.closeArr,borderColor:'#c0392b',pointRadius:0,borderWidth:2.5}]},
  options:{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
   plugins:{tooltip:{rtl:true,callbacks:{label:c=>`${c.dataset.label}: ${fa(c.raw)}`}}},
   scales:{x:{ticks:{maxTicksLimit:24}},y:{ticks:{callback:v=>fa(v)},grid:{color:c=>c.tick.value===0?'#c0392b':'#e3e8ef'}}}}});
}
document.getElementById('sldCollect').addEventListener('input',renderStress);
document.getElementById('sldRenew').addEventListener('input',renderStress);
document.querySelectorAll('#p3 .btnrow .btn').forEach(b=>b.addEventListener('click',()=>{
 document.querySelectorAll('#p3 .btnrow .btn').forEach(x=>x.classList.remove('act'));b.classList.add('act');
 if(b.dataset.p==='base'){document.getElementById('sldCollect').value=100;document.getElementById('sldRenew').value=100;}
 else if(b.dataset.p==='stress'){document.getElementById('sldCollect').value=70;document.getElementById('sldRenew').value=50;}
 else{document.getElementById('sldCollect').value=100;document.getElementById('sldRenew').value=100;}
 renderStress();}));

// ================= ۴: ریسک =================
function renderRisk(){
 const pol=document.getElementById('polInputs');pol.innerHTML='';
 [...SEL].forEach(co=>{const d=document.createElement('div');
  d.innerHTML=`<label style="font-size:13px">${coFa(co)}<br><input type="number" step="100" value="${POL[co]||0}" style="width:130px;margin-top:4px"></label>`;
  d.querySelector('input').onchange=e=>{POL[co]=+e.target.value||0;renderRisk();renderExec(compute());};
  pol.appendChild(d);});
 const cos=[...SEL];
 let h='<table><thead><tr><th class="lbl">شرکت</th>';
 for(let i=0;i<dEnd;i++)h+=`<th class="${B[i].off?'off':''}" title="${B[i].holiday||B[i].full}">${B[i].full.slice(8)}</th>`;
 h+='</tr></thead><tbody>';
 const grp=new Array(dEnd).fill(0);
 cos.forEach(co=>{
  const s=coSeries(co);const mn=POL[co]||0;
  h+=`<tr><td class="lbl">${coFa(co)}</td>`;
  for(let i=0;i<dEnd;i++){
   grp[i]+=s.close[i];
   let cls='g';
   if(s.close[i]<mn||s.close[i]<0)cls='r';
   else{const j=Math.min(i+7,dEnd-1);let breach=false;
    for(let k=i+1;k<=j;k++){if(s.close[k]<mn){breach=true;break;}}
    if(breach)cls='y';}
   if(B[i].off&&cls==='g')cls='off';
   h+=`<td class="${cls}" title="${coFa(co)} ${B[i].full}: ${fa(s.close[i])}"></td>`;}
  h+='</tr>';});
 const totMin=cos.reduce((a,c)=>a+(POL[c]||0),0);
 h+=`<tr class="tot"><td class="lbl">گروه (تجمیع)</td>`;
 for(let i=0;i<dEnd;i++){let cls=grp[i]<totMin||grp[i]<0?'r':'g';
  if(cls==='g'){for(let k=i+1;k<=Math.min(i+7,dEnd-1);k++)if(grp[k]<totMin){cls='y';break;}}
  h+=`<td class="${cls}" title="گروه ${B[i].full}: ${fa(grp[i])}"></td>`;}
 h+='</tr></tbody></table>';
 document.getElementById('heatmap').innerHTML=h;
 const C=compute();const fn=C.closeArr.findIndex(v=>v<totMin);
 document.getElementById('riskMsg').innerHTML=fn>=0?
  `با حداقل مصوب فعلی (${fa(totMin)} م.ت)، گروه از <span class="hl">${B[fn].full}</span> وارد ناحیه هشدار می‌شود.`:
  'گروه در کل افق بالای حداقل مصوب می‌ماند.';
}

// ================= ۵: محرک‌ها =================
let WF=null,HZ='30';
// پلاگین سبک محلی برای نمایش عدد روی هر ستون (بدون وابستگی به کتابخانهٔ خارجی)
const barValueLabels={
 id:'barValueLabels',
 afterDatasetsDraw(chart){
  const {ctx}=chart;
  chart.data.datasets.forEach((ds,di)=>{
   const meta=chart.getDatasetMeta(di);
   meta.data.forEach((bar,i)=>{
    const raw=ds.data[i]; if(!Array.isArray(raw)) return;
    const val=raw[1]-raw[0]; if(Math.abs(val)<0.5) return;
    ctx.save();
    ctx.font='600 11px Vazirmatn'; ctx.fillStyle='#2b3a4a'; ctx.textAlign='center';
    const above = val>=0;
    ctx.fillText(fa(val), bar.x, above?bar.y-6:bar.base+16);
    ctx.restore();
   });
  });
 }
};
document.querySelectorAll('#p5 .btnrow .btn').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('#p5 .btnrow .btn').forEach(x=>x.classList.remove('act'));
 b.classList.add('act');HZ=b.dataset.h;renderDrivers(compute());});
function renderDrivers(C){
 const HZ_IDX={'30':idx30,'90':idx90,'180':idx180,'all':NB-1};
 const HZ_LABEL={'30':'۳۰ روز آینده','90':'سه ماه آینده','180':'شش ماه آینده','all':'کل افق'};
 const lim=HZ_IDX[HZ]??(NB-1);
 const sums=CATS.map(c=>({id:c.id,label:c.label,dir:c.dir,
  v:C.rows[c.id].slice(0,lim+1).reduce((a,b)=>a+b,0)})).filter(x=>Math.abs(x.v)>0.5);
 sums.sort((a,b)=>b.v-a.v);
 const closing=C.open+sums.reduce((a,x)=>a+x.v,0);
 const labels=['مانده ابتدا',...sums.map(x=>x.label),'مانده پایان'];
 const bars=[[0,C.open]];let run=C.open;
 sums.forEach(x=>{bars.push([run,run+x.v]);run+=x.v;});
 bars.push([0,closing]);
 const colors=['#2c5f8a',...sums.map(x=>x.v>=0?'rgba(30,132,73,.75)':'rgba(192,57,43,.75)'),closing<0?'#8e2c20':'#2c5f8a'];
 if(WF)WF.destroy();
 WF=new Chart(document.getElementById('chWf'),{type:'bar',
  data:{labels,datasets:[{data:bars,backgroundColor:colors,borderSkipped:false}]},
  plugins:[barValueLabels],
  options:{maintainAspectRatio:false,layout:{padding:{top:22,bottom:18}},plugins:{legend:{display:false},
   tooltip:{rtl:true,callbacks:{label:c=>fa(c.raw[1]-c.raw[0])}}},
   scales:{y:{ticks:{callback:v=>fa(v)},grid:{color:c=>c.tick.value===0?'#c0392b':'#e3e8ef'}},
    x:{ticks:{font:{size:11},maxRotation:60,minRotation:40}}}}});
 const totOut=-sums.filter(x=>x.v<0).reduce((a,x)=>a+x.v,0);
 const big=sums.filter(x=>x.v<0).sort((a,b)=>a.v-b.v)[0];
 document.getElementById('drvMsg').innerHTML=big?
  `در ${HZ_LABEL[HZ]} (تا ${B[lim].end})، «${big.label}» با ${(-big.v/totOut*100).toLocaleString('fa-IR',{maximumFractionDigits:0})}٪ از کل خروجی‌ها، بزرگ‌ترین محرک مصرف نقد است.`:'';
 let h='<table><thead><tr><th class="lbl">محرک</th><th>مبلغ</th><th>سهم از جهت خود</th></tr></thead><tbody>';
 const totIn=sums.filter(x=>x.v>0).reduce((a,x)=>a+x.v,0);
 sums.forEach(x=>{const base=x.v>=0?totIn:totOut;
  h+=`<tr><td class="lbl">${x.label}</td><td class="n">${cell(x.v)}</td><td class="n">${base?(Math.abs(x.v)/base*100).toLocaleString('fa-IR',{maximumFractionDigits:1})+'٪':'—'}</td></tr>`;});
 document.getElementById('drvTbl').innerHTML=h+'</tbody></table>';
}

// ================= ۶: تقویم =================
function renderCal(){
 const MN=['','فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
 const WD=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
 const ML={1405:[31,31,31,31,31,31,30,30,30,30,30,29],1406:[31,31,31,31,31,31,30,30,30,30,30,29]};
 const dnum=(y,m,d)=>{let n=0;const YL={1403:366,1404:365};for(let yy=1403;yy<y;yy++)n+=YL[yy]||365;
   return n+ML[y].slice(0,m-1).reduce((a,b)=>a+b,0)+d;};
 const anchor=dnum(1405,4,17);
 const wd=(y,m,d)=>((4+dnum(y,m,d)-anchor)%7+7)%7;
 const hol=(y,m,d)=>DATA.holidays[`${y}/${String(m).padStart(2,'0')}/${String(d).padStart(2,'0')}`]||'';
 const txSel=selTx();
 const byDay={};txSel.forEach(t=>{(byDay[t.d]=byDay[t.d]||[]).push(t);});
 const wrap=document.getElementById('calWrap');wrap.innerHTML='';
 const [ry0,rm0]=DATA.report_date.split('/').map(Number);
 const calMonths=[0,1,2].map(i=>{let mm=rm0+i,yy=ry0;while(mm>12){mm-=12;yy+=1;}return[yy,mm];});
 calMonths.forEach(([y,m])=>{
  const div=document.createElement('div');div.className='cal';
  let h=`<div class="cal-hdr">${MN[m]} ${y}</div><div class="cal-wday">${WD.map(w=>`<div>${w}</div>`).join('')}</div><div class="cal-days">`;
  for(let i=0;i<wd(y,m,1);i++)h+='<div class="cal-day out"></div>';
  for(let d=1;d<=ML[y][m-1];d++){
   const ds=`${y}/${String(m).padStart(2,'0')}/${String(d).padStart(2,'0')}`;
   const evs=byDay[ds]||[];const net=evs.reduce((a,t)=>a+t.amt,0);
   const off=wd(y,m,d)===6||hol(y,m,d);
   const today=ds===DATA.report_date;
   const cls='cal-day'+(off?' off':'')+(evs.length?' has':'')+(today?' today':'');
   h+=`<div class="${cls}" data-d="${ds}" title="${hol(y,m,d)}"><span class="dn">${d}</span>`;
   if(evs.length)h+=`<span class="ev ${net<0?'neg':'pos'}">${net<0?'('+fa(-net)+')':fa(net)}</span><span class="ev small">${evs.length} رویداد</span>`;
   h+='</div>';}
  div.innerHTML=h+'</div>';wrap.appendChild(div);});
 wrap.querySelectorAll('.cal-day.has').forEach(el=>el.onclick=()=>{
  const ds=el.dataset.d;const evs=(byDay[ds]||[]).sort((a,b)=>a.amt-b.amt);
  document.getElementById('dayTitle').style.display='block';
  document.getElementById('dayTitle').textContent='رویدادهای '+ds;
  let h='<table><thead><tr><th>دسته</th><th class="lbl" style="min-width:200px">شرح</th><th>شرکت</th><th>مبلغ</th></tr></thead><tbody>';
  evs.forEach(t=>{h+=`<tr><td>${CATL[t.cat]||t.cat}</td><td class="lbl" style="min-width:200px">${t.desc}</td><td>${coFa(t.co)}</td><td class="n">${cell(t.amt)}</td></tr>`;});
  const dt=document.getElementById('dayTbl');dt.style.display='block';dt.innerHTML=h+'</tbody></table>';});
 const [lastCalY,lastCalM]=calMonths[calMonths.length-1];
 const lastCalYm=`${lastCalY}/${String(lastCalM).padStart(2,'0')}`;
 const far={};txSel.forEach(t=>{const ym=t.d.slice(0,7);if(ym>lastCalYm){
  far[ym]=far[ym]||{in:0,out:0};t.amt>=0?far[ym].in+=t.amt:far[ym].out+=t.amt;}});
 let h='<table><thead><tr><th class="lbl">ماه</th><th>ورودی برنامه‌ریزی‌شده</th><th>خروجی برنامه‌ریزی‌شده</th><th>خالص</th></tr></thead><tbody>';
 Object.keys(far).sort().forEach(ym=>{const f=far[ym];const[yy,mm]=ym.split('/');
  h+=`<tr><td class="lbl">${MN[+mm]} ${yy}</td><td class="n">${cell(f.in)}</td><td class="n">${cell(f.out)}</td><td class="n">${cell(f.in+f.out)}</td></tr>`;});
 document.getElementById('farTbl').innerHTML=h+'</tbody></table>';
}

// ================= ۷ب: چرخه بعدی تسهیلات (جدید) =================
function renderCycles(){
 const P=DATA.projected.filter(p=>SEL.has(p.co));
 const tot=P.reduce((a,p)=>a+p.amt,0);
 const maxCyc=P.length?Math.max(...P.map(p=>p.cycle)):0;
 const highConf=P.filter(p=>p.tenor_conf>=80).length;
 document.getElementById('cycMsg').innerHTML= P.length?
  `${fa(P.length)} چرخهٔ بعدی برآوردی روی ${new Set(P.map(p=>p.no)).size} فقره تسهیلات شناسایی شد — جمع اصل چرخانده‌شده: ${fa(tot)} م.ت؛ ${fa(highConf)} مورد (${(highConf/P.length*100).toLocaleString('fa-IR',{maximumFractionDigits:0})}٪) بر مبنای تناوب واقعی گزارش تسهیلات، نه برآورد.`:
  'برای انتخاب فعلی، چرخهٔ بعدی برآوردی وجود ندارد.';
 const piv={};
 P.forEach(p=>{const k=`${p.type} ${p.bank} — ${coFa(p.co)}`;
  piv[k]=piv[k]||{n:0,amt:0,tenor:p.tenor,src:p.tenor_src,conf:p.tenor_conf};
  piv[k].n++; piv[k].amt+=p.amt;});
 const confPill=c=>`<span class="pill ${c>=80?'g':c>=55?'m':'b'}">${fa(c)}٪</span>`;
 let h='<table><thead><tr><th class="lbl">نوع / بانک / شرکت</th><th>تعداد چرخه</th><th>جمع اصل</th><th>تناوب (روز)</th><th>منبع تناوب</th><th>اطمینان</th></tr></thead><tbody>';
 Object.entries(piv).sort((a,b)=>b[1].amt-a[1].amt).forEach(([k,v])=>{
  h+=`<tr><td class="lbl">${k}</td><td>${fa(v.n)}</td><td class="n">${cell(v.amt)}</td><td class="n">${fa(v.tenor)}</td><td class="small">${v.src}</td><td>${confPill(v.conf)}</td></tr>`;});
 document.getElementById('cycPivot').innerHTML=h+'</tbody></table>';
 let d='<table><thead><tr><th class="lbl">شرکت</th><th>بانک</th><th>نوع</th><th>شماره تسهیلات</th><th>چرخه #</th><th>سررسید برآوردی</th><th>مبلغ (اصل)</th><th>تاریخ تجدید بعدی</th><th>اطمینان</th></tr></thead><tbody>';
 P.sort((a,b)=>a.due<b.due?-1:1).forEach(p=>{
  d+=`<tr><td class="lbl">${coFa(p.co)}</td><td>${p.bank}</td><td>${p.type}</td><td class="n small">${p.no}</td><td class="n">${fa(p.cycle)}</td><td class="n">${p.due}</td><td class="n"><span class="pill m">${cell(-p.amt)}</span></td><td class="n">${p.renew}</td><td>${confPill(p.tenor_conf)}</td></tr>`;});
 document.getElementById('cycDetail').innerHTML=d+'</tbody></table>';
}

// ================= ۸-۹: v1 tabs =================
// ================= ۷ج: خط زمانی تسهیلات (گانت SVG، جدید) =================
const G_ML = {1403:[31,31,31,31,31,31,30,30,30,30,30,29],1404:[31,31,31,31,31,31,30,30,30,30,30,29],
              1405:[31,31,31,31,31,31,30,30,30,30,30,29],1406:[31,31,31,31,31,31,30,30,30,30,30,29]};
function gDayNum(ds){
  if(!ds) return null;
  const m=ds.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/); if(!m) return null;
  const y=+m[1],mo=+m[2],d=+m[3]; let n=0;
  for(let yy=1400;yy<y;yy++) n+=(G_ML[yy]||G_ML[1405]).reduce((a,b)=>a+b,0);
  n+=(G_ML[y]||G_ML[1405]).slice(0,mo-1).reduce((a,b)=>a+b,0)+d;
  return n;
}
const G_MN=['','فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
let ganttFiltersInit=false;
function initGanttFilters(){
  if(ganttFiltersInit) return; ganttFiltersInit=true;
  const banks=[...new Set(DATA.timeline.map(t=>t.bank).filter(Boolean))].sort();
  const types=[...new Set(DATA.timeline.map(t=>t.type).filter(Boolean))].sort();
  const bSel=document.getElementById('ganttBank'), tSel=document.getElementById('ganttType');
  banks.forEach(b=>{const o=document.createElement('option');o.value=b;o.textContent=b;bSel.appendChild(o);});
  types.forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=t;tSel.appendChild(o);});
  bSel.addEventListener('change', renderGantt);
  tSel.addEventListener('change', renderGantt);
}
function renderGantt(){
  initGanttFilters();
  const q = (document.getElementById('ganttSearch').value||'').trim().toLowerCase();
  const bankF = document.getElementById('ganttBank').value;
  const typeF = document.getElementById('ganttType').value;
  const inner = document.getElementById('ganttInner');
  const wrapEl = document.getElementById('ganttWrap');
  let T = DATA.timeline.filter(t=>SEL.has(t.co) && t.end);
  if(bankF) T = T.filter(t=>t.bank===bankF);
  if(typeF) T = T.filter(t=>t.type===typeF);
  if(q) T = T.filter(t=>t.no.toLowerCase().includes(q));
  if(!T.length){ inner.innerHTML=`<div class="note">داده‌ای برای انتخاب/فیلتر فعلی نیست.</div>`; document.getElementById('ganttMsg').innerHTML=''; return; }

  // هر قسط/ترانش واقعی (یا سررسیدگذشته) یک ردیف مستقل است؛ چرخهٔ برآوردیِ همان قسط (اگر بود)
  // به‌عنوان ادامهٔ همان ردیف چیده می‌شود، نه ردیف جدا — طبق origin_due که در دیتا مشخص شده.
  const byKey = {};
  T.forEach(t=>{ const k=t.no+'|'+t.origin_due; (byKey[k]=byKey[k]||{no:t.no,co:t.co,bank:t.bank,type:t.type,segs:[]}).segs.push(t); });
  let rows = Object.values(byKey);
  const todayD = gDayNum(DATA.report_date);
  rows.forEach(r=>{
    r.segs.sort((a,b)=>(gDayNum(a.start)||gDayNum(a.end))-(gDayNum(b.start)||gDayNum(b.end)));
    const real = r.segs.find(s=>s.kind!=='projected') || r.segs[0];
    r.realEnd = gDayNum(real.end);   // مبنای مرتب‌سازی: سررسید قسط واقعی/سررسیدگذشته، نه چرخهٔ برآوردی
    r.start0 = gDayNum(r.segs[0].start) || gDayNum(r.segs[0].end);
    r.amt = real.amt;
    r.kind0 = real.kind;
  });

  const sortMode = document.getElementById('ganttSort').value;
  rows.sort((a,b)=>{
    if(sortMode==='amt') return b.amt-a.amt;
    if(sortMode==='start') return a.start0-b.start0;
    return a.realEnd-b.realEnd;  // پیش‌فرض: سررسیدگذشته (end=امروز) اول، بعد نزدیک‌ترین سررسید واقعی
  });

  const minD = Math.min(...rows.map(r=>r.start0));
  const maxD = Math.max(...rows.map(r=>Math.max(...r.segs.map(s=>gDayNum(s.end)))), todayD+30);
  const totDays = Math.max(1, maxD-minD);
  const pxPerDay = totDays>500?1.4:totDays>250?2.0:2.8;
  const rowH=32, labelW=280, headerH=34, chartW=Math.ceil(totDays*pxPerDay)+40;
  const svgH = headerH+rows.length*rowH+10;
  const xOf = d => (gDayNum(d)-minD)*pxPerDay;

  document.getElementById('ganttMsg').innerHTML=`${fa(rows.length)} قسط/ترانش تسهیلات در انتخاب فعلی — از ${MONTHFA(minD)} تا ${MONTHFA(maxD)}. نمای پیش‌فرض روی امروز تراز شده؛ برای دیدن تاریخچهٔ قدیمی‌تر به چپ اسکرول کن. <span style="color:#7d3c98;font-weight:700">میلهٔ بنفش = سررسید ظرف هفتهٔ آینده.</span> <span style="color:#1e8449;font-weight:700">نوار سبز کوچک = تجدید تک‌گامهٔ همان قسط (اصل، روز کاری بعد) — همیشه بعد از هر قسط واقعی می‌آید.</span> چرخهٔ بعدی برآوردی (هاشور) هم جلوی همان قسط می‌آید، ردیف جدا نمی‌شود.`;

  // ---- svg لیبل‌ها (ستون چسبان) ----
  let svgL = `<svg width="${labelW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg" font-family="Vazirmatn">`;
  svgL += `<rect x="0" y="0" width="${labelW}" height="${headerH}" fill="#eef2f7"></rect>`;
  rows.forEach((r,i)=>{
    const y = headerH+i*rowH;
    const gb = (r.amt/1000).toLocaleString('fa-IR',{maximumFractionDigits:1});
    svgL += `<rect class="gantt-rowbg${i%2?' alt':''}" x="0" y="${y}" width="${labelW}" height="${rowH}"></rect>`;
    svgL += `<text class="gantt-lbl" x="${labelW-8}" y="${y+13}" text-anchor="end" style="direction:ltr;font-variant-numeric:tabular-nums">${r.no}</text>`;
    svgL += `<text class="gantt-lbl mut" x="${labelW-8}" y="${y+26}" text-anchor="end">${r.bank} · ${r.type} · ${coFa(r.co)} · اصل: ${gb} میلیارد</text>`;
  });
  svgL += `<line x1="${labelW}" y1="0" x2="${labelW}" y2="${svgH}" stroke="var(--line)" stroke-width="2"></line>`;
  svgL += '</svg>';

  // ---- svg نمودار (اسکرول‌شونده) ----
  let svgC = `<svg width="${chartW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg" font-family="Vazirmatn">`;
  svgC += `<rect x="0" y="0" width="${chartW}" height="${headerH}" fill="#eef2f7"></rect>`;
  rows.forEach((r,i)=>{ svgC += `<rect class="gantt-rowbg${i%2?' alt':''}" x="0" y="${headerH+i*rowH}" width="${chartW}" height="${rowH}"></rect>`; });
  let markStep = totDays>500?60:totDays>250?30:15;
  for(let off=0; off<=totDays; off+=markStep){
    const x = off*pxPerDay;
    svgC += `<line class="gantt-grid" x1="${x}" y1="${headerH}" x2="${x}" y2="${svgH-6}"></line>`;
    svgC += `<text class="gantt-mlabel" x="${x+3}" y="${headerH-10}">${MONTHFA(minD+off)}</text>`;
  }
  if(todayD>=minD && todayD<=maxD){ const x=xOf(DATA.report_date);
    svgC += `<line class="gantt-today" x1="${x}" y1="0" x2="${x}" y2="${svgH-6}"></line>`;
    svgC += `<text class="gantt-mlabel" x="${x+4}" y="${headerH-22}" fill="#2c5f8a" font-weight="700">امروز</text>`; }
  rows.forEach((r,i)=>{
    const y = headerH+i*rowH;
    r.segs.forEach(s=>{
      const x1 = s.start? xOf(s.start) : xOf(s.end)-6;
      const x2 = xOf(s.end);
      const w = Math.max(3, x2-x1);
      const endD = gDayNum(s.end);
      const dueSoon = s.kind!=='past_due' && (endD-todayD)>=0 && (endD-todayD)<=7;
      const color = dueSoon ? '#7d3c98' : (s.kind==='past_due' ? '#c0392b' : s.kind==='projected' ? 'url(#hatch)' : '#2c5f8a');
      const title = `${r.no}\n${r.bank} | ${r.type} | ${coFa(r.co)}\n${s.start||'نامشخص'} → ${s.end}\nاصل: ${fa(s.amt)} م.ت\n${dueSoon?'⚠ سررسید ظرف هفتهٔ آینده\n':''}${s.kind==='past_due'?'سررسیدگذشته (باز)':s.kind==='projected'?'چرخه بعدی (برآوردی)':'واقعی/آتی'}`;
      svgC += `<rect class="gantt-bar${dueSoon?' due-soon':''}" x="${x1}" y="${y+5}" width="${w}" height="${rowH-10}" rx="3" fill="${color}"><title>${title}</title></rect>`;
      // نشانگر تجدید: از فردای پرداخت تا سررسید قسط واقعیِ بعدی (اگر بود — چون مبلغ عملاً تا
      // آن تاریخ در گردش می‌ماند)؛ برای آخرین قسط شناخته‌شده فقط یک نشانگر کوتاه است، چون طول
      // چرخهٔ بعدی را قطعی نمی‌دانیم (آن را هاشورِ چرخهٔ بعدیِ برآوردی نشان می‌دهد).
      if(s.renew_date){
        const rEnd = s.renew_end || s.renew_date;
        const rx1 = xOf(s.end), rx2 = xOf(rEnd), rw = Math.max(4, rx2-rx1);
        const extended = rEnd !== s.renew_date;
        const rtitle = `${r.no}\nتجدید (اصل): ${fa(s.renew_amt)} م.ت\nتاریخ تجدید: ${s.renew_date}${extended?`\nدر گردش تا قسط بعدی: ${rEnd}`:''}`;
        svgC += `<rect class="gantt-renew" x="${rx1}" y="${y+9}" width="${rw}" height="${rowH-18}" rx="2"><title>${rtitle}</title></rect>`;
      }
    });
  });
  svgC += `<defs><pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#f4dcb5"></rect><line x1="0" y1="0" x2="0" y2="6" stroke="#b9770e" stroke-width="3"></line></pattern></defs>`;
  svgC += '</svg>';

  inner.innerHTML = `<div style="position:sticky;left:0;z-index:2;background:#fff;flex:0 0 auto;box-shadow:2px 0 4px rgba(0,0,0,.04)">${svgL}</div>`+
                     `<div style="flex:0 0 auto">${svgC}</div>`;

  const scrollToToday = () => {
    const x = xOf(DATA.report_date);
    wrapEl.scrollLeft = Math.max(0, x - 80);
    wrapEl.scrollTop = 0;
  };
  scrollToToday();
  document.getElementById('ganttToday').onclick = scrollToToday;
}
document.getElementById('ganttSort').addEventListener('change', renderGantt);
let ganttSearchTimer=null;
document.getElementById('ganttSearch').addEventListener('input', ()=>{
  clearTimeout(ganttSearchTimer); ganttSearchTimer=setTimeout(renderGantt, 200);
});
function MONTHFA(dnum){
  // تبدیل تقریبیِ day-number به «ماه سال» با جستجوی خطی (برای برچسب کافی است)
  for(let y=1400;y<=1407;y++){
    const yl=(G_ML[y]||G_ML[1405]); let base=0;
    for(let yy=1400;yy<y;yy++) base+=(G_ML[yy]||G_ML[1405]).reduce((a,b)=>a+b,0);
    for(let m=1;m<=12;m++){ const s=base+yl.slice(0,m-1).reduce((a,b)=>a+b,0)+1, e=base+yl.slice(0,m).reduce((a,b)=>a+b,0);
      if(dnum>=s && dnum<=e) return G_MN[m]+' '+y; }
  }
  return '';
}

function renderLoans(){
 const L=DATA.loans.filter(l=>SEL.has(l.co));
 const past=L.filter(l=>l.status==='past'),pastSum=past.reduce((a,l)=>a+l.total,0);
 const due=L.filter(l=>l.status==='due');
 const paySum=L.reduce((a,l)=>a+l.total,0),renewSum=L.reduce((a,l)=>a+l.renew_amt,0);
 const dueDates=due.map(l=>l.due);
 const horizonTxt = dueDates.length? `از ${DATA.report_date} تا ${dueDates.reduce((a,b)=>b>a?b:a)} (آخرین سررسید ثبت‌شده در فایل روزانه)` : DATA.report_date;
 document.getElementById('loanMsg').innerHTML=
  `<b>افق این تب</b>: ${horizonTxt}. خروجی کل تسهیلات در این بازه: <span class="hl">(${fa(paySum)})</span> م.ت شامل ${fa(pastSum)} م.ت معوق در ${past.length} قسط — تجدید برنامه‌ریزی‌شده: ${fa(renewSum)} م.ت.`;

 // مانده فعلی تسهیلات (جمع اصل+بهرهٔ باقی‌ماندهٔ همهٔ اقساط ثبت‌شده — هر شماره ممکن است چند قسط/دورهٔ باقی‌مانده داشته باشد)
 const byCo={}, byBank={};
 L.forEach(l=>{byCo[l.co]=(byCo[l.co]||0)+l.total; byBank[l.bank]=(byBank[l.bank]||0)+l.total;});
 const coEntries=Object.entries(byCo).sort((a,b)=>b[1]-a[1]);
 const bankEntries=Object.entries(byBank).sort((a,b)=>b[1]-a[1]);
 if(chLoanCo)chLoanCo.destroy();
 chLoanCo=new Chart(document.getElementById('chLoanCo'),{type:'bar',
  data:{labels:coEntries.map(([co])=>coFa(co)),datasets:[{data:coEntries.map(([,v])=>v),backgroundColor:coEntries.map((_,i)=>PALETTE[i%PALETTE.length])}]},
  plugins:[barEndLabels],
  options:{maintainAspectRatio:false,indexAxis:'y',layout:{padding:{right:60}},plugins:{legend:{display:false},
   tooltip:{rtl:true,callbacks:{label:c=>fa(c.raw)+' م.ت'}}},
   scales:{x:{ticks:{callback:v=>fa(v)}}}}});
 if(chLoanBank)chLoanBank.destroy();
 chLoanBank=new Chart(document.getElementById('chLoanBank'),{type:'bar',
  data:{labels:bankEntries.map(([b])=>b),datasets:[{data:bankEntries.map(([,v])=>v),backgroundColor:bankEntries.map((_,i)=>PALETTE[i%PALETTE.length])}]},
  plugins:[barEndLabels],
  options:{maintainAspectRatio:false,indexAxis:'y',layout:{padding:{right:60}},plugins:{legend:{display:false},
   tooltip:{rtl:true,callbacks:{label:c=>fa(c.raw)+' م.ت'}}},
   scales:{x:{ticks:{callback:v=>fa(v)}}}}});

 const piv={};
 L.forEach(l=>{const k=`${l.type}|${l.bank}|${l.co}`;
  piv[k]=piv[k]||{type:l.type,bank:l.bank,co:l.co,n:0,pay:0,renew:0,past:0};
  piv[k].n++;piv[k].pay+=l.total;piv[k].renew+=l.renew_amt;if(l.status==='past')piv[k].past+=l.total;});
 let h='<table><thead><tr><th>نوع تسهیلات</th><th>بانک</th><th>شرکت</th><th>تعداد قسط</th><th>پرداختی (Total)</th><th>از آن: سررسیدگذشته</th><th>تجدید (اصل)</th></tr></thead><tbody>';
 Object.values(piv).sort((a,b)=>b.pay-a.pay).forEach(v=>{
  h+=`<tr><td>${v.type}</td><td>${v.bank}</td><td>${coFa(v.co)}</td><td>${fa(v.n)}</td><td class="n">${cell(-v.pay)}</td><td class="n">${v.past?cell(-v.past):'—'}</td><td class="n">${cell(v.renew)}</td></tr>`;});
 h+=`<tr class="tot"><td colspan="3">جمع کل</td><td>${fa(L.length)}</td><td class="n">${cell(-paySum)}</td><td class="n">${cell(-pastSum)}</td><td class="n">${cell(renewSum)}</td></tr>`;
 document.getElementById('loanPivot').innerHTML=h+'</tbody></table>';
 makeSortable(document.getElementById('loanPivot'));
 let d=`<div class="msg" style="font-size:13.5px;margin-bottom:8px">تسهیلات واقعی فعلی (سررسیدگذشته + آتی): <b>${fa(L.length)}</b> قسط، جمع پرداختی <b>${fa(paySum)}</b> م.ت — تجدید برنامه‌ریزی‌شده در همین افق: <b>${fa(renewSum)}</b> م.ت.</div>`;
 d+='<table><thead><tr><th class="lbl">شرکت</th><th>بانک</th><th>نوع</th><th>شماره تسهیلات</th><th>سررسید</th><th>تاریخ پرداخت</th><th>مبلغ پرداخت</th><th>اصل (تجدید)</th><th>بهره</th><th>تاریخ تجدید</th><th>وضعیت</th></tr></thead><tbody>';
 L.sort((a,b)=>a.pay<b.pay?-1:1).forEach(l=>{
  d+=`<tr><td class="lbl">${coFa(l.co)}</td><td>${l.bank}</td><td>${l.type}</td><td class="n small">${l.no}</td><td class="n">${l.due}</td><td class="n">${l.pay}</td><td class="n">${cell(-l.total)}</td><td class="n">${l.status==='past'?'—':cell(l.renew_amt)}</td><td class="n">${cell(-l.intr)}</td><td class="n">${l.renew||'—'}</td><td>${l.status==='past'?'<span class="pill b">سررسیدگذشته</span>':''}</td></tr>`;});
 d+=`<tr class="tot"><td class="lbl">جمع کل (${fa(L.length)} قسط)</td><td colspan="5"></td><td class="n">${cell(-paySum)}</td><td class="n">${cell(due.reduce((a,l)=>a+l.renew_amt,0))}</td><td colspan="3"></td></tr>`;
 document.getElementById('loanDetail').innerHTML=d+'</tbody></table>';
 makeSortable(document.getElementById('loanDetail'));
}
function renderBounced(){
 const R=DATA.bounced.filter(r=>SEL.has(r.co));
 const s1=R.filter(r=>r.src==='چک برگشتی').reduce((a,r)=>a+r.amt,0);
 const s2=R.filter(r=>r.src!=='چک برگشتی').reduce((a,r)=>a+r.amt,0);
 document.getElementById('bncMsg').innerHTML=
  `${fa(s1+s2)} میلیون تومان چک دریافتنیِ وصول‌نشده خارج از پیش‌بینی نگه داشته شده است: ${fa(s1)} م.ت چک برگشتی + ${fa(s2)} م.ت معوق اسناد دریافتنی.`;
 let h='<table><thead><tr><th class="lbl">شرکت</th><th>ذینفع</th><th>شماره چک</th><th>تاریخ چک</th><th>مبلغ</th><th>منبع داده</th></tr></thead><tbody>';
 R.sort((a,b)=>a.date<b.date?-1:1).forEach(r=>{
  h+=`<tr><td class="lbl">${coFa(r.co)}</td><td style="text-align:right">${r.ben}</td><td class="n">${r.chno}</td><td class="n">${r.date}</td><td class="n">${cell(r.amt)}</td><td><span class="pill ${r.src==='چک برگشتی'?'b':'m'}">${r.src}</span></td></tr>`;});
 document.getElementById('bncTbl').innerHTML=h+'</tbody></table>';
}
function renderManual(){
 const R=DATA.manual.filter(r=>SEL.has(r.co));
 let h='<table><thead><tr><th class="lbl">تاریخ</th><th>شرکت</th><th>جهت</th><th>دسته</th><th>شرح</th><th>مبلغ (م.ت)</th></tr></thead><tbody>';
 R.sort((a,b)=>a.date<b.date?-1:1).forEach(r=>{
  h+=`<tr><td class="lbl n">${r.date}</td><td>${coFa(r.co)}</td><td>${r.dir}</td><td>${r.cat}</td><td style="text-align:right">${r.desc}</td><td class="n">${cell(r.amt)}</td></tr>`;});
 document.getElementById('manTbl').innerHTML=h+'</tbody></table>';
}

// ================= ۹ب/۹ج: کپکس و خطوط اعتباری (اسکلت — منتظر داده) =================
function renderCapex(){
 const C=(DATA.capex||[]).filter(p=>SEL.has(p.co));
 const el=document.getElementById('capexBody');
 if(!C.length){
  el.innerHTML=`<div class="note"><h3>هنوز داده‌ای ثبت نشده</h3>
   ساختار این تب آماده است اما شیت «Capex Register» در فایل ورودی دستی هنوز خالی است. وقتی پروژه‌های کپکس/سرمایه‌گذاری آنجا ثبت شوند،
   «نیاز نقدی ۱۳هفته آینده» هر پروژه به‌طور خودکار در تاریخ شروع به‌عنوان خروجی نقد وارد پیش‌بینی می‌شود و جدول زیر پر خواهد شد.</div>
   <div class="tblwrap"><table><thead><tr><th class="lbl">پروژه</th><th>شرکت</th><th>دسته</th><th>بودجه کل</th><th>هزینه‌شده</th><th>باقی‌مانده</th><th>نیاز ۱۳هفته آینده</th><th>منبع تأمین</th><th>بازگشت (ماه)</th><th>IRR</th><th>مرحله</th><th>وضعیت</th></tr></thead><tbody>
   <tr><td colspan="12" class="small" style="padding:16px">— در انتظار تکمیل شیت Capex Register —</td></tr></tbody></table></div>`;
  return;}
 const totBudget=C.reduce((a,p)=>a+p.budget,0), totNeed=C.reduce((a,p)=>a+p.need13w,0);
 let h=`<div class="msg">${fa(C.length)} پروژه ثبت‌شده — بودجه کل ${fa(totBudget)} م.ت، نیاز نقدی ۱۳هفته آینده ${fa(totNeed)} م.ت</div>`;
 h+='<div class="tblwrap"><table><thead><tr><th class="lbl">پروژه</th><th>شرکت</th><th>دسته</th><th>بودجه کل</th><th>هزینه‌شده</th><th>باقی‌مانده</th><th>نیاز ۱۳هفته آینده</th><th>منبع تأمین</th><th>بازگشت (ماه)</th><th>IRR</th><th>مرحله</th><th>وضعیت</th></tr></thead><tbody>';
 C.forEach(p=>{h+=`<tr><td class="lbl">${p.project}</td><td>${coFa(p.co)}</td><td>${p.cat}</td><td class="n">${cell(p.budget)}</td><td class="n">${cell(p.spent)}</td><td class="n">${cell(p.remaining)}</td><td class="n">${cell(p.need13w)}</td><td>${p.funding}</td><td class="n">${p.payback??'—'}</td><td class="n">${p.irr!=null?p.irr+'٪':'—'}</td><td>${p.stage}</td><td><span class="pill ${p.status.includes('تأیید')?'g':p.status.includes('رد')?'b':'m'}">${p.status}</span></td></tr>`;});
 el.innerHTML=h+'</tbody></table></div>';
}
function renderCredit(){
 const C=(DATA.credit_lines||[]).filter(p=>SEL.has(p.co));
 const el=document.getElementById('creditBody');
 if(!C.length){
  el.innerHTML=`<div class="note"><h3>هنوز داده‌ای ثبت نشده</h3>
   ساختار این تب آماده است اما شیت «Credit Lines» در فایل ورودی دستی هنوز خالی است. این سقفِ کلی مصوب هر بانک است — جدا از تسهیلات مصرف‌شدهٔ
   شیت Loan — و وقتی تکمیل شود، کارت «استفاده از خطوط اعتباری» در داشبورد مدیریتی هم فعال می‌شود.</div>
   <div class="tblwrap"><table><thead><tr><th class="lbl">شرکت</th><th>بانک</th><th>نوع</th><th>سقف مصوب</th><th>برداشت‌شده</th><th>در دسترس</th><th>سررسید/تمدید</th><th>نرخ سود</th><th>وضعیت تعهد</th></tr></thead><tbody>
   <tr><td colspan="9" class="small" style="padding:16px">— در انتظار تکمیل شیت Credit Lines —</td></tr></tbody></table></div>`;
  return;}
 const totLimit=C.reduce((a,p)=>a+p.limit,0), totDrawn=C.reduce((a,p)=>a+p.drawn,0), totAvail=C.reduce((a,p)=>a+p.available,0);
 let h=`<div class="msg">سقف کل ${fa(totLimit)} م.ت — برداشت‌شده ${fa(totDrawn)} م.ت — در دسترس ${fa(totAvail)} م.ت</div>`;
 h+='<div class="tblwrap"><table><thead><tr><th class="lbl">شرکت</th><th>بانک</th><th>نوع</th><th>سقف مصوب</th><th>برداشت‌شده</th><th>در دسترس</th><th>سررسید/تمدید</th><th>نرخ سود</th><th>وضعیت تعهد</th></tr></thead><tbody>';
 C.forEach(p=>{h+=`<tr><td class="lbl">${coFa(p.co)}</td><td>${p.bank}</td><td>${p.type}</td><td class="n">${cell(p.limit)}</td><td class="n">${cell(p.drawn)}</td><td class="n">${cell(p.available)}</td><td class="n">${p.maturity||'—'}</td><td class="n">${p.rate!=null?p.rate+'٪':'—'}</td><td><span class="pill ${p.covenant.includes('رعایت')?'g':p.covenant.includes('نقض')?'b':'m'}">${p.covenant||'نامشخص'}</span></td></tr>`;});
 el.innerHTML=h+'</tbody></table></div>';
}
(function(){
 const V=DATA.vaset,s=V.reduce((a,r)=>a+r.amt,0);
 document.getElementById('vasetSum').innerHTML=`<b>${fa(s)} میلیون تومان</b> در ${fa(V.length)} فقره چکِ با برچسب «واسط تسهیلات» شناسایی شد.`;
 let h='<table><thead><tr><th class="lbl">شرکت</th><th>ذینفع</th><th>شماره چک</th><th>تاریخ</th><th>مبلغ (م.ت)</th></tr></thead><tbody>';
 V.forEach(r=>{h+=`<tr><td class="lbl">${coFa(r.co)}</td><td style="text-align:right">${r.ben}</td><td class="n">${r.chno}</td><td class="n">${r.date}</td><td class="n">${cell(r.amt)}</td></tr>`;});
 document.getElementById('vasetTbl').innerHTML=h+'</tbody></table>';
})();

// ================= ۱۰: تغییرات نسبت به گزارش قبل (جدید) =================
function renderDiff(){
 const el=document.getElementById('diffBody'); const df=DATA.diff;
 if(!df){el.innerHTML='<div class="note">این نخستین اسنپ‌شات ثبت‌شده در پایپ‌لاین است؛ از فردا این تب پل تغییرات را نسبت به گزارش دیروز نشان می‌دهد.</div>';return;}
 let h=`<div class="msg">تغییرات نسبت به گزارش ${df.prev_date}</div>`;
 h+='<div class="diffcard">';
 const row=(l,v,good)=>`<div class="row"><span class="lbl2">${l}</span><span class="delta ${v<0?(good?'pos':'neg'):(good?'neg':'pos')}" style="color:${v===0?'var(--mut)':''}">${v>0?'+':''}${fa(v)}</span></div>`;
 h+=row('نقد در دسترس گروه',df.open_delta,true);
 h+=row('تعهدات پرداختنی سررسیدگذشته',df.np_past_delta,false);
 h+=row('تسهیلات سررسیدگذشته',df.loan_past_delta,false);
 h+=row('چک برگشتی/معوق دریافتنی',df.bounced_delta,false);
 h+=row('اسناد دریافتنی آتی (کل افق)',df.nr_delta,true);
 h+='</div>';
 h+='<h2 class="sec">نقد به تفکیک شرکت</h2><div class="tblwrap"><table><thead><tr><th class="lbl">شرکت</th><th>تغییر نسبت به دیروز</th></tr></thead><tbody>';
 COS.forEach(c=>{const d=df.open_co_delta[c.key]||0; h+=`<tr><td class="lbl">${c.fa}</td><td class="n ${d<0?'neg':(d>0?'pos':'')}">${d>0?'+':''}${fa(d)}</td></tr>`;});
 h+='</tbody></table></div>';
 if(df.newly_past_loans.length){
  h+='<h2 class="sec">اقساط تازه معوق‌شده</h2><div class="tblwrap"><table><thead><tr><th class="lbl">شرکت</th><th>بانک</th><th>نوع</th><th>سررسید</th><th>مبلغ</th></tr></thead><tbody>';
  df.newly_past_loans.forEach(l=>{h+=`<tr><td class="lbl">${coFa(l.co)}</td><td>${l.bank}</td><td>${l.type}</td><td class="n">${l.due}</td><td class="n">${cell(-l.total)}</td></tr>`;});
  h+='</tbody></table></div>';}
 if(df.cleared_past_loans.length){
  h+='<h2 class="sec">اقساط معوق تسویه/تجدیدشده</h2><div class="tblwrap"><table><thead><tr><th class="lbl">شرکت</th><th>بانک</th><th>نوع</th><th>سررسید</th><th>مبلغ</th></tr></thead><tbody>';
  df.cleared_past_loans.forEach(l=>{h+=`<tr><td class="lbl">${coFa(l.co)}</td><td>${l.bank}</td><td>${l.type}</td><td class="n">${l.due}</td><td class="n"><span class="pill g">${cell(-l.total)}</span></td></tr>`;});
  h+='</tbody></table></div>';}
 if(df.new_bounced.length){
  h+='<h2 class="sec">چک‌های تازه برگشتی/معوق</h2><div class="tblwrap"><table><thead><tr><th class="lbl">شرکت</th><th>ذینفع</th><th>شماره چک</th><th>مبلغ</th></tr></thead><tbody>';
  df.new_bounced.forEach(b=>{h+=`<tr><td class="lbl">${coFa(b.co)}</td><td style="text-align:right">${b.ben}</td><td class="n">${b.chno}</td><td class="n">${cell(b.amt)}</td></tr>`;});
  h+='</tbody></table></div>';}
 if(df.cleared_bounced.length){
  h+='<h2 class="sec">چک‌های وصول/تعیین‌تکلیف‌شده</h2><div class="tblwrap"><table><thead><tr><th class="lbl">شرکت</th><th>ذینفع</th><th>شماره چک</th><th>مبلغ</th></tr></thead><tbody>';
  df.cleared_bounced.forEach(b=>{h+=`<tr><td class="lbl">${coFa(b.co)}</td><td style="text-align:right">${b.ben}</td><td class="n">${b.chno}</td><td class="n"><span class="pill g">${cell(b.amt)}</span></td></tr>`;});
  h+='</tbody></table></div>';}
 el.innerHTML=h;
}

// ================= ۱۱: مفروضات (جدید) =================
(function(){
 let h='';
 DATA.assumptions.forEach(a=>{
  const conf=a.conf==null?'<span class="small">نامعتبر برای این حوزه</span>':
   `<span class="conf-bar"><i style="width:${a.conf}%;background:${a.conf>=90?'var(--pos)':a.conf>=70?'var(--amber)':'var(--neg)'}"></i></span>${fa(a.conf)}٪`;
  h+=`<tr><td class="n small">${a.id}</td><td>${a.area}</td><td>${a.rule}</td><td>${a.param}</td><td class="n">${conf}</td></tr>`;});
 document.getElementById('assumpBody').innerHTML=h;
})();

// ================= نقطه سر به سر ماهانه =================
function renderBEP(){
 const txs = DATA.tx.filter(t=>SEL.has(t.co) && t.d >= DATA.report_date);
 // ماه‌های افق
 const months = [];
 {let y=+DATA.report_date.slice(0,4), m=+DATA.report_date.slice(5,7);
  while(true){const ym=`${y}/${String(m).padStart(2,'0')}`;months.push(ym);
   if(ym>='1406/03')break; m++; if(m>12){m=1;y++;}}}

 // تجمیع خودکار بر اساس ماه و دسته
 const byM={};months.forEach(ym=>byM[ym]={nr:0,renew:0,loan:0,loan_past:0,np:0,np_past:0,salary:0,tax_ins:0,loan_fee:0,ap_petty:0,other_out:0,dep_release:0,intergroup:0,other_in:0,capex:0});
 txs.forEach(t=>{const ym=t.d.slice(0,7); if(!byM[ym])return;
   if(t.cat==='nr') byM[ym].nr+=t.amt;
   else if(t.cat==='renew') byM[ym].renew+=t.amt;
   else if(t.cat==='loan'||t.cat==='loan_past') byM[ym].loan+=t.amt;
   else if(t.cat==='np'||t.cat==='np_past') byM[ym].np+=t.amt;
   else if(t.cat==='salary') byM[ym].salary+=t.amt;
   else if(t.cat==='tax_ins') byM[ym].tax_ins+=t.amt;
   else if(t.cat==='loan_fee') byM[ym].loan_fee+=t.amt;
   else if(t.cat==='ap_petty') byM[ym].ap_petty+=t.amt;
   else if(t.cat==='dep_release') byM[ym].dep_release+=t.amt;
   else if(t.cat==='intergroup') byM[ym].intergroup+=t.amt;
   else if(t.desc&&t.desc.includes('کپکس')) byM[ym].capex+=t.amt;
   else if(t.amt>=0) byM[ym].other_in+=t.amt;
   else byM[ym].other_out+=t.amt;
 });

 const MN = ['','فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
 const mLabel = ym=>{const[y,m]=ym.split('/');return MN[+m]+' '+y;};

 // داده‌های قابل‌ویرایش (فروش، سایر ورودی، سایر خروجی) — ذخیره در حافظه
 if(!window._bepEdit) window._bepEdit={};
 const ed = window._bepEdit;
 const salesDefault = (ym)=>{let s=0;for(const co of SEL)s+=((DATA.sales_budget||{})[ym]||{})[co]||0;return s;};
 const getEd = (key,ym)=>{
   const k=key+'|'+ym;
   if(k in ed) return ed[k];
   if(key==='sales') return salesDefault(ym);
   if(key==='cogs') return Math.round(getEd('sales',ym)*0.55);
   return 0;
 };
 const setEd = (key,ym,v)=>{ed[key+'|'+ym]=v; renderBEP();};

 let open0=0; for(const co of SEL) open0+=DATA.opening[co]||0;
 const inp = (key,ym)=>{const v=getEd(key,ym);
  return `<input type="text" inputmode="decimal" class="bep-input" value="${v?fa(v):''}" placeholder="—"
   onchange="window._bepEdit['${key}|${ym}']=Math.round(parseFaNum(this.value))||0; setTimeout(renderBEP,0);">`;};

 const rows = [
  {id:'open',label:'موجودی ابتدای دوره',type:'auto',cls:'bal'},
  {id:'_sep1',label:'ورودی‌ها',type:'section'},
  {id:'sales',label:'فروش (دستی)',type:'edit',cls:'nr'},
  {id:'nr',label:'اسناد دریافتنی',type:'data'},
  {id:'renew',label:'تجدید تسهیلات',type:'data'},
  {id:'dep_release',label:'آزادسازی سپرده / دریافتی گروه',type:'data'},
  {id:'other_in_edit',label:'سایر ورودی (دستی)',type:'edit'},
  {id:'tot_in',label:'جمع ورودی‌ها',type:'sum_in',cls:'tot'},
  {id:'_sep2',label:'خروجی‌ها',type:'section'},
  {id:'cogs',label:'خرید کالا (۵۵٪ فروش)',type:'edit'},
  {id:'loan_net',label:'پرداخت تسهیلات (Total)',type:'data'},
  {id:'np',label:'اسناد پرداختنی',type:'data'},
  {id:'salary',label:'حقوق',type:'data'},
  {id:'tax_ins',label:'بیمه و مالیات',type:'data'},
  {id:'capex_r',label:'کپکس (باقی‌مانده)',type:'data'},
  {id:'ap_other',label:'حساب پرداختنی/تنخواه/کارمزد/سایر',type:'data'},
  {id:'other_out_edit',label:'سایر خروجی (دستی)',type:'edit'},
  {id:'tot_out',label:'جمع خروجی‌ها',type:'sum_out',cls:'tot'},
  {id:'net',label:'خالص جریان دوره',type:'net',cls:'tot'},
  {id:'close',label:'موجودی پایان دوره',type:'auto',cls:'bal'},
 ];

 let h='<table class="bep-tbl" style="font-size:12.5px"><thead><tr><th class="lbl" style="min-width:220px;position:sticky;right:0;z-index:4;background:#eef2f7">شرح</th>';
 months.forEach(ym=>{h+=`<th style="min-width:110px;text-align:center">${mLabel(ym)}</th>`;});
 h+='</tr></thead><tbody>';

 // محاسبه مقادیر هر ردیف × هر ماه
 const vals={};
 rows.forEach(r=>vals[r.id]=months.map(()=>0));

 // کپکس: مستقیم از DATA.capex (نه از tx) — ستون «باقی‌مانده» مبنا، فیلتر بر شرکت انتخابی
 const capexByM={};
 months.forEach(ym=>capexByM[ym]=0);
 (DATA.capex||[]).filter(c=>SEL.has(c.co)).forEach(c=>{
   const ym=c.start.slice(0,7);
   if(capexByM[ym]!==undefined) capexByM[ym]-=c.remaining;  // c.remaining از build_forecast.py از قبل به م.ت تبدیل شده — تقسیم مجدد نکن
 });

 months.forEach((ym,mi)=>{
   const d=byM[ym]||{};
   vals['nr'][mi]=d.nr||0;
   vals['renew'][mi]=d.renew||0;
   vals['dep_release'][mi]=(d.dep_release||0)+(d.intergroup||0)+(d.other_in||0);
   vals['loan_net'][mi]=d.loan||0;
   vals['np'][mi]=d.np||0;
   vals['salary'][mi]=d.salary||0;
   vals['tax_ins'][mi]=d.tax_ins||0;
   vals['capex_r'][mi]=capexByM[ym]||0;   // از DATA.capex، ستون باقی‌مانده
   vals['ap_other'][mi]=(d.ap_petty||0)+(d.loan_fee||0)+(d.other_out||0);
   vals['sales'][mi]=getEd('sales',ym);
   vals['cogs'][mi]=-Math.abs(getEd('cogs',ym));
   vals['other_in_edit'][mi]=getEd('other_in_edit',ym);
   vals['other_out_edit'][mi]=-Math.abs(getEd('other_out_edit',ym));
   vals['tot_in'][mi]=vals['sales'][mi]+vals['nr'][mi]+vals['renew'][mi]+vals['dep_release'][mi]+vals['other_in_edit'][mi];
   vals['tot_out'][mi]=vals['loan_net'][mi]+vals['np'][mi]+vals['salary'][mi]+vals['tax_ins'][mi]+vals['capex_r'][mi]+vals['ap_other'][mi]+vals['cogs'][mi]+vals['other_out_edit'][mi];
   vals['net'][mi]=vals['tot_in'][mi]+vals['tot_out'][mi];
 });
 // موجودی زنجیره‌ای
 months.forEach((ym,mi)=>{
   vals['open'][mi]= mi===0 ? open0 : vals['close'][mi-1];
   vals['close'][mi]= vals['open'][mi]+vals['net'][mi];
 });

 rows.forEach(r=>{
   if(r.type==='section'){h+=`<tr class="sect"><td class="lbl" style="position:sticky;right:0;background:#f2f5f9;z-index:3">${r.label}</td>${months.map(()=>'<td></td>').join('')}</tr>`;return;}
   const cls=r.cls||'';
   const lblBg = r.type==='edit' ? '#fbf3d9' : (cls==='bal'?'#eef4fa':cls==='tot'?'#fbfcfe':'#fff');
   const lblColor = r.type==='edit' ? 'color:#8a6d1a;' : '';
   h+=`<tr class="${cls}"><td class="lbl" style="position:sticky;right:0;background:${lblBg};${lblColor}z-index:3;font-weight:${cls?'700':'400'}">${r.label}</td>`;
   months.forEach((ym,mi)=>{
     const v=vals[r.id][mi];
     if(r.type==='edit'){
       h+=`<td style="padding:2px">${inp(r.id,ym)}</td>`;
     } else {
       const color = (r.id==='close'&&v<0)?'var(--neg)': (r.id==='close'&&v>0)?'var(--pos)':'';
       h+=`<td class="n" style="font-weight:${cls?'700':'400'};${color?'color:'+color:''}">${Math.abs(v)<0.5?'<span class="small">—</span>':cell(v)}</td>`;
     }
   });
   h+='</tr>';
 });

 // ردیف تحلیلی: ماه نقطه سر به سر
 h+=`<tr class="bal"><td class="lbl" style="position:sticky;right:0;background:#eef4fa;z-index:3;font-weight:700">وضعیت نقدینگی</td>`;
 months.forEach((ym,mi)=>{
   const v=vals['close'][mi];
   const pill = v<0?'<span class="pill b">کسری</span>': v===0?'<span class="pill m">سر به سر</span>':'<span class="pill g">مازاد</span>';
   h+=`<td style="text-align:center">${pill}</td>`;
 });
 h+='</tr></tbody></table>';

 document.getElementById('bepWrap').innerHTML=h;
}

function exportBEPExcel(){
 const table=document.querySelector('#bepWrap table');
 if(!table) return;
 const clone=table.cloneNode(true);
 clone.querySelectorAll('input').forEach(inp=>{
  const span=document.createElement('span'); span.textContent=inp.value||'';
  inp.replaceWith(span);
 });
 clone.querySelectorAll('[style*="sticky"]').forEach(el=>{el.style.position='static';});
 const html=`<html><head><meta charset="UTF-8"></head><body dir="rtl" style="font-family:Tahoma">${clone.outerHTML}</body></html>`;
 const blob=new Blob(['\ufeff'+html],{type:'application/vnd.ms-excel'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');
 a.href=url; a.download=`نقطه_سر_به_سر_ماهانه_${DATA.report_date.replace(/\//g,'-')}.xls`;
 document.body.appendChild(a); a.click(); document.body.removeChild(a);
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function renderAll(){
 const C=compute();
 renderExec(C);renderChart(C);renderMatrix(C);renderW13();renderStress();renderRisk();renderDrivers(C);
 renderCal();renderLoans();renderCycles();renderGantt();renderBounced();renderManual();renderCapex();renderCredit();renderDrill();renderDiff();renderBEP();
}
renderAll();
