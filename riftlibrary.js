const LD={'Jinx':['fury','chaos'],'Viktor':['order','mind'],'Ahri':['calm','mind'],'Darius':['fury','body'],'Lee Sin':['calm','body'],'Volibear':['fury','order'],'Miss Fortune':['chaos','body'],"Kai'Sa":['chaos','mind']};
function populateLegendDropdowns(){
  const legends=CARDS.filter(c=>c.type==='Legend'&&!c.name.includes('(')).map(c=>c.name).filter((n,i,a)=>a.indexOf(n)===i).sort();
  legends.forEach(name=>{if(!LD[name]){const card=CARDS.find(c=>c.type==='Legend'&&c.name===name);if(card&&card.doms.length)LD[name]=card.doms;}});
  const mleg=document.getElementById('mleg');
  if(mleg){const v=mleg.value;mleg.innerHTML=legends.map(n=>`<option${n===v?' selected':''}>${n}</option>`).join('');}
  const imleg=document.getElementById('import-mleg');
  if(imleg){const v=imleg.value;imleg.innerHTML=legends.map(n=>`<option${n===v?' selected':''}>${n}</option>`).join('');}
  const dsl=document.getElementById('dsl');
  if(dsl){const v=dsl.value;dsl.innerHTML='<option value="">All legends</option>'+legends.map(n=>`<option${n===v?' selected':''}>${n}</option>`).join('');}
}
let CARDS=[], cardsLoaded=false;
let myDecks=[], nextId=1;
const BANNED_CARDS=new Set(['Called Shot','Draven, Vanquisher','Draven - Vanquisher','Fight or Flight','Scrapheap','Dreaming Tree','The Dreaming Tree','Obelisk of Power',"Reaver's Row"]);
function baseName(n){return(n||'').replace(/\s*\([^)]*\)\s*$/,'').trim();}
let myEvents=JSON.parse(localStorage.getItem('rl_myEvents')||'[]');
let activeEvtTab='all';
function persistMyEvents(){localStorage.setItem('rl_myEvents',JSON.stringify(myEvents));saveEventsToCloud();}
function switchEvtTab(t){activeEvtTab=t;renderEvents();}
function createMyEvent(){
  const name=(document.getElementById('mevt-name')||{}).value||'';
  const date=(document.getElementById('mevt-date')||{}).value||'';
  const time=(document.getElementById('mevt-time')||{}).value||'';
  const loc=(document.getElementById('mevt-loc')||{}).value||'';
  if(!name.trim()||!date){toast('Name and date are required.');return;}
  myEvents.push({id:Date.now(),name:name.trim(),date,time,location:loc.trim(),paidEntry:false,hotelBooked:false,flightBooked:false});
  persistMyEvents();renderEvents();
}
function toggleMyEventProp(id,prop){
  const e=myEvents.find(x=>x.id===id);if(!e)return;
  e[prop]=!e[prop];persistMyEvents();renderEvents();
}
function deleteMyEvent(id){
  myEvents=myEvents.filter(x=>x.id!==id);persistMyEvents();renderEvents();
}
function addRQToMyEvents(idx){
  if(!currentUser){openAuthModal('login');toast('Please log in to save events.');return;}
  const rq=RQ_EVENTS[idx];if(!rq)return;
  if(myEvents.some(e=>e.name===rq.city+' Regional Qualifier')){toast('Already in My Events');return;}
  myEvents.push({id:Date.now(),name:rq.city+' Regional Qualifier',date:rq.sortDate,time:'',location:rq.city+', '+rq.region,paidEntry:false,hotelBooked:false,flightBooked:false});
  persistMyEvents();renderEvents();toast('Added '+rq.city+' RQ to My Events');
}
function fillFromRQ(idx){
  const rq=RQ_EVENTS[idx];if(!rq)return;
  const n=document.getElementById('mevt-name');
  const d=document.getElementById('mevt-date');
  const l=document.getElementById('mevt-loc');
  if(n)n.value=rq.city+' Regional Qualifier';
  if(d)d.value=rq.sortDate;
  if(l)l.value=rq.city+', '+rq.region;
}
let VIEW='cards';
let activeDeckId=null;
let activeDDTab='cards';
let currentUser=null;
let cardsTabView='visual';
let deckSortMode='alpha'; // 'alpha' or 'energy'
let authToken=null;
const AF={doms:new Set()};
const CF={type:'',set:'',rar:'',legend:'',subtype:'',variant:'',doms:new Set(),energy:[0,12],power:[0,4],might:[0,10],showAllVersions:false};
const EF={type:'',dom:'',set:'',subtype:'',variant:'',rar:'',page:1,showAllVersions:false};
function getEditPer(){return 18;}
const EDIT_PER=24;

/* ── ARTICLES ───────────────────────────────────── */
let articlesFilter='all';
let activeArticleId=null;

const SEED_ARTICLES=[
  {id:1,type:'decktech',title:'Placeholder',summary:'Placeholder',author:'Placeholder',date:'2026-04-18',legend:null,tags:[],readTime:0,featured:true,content:'Placeholder'},
  {id:2,type:'article',title:'Placeholder',summary:'Placeholder',author:'Placeholder',date:'2026-04-15',legend:null,tags:[],readTime:0,featured:false,content:'Placeholder'},
  {id:3,type:'decktech',title:'Placeholder',summary:'Placeholder',author:'Placeholder',date:'2026-04-10',legend:null,tags:[],readTime:0,featured:false,content:'Placeholder'},
  {id:4,type:'article',title:'Placeholder',summary:'Placeholder',author:'Placeholder',date:'2026-04-08',legend:null,tags:[],readTime:0,featured:false,content:'Placeholder'},
  {id:5,type:'decktech',title:'Placeholder',summary:'Placeholder',author:'Placeholder',date:'2026-04-05',legend:null,tags:[],readTime:0,featured:false,content:'Placeholder'}
];

function loadArticles(){
  try{
    const stored=localStorage.getItem('rl_articles');
    if(stored) return JSON.parse(stored);
  }catch(e){}
  return [];
}
function saveArticles(arr){localStorage.setItem('rl_articles',JSON.stringify(arr));}
function getAllArticles(){
  const user=loadArticles();
  return [...SEED_ARTICLES,...user].sort((a,b)=>new Date(b.date)-new Date(a.date));
}

function renderArticles(){
  const listEl=document.getElementById('articles-list');
  const detailEl=document.getElementById('articles-detail');
  if(!listEl)return;
  if(activeArticleId!=null){
    listEl.style.display='none';
    detailEl.style.display='';
    renderArticleDetail(activeArticleId);
    return;
  }
  listEl.style.display='';
  detailEl.style.display='none';
  const all=getAllArticles();
  const filtered=articlesFilter==='all'?all:all.filter(a=>a.type===articlesFilter);
  const featured=filtered.find(a=>a.featured)||filtered[0];
  const rest=filtered.filter(a=>a!==featured);

  function badgeHtml(type){
    return type==='decktech'
      ?'<span class="art-badge art-badge-decktech">⚔ Deck Tech</span>'
      :'<span class="art-badge art-badge-article">📝 Article</span>';
  }
  function metaHtml(a){
    return `<span>${a.author}</span><span class="art-dot">·</span><span>${fmtDate(a.date)}</span><span class="art-dot">·</span><span>${a.readTime} min read</span>`;
  }
  function fmtDate(d){
    const dt=new Date(d);return dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  }
  function gradientBg(a){
    const domColors={calm:'rgba(61,214,163,0.25)',mind:'rgba(90,180,245,0.25)',fury:'rgba(255,107,74,0.25)',chaos:'rgba(224,90,173,0.25)',order:'rgba(245,212,66,0.25)',body:'rgba(245,146,42,0.25)'};
    const tag=(a.tags&&a.tags[0])||'';
    const c1=domColors[tag]||'rgba(139,127,255,0.25)';
    const c2=domColors[a.tags&&a.tags[1]]||'rgba(139,127,255,0.08)';
    return `background:linear-gradient(135deg,${c1} 0%,${c2} 60%,rgba(13,13,18,0.1) 100%);`;
  }

  let html=`<div class="articles-header">
    <div class="ph"><h1>Articles & Deck Techs</h1><p>Strategy guides, deck breakdowns and game insights from the community</p></div>
    <div class="art-top-bar">
      <div class="art-filter-bar">
        <button class="art-filter-btn${articlesFilter==='all'?' active':''}" onclick="setArtFilter('all')">All</button>
        <button class="art-filter-btn${articlesFilter==='article'?' active':''}" onclick="setArtFilter('article')">Articles</button>
        <button class="art-filter-btn${articlesFilter==='decktech'?' active':''}" onclick="setArtFilter('decktech')">Deck Techs</button>
      </div>
      <button class="btn btn-p" onclick="openArticleSubmit()">+ Submit</button>
    </div>
  </div>`;

  if(featured){
    html+=`<div class="art-featured" onclick="openArticle(${featured.id})">
      <div class="art-featured-img" style="${gradientBg(featured)}">
        <div class="art-fi-inner">
          <div class="art-fi-icon">${featured.type==='decktech'?'⚔':'📝'}</div>
          ${featured.legend?`<div class="art-fi-legend">${featured.legend}</div>`:''}
        </div>
      </div>
      <div class="art-featured-body">
        <div style="display:flex;gap:8px;align-items:center;">${badgeHtml(featured.type)}<span class="art-featured-tag">Featured</span></div>
        <div class="art-featured-title">${featured.title}</div>
        <div class="art-featured-summary">${featured.summary}</div>
        <div class="art-featured-meta">${metaHtml(featured)}</div>
      </div>
    </div>`;
  }

  if(rest.length){
    html+=`<div class="art-grid">`;
    rest.forEach(a=>{
      html+=`<div class="art-card" onclick="openArticle(${a.id})">
        <div class="art-card-img" style="${gradientBg(a)}">
          <div class="art-ci-inner">
            <div class="art-ci-icon">${a.type==='decktech'?'⚔':'📝'}</div>
            ${a.legend?`<div class="art-ci-legend">${a.legend}</div>`:''}
          </div>
        </div>
        <div class="art-card-body">
          <div>${badgeHtml(a.type)}</div>
          <div class="art-card-title">${a.title}</div>
          <div class="art-card-summary">${a.summary}</div>
          <div class="art-card-meta">${metaHtml(a)}</div>
        </div>
      </div>`;
    });
    html+=`</div>`;
  } else if(!featured){
    html+=`<div class="es" style="margin-top:3rem;"><h3>No ${articlesFilter==='all'?'posts':articlesFilter+'s'} yet</h3><p>Be the first to submit one!</p></div>`;
  }

  listEl.innerHTML=html;
}

function renderArticleDetail(id){
  const all=getAllArticles();
  const a=all.find(x=>x.id===id);
  const detailEl=document.getElementById('articles-detail');
  if(!a||!detailEl)return;
  const domColors={calm:'rgba(61,214,163,0.2)',mind:'rgba(90,180,245,0.2)',fury:'rgba(255,107,74,0.2)',chaos:'rgba(224,90,173,0.2)',order:'rgba(245,212,66,0.2)',body:'rgba(245,146,42,0.2)'};
  const tag=(a.tags&&a.tags[0])||'';
  const c1=domColors[tag]||'rgba(139,127,255,0.2)';
  const typeBadge=a.type==='decktech'
    ?'<span class="art-badge art-badge-decktech">⚔ Deck Tech</span>'
    :'<span class="art-badge art-badge-article">📝 Article</span>';
  const fmtDate=d=>{const dt=new Date(d);return dt.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});};
  // Simple markdown: **bold**, newlines → paragraphs
  const bodyHtml=a.content.split('\n\n').map(para=>{
    let p=para.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
    if(p.startsWith('**')&&p.endsWith('**')) return`<h3 class="art-body-h3">${p.replace(/\*\*/g,'')}</h3>`;
    if(p.startsWith('<strong>')&&para.indexOf('\n\n')<0&&p.length<80) return`<h3 class="art-body-h3">${p}</h3>`;
    return`<p class="art-body-p">${p}</p>`;
  }).join('');

  detailEl.innerHTML=`
    <button class="bb" onclick="closeArticle()">← Back to articles</button>
    <div class="art-detail">
      <div class="art-detail-hero" style="background:linear-gradient(135deg,${c1} 0%,rgba(13,13,18,0) 70%);">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">${typeBadge}</div>
        <h1 class="art-detail-title">${a.title}</h1>
        <div class="art-detail-meta">
          <span class="art-detail-author">${a.author}</span>
          <span class="art-dot">·</span>
          <span>${fmtDate(a.date)}</span>
          <span class="art-dot">·</span>
          <span>${a.readTime} min read</span>
          ${a.legend?`<span class="art-dot">·</span><span class="art-detail-legend">${a.legend}</span>`:''}
        </div>
        <p class="art-detail-summary">${a.summary}</p>
      </div>
      <div class="art-detail-body">${bodyHtml}</div>
    </div>`;
}

function openArticle(id){
  activeArticleId=id;
  renderArticles();
  window.scrollTo({top:0,behavior:'smooth'});
}
function closeArticle(){
  activeArticleId=null;
  renderArticles();
  window.scrollTo({top:0,behavior:'smooth'});
}
function setArtFilter(f){
  articlesFilter=f;
  activeArticleId=null;
  renderArticles();
}

function openArticleSubmit(){
  const mo=document.getElementById('art-submit-modal');
  if(mo){mo.classList.add('open');return;}
  const div=document.createElement('div');
  div.id='art-submit-modal';
  div.className='card-mo open';
  div.innerHTML=`<div class="card-mbox" style="max-width:560px;padding:2rem;" onclick="event.stopPropagation()">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;">
      <div class="cm-name">Submit a Post</div>
      <button onclick="closeArticleSubmit()" style="background:none;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;">✕</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <label class="slbl">Type</label>
        <select id="as-type" style="width:100%;"><option value="article">Article</option><option value="decktech">Deck Tech</option></select>
      </div>
      <div>
        <label class="slbl">Title</label>
        <input type="text" id="as-title" placeholder="Enter title…" style="width:100%;padding:9px 12px;">
      </div>
      <div>
        <label class="slbl">Summary (1-2 sentences)</label>
        <input type="text" id="as-summary" placeholder="Brief description…" style="width:100%;padding:9px 12px;">
      </div>
      <div>
        <label class="slbl">Legend (Deck Techs only — optional)</label>
        <input type="text" id="as-legend" placeholder="e.g. Ahri" style="width:100%;padding:9px 12px;">
      </div>
      <div>
        <label class="slbl">Domain tags (comma separated, optional)</label>
        <input type="text" id="as-tags" placeholder="e.g. calm, mind" style="width:100%;padding:9px 12px;">
      </div>
      <div>
        <label class="slbl">Your name</label>
        <input type="text" id="as-author" placeholder="Display name…" style="width:100%;padding:9px 12px;">
      </div>
      <div>
        <label class="slbl">Content</label>
        <textarea id="as-content" placeholder="Write your article or deck tech here. Use **bold text** for headers." style="width:100%;min-height:160px;background:var(--bg);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;padding:10px 12px;resize:vertical;outline:none;line-height:1.6;"></textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">
        <button class="btn" onclick="closeArticleSubmit()">Cancel</button>
        <button class="btn btn-p" onclick="submitArticle()">Publish</button>
      </div>
    </div>
  </div>`;
  div.onclick=closeArticleSubmit;
  document.body.appendChild(div);
}
function closeArticleSubmit(){
  const mo=document.getElementById('art-submit-modal');
  if(mo)mo.classList.remove('open');
}
function submitArticle(){
  const title=document.getElementById('as-title').value.trim();
  const summary=document.getElementById('as-summary').value.trim();
  const content=document.getElementById('as-content').value.trim();
  const author=document.getElementById('as-author').value.trim()||'Anonymous';
  if(!title||!summary||!content){toast('Please fill in title, summary and content');return;}
  const type=document.getElementById('as-type').value;
  const legend=document.getElementById('as-legend').value.trim();
  const tagsRaw=document.getElementById('as-tags').value.trim();
  const tags=tagsRaw?tagsRaw.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean):[];
  const existing=loadArticles();
  const allIds=[...SEED_ARTICLES,...existing].map(a=>a.id);
  const newId=Math.max(0,...allIds)+1;
  const words=content.split(/\s+/).length;
  const readTime=Math.max(1,Math.round(words/200));
  const newArticle={id:newId,type,title,summary,author,date:new Date().toISOString().split('T')[0],legend:legend||null,tags,readTime,featured:false,content};
  existing.push(newArticle);
  saveArticles(existing);
  closeArticleSubmit();
  renderArticles();
  toast('Post published!');
}

/* storage */
function loadStorage(){
  try{
    const m=localStorage.getItem('rl_decks');if(m)myDecks=JSON.parse(m);
    const n=localStorage.getItem('rl_nid');if(n)nextId=parseInt(n);
    if(!myDecks.length)myDecks=[];
  }catch(e){myDecks=[];}
}
function persist(){
  if(activeDeckId){const d=myDecks.find(x=>String(x.id)===String(activeDeckId));if(d)d.updated_at=new Date().toISOString();}
  try{localStorage.setItem('rl_decks',JSON.stringify(myDecks));localStorage.setItem('rl_nid',String(nextId));}catch(e){}
}
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
    isSignature:meta.signature||false,
    isAltArt:meta.alternate_art||false,
    isOvernumbered:meta.overnumbered||false,
    variant:(meta.alternate_art?'Alt Art':meta.overnumbered?'Overnumbered':(cls.rarity==='Promo'?'Promo':'Standard')),
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
  ['dw-set','dw-rar'].forEach(id=>document.getElementById(id).style.display=v==='cards'?'':'none');
  const typeRow=document.querySelector('.cs-type-row');if(typeRow)typeRow.style.display=v==='cards'?'':'none';
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
  if(p==='decks'){const dd=document.getElementById('dd');const dl=document.getElementById('dl');if(dd&&dd.style.display!=='none'){dd.style.display='none';if(dl)dl.style.display='';activeDeckId=null;activeDDTab='cards';}renderDecks();}
  if(p==='search'&&cardsLoaded)renderCards();
  if(p==='statistics')renderStatistics();
  if(p==='events')renderEvents();
  if(p==='collection')renderCollection();
  if(p==='play'&&typeof populateDeckSelectors==='function')populateDeckSelectors();
  if(p==='articles')renderArticles();
}

/* ── DECKS ──────────────────────────────────────── */
function renderDecks(){
  const g=document.getElementById('dg');
  const q=document.getElementById('ds').value.toLowerCase();
  const fl=document.getElementById('dsl').value;
  const fd=document.getElementById('dsd').value.toLowerCase();
  const list=myDecks.filter(d=>{
    if(q&&!d.name.toLowerCase().includes(q)&&!d.legend.toLowerCase().includes(q))return false;
    if(fl&&d.legend!==fl)return false;
    if(fd&&!(d.domains||[]).includes(fd))return false;
    return true;
  });
  if(!list.length){g.innerHTML=`<div class="es" style="grid-column:1/-1;"><h3>No decks yet</h3><p>Create your first deck above.</p></div>`;return;}
  g.innerHTML=list.map(d=>{
    const totalC=(d.cards||[]).reduce((a,c)=>a+c.cnt,0)||0;
    const w=wr(d);
    const dcLegEntry=(d.cards||[]).find(c=>c.t==='Legend');
    const dcLegFull=dcLegEntry?CARDS.find(x=>x.id===dcLegEntry.id):null;
    const dcImg=dcLegFull?dcLegFull.imageUrl:'';
    const dcAvatar=dcImg
      ?`<div class="dc-avatar"><img src="${dcImg}" alt="${d.legend}"></div>`
      :`<div class="dc-avatar dc-avatar-empty"></div>`;
    return `<div class="dc">
      <div class="dt">
        <div style="display:flex;align-items:center;gap:10px;">
          ${dcAvatar}
          <div>
            <div class="dn">${d.name}</div>
            <div class="dl">${d.legend}</div>
          </div>
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
        <button class="btn btn-sm btn-g" onclick="openDD('${d.id}')">View</button>
        <button class="btn btn-sm btn-d" onclick="delDeck('${d.id}')">Delete</button>
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
  const d=myDecks.find(x=>String(x.id)===String(id));if(!d)return;
  activeDeckId=d.id;
  if(!d.sideboard) d.sideboard=[];
  if(!d.results)   d.results=[];
  document.getElementById('dl').style.display='none';
  document.getElementById('dd').style.display='block';
  renderDeckDetail();
}

function buildDeckCurves(d,large){
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
    const maxV=Math.max(1,...data);const H=large?80:44;
    return data.map((v,i)=>{
      const h=v>0?Math.max(3,Math.round(v/maxV*H)):2;
      const op=v>0?1:0.18;
      const tip=v>0?`${v} card${v===1?'':'s'}`:'0 cards';
      return`<div class="mc-col"><div class="mc-bar" style="height:${h}px;background:${color};opacity:${op};" title="${tip}"></div><div class="mc-lbl">${labels[i]}</div></div>`;
    }).join('');
  }
  const eLabels=['0','1','2','3','4','5','6','7','8+'];
  const pLabels=['0','1','2','3','4'];
  return`<div class="deck-curves${large?' deck-curves-lg':''}">
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
  const bfOpts=(d.battlefields||[]).filter(Boolean).map(b=>{const f=CARDS.find(x=>x.id===b.id);return`<option value="${b.id}">${f?f.name:b.n}</option>`;}).join('');
  const legendEntry=(d.cards||[]).find(c=>c.t==='Legend');
  const legendFull=legendEntry?CARDS.find(x=>x.id===legendEntry.id):null;
  const legendImg=legendFull?legendFull.imageUrl:'';
  const avatarHtml=legendImg
    ?`<div class="legend-avatar"><img src="${legendImg}" alt="${d.legend}"></div>`
    :`<div class="legend-avatar legend-avatar-empty">🦸</div>`;

  document.getElementById('ddc').innerHTML=`
    <div class="deck-header">
      <div class="deck-header-left">
        ${avatarHtml}
        <div class="deck-header-title-col">
          <div class="dtitle" id="deck-title-display" onclick="startEditDeckTitle(${d.id})" title="Click to edit">${d.name}<span class="dtitle-edit-icon">✎</span></div>
          <div class="dmeta">
            <span>${d.legend}</span><span>·</span>
            <div class="dr" style="margin:0;">${pills(d.domains)}</div>
            <span>·</span><span>${d.format}</span>
          </div>
        </div>
      </div>
      <div class="deck-header-right">
        <div id="deck-curves-panel">${buildDeckCurves(d)}</div>
        <div class="deck-header-count">
          <span class="dt-label">Deck</span><span class="dt-count" id="deck-count-badge">${totalCards} / 40 cards</span>
        </div>
      </div>
    </div>
    <div class="hero-zone-bar" id="hero-zone-bar" style="display:none;"></div>

    <!-- TABS -->
    <div class="dd-tabs">
      <button class="dd-tab${activeDDTab==='cards'?' active':''}" onclick="switchDDTab('cards')">
        <svg viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="9" height="12" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 5h3M5 8h3M5 11h1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><rect x="6" y="1" width="9" height="12" rx="1.5" stroke="currentColor" stroke-width="1.4"/></svg>
        Decklist
      </button>
      <button class="dd-tab${activeDDTab==='edit'?' active':''}" onclick="switchDDTab('edit')">
        <svg viewBox="0 0 16 16" fill="none"><path d="M11 2.5l2.5 2.5-7 7H4V9.5l7-7z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9.5 4l2.5 2.5" stroke="currentColor" stroke-width="1.2"/></svg>
        Edit
      </button>
      <button class="dd-tab${activeDDTab==='stats'?' active':''}" onclick="switchDDTab('stats')">
        <svg viewBox="0 0 16 16" fill="none"><rect x="1" y="9" width="3" height="6" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="6" y="5" width="3" height="10" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="11" y="2" width="3" height="13" rx="1" stroke="currentColor" stroke-width="1.4"/></svg>
        Decklist Data
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
      <div class="cards-view-bar">
        <button class="cvt-btn${cardsTabView==='visual'?' on':''}" onclick="setCardsView('visual')">⊞ Visual</button>
        <button class="cvt-btn${cardsTabView==='text'?' on':''}" onclick="setCardsView('text')">☰ List</button>
        <button class="cvt-btn${cardsTabView==='gallery'?' on':''}" onclick="setCardsView('gallery')">⊟ Gallery</button>
        <div class="cvt-bar-right">
          <button class="cvt-icon-btn" onclick="copyDeckLink()" title="Copy link to deck">🔗 Copy Link</button>
          <div style="position:relative;">
            <button class="cvt-icon-btn" onclick="toggleExportMenu(this)" title="Export deck">↓ Export ▾</button>
            <div class="export-drop" id="export-drop">
              <button class="export-opt" onclick="exportDeck('tts');closeExportMenu()">🎲 TTS Code</button>
              <button class="export-opt" onclick="exportDeck('text');closeExportMenu()">📄 Text List</button>
              <button class="export-opt" onclick="exportDeck('pdf');closeExportMenu()">🖨️ Proxy PDF</button>
              <button class="export-opt" onclick="exportDeck('image');closeExportMenu()">🖼️ Deck Image</button>
              <button class="export-opt" onclick="exportDeck('reg');closeExportMenu()">📋 Registration Sheet</button>
            </div>
          </div>
        </div>
      </div>
      <div id="cards-text-view" style="${cardsTabView==='text'?'':'display:none'}">
        ${buildCardsListView(d)}
      </div>
      <div id="cards-visual-view" style="${cardsTabView==='visual'?'':'display:none'}"></div>
      <div id="cards-gallery-view" style="${cardsTabView==='gallery'?'':'display:none'}"></div>
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
          <label>Turn order</label>
          <select id="r-turn"><option value="first">Went First</option><option value="second">Went Second</option></select>
        </div>
        <div>
          <label>Battlefield</label>
          <select id="r-bf"><option value="">— any —</option>${bfOpts}</select>
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
  if(activeDDTab==='cards'&&cardsTabView==='visual'){
    setTimeout(()=>renderEditPreview(document.getElementById('cards-visual-view')),10);
  }
  if(activeDDTab==='cards'&&cardsTabView==='gallery'){
    setTimeout(()=>{const gv=document.getElementById('cards-gallery-view');if(gv)gv.innerHTML=buildCardsGalleryView(d);},10);
  }
  if(activeDDTab==='stats') setTimeout(calcHG,10);
}

function buildCardsListView(d){
  const cards=d.cards||[];
  const legendCards=cards.filter(c=>c.t==='Legend');
  const bfCards=(d.battlefields||[]).filter(Boolean);
  const runes=d.runes||[];
  const champion=d.champion||null;
  const mainDeck=cards.filter(c=>c.t!=='Legend');
  const sb=d.sideboard||[];
  const TYPE_ORDER=['Unit','Spell','Gear'];
  function tsort(a,b){const ai=TYPE_ORDER.indexOf(a.t),bi=TYPE_ORDER.indexOf(b.t);return(ai<0?99:ai)-(bi<0?99:bi)||a.n.localeCompare(b.n);}
  function esort(a,b){const ca=CARDS.find(x=>x.id===a.id);const cb=CARDS.find(x=>x.id===b.id);const ea=ca&&ca.cost!=null?ca.cost:999;const eb=cb&&cb.cost!=null?cb.cost:999;return ea!==eb?ea-eb:a.n.localeCompare(b.n);}
  const sortedMain=mainDeck.slice().sort(deckSortMode==='energy'?esort:tsort);
  const totalMain=mainDeck.reduce((a,c)=>a+c.cnt,0);

  function thumb(url){
    return url?`<img class="dl-thumb" src="${url}" alt="" loading="lazy">`:`<div class="dl-thumb dl-no-thumb"></div>`;
  }
  function statBubble(val,cls){
    return val!=null?`<span class="dl-bubble ${cls}">${val}</span>`:'';
  }
  function cardRow(id,name,cnt){
    const full=CARDS.find(x=>x.id===id);
    const img=full?full.imageUrl:'';
    const cost=full&&full.cost!=null?statBubble(full.cost,'dl-cost-bubble'):'';
    const power=full&&full.power!=null?statBubble(full.power,'dl-pow-bubble'):'';
    return `<div class="dl-row">`
      +`<span class="dl-cnt">×${cnt}</span>`
      +thumb(img)
      +`<span class="dl-name">${name}</span>`
      +`<span class="dl-bubbles">${cost}${power}</span>`
      +`</div>`;
  }
  function section(title,tally,body){
    const t=tally!=null?`<span class="dl-tally">${tally}</span>`:'';
    return `<div class="dl-section"><div class="dl-hdr">${title}${t}</div>${body}</div>`;
  }
  function twoCol(rows){
    const half=Math.ceil(rows.length/2);
    return `<div class="dl-2col"><div class="dl-col">${rows.slice(0,half).join('')}</div><div class="dl-col">${rows.slice(half).join('')}</div></div>`;
  }

  // LEGEND
  const legBody=legendCards.length
    ?legendCards.map(c=>cardRow(c.id,c.n,c.cnt)).join('')
    :`<div class="dl-empty">None</div>`;

  // CHAMPION
  const champBody=champion
    ?cardRow(champion.id,champion.n,1)
    :`<div class="dl-empty">None</div>`;

  // BATTLEFIELDS
  const bfBody=bfCards.length
    ?bfCards.map(b=>cardRow(b.id,b.n,1)).join('')
    :`<div class="dl-empty">None</div>`;

  // MAIN DECK — sorted deck only (champion has its own section)
  const mainRows=sortedMain.map(c=>cardRow(c.id,c.n,c.cnt));
  const mainBody=mainRows.length?twoCol(mainRows):`<div class="dl-empty">No cards yet — use the Edit tab.</div>`;

  // RUNES — grouped by unique card
  let runeBody='<div class="dl-empty">None</div>';
  if(runes.length){
    const rg={};
    runes.forEach(r=>{if(!rg[r.id]){rg[r.id]={id:r.id,n:r.n,cnt:0};}rg[r.id].cnt++;});
    runeBody=Object.values(rg).map(r=>cardRow(r.id,r.n,r.cnt)).join('');
  }

  // SIDEBOARD
  const sbTotal=sb.reduce((a,c)=>a+c.cnt,0);
  const sbBody=sb.length
    ?twoCol(sb.slice().sort((a,b)=>a.n.localeCompare(b.n)).map(c=>cardRow(c.id,c.n,c.cnt)))
    :`<div class="dl-empty">None</div>`;

  return `<div class="deck-list-view">`
    +section('LEGEND',null,legBody)
    +section('CHAMPION',null,champBody)
    +section('BATTLEFIELDS',`${bfCards.length}/3`,bfBody)
    +section('MAIN DECK',`${totalMain}/40`,mainBody)
    +section('RUNES',`${runes.length}/12`,runeBody)
    +section('SIDEBOARD',`${sbTotal}/8`,sbBody)
    +`</div>`;
}

function switchDDTab(tab){
  if(tab!=='edit'){EF.type='';EF.dom='';EF.set='';EF.subtype='';EF.variant='';EF.rar='';EF.page=1;EF.showAllVersions=false;const hzb=document.getElementById('hero-zone-bar');if(hzb)hzb.innerHTML='';}
  activeDDTab=tab;
  renderDeckDetail();
  if(tab==='edit'){setTimeout(()=>{renderEditSearch();renderEditPreview();},10);}
  if(tab==='cards'&&cardsTabView==='visual'){setTimeout(()=>{renderEditPreview(document.getElementById('cards-visual-view'));},10);}
  if(tab==='cards'&&cardsTabView==='gallery'){setTimeout(()=>{const gv=document.getElementById('cards-gallery-view');const d2=myDecks.find(x=>x.id===activeDeckId);if(gv&&d2)gv.innerHTML=buildCardsGalleryView(d2);},10);}
  if(tab==='stats'){setTimeout(calcHG,20);}
}
function buildCardsGalleryView(d){
  const d2=myDecks.find(x=>x.id===activeDeckId);if(!d2)return'';
  function gcards(entries,isBF){
    return entries.map(entry=>{
      const full=CARDS.find(c=>c.id===entry.id);
      const img=full?full.imageUrl:'';
      const si=(entry.id||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const tiles=[];
      for(let i=0;i<(entry.cnt||1);i++){
        tiles.push(`<div class="gallery-card${isBF?' gallery-card-bf':''}" onclick="openCardModal('${si}')" title="${entry.n}">
          ${img?`<img src="${img}" alt="${entry.n}" loading="lazy">`:`<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:10px;color:var(--text-muted);padding:4px;text-align:center;">${entry.n}</div>`}
        </div>`);
      }
      return tiles.join('');
    }).join('');
  }
  function section(label,html,rawWrap){
    const inner=rawWrap?html:`<div class="cards-gallery-view">${html}</div>`;
    return`<div class="gallery-section"><div class="gallery-section-hdr">${label}</div>${inner}</div>`;
  }
  const legend=d2.cards?d2.cards.filter(c=>c.t==='Legend'):[];
  const champion=d2.champion?[{...d2.champion,cnt:1}]:[];
  const mainDeck=d2.cards?d2.cards.filter(c=>c.t!=='Legend'):[];
  const runes=d2.runes||[];
  const bfs=d2.battlefields?d2.battlefields.filter(Boolean):[];
  const sb=d2.sideboard||[];
  let html='';
  if(legend.length) html+=section('Legend',gcards(legend,false));
  if(champion.length) html+=section('Champion',gcards(champion,false));
  if(bfs.length) html+=section('Battlefield',`<div class="cards-gallery-view-bf">${gcards(bfs,true)}</div>`,true);
  if(mainDeck.length) html+=section('Main Deck',gcards(mainDeck,false));
  if(runes.length) html+=section('Runes',gcards(runes,false));
  if(sb.length) html+=section('Sideboard',gcards(sb,false));
  if(!html) return'<div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:13px;">No cards in deck yet.</div>';
  return`<div class="gallery-all-sections">${html}</div>`;
}
function toggleDeckSort(){
  deckSortMode=deckSortMode==='alpha'?'energy':'alpha';
  // Update all sort toggle buttons
  document.querySelectorAll('.sort-tog-btn').forEach(b=>{
    b.textContent=deckSortMode==='energy'?'⚡ Energy':'🔤 Alpha';
    b.classList.toggle('on',deckSortMode==='energy');
  });
  // Re-render both views
  const tv=document.getElementById('cards-text-view');
  if(tv&&tv.style.display!=='none'){const d2=myDecks.find(x=>x.id===activeDeckId);if(d2)tv.innerHTML=buildCardsListView(d2);}
  renderEditPreview();
  const vv=document.getElementById('cards-visual-view');
  if(vv&&vv.style.display!=='none') renderEditPreview(vv);
}
function setCardsView(mode){
  cardsTabView=mode;
  const tv=document.getElementById('cards-text-view');
  const vv=document.getElementById('cards-visual-view');
  const gv=document.getElementById('cards-gallery-view');
  const btns=document.querySelectorAll('.cvt-btn');
  if(tv) tv.style.display=mode==='text'?'':'none';
  if(vv) vv.style.display=mode==='visual'?'':'none';
  if(gv){
    gv.style.display=mode==='gallery'?'':'none';
    if(mode==='gallery'){const d2=myDecks.find(x=>x.id===activeDeckId);if(d2)gv.innerHTML=buildCardsGalleryView(d2);}
  }
  btns.forEach(b=>{
    const t=b.textContent.trim();
    b.classList.toggle('on',(mode==='text'&&t.startsWith('☰'))||(mode==='visual'&&t.startsWith('⊞'))||(mode==='gallery'&&t.startsWith('⊟')));
  });
  if(mode==='visual'&&vv) renderEditPreview(vv);
}

/* ── CARDS TAB helpers ───────────────────────────── */
function hgProb(N,K,n,k){
  function lf(x){let s=0;for(let i=2;i<=x;i++)s+=Math.log(i);return s;}
  function lc(a,b){if(b<0||b>a)return -Infinity;return lf(a)-lf(b)-lf(a-b);}
  return Math.exp(lc(K,k)+lc(N-K,n-k)-lc(N,n));
}
function calcHG(){
  const N=parseInt(document.getElementById('hg-n')||{value:'40'})&&parseInt(document.getElementById('hg-n').value)||40;
  const K=parseInt(document.getElementById('hg-k').value)||0;
  const n=parseInt(document.getElementById('hg-n2').value)||4;
  const k=parseInt(document.getElementById('hg-k2').value)||1;
  const res=document.getElementById('hg-result');if(!res)return;
  if(K>N||k>Math.min(K,n)){res.innerHTML='<span style="color:var(--text-muted);font-size:12px;">Invalid inputs</span>';return;}
  let pExact=hgProb(N,K,n,k);
  let pLess=0;for(let i=0;i<k;i++)pLess+=hgProb(N,K,n,i);
  let pAtLeast=1-pLess;
  function pct(v){return(Math.min(1,Math.max(0,v))*100).toFixed(1)+'%';}
  res.innerHTML=
    '<div class="hg-prob"><div class="hg-prob-val">'+pct(pLess)+'</div><div class="hg-prob-lbl">Less than '+k+'</div></div>'+
    '<div class="hg-prob"><div class="hg-prob-val">'+pct(pExact)+'</div><div class="hg-prob-lbl">Exactly '+k+'</div></div>'+
    '<div class="hg-prob"><div class="hg-prob-val">'+pct(pAtLeast)+'</div><div class="hg-prob-lbl">'+k+' or more</div></div>';
}
function buildStatsPanel(d){
  const cards=d.cards||[];
  const total=cards.reduce((a,c)=>a+c.cnt,0);
  if(!total) return '<p style="color:var(--text-muted);font-size:13px;padding:1rem 0;">No cards in deck yet.</p>';

  let totalCost=0,costCnt=0,totalPow=0,powCnt=0,totalMight=0,mightCnt=0;
  let actions=0,reactions=0,units=0,spells=0,gear=0,hidden=0,nonblocking=0,fuses=0;
  const byType={};const kwFreq={};
  cards.forEach(entry=>{
    const t=entry.t||'Unknown';
    byType[t]=(byType[t]||0)+entry.cnt;
    const card=CARDS.find(c=>c.id===entry.id);
    if(!card)return;
    if(card.cost!=null){totalCost+=card.cost*entry.cnt;costCnt+=entry.cnt;}
    if(card.power!=null){totalPow+=card.power*entry.cnt;powCnt+=entry.cnt;}
    if(card.might!=null){totalMight+=card.might*entry.cnt;mightCnt+=entry.cnt;}
    const txt=(card.txt||'').toUpperCase();
    if(txt.includes('ACTION'))actions+=entry.cnt;
    if(txt.includes('REACTION'))reactions+=entry.cnt;
    if(txt.includes('HIDDEN'))hidden+=entry.cnt;
    if(txt.includes('NONBLOCKING')||txt.includes('NON-BLOCKING'))nonblocking+=entry.cnt;
    if(txt.includes('FUSE'))fuses+=entry.cnt;
    if(t==='Unit')units+=entry.cnt;
    if(t==='Spell')spells+=entry.cnt;
    if(t==='Gear')gear+=entry.cnt;
    const kwRe=/\b(GUARD|STEALTH|OVERWHELM|SHIELD|TRANSFORM|RECKLESS|RALLY|INSPIRE)\b/g;
    let m;while((m=kwRe.exec(txt))!==null)kwFreq[m[1]]=(kwFreq[m[1]]||0)+entry.cnt;
  });
  const avgCost=costCnt?+(totalCost/costCnt).toFixed(2):0;
  const avgPow=powCnt?+(totalPow/powCnt).toFixed(2):0;
  const avgMight=mightCnt?+(totalMight/mightCnt).toFixed(2):0;
  const winsN=d.wins||0,lossesN=d.losses||0,total_games=winsN+lossesN;
  const wrN=total_games>0?Math.round(winsN/total_games*100):0;
  const typeColors={Champion:'var(--order)',Unit:'var(--calm)',Spell:'var(--mind)',Gear:'var(--fury)',Legend:'var(--chaos)',Unknown:'var(--text-muted)'};

  let html='';
  html+='<div class="slbl" style="margin-bottom:10px;">Totals</div>';
  html+='<div class="stat-grid">';
  html+='<div class="stat-card"><div class="stat-num">'+total+'</div><div class="stat-lbl">In Deck</div></div>';
  html+='<div class="stat-card"><div class="stat-num">'+(cards.length)+'</div><div class="stat-lbl">Unique Cards</div></div>';
  html+='<div class="stat-card"><div class="stat-num '+wrc(wrN)+'">'+wrN+'%</div><div class="stat-lbl">Win Rate</div></div>';
  html+='<div class="stat-card"><div class="stat-num">'+winsN+'W/'+lossesN+'L</div><div class="stat-lbl">Record</div></div>';
  html+='</div>';
  html+='<div class="slbl" style="margin-bottom:10px;">Averages</div>';
  html+='<div class="stat-grid-sm">';
  html+='<div class="stat-card-sm"><div class="stat-num-sm">'+avgCost+'</div><div class="stat-lbl-sm">Avg Energy</div></div>';
  html+='<div class="stat-card-sm"><div class="stat-num-sm">'+avgPow+'</div><div class="stat-lbl-sm">Avg Power</div></div>';
  html+='<div class="stat-card-sm"><div class="stat-num-sm">'+avgMight+'</div><div class="stat-lbl-sm">Avg Assault</div></div>';
  html+='</div>';
  html+='<div class="slbl" style="margin-bottom:10px;">Breakdown</div>';
  html+='<div class="stat-grid-sm">';
  if(units)html+='<div class="stat-card-sm"><div class="stat-num-sm" style="color:var(--calm);">'+units+'</div><div class="stat-lbl-sm">Units</div></div>';
  if(spells)html+='<div class="stat-card-sm"><div class="stat-num-sm" style="color:var(--mind);">'+spells+'</div><div class="stat-lbl-sm">Spells</div></div>';
  if(gear)html+='<div class="stat-card-sm"><div class="stat-num-sm" style="color:var(--fury);">'+gear+'</div><div class="stat-lbl-sm">Gear</div></div>';
  if(nonblocking)html+='<div class="stat-card-sm"><div class="stat-num-sm">'+nonblocking+'</div><div class="stat-lbl-sm">Nonblocking</div></div>';
  if(fuses)html+='<div class="stat-card-sm"><div class="stat-num-sm">'+fuses+'</div><div class="stat-lbl-sm">Fuses</div></div>';
  html+='</div>';
  if(actions||reactions||hidden){
    html+='<div class="slbl" style="margin:1rem 0 10px;">Card Speeds</div>';
    if(actions){const p=Math.round(actions/total*100);html+='<div class="dist-row"><span class="dist-label">Actions</span><div class="dist-bar-wrap"><div class="dist-bar-fill" style="width:'+p+'%;background:var(--bodyc);"></div></div><span class="dist-count">'+actions+'</span></div>';}
    if(reactions){const p=Math.round(reactions/total*100);html+='<div class="dist-row"><span class="dist-label">Reactions</span><div class="dist-bar-wrap"><div class="dist-bar-fill" style="width:'+p+'%;background:var(--chaos);"></div></div><span class="dist-count">'+reactions+'</span></div>';}
    if(hidden){const p=Math.round(hidden/total*100);html+='<div class="dist-row"><span class="dist-label">Hidden</span><div class="dist-bar-wrap"><div class="dist-bar-fill" style="width:'+p+'%;background:var(--text-muted);"></div></div><span class="dist-count">'+hidden+'</span></div>';}
  }
  if(Object.keys(kwFreq).length){
    html+='<div class="slbl" style="margin-bottom:8px;">Keywords</div>';
    html+='<div class="kw-grid">';
    Object.entries(kwFreq).sort((a,b)=>b[1]-a[1]).forEach(([kw,n])=>{
      html+=`<div class="kw-chip"><span class="kw-chip-n">${n}</span><span class="kw-chip-l">${kw[0]+kw.slice(1).toLowerCase()}</span></div>`;
    });
    html+='</div>';
  }
  html+='<div class="slbl" style="margin-bottom:10px;">Card Types</div>';
  Object.entries(byType).forEach(function(e){
    const t=e[0],n=e[1],pct=Math.round(n/total*100),col=typeColors[t]||'var(--accent)';
    html+='<div class="dist-row"><span class="dist-label">'+t+'</span><div class="dist-bar-wrap"><div class="dist-bar-fill" style="width:'+pct+'%;background:'+col+';"></div></div><span class="dist-count">'+n+'</span></div>';
  });
  html+='<div class="slbl" style="margin:1.25rem 0 10px;">Curves</div>';
  html+=buildDeckCurves(d,true);
  html+='<div class="hg-calc">';
  html+='<div class="hg-title">⚗️ Hypergeometric Calculator</div>';
  html+='<div class="hg-grid">';
  html+='<div class="hg-field"><label>Deck size</label><input type="number" id="hg-n" value="'+total+'" min="1" max="200" oninput="calcHG()"></div>';
  html+='<div class="hg-field"><label>Copies in deck</label><input type="number" id="hg-k" value="3" min="0" oninput="calcHG()"></div>';
  html+='<div class="hg-field"><label>Hand size</label><input type="number" id="hg-n2" value="4" min="1" oninput="calcHG()"></div>';
  html+='<div class="hg-field"><label>Desired qty</label><input type="number" id="hg-k2" value="1" min="0" oninput="calcHG()"></div>';
  html+='</div>';
  html+='<div id="hg-result" class="hg-result"></div>';
  html+='</div>';
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
      +(r.turn?'<span class="result-notes" style="color:var(--text-muted);">'+(r.turn==='first'?'1st':'2nd')+'</span>':'')
      +(r.bf?'<span class="result-notes" style="color:var(--text-muted);">🌍 '+r.bf+'</span>':'')
      +'<span class="result-opp">vs '+(r.opp||'Unknown')+'</span>'
      +(r.notes?'<span class="result-notes">'+r.notes+'</span>':'')
      +'<button class="result-del" onclick="deleteResult('+d.id+','+realIdx+')" title="Remove">×</button>'
      +'</div>';
  }).join('');
}

function addResult(deckId){
  const d=myDecks.find(x=>x.id===deckId);if(!d)return;
  const outcome=document.getElementById('r-outcome').value;
  const turn=document.getElementById('r-turn').value;
  const bfId=document.getElementById('r-bf').value;
  const bfEl=document.getElementById('r-bf');
  const bfName=bfEl&&bfEl.selectedIndex>0?bfEl.options[bfEl.selectedIndex].text:'';
  const opp=(document.getElementById('r-opp').value.trim())||'Unknown';
  const notes=document.getElementById('r-notes').value.trim();
  if(!d.results) d.results=[];
  d.results.push({outcome,opp,notes,turn,bf:bfName,date:new Date().toLocaleDateString()});
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
    +'<div class="sb-panel-title"><span>Sideboard <span style="color:var(--text-muted);font-weight:400;font-size:12px;">('+sbTotal+'/8)</span></span>'+clearBtn+'</div>'
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
    if(delta>0){const sbTotal=d.sideboard.reduce((a,c)=>a+c.cnt,0);if(sbTotal>=8){toast('Sideboard is full (8 cards max)');return;}}
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
  if(sbTotal>=8){toast('Sideboard is full (8 cards max)');return;}
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
  if(sbTotal>=8){toast('Sideboard is full (8 cards max)');return;}
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
  if(deckDoms.length){source=source.filter(c=>c.type==='Rune'||c.type==='Battlefield'||c.doms.length===0||c.doms.every(dom=>deckDoms.includes(dom)));}
  // Rune tab: only show runes matching deck domains
  if(EF.type==='Rune'&&deckDoms.length){source=source.filter(c=>c.type==='Rune'&&(c.doms.length===0||c.doms.every(dom=>deckDoms.includes(dom))));}
  if(q) source=source.filter(c=>c.name.toLowerCase().includes(q)||c.txt.toLowerCase().includes(q));
  if(EF.type==='Champion') source=source.filter(c=>(c.supertype||'').toLowerCase().includes('champion')&&c.type!=='Legend');
  else if(EF.type) source=source.filter(c=>c.type===EF.type||c.supertype===EF.type);
  if(EF.dom) source=source.filter(c=>c.doms.includes(EF.dom));
  if(EF.set) source=source.filter(c=>c.set===EF.set);
  if(EF.rar) source=source.filter(c=>c.rarity===EF.rar);
  if(EF.subtype){
    if(EF.subtype==='Action') source=source.filter(c=>c.txt.toLowerCase().includes('[action]'));
    else if(EF.subtype==='Reaction') source=source.filter(c=>c.txt.toLowerCase().includes('[reaction]'));
    else if(EF.subtype==='Champion') source=source.filter(c=>c.supertype==='Champion');
    else if(EF.subtype==='Signature Card') source=source.filter(c=>c.supertype==='Signature');
    else if(EF.subtype==='Token') source=source.filter(c=>c.type==='Token'||c.supertype==='Token');
  }
  if(EF.variant){
    if(EF.variant==='Alt Art') source=source.filter(c=>c.isAltArt);
    else if(EF.variant==='Overnumbered') source=source.filter(c=>c.isOvernumbered);
    else if(EF.variant==='Promo') source=source.filter(c=>c.rarity==='Promo');
    else if(EF.variant==='Artist Signed') source=source.filter(c=>c.isSignature);
    else if(EF.variant==='Standard') source=source.filter(c=>!c.isAltArt&&!c.isOvernumbered&&c.rarity!=='Promo'&&!c.isSignature);
  }
  if(!EF.showAllVersions){
    const RR={Legendary:5,Epic:4,Rare:3,Uncommon:2,Common:1,Showcase:0,Promo:0};
    const seen=new Map();
    source.forEach(c=>{
      const key=c.name.replace(/\s*\([^)]*\)\s*$/,'').toLowerCase().trim();
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

  const ESETS=['','UNL','SFD','SFD-NN','ARC','OGN','OGS','OGN-NN','WRLD25','OPP','JDG','PR'];
  const ERARS=['','Legendary','Epic','Rare','Uncommon','Common','Promo'];
  const ESUBTYPES=['','Action','Reaction','Champion','Token','Signature Card'];
  const EVARIANTS=['','Standard','Alt Art','Overnumbered','Promo','Artist Signed'];

  function efDrop(field,val,label,opts,labelMap){
    let h=`<div class="ef-drop-wrap"><button class="ef-drop-btn" onclick="toggleEFDrop('efd-${field}',this)"><span class="ef-dv-lbl">${label}</span><span class="ef-dv-val">${val||'All'}</span><span class="caret">⌄</span></button><div class="ef-dropdown" id="efd-${field}">`;
    opts.forEach(o=>{const l=labelMap?labelMap[o]:(o||'All');h+=`<div class="ef-dopt${(val===o)?' active':''}" onclick="setEF('${field}','${o}',this)">${l}</div>`;});
    h+='</div></div>';return h;
  }
  html+='<div class="ef-drop-row">';
  html+=efDrop('set',EF.set,'Set',ESETS);
  html+=efDrop('subtype',EF.subtype,'Subtype',ESUBTYPES);
  html+=efDrop('variant',EF.variant,'Art Variants',EVARIANTS);
  html+=efDrop('rar',EF.rar,'Rarity',ERARS);
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
      const bn=baseName(c.name);
      const variantTotal=(d.cards||[]).filter(x=>baseName(x.n)===bn).reduce((a,x)=>a+x.cnt,0);
      const sn=c.name.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const isChamp=(c.supertype||'').toLowerCase().includes('champion');
      const effType=isChamp?'Champion':c.type;
      const at=c.type.replace(/'/g,"\\'");
      const st=effType.replace(/'/g,"\\'");
      const si=c.id.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const domPills=c.doms.map(dm=>`<span class="pill ${dm}">${dm[0].toUpperCase()+dm.slice(1)}</span>`).join('');
      const isRune=c.type==='Rune';
      const isBF=c.type==='Battlefield';
      const isBanned=BANNED_CARDS.has(baseName(c.name));
      const addFn=isBanned?`toast('This card is banned')`:(isRune?`addRune('${si}','${sn}')`:isBF?`addBattlefield(-1,'${si}','${sn}')`:(variantTotal<3?`editDeckCard('${si}','${sn}','${at}',1)`:''));
      const dragAttrs=isBanned?'draggable="false"':`draggable="true" ondragstart="editLibDragStart('${si}','${sn}','${st}')"`;
      html+=`<div class="ct ct-img lib-card${isBF?' lib-card-bf':''}${isBanned?' lib-card-banned':''}" ${dragAttrs} title="${c.name}" onclick="${addFn}">`;
      html+= c.imageUrl
        ?`<div class="ct-img-wrap"><img src="${c.imageUrl}" alt="${c.name}" loading="lazy" onerror="this.parentElement.classList.add('no-img')"></div>`
        :`<div class="ct-img-wrap no-img"><div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:11px;">No image</div></div>`;
      if(isBanned) html+=`<div class="edit-banned-overlay"><div class="edit-banned-stamp">Banned</div></div>`;
      if(cnt>0) html+=`<div class="edit-card-thumb-cnt">×${cnt}</div>`;
      html+=`<div class="ct-name">${c.name}</div>`;
      html+=`<div class="ct-sub">${domPills}<span style="color:var(--text-muted);margin:0 2px;">·</span>${c.supertype||c.type}${c.rarity?`<span style="color:var(--text-muted);margin:0 2px;">·</span>${c.rarity}`:''}</div>`;
      html+=`<div class="deck-card-actions lib-card-overlay">`;
      html+=`<div class="dca-btn" onclick="event.stopPropagation();openCardModal('${si}')"><span>🔍</span> Zoom</div>`;
      if(!isBanned) html+=`<div class="lib-add-deck-hint">＋ ${isBF?'Add to BF':isRune?'Add to Runes':'Add to deck'}</div>`;
      if(!isBanned) html+=`<div class="dca-btn lib-sb-btn" onclick="event.stopPropagation();addDirectToSB(${d.id},'${si}','${sn}','${at}')"><span>→</span> Sideboard</div>`;
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
function setEF(field,val,el){
  EF[field]=val;EF.page=1;
  const wrap=el.closest('.ef-drop-wrap');
  if(wrap){wrap.querySelectorAll('.ef-dopt').forEach(o=>o.classList.remove('active'));el.classList.add('active');}
  renderEditSearch();
}
function toggleEFDrop(id,btn){
  document.querySelectorAll('.ef-dropdown').forEach(d=>{if(d.id!==id){d.classList.remove('open');const b=d.previousElementSibling;if(b)b.classList.remove('open');}});
  const dd=document.getElementById(id);if(!dd)return;
  dd.classList.toggle('open');btn.classList.toggle('open');
}

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
      const _bn=baseName(_DRAG.n);
      const deckCntBN=(d.cards||[]).filter(c=>baseName(c.n)===_bn).reduce((a,c)=>a+c.cnt,0);
      const sbCntBN=(d.sideboard||[]).filter(c=>baseName(c.n)===_bn).reduce((a,c)=>a+c.cnt,0);
      if(deckCntBN+sbCntBN>=3){toast('Max 3 copies (including variants)');_DRAG=null;return;}
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

function renderEditPreview(targetEl){
  const d=myDecks.find(x=>x.id===activeDeckId);if(!d)return;
  const right=targetEl||document.getElementById('edit-right');if(!right)return;
  const isEdit=!targetEl||targetEl.id!=='cards-visual-view';
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

  function bannedBanner(name){
    const bn=name.replace(/\s*\([^)]*\)\s*$/,'').trim();
    return BANNED_CARDS.has(bn)?'<div class="banned-banner">BANNED</div>':'';
  }

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
    h+=bannedBanner(c.n);
    h+=`<div class="deck-card-actions">`;
    if(c.t!=='Legend') h+=`<div class="dca-btn dca-danger" onclick="editDeckCard('${si}','${sn}','${st}',-1)"><span>✕</span> Remove</div>`;
    if(c.t!=='Legend') h+=`<div class="dca-btn${canAdd?'':' dca-disabled'}" onclick="editDeckCard('${si}','${sn}','${st}',1)"><span>＋</span> Add 1 copy</div>`;
    if(c.t!=='Legend') h+=`<div class="dca-btn" onclick="addToSB(${d.id},'${si}','${sn}','${st}')"><span>→</span> Add to sideboard</div>`;
    h+=`</div>`;
    if(c.cnt>1) h+=`<div class="deck-card-cnt-badge">×${c.cnt}</div>`;
    h+='</div>';
    return h;
  }

  const badge=document.getElementById('deck-count-badge');
  if(badge) badge.textContent=`${total + (d.champion ? 1 : 0)} / 40 cards`;

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
    h+='<div class="deck-hero-half"><div class="deck-hero-cards">';
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
      h+=bannedBanner(lc.n);
      h+=`<div class="deck-card-actions"><div class="dca-btn dca-danger" onclick="editDeckCard('${lsi}','${lsn}','${lst}',-1)"><span>✕</span> Remove</div></div></div>`;
    }
    h+='</div></div>';
    // Battlefield zones inline between Legend and Champion
    for(let i=0;i<3;i++){
      const bfc=d.battlefields[i];
      const bff=bfc?CARDS.find(x=>x.id===bfc.id):null;
      const bfi=bff?bff.imageUrl:'';
      h+='<div class="deck-hero-bf-slot">';
      if(bfc){
        const bsi=bfc.id.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        const bsn=bfc.n.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        h+=`<div class="bf-zone bf-zone-filled" ondragover="editZoneDragOver(event)" ondragleave="editZoneDragLeave(event)" ondrop="bfZoneDrop(event,${i})" data-hover-img="${bfi||''}" data-hover-bf="1">`;
        h+=`<div class="bf-zone-inner" draggable="true" ondragstart="editDeckDragStart('${bsi}','${bsn}','Battlefield')">`;
        if(bfi) h+=`<img src="${bfi}" alt="" loading="lazy" class="bf-zone-img">`;
        else h+=`<div class="deck-card-no-img"><div class="dcni-name">${bfc.n}</div></div>`;
        h+=bannedBanner(bfc.n);
        h+=`</div></div>`;
        h+=`<button class="bf-remove-btn" onclick="removeBattlefield(${i})">✕ Remove</button>`;
      } else {
        h+=`<div class="bf-zone bf-zone-empty${isEdit?' drop-zone':''}" ${isEdit?`ondragover="editZoneDragOver(event)" ondragleave="editZoneDragLeave(event)" ondrop="bfZoneDrop(event,${i})"`:''}">`;
        h+=`<div class="bf-zone-hint">${isEdit?'Drag or click':'Add in Edit tab'}</div>`;
        h+='</div>';
      }
      h+='</div>';
    }
    // Champion
    h+='<div class="deck-hero-half">';
    h+=`<div class="deck-card-item deck-card-legend drop-zone" ondragover="editZoneDragOver(event)" ondragleave="editZoneDragLeave(event)" ondrop="editZoneDrop(event,'champion')" title="${zoneChamp?zoneChamp.n:'Drag champion here'}">`;
    if(zoneChamp){
      const zf=CARDS.find(x=>x.id===zoneChamp.id);const zi=zf?zf.imageUrl:'';
      const zsi=zoneChamp.id.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const zsn=zoneChamp.n.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      h+=`<div class="hzb-inner" draggable="true" ondragstart="editDeckDragStart('${zsi}','${zsn}','Champion')" data-hover-img="${zi||''}">`;
      if(zi) h+=`<img src="${zi}" alt="" loading="lazy">`;
      else h+=`<div class="deck-card-no-img"><div class="dcni-name">${zoneChamp.n}</div></div>`;
      h+=bannedBanner(zoneChamp.n);
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
  // Sort toggle button for edit tab
  html+=`<div style="display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-bottom:8px;">
    <span style="font-size:12px;color:var(--text-muted);font-family:'Syne',sans-serif;letter-spacing:0.04em;">Sort by:</span>
    <button class="cvt-btn sort-tog-btn${deckSortMode==='energy'?' on':''}" onclick="toggleDeckSort()" title="Toggle sort order" style="font-size:12px;padding:6px 14px;">${deckSortMode==='energy'?'⚡ Energy':'🔤 Alphabetical'}</button>
  </div>`;
  function energySort(a,b){
    const ca=CARDS.find(x=>x.id===a.id);const cb=CARDS.find(x=>x.id===b.id);
    const ea=ca&&ca.cost!=null?ca.cost:999;const eb=cb&&cb.cost!=null?cb.cost:999;
    return ea!==eb?ea-eb:a.n.localeCompare(b.n);
  }
  if(!deckCards.length){
    html+='<div style="font-size:12px;color:var(--text-muted);padding:4px 0;">No cards yet — click cards on the left to add</div>';
  } else {
    const sorted=deckCards.slice().sort((a,b)=>typeSort(a.t,b.t)||(deckSortMode==='energy'?energySort(a,b):a.n.localeCompare(b.n)));
    const byType={};
    const typeOrder=[];
    sorted.forEach(c=>{if(!byType[c.t]){byType[c.t]=[];typeOrder.push(c.t);}byType[c.t].push(c);});
    html+='<div class="deck-all-types drop-zone" ondragover="editZoneDragOver(event)" ondragleave="editZoneDragLeave(event)" ondrop="editZoneDrop(event,\'deck\')">';
    typeOrder.forEach(type=>{
      const uniqueCards=byType[type];
      const typeTotal=uniqueCards.reduce((a,c)=>a+c.cnt,0);
      html+=`<div class="deck-type-block${type==='Gear'?' gear-type-block':''}"><div class="deck-type-lbl">${type} (${typeTotal})</div>`;
      html+='<div class="deck-type-auto-grid">';
      uniqueCards.forEach(c=>{
        if(type==='Gear'){
          const full=CARDS.find(x=>x.id===c.id);
          const img=full?full.imageUrl:'';
          const sn=c.n.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
          const st=c.t.replace(/'/g,"\\'");
          const si=c.id.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
          const canAdd=c.cnt<3;
          html+='<div class="gear-h-stack">';
          for(let i=0;i<c.cnt;i++){
            html+=`<div class="deck-card-item deck-card-main gear-h-card${i===0?' gear-h-first':''}" title="${c.n}" draggable="true" ondragstart="editDeckDragStart('${si}','${sn}','${st}')" style="z-index:${c.cnt-i};" data-hover-img="${img||''}">`;
            if(img) html+=`<img src="${img}" alt="" loading="lazy">`;
            else html+=`<div class="deck-card-no-img"><div class="dcni-name">${c.n}</div></div>`;
            html+=bannedBanner(c.n);
            html+=`<div class="deck-card-actions">`;
            html+=`<div class="dca-btn dca-danger" onclick="editDeckCard('${si}','${sn}','${st}',-1)"><span>✕</span> Remove</div>`;
            html+=`<div class="dca-btn${canAdd?'':' dca-disabled'}" onclick="editDeckCard('${si}','${sn}','${st}',1)"><span>＋</span> Add 1 copy</div>`;
            html+=`<div class="dca-btn" onclick="addToSB(${d.id},'${si}','${sn}','${st}')"><span>→</span> Add to sideboard</div>`;
            html+='</div>';
            if(i===0) html+=`<div class="deck-card-cnt-badge">×${c.cnt}</div>`;
            html+='</div>';
          }
          html+='</div>';
        } else {
          html+='<div class="deck-col-stack">';
          for(let i=0;i<c.cnt;i++) html+=cardItem(c,'deck-card-main');
          html+='</div>';
        }
      });
      html+='</div>';
      html+='</div>';
    });
    html+='</div>';
  }

  // Rune section
  const runes=d.runes||[];
  const runeMax=12;
  html+=`<div class="deck-section deck-rune-section"><div class="deck-section-hdr" style="display:flex;align-items:center;gap:6px;">Runes <span class="ds-count">(${runes.length}/${runeMax})</span></div>`;
  if(!runes.length){
    html+=`<div style="font-size:12px;color:var(--text-muted);">${isEdit?'None — select the Rune tab on the left and click a rune to add':'Add cards in the Edit tab'}</div>`;
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
          html+=bannedBanner(r.n);
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
  html+=`<div class="deck-section deck-sb-section"><div class="deck-section-hdr" style="display:flex;align-items:center;gap:6px;">Sideboard <span class="ds-count">(${sbTotal}/8)</span></div>`;
  if(!sb.length){
    html+=`<div style="font-size:12px;color:var(--text-muted);">${isEdit?'None — hover a card and use "Add to sideboard"':'Add cards in the Edit tab'}</div>`;
  } else {
    const sbSorted=sb.slice().sort((a,b)=>a.n.localeCompare(b.n));
    html+='<div class="deck-type-auto-grid">';
    sbSorted.forEach(c=>{
      const full=CARDS.find(x=>x.id===c.id);
      const img=full?full.imageUrl:'';
      const si=c.id.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const sn=c.n.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      html+='<div class="deck-col-stack">';
      for(let i=0;i<c.cnt;i++){
        html+=`<div class="deck-card-item deck-card-main" title="${c.n}" data-hover-img="${img||''}">`;
        if(img) html+=`<img src="${img}" alt="" loading="lazy">`;
        else html+=`<div class="deck-card-no-img"><div class="dcni-name">${c.n}</div></div>`;
        html+=bannedBanner(c.n);
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
    const bn=baseName(cardName);
    const deckCnt=(d.cards||[]).filter(c=>baseName(c.n)===bn).reduce((a,c)=>a+c.cnt,0);
    const sbCnt=(d.sideboard||[]).filter(c=>baseName(c.n)===bn).reduce((a,c)=>a+c.cnt,0);
    const zoneCnt=(d.champion&&baseName(d.champion.n)===bn)?1:0;
    if(deckCnt+sbCnt+zoneCnt>=3){toast('Max 3 copies (including variants)');return;}
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
  if(sbTotal>=8){toast('Sideboard is full (8 cards max)');closeDeckCardMenu();return;}
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
  if(d.battlefields.some(s=>s&&s.id===cardId)){toast('Only 1 copy of each battlefield allowed');return;}
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
  if(d.battlefields[slotIdx]){toast('Battlefield zone '+(slotIdx+1)+' already has a card — remove it first');_DRAG=null;return;}
  if(d.battlefields.some(s=>s&&s.id===_DRAG.id)){toast('Only 1 copy of each battlefield allowed');_DRAG=null;return;}
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
function closeDeckDetail(){
  if(currentUser&&activeDeckId) saveToCloud(activeDeckId);
  document.getElementById('dl').style.display='';document.getElementById('dd').style.display='none';activeDeckId=null;activeDDTab='cards';renderDecks();
}

function copyDeckLink(){
  const d=myDecks.find(x=>x.id===activeDeckId);if(!d)return;
  try{
    const encoded=btoa(unescape(encodeURIComponent(JSON.stringify(d))));
    const url=window.location.origin+window.location.pathname+'#deck='+encoded;
    navigator.clipboard.writeText(url).then(()=>toast('Deck link copied!')).catch(()=>{
      prompt('Copy this link:',url);
    });
  }catch(e){toast('Could not generate link');}
}
function toggleExportMenu(btn){
  const drop=document.getElementById('export-drop');if(!drop)return;
  const isOpen=drop.classList.contains('open');
  document.querySelectorAll('.export-drop.open').forEach(d=>d.classList.remove('open'));
  if(!isOpen) drop.classList.add('open');
}
function closeExportMenu(){
  document.querySelectorAll('.export-drop').forEach(d=>d.classList.remove('open'));
}
document.addEventListener('click',function(e){
  if(!e.target.closest('.cvt-bar-right')) closeExportMenu();
});
/* ── EXPORT IMAGE MODAL ─────────────────────────── */
let _exportCanvas=null;
function openExportImageModal(d){
  let modal=document.getElementById('export-img-modal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='export-img-modal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.onclick=function(e){if(e.target===modal)closeExportImageModal();};
    modal.innerHTML=`<div style="background:#1a1916;border:1px solid #333;border-radius:16px;padding:24px;max-width:980px;width:96%;max-height:93vh;display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div><div style="font-size:18px;font-weight:700;color:#fff;font-family:'Syne',sans-serif;">Export Image</div><div style="font-size:12px;color:#888;margin-top:2px;">Preview your deck image before downloading</div></div>
        <button onclick="closeExportImageModal()" style="background:none;border:none;color:#888;font-size:22px;cursor:pointer;line-height:1;">×</button>
      </div>
      <div style="overflow:auto;border-radius:10px;background:#0c0b08;flex:1;min-height:0;">
        <canvas id="export-img-canvas" style="display:block;max-width:100%;height:auto;border-radius:10px;"></canvas>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <button onclick="downloadDeckImage()" style="padding:14px;background:#c8a84b;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;color:#000;">↓ Download Image</button>
        <button onclick="copyDeckImageToClipboard()" style="padding:14px;background:#232220;border:1px solid #444;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;color:#fff;">⧉ Copy to Clipboard</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  modal.style.display='flex';
  renderExportCanvas(d);
}
function closeExportImageModal(){
  const m=document.getElementById('export-img-modal');if(m)m.style.display='none';
}
function downloadDeckImage(){
  if(!_exportCanvas)return;
  const a=document.createElement('a');
  const d=myDecks.find(x=>x.id===activeDeckId);
  a.download=(d&&d.name?d.name:'deck').replace(/[^a-z0-9 _-]/gi,'_')+'.png';
  a.href=_exportCanvas.toDataURL('image/png');a.click();
}
function copyDeckImageToClipboard(){
  if(!_exportCanvas)return;
  _exportCanvas.toBlob(blob=>{
    try{navigator.clipboard.write([new ClipboardItem({'image/png':blob})]).then(()=>toast('Image copied to clipboard!'));}
    catch(e){toast('Copy not supported in this browser');}
  });
}
function renderExportCanvas(d){
  const canvas=document.getElementById('export-img-canvas');
  if(!canvas)return;
  _exportCanvas=canvas;
  const ctx=canvas.getContext('2d');

  // Layout constants
  const PAD=18,LEFT_W=206,GAP=14;
  const CW=88,CH=Math.round(CW*1.4); // main card size
  const BFW=156,BFH=Math.round(BFW*0.714); // battlefield landscape
  const LCW=174,LCH=Math.round(LCW*1.4); // legend card
  const COLS=8;
  const RIGHT_X=LEFT_W+GAP;
  const RIGHT_W=COLS*(CW+6)-6;
  const TOTAL_W=RIGHT_X+RIGHT_W+PAD;

  // Gather unique card lists
  const legendC=(d.cards||[]).filter(c=>c.t==='Legend');
  const mainUnique=(d.cards||[]).filter(c=>c.t!=='Legend');
  const bfList=(d.battlefields||[]).filter(Boolean);
  const sbList=d.sideboard||[];
  const runeMap={};(d.runes||[]).forEach(r=>{if(!runeMap[r.n])runeMap[r.n]={...r,cnt:0};runeMap[r.n].cnt++;});
  const runeList=Object.values(runeMap);

  // Calculate right panel height
  const mainRows=Math.ceil(mainUnique.length/COLS)||1;
  const runeRows=Math.ceil(runeList.length/COLS);
  const sbRows=Math.ceil(sbList.length/COLS);
  const SEC=28; // section label height
  let rightH=PAD;
  rightH+=SEC+mainRows*(CH+6)+10;
  if(runeList.length) rightH+=SEC+runeRows*(CH+6)+10;
  if(sbList.length) rightH+=SEC+sbRows*(CH+6)+10;
  rightH+=PAD;

  // Left panel height
  let leftH=PAD+24+8+LCH+12; // name + legend card
  leftH+=30; // domain row
  if(bfList.length) leftH+=SEC+bfList.length*(BFH+6);
  leftH+=PAD;

  const TOTAL_H=Math.max(leftH,rightH);
  canvas.width=TOTAL_W;canvas.height=TOTAL_H;

  // Background
  ctx.fillStyle='#0c0b08';ctx.fillRect(0,0,TOTAL_W,TOTAL_H);
  // Left panel bg
  ctx.fillStyle='#13120f';ctx.beginPath();
  ctx.roundRect(0,0,LEFT_W,TOTAL_H,0);ctx.fill();

  // Collect all images to load
  const jobs=[];
  function addJob(url,draw){jobs.push({url,draw});}

  const legFull=legendC.length?CARDS.find(c=>c.id===legendC[0].id):null;
  if(legFull&&legFull.imageUrl) addJob(legFull.imageUrl,(img)=>{
    drawRoundedImage(ctx,img,PAD,PAD+32,LCW,LCH,6);
  });

  // Domain pips
  const domColors={fury:'#e05a2a',chaos:'#e05a9e',calm:'#3dd6a3',mind:'#5ab4f5',body:'#f5943e',order:'#c8a84b'};

  // BF cards
  bfList.forEach((bf,i)=>{
    const full=CARDS.find(c=>c.id===bf.id);
    if(full&&full.imageUrl) addJob(full.imageUrl,(img)=>{
      const y=PAD+32+LCH+42+SEC+i*(BFH+6);
      drawRoundedImage(ctx,img,PAD,y,BFW,BFH,5);
    });
  });

  // Main deck cards
  mainUnique.forEach((c,i)=>{
    const full=CARDS.find(x=>x.id===c.id);
    if(full&&full.imageUrl) addJob(full.imageUrl,(img)=>{
      const col=i%COLS,row=Math.floor(i/COLS);
      const x=RIGHT_X+col*(CW+6),y=PAD+SEC+row*(CH+6);
      drawRoundedImage(ctx,img,x,y,CW,CH,5);
      if(c.cnt>1){
        ctx.fillStyle='rgba(0,0,0,0.75)';ctx.beginPath();ctx.roundRect(x+CW-22,y+4,20,16,4);ctx.fill();
        ctx.fillStyle='#fff';ctx.font='bold 10px sans-serif';ctx.textAlign='center';
        ctx.fillText('×'+c.cnt,x+CW-12,y+15);
      }
    });
  });

  // Rune cards
  const runeOffsetY=PAD+SEC+mainRows*(CH+6)+(mainUnique.length?16:0);
  runeList.forEach((r,i)=>{
    const full=CARDS.find(x=>x.id===r.id);
    if(full&&full.imageUrl) addJob(full.imageUrl,(img)=>{
      const col=i%COLS,row=Math.floor(i/COLS);
      const x=RIGHT_X+col*(CW+6),y=runeOffsetY+SEC+row*(CH+6);
      drawRoundedImage(ctx,img,x,y,CW,CH,5);
      if(r.cnt>1){
        ctx.fillStyle='rgba(0,0,0,0.75)';ctx.beginPath();ctx.roundRect(x+CW-22,y+4,20,16,4);ctx.fill();
        ctx.fillStyle='#fff';ctx.font='bold 10px sans-serif';ctx.textAlign='center';
        ctx.fillText('×'+r.cnt,x+CW-12,y+15);
      }
    });
  });

  // Sideboard cards
  const sbBaseY=runeOffsetY+(runeList.length?SEC+runeRows*(CH+6)+16:0);
  sbList.forEach((c,i)=>{
    const full=CARDS.find(x=>x.id===c.id);
    if(full&&full.imageUrl) addJob(full.imageUrl,(img)=>{
      const col=i%COLS,row=Math.floor(i/COLS);
      const x=RIGHT_X+col*(CW+6),y=sbBaseY+SEC+row*(CH+6);
      drawRoundedImage(ctx,img,x,y,CW,CH,5);
      if(c.cnt>1){
        ctx.fillStyle='rgba(0,0,0,0.75)';ctx.beginPath();ctx.roundRect(x+CW-22,y+4,20,16,4);ctx.fill();
        ctx.fillStyle='#fff';ctx.font='bold 10px sans-serif';ctx.textAlign='center';
        ctx.fillText('×'+c.cnt,x+CW-12,y+15);
      }
    });
  });

  // Load all images then draw text labels on top
  function drawLabels(){
    // Deck name
    ctx.fillStyle='#ffffff';ctx.font="bold 15px 'Syne',sans-serif";ctx.textAlign='left';
    wrapText(ctx,d.name||'My Deck',PAD,PAD+14,LCW,18);

    // Domains
    const doms=d.domains||[];
    doms.forEach((dom,i)=>{
      const col=domColors[dom]||'#888';
      ctx.fillStyle=col;ctx.beginPath();ctx.arc(PAD+10+i*26,PAD+32+LCH+20,9,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff';ctx.font='bold 7px sans-serif';ctx.textAlign='center';
      ctx.fillText(dom.slice(0,2).toUpperCase(),PAD+10+i*26,PAD+32+LCH+23);
    });

    // BF label
    if(bfList.length){
      ctx.fillStyle='#c8a84b';ctx.font="bold 11px 'Syne',sans-serif";ctx.textAlign='left';
      ctx.fillText('BATTLEFIELDS',PAD,PAD+32+LCH+44);
    }

    // Main deck label
    const mainTotal=mainUnique.reduce((a,c)=>a+c.cnt,0);
    ctx.fillStyle='#c8a84b';ctx.font="bold 12px 'Syne',sans-serif";ctx.textAlign='left';
    ctx.fillText(`MAIN DECK (${mainTotal} cards)`,RIGHT_X,PAD+18);

    // Rune label
    if(runeList.length){
      const runeTotal=runeList.reduce((a,r)=>a+r.cnt,0);
      ctx.fillStyle='#c8a84b';ctx.font="bold 12px 'Syne',sans-serif";ctx.textAlign='left';
      ctx.fillText(`RUNES (${runeTotal})`,RIGHT_X,runeOffsetY+18);
      ctx.strokeStyle='#333';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(RIGHT_X,runeOffsetY-4);ctx.lineTo(RIGHT_X+RIGHT_W,runeOffsetY-4);ctx.stroke();
    }

    // Sideboard label
    if(sbList.length){
      const sbTotal=sbList.reduce((a,c)=>a+c.cnt,0);
      ctx.fillStyle='#c8a84b';ctx.font="bold 12px 'Syne',sans-serif";ctx.textAlign='left';
      ctx.fillText(`SIDEBOARD (${sbTotal} cards)`,RIGHT_X,sbBaseY+18);
      ctx.strokeStyle='#444';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(RIGHT_X,sbBaseY-4);ctx.lineTo(RIGHT_X+RIGHT_W,sbBaseY-4);ctx.stroke();
    }

    // RiftLibrary watermark
    ctx.fillStyle='rgba(200,168,75,0.35)';ctx.font="11px 'Syne',sans-serif";ctx.textAlign='right';
    ctx.fillText('RiftLibrary',TOTAL_W-PAD,TOTAL_H-8);
  }

  // Load all images
  let loaded=0;
  if(!jobs.length){drawLabels();return;}
  jobs.forEach(job=>{
    const img=new Image();img.crossOrigin='anonymous';
    img.onload=()=>{job.draw(img);if(++loaded===jobs.length)drawLabels();};
    img.onerror=()=>{if(++loaded===jobs.length)drawLabels();};
    img.src=job.url;
  });
}
function drawRoundedImage(ctx,img,x,y,w,h,r){
  ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.clip();
  ctx.drawImage(img,x,y,w,h);ctx.restore();
}
function wrapText(ctx,text,x,y,maxW,lineH){
  const words=text.split(' ');let line='';
  for(let i=0;i<words.length;i++){
    const test=line+words[i]+' ';
    if(ctx.measureText(test).width>maxW&&i>0){ctx.fillText(line,x,y);line=words[i]+' ';y+=lineH;}
    else line=test;
  }
  ctx.fillText(line,x,y);
}

function exportDeck(type){
  const d=myDecks.find(x=>x.id===activeDeckId);if(!d)return;
  const mainCards=d.cards||[];
  const sb=d.sideboard||[];
  const runes=d.runes||[];
  const champion=d.champion?[d.champion]:[];
  const bfs=(d.battlefields||[]).filter(Boolean);
  const legend=(d.cards||[]).filter(c=>c.t==='Legend');

  if(type==='text'){
    const lines=[];
    legend.forEach(c=>lines.push(`${c.cnt}x ${c.n}`));
    champion.forEach(c=>lines.push(`1x ${c.n}`));
    const nonLeg=mainCards.filter(c=>c.t!=='Legend');
    nonLeg.forEach(c=>lines.push(`${c.cnt}x ${c.n}`));
    if(runes.length){const rg={};runes.forEach(r=>{if(!rg[r.n])rg[r.n]=0;rg[r.n]++;});Object.entries(rg).forEach(([n,cnt])=>lines.push(`${cnt}x ${n}`));}
    bfs.forEach(b=>lines.push(`1x ${b.n}`));
    if(sb.length){lines.push('Sideboard:');sb.forEach(c=>lines.push(`${c.cnt}x ${c.n}`));}
    const text=lines.join('\n');
    navigator.clipboard.writeText(text).then(()=>toast('Text list copied!')).catch(()=>prompt('Copy this list:',text));

  } else if(type==='tts'){
    const ttsCards=[];
    const addTTS=(id,name,cnt)=>{const c=CARDS.find(x=>x.id===id);if(c&&c.imageUrl)for(let i=0;i<cnt;i++)ttsCards.push({Nickname:name,ImageURL:c.imageUrl});};
    mainCards.forEach(c=>addTTS(c.id,c.n,c.cnt));
    champion.forEach(c=>addTTS(c.id,c.n,1));
    runes.forEach(r=>addTTS(r.id,r.n,1));
    const tts=JSON.stringify({ObjectStates:[{Name:'DeckCustom',Nickname:d.name||'Deck',ContainedObjects:ttsCards}]},null,2);
    navigator.clipboard.writeText(tts).then(()=>toast('TTS code copied!')).catch(()=>prompt('Copy TTS code:',tts));

  } else if(type==='pdf'){
    const allImgs=[];
    const addImg=(id,cnt)=>{const c=CARDS.find(x=>x.id===id);if(c&&c.imageUrl)for(let i=0;i<cnt;i++)allImgs.push(c.imageUrl);};
    mainCards.filter(c=>c.t!=='Legend').forEach(c=>addImg(c.id,c.cnt));
    champion.forEach(c=>addImg(c.id,1));
    if(!allImgs.length){toast('No card images to print');return;}
    const w=window.open('','_blank');
    if(!w){toast('Allow popups to generate PDF');return;}
    const cols=3;const rows=3;const perPage=cols*rows;
    let html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Proxy PDF — ${d.name||'Deck'}</title><style>
      *{box-sizing:border-box;margin:0;padding:0;}
      body{background:#fff;}
      .page{width:21cm;height:29.7cm;display:grid;grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},1fr);gap:4px;padding:8px;page-break-after:always;}
      .card{border-radius:6px;overflow:hidden;border:1px solid #ccc;}
      .card img{width:100%;height:100%;object-fit:cover;}
      @media print{.page{page-break-after:always;}}
    </style></head><body>`;
    for(let p=0;p<allImgs.length;p+=perPage){
      const batch=allImgs.slice(p,p+perPage);
      html+=`<div class="page">${batch.map(url=>`<div class="card"><img src="${url}" loading="eager"></div>`).join('')}</div>`;
    }
    html+='</body></html>';
    w.document.write(html);w.document.close();
    setTimeout(()=>w.print(),800);

  } else if(type==='image'){
    openExportImageModal(d);

  } else if(type==='reg'){
    const w=window.open('','_blank');
    if(!w){toast('Allow popups to generate sheet');return;}
    const deckName=d.name||'My Deck';
    const legendName=legend.length?legend[0].n:'—';
    const champName=champion.length?champion[0].n:'—';
    const nonLeg=mainCards.filter(c=>c.t!=='Legend');
    const mainCnt=nonLeg.reduce((a,c)=>a+c.cnt,0);
    const champCnt=champion.length?1:0;
    const totalDeckCnt=mainCnt+champCnt;
    const sbCnt=sb.reduce((a,c)=>a+c.cnt,0);
    const cardRows=nonLeg.map(c=>`<tr><td>${c.cnt}</td><td>${c.n}</td></tr>`).join('');
    const champRow=champion.length?`<tr><td>1</td><td>${champion[0].n}</td></tr>`:'';
    const sbRows=sb.map(c=>`<tr><td>${c.cnt}</td><td>${c.n}</td></tr>`).join('');
    const runeRows=Object.entries(runes.reduce((a,r)=>{a[r.n]=(a[r.n]||0)+1;return a;},{})).map(([n,cnt])=>`<tr><td>${cnt}</td><td>${n}</td></tr>`).join('');
    const bfRows=bfs.map(b=>`<tr><td>1</td><td>${b.n}</td></tr>`).join('');
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Registration — ${deckName}</title><style>
      body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#000;}
      h1{font-size:20px;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:16px;}
      .header-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;}
      .field{border-bottom:1px solid #666;padding:4px 0;font-size:13px;}
      .field-lbl{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.05em;}
      table{width:100%;border-collapse:collapse;margin-bottom:16px;}
      th{text-align:left;font-size:11px;padding:4px 8px;background:#eee;border:1px solid #ccc;}
      td{padding:4px 8px;font-size:13px;border:1px solid #eee;}
      .section-title{font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;margin:14px 0 4px;color:#444;}
      @media print{body{padding:0;}}
    </style></head><body>
      <h1>Riftbound Deck Registration Sheet</h1>
      <div class="header-grid">
        <div><div class="field-lbl">Deck Name</div><div class="field">${deckName}</div></div>
        <div><div class="field-lbl">Date</div><div class="field">${new Date().toLocaleDateString()}</div></div>
        <div><div class="field-lbl">Legend</div><div class="field">${legendName}</div></div>
        <div><div class="field-lbl">Player Name</div><div class="field">&nbsp;</div></div>
        <div><div class="field-lbl">Player ID</div><div class="field">&nbsp;</div></div>
      </div>
      <div class="section-title">Main Deck (${totalDeckCnt}/40)</div>
      <table><thead><tr><th>#</th><th>Card Name</th></tr></thead><tbody>${cardRows}</tbody></table>
      ${champRow?`<div class="section-title">Champion Zone</div><table><thead><tr><th>#</th><th>Card Name</th></tr></thead><tbody>${champRow}</tbody></table>`:''}
      ${runeRows?`<div class="section-title">Runes (${runes.length}/12)</div><table><thead><tr><th>#</th><th>Card Name</th></tr></thead><tbody>${runeRows}</tbody></table>`:''}
      ${bfRows?`<div class="section-title">Battlefields</div><table><thead><tr><th>#</th><th>Card Name</th></tr></thead><tbody>${bfRows}</tbody></table>`:''}
      ${sbRows?`<div class="section-title">Sideboard (${sbCnt}/8)</div><table><thead><tr><th>#</th><th>Card Name</th></tr></thead><tbody>${sbRows}</tbody></table>`:''}
      <div style="margin-top:24px;font-size:11px;color:#999;">Generated by RiftLibrary</div>
    </body></html>`;
    w.document.write(html);w.document.close();
    setTimeout(()=>w.print(),500);
  }
}
function delDeck(id){
  if(!confirm('Delete this deck?'))return;
  var deck=myDecks.find(function(d){return String(d.id)===String(id);});
  var cloudId=deck&&deck.cloud_id;
  myDecks=myDecks.filter(function(d){return String(d.id)!==String(id);});
  persist();renderDecks();toast('Deck deleted');
  if(currentUser&&cloudId) _sb.from('decks').delete().eq('id',cloudId).then(({error})=>{ if(error) console.warn('Delete failed',error); });
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
function setCFType(t){
  CF.type=t;CF.legend='';
  document.querySelectorAll('.cs-type-tab').forEach(b=>b.classList.toggle('on',b.dataset.type===t));
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
  CF.type='';CF.set='';CF.rar='';CF.legend='';CF.subtype='';CF.variant='';CF.doms.clear();CF.energy=[0,12];CF.power=[0,4];CF.might=[0,10];
  document.getElementById('cs').value='';
  ['energy','power','might'].forEach(n=>{
    const max=parseInt(document.getElementById('rhi-'+n).max);
    document.getElementById('rlo-'+n).value=0;document.getElementById('rhi-'+n).value=max;
    document.getElementById('rv-'+n).textContent='Any';
    const f=document.getElementById('rf-'+n);f.style.left='0%';f.style.width='100%';
  });
  ['set','rar','type','subtype','variant'].forEach(k=>{
    const el=document.getElementById('dv-'+k);if(el)el.textContent='All';
    const dd=document.getElementById('dd-'+k);if(dd)dd.querySelectorAll('.cs-dopt').forEach((o,i)=>o.classList.toggle('active',i===0));
  });
  document.querySelectorAll('#cs-dom-pills .dom-btn').forEach(b=>b.classList.remove('on'));
  renderCards();
}
function setCFType(t){
  CF.type=t;CF.legend='';
  const el=document.getElementById('dv-type');
  if(el){const labels={'':"All",'Unit':'Unit','Spell':'Spell','Gear':'Gear','Legend':'Legend','Rune':'Rune','Battlefield':'Battlefield','banned':'Banned'};el.textContent=labels[t]||t;}
  const dd=document.getElementById('dd-type');
  if(dd)dd.querySelectorAll('.cs-dopt').forEach(o=>o.classList.toggle('active',o.dataset.val===t));
  renderCards();
}

function toggleShowAllVersions(v){CF.showAllVersions=v;renderCards();}

/* ── RENDER CARDS ────────────────────────────────── */
function renderCards(){
  const q=document.getElementById('cs').value.toLowerCase();
  const list=CARDS.filter(c=>{
    if(q&&!c.name.toLowerCase().includes(q)&&!c.txt.toLowerCase().includes(q))return false;
    if(CF.type==='banned'){
      const bn=c.name.replace(/\s*\([^)]*\)\s*$/,'').trim();
      if(!BANNED_CARDS.has(bn))return false;
    } else if(CF.type){
      const match=c.supertype===CF.type||c.type===CF.type;
      if(!match)return false;
    }
    if(CF.legend&&!c.name.startsWith(CF.legend))return false;
    if(CF.rar&&c.rarity!==CF.rar)return false;
    if(CF.set&&c.set!==CF.set)return false;
    if(CF.subtype){
      if(CF.subtype==='Action'){if(!c.txt.toLowerCase().includes('[action]'))return false;}
      else if(CF.subtype==='Reaction'){if(!c.txt.toLowerCase().includes('[reaction]'))return false;}
      else if(CF.subtype==='Champion'){if(c.supertype!=='Champion')return false;}
      else if(CF.subtype==='Signature Card'){if(c.supertype!=='Signature')return false;}
      else if(CF.subtype==='Token'){if(c.type!=='Token'&&c.supertype!=='Token')return false;}
    }
    if(CF.variant){
      if(CF.variant==='Alt Art'){if(!c.isAltArt)return false;}
      else if(CF.variant==='Overnumbered'){if(!c.isOvernumbered)return false;}
      else if(CF.variant==='Promo'){if(c.rarity!=='Promo')return false;}
      else if(CF.variant==='Artist Signed'){if(!c.isSignature)return false;}
      else if(CF.variant==='Standard'){if(c.isAltArt||c.isOvernumbered||c.rarity==='Promo'||c.isSignature)return false;}
    }
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
    const owned=collOwned[c.id]||0;
    return`<div class="ct ct-img" onclick="openCardModal('${safeId}')">
      ${c.imageUrl
        ?`<div class="ct-img-wrap"><img src="${c.imageUrl}" alt="${c.name}" loading="lazy" onerror="this.parentElement.classList.add('no-img')"></div>`
        :`<div class="ct-img-wrap no-img"><div class="ct-img-placeholder" style="background:var(--surface3);display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:11px;">No image</div></div>`
      }
      ${c.cost!==null?`<div class="cost">${c.cost}</div>`:''}
      <div class="ct-name">${c.name}</div>
      <div class="ct-sub">${domPills}<span style="color:var(--text-muted);margin:0 2px;">·</span>${c.supertype||c.type}${c.rarity?`<span style="color:var(--text-muted);margin:0 2px;">·</span>${c.rarity}`:''}</div>
      <div class="ct-coll">${buildCollRow(c.id,owned)}</div>
    </div>`;
  }).join('');
}

function buildCollRow(cardId,owned){
  const s=cardId.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  return `<button class="ct-coll-add" onclick="event.stopPropagation();gridCollChange('${s}',1,this)">${owned>0?`(${owned}) `:''}+ Add to Collection</button>`
    +(owned>0?`<button class="ct-coll-rem" onclick="event.stopPropagation();gridCollChange('${s}',-1,this)">−</button>`:'');
}
function gridCollChange(cardId,delta,btn){
  const cur=collOwned[cardId]||0;
  const next=Math.max(0,cur+delta);
  if(next===0) delete collOwned[cardId]; else collOwned[cardId]=next;
  persistColl();saveCardToCloud(cardId);
  toast(delta>0?'Added to collection':'Removed from collection');
  const row=btn.closest('.ct-coll');
  if(row) row.innerHTML=buildCollRow(cardId,next);
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
  const owned=collOwned[c.id]||0;
  const sid=c.id.replace(/\\/g,'\\\\').replace(/'/g,"\\'");

  document.getElementById('card-modal-body').innerHTML=`
    <div class="cm-layout">
      <div class="cm-img-col">
        ${c.imageUrl
          ?`<img src="${c.imageUrl}" alt="${c.name}" class="cm-img">`
          :`<div class="cm-img cm-img-empty"><span style="color:var(--text-muted);">No image</span></div>`}
        <div class="cm-coll-row">
          <button class="cm-coll-btn cm-coll-add" onclick="cmCollChange('${sid}',1)" title="Add to collection">${owned>0?`(${owned}) `:''}+ Add to Collection</button>
          ${owned>0?`<button class="cm-coll-btn cm-coll-remove" onclick="cmCollChange('${sid}',-1)" title="Remove from collection">− Remove</button>`:''}
        </div>
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
function cmCollChange(cardId,delta){
  setCollOwned(cardId,delta);
  const owned=collOwned[cardId]||0;
  const addBtn=document.querySelector('.cm-coll-add');
  const removeBtn=document.querySelector('.cm-coll-remove');
  if(addBtn) addBtn.textContent=`${owned>0?`(${owned}) `:''}+ Add to Collection`;
  if(owned>0){
    if(!removeBtn){
      const row=document.querySelector('.cm-coll-row');
      if(row){const b=document.createElement('button');b.className='cm-coll-btn cm-coll-remove';b.title='Remove from collection';b.textContent='− Remove';b.onclick=()=>cmCollChange(cardId,-1);row.appendChild(b);}
    }
  } else {
    if(removeBtn) removeBtn.remove();
  }
  toast(delta>0?'Added to collection':'Removed from collection');
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
function openModal(){if(!currentUser){openAuthModal('login');toast('Please log in to create decks.');return;}document.getElementById('modal').classList.add('open');autoD();}
function closeModal(){document.getElementById('modal').classList.remove('open');}
function autoD(){const auto=LD[document.getElementById('mleg').value]||[];document.querySelectorAll('.dtog').forEach(el=>el.classList.toggle('sel',auto.includes(el.classList[1])));}
function togD(el){if(!el.classList.contains('sel')&&document.querySelectorAll('.dtog.sel').length>=2){toast('Max 2 domains');return;}el.classList.toggle('sel');}
function autoImportD(){const auto=LD[document.getElementById('import-mleg').value]||[];document.querySelectorAll('.idtog').forEach(el=>el.classList.toggle('sel',auto.includes(el.classList[1])));}
function togImportD(el){if(!el.classList.contains('sel')&&document.querySelectorAll('.idtog.sel').length>=2){toast('Max 2 domains');return;}el.classList.toggle('sel');}
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

function openImportDeckModal(){
  if(!currentUser){openAuthModal('login');toast('Please log in to import decks.');return;}
  document.getElementById('import-deck-modal').style.display='flex';
  document.getElementById('import-deck-name').value='';
  document.getElementById('import-deck-text').value='';
  document.getElementById('import-deck-file').value='';
  document.getElementById('import-deck-feedback').textContent='';
  autoImportD();
}
function closeImportDeckModal(){
  document.getElementById('import-deck-modal').style.display='none';
}
function loadImportFile(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    document.getElementById('import-deck-text').value=e.target.result;
    if(!document.getElementById('import-deck-name').value.trim())
      document.getElementById('import-deck-name').value=file.name.replace(/\.txt$/i,'');
  };
  reader.readAsText(file);
}
function importDeckFromText(){
  const raw=document.getElementById('import-deck-text').value.trim();
  const deckName=document.getElementById('import-deck-name').value.trim()||'Imported Deck';
  const fb=document.getElementById('import-deck-feedback');
  if(!raw){fb.textContent='Paste a deck list first.';fb.style.color='var(--fury)';return;}

  // Normalize a card name for fuzzy matching
  function norm(s){
    return s.toLowerCase()
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u0060\u00B4]/g,"'") // curly/special apostrophes
      .replace(/[\u2013\u2014]/g,'-')  // em/en dashes
      .replace(/\s+/g,' ').trim();
  }
  // Strip all punctuation for last-resort matching
  function strip(s){return norm(s).replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();}

  function findCard(name){
    return CARDS.find(c=>c.name===name)                          // exact
      ||CARDS.find(c=>c.name.toLowerCase()===name.toLowerCase()) // case-insensitive
      ||CARDS.find(c=>norm(c.name)===norm(name))                 // normalized punctuation
      ||CARDS.find(c=>strip(c.name)===strip(name));              // punctuation-stripped fallback
  }

  // Parse lines — supports "3x Card Name", "3 Card Name", "3X Card Name"
  function parseLines(str){
    return str.split('\n').map(l=>l.trim()).filter(Boolean).reduce((acc,l)=>{
      const m=l.match(/^(\d+)x?\s+(.+)$/i);
      if(m) acc.push({cnt:parseInt(m[1]),name:m[2].trim()});
      return acc;
    },[]);
  }

  // Detect sectioned format (has headers like "Legend:", "MainDeck:", etc.)
  const SECTION_RE=/^(Legend|Champion|MainDeck|Main Deck|Battlefields?|Runes?|Sideboard)\s*:/im;
  const isSectioned=SECTION_RE.test(raw);

  const deckCards=[];
  const runes=[];
  const battlefields=[null,null,null];
  let bfSlot=0;
  let matched=0;const unmatched=[];
  const sb=[];
  let importedLegendName=null;
  let importedChampion=null;

  if(isSectioned){
    // Split raw text into named sections
    const sectionMap={};
    let currentSection=null;
    raw.split('\n').forEach(line=>{
      const hdr=line.match(/^(Legend|Champion|MainDeck|Main Deck|Battlefields?|Runes?|Sideboard)\s*:/i);
      if(hdr){currentSection=hdr[1].toLowerCase().replace(/\s+/g,'').replace(/s$/,'');sectionMap[currentSection]=[];}
      else if(currentSection&&line.trim()) sectionMap[currentSection].push(line);
    });

    const parseSec=(key)=>parseLines((sectionMap[key]||[]).join('\n'));

    // Legend
    parseSec('legend').forEach(({name})=>{
      const found=findCard(name)||findCard(name.split(',')[0].trim());
      if(found&&found.type==='Legend') importedLegendName=found.name;
    });

    // Champion
    parseSec('champion').forEach(({name})=>{
      const found=findCard(name);
      if(found){matched++;importedChampion={id:found.id,n:found.name};}
      else unmatched.push(name);
    });

    // MainDeck
    parseSec('maindeck').forEach(({cnt,name})=>{
      const found=findCard(name);
      if(!found){unmatched.push(name);return;}
      matched++;
      const t=found.type||'';
      if(t==='Legend') return; // legend handled separately
      if(t==='Champion') return; // champion handled separately
      deckCards.push({id:found.id,n:found.name,t,cnt});
    });

    // Battlefields
    parseSec('battlefield').forEach(({name})=>{
      const found=findCard(name);
      if(!found){unmatched.push(name);return;}
      matched++;
      if(bfSlot<3) battlefields[bfSlot++]={id:found.id,n:found.name,t:'Battlefield'};
    });

    // Runes
    parseSec('rune').forEach(({cnt,name})=>{
      const found=findCard(name);
      if(!found){unmatched.push(name);return;}
      matched++;
      for(let i=0;i<cnt;i++) runes.push({id:found.id,n:found.name,t:found.type||'Rune'});
    });

    // Sideboard
    parseSec('sideboard').forEach(({cnt,name})=>{
      const found=findCard(name);
      if(!found){unmatched.push(name);return;}
      matched++;
      sb.push({id:found.id,n:found.name,t:found.type||'',cnt});
    });

  } else {
    // Legacy flat format — original behavior
    const sbIdx=raw.search(/^Sideboard[:\s]/im);
    const mainEntries=parseLines(sbIdx>=0?raw.slice(0,sbIdx):raw);
    const sbEntries=parseLines(sbIdx>=0?raw.slice(sbIdx):'');

    mainEntries.forEach(({cnt,name})=>{
      const found=findCard(name);
      if(!found){unmatched.push(name);return;}
      matched++;
      const t=found.type||'';
      const tl=t.toLowerCase();
      if(t==='Battlefield'||tl==='battlefield'){
        if(bfSlot<3) battlefields[bfSlot++]={id:found.id,n:found.name,t:'Battlefield'};
      } else if(t==='Rune'||tl==='rune'||found.name.toLowerCase().includes(' rune')){
        for(let i=0;i<cnt;i++) runes.push({id:found.id,n:found.name,t:t||'Rune'});
      } else {
        deckCards.push({id:found.id,n:found.name,t,cnt});
      }
    });

    sbEntries.forEach(({cnt,name})=>{
      const found=findCard(name);
      if(!found){unmatched.push(name);return;}
      sb.push({id:found.id,n:found.name,t:found.type||'',cnt});
    });
  }

  // Use legend from section header if found, otherwise fall back to dropdown
  const selectedLegend=importedLegendName||document.getElementById('import-mleg').value;
  const legendCardObj=CARDS.find(c=>c.type==='Legend'&&c.name===selectedLegend);
  if(legendCardObj&&!deckCards.find(c=>c.id===legendCardObj.id)){
    deckCards.unshift({id:legendCardObj.id,n:legendCardObj.name,t:legendCardObj.type,cnt:1});
  }

  const format=document.getElementById('import-mfmt').value||'Constructed';
  const domains=[...document.querySelectorAll('.idtog.sel')].map(e=>e.classList[1]);
  const deck={id:nextId++,name:deckName,legend:selectedLegend,domains,format,
    wins:0,losses:0,desc:'',cards:deckCards,champion:importedChampion||null,
    runes,battlefields,sideboard:sb,updated_at:new Date().toISOString()};
  myDecks.unshift(deck);persist();closeImportDeckModal();renderDecks();
  const parts=[];
  if(isSectioned){
    parts.push(importedChampion?`champion: ${importedChampion.n}`:'champion: none found');
    parts.push(`runes: ${runes.length}`);
    parts.push(`battlefields: ${battlefields.filter(Boolean).length}`);
    parts.push(`sideboard: ${sb.reduce((a,c)=>a+c.cnt,0)}`);
  }
  const detail=parts.length?` (${parts.join(', ')})`:'';
  if(unmatched.length){
    toast(`Imported${detail} — NOT FOUND: ${unmatched.join(', ')}`);
  } else {
    toast(`Deck imported — ${matched} matched${detail}`);
  }
  if(currentUser) setTimeout(()=>saveToCloud(deck.id),100);
}

/* ── EVENTS ─────────────────────────────────────── */
const EVTS=[
  {id:1,name:'RiftLibrary Open #1',date:'2026-05-10',location:'Orlando, FL',format:'Constructed',status:'upcoming',prize:'$200 store credit',players:0,maxPlayers:32,desc:'Our first community tournament! Open to all skill levels. Registration open now.'},
  {id:2,name:'Riftbound Origins Release Event',date:'2026-04-20',location:'Local Game Store',format:'Sealed',status:'upcoming',prize:'Booster packs',players:14,maxPlayers:24,desc:'Celebrate the Origins set with a sealed format event.'},
  {id:3,name:'Weekly Constructed Night',date:'2026-04-17',location:'Game Haven — Orlando',format:'Constructed',status:'upcoming',prize:'Store credit',players:8,maxPlayers:16,desc:'Every Thursday evening. Casual and competitive players welcome.'},
  {id:4,name:'Spring Championship 2026',date:'2026-03-28',location:'Tampa, FL',format:'Constructed',status:'completed',prize:'$500 cash',players:48,maxPlayers:64,desc:'Congrats to all participants! Decklists from top 8 coming soon.'},
  {id:5,name:'Friday Night Riftbound',date:'2026-04-11',location:'Card Kingdom — Tampa',format:'Draft',status:'completed',prize:'Promo cards',players:12,maxPlayers:16,desc:'Weekly draft night. Great turnout — thanks everyone!'},
];
const RQ_EVENTS=[
  {city:'Houston',region:'Texas, USA',dates:'Dec 5–7, 2025',sortDate:'2025-12-05',flag:'🇺🇸',code:'us'},
  {city:'Bologna',region:'Italy',dates:'Feb 20–22, 2026',sortDate:'2026-02-20',flag:'🇮🇹',code:'it'},
  {city:'Las Vegas',region:'Nevada, USA',dates:'Feb 27–Mar 1, 2026',sortDate:'2026-02-27',flag:'🇺🇸',code:'us'},
  {city:'Lille',region:'France',dates:'Apr 17–19, 2026',sortDate:'2026-04-17',flag:'🇫🇷',code:'fr'},
  {city:'Atlanta',region:'Georgia, USA',dates:'Apr 24–26, 2026',sortDate:'2026-04-24',flag:'🇺🇸',code:'us'},
  {city:'Sydney',region:'Australia',dates:'May 15–17, 2026',sortDate:'2026-05-15',flag:'🇦🇺',code:'au'},
  {city:'Vancouver',region:'Canada',dates:'May 29–Jun 1, 2026',sortDate:'2026-05-29',flag:'🇨🇦',code:'ca'},
  {city:'Utrecht',region:'Netherlands',dates:'Jun 12–14, 2026',sortDate:'2026-06-12',flag:'🇳🇱',code:'nl'},
  {city:'Hartford',region:'Connecticut, USA',dates:'Jun 19–21, 2026',sortDate:'2026-06-19',flag:'🇺🇸',code:'us'},
  {city:'Barcelona',region:'Spain',dates:'Aug 21–23, 2026',sortDate:'2026-08-21',flag:'🇪🇸',code:'es'},
  {city:'Singapore',region:'Singapore',dates:'Sep 4–6, 2026',sortDate:'2026-09-04',flag:'🇸🇬',code:'sg'},
  {city:'Los Angeles',region:'California, USA',dates:'Sep 25–27, 2026',sortDate:'2026-09-25',flag:'🇺🇸',code:'us'},
];
const SCHEDULE_2026=[
  {month:'May 2026',events:[
    {dates:'May 1–7',name:'Unleashed Pre-Rift',desc:'Global Pre-Rift events at LGS',type:'pre-rift'},
    {dates:'May 8',name:'Unleashed Release',desc:'Riftbound Set 3 launches worldwide',type:'release'},
    {dates:'May 15–17',name:'RQ Sydney',desc:'First APAC Regional Qualifier',type:'rq'},
    {dates:'Mid-May',name:'China Minor Tournaments',desc:'Set 3 Minor events across four cities',type:'minor'},
    {dates:'May 21–24',name:'MomoCon 2026',desc:'Riftbound events in Atlanta',type:'special'},
    {dates:'May 25',name:'Summoner Skirmish June Window',desc:'First Skirmish window after Unleashed',type:'skirmish'},
    {dates:'May 29–Jun 1',name:'RQ Vancouver',desc:"Canada's first Regional Qualifier",type:'rq'},
  ]},
  {month:'June 2026',events:[
    {dates:'Jun 12–14',name:'RQ Utrecht',desc:'Regional Qualifier in the Netherlands',type:'rq'},
    {dates:'Jun 19–21',name:'RQ Hartford',desc:'New England Regional Qualifier',type:'rq'},
    {dates:'Jun 22',name:'Vandetta Previews Begin',desc:'First look at Riftbound Set 4',type:'preview'},
    {dates:'Jun 22',name:'Summoner Skirmish July Window',desc:'July Skirmish events open',type:'skirmish'},
    {dates:'Jun 26',name:'LoL Mid-Season Invitational',desc:'Riftbound presence in Daejeon, South Korea',type:'special'},
  ]},
  {month:'July 2026',events:[
    {dates:'Mid-July',name:'China Major Tournament',desc:'Set 3 Major in northern China',type:'major'},
    {dates:'Jul 24–30',name:'Vandetta Pre-Rift',desc:'Global Pre-Rift for Set 4',type:'pre-rift'},
    {dates:'Jul 30–Aug 2',name:'Gen Con Indy',desc:'Riftbound events and panel',type:'special'},
    {dates:'Jul 31',name:'Vandetta Release',desc:'Set 4 launches in English and Chinese',type:'release'},
  ]},
  {month:'August 2026',events:[
    {dates:'TBD',name:'State of the Game',desc:'Second State of the Game livestream',type:'special'},
    {dates:'Aug 21–23',name:'RQ Barcelona',desc:'European Regional Qualifier',type:'rq'},
  ]},
  {month:'September 2026',events:[
    {dates:'Sep 4–6',name:'RQ Singapore',desc:'Southeast Asia Regional Qualifier',type:'rq'},
    {dates:'Sep 21',name:'Radiance Previews Begin',desc:'Set 5 reveals start',type:'preview'},
    {dates:'Sep 25–27',name:'RQ Los Angeles',desc:'Final Regional Qualifier of 2026',type:'rq'},
  ]},
  {month:'October 2026',events:[
    {dates:'Oct 16–22',name:'Radiance Pre-Rift',desc:'Final Pre-Rift of the year',type:'pre-rift'},
    {dates:'Oct 23',name:'Radiance Release',desc:'Riftbound Set 5 launches',type:'release'},
  ]},
  {month:'November 2026',events:[
    {dates:'Nov 27–29',name:'DreamHack Stockholm',desc:'Riftbound events in Sweden',type:'special'},
  ]},
  {month:'December 2026',events:[
    {dates:'Dec 4–6',name:'PAX Unplugged',desc:'Riftbound events and panel presence',type:'special'},
  ]},
];
function renderEvents(){
  const el=document.getElementById('events-content');
  const today=new Date();
  const typeStyle={
    rq:       {bg:'rgba(200,168,75,0.15)',color:'var(--accent)',label:'Regional Qualifier'},
    release:  {bg:'rgba(61,214,163,0.15)',color:'var(--calm)',label:'Set Release'},
    pre_rift: {bg:'rgba(90,180,245,0.15)',color:'var(--mind)',label:'Pre-Rift'},
    'pre-rift':{bg:'rgba(90,180,245,0.15)',color:'var(--mind)',label:'Pre-Rift'},
    preview:  {bg:'rgba(224,90,173,0.15)',color:'var(--chaos)',label:'Preview'},
    skirmish: {bg:'rgba(245,212,66,0.15)',color:'var(--order)',label:'Skirmish'},
    special:  {bg:'rgba(245,146,42,0.15)',color:'var(--bodyc)',label:'Special Event'},
    major:    {bg:'rgba(255,107,74,0.15)',color:'var(--fury)',label:'Major'},
    minor:    {bg:'rgba(255,255,255,0.07)',color:'var(--text-muted)',label:'Minor'},
  };
  function typeBadge(t){const s=typeStyle[t]||typeStyle.special;return`<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:${s.bg};color:${s.color};white-space:nowrap;">${s.label}</span>`;}
  function allEventsHTML(){
    const rqHTML=RQ_EVENTS.map((rq,idx)=>{
      const isPast=new Date(rq.sortDate)<today;
      const alreadyAdded=myEvents.some(e=>e.name===rq.city+' Regional Qualifier');
      return`<div style="background:var(--surface2);border:1px solid ${isPast?'var(--border)':'rgba(200,168,75,0.3)'};border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:4px;position:relative;overflow:hidden;">
        ${!isPast?`<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--accent),transparent);"></div>`:''}
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
          <img src="https://flagcdn.com/w40/${rq.code}.png" style="width:28px;height:auto;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,0.4);" alt="${rq.code}">
          <span style="font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:${isPast?'var(--text-muted)':' var(--text)'};">${rq.city}</span>
          ${isPast?`<span style="font-size:10px;padding:1px 7px;border-radius:10px;background:var(--surface3);color:var(--text-muted);">Past</span>`:`<span style="font-size:10px;padding:1px 7px;border-radius:10px;background:rgba(200,168,75,0.15);color:var(--accent);font-weight:600;">Upcoming</span>`}
        </div>
        <div style="font-size:12px;color:var(--text-muted);">${rq.region}</div>
        <div style="font-size:13px;font-weight:600;color:${isPast?'var(--text-muted)':'var(--accent)'};">${rq.dates}</div>
        <button class="rq-add-evt-btn${alreadyAdded?' added':''}" onclick="addRQToMyEvents(${idx})" ${alreadyAdded?'disabled':''}>
          ${alreadyAdded?'✓ Added':'+ Add to My Events'}
        </button>
      </div>`;
    }).join('');
    function schedFlag(ev){
      const t=(ev.name+' '+ev.desc).toLowerCase();
      const fi=(code)=>`<img src="https://flagcdn.com/w20/${code}.png" style="width:20px;height:14px;object-fit:cover;border-radius:2px;vertical-align:middle;box-shadow:0 1px 2px rgba(0,0,0,0.35);" alt="${code}">`;
      if(t.includes('australia')||t.includes('sydney')||t.includes('apac')||t.includes('melbourne')||t.includes('brisbane')) return fi('au');
      if(t.includes('china')||t.includes('chinese')) return fi('cn');
      if(t.includes('south korea')||t.includes('korea')||t.includes('daejeon')||t.includes('seoul')) return fi('kr');
      if(t.includes('sweden')||t.includes('stockholm')) return fi('se');
      if(t.includes('netherlands')||t.includes('utrecht')||t.includes('amsterdam')) return fi('nl');
      if(t.includes('spain')||t.includes('barcelona')||t.includes('madrid')) return fi('es');
      if(t.includes('singapore')) return fi('sg');
      if(t.includes('canada')||t.includes('vancouver')||t.includes('toronto')) return fi('ca');
      if(t.includes('japan')||t.includes('tokyo')) return fi('jp');
      if(t.includes('brazil')||t.includes('são paulo')) return fi('br');
      if(t.includes('atlanta')||t.includes('hartford')||t.includes('los angeles')||t.includes('indianapolis')||t.includes('philadelphia')||t.includes('indy')||t.includes('pax')||t.includes('gen con')||t.includes('momocon')||t.includes('usa')||t.includes('united states')||t.includes('america')) return fi('us');
      return'';
    }
    const schedHTML=SCHEDULE_2026.map(month=>{
      const rows=month.events.map(ev=>{
        const flag=schedFlag(ev);
        return`<div style="display:flex;align-items:center;gap:14px;padding:10px 14px;border-radius:8px;transition:background 0.12s;" onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background='transparent'">
          <div style="min-width:90px;font-size:12px;font-weight:600;color:var(--accent);font-family:'Syne',sans-serif;">${ev.dates}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px;">${flag?flag+' ':''} ${ev.name}</div>
            <div style="font-size:12px;color:var(--text-muted);">${ev.desc}</div>
          </div>
          ${typeBadge(ev.type)}
        </div>`;
      }).join('');
      return`<div style="margin-bottom:1.5rem;">
        <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--accent);letter-spacing:0.08em;text-transform:uppercase;padding:8px 14px;background:var(--surface2);border-radius:8px;margin-bottom:6px;border-left:3px solid var(--accent);">${month.month}</div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;">${rows}</div>
      </div>`;
    }).join('');
    return`
      <div style="margin-bottom:2rem;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem;">
          <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700;">🏆 Regional Qualifiers 2025–2026</div>
          <span style="font-size:12px;color:var(--text-muted);">${RQ_EVENTS.filter(r=>new Date(r.sortDate)>=today).length} upcoming</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;">${rqHTML}</div>
      </div>
      <div>
        <div style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700;margin-bottom:1rem;">📅 2026 Schedule</div>
        ${schedHTML}
      </div>`;
  }
  function myEventsHTML(){
    const checks=(e,prop,label)=>`<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:${e[prop]?'var(--calm)':'var(--text-muted)'};"><input type="checkbox" ${e[prop]?'checked':''} onchange="toggleMyEventProp(${e.id},'${prop}')" style="accent-color:var(--calm);"> ${label}</label>`;
    const myList=myEvents.length?myEvents.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(e=>{
      const ds=new Date(e.date).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
      return`<div class="dc" style="cursor:default;">
        <div class="dt"><div><div class="dn">${e.name}</div><div class="dl">${ds}${e.time?' · '+e.time:''}${e.location?' · '+e.location:''}</div></div>
        <button class="result-del" onclick="deleteMyEvent(${e.id})" title="Remove event" style="flex-shrink:0;">×</button></div>
        <div style="display:flex;gap:16px;margin-top:10px;flex-wrap:wrap;">
          ${checks(e,'paidEntry','Registered')}
          ${checks(e,'hotelBooked','Hotel booked')}
          ${checks(e,'flightBooked','Flight booked')}
        </div>
      </div>`;
    }).join(''):`<div class="es" style="padding:2rem 0;"><p style="color:var(--text-muted);font-size:13px;">No events added yet.</p></div>`;
    const rqOpts=RQ_EVENTS.map((rq,idx)=>`<option value="${idx}">${rq.flag} ${rq.city} RQ — ${rq.dates}</option>`).join('');
    return`<div class="dc" style="cursor:default;margin-bottom:1.5rem;">
      <div class="slbl" style="margin-bottom:1rem;">Add Event</div>
      <div style="margin-bottom:10px;">
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Quick fill from Regional Qualifier</label>
        <select id="mevt-rq" onchange="if(this.value!=='')fillFromRQ(parseInt(this.value))" style="width:100%;padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:13px;">
          <option value="">— Select an RQ event —</option>${rqOpts}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div style="grid-column:1/-1;"><label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Event name *</label><input id="mevt-name" type="text" placeholder="e.g. RiftLibrary Open #2" style="width:100%;padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:13px;"></div>
        <div><label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Date *</label><input id="mevt-date" type="date" style="width:100%;padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:13px;"></div>
        <div><label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Start time</label><input id="mevt-time" type="time" style="width:100%;padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:13px;"></div>
        <div style="grid-column:1/-1;"><label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Location</label><input id="mevt-loc" type="text" placeholder="City, venue…" style="width:100%;padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:13px;"></div>
      </div>
      <button class="btn btn-p" onclick="createMyEvent()">+ Add to My Events</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;">${myList}</div>`;
  }
  const tabs=`<div class="evt-tab-bar">
    <button class="evt-tab${activeEvtTab==='all'?' on':''}" onclick="switchEvtTab('all')">Schedule</button>
    <button class="evt-tab${activeEvtTab==='mine'?' on':''}" onclick="switchEvtTab('mine')">My Events${myEvents.length?` <span class="evt-tab-badge">${myEvents.length}</span>`:''}</button>
  </div>`;
  el.innerHTML=tabs+(activeEvtTab==='all'?allEventsHTML():myEventsHTML());
}

/* ── COLLECTION TRACKER ─────────────────────────── */
let collOwned=JSON.parse(localStorage.getItem('rl_collection')||'{}');
let collWanted=JSON.parse(localStorage.getItem('rl_collection_wanted')||'{}');
const CF2={q:'',type:'',dom:'',rar:'',set:'',show:'all',view:'grid'};

const SET_META={
  UNL:{label:'Unleashed',   grad:'linear-gradient(135deg,#c8006a 0%,#6a0030 60%,#1a000d 100%)',accent:'#f050a0',textShadow:'0 0 20px rgba(200,0,106,0.6)'},
  SFD:{label:'Spiritforged',grad:'linear-gradient(135deg,#4a5568 0%,#1a1f2e 60%,#0d0f14 100%)',accent:'#a0aec0',textShadow:'0 0 20px rgba(160,174,192,0.4)'},
  OGN:{label:'Origins',     grad:'linear-gradient(135deg,#b8860b 0%,#5a3e00 60%,#140e00 100%)',accent:'#f5c842',textShadow:'0 0 20px rgba(200,168,75,0.5)'},
  OGS:{label:'Proving Grounds',grad:'linear-gradient(135deg,#c05000 0%,#5a2000 60%,#140800 100%)',accent:'#f5922a',textShadow:'0 0 20px rgba(245,146,42,0.5)'},
  'OGN-NN':{label:'Origins | Nexus Night',grad:'linear-gradient(135deg,#1a3a5c 0%,#0a1828 60%,#05080f 100%)',accent:'#5ab4f5',textShadow:'0 0 20px rgba(90,180,245,0.5)'},
  'SFD-NN':{label:'Spiritforged | Nexus Night',grad:'linear-gradient(135deg,#2d1b5e 0%,#110a28 60%,#060412 100%)',accent:'#9f7aea',textShadow:'0 0 20px rgba(159,122,234,0.5)'},
  ARC:{label:'Arcane Box Set',grad:'linear-gradient(135deg,#5a3000 0%,#1a0e00 60%,#0a0500 100%)',accent:'#e8a84b',textShadow:'0 0 20px rgba(232,168,75,0.5)'},
  WRLD25:{label:'Worlds 2025',grad:'linear-gradient(135deg,#00406a 0%,#001428 60%,#000810 100%)',accent:'#3dd6a3',textShadow:'0 0 20px rgba(61,214,163,0.5)'},
  OPP:{label:'Organized Play Promos',grad:'linear-gradient(135deg,#3a0060 0%,#150024 60%,#08000f 100%)',accent:'#c084fc',textShadow:'0 0 20px rgba(192,132,252,0.5)'},
  JDG:{label:'Judge Promos',grad:'linear-gradient(135deg,#003a60 0%,#001424 60%,#00080f 100%)',accent:'#5ab4f5',textShadow:'0 0 20px rgba(90,180,245,0.5)'},
  PR:{label:'Promos',       grad:'linear-gradient(135deg,#003a30 0%,#001410 60%,#000806 100%)',accent:'#3dd6a3',textShadow:'0 0 20px rgba(61,214,163,0.5)'},
};

function persistColl(){
  localStorage.setItem('rl_collection',JSON.stringify(collOwned));
  localStorage.setItem('rl_collection_wanted',JSON.stringify(collWanted));
}
function setCollOwned(id,delta){
  const cur=collOwned[id]||0;
  const next=Math.max(0,cur+delta);
  if(next===0) delete collOwned[id]; else collOwned[id]=next;
  persistColl();saveCardToCloud(id);renderCollection();
}
function toggleCollWanted(id){
  if(collWanted[id]) delete collWanted[id]; else collWanted[id]=true;
  persistColl();saveCardToCloud(id);renderCollection();
}
function setCollSet(s){CF2.set=CF2.set===s?'':s;renderCollection();}

function renderCollection(){
  const el=document.getElementById('collection-content');
  if(!el)return;
  if(!cardsLoaded||!CARDS.length){
    el.innerHTML='<div style="padding:3rem;text-align:center;color:var(--text-muted);font-size:13px;">Loading cards…</div>';
    return;
  }

  const RR={Legendary:5,Epic:4,Rare:3,Uncommon:2,Common:1,Showcase:0,Promo:0};
  const rarColors={Legendary:'var(--order)',Epic:'var(--chaos)',Rare:'var(--accent)',Uncommon:'var(--calm)',Common:'var(--text-muted)',Showcase:'var(--mind)',Promo:'var(--fury)'};

  // unique cards per set (deduplicated by base name within each set)
  const setMap={};
  CARDS.forEach(c=>{
    const s=c.set||'?';
    if(!setMap[s]) setMap[s]={cards:new Map(),label:c.setLabel||s};
    const key=baseName(c.name).toLowerCase();
    const ex=setMap[s].cards.get(key);
    if(!ex||(RR[c.rarity]??1)>(RR[ex.rarity]??1)) setMap[s].cards.set(key,c);
  });

  // overall unique pool (across all sets, best rarity globally)
  const globalSeen=new Map();
  CARDS.forEach(c=>{
    const key=baseName(c.name).toLowerCase();
    const ex=globalSeen.get(key);
    if(!ex||(RR[c.rarity]??1)>(RR[ex.rarity]??1)) globalSeen.set(key,c);
  });
  const allUnique=[...globalSeen.values()].sort((a,b)=>a.name.localeCompare(b.name));
  const totalUnique=allUnique.length;
  const totalOwned=allUnique.filter(c=>collOwned[c.id]).length;
  const totalComplete=allUnique.filter(c=>(collOwned[c.id]||0)>=3).length;
  const totalWanted=Object.keys(collWanted).length;
  const totalCopies=Object.values(collOwned).reduce((a,v)=>a+v,0);

  // build set progress cards
  const SET_ORDER=['UNL','SFD','SFD-NN','ARC','OGN','OGS','OGN-NN','WRLD25','OPP','JDG','PR'];
  const orderedSets=[...SET_ORDER.filter(s=>setMap[s]),...Object.keys(setMap).filter(s=>!SET_ORDER.includes(s))];

  let html=`<div class="ph"><h1>My Collection</h1><p>Track your Riftbound card collection</p></div>`;

  // overall mini stat bar
  const overallPct=totalUnique?Math.round(totalOwned/totalUnique*100):0;
  html+=`<div style="display:flex;align-items:center;gap:16px;margin-bottom:1.5rem;padding:12px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;flex-wrap:wrap;">
    <div style="display:flex;gap:20px;flex-wrap:wrap;flex:1;">
      <div><span style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:var(--accent);">${overallPct}%</span><span style="font-size:12px;color:var(--text-muted);margin-left:6px;">overall</span></div>
      <div><span style="font-weight:700;">${totalOwned}</span><span style="font-size:12px;color:var(--text-muted);"> / ${totalUnique} unique owned</span></div>
      <div><span style="font-weight:700;color:var(--calm);">${totalComplete}</span><span style="font-size:12px;color:var(--text-muted);"> playsets</span></div>
      <div><span style="font-weight:700;">${totalCopies}</span><span style="font-size:12px;color:var(--text-muted);"> total copies</span></div>
      <div><span style="font-weight:700;color:var(--chaos);">${totalWanted}</span><span style="font-size:12px;color:var(--text-muted);"> wishlisted</span></div>
    </div>
  </div>`;

  // set cards grid
  html+=`<div style="font-family:'Syne',sans-serif;font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">Sets</div>`;
  html+=`<div class="coll-set-grid">`;
  orderedSets.forEach(sid=>{
    const sd=setMap[sid];
    const meta=SET_META[sid]||{label:sd.label||sid,grad:'linear-gradient(135deg,var(--surface3),var(--surface2))',accent:'var(--accent)',textShadow:'none'};
    const setCards=[...sd.cards.values()];
    const setTotal=setCards.length;
    const setOwned=setCards.filter(c=>collOwned[c.id]).length;
    const setComplete=setCards.filter(c=>(collOwned[c.id]||0)>=3).length;
    const setPct=setTotal?Math.round(setOwned/setTotal*100):0;
    const isActive=CF2.set===sid;
    const releaseYear=setCards[0]?'':'' ;
    html+=`<div class="coll-set-card${isActive?' active':''}" onclick="setCollSet('${sid}')">
      <div class="coll-set-art" style="background:${meta.grad};">
        <div class="coll-set-name" style="color:${meta.accent};text-shadow:${meta.textShadow};">${meta.label||sd.label}</div>
      </div>
      <div class="coll-set-body">
        <div class="coll-set-info">
          <span class="coll-set-id">${sid}</span>
          <span class="coll-set-count">${setTotal} cards</span>
          <span class="coll-set-pct" style="color:${setPct===100?'var(--calm)':'var(--accent)'};">${setPct}%</span>
        </div>
        <div class="coll-set-prog-track"><div class="coll-set-prog-fill" style="width:${setPct}%;background:${setPct===100?'var(--calm)':meta.accent};"></div></div>
        <div class="coll-set-bottom">
          <span style="font-size:11px;color:var(--text-muted);">${setOwned} / ${setTotal}</span>
          ${setComplete>0?`<span style="font-size:11px;color:var(--calm);">${setComplete} complete</span>`:''}
        </div>
      </div>
    </div>`;
  });
  html+=`</div>`;

  // divider + card grid section
  html+=`<div style="margin-top:2rem;margin-bottom:1rem;display:flex;align-items:center;gap:10px;">
    <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:700;">${CF2.set?(SET_META[CF2.set]?.label||CF2.set):'All Cards'}</div>
    ${CF2.set?`<button class="coll-pill" onclick="setCollSet('')" style="font-size:11px;">✕ Show all sets</button>`:''}
  </div>`;

  // filter source
  let source=allUnique;
  if(CF2.q) source=source.filter(c=>c.name.toLowerCase().includes(CF2.q)||c.txt.toLowerCase().includes(CF2.q));
  if(CF2.type) source=source.filter(c=>c.type===CF2.type||(CF2.type==='Champion'&&(c.supertype||'').toLowerCase().includes('champion')));
  if(CF2.dom) source=source.filter(c=>c.doms.includes(CF2.dom));
  if(CF2.rar) source=source.filter(c=>c.rarity===CF2.rar);
  if(CF2.set) source=source.filter(c=>c.set===CF2.set);
  if(CF2.show==='owned') source=source.filter(c=>collOwned[c.id]);
  if(CF2.show==='missing') source=source.filter(c=>!collOwned[c.id]);
  if(CF2.show==='complete') source=source.filter(c=>(collOwned[c.id]||0)>=3);
  if(CF2.show==='wanted') source=source.filter(c=>collWanted[c.id]);

  const rarityGroups={Legendary:0,Epic:0,Rare:0,Uncommon:0,Common:0};
  const rarityTotal={Legendary:0,Epic:0,Rare:0,Uncommon:0,Common:0};
  allUnique.filter(c=>!CF2.set||c.set===CF2.set).forEach(c=>{
    const r=c.rarity;if(rarityTotal[r]!==undefined){rarityTotal[r]++;if(collOwned[c.id])rarityGroups[r]++;}
  });

  // controls
  html+=`<div class="coll-controls">
    <div class="coll-search-wrap">
      <span class="coll-search-icon">⌕</span>
      <input type="text" placeholder="Search cards…" value="${CF2.q.replace(/"/g,'&quot;')}" oninput="CF2.q=this.value;renderCollection()">
    </div>
    <select class="coll-select" onchange="CF2.type=this.value;renderCollection()">
      <option value="">All Types</option>
      <option${CF2.type==='Champion'?' selected':''} value="Champion">Champion</option>
      <option${CF2.type==='Unit'?' selected':''} value="Unit">Unit</option>
      <option${CF2.type==='Spell'?' selected':''} value="Spell">Spell</option>
      <option${CF2.type==='Gear'?' selected':''} value="Gear">Gear</option>
      <option${CF2.type==='Rune'?' selected':''} value="Rune">Rune</option>
    </select>
    <select class="coll-select" onchange="CF2.rar=this.value;renderCollection()">
      <option value="">All Rarities</option>
      ${Object.keys(rarityGroups).map(r=>`<option${CF2.rar===r?' selected':''} value="${r}">${r}</option>`).join('')}
    </select>
    <div class="coll-view-toggle">
      <button class="coll-pill${CF2.view==='grid'?' on':''}" onclick="CF2.view='grid';renderCollection()">⊞ Grid</button>
      <button class="coll-pill${CF2.view==='list'?' on':''}" onclick="CF2.view='list';renderCollection()">☰ List</button>
    </div>
  </div>`;

  html+=`<div class="coll-filter-row">
    ${['all','owned','missing','complete','wanted'].map(s=>`<button class="coll-pill${CF2.show===s?' on':''}" onclick="CF2.show='${s}';renderCollection()">${{all:'All',owned:'Owned',missing:'Missing',complete:'Playset',wanted:'♥ Wishlist'}[s]}</button>`).join('')}
    <span style="margin-left:4px;font-size:12px;color:var(--text-muted);">${source.length} cards</span>
    ${(CF2.q||CF2.type||CF2.dom||CF2.rar||CF2.show!=='all')?`<button class="coll-pill" onclick="CF2.q='';CF2.type='';CF2.dom='';CF2.rar='';CF2.show='all';renderCollection()" style="margin-left:auto;">✕ Clear</button>`:''}
  </div>`;

  html+=`<div class="coll-filter-row">
    ${['fury','chaos','calm','mind','body','order'].map(d=>`<button class="coll-dom-pill ${d}${CF2.dom===d?' on':''}" onclick="CF2.dom=CF2.dom==='${d}'?'':'${d}';renderCollection()">${d[0].toUpperCase()+d.slice(1)}</button>`).join('')}
  </div>`;

  if(!source.length){
    html+=`<div class="coll-empty">No cards match your filters.</div>`;
    el.innerHTML=html;return;
  }

  if(CF2.view==='grid'){
    html+=`<div class="coll-grid">`;
    source.forEach(c=>{
      const owned=collOwned[c.id]||0;
      const wanted=!!collWanted[c.id];
      const isComplete=owned>=3;
      const cls=isComplete?'complete':owned>0?'owned':wanted?'wanted':'';
      const si=c.id.replace(/'/g,"\\'");
      html+=`<div class="coll-card ${cls}" title="${c.name}">
        ${c.imageUrl?`<img src="${c.imageUrl}" alt="${c.name}" loading="lazy">`:`<div class="coll-card-no-img">${c.name}</div>`}
        <div class="coll-card-overlay"></div>
        ${isComplete?'<div class="coll-card-badge coll-badge-complete">✓ ×3</div>':owned>0?`<div class="coll-card-badge coll-badge-owned">×${owned}</div>`:wanted?'<div class="coll-card-badge coll-badge-wanted">♥</div>':''}
        <button class="coll-wanted-btn${wanted?' active':''}" onclick="event.stopPropagation();toggleCollWanted('${si}')" title="${wanted?'Remove from wishlist':'Add to wishlist'}">♥</button>
        <div class="coll-card-actions">
          <button class="coll-copy-btn coll-copy-minus" onclick="event.stopPropagation();setCollOwned('${si}',-1)" title="Remove copy">−</button>
          <span class="coll-copy-count">${owned}/3</span>
          <button class="coll-copy-btn coll-copy-plus" onclick="event.stopPropagation();setCollOwned('${si}',1)" title="Add copy">+</button>
        </div>
        <div class="coll-card-name">${c.name}</div>
      </div>`;
    });
    html+=`</div>`;
  } else {
    html+=`<div class="coll-list-view">`;
    source.forEach(c=>{
      const owned=collOwned[c.id]||0;
      const isComplete=owned>=3;
      const cls=isComplete?'complete':owned>0?'owned':'';
      const si=c.id.replace(/'/g,"\\'");
      const rarCol=rarColors[c.rarity]||'var(--text-muted)';
      html+=`<div class="coll-list-row ${cls}">
        ${c.imageUrl?`<img class="coll-list-thumb" src="${c.imageUrl}" alt="${c.name}" loading="lazy">`:`<div class="coll-list-thumb"></div>`}
        <div class="coll-list-name">${c.name}</div>
        <div class="coll-list-type">${c.type}</div>
        <div class="coll-list-rar" style="color:${rarCol};font-size:11px;font-weight:600;">${c.rarity}</div>
        <div class="coll-list-copies">
          ${[0,1,2].map(i=>`<div class="coll-list-dot${owned>i?(isComplete?' filled-max':' filled'):''}"></div>`).join('')}
        </div>
        <div style="display:flex;gap:4px;margin-left:10px;">
          <button class="coll-copy-btn coll-copy-minus" style="width:22px;height:22px;font-size:12px;" onclick="setCollOwned('${si}',-1)">−</button>
          <button class="coll-copy-btn coll-copy-plus" style="width:22px;height:22px;font-size:12px;" onclick="setCollOwned('${si}',1)">+</button>
        </div>
        <button class="coll-wanted-btn${collWanted[c.id]?' active':''}" style="opacity:1;position:static;width:22px;height:22px;margin-left:4px;" onclick="toggleCollWanted('${si}')" title="Wishlist">♥</button>
      </div>`;
    });
    html+=`</div>`;
  }

  el.innerHTML=html;
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
  let _hoverTimeout=null,_activeCard=null;
  function pos(e){
    const pw=380;
    let x=e.clientX+18,y=e.clientY-160;
    if(x+pw>window.innerWidth-12) x=e.clientX-pw-18;
    y=Math.max(10,Math.min(y,window.innerHeight-380));
    preview.style.left=x+'px';preview.style.top=y+'px';
  }
  function inTopThird(e,card){
    const r=card.getBoundingClientRect();
    return e.clientY<=r.top+r.height/3;
  }
  function triggerPreview(card,e){
    clearTimeout(_hoverTimeout);
    _hoverTimeout=setTimeout(()=>{
      const bf=card.dataset.hoverBf==='1';
      preview.innerHTML=`<img src="${card.dataset.hoverImg}" alt="" style="width:100%;height:100%;object-fit:${bf?'cover':'contain'};display:block;">`;
      preview.style.display='block';
      preview.style.aspectRatio=bf?'3.5/2.5':'2.5/3.5';
      pos(e);
    },120);
  }
  document.addEventListener('mouseover',function(e){
    const card=e.target.closest('[data-hover-img]');
    if(!card||!card.dataset.hoverImg){clearTimeout(_hoverTimeout);preview.style.display='none';_activeCard=null;return;}
    if(card!==_activeCard){clearTimeout(_hoverTimeout);preview.style.display='none';_activeCard=card;}
    if(inTopThird(e,card)) triggerPreview(card,e);
  });
  document.addEventListener('mousemove',function(e){
    if(!_activeCard){if(preview.style.display!=='none') pos(e);return;}
    if(inTopThird(e,_activeCard)){
      if(preview.style.display==='none') triggerPreview(_activeCard,e);
      else pos(e);
    } else {
      clearTimeout(_hoverTimeout);
      preview.style.display='none';
    }
  });
  document.addEventListener('mouseout',function(e){
    const card=e.target.closest('[data-hover-img]');
    if(card&&!card.contains(e.relatedTarget)){clearTimeout(_hoverTimeout);preview.style.display='none';_activeCard=null;}
  });
})();

/* ═══════════════════════════════════════════════════════════════
   AUTH + CLOUD SYNC (Supabase)
   ═══════════════════════════════════════════════════════════════ */

const SUPABASE_URL  = 'https://rxolycfdleetydbbehep.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4b2x5Y2ZkbGVldHlkYmJlaGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTg1NjIsImV4cCI6MjA5Mjg3NDU2Mn0.d2iPG_2hPAwpjbX466-4ZAb1hO83CEtP4tg-M-ky_BA';
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

async function initAuth() {
  const { data: { session } } = await _sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    renderAuthNav(currentUser);
    syncCloudDecks();
  } else {
    renderAuthNav(null);
  }
  _sb.auth.onAuthStateChange((_event, session) => {
    const wasLoggedIn = !!currentUser;
    currentUser = session ? session.user : null;
    renderAuthNav(currentUser);
    if (currentUser && !wasLoggedIn) syncCloudDecks();
  });
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
    var meta = user.user_metadata || {};
    var name = meta.username || meta.full_name || user.email.split('@')[0];
    var initials = name.slice(0,2).toUpperCase();
    var wrap = document.createElement('div');
    wrap.className = 'auth-drop-wrap';
    var pill = document.createElement('div');
    pill.className = 'auth-user-pill';
    pill.onclick = toggleUserDrop;
    if (meta.avatar_url) {
      var img = document.createElement('img');
      img.className = 'auth-avatar';
      img.src = meta.avatar_url;
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
    uname.textContent = name;
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

function checkPasswordStrength() {
  const pw = document.getElementById('reg-password').value;
  const bar = document.getElementById('pw-strength-bar');
  const fill = document.getElementById('pw-strength-fill');
  const label = document.getElementById('pw-strength-label');
  if (!pw) { bar.style.display='none'; label.textContent=''; return; }
  bar.style.display = 'block';
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [{w:'20%',c:'#ef4444',t:'Weak'},{w:'40%',c:'#f97316',t:'Fair'},{w:'60%',c:'#eab308',t:'Good'},{w:'80%',c:'#22c55e',t:'Strong'},{w:'100%',c:'#16a34a',t:'Very strong'}];
  const lvl = levels[Math.min(score-1, 4)] || levels[0];
  fill.style.width = lvl.w; fill.style.background = lvl.c;
  label.style.color = lvl.c; label.textContent = lvl.t;
  checkPasswordMatch();
}

function checkPasswordMatch() {
  const pw  = document.getElementById('reg-password').value;
  const pw2 = document.getElementById('reg-password-confirm').value;
  const label = document.getElementById('pw-match-label');
  if (!pw2) { label.textContent=''; return; }
  if (pw === pw2) { label.style.color='#22c55e'; label.textContent='✓ Passwords match'; }
  else            { label.style.color='#ef4444'; label.textContent='✗ Passwords do not match'; }
}

async function submitRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-password-confirm').value;
  if (!username || !email || !password || !confirm) { showAuthError('All fields required'); return; }
  if (password !== confirm) { showAuthError('Passwords do not match'); return; }
  if (password.length < 8) { showAuthError('Password must be at least 8 characters'); return; }
  if (!/[A-Z]/.test(password)) { showAuthError('Password must contain at least one uppercase letter'); return; }
  if (!/[0-9]/.test(password)) { showAuthError('Password must contain at least one number'); return; }
  const btn = document.querySelector('#auth-form-register .auth-submit');
  btn.textContent = 'Creating account…'; btn.disabled = true;
  try {
    const { error } = await _sb.auth.signUp({ email, password, options: { data: { username } } });
    if (error) throw error;
    showAuthSuccess('Check your email to confirm your account!');
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
    const { data, error } = await _sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    renderAuthNav(data.user);
    closeAuthModal();
    toast('Welcome back!');
    syncCloudDecks();
  } catch (e) {
    showAuthError(e.message || 'Login failed');
  } finally { btn.textContent = 'Log in'; btn.disabled = false; }
}

function oauthLogin(provider) {
  _sb.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.href } });
}

async function logOut() {
  await _sb.auth.signOut();
  currentUser = null;
  myDecks = [];
  myEvents = [];
  collOwned = {}; collWanted = {};
  renderAuthNav(null);
  if(document.getElementById('page-decks').classList.contains('active')) renderDecks();
  if(document.getElementById('page-events').classList.contains('active')) renderEvents();
  if(document.getElementById('page-collection').classList.contains('active')) renderCollection();
  toast('Logged out');
}

async function syncCloudDecks() {
  if (!currentUser) return;
  try {
    const { data: cloudDecks, error } = await _sb.from('decks').select('*').eq('user_id', currentUser.id);
    if (error) throw error;
    cloudDecks.forEach(cd => {
      const localIdx = myDecks.findIndex(d => d.cloud_id === cd.id);
      const merged = cloudToLocal(cd);
      if (localIdx >= 0) {
        if (!myDecks[localIdx].updated_at || new Date(cd.updated_at) > new Date(myDecks[localIdx].updated_at)) {
          // Preserve local integer ID so onclick attributes stay valid
          merged.id = myDecks[localIdx].id;
          myDecks[localIdx] = merged;
        }
      } else {
        // Assign a stable local integer ID to any new cloud deck
        merged.id = nextId++;
        myDecks.unshift(merged);
      }
    });
    const localOnlyDecks = myDecks.filter(d => !d.cloud_id);
    for (const local of localOnlyDecks) {
      try {
        const { data: created, error: e2 } = await _sb.from('decks').insert(localToCloud(local)).select().single();
        if (e2) throw e2;
        const idx = myDecks.findIndex(d => d.id === local.id);
        if (idx >= 0) myDecks[idx].cloud_id = created.id;
      } catch (e) { console.warn('Failed to push local deck:', e); }
    }
    persist();
    if (document.getElementById('page-decks').classList.contains('active')) renderDecks();
    toast('Decks synced ☁');
  } catch (e) { console.warn('Sync failed:', e); }
  loadEventsFromCloud();
  loadCollectionFromCloud();
}

function cloudToLocal(cd) {
  const d = cd.data || {};
  return {
    id:             cd.id,  // overwritten by caller to preserve local integer id
    cloud_id:       cd.id,
    name:           cd.name,
    legend:         cd.legend,
    domains:        d.domains      || [],
    format:         d.format       || 'Constructed',
    wins:           cd.wins        || 0,
    losses:         cd.losses      || 0,
    desc:           d.desc         || '',
    updated_at:     cd.updated_at,
    sideboardNotes: d.sideboardNotes || '',
    sideboard:      d.sideboard    || [],
    results:        d.results      || [],
    cards:          d.cards        || [],
    battlefields:   d.battlefields || [null, null, null],
    champion:       d.champion     || null,
    runes:          d.runes        || [],
  };
}

function localToCloud(local) {
  return {
    user_id: currentUser.id,
    name:    local.name,
    legend:  local.legend,
    wins:    local.wins   || 0,
    losses:  local.losses || 0,
    data: {
      domains:        local.domains        || [],
      format:         local.format         || 'Constructed',
      desc:           local.desc           || '',
      cards:          local.cards          || [],
      sideboard:      local.sideboard      || [],
      sideboardNotes: local.sideboardNotes || '',
      results:        local.results        || [],
      battlefields:   local.battlefields   || [null, null, null],
      champion:       local.champion       || null,
      runes:          local.runes          || [],
    },
  };
}

async function saveEventsToCloud() {
  if (!currentUser) return;
  try {
    for (const evt of myEvents) {
      const row = { user_id: currentUser.id, name: evt.name, date: evt.date, time: evt.time||'', location: evt.location||'', paid_entry: evt.paidEntry||false, hotel_booked: evt.hotelBooked||false, flight_booked: evt.flightBooked||false };
      if (evt.cloud_id) {
        await _sb.from('my_events').update(row).eq('id', evt.cloud_id);
      } else {
        const { data, error } = await _sb.from('my_events').insert(row).select().single();
        if (!error && data) { evt.cloud_id = data.id; localStorage.setItem('rl_myEvents', JSON.stringify(myEvents)); }
      }
    }
  } catch(e) { console.warn('Events cloud save failed:', e); }
}

async function loadEventsFromCloud() {
  if (!currentUser) return;
  try {
    const { data, error } = await _sb.from('my_events').select('*').eq('user_id', currentUser.id);
    if (error || !data || !data.length) return;
    myEvents = data.map(cd => ({ id: cd.id, cloud_id: cd.id, name: cd.name, date: cd.date, time: cd.time||'', location: cd.location||'', paidEntry: cd.paid_entry||false, hotelBooked: cd.hotel_booked||false, flightBooked: cd.flight_booked||false }));
    localStorage.setItem('rl_myEvents', JSON.stringify(myEvents));
    if (document.getElementById('page-events').classList.contains('active')) renderEvents();
  } catch(e) { console.warn('Events cloud load failed:', e); }
}

async function saveCardToCloud(cardId) {
  if (!currentUser) return;
  try {
    const owned = collOwned[cardId] || 0;
    const wanted = !!collWanted[cardId];
    if (owned === 0 && !wanted) {
      await _sb.from('collection').delete().eq('user_id', currentUser.id).eq('card_id', cardId);
    } else {
      await _sb.from('collection').upsert({ user_id: currentUser.id, card_id: cardId, owned, wanted, updated_at: new Date().toISOString() }, { onConflict: 'user_id,card_id' });
    }
  } catch(e) { console.warn('Collection cloud save failed:', e); }
}

async function loadCollectionFromCloud() {
  if (!currentUser) return;
  try {
    const { data, error } = await _sb.from('collection').select('*').eq('user_id', currentUser.id);
    if (error || !data || !data.length) return;
    collOwned = {}; collWanted = {};
    data.forEach(row => { if (row.owned > 0) collOwned[row.card_id] = row.owned; if (row.wanted) collWanted[row.card_id] = true; });
    persistColl();
    if (document.getElementById('page-collection').classList.contains('active')) renderCollection();
  } catch(e) { console.warn('Collection cloud load failed:', e); }
}

async function saveToCloud(deckId) {
  if (!currentUser) return;
  const deck = myDecks.find(d => d.id === deckId);
  if (!deck) return;
  try {
    const payload = localToCloud(deck);
    if (deck.cloud_id) {
      const { error } = await _sb.from('decks').update(payload).eq('id', deck.cloud_id);
      if (error) throw error;
    } else {
      const { data: created, error } = await _sb.from('decks').insert(payload).select().single();
      if (error) throw error;
      deck.cloud_id = created.id;
      persist();
    }
  } catch (e) { console.warn('Cloud save failed:', e); }
}

initAuth();
