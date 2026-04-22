const LD={'Jinx':['fury','chaos'],'Viktor':['order','mind'],'Ahri':['calm','mind'],'Darius':['fury','body'],'Lee Sin':['calm','body'],'Volibear':['fury','order'],'Miss Fortune':['chaos','body'],"Kai'Sa":['chaos','mind']};
function populateLegendDropdowns(){
  const legends=CARDS.filter(c=>c.type==='Legend'&&!c.name.includes('(')).map(c=>c.name).filter((n,i,a)=>a.indexOf(n)===i).sort();
  legends.forEach(name=>{if(!LD[name]){const card=CARDS.find(c=>c.type==='Legend'&&c.name===name);if(card&&card.doms.length)LD[name]=card.doms;}});
  const mleg=document.getElementById('mleg');
  if(mleg){const v=mleg.value;mleg.innerHTML=legends.map(n=>`<option${n===v?' selected':''}>${n}</option>`).join('');}
  const dsl=document.getElementById('dsl');
  if(dsl){const v=dsl.value;dsl.innerHTML='<option value="">All legends</option>'+legends.map(n=>`<option${n===v?' selected':''}>${n}</option>`).join('');}
}
let CARDS=[], cardsLoaded=false;
let myDecks=[], nextId=1;
let VIEW='cards';
let activeDeckId=null;
let activeDDTab='cards';
let currentUser=null;
let authToken=null;
const AF={doms:new Set()};
const CF={type:'',set:'',rar:'',legend:'',doms:new Set(),energy:[0,12],power:[0,4],might:[0,10],showAllVersions:false};
const EF={type:'',dom:'',page:1,showAllVersions:false};
function getEditPer(){return 18;}
const EDIT_PER=24;

/* storage */
function loadStorage(){
  try{
    const m=localStorage.getItem('rl_decks');if(m)myDecks=JSON.parse(m);
    const n=localStorage.getItem('rl_nid');if(n)nextId=parseInt(n);
    if(!myDecks.length)myDecks=[];
  }catch(e){myDecks=[];}
}
function persist(){try{localStorage.setItem('rl_decks',JSON.stringify(myDecks));localStorage.setItem('rl_nid',String(nextId));}catch(e){}}
function wr(d){return d.wins+d.losses>0?Math.round(d.wins/(d.wins+d.losses)*100):0;}
function wrc(w){return w>=55?'wg':w>=45?'wm':'wb';}
function pills(doms){return(doms||[]).map(d=>`<span class="pill ${d.toLowerCase()}">${d[0].toUpperCase()+d.slice(1).toLowerCase()}</span>`).join('');}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400);}
let _bannerTimer=null;
function showAddBanner(msg){const b=document.getElementById('add-banner');if(!b)return;b.textContent=msg;b.style.opacity='1';b.style.transform='translateY(0)';clearTimeout(_bannerTimer);_bannerTimer=setTimeout(()=>{b.style.opacity='0';b.style.transform='translateY(-100%)';},1000);}

/* ── RIFTCODEX FETCH ────────────────────────────── */
async function fetchAllCards(){
  document.getElementById('cg').innerHTML=`<div class="spinner" style="grid-column:1/-1;"><div class="spin"></div>Loading cards from Riftcodex API…</div>`;
  try{
    const r1=await fetch('https://api.riftcodex.com/cards?size=100&page=1&sort=collector_number');
    if(!r1.ok)throw new Error('HTTP '+r1.status);
    const d1=await r1.json();
    let items=[...(d1.items||[])];
    const total=d1.total||items.length;
    const pages=Math.ceil(total/100);
    if(pages>1){
      const more=await Promise.all(
        Array.from({length:pages-1},(_,i)=>
          fetch(`https://api.riftcodex.com/cards?size=100&page=${i+2}&sort=collector_number`).then(r=>r.json())
        )
      );
      more.forEach(d=>{if(d.items)items.push(...d.items);});
    }
    CARDS=items.map(mapCard).filter(Boolean);
    cardsLoaded=true;
    populateLegendDropdowns();
    renderCards();
    if(activeDeckId&&activeDDTab==='edit'){renderEditSearch();renderEditPreview();}
    if(activeDeckId&&activeDDTab==='sideboard'){
      const panel=document.getElementById('ddp-sideboard');
      if(panel){const d=myDecks.find(x=>x.id===activeDeckId);if(d)panel.innerHTML=buildSideboardPanel(d);}
    }
  }catch(e){
    document.getElementById('cg').innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);">
      <div style="font-size:32px;margin-bottom:12px;">⚠️</div>
      <div style="font-size:15px;color:var(--text-soft);margin-bottom:8px;">Could not reach Riftcodex API</div>
      <div style="font-size:13px;">${e.message}</div>
      <button class="btn btn-sm btn-g" style="margin-top:12px;" onclick="fetchAllCards()">Retry</button>
    </div>`;
  }
}

function mapCard(c){
  if(!c||!c.name)return null;
  const cls=c.classification||{};
  const attr=c.attributes||{};
  const txt=c.text||{};
  const med=c.media||{};
  const set=c.set||{};
  const meta=c.metadata||{};
  const doms=(cls.domain||[]).map(d=>d.toLowerCase());
  const dom=doms[0]||'order';
  return{
    id:c.id||c.riftbound_id||c.name,
    name:c.name,
    type:cls.type||'Unit',
    supertype:cls.supertype||'',
    dom,doms,
    cost:attr.energy??null,
    might:attr.might??null,
    power:attr.power??null,
    rarity:cls.rarity||'',
    set:set.set_id||'',
    setLabel:set.label||'',
    txt:txt.plain||'',
    flavour:txt.flavour||'',
    artist:med.artist||'Unknown',
    imageUrl:med.image_url||'',
    tags:c.tags||[],
    riftboundId:c.riftbound_id||''
  };
}

/* ── VIEW TOGGLE ────────────────────────────────── */
function setView(v){
  VIEW=v;
  document.getElementById('vt-c').classList.toggle('on',v==='cards');
  document.getElementById('vt-a').classList.toggle('on',v==='artists');
  document.getElementById('cards-btm').style.display=v==='cards'?'':' none';
  document.getElementById('art-btm').style.display=v==='artists'?'flex':'none';
  document.getElementById('cg').style.display=v==='cards'?'':'none';
  document.getElementById('artist-grid').style.display=v==='artists'?'':'none';
  ['dw-set','dw-type','dw-rar'].forEach(id=>document.getElementById(id).style.display=v==='cards'?'':'none');
  document.getElementById('art-sort').style.display=v==='artists'?'':'none';
  document.getElementById('cs').placeholder=v==='cards'?'Search cards by name or text…':'Search artist name or card name…';
  document.getElementById('reset-btn').textContent=v==='cards'?'Reset filters':'Reset';
  v==='cards'?renderCards():renderArtists();
}
function onQ(){VIEW==='cards'?renderCards():renderArtists();}

/* ── NAV ────────────────────────────────────────── */
function goto(p,el){
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nl').forEach(x=>x.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  if(el)el.classList.add('active');
  if(p==='decks')renderDecks();
  if(p==='search'&&cardsLoaded)renderCards();
  if(p==='statistics')renderStatistics();
  if(p==='events')renderEvents();
  if(p==='play'&&typeof populateDeckSelectors==='function')populateDeckSelectors();
}

/* ── DECKS ──────────────────────────────────────── */
function renderDecks(){
  const q=document.getElementById('ds').value.toLowerCase();
  const fl=document.getElementById('dsl').value;
  const fd=document.getElementById('dsd').value.toLowerCase();
  const list=myDecks.filter(d=>{
    if(q&&!d.name.toLowerCase().includes(q)&&!d.legend.toLowerCase().includes(q))return false;
    if(fl&&d.legend!==fl)return false;
    if(fd&&!(d.domains||[]).includes(fd))return false;
    return true;
  });
  const g=document.getElementById('dg');
  if(!list.length){g.innerHTML=`<div class="es"><h3>No decks yet</h3><p>Create your first deck above.</p></div>`;return;}
  g.innerHTML=list.map(d=>{
    const totalC=(d.cards||[]).reduce((a,c)=>a+c.cnt,0)||0;
    const w=wr(d);
    return `<div class="dc">
      <div class="dt">
        <div>
          <div class="dn">${d.name}</div>
          <div class="dl">${d.legend}</div>
        </div>
        <span class="ftag">${d.format}</span>
      </div>
      <div class="dr">${pills(d.domains)}</div>
      <div class="df">
        <span><strong>${totalC}</strong> cards</span>
        <span><strong>${d.wins||0}</strong>W <strong>${d.losses||0}</strong>L</span>
        <span class="${wrc(w)}"><strong>${w}%</strong> WR</span>
      </div>
      <div class="da">
        <button class="btn btn-sm btn-g" onclick="openDD(${d.id})">View</button>
        <button class="btn btn-sm btn-d" onclick="delDeck(${d.id})">Delete</button>
      </div>
    </div>`;
  }).join('');
}
function populateDeckSelectors(){
  ['host-deck-sel','join-deck-sel'].forEach(id=>{
    const sel=document.getElementById(id);
    if(!sel)return;
    sel.innerHTML='<option value="">— choose a deck —</option>';
    myDecks.forEach(d=>{
      const o=document.createElement('option');
      o.value=d.id;
      o.textContent=d.name+' ('+d.legend+')';
      sel.appendChild(o);
    });
  });
}

function openDD(id){
  const d=myDecks.find(x=>x.id===id);if(!d)return;
  activeDeckId=id;
  if(!d.sideboard) d.sideboard=[];
  if(!d.results)   d.results=[];
  document.getElementById('dl').style.display='none';
  document.getElementById('dd').style.display='block';
  renderDeckDetail();
}

function buildDeckCurves(d){
  if(!cardsLoaded||!CARDS.length) return '<div class="deck-curves-empty">Loading stats…</div>';
  const cards=(d.cards||[]).filter(c=>c.t!=='Legend');
  const total=cards.reduce((a,c)=>a+c.cnt,0);
  const ecurve=new Array(9).fill(0);let eSum=0,eCnt=0;
  const pcurve=new Array(5).fill(0);let pSum=0,pCnt=0;
  cards.forEach(c=>{
    const full=CARDS.find(x=>x.id===c.id);if(!full)return;
    if(full.cost!=null){const b=Math.min(full.cost,8);ecurve[b]+=c.cnt;eSum+=full.cost*c.cnt;eCnt+=c.cnt;}
    if(full.power!=null){const b=Math.min(full.power,4);pcurve[b]+=c.cnt;pSum+=full.power*c.cnt;pCnt+=c.cnt;}
  });
  const avgE=eCnt>0?(eSum/eCnt).toFixed(1):'—';
  const avgP=pCnt>0?(pSum/pCnt).toFixed(1):'—';
  const dom=(d.domains||[])[0]||'order';
  const domCol=`var(--${dom==='body'?'bodyc':dom})`;
  function bars(data,labels,color){
    const maxV=Math.max(1,...data);const H=44;
    return data.map((v,i)=>{
      const h=v>0?Math.max(3,Math.round(v/maxV*H)):2;
      const op=v>0?1:0.18;
      const tip=v>0?`${v} card${v===1?'':'s'}`:'0 cards';
      return`<div class="mc-col"><div class="mc-bar" style="height:${h}px;background:${color};opacity:${op};" title="${tip}"></div><div class="mc-lbl">${labels[i]}</div></div>`;
    }).join('');
  }
  const eLabels=['0','1','2','3','4','5','6','7','8+'];
  const pLabels=['0','1','2','3','4'];
  return`<div class="deck-curves">
    <div class="curve-pairs-row">
      <div class="curve-pair">
        <div class="curve-stat"><div class="curve-sv">${avgE}</div><div class="curve-sl">Avg Energy</div></div>
        <div class="curve-chart-block">
          <div class="curve-chart-lbl">Energy Curve</div>
          <div class="mc-wrap">${bars(ecurve,eLabels,'var(--order)')}</div>
        </div>
      </div>
      <div class="curve-pair">
        <div class="curve-stat"><div class="curve-sv">${avgP}</div><div class="curve-sl">Avg Power</div></div>
        <div class="curve-chart-block">
          <div class="curve-chart-lbl">Power Curve</div>
          <div class="mc-wrap">${bars(pcurve,pLabels,domCol)}</div>
        </div>
      </div>
    </div>
  </div>`;
}

function renderDeckDetail(){
  const d=myDecks.find(x=>x.id===activeDeckId);if(!d)return;
  const w=wr(d);
  const totalCards=(d.cards||[]).reduce((a,c)=>a+c.cnt,0);

  document.getElementById('ddc').innerHTML=`
    <div class="deck-header">
      <div class="deck-header-left">
        <div class="dtitle" id="deck-title-display" onclick="startEditDeckTitle(${d.id})" title="Click to edit">${d.name}<span class="dtitle-edit-icon">✎</span></div>
        <div class="dmeta">
          <span>${d.legend}</span><span>·</span>
          <div class="dr" style="margin:0;">${pills(d.domains)}</div>
          <span>·</span><span>${d.format}</span>
        </div>
      </div>
      <div class="deck-header-center">
        <div id="deck-curves-panel">${buildDeckCurves(d)}</div>
      </div>
      <div class="deck-header-right">
        <span class="dt-label">Deck</span><span class="dt-count" id="deck-count-badge">— / 40 cards</span>
      </div>
    </div>
    <div class="hero-zone-bar" id="hero-zone-bar" style="display:none;"></div>

    <!-- TABS -->
    <div class="dd-tabs">
      <button class="dd-tab${activeDDTab==='cards'?' active':''}" onclick="switchDDTab('cards')">
        <svg viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="9" height="12" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 5h3M5 8h3M5 11h1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><rect x="6" y="1" width="9" height="12" rx="1.5" stroke="currentColor" stroke-width="1.4"/></svg>
        Cards
      </button>
      <button class="dd-tab${activeDDTab==='edit'?' active':''}" onclick="switchDDTab('edit')">
        <svg viewBox="0 0 16 16" fill="none"><path d="M11 2.5l2.5 2.5-7 7H4V9.5l7-7z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9.5 4l2.5 2.5" stroke="currentColor" stroke-width="1.2"/></svg>
        Edit
      </button>
      <button class="dd-tab${activeDDTab==='stats'?' active':''}" onclick="switchDDTab('stats')">
        <svg viewBox="0 0 16 16" fill="none"><rect x="1" y="9" width="3" height="6" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="6" y="5" width="3" height="10" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="11" y="2" width="3" height="13" rx="1" stroke="currentColor" stroke-width="1.4"/></svg>
        Stats
      </button>
      <button class="dd-tab${activeDDTab==='results'?' active':''}" onclick="switchDDTab('results')">
        <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Results
      </button>
    </div>

    <!-- PANEL: CARDS -->
    <div class="dd-panel${activeDDTab==='cards'?' active':''}" id="ddp-cards">
      <div class="sr" style="margin-bottom:1.25rem;">
        <div class="sb"><div class="sv">${totalCards||0}</div><div class="sk">Cards</div></div>
        <div class="sb"><div class="sv">${d.wins||0}</div><div class="sk">Wins</div></div>
        <div class="sb"><div class="sv">${d.losses||0}</div><div class="sk">Losses</div></div>
        <div class="sb"><div class="sv ${wrc(w)}">${w}%</div><div class="sk">Win rate</div></div>
      </div>
      <div class="slbl">Decklist</div>
      <div class="clg">${(d.cards||[]).map(c=>`<div class="ci"><div><div class="cin">${c.n}</div><div class="cit">${c.t}</div></div><span class="cic">×${c.cnt}</span></div>`).join('')||'<p style="color:var(--text-muted);font-size:13px;grid-column:1/-1;">No cards yet — use the Edit tab.</p>'}</div>
      <button class="btn btn-d" style="margin-top:1rem;" onclick="delDeck(${d.id});closeDeckDetail()">Delete deck</button>
    </div>

    <!-- PANEL: EDIT -->
    <div class="dd-panel${activeDDTab==='edit'?' active':''}" id="ddp-edit">
      <div class="edit-grid">
        <div class="edit-left" id="edit-left"></div>
        <div class="edit-right" id="edit-right"></div>
      </div>
    </div>

    <!-- PANEL: STATS -->
    <div class="dd-panel${activeDDTab==='stats'?' active':''}" id="ddp-stats">
      ${buildStatsPanel(d)}
    </div>

    <!-- PANEL: RESULTS -->
    <div class="dd-panel${activeDDTab==='results'?' active':''}" id="ddp-results">
      <div class="result-form">
        <div>
          <label>Outcome</label>
          <select id="r-outcome"><option value="win">Win</option><option value="loss">Loss</option></select>
        </div>
        <div>
          <label>Opponent legend</label>
          <input type="text" id="r-opp" placeholder="e.g. Jinx" style="width:130px;">
        </div>
        <div>
          <label>Notes</label>
          <input type="text" id="r-notes" placeholder="Optional" style="width:160px;">
        </div>
        <button class="btn btn-g" onclick="addResult(${d.id})" style="align-self:flex-end;">+ Add</button>
      </div>
      <div class="result-list" id="result-list">
        ${renderResultsList(d)}
      </div>
    </div>

  `;

  if(activeDDTab==='edit'){
    renderEditSearch();
    renderEditPreview();
  }
}

function switchDDTab(tab){
  if(tab!=='edit'){EF.type='';EF.dom='';EF.page=1;EF.showAllVersions=false;const hzb=document.getElementById('hero-zone-bar');if(hzb)hzb.innerHTML='';}
  activeDDTab=tab;
  renderDeckDetail();
  if(tab==='edit'){setTimeout(()=>{renderEditSearch();renderEditPreview();},10);}
}

/* ── CARDS TAB helpers ───────────────────────────── */
function buildStatsPanel(d){
  const cards=d.cards||[];
  const total=cards.reduce((a,c)=>a+c.cnt,0);
  if(!total) return '<p style="color:var(--text-muted);font-size:13px;padding:1rem 0;">No cards in deck yet.</p>';
  const byType={};
  cards.forEach(entry=>{
    const t=entry.t||'Unknown';
    byType[t]=(byType[t]||0)+entry.cnt;
  });
  const typeColors={Champion:'var(--order)',Unit:'var(--calm)',Spell:'var(--mind)',Gear:'var(--fury)',Unknown:'var(--text-muted)'};
  const byCost={};
  cards.forEach(entry=>{
    const card=CARDS.find(c=>c.id===entry.id);
    const cost=card&&card.cost!==null?card.cost:'?';
    byCost[cost]=(byCost[cost]||0)+entry.cnt;
  });
  const costKeys=Object.keys(byCost).filter(k=>k!=='?').map(Number).sort((a,b)=>a-b);
  const maxCost=Math.max(...costKeys.map(k=>byCost[k]),1);
  const winsN=d.wins||0,lossesN=d.losses||0,total_games=winsN+lossesN;
  const wrN=total_games>0?Math.round(winsN/total_games*100):0;

  let html='';
  html+='<div class="stat-grid">';
  html+='<div class="stat-card"><div class="stat-num">'+total+'</div><div class="stat-lbl">Total Cards</div></div>';
  html+='<div class="stat-card"><div class="stat-num">'+total_games+'</div><div class="stat-lbl">Games Played</div></div>';
  html+='<div class="stat-card"><div class="stat-num '+wrc(wrN)+'">'+wrN+'%</div><div class="stat-lbl">Win Rate</div></div>';
  html+='<div class="stat-card"><div class="stat-num">'+winsN+'W / '+lossesN+'L</div><div class="stat-lbl">Record</div></div>';
  html+='</div>';
  html+='<div class="slbl" style="margin-bottom:10px;">Card Types</div>';
  Object.entries(byType).forEach(function(e){
    var t=e[0],n=e[1];
    var pct=Math.round(n/total*100);
    var col=typeColors[t]||'var(--accent)';
    html+='<div class="dist-row"><span class="dist-label">'+t+'</span><div class="dist-bar-wrap"><div class="dist-bar-fill" style="width:'+pct+'%;background:'+col+';"></div></div><span class="dist-count">'+n+'</span></div>';
  });
  if(costKeys.length){
    html+='<div class="slbl" style="margin:1.25rem 0 10px;">Energy Curve</div>';
    html+='<div style="display:flex;align-items:flex-end;gap:6px;height:70px;">';
    costKeys.forEach(function(k){
      var h=Math.round((byCost[k]/maxCost)*60);
      html+='<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;">';
      html+='<span style="font-size:10px;color:var(--text-muted);">'+byCost[k]+'</span>';
      html+='<div style="width:100%;height:'+h+'px;background:var(--accent);border-radius:3px 3px 0 0;min-height:4px;"></div>';
      html+='<span style="font-size:10px;color:var(--text-muted);">'+k+'</span>';
      html+='</div>';
    });
    html+='</div>';
  }
  return html;
}

function renderResultsList(d){
  const results=d.results||[];
  if(!results.length) return '<p style="color:var(--text-muted);font-size:13px;">No results logged yet.</p>';
  return results.slice().reverse().map(function(r,ri){
    var realIdx=results.length-1-ri;
    var cls=r.outcome==='win'?'result-win':'result-loss';
    var label=r.outcome==='win'?'WIN':'LOSS';
    return '<div class="result-row">'
      +'<span class="result-outcome '+cls+'">'+label+'</span>'
      +'<span class="result-opp">vs '+(r.opp||'Unknown')+'</span>'
      +(r.notes?'<span class="result-notes">'+r.notes+'</span>':'')
      +'<button class="result-del" onclick="deleteResult('+d.id+','+realIdx+')" title="Remove">×</button>'
      +'</div>';
  }).join('');
}

function addResult(deckId){
  const d=myDecks.find(x=>x.id===deckId);if(!d)return;
  const outcome=document.getElementById('r-outcome').value;
  const opp=(document.getElementById('r-opp').value.trim())||'Unknown';
  const notes=document.getElementById('r-notes').value.trim();
  if(!d.results) d.results=[];
  d.results.push({outcome:outcome,opp:opp,notes:notes,date:new Date().toLocaleDateString()});
  if(outcome==='win') d.wins=(d.wins||0)+1;
  else d.losses=(d.losses||0)+1;
  persist();
  var rl=document.getElementById('result-list');
  if(rl) rl.innerHTML=renderResultsList(d);
  document.getElementById('r-opp').value='';
  document.getElementById('r-notes').value='';
  toast(outcome==='win'?'Win logged!':'Loss logged.');
}

function deleteResult(deckId,idx){
  const d=myDecks.find(x=>x.id===deckId);if(!d||!d.results)return;
  const r=d.results[idx];
  if(r.outcome==='win'&&d.wins>0) d.wins--;
  if(r.outcome==='loss'&&d.losses>0) d.losses--;
  d.results.splice(idx,1);
  persist();
  var rl=document.getElementById('result-list');
  if(rl) rl.innerHTML=renderResultsList(d);
}

function buildSideboardPanel(d){
  const sb=d.sideboard||[];
  const sbTotal=sb.reduce((a,c)=>a+c.cnt,0);
  let rows='';
  if(sb.length){
    sb.forEach(function(entry){
      rows+='<div class="sb-card-row">'
        +'<span class="sb-card-name">'+entry.n+'</span>'
        +'<span class="sb-card-type">'+(entry.t||'')+'</span>'
        +'<div style="display:flex;align-items:center;gap:4px;">'
        +'<button class="edit-qty-btn" onclick="adjustSB('+d.id+',\''+entry.id+'\',-1)">−</button>'
        +'<span class="edit-qty">'+entry.cnt+'</span>'
        +'<button class="edit-qty-btn" onclick="adjustSB('+d.id+',\''+entry.id+'\',1)">+</button>'
        +'</div></div>';
    });
  } else {
    rows='<p style="color:var(--text-muted);font-size:13px;">No sideboard cards yet.</p>';
  }
  var clearBtn=sb.length?'<button class="btn btn-sm btn-d" onclick="clearSideboard('+d.id+')">Clear</button>':'';
  return '<div class="sb-layout">'
    +'<div><div class="sb-panel">'
    +'<div class="sb-panel-title"><span>Sideboard <span style="color:var(--text-muted);font-weight:400;font-size:12px;">('+sbTotal+'/15)</span></span>'+clearBtn+'</div>'
    +rows
    +'<div class="sb-add-wrap">'
    +'<div class="sb-add-search"><span class="sb-add-si">⌕</span>'
    +'<input type="text" id="sb-search" placeholder="Add card to sideboard…" oninput="renderSBSearch('+d.id+')">'
    +'</div>'
    +'<div class="sb-results" id="sb-results"></div>'
    +'</div></div></div>'
    +'<div><div class="sb-panel">'
    +'<div class="sb-panel-title">Sideboard notes</div>'
    +'<textarea id="sb-notes-area" placeholder="e.g. Bring in X vs Chaos decks…" style="width:100%;height:180px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;font-family:\'DM Sans\',sans-serif;font-size:13px;color:var(--text);resize:vertical;outline:none;" oninput="saveSBNotes('+d.id+')">'+(d.sideboardNotes||'')+'</textarea>'
    +'</div></div>'
    +'</div>';
}

function adjustSB(deckId,cardId,delta){
  const d=myDecks.find(x=>x.id===deckId);if(!d)return;
  if(!d.sideboard) d.sideboard=[];
  const entry=d.sideboard.find(c=>c.id===cardId);
  if(entry){
    if(delta>0&&entry.cnt>=3){toast('Max 3 copies');return;}
    if(delta>0){const sbTotal=d.sideboard.reduce((a,c)=>a+c.cnt,0);if(sbTotal>=15){toast('Sideboard is full (15 cards max)');return;}}
    entry.cnt=Math.max(0,entry.cnt+delta);
    if(entry.cnt===0) d.sideboard=d.sideboard.filter(c=>c.id!==cardId);
  }
  persist();
  renderEditSearch();renderEditPreview();
}

function addRune(cardId,cardName){
  const d=myDecks.find(x=>x.id===activeDeckId);if(!d)return;
  if(!d.runes) d.runes=[];
  if(d.runes.length>=12){toast('Max 12 runes per deck');return;}
  const full=CARDS.find(x=>x.id===cardId);
  const deckDoms=d.domains||[];
  if(full&&full.doms.length&&deckDoms.length&&!full.doms.some(dom=>deckDoms.includes(dom))){
    toast('Rune domain must match your deck');return;
  }
  d.runes.push({id:cardId,n:cardName});
  persist();renderEditSearch();renderEditPreview();
  toast(cardName+' added to runes');
}
function removeRune(cardId){
  const d=myDecks.find(x=>x.id===activeDeckId);if(!d)return;
  const idx=(d.runes||[]).findIndex(r=>r.id===cardId);
  if(idx>=0) d.runes.splice(idx,1);
  persist();renderEditSearch();renderEditPreview();
}

function clearSideboard(deckId){
  const d=myDecks.find(x=>x.id===deckId);if(!d)return;
  if(!confirm('Clear sideboard?'))return;
  d.sideboard=[];persist();
  renderEditPreview();
}

function saveSBNotes(deckId){
  const d=myDecks.find(x=>x.id===deckId);if(!d)return;
  const ta=document.getElementById('sb-notes-area');
  if(ta) d.sideboardNotes=ta.value;
  persist();
}

function renderSBSearch(deckId){
  const d=myDecks.find(x=>x.id===deckId);if(!d)return;
  const q=(document.getElementById('sb-search')?document.getElementById('sb-search').value:'').toLowerCase().trim();
  const res=document.getElementById('sb-results');if(!res)return;
  if(!q){res.innerHTML='';return;}
  const matches=CARDS.filter(c=>c.name.toLowerCase().includes(q)).slice(0,8);
  if(!matches.length){res.innerHTML='<p style="font-size:12px;color:var(--text-muted);padding:6px 8px;">No cards found</p>';return;}
  var html='';
  matches.forEach(function(c){
    var domCap=c.dom[0].toUpperCase()+c.dom.slice(1);
    html+='<div class="sb-result-row" onclick="addToSB('+deckId+',\''+c.id.replace(/'/g,"\\'")+'_sb\',\''+c.name.replace(/'/g,"\\'")+'\',\''+c.type+'\')">'
      +'<span>'+c.name+'</span>'
      +'<span class="pill '+c.dom+'" style="font-size:10px;">'+domCap+'</span>'
      +'</div>';
  });
  res.innerHTML=html;
}

function addToSB(deckId,cardId,cardName,cardType){
  if(cardType==='Battlefield'){toast('Battlefield cards go in battlefield zones');return;}
  const d=myDecks.find(x=>x.id===deckId);if(!d)return;
  if(!d.sideboard) d.sideboard=[];
  const sbTotal=d.sideboard.reduce((a,c)=>a+c.cnt,0);
  if(sbTotal>=15){toast('Sideboard is full (15 cards max)');return;}
  const deckIdx=(d.cards||[]).findIndex(c=>c.id===cardId);
  if(deckIdx<0){toast('Card not found in main deck');return;}
  d.cards[deckIdx].cnt--;
  if(d.cards[deckIdx].cnt<=0) d.cards.splice(deckIdx,1);
  const existing=d.sideboard.find(c=>c.id===cardId);
  if(existing){if(existing.cnt>=3){toast('Max 3 copies');return;}existing.cnt++;}
  else d.sideboard.push({id:cardId,n:cardName,t:cardType,cnt:1});
  persist();
  renderEditSearch();
  renderEditPreview();
  toast(cardName+' moved to sideboard');
}

function addDirectToSB(deckId,cardId,cardName,cardType){
  if(cardType==='Battlefield'){toast('Battlefield cards go in battlefield zones');return;}
  if(cardType==='Rune'){toast('Rune cards go in rune slots');return;}
  const d=myDecks.find(x=>x.id===deckId);if(!d)return;
  if(!d.sideboard) d.sideboard=[];
  const sbTotal=d.sideboard.reduce((a,c)=>a+c.cnt,0);
  if(sbTotal>=15){toast('Sideboard is full (15 cards max)');return;}
  const existing=d.sideboard.find(c=>c.id===cardId);
  if(existing){if(existing.cnt>=3){toast('Max 3 copies');return;}existing.cnt++;}
  else d.sideboard.push({id:cardId,n:cardName,t:cardType,cnt:1});
  showAddBanner('Added 1 copy to sideboard');
  persist();renderEditSearch();renderEditPreview();
  toast(cardName+' added to sideboard');
}

function renderEditSearch(){
  const d=myDecks.find(x=>x.id===activeDeckId);if(!d)return;
  const left=document.getElementById('edit-left');if(!left)return;
  const wasFocused=document.activeElement&&document.activeElement.id==='edit-search-inp';
  const savedVal=(document.getElementById('edit-search-inp')||{}).value||'';
  const q=savedVal.toLowerCase().trim();

  if(!cardsLoaded||!CARDS.length){
    left.innerHTML='<div style="text-align:center;padding:2rem;color:var(--text-muted);">'
      +'<div style="font-size:13px;margin-bottom:8px;">Cards still loading from Riftcodex…</div>'
      +'<button class="btn btn-sm btn-g" onclick="fetchAllCards()">Load now</button>'
      +'</div>';
    return;
  }

  let source=CARDS.filter(c=>c.type!=='Legend');
  const deckDoms=d.domains||[];
  if(deckDoms.length){source=source.filter(c=>c.type==='Rune'||c.type==='Battlefield'||c.doms.length===0||c.doms.some(dom=>deckDoms.includes(dom)));}
  // Rune tab: only show runes matching deck domains
  if(EF.type==='Rune'&&deckDoms.length){source=source.filter(c=>c.type==='Rune'&&(c.doms.length===0||c.doms.some(dom=>deckDoms.includes(dom))));}
  if(q) source=source.filter(c=>c.name.toLowerCase().includes(q)||c.txt.toLowerCase().includes(q));
  if(EF.type==='Champion') source=source.filter(c=>(c.supertype||'').toLowerCase().includes('champion')&&c.type!=='Legend');
  else if(EF.type) source=source.filter(c=>c.type===EF.type||c.supertype===EF.type);
  if(EF.dom) source=source.filter(c=>c.doms.includes(EF.dom));
  if(!EF.showAllVersions){
    const RR={Legendary:5,Epic:4,Rare:3,Uncommon:2,Common:1,Showcase:0,Promo:0};
    const seen=new Map();
    source.forEach(c=>{
      // For champions: strip variant suffix ("Annie - Fiery" → "Annie") so all forms collapse to one
      // For others: strip only trailing parenthetical "(Alternate Art)" style suffixes
      let key=c.name.replace(/\s*\([^)]*\)\s*$/,'').toLowerCase().trim();
      if(EF.type==='Champion'||(c.supertype||'').toLowerCase().includes('champion')) key=key.replace(/\s*[-–]\s*.+$/,'').trim();
      const ex=seen.get(key);
      if(!ex||(RR[c.rarity]??1)>(RR[ex.rarity]??1)) seen.set(key,c);
    });
    source=[...seen.values()];
  }
  source=source.slice().sort((a,b)=>a.name.localeCompare(b.name));

  const total=source.length;
  const perPage=getEditPer();
  const pages=Math.max(1,Math.ceil(total/perPage));
  if(EF.page>pages) EF.page=pages;
  const slice=source.slice((EF.page-1)*perPage,EF.page*perPage);

  const TYPES=['','Champion','Unit','Spell','Gear','Rune','Battlefield'];
  const TYPE_LABELS={'':'All','Champion':'Champion','Unit':'Unit','Spell':'Spell','Gear':'Gear','Rune':'Rune','Battlefield':'Battlefield'};
  const DOMS=['fury','chaos','calm','mind','body','order'];

  let html='';

  html+='<div class="edit-type-tabs">';
  TYPES.forEach(t=>{
    html+=`<button class="edit-type-tab${EF.type===t?' on':''}" onclick="setEditType('${t}')">${TYPE_LABELS[t]}</button>`;
  });
  html+='</div>';

  html+='<div class="edit-dom-filter">';
  const filterDoms=deckDoms.length?deckDoms:DOMS;
  filterDoms.forEach(dom=>{
    const cap=dom[0].toUpperCase()+dom.slice(1);
    html+=`<button class="edit-dom-pill ${dom}${EF.dom===dom?' on':''}" onclick="setEditDom('${dom}')">${cap}</button>`;
  });
  html+='</div>';

  const qEsc=savedVal.replace(/"/g,'&quot;');
  html+='<div class="edit-search-wrap">'
    +'<span class="edit-si">⌕</span>'
    +`<input type="text" id="edit-search-inp" placeholder="Search cards…" oninput="renderEditSearch()" value="${qEsc}">`
    +(savedVal?'<button class="edit-search-clear" onclick="document.getElementById(\'edit-search-inp\').value=\'\';EF.page=1;renderEditSearch()">×</button>':'')
    +'</div>'
    +`<label class="edit-all-versions-label"><input type="checkbox"${EF.showAllVersions?' checked':''} onchange="setEditShowAll(this.checked)"> Show all versions</label>`;

  html+='<div class="edit-card-grid">';
  if(!slice.length){
    html+='<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted);font-size:13px;">No cards found</div>';
  } else {
    slice.forEach(c=>{
      const entry=(d.cards||[]).find(x=>x.id===c.id);
      const cnt=entry?entry.cnt:0;
      const sn=c.name.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const isChamp=(c.supertype||'').toLowerCase().includes('champion');
      const effType=isChamp?'Champion':c.type;
      const at=c.type.replace(/'/g,"\\'");
      const st=effType.replace(/'/g,"\\'");
      const si=c.id.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const domPills=c.doms.map(dm=>`<span class="pill ${dm}">${dm[0].toUpperCase()+dm.slice(1)}</span>`).join('');
      const isRune=c.type==='Rune';
      const isBF=c.type==='Battlefield';
      const addFn=isRune?`addRune('${si}','${sn}')`:isBF?`addBattlefield(-1,'${si}','${sn}')`:`editDeckCard('${si}','${sn}','${at}',1)`;
      const canAdd=isBF?true:cnt<3;
      html+=`<div class="ct ct-img lib-card" draggable="true" ondragstart="editLibDragStart('${si}','${sn}','${st}')" title="${c.name}" onclick="${canAdd?addFn:''}">`;
      html+= c.imageUrl
        ?`<div class="ct-img-wrap"><img src="${c.imageUrl}" alt="${c.name}" loading="lazy" onerror="this.parentElement.classList.add('no-img')"></div>`
        :`<div class="ct-img-wrap no-img"><div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:11px;">No image</div></div>`;
      if(cnt>0) html+=`<div class="edit-card-thumb-cnt">×${cnt}</div>`;
      html+=`<div class="ct-name">${c.name}</div>`;
      html+=`<div class="ct-sub">${domPills}<span style="color:var(--text-muted);margin:0 2px;">·</span>${c.supertype||c.type}${c.rarity?`<span style="color:var(--text-muted);margin:0 2px;">·</span>${c.rarity}`:''}</div>`;
      html+=`<div class="deck-card-actions lib-card-overlay">`;
      html+=`<div class="dca-btn" onclick="event.stopPropagation();openCardModal('${si}')"><span>🔍</span> Zoom</div>`;
      html+=`<div class="lib-add-deck-hint">＋ ${isBF?'Add to BF':isRune?'Add to Runes':'Add to deck'}</div>`;
      html+=`<div class="dca-btn lib-sb-btn" onclick="event.stopPropagation();addDirectToSB(${d.id},'${si}','${sn}','${at}')"><span>→</span> Sideboard</div>`;
      html+=`</div>`;
      html+='</div>';
    });
  }
  html+='</div>';

  if(pages>1){
    html+='<div class="edit-pagination">';
    html+=`<button class="edit-page-btn"${EF.page===1?' disabled':''} onclick="setEditPage(${EF.page-1})">Prev</button>`;
    buildPageNums(EF.page,pages).forEach(p=>{
      if(p==='…') html+='<span style="padding:0 2px;color:var(--text-muted);font-size:13px;">…</span>';
      else html+=`<button class="edit-page-btn${p===EF.page?' on':''}" onclick="setEditPage(${p})">${p}</button>`;
    });
    html+=`<button class="edit-page-btn"${EF.page===pages?' disabled':''} onclick="setEditPage(${EF.page+1})">Next</button>`;
    html+='</div>';
  }

  left.innerHTML=html;
  left.ondragover=e=>{e.preventDefault();left.classList.add('drag-over');};
  left.ondragleave=e=>{if(!e.relatedTarget||!left.contains(e.relatedTarget))left.classList.remove('drag-over');};
  left.ondrop=e=>{e.preventDefault();left.classList.remove('drag-over');if(_DRAG&&_DRAG.src==='deck'){if(_DRAG.t==='Champion')removeChampionZone();else editDeckCard(_DRAG.id,_DRAG.n,_DRAG.t,-1);}_DRAG=null;};
  if(wasFocused){const inp=document.getElementById('edit-search-inp');if(inp){inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length);}}
}

function buildPageNums(cur,total){
  if(total<=7) return Array.from({length:total},(_,i)=>i+1);
  if(cur<=4) return [1,2,3,4,5,'…',total];
  if(cur>=total-3) return [1,'…',total-4,total-3,total-2,total-1,total];
  return [1,'…',cur-1,cur,cur+1,'…',total];
}
function setEditType(t){EF.type=t;EF.page=1;renderEditSearch();}
function setEditDom(d){EF.dom=EF.dom===d?'':d;EF.page=1;renderEditSearch();}
function setEditPage(p){EF.page=p;renderEditSearch();}
function setEditShowAll(v){EF.showAllVersions=v;EF.page=1;renderEditSearch();}

/* ── DRAG AND DROP ───────────────────────────────── */
function editLibDragStart(id,name,type){_DRAG={src:'library',id,n:name,t:type};}
function editDeckDragStart(id,name,type){_DRAG={src:'deck',id,n:name,t:type};}
function editZoneDragOver(e){e.preventDefault();e.currentTarget.classList.add('drag-over');}
function editZoneDragLeave(e){if(!e.relatedTarget||!e.currentTarget.contains(e.relatedTarget))e.currentTarget.classList.remove('drag-over');}
function editZoneDrop(e,zone){
  e.preventDefault();e.currentTarget.classList.remove('drag-over');
  if(!_DRAG)return;
  if(zone==='champion'){
    const d=myDecks.find(x=>x.id===activeDeckId);if(!d){_DRAG=null;return;}
    const full=CARDS.find(x=>x.id===_DRAG.id);
    const isChamp=_DRAG.t==='Champion'||(full&&(full.supertype||'').toLowerCase().includes('champion'));
    if(!isChamp){toast('Only Champion cards can go in the Champion zone');_DRAG=null;return;}
    // Enforce: card name must include the legend name
    const legendBase=(d.legend||'').split(/\s*[-–]\s*/)[0].toLowerCase().trim();
    if(legendBase&&!_DRAG.n.toLowerCase().includes(legendBase)){
      toast(`Champion zone only accepts ${d.legend} champions`);_DRAG=null;return;
    }
    if(d.champion){toast('Champion zone already has a card — remove it first');_DRAG=null;return;}
    if(_DRAG.src==='library'){
      // From library: add to zone (counts toward max 3)
      const zoneCnt=0;
      const deckEntry=(d.cards||[]).find(c=>c.id===_DRAG.id);
      const sbCnt=((d.sideboard||[]).find(c=>c.id===_DRAG.id)||{cnt:0}).cnt;
      if(zoneCnt+(deckEntry?deckEntry.cnt:0)+sbCnt>=3){toast('Max 3 copies total across all zones');_DRAG=null;return;}
      d.champion={id:_DRAG.id,n:_DRAG.n};
    } else if(_DRAG.src==='deck'){
      // From main deck: move 1 copy out of deck into zone
      const idx=(d.cards||[]).findIndex(c=>c.id===_DRAG.id);
      if(idx<0){_DRAG=null;return;}
      d.cards[idx].cnt--;
      if(d.cards[idx].cnt<=0) d.cards.splice(idx,1);
      d.champion={id:_DRAG.id,n:_DRAG.n};
    }
    persist();renderEditSearch();renderEditPreview();
  } else if(zone==='deck'){
    if(_DRAG.t==='Battlefield'){toast('Battlefield cards go in battlefield zones');_DRAG=null;return;}
    if(_DRAG.src==='library') editDeckCard(_DRAG.id,_DRAG.n,_DRAG.t,1);
  }
  _DRAG=null;
}

function renderEditPreview(){
  const d=myDecks.find(x=>x.id===activeDeckId);if(!d)return;
  const right=document.getElementById('edit-right');if(!right)return;
  // Migrate old t:'Champion' entries in d.cards → d.champion
  if(!d.champion){
    const old=(d.cards||[]).find(c=>c.t==='Champion');
    if(old){d.champion={id:old.id,n:old.n};d.cards=d.cards.filter(c=>c.t!=='Champion');persist();}
  }
  const cards=d.cards||[];
  const alpha=(a,b)=>a.n.localeCompare(b.n);
  const legendCards=cards.filter(c=>c.t==='Legend').sort(alpha);
  const deckCards=cards.filter(c=>c.t!=='Legend');
  const nonLegendCards=cards.filter(c=>c.t!=='Legend');
  const total=nonLegendCards.reduce((a,c)=>a+c.cnt,0);

  function cardItem(c,cls){
    const full=CARDS.find(x=>x.id===c.id);
    const img=full?full.imageUrl:'';
    const sn=c.n.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const st=c.t.replace(/'/g,"\\'");
    const si=c.id.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const canAdd=c.cnt<3;
    let h=`<div class="deck-card-item ${cls}" title="${c.n}" draggable="true" ondragstart="editDeckDragStart('${si}','${sn}','${st}')" data-hover-img="${img||''}">`;
    if(img) h+=`<img src="${img}" alt="" loading="lazy">`;
    else h+=`<div class="deck-card-no-img"><div class="dcni-name">${c.n}</div></div>`;
    h+=`<div class="deck-card-actions">`;
    h+=`<div class="dca-btn dca-danger" onclick="editDeckCard('${si}','${sn}','${st}',-1)"><span>✕</span> Remove</div>`;
    if(c.t!=='Legend') h+=`<div class="dca-btn${canAdd?'':' dca-disabled'}" onclick="editDeckCard('${si}','${sn}','${st}',1)"><span>＋</span> Add 1 copy</div>`;
    if(c.t!=='Legend') h+=`<div class="dca-btn" onclick="addToSB(${d.id},'${si}','${sn}','${st}')"><span>→</span> Add to sideboard</div>`;
    h+=`</div>`;
    if(c.cnt>1) h+=`<div class="deck-card-cnt-badge">×${c.cnt}</div>`;
    h+='</div>';
    return h;
  }

  const badge=document.getElementById('deck-count-badge');
  if(badge) badge.textContent=`${total} / 40 cards`;

  // Refresh curves panel live
  const curvesPanel=document.getElementById('deck-curves-panel');
  if(curvesPanel) curvesPanel.innerHTML=buildDeckCurves(d);

  // Clear header hero bar (no longer used in header)
  const heroBar=document.getElementById('hero-zone-bar');
  if(heroBar) heroBar.innerHTML='';
  const zoneChamp=d.champion||null;

  if(!d.battlefields) d.battlefields=[null,null,null];

  function buildHeroSection(){
    let h='<div class="deck-hero-row">';
    // Legend
    h+='<div class="deck-hero-half"><div class="deck-section-hdr">🦸 Legend</div><div class="deck-hero-cards">';
    if(!legendCards.length){
      h+='<div class="deck-hero-empty">None — add from left panel</div>';
    } else {
      const lc=legendCards[0];const lf=CARDS.find(x=>x.id===lc.id);const li=lf?lf.imageUrl:'';
      const lsi=lc.id.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const lsn=lc.n.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const lst=lc.t.replace(/'/g,"\\'");
      h+=`<div class="deck-card-item deck-card-legend" title="${lc.n}" draggable="true" ondragstart="editDeckDragStart('${lsi}','${lsn}','${lst}')" data-hover-img="${li||''}">`;
      if(li) h+=`<img src="${li}" alt="" loading="lazy">`;
      else h+=`<div class="deck-card-no-img"><div class="dcni-name">${lc.n}</div></div>`;
      h+=`<div class="deck-card-actions"><div class="dca-btn dca-danger" onclick="editDeckCard('${lsi}','${lsn}','${lst}',-1)"><span>✕</span> Remove</div></div></div>`;
    }
    h+='</div></div>';
    // Battlefield zones inline between Legend and Champion
    for(let i=0;i<3;i++){
      const bfc=d.battlefields[i];
      const bff=bfc?CARDS.find(x=>x.id===bfc.id):null;
      const bfi=bff?bff.imageUrl:'';
      h+='<div class="deck-hero-bf-slot">';
      h+=`<div class="deck-section-hdr" style="font-size:11px;">🌍 Battlefield ${i+1}</div>`;
      if(bfc){
        const bsi=bfc.id.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        const bsn=bfc.n.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        h+=`<div class="bf-zone bf-zone-filled" ondragover="editZoneDragOver(event)" ondragleave="editZoneDragLeave(event)" ondrop="bfZoneDrop(event,${i})" data-hover-img="${bfi||''}" data-hover-bf="1">`;
        h+=`<div class="bf-zone-inner" draggable="true" ondragstart="editDeckDragStart('${bsi}','${bsn}','Battlefield')">`;
        if(bfi) h+=`<img src="${bfi}" alt="" loading="lazy" class="bf-zone-img">`;
        else h+=`<div class="deck-card-no-img"><div class="dcni-name">${bfc.n}</div></div>`;
        h+=`<div class="deck-card-actions"><div class="dca-btn dca-danger" onclick="removeBattlefield(${i})"><span>✕</span> Remove</div></div>`;
        h+=`</div></div>`;
      } else {
        h+=`<div class="bf-zone bf-zone-empty drop-zone" ondragover="editZoneDragOver(event)" ondragleave="editZoneDragLeave(event)" ondrop="bfZoneDrop(event,${i})">`;
        h+=`<div class="bf-zone-hint">Drag or click</div>`;
        h+='</div>';
      }
      h+='</div>';
    }
    // Champion
    h+='<div class="deck-hero-half"><div class="deck-section-hdr">⚔️ Champion</div>';
    h+=`<div class="deck-card-item deck-card-legend drop-zone" ondragover="editZoneDragOver(event)" ondragleave="editZoneDragLeave(event)" ondrop="editZoneDrop(event,'champion')" title="${zoneChamp?zoneChamp.n:'Drag champion here'}">`;
    if(zoneChamp){
      const zf=CARDS.find(x=>x.id===zoneChamp.id);const zi=zf?zf.imageUrl:'';
      const zsi=zoneChamp.id.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const zsn=zoneChamp.n.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      h+=`<div class="hzb-inner" draggable="true" ondragstart="editDeckDragStart('${zsi}','${zsn}','Champion')" data-hover-img="${zi||''}">`;
      if(zi) h+=`<img src="${zi}" alt="" loading="lazy">`;
      else h+=`<div class="deck-card-no-img"><div class="dcni-name">${zoneChamp.n}</div></div>`;
      h+=`<div class="deck-card-actions"><div class="dca-btn dca-danger" onclick="removeChampionZone()"><span>✕</span> Remove</div></div></div>`;
    } else {
      h+='<div class="hzb-empty-drop">Drag champion here</div>';
    }
    h+='</div></div></div>';
    return h;
  }

  let html=buildHeroSection();

  // Deck cards by type (Unit → Spell → Gear → other)
  const TYPE_ORDER=['Unit','Spell','Gear'];
  function typeSort(a,b){
    const ai=TYPE_ORDER.indexOf(a);const bi=TYPE_ORDER.indexOf(b);
    const av=ai<0?99:ai;const bv=bi<0?99:bi;
    return av!==bv?av-bv:a.localeCompare(b);
  }
  if(!deckCards.length){
    html+='<div style="font-size:12px;color:var(--text-muted);padding:4px 0;">No cards yet — click cards on the left to add</div>';
  } else {
    const sorted=deckCards.slice().sort((a,b)=>typeSort(a.t,b.t)||a.n.localeCompare(b.n));
    const byType={};
    const typeOrder=[];
    sorted.forEach(c=>{if(!byType[c.t]){byType[c.t]=[];typeOrder.push(c.t);}byType[c.t].push(c);});
    html+='<div class="deck-all-types drop-zone" ondragover="editZoneDragOver(event)" ondragleave="editZoneDragLeave(event)" ondrop="editZoneDrop(event,\'deck\')">';
    typeOrder.forEach(type=>{
      const uniqueCards=byType[type];
      const typeTotal=uniqueCards.reduce((a,c)=>a+c.cnt,0);
      html+=`<div class="deck-type-block"><div class="deck-type-lbl">${type} (${typeTotal})</div>`;
      html+='<div class="deck-type-auto-grid">';
      uniqueCards.forEach(c=>{
        html+='<div class="deck-col-stack">';
        for(let i=0;i<c.cnt;i++) html+=cardItem(c,'deck-card-main');
        html+='</div>';
      });
      html+='</div>';
      html+='</div>';
    });
    html+='</div>';
  }

  // Rune section
  const runes=d.runes||[];
  const runeMax=12;
  html+=`<div class="deck-section deck-rune-section"><div class="deck-section-hdr" style="display:flex;align-items:center;gap:6px;">🔮 Runes <span class="ds-count">(${runes.length}/${runeMax})</span></div>`;
  if(!runes.length){
    html+='<div style="font-size:12px;color:var(--text-muted);">None — select the Rune tab on the left and click a rune to add</div>';
  } else {
    // Group runes by domain, then by card id
    const domainOrder=[];const byDomain={};
    runes.forEach(r=>{
      const rf=CARDS.find(x=>x.id===r.id);
      const dom=(rf&&rf.doms&&rf.doms.length)?rf.doms[0]:'other';
      if(!byDomain[dom]){byDomain[dom]=[];domainOrder.push(dom);}
      const existing=byDomain[dom].find(g=>g.id===r.id);
      if(existing) existing.cnt++;
      else byDomain[dom].push({id:r.id,n:r.n,cnt:1,img:rf?rf.imageUrl:''});
    });
    domainOrder.sort((a,b)=>a.localeCompare(b));
    html+='<div class="rune-domains-row">';
    domainOrder.forEach(dom=>{
      const groups=byDomain[dom];
      const domTotal=groups.reduce((a,g)=>a+g.cnt,0);
      const domCap=dom[0].toUpperCase()+dom.slice(1);
      html+=`<div class="rune-domain-block">`;
      html+=`<div class="rune-domain-lbl ${dom}">${domCap} <span class="ds-count">(${domTotal})</span></div>`;
      html+='<div class="rune-domain-row">';
      groups.forEach(r=>{
        const rsi=r.id.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        const rsn=r.n.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        html+='<div class="rune-h-stack">';
        for(let i=0;i<r.cnt;i++){
          html+=`<div class="deck-card-item rune-h-card${i===0?' rune-first':''}" title="${r.n}" style="z-index:${r.cnt-i};" data-hover-img="${r.img||''}">`;
          if(r.img) html+=`<img src="${r.img}" alt="" loading="lazy">`;
          else html+=`<div class="deck-card-no-img"><div class="dcni-name">${r.n}</div></div>`;
          if(i===0) html+=`<div class="deck-card-cnt-badge">×${r.cnt}</div>`;
          html+=`<div class="deck-card-actions">`;
          html+=`<div class="dca-btn" onclick="addRune('${rsi}','${rsn}')"><span>＋</span> Add 1 copy</div>`;
          html+=`<div class="dca-btn dca-danger" onclick="removeRune('${rsi}')"><span>✕</span> Remove 1</div>`;
          html+=`</div></div>`;
        }
        html+='</div>';
      });
      html+='</div></div>';
    });
    html+='</div>';
  }
  html+='</div>';

  // Sideboard section — card image grid like main deck
  const sb=d.sideboard||[];
  const sbTotal=sb.reduce((a,c)=>a+c.cnt,0);
  const clearBtn=sb.length?`<button class="btn btn-sm btn-d" style="padding:2px 8px;font-size:11px;margin-left:auto;" onclick="clearSideboard(${d.id})">Clear</button>`:'';
  html+=`<div class="deck-section deck-sb-section"><div class="deck-section-hdr" style="display:flex;align-items:center;gap:6px;">📋 Sideboard <span class="ds-count">(${sbTotal}/15)</span>${clearBtn}</div>`;
  if(!sb.length){
    html+='<div style="font-size:12px;color:var(--text-muted);">None — hover a card and use "Add to sideboard"</div>';
  } else {
    const sbSorted=sb.slice().sort((a,b)=>typeSort(a.t,b.t)||a.n.localeCompare(b.n));
    const sbByType={};const sbTypeOrder=[];
    sbSorted.forEach(c=>{if(!sbByType[c.t]){sbByType[c.t]=[];sbTypeOrder.push(c.t);}sbByType[c.t].push(c);});
    html+='<div class="deck-all-types">';
    sbTypeOrder.forEach(type=>{
      const uniqueCards=sbByType[type];
      const typeTotal=uniqueCards.reduce((a,c)=>a+c.cnt,0);
      html+=`<div class="deck-type-block"><div class="deck-type-lbl">${type} (${typeTotal})</div>`;
      html+='<div class="deck-type-auto-grid">';
      uniqueCards.forEach(c=>{
        const full=CARDS.find(x=>x.id===c.id);
        const img=full?full.imageUrl:'';
        const si=c.id.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        const sn=c.n.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        html+='<div class="deck-col-stack">';
        for(let i=0;i<c.cnt;i++){
          html+=`<div class="deck-card-item deck-card-main" title="${c.n}" data-hover-img="${img||''}">`;
          if(img) html+=`<img src="${img}" alt="" loading="lazy">`;
          else html+=`<div class="deck-card-no-img"><div class="dcni-name">${c.n}</div></div>`;
          html+=`<div class="deck-card-actions">`;
          html+=`<div class="dca-btn" onclick="adjustSB(${d.id},'${si}',1)"><span>＋</span> Add 1 copy</div>`;
          html+=`<div class="dca-btn dca-danger" onclick="adjustSB(${d.id},'${si}',-1)"><span>✕</span> Remove</div>`;
          html+=`</div>`;
          if(c.cnt>1&&i===0) html+=`<div class="deck-card-cnt-badge">×${c.cnt}</div>`;
          html+='</div>';
        }
        html+='</div>';
      });
      html+='</div>';
      html+='</div>';
    });
    html+='</div>';
  }
  html+='</div>';

  right.innerHTML=html;
}

function editDeckCard(cardId,cardName,cardType,delta){
  if(cardType==='Battlefield'){toast('Battlefield cards go in battlefield zones');return;}
  const d=myDecks.find(x=>x.id===activeDeckId);if(!d)return;
  if(!d.cards) d.cards=[];
  const idx=d.cards.findIndex(c=>c.id===cardId);
  if(delta>0){
    const sbCnt=((d.sideboard||[]).find(c=>c.id===cardId)||{cnt:0}).cnt;
    const deckCnt=idx>=0?d.cards[idx].cnt:0;
    const zoneCnt=(d.champion&&d.champion.id===cardId)?1:0;
    if(deckCnt+sbCnt+zoneCnt>=3){toast('Max 3 copies total across all zones');return;}
  }
  if(idx>=0){
    d.cards[idx].cnt=Math.max(0,d.cards[idx].cnt+delta);
    if(d.cards[idx].cnt===0) d.cards.splice(idx,1);
  } else if(delta>0){
    d.cards.push({id:cardId,n:cardName,t:cardType,cnt:1});
  }
  if(delta>0) showAddBanner('Added 1 copy to deck');
  persist();
  renderEditSearch();
  renderEditPreview();
}

/* ── DECK CARD CONTEXT MENU ──────────────────────── */
let _DCM=null;
let _DRAG=null;
function showDeckCardMenu(e,cardId,cardName,cardType){
  e.stopPropagation();
  closeDeckCardMenu();
  _DCM={id:cardId,n:cardName,t:cardType};
  const d=myDecks.find(x=>x.id===activeDeckId);if(!d)return;
  const entry=(d.cards||[]).find(c=>c.id===cardId);
  const cnt=entry?entry.cnt:0;
  const full=CARDS.find(x=>x.id===cardId);
  const img=full?full.imageUrl:'';

  const menu=document.createElement('div');
  menu.id='deck-ctx-menu';
  menu.className='deck-ctx-menu';
  menu.onclick=ev=>ev.stopPropagation();
  menu.innerHTML=
    (img?`<div class="dcm-preview"><img src="${img}" alt=""></div>`:'')
    +`<div class="dcm-item" onclick="dcmZoom()"><span class="dcm-icon">🔍</span>Zoom</div>`
    +`<div class="dcm-item dcm-danger" onclick="dcmRemove()"><span class="dcm-icon">✕</span>Remove</div>`
    +`<div class="dcm-item${cnt>=3?' dcm-disabled':''}" onclick="dcmAdd()"><span class="dcm-icon">＋</span>Add 1 copy</div>`
    +`<div class="dcm-item" onclick="dcmSideboard()"><span class="dcm-icon">→</span>Add to sideboard</div>`;
  document.body.appendChild(menu);

  const mw=190,mh=img?290:170;
  let left=e.clientX+12,top=e.clientY-10;
  if(left+mw>window.innerWidth-8) left=e.clientX-mw-12;
  if(top+mh>window.innerHeight-8) top=window.innerHeight-mh-8;
  menu.style.left=left+'px';
  menu.style.top=top+'px';
  setTimeout(()=>document.addEventListener('click',closeDeckCardMenu,{once:true}),0);
}
function closeDeckCardMenu(){
  const m=document.getElementById('deck-ctx-menu');if(m)m.remove();
  document.removeEventListener('click',closeDeckCardMenu);
  _DCM=null;
}
function dcmZoom(){if(_DCM)openCardModal(_DCM.id);closeDeckCardMenu();}
function dcmRemove(){if(_DCM)editDeckCard(_DCM.id,_DCM.n,_DCM.t,-1);closeDeckCardMenu();}
function dcmAdd(){if(_DCM)editDeckCard(_DCM.id,_DCM.n,_DCM.t,1);closeDeckCardMenu();}
function dcmSideboard(){
  if(!_DCM) return;
  const d=myDecks.find(x=>x.id===activeDeckId);if(!d)return;
  if(!d.sideboard) d.sideboard=[];
  const sbTotal=d.sideboard.reduce((a,c)=>a+c.cnt,0);
  if(sbTotal>=15){toast('Sideboard is full (15 cards max)');closeDeckCardMenu();return;}
  const deckIdx=(d.cards||[]).findIndex(c=>c.id===_DCM.id);
  if(deckIdx<0){closeDeckCardMenu();return;}
  d.cards[deckIdx].cnt--;
  if(d.cards[deckIdx].cnt<=0) d.cards.splice(deckIdx,1);
  const sbEntry=d.sideboard.find(c=>c.id===_DCM.id);
  if(sbEntry) sbEntry.cnt++;
  else d.sideboard.push({id:_DCM.id,n:_DCM.n,t:_DCM.t,cnt:1});
  persist();
  renderEditSearch();
  renderEditPreview();
  const panel=document.getElementById('ddp-sideboard');
  if(panel) panel.innerHTML=buildSideboardPanel(d);
  toast(_DCM.n+' moved to sideboard');
  closeDeckCardMenu();
}

function editChampionCard(cardId,cardName,actualType){
  const d=myDecks.find(x=>x.id===activeDeckId);if(!d)return;
  if(!d.cards) d.cards=[];
  const zoneCnt=(d.champion&&d.champion.id===cardId)?1:0;
  const deckEntry=d.cards.find(c=>c.id===cardId);
  const sbCnt=((d.sideboard||[]).find(c=>c.id===cardId)||{cnt:0}).cnt;
  const total=zoneCnt+(deckEntry?deckEntry.cnt:0)+sbCnt;
  if(total>=3){toast('Max 3 copies total across all zones');return;}
  if(!d.champion){
    d.champion={id:cardId,n:cardName};
  } else {
    if(deckEntry){deckEntry.cnt++;}
    else{d.cards.push({id:cardId,n:cardName,t:actualType||'Unit',cnt:1});}
  }
  persist();renderEditSearch();renderEditPreview();
}
function removeChampionZone(){
  const d=myDecks.find(x=>x.id===activeDeckId);if(!d)return;
  d.champion=null;persist();renderEditSearch();renderEditPreview();
}

function addBattlefield(preferSlot,cardId,cardName){
  const d=myDecks.find(x=>x.id===activeDeckId);if(!d)return;
  if(!d.battlefields) d.battlefields=[null,null,null];
  // Find free slot; if preferSlot given and free, use it
  let slot=-1;
  if(preferSlot>=0&&preferSlot<3&&!d.battlefields[preferSlot]) slot=preferSlot;
  if(slot<0) slot=d.battlefields.findIndex(s=>s===null);
  if(slot<0){toast('All 3 battlefield zones are full');return;}
  d.battlefields[slot]={id:cardId,n:cardName};
  persist();renderEditSearch();renderEditPreview();
  toast(cardName+' added to battlefield zone '+(slot+1));
}
function removeBattlefield(slotIdx){
  const d=myDecks.find(x=>x.id===activeDeckId);if(!d)return;
  if(!d.battlefields) d.battlefields=[null,null,null];
  d.battlefields[slotIdx]=null;
  persist();renderEditSearch();renderEditPreview();
}
function bfZoneDrop(e,slotIdx){
  e.preventDefault();e.currentTarget.classList.remove('drag-over');
  if(!_DRAG)return;
  const d=myDecks.find(x=>x.id===activeDeckId);if(!d){_DRAG=null;return;}
  if(_DRAG.t!=='Battlefield'){toast('Only Battlefield cards can go in battlefield zones');_DRAG=null;return;}
  if(!d.battlefields) d.battlefields=[null,null,null];
  if(d.battlefields[slotIdx]){toast('Battlefield zone '+( slotIdx+1)+' already has a card — remove it first');_DRAG=null;return;}
  d.battlefields[slotIdx]={id:_DRAG.id,n:_DRAG.n};
  persist();renderEditSearch();renderEditPreview();
  _DRAG=null;
}

function startEditDeckTitle(deckId){
  const el=document.getElementById('deck-title-display');if(!el)return;
  const d=myDecks.find(x=>x.id===deckId);if(!d)return;
  const inp=document.createElement('input');
  inp.type='text';inp.value=d.name;inp.className='dtitle-input';
  inp.onblur=()=>saveDeckTitle(deckId,inp.value);
  inp.onkeydown=e=>{if(e.key==='Enter')inp.blur();if(e.key==='Escape'){inp.value=d.name;inp.blur();}};
  el.replaceWith(inp);inp.focus();inp.select();
}
function saveDeckTitle(deckId,val){
  const d=myDecks.find(x=>x.id===deckId);if(!d)return;
  const name=val.trim()||d.name;
  d.name=name;persist();
  const inp=document.querySelector('.dtitle-input');
  if(inp){
    const el=document.createElement('div');
    el.className='dtitle';el.id='deck-title-display';el.title='Click to edit';
    el.innerHTML=`${name}<span class="dtitle-edit-icon">✎</span>`;
    el.onclick=()=>startEditDeckTitle(deckId);
    inp.replaceWith(el);
  }
  if(currentUser) saveToCloud(deckId);
}
function closeDeckDetail(){document.getElementById('dl').style.display='';document.getElementById('dd').style.display='none';activeDeckId=null;activeDDTab='cards';renderDecks();}
function delDeck(id){
  if(!confirm('Delete this deck?'))return;
  var deck=myDecks.find(function(d){return d.id===id;});
  var cloudId=deck&&deck.cloud_id;
  myDecks=myDecks.filter(function(d){return d.id!==id;});
  persist();renderDecks();toast('Deck deleted');
  if(currentUser&&cloudId) api('DELETE','/api/decks/'+cloudId).catch(function(){});
}

/* ── CARD FILTERS ────────────────────────────────── */
function toggleDrop(id,btn){
  document.querySelectorAll('.cs-dropdown').forEach(d=>{if(d.id!==id){d.classList.remove('open');d.previousElementSibling?.classList.remove('open');}});
  btn.classList.toggle('open',document.getElementById(id).classList.toggle('open'));
}
document.addEventListener('click',e=>{
  if(!e.target.closest('.cs-drop-wrap')){
    document.querySelectorAll('.cs-dropdown').forEach(d=>d.classList.remove('open'));
    document.querySelectorAll('.cs-drop-btn').forEach(b=>b.classList.remove('open'));
  }
});
function setLegend(name,el){
  CF.type='Legend';CF.legend=name;
  const label=name.split(' - ')[0];
  document.getElementById('dv-type').textContent=label;
  el.closest('.cs-dropdown').querySelectorAll('.cs-dopt').forEach(o=>o.classList.remove('active'));
  el.classList.add('active');
  el.closest('.cs-dropdown').classList.remove('open');
  el.closest('.cs-drop-wrap').querySelector('.cs-drop-btn').classList.remove('open');
  renderCards();
}
function setDrop(key,val,label,el){
  CF[key]=val;
  if(key==='type')CF.legend='';
  document.getElementById('dv-'+key).textContent=label;
  el.closest('.cs-dropdown').querySelectorAll('.cs-dopt').forEach(o=>o.classList.remove('active'));
  el.classList.add('active');
  el.closest('.cs-dropdown').classList.remove('open');
  el.closest('.cs-drop-wrap').querySelector('.cs-drop-btn').classList.remove('open');
  renderCards();
}
function toggleDom(btn){
  const d=btn.dataset.dom;CF.doms.has(d)?CF.doms.delete(d):CF.doms.add(d);
  btn.classList.toggle('on',CF.doms.has(d));renderCards();
}
function updateRange(n){
  const lo=parseInt(document.getElementById('rlo-'+n).value);
  const hi=parseInt(document.getElementById('rhi-'+n).value);
  const max=parseInt(document.getElementById('rhi-'+n).max);
  const lf=Math.min(lo,hi),hf=Math.max(lo,hi);
  if(n==='energy')CF.energy=[lf,hf];
  if(n==='power') CF.power=[lf,hf];
  if(n==='might') CF.might=[lf,hf];
  document.getElementById('rv-'+n).textContent=(lf===0&&hf===max)?'Any':lf===hf?String(lf):`${lf} – ${hf}`;
  const f=document.getElementById('rf-'+n);
  f.style.left=(lf/max*100)+'%';f.style.width=((hf-lf)/max*100)+'%';
  renderCards();
}
function resetAll(){
  if(VIEW==='cards')resetFilters();else resetArtistFilters();
}
function resetFilters(){
  CF.type='';CF.set='';CF.rar='';CF.legend='';CF.doms.clear();CF.energy=[0,12];CF.power=[0,4];CF.might=[0,10];
  document.getElementById('cs').value='';
  ['energy','power','might'].forEach(n=>{
    const max=parseInt(document.getElementById('rhi-'+n).max);
    document.getElementById('rlo-'+n).value=0;document.getElementById('rhi-'+n).value=max;
    document.getElementById('rv-'+n).textContent='Any';
    const f=document.getElementById('rf-'+n);f.style.left='0%';f.style.width='100%';
  });
  ['set','type','rar'].forEach(k=>{
    document.getElementById('dv-'+k).textContent='All';
    document.getElementById('dd-'+k).querySelectorAll('.cs-dopt').forEach((o,i)=>o.classList.toggle('active',i===0));
  });
  document.querySelectorAll('.dom-btn').forEach(b=>b.classList.remove('on'));
  renderCards();
}

function toggleShowAllVersions(v){CF.showAllVersions=v;renderCards();}

/* ── RENDER CARDS ────────────────────────────────── */
function renderCards(){
  const q=document.getElementById('cs').value.toLowerCase();
  const list=CARDS.filter(c=>{
    if(q&&!c.name.toLowerCase().includes(q)&&!c.txt.toLowerCase().includes(q))return false;
    if(CF.type){
      const match=c.supertype===CF.type||c.type===CF.type;
      if(!match)return false;
    }
    if(CF.legend&&!c.name.startsWith(CF.legend))return false;
    if(CF.rar&&c.rarity!==CF.rar)return false;
    if(CF.set&&c.set!==CF.set)return false;
    if(CF.doms.size>0&&!CF.doms.has(c.dom))return false;
    if(c.cost!==null&&(c.cost<CF.energy[0]||c.cost>CF.energy[1]))return false;
    if(c.power!==null&&(c.power<CF.power[0]||c.power>CF.power[1]))return false;
    if(c.might!==null&&(c.might<CF.might[0]||c.might>CF.might[1]))return false;
    return true;
  });
  const RARITY_RANK={Legendary:5,Epic:4,Rare:3,Uncommon:2,Common:1,Showcase:0,Promo:0};
  let display;
  if(CF.showAllVersions){
    display=list.slice();
  } else {
    const seen=new Map();
    list.forEach(c=>{
      const key=c.name.replace(/\s*\([^)]*\)\s*$/,'').toLowerCase().trim();
      const existing=seen.get(key);
      if(!existing){seen.set(key,c);return;}
      const curRank=RARITY_RANK[c.rarity]??1;
      const exRank=RARITY_RANK[existing.rarity]??1;
      if(curRank>exRank) seen.set(key,c);
    });
    display=[...seen.values()];
  }
  display.sort((a,b)=>a.name.localeCompare(b.name));
  document.getElementById('res-count').textContent=`${display.length} card${display.length!==1?'s':''}`;
  const g=document.getElementById('cg');
  if(!display.length){g.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);font-size:14px;">No cards match your filters. <button class="btn btn-sm" onclick="resetFilters()" style="margin-left:8px;">Reset</button></div>`;return;}
  g.innerHTML=display.map(c=>{
    const domPills=c.doms.map(d=>`<span class="pill ${d}">${d[0].toUpperCase()+d.slice(1)}</span>`).join('');
    const safeId=c.id.replace(/'/g,"\\'");
    return`<div class="ct ct-img" onclick="openCardModal('${safeId}')">
      ${c.imageUrl
        ?`<div class="ct-img-wrap"><img src="${c.imageUrl}" alt="${c.name}" loading="lazy" onerror="this.parentElement.classList.add('no-img')"></div>`
        :`<div class="ct-img-wrap no-img"><div class="ct-img-placeholder" style="background:var(--surface3);display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:11px;">No image</div></div>`
      }
      ${c.cost!==null?`<div class="cost">${c.cost}</div>`:''}
      <div class="ct-name">${c.name}</div>
      <div class="ct-sub">${domPills}<span style="color:var(--text-muted);margin:0 2px;">·</span>${c.supertype||c.type}${c.rarity?`<span style="color:var(--text-muted);margin:0 2px;">·</span>${c.rarity}`:''}</div>
    </div>`;
  }).join('');
}

/* ── CARD TEXT RENDERER ──────────────────────────── */
const RB_RUNE_URLS={
  fury: 'https://static0.fextralifeimages.com/file/riftbound/4/46/Fury.png',
  calm: 'https://static0.fextralifeimages.com/file/riftbound/2/20/Calm.png',
  mind: 'https://static0.fextralifeimages.com/file/riftbound/e/e5/Mind2.png',
  body: 'https://static0.fextralifeimages.com/file/riftbound/e/e9/Body.png',
  chaos:'https://static0.fextralifeimages.com/file/riftbound/8/8f/Chaos.png',
  order:'https://static0.fextralifeimages.com/file/riftbound/5/58/Order.png',
};
const RB_MIGHT_SVG=`<svg class="rb-stat-icon" viewBox="0 0 14 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="2" x2="7" y2="13"/><line x1="4" y1="8" x2="10" y2="8"/><line x1="7" y1="13" x2="7" y2="15"/><polyline points="5,4 7,2 9,4"/></svg>`;
const RB_EXHAUST_SVG=`<svg class="rb-stat-icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="12" x2="10" y2="4"/><path d="M8 2l4 4-1.5 1.5"/><line x1="2" y1="10" x2="4" y2="12"/></svg>`;
const RB_POWER_SVG=`<svg class="rb-stat-icon" viewBox="0 0 14 14" fill="currentColor"><path d="M7 1l1.8 4.2H13l-3.6 2.6 1.4 4.2L7 9.5l-3.8 2.5 1.4-4.2L1 5.2h4.2z"/></svg>`;
function renderCardText(txt){
  if(!txt) return '';
  return txt
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\n/g,'<br>')
    .replace(/\[([^\]]+)\]/g,(_,kw)=>`<span class="rb-kw">${kw}</span>`)
    .replace(/:rb_energy_(\d+):/g,(_,n)=>`<span class="rb-energy">${n}</span>`)
    .replace(/:rb_rune_(\w+):/g,(_,d)=>{
      const url=RB_RUNE_URLS[d];
      return url
        ?`<img class="rb-rune" src="${url}" alt="${d} rune">`
        :`<span class="rb-rune-rainbow"></span>`;
    })
    .replace(/:rb_might:/g, RB_MIGHT_SVG)
    .replace(/:rb_power:/g, RB_POWER_SVG)
    .replace(/:rb_exhaust:/g, RB_EXHAUST_SVG);
}

/* ── CARD MODAL ──────────────────────────────────── */
function openCardModal(cardId){
  const c=CARDS.find(x=>x.id===cardId);if(!c)return;
  const domPills=c.doms.map(d=>`<span class="pill ${d}">${d[0].toUpperCase()+d.slice(1)}</span>`).join('');
  const stats=[
    c.cost!==null?`<div class="cm-stat"><span class="cm-stat-lbl">Energy</span><span class="cm-stat-val">⚡ ${c.cost}</span></div>`:'',
    c.might!==null?`<div class="cm-stat"><span class="cm-stat-lbl">Might</span><span class="cm-stat-val">⚔ ${c.might}</span></div>`:'',
    c.power!==null?`<div class="cm-stat"><span class="cm-stat-lbl">Power</span><span class="cm-stat-val">💪 ${c.power}</span></div>`:'',
  ].filter(Boolean).join('');
  const deckDeck=myDecks.find(d=>d.id===activeDeckId);
  const inDeck=deckDeck?(deckDeck.cards||[]).find(x=>x.id===c.id):null;

  document.getElementById('card-modal-body').innerHTML=`
    <div class="cm-layout">
      <div class="cm-img-col">
        ${c.imageUrl
          ?`<img src="${c.imageUrl}" alt="${c.name}" class="cm-img">`
          :`<div class="cm-img cm-img-empty"><span style="color:var(--text-muted);">No image</span></div>`}
      </div>
      <div class="cm-info-col">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;">
          <div>
            <div class="cm-name">${c.name}</div>
            <div class="cm-meta">${c.supertype||c.type}${c.rarity?' · '+c.rarity:''}${c.setLabel?' · '+c.setLabel:''}</div>
          </div>
          <button onclick="closeCardModal()" style="background:none;border:none;color:var(--text-muted);font-size:22px;cursor:pointer;line-height:1;flex-shrink:0;">×</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">${domPills}</div>
        ${stats?`<div class="cm-stats">${stats}</div>`:''}
        ${c.txt?`<div class="cm-txt">${renderCardText(c.txt)}</div>`:''}
        ${c.flavour?`<div class="cm-flavour">"${c.flavour}"</div>`:''}
        ${c.tags&&c.tags.length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">${c.tags.map(t=>`<span style="font-size:11px;padding:2px 8px;border-radius:20px;background:var(--surface3);color:var(--text-muted);border:1px solid var(--border);">${t}</span>`).join('')}</div>`:''}
        ${c.artist&&c.artist!=='Unknown'?`<div style="font-size:11px;color:var(--text-muted);margin-top:12px;border-top:1px solid var(--border);padding-top:10px;">✦ Art by ${c.artist}</div>`:''}
      </div>
    </div>`;
  document.getElementById('card-modal').classList.add('open');
}
function closeCardModal(){document.getElementById('card-modal').classList.remove('open');}

/* ── ARTISTS ─────────────────────────────────────── */
function toggleArtDom(btn){
  const d=btn.dataset.dom;AF.doms.has(d)?AF.doms.delete(d):AF.doms.add(d);
  btn.classList.toggle('on',AF.doms.has(d));renderArtists();
}
function resetArtistFilters(){
  document.getElementById('cs').value='';
  document.getElementById('art-sort').value='count';
  AF.doms.clear();document.querySelectorAll('.adb').forEach(b=>b.classList.remove('on'));
  renderArtists();
}
function renderArtists(){
  const q=(document.getElementById('cs').value||'').toLowerCase().trim();
  const sort=document.getElementById('art-sort').value;
  const g=document.getElementById('artist-grid');
  if(!CARDS.length){g.innerHTML=`<div class="spinner"><div class="spin"></div>Loading…</div>`;document.getElementById('res-count').textContent='';return;}
  const byA={};CARDS.forEach(c=>{const a=c.artist||'Unknown';if(!byA[a])byA[a]=[];byA[a].push(c);});
  let artists=Object.entries(byA);
  if(q)artists=artists.filter(([n,cs])=>n.toLowerCase().includes(q)||cs.some(c=>c.name.toLowerCase().includes(q)));
  if(AF.doms.size>0)artists=artists.filter(([,cs])=>cs.some(c=>AF.doms.has(c.dom)));
  if(sort==='alpha')artists.sort((a,b)=>a[0].localeCompare(b[0]));
  else if(sort==='alpha-desc')artists.sort((a,b)=>b[0].localeCompare(a[0]));
  else artists.sort((a,b)=>b[1].length-a[1].length);
  document.getElementById('res-count').textContent=artists.length+' artist'+(artists.length!==1?'s':'');
  if(!artists.length){g.innerHTML=`<div class="es"><h3>No artists found</h3><p>Try a different search.</p></div>`;return;}
  g.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;">
    ${artists.map(([name,cards])=>{
      const am=!q||name.toLowerCase().includes(q);
      const sorted=q&&!am?[...cards].sort((a,b)=>a.name.toLowerCase().includes(q)?-1:1):cards;
      return`<div class="dc" style="cursor:pointer;transition:border-color 0.15s;" data-artist="${name.replace(/"/g,'&quot;')}" onclick="openArtistModal(this.dataset.artist)" onmouseenter="this.style.borderColor='var(--border-hover)'" onmouseleave="this.style.borderColor=''">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <div style="width:44px;height:44px;border-radius:50%;background:var(--surface2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:var(--accent);flex-shrink:0;">${name[0].toUpperCase()}</div>
          <div><div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:600;">${name}</div><div style="font-size:12px;color:var(--text-muted);">${cards.length} card${cards.length!==1?'s':''} · <span style="color:var(--accent);">View gallery →</span></div></div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
          ${sorted.slice(0,8).map(c=>{const m=q&&c.name.toLowerCase().includes(q);return`<span style="font-size:11px;padding:3px 9px;border-radius:20px;background:${m?'var(--accent-dim)':'var(--surface2)'};color:${m?'var(--accent)':'var(--text-muted)'};border:1px solid ${m?'var(--accent)':'var(--border)'};">${c.name}</span>`;}).join('')}
          ${sorted.length>8?`<span style="font-size:11px;padding:3px 9px;border-radius:20px;background:var(--accent-dim);color:var(--accent);">+${sorted.length-8} more</span>`:''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">${[...new Set(cards.map(c=>c.dom))].map(d=>`<span class="pill ${d}">${d[0].toUpperCase()+d.slice(1)}</span>`).join('')}</div>
      </div>`;
    }).join('')}
  </div>`;
}

/* ── ARTIST MODAL ────────────────────────────────── */
function openArtistModal(artistName){
  const cards=CARDS.filter(c=>c.artist===artistName);
  document.getElementById('artist-modal-name').textContent=artistName;
  document.getElementById('artist-modal-count').textContent=cards.length+' card'+(cards.length!==1?'s':'');
  document.getElementById('artist-modal-cards').innerHTML=cards.map(c=>{
    const safeId=c.id.replace(/'/g,"\\'");
    return`<div class="ct ct-img" onclick="closeArtistModal();openCardModal('${safeId}')" style="cursor:pointer;">
      ${c.imageUrl
        ?`<div class="ct-img-wrap"><img src="${c.imageUrl}" alt="${c.name}" loading="lazy" onerror="this.parentElement.classList.add('no-img')"></div>`
        :`<div class="ct-img-wrap no-img"><div class="ct-img-placeholder" style="background:var(--surface3);display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:11px;">No image</div></div>`
      }
      ${c.cost!==null?`<div class="cost">${c.cost}</div>`:''}
      <div class="ct-name">${c.name}</div>
      <div class="ct-sub">${c.doms.map(d=>`<span class="pill ${d}">${d[0].toUpperCase()+d.slice(1)}</span>`).join('')}</div>
    </div>`;
  }).join('');
  document.getElementById('artist-modal').classList.add('open');
}
function closeArtistModal(){document.getElementById('artist-modal').classList.remove('open');}

/* ── MODAL ──────────────────────────────────────── */
function openModal(){document.getElementById('modal').classList.add('open');autoD();}
function closeModal(){document.getElementById('modal').classList.remove('open');}
function autoD(){const auto=LD[document.getElementById('mleg').value]||[];document.querySelectorAll('.dtog').forEach(el=>el.classList.toggle('sel',auto.includes(el.classList[1])));}
function togD(el){if(!el.classList.contains('sel')&&document.querySelectorAll('.dtog.sel').length>=2){toast('Max 2 domains');return;}el.classList.toggle('sel');}
function createDeck(){
  const name=document.getElementById('mn').value.trim();
  const legend=document.getElementById('mleg').value;
  const format=document.getElementById('mfmt').value;
  const domains=[...document.querySelectorAll('.dtog.sel')].map(e=>e.classList[1]);
  if(!name){document.getElementById('mn').focus();return;}
  const initCards=[];
  const legendCard=CARDS.find(c=>c.type==='Legend'&&c.name===legend);
  if(legendCard) initCards.push({id:legendCard.id,n:legendCard.name,t:legendCard.type,cnt:1});
  const deck={id:nextId++,name,legend,domains:domains.length?domains:LD[legend]||[],format,wins:0,losses:0,desc:'',cards:initCards,battlefields:[null,null,null]};
  myDecks.unshift(deck);persist();closeModal();document.getElementById('mn').value='';renderDecks();toast('Deck created!');
  if(currentUser) setTimeout(function(){ saveToCloud(deck.id); }, 100);
}
document.getElementById('modal').addEventListener('click',function(e){if(e.target===this)closeModal();});

/* ── EVENTS ─────────────────────────────────────── */
const EVTS=[
  {id:1,name:'RiftLibrary Open #1',date:'2026-05-10',location:'Orlando, FL',format:'Constructed',status:'upcoming',prize:'$200 store credit',players:0,maxPlayers:32,desc:'Our first community tournament! Open to all skill levels. Registration open now.'},
  {id:2,name:'Riftbound Origins Release Event',date:'2026-04-20',location:'Local Game Store',format:'Sealed',status:'upcoming',prize:'Booster packs',players:14,maxPlayers:24,desc:'Celebrate the Origins set with a sealed format event.'},
  {id:3,name:'Weekly Constructed Night',date:'2026-04-17',location:'Game Haven — Orlando',format:'Constructed',status:'upcoming',prize:'Store credit',players:8,maxPlayers:16,desc:'Every Thursday evening. Casual and competitive players welcome.'},
  {id:4,name:'Spring Championship 2026',date:'2026-03-28',location:'Tampa, FL',format:'Constructed',status:'completed',prize:'$500 cash',players:48,maxPlayers:64,desc:'Congrats to all participants! Decklists from top 8 coming soon.'},
  {id:5,name:'Friday Night Riftbound',date:'2026-04-11',location:'Card Kingdom — Tampa',format:'Draft',status:'completed',prize:'Promo cards',players:12,maxPlayers:16,desc:'Weekly draft night. Great turnout — thanks everyone!'},
];
function renderEvents(){
  const el=document.getElementById('events-content');
  const up=EVTS.filter(e=>e.status==='upcoming'),done=EVTS.filter(e=>e.status==='completed');
  function ec(e){
    const isU=e.status==='upcoming';
    const ds=new Date(e.date).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
    const pct=Math.round(e.players/e.maxPlayers*100);
    return`<div class="dc" style="cursor:default;">
      <div class="dt"><div><div class="dn">${e.name}</div><div class="dl">${ds} · ${e.location}</div></div><span class="ftag" style="${isU?'color:var(--calm);border-color:var(--calm);':''}">${isU?'Upcoming':'Completed'}</span></div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:10px;">${e.desc}</div>
      <div style="display:flex;gap:10px;font-size:12px;color:var(--text-muted);margin-bottom:10px;"><span>📋 ${e.format}</span><span>🏆 ${e.prize}</span><span>👥 ${e.players}/${e.maxPlayers}</span></div>
      ${isU?`<div style="height:4px;background:var(--surface3);border-radius:2px;margin-bottom:10px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:var(--accent);border-radius:2px;"></div></div>
        <div style="display:flex;gap:8px;"><button class="btn btn-sm btn-g" onclick="alert('Registration coming soon!')">Register (${e.maxPlayers-e.players} spots)</button><button class="btn btn-sm" onclick="alert('Details coming soon!')">Details</button></div>`
      :`<div style="font-size:12px;color:var(--text-muted);">Completed · ${e.players} attended</div>`}
    </div>`;
  }
  el.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:10px;"><div class="slbl" style="margin:0;">${up.length} upcoming</div><button class="btn btn-sm btn-g" onclick="alert('Coming soon!')">+ Submit event</button></div>
    <div class="dg" style="margin-bottom:2rem;">${up.map(ec).join('')}</div>
    <div class="slbl" style="margin-bottom:1rem;">Past events</div><div class="dg">${done.map(ec).join('')}</div>`;
}

/* ── STATISTICS ──────────────────────────────────── */
function renderStatistics(){
  const el=document.getElementById('stats-content');
  const N=CARDS.length;
  const dc={fury:0,chaos:0,calm:0,mind:0,body:0,order:0};CARDS.forEach(c=>{if(dc[c.dom]!==undefined)dc[c.dom]++;});
  const tc={Champion:0,Unit:0,Spell:0,Gear:0};
  CARDS.forEach(c=>{const t=c.supertype||c.type;if(tc[t]!==undefined)tc[t]++;else if(tc[c.type]!==undefined)tc[c.type]++;});
  const dwr=[...myDecks].filter(d=>d.wins+d.losses>0).sort((a,b)=>wr(b)-wr(a));
  const dc2={fury:'var(--fury)',chaos:'var(--chaos)',calm:'var(--calm)',mind:'var(--mind)',body:'var(--bodyc)',order:'var(--order)'};
  const tc2={Champion:'var(--order)',Unit:'var(--calm)',Spell:'var(--mind)',Gear:'var(--fury)'};
  function bar(v,m,col){const p=m>0?Math.round(v/m*100):0;return`<div style="display:flex;align-items:center;gap:10px;"><div style="flex:1;height:6px;background:var(--surface3);border-radius:3px;overflow:hidden;"><div style="width:${p}%;height:100%;background:${col};border-radius:3px;"></div></div><span style="font-size:12px;color:var(--text-muted);min-width:24px;text-align:right;">${v}</span></div>`;}
  el.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:2rem;">
      <div class="sb"><div class="sv">${N}</div><div class="sk">Cards</div></div>
      <div class="sb"><div class="sv">${myDecks.length}</div><div class="sk">My Decks</div></div>
      <div class="sb"><div class="sv">${[...new Set(CARDS.map(c=>c.artist).filter(a=>a&&a!=='Unknown'))].length||'—'}</div><div class="sk">Artists</div></div>
      <div class="sb"><div class="sv">${myDecks.reduce((a,d)=>a+d.wins,0)}</div><div class="sk">Total Wins</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:2rem;">
      <div class="dc" style="cursor:default;"><div class="slbl" style="margin-bottom:1rem;">Cards by Domain</div>${N===0?'<p style="color:var(--text-muted);font-size:13px;">No data.</p>':Object.entries(dc).map(([d,n])=>`<div style="margin-bottom:10px;"><div style="margin-bottom:4px;"><span class="pill ${d}">${d[0].toUpperCase()+d.slice(1)}</span></div>${bar(n,N,dc2[d])}</div>`).join('')}</div>
      <div class="dc" style="cursor:default;"><div class="slbl" style="margin-bottom:1rem;">Cards by Type</div>${N===0?'<p style="color:var(--text-muted);font-size:13px;">No data.</p>':Object.entries(tc).map(([t,n])=>`<div style="margin-bottom:10px;"><div style="margin-bottom:4px;font-size:13px;color:var(--text-soft);">${t}</div>${bar(n,N,tc2[t])}</div>`).join('')}</div>
    </div>
    <div class="slbl" style="margin-bottom:1rem;">Deck Performance</div>
    ${dwr.length===0?`<div class="es"><h3>No data yet</h3><p>Create decks and log wins/losses.</p></div>`:
      `<div style="display:flex;flex-direction:column;gap:8px;">${dwr.map(d=>{const w=wr(d);return`<div class="dc" style="cursor:default;padding:.9rem 1.25rem;"><div style="display:flex;align-items:center;gap:12px;"><div style="flex:1;"><div style="font-size:14px;font-weight:500;">${d.name}</div><div style="font-size:12px;color:var(--text-muted);">${d.legend} · ${d.wins}W ${d.losses}L</div></div><div class="${wrc(w)}" style="font-family:'Syne',sans-serif;font-size:18px;font-weight:700;">${w}%</div></div><div style="margin-top:8px;height:4px;background:var(--surface3);border-radius:2px;overflow:hidden;"><div style="width:${w}%;height:100%;background:${w>=55?'var(--calm)':w>=45?'#f5c842':'var(--fury)'};border-radius:2px;"></div></div></div>`;}).join('')}</div>`}`;
}

/* ── INIT ────────────────────────────────────────── */
loadStorage();
['energy','power','might'].forEach(n=>{document.getElementById('rf-'+n).style.cssText='left:0%;width:100%;';});
fetchAllCards();

let _resizeTimer;
window.addEventListener('resize',()=>{clearTimeout(_resizeTimer);_resizeTimer=setTimeout(()=>{if(activeDeckId&&activeDDTab==='edit')renderEditSearch();},150);});

/* ── CARD HOVER ZOOM ─────────────────────────────── */
(function(){
  const preview=document.getElementById('card-hover-preview');
  let _hoverTimeout=null;
  function pos(e){
    const pw=380;
    let x=e.clientX+18,y=e.clientY-160;
    if(x+pw>window.innerWidth-12) x=e.clientX-pw-18;
    y=Math.max(10,Math.min(y,window.innerHeight-380));
    preview.style.left=x+'px';preview.style.top=y+'px';
  }
  document.addEventListener('mouseover',function(e){
    const card=e.target.closest('[data-hover-img]');
    if(!card||!card.dataset.hoverImg){preview.style.display='none';return;}
    clearTimeout(_hoverTimeout);
    _hoverTimeout=setTimeout(()=>{
      const bf=card.dataset.hoverBf==='1';
      preview.innerHTML=`<img src="${card.dataset.hoverImg}" alt="" style="width:100%;height:100%;object-fit:${bf?'cover':'contain'};display:block;">`;
      preview.style.display='block';
      preview.style.aspectRatio=bf?'3.5/2.5':'2.5/3.5';
      pos(e);
    },120);
  });
  document.addEventListener('mousemove',function(e){
    if(preview.style.display!=='none') pos(e);
  });
  document.addEventListener('mouseout',function(e){
    const card=e.target.closest('[data-hover-img]');
    if(card&&!card.contains(e.relatedTarget)){clearTimeout(_hoverTimeout);preview.style.display='none';}
  });
})();

/* ═══════════════════════════════════════════════════════════════
   AUTH + CLOUD SYNC ENGINE
   ═══════════════════════════════════════════════════════════════ */

const API_BASE = window.location.hostname === 'localhost' || window.location.protocol === 'file:'
  ? 'http://localhost:3000'
  : 'https://riftlibrary-api.up.railway.app';

function getToken()  { return authToken || localStorage.getItem('rl_auth_token'); }
function setToken(t) { authToken = t; if(t) localStorage.setItem('rl_auth_token',t); else localStorage.removeItem('rl_auth_token'); }

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
  return data;
}

async function initAuth() {
  const hash = window.location.hash;
  if (hash.includes('auth_token=')) {
    const token = hash.split('auth_token=')[1].split('&')[0];
    setToken(token);
    window.location.hash = '';
  }

  const token = getToken();
  if (!token) { renderAuthNav(null); return; }

  try {
    const user = await api('GET', '/auth/me');
    currentUser = user;
    renderAuthNav(user);
    syncCloudDecks();
  } catch (e) {
    if (e.status === 401) { setToken(null); renderAuthNav(null); }
  }
}

function renderAuthNav(user) {
  var area = document.getElementById('auth-nav-area');
  if (!area) return;
  area.innerHTML = '';
  if (!user) {
    var loginBtn = document.createElement('button');
    loginBtn.className = 'btn btn-g';
    loginBtn.style.cssText = 'font-size:12px;padding:6px 14px;';
    loginBtn.textContent = 'Log in';
    loginBtn.onclick = function(){ openAuthModal('login'); };
    var signupBtn = document.createElement('button');
    signupBtn.className = 'btn btn-p';
    signupBtn.style.cssText = 'font-size:12px;padding:6px 14px;';
    signupBtn.textContent = 'Sign up';
    signupBtn.onclick = function(){ openAuthModal('register'); };
    area.appendChild(loginBtn);
    area.appendChild(signupBtn);
  } else {
    var initials = (user.username || 'U').slice(0,2).toUpperCase();
    var wrap = document.createElement('div');
    wrap.className = 'auth-drop-wrap';
    var pill = document.createElement('div');
    pill.className = 'auth-user-pill';
    pill.onclick = toggleUserDrop;
    if (user.avatar_url) {
      var img = document.createElement('img');
      img.className = 'auth-avatar';
      img.src = user.avatar_url;
      img.alt = '';
      pill.appendChild(img);
    } else {
      var av = document.createElement('div');
      av.className = 'auth-avatar';
      av.style.cssText = 'background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;';
      av.textContent = initials;
      pill.appendChild(av);
    }
    var uname = document.createElement('span');
    uname.className = 'auth-user-name';
    uname.textContent = user.username;
    pill.appendChild(uname);
    wrap.appendChild(pill);
    var drop = document.createElement('div');
    drop.className = 'auth-user-drop';
    drop.id = 'user-drop';
    drop.style.display = 'none';
    var b1 = document.createElement('button');
    b1.textContent = 'My Decks';
    b1.onclick = function(){ goto('decks', null); closeUserDrop(); };
    var b2 = document.createElement('button');
    b2.textContent = '☁ Sync decks';
    b2.onclick = function(){ syncCloudDecks(); closeUserDrop(); };
    var b3 = document.createElement('button');
    b3.textContent = 'Log out';
    b3.style.color = 'var(--fury)';
    b3.onclick = logOut;
    drop.appendChild(b1);
    drop.appendChild(b2);
    drop.appendChild(b3);
    wrap.appendChild(drop);
    area.appendChild(wrap);
  }
}

function toggleUserDrop() {
  const d = document.getElementById('user-drop');
  if (d) d.style.display = d.style.display === 'none' ? '' : 'none';
}
function closeUserDrop() {
  const d = document.getElementById('user-drop');
  if (d) d.style.display = 'none';
}
document.addEventListener('click', function(e) {
  if (!e.target.closest('.auth-drop-wrap')) closeUserDrop();
});

function openAuthModal(tab) {
  document.getElementById('auth-modal').classList.add('open');
  switchAuthTab(tab || 'login');
  clearAuthMessages();
}
function closeAuthModal() {
  document.getElementById('auth-modal').classList.remove('open');
  clearAuthMessages();
}
document.getElementById('auth-modal').addEventListener('click', function(e) {
  if (e.target === this) closeAuthModal();
});

function switchAuthTab(tab) {
  document.getElementById('auth-tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('auth-tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('auth-form-login').style.display    = tab === 'login'    ? '' : 'none';
  document.getElementById('auth-form-register').style.display = tab === 'register' ? '' : 'none';
  clearAuthMessages();
}

function showAuthError(msg)   { const el=document.getElementById('auth-error');   el.textContent=msg; el.classList.add('show'); document.getElementById('auth-success').classList.remove('show'); }
function showAuthSuccess(msg) { const el=document.getElementById('auth-success'); el.textContent=msg; el.classList.add('show'); document.getElementById('auth-error').classList.remove('show'); }
function clearAuthMessages()  { document.getElementById('auth-error').classList.remove('show'); document.getElementById('auth-success').classList.remove('show'); }

async function submitRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!username || !email || !password) { showAuthError('All fields required'); return; }

  const btn = document.querySelector('#auth-form-register .auth-submit');
  btn.textContent = 'Creating account…'; btn.disabled = true;
  try {
    const res = await api('POST', '/auth/register', { username, email, password });
    setToken(res.token);
    currentUser = res.user;
    renderAuthNav(res.user);
    showAuthSuccess('Account created! Welcome, ' + res.user.username + ' 🎉');
    setTimeout(() => { closeAuthModal(); syncCloudDecks(); }, 1200);
  } catch (e) {
    showAuthError(e.message || 'Registration failed');
  } finally { btn.textContent = 'Create account'; btn.disabled = false; }
}

async function submitLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) { showAuthError('Email and password required'); return; }

  const btn = document.querySelector('#auth-form-login .auth-submit');
  btn.textContent = 'Logging in…'; btn.disabled = true;
  try {
    const res = await api('POST', '/auth/login', { email, password });
    setToken(res.token);
    currentUser = res.user;
    renderAuthNav(res.user);
    closeAuthModal();
    toast('Welcome back, ' + res.user.username + '!');
    syncCloudDecks();
  } catch (e) {
    showAuthError(e.message || 'Login failed');
  } finally { btn.textContent = 'Log in'; btn.disabled = false; }
}

function oauthLogin(provider) {
  window.location.href = API_BASE + '/auth/' + provider;
}

async function logOut() {
  try { await api('POST', '/auth/logout'); } catch {}
  setToken(null);
  currentUser = null;
  renderAuthNav(null);
  toast('Logged out');
}

async function syncCloudDecks() {
  if (!currentUser) return;
  try {
    const cloudDecks = await api('GET', '/api/decks');
    const cloudMap = {};
    cloudDecks.forEach(d => { cloudMap[d.id] = d; });
    cloudDecks.forEach(cd => {
      const localIdx = myDecks.findIndex(d => d.id === cd.id || d.cloud_id === cd.id);
      const merged = cloudToLocal(cd);
      if (localIdx >= 0) {
        const localDeck = myDecks[localIdx];
        if (!localDeck.updated_at || new Date(cd.updated_at) > new Date(localDeck.updated_at)) {
          myDecks[localIdx] = merged;
        }
      } else {
        myDecks.unshift(merged);
      }
    });
    const localOnlyDecks = myDecks.filter(d => !d.cloud_id && d.cards && d.cards.length > 0);
    for (const local of localOnlyDecks) {
      try {
        const created = await api('POST', '/api/decks', localToCloud(local));
        const idx = myDecks.findIndex(d => d.id === local.id);
        if (idx >= 0) { myDecks[idx].cloud_id = created.id; myDecks[idx].id = created.id; }
      } catch (e) { console.warn('Failed to push local deck:', e); }
    }
    persist();
    if (document.getElementById('page-decks').classList.contains('active')) renderDecks();
    toast('Decks synced ☁');
  } catch (e) {
    console.warn('Sync failed:', e);
    if (e.status === 401) { setToken(null); currentUser = null; renderAuthNav(null); }
  }
}

function cloudToLocal(cd) {
  return {
    id:           cd.id,
    cloud_id:     cd.id,
    name:         cd.name,
    legend:       cd.legend,
    domains:      cd.domains || [],
    format:       cd.format || 'Constructed',
    wins:         cd.wins || 0,
    losses:       cd.losses || 0,
    desc:         cd.description || '',
    updated_at:   cd.updated_at,
    sideboardNotes: cd.sideboard_notes || '',
    sideboard:    (cd.sideboard || []).map(c => ({ id:c.card_id, n:c.card_name, t:c.card_type, cnt:c.quantity })),
    results:      [],
    cards:        (cd.cards || []).map(c => ({ id:c.card_id, n:c.card_name, t:c.card_type, cnt:c.quantity })),
  };
}

function localToCloud(local) {
  return {
    name:        local.name,
    legend:      local.legend,
    domains:     local.domains || [],
    format:      local.format || 'Constructed',
    description: local.desc || '',
    cards:       (local.cards || []).map(c => ({ card_id:c.id, card_name:c.n, card_type:c.t, quantity:c.cnt })),
    sideboard:   (local.sideboard || []).map(c => ({ card_id:c.id, card_name:c.n, card_type:c.t, quantity:c.cnt })),
    sideboard_notes: local.sideboardNotes || '',
  };
}

async function saveToCloud(deckId) {
  if (!currentUser) return;
  const deck = myDecks.find(d => d.id === deckId);
  if (!deck) return;
  try {
    if (deck.cloud_id) {
      await api('PUT', '/api/decks/' + deck.cloud_id, localToCloud(deck));
    } else {
      const created = await api('POST', '/api/decks', localToCloud(deck));
      deck.cloud_id = created.id;
      deck.id = created.id;
      persist();
    }
  } catch (e) { console.warn('Cloud save failed:', e); }
}

initAuth();
