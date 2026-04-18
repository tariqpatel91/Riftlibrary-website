/* ═══════════════════════════════════════════════════
   RIFTLIBRARY PLAY ENGINE  — peer-to-peer via PeerJS
   ═══════════════════════════════════════════════════ */

// ── State ──────────────────────────────────────────
let peer=null, conn=null;
let isHost=false, gameStarted=false;
let myPeerRole=''; // 'host'|'guest'
let GS={  // Game State
  myLife:20, oppLife:20,
  myHand:[], myDeck:[], myDiscard:[], myField:{battle:[],support:[]}, myRunes:[],
  oppHandCount:0, oppDeckCount:0, oppDiscCount:0, oppField:{battle:[],support:[]},
  turn:'host', // whose turn: 'host'|'guest'
  phase:'draw',
  myName:'', oppName:'',
};
let dragCardId=null, dragFromZone=null, dragFromZoneKey=null;
let chatOpen=false;

// ── DOM helpers ────────────────────────────────────
const $=id=>document.getElementById(id);
function setStatus(who,msg,col){
  const el=$(who+'-status');
  if(el){el.textContent=msg;el.style.color=col||'var(--text-muted)';}
}

// ── Generate room code ─────────────────────────────
function genCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c='RIFT-';
  for(let i=0;i<4;i++)c+=chars[Math.floor(Math.random()*chars.length)];
  return c;
}

// ── Build a shuffled deck array from saved deck ────
function buildDeckFromSaved(deckId){
  const deck=myDecks.find(d=>d.id==deckId);
  if(!deck||!deck.cards||!deck.cards.length){
    return Array.from({length:40},(_,i)=>({uid:'blank-'+i,id:'blank',name:'Unknown',type:'Unit',dom:'order',doms:['order'],cost:0,might:null,power:null,rarity:'',txt:'',artist:''}));
  }
  let arr=[];
  deck.cards.forEach(entry=>{
    const cd=CARDS.find(c=>c.id===entry.id)||{id:entry.id,name:entry.n,type:entry.t||'Unit',dom:'order',doms:['order'],cost:0,might:null,power:null,rarity:'',txt:'',artist:''};
    for(let i=0;i<(entry.cnt||1);i++){
      arr.push({...cd,uid:entry.id+'-'+i+'-'+Math.random().toString(36).slice(2)});
    }
  });
  for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
  return arr;
}

// ── HOST ───────────────────────────────────────────
function hostGame(){
  const deckId=$('host-deck-sel').value;
  const name=($('host-name').value.trim()||'Host');
  if(!deckId){setStatus('host','Please select a deck first','var(--fury)');return;}
  GS.myName=name;
  setStatus('host','Connecting…');
  const code=genCode();
  peer=new Peer('RFTLIB-'+code.replace('-',''), {debug:0});
  peer.on('open',()=>{
    isHost=true; myPeerRole='host';
    $('host-game-id').textContent=code;
    $('host-id-box').style.display='';
    setStatus('host','Room created! Share your Game ID.','var(--calm)');
    GS.myDeck=buildDeckFromSaved(deckId);
    GS.myHand=[];
    for(let i=0;i<5;i++) GS.myHand.push(GS.myDeck.pop());
  });
  peer.on('connection',c=>{
    conn=c;
    setupConn();
    $('host-wait-msg').textContent='Opponent connected! Starting…';
    $('host-wait-msg').style.color='var(--calm)';
    setTimeout(()=>{
      send({type:'start',hostName:GS.myName,turn:'host'});
      startBoard();
    },600);
  });
  peer.on('error',e=>setStatus('host','Error: '+e.message,'var(--fury)'));
}

function copyGameId(){
  const id=$('host-game-id').textContent;
  navigator.clipboard?.writeText(id).then(()=>toast('Game ID copied!'));
}

// ── JOIN ───────────────────────────────────────────
function joinGame(){
  const deckId=$('join-deck-sel').value;
  const name=($('join-name').value.trim()||'Guest');
  const code=($('join-game-id').value.trim().toUpperCase());
  if(!deckId){setStatus('join','Please select a deck first','var(--fury)');return;}
  if(!code||!code.startsWith('RIFT-')){setStatus('join','Enter a valid Game ID (e.g. RIFT-A1B2)','var(--fury)');return;}
  GS.myName=name;
  setStatus('join','Connecting…');
  peer=new Peer({debug:0});
  peer.on('open',()=>{
    myPeerRole='guest';
    GS.myDeck=buildDeckFromSaved(deckId);
    GS.myHand=[];
    for(let i=0;i<5;i++) GS.myHand.push(GS.myDeck.pop());
    const hostPeerId='RFTLIB-'+code.replace('RIFT-','');
    conn=peer.connect(hostPeerId,{reliable:true});
    setupConn();
    setStatus('join','Finding host…');
  });
  peer.on('error',e=>setStatus('join','Could not connect. Check the Game ID.','var(--fury)'));
}

// ── Connection setup ───────────────────────────────
function setupConn(){
  conn.on('open',()=>{
    if(myPeerRole==='guest'){
      setStatus('join','Connected! Waiting for host…','var(--calm)');
      send({type:'hello',guestName:GS.myName,handCount:GS.myHand.length,deckCount:GS.myDeck.length});
    }
  });
  conn.on('data',handleMsg);
  conn.on('close',()=>{
    if(gameStarted) addChat('⚡ Opponent disconnected.','sys');
  });
  conn.on('error',()=>{
    if(myPeerRole==='guest') setStatus('join','Connection error. Try again.','var(--fury)');
  });
}

function send(msg){if(conn&&conn.open)conn.send(msg);}

// ── Message handler ────────────────────────────────
function handleMsg(msg){
  switch(msg.type){
    case 'hello': {
      GS.oppName=msg.guestName||'Opponent';
      GS.oppHandCount=msg.handCount||0;
      GS.oppDeckCount=msg.deckCount||0;
      break;
    }
    case 'start': {
      GS.oppName=msg.hostName||'Opponent';
      GS.turn=msg.turn||'host';
      send({type:'ready',guestName:GS.myName,handCount:GS.myHand.length,deckCount:GS.myDeck.length});
      startBoard();
      break;
    }
    case 'ready': {
      GS.oppName=msg.guestName||'Opponent';
      GS.oppHandCount=msg.handCount||0;
      GS.oppDeckCount=msg.deckCount||0;
      renderBoard();
      break;
    }
    case 'life': {
      GS.oppLife=msg.value;
      renderInfoBars();
      break;
    }
    case 'play_card': {
      const zkey=msg.zone;
      GS.oppField[zkey]=[...(GS.oppField[zkey]||[]),{...msg.card,mine:false}];
      GS.oppHandCount=Math.max(0,(GS.oppHandCount||1)-1);
      renderBoard();
      addChat('\u{1F0CF} '+GS.oppName+' played '+msg.card.name+' to '+zkey,'sys');
      break;
    }
    case 'tap_card': {
      toggleTapOnField(msg.zone,msg.uid,false);
      renderBoard();
      break;
    }
    case 'discard_card': {
      removeFromOppField(msg.zone,msg.uid);
      GS.oppDiscCount=(GS.oppDiscCount||0)+1;
      renderBoard();
      break;
    }
    case 'end_turn': {
      GS.turn=myPeerRole;
      addChat('Your turn! ('+GS.oppName+' ended their turn)','sys');
      renderBoard();
      break;
    }
    case 'draw': {
      GS.oppHandCount=(GS.oppHandCount||0)+1;
      GS.oppDeckCount=Math.max(0,(GS.oppDeckCount||1)-1);
      renderInfoBars();
      break;
    }
    case 'chat': {
      addChat(GS.oppName+': '+msg.text,'opp');
      break;
    }
    case 'shuffle': {
      GS.oppDeckCount=msg.deckCount||GS.oppDeckCount;
      renderInfoBars();
      break;
    }
    case 'concede': {
      addChat(GS.oppName+' conceded the game.','sys');
      showGameOver(GS.oppName+' conceded. You win!');
      break;
    }
    case 'move_card': {
      const mfrom=msg.from, mto=msg.to;
      const midx=(GS.oppField[mfrom]||[]).findIndex(c=>c.uid===msg.uid);
      if(midx>=0){ const mc=GS.oppField[mfrom].splice(midx,1)[0]; GS.oppField[mto]=[...(GS.oppField[mto]||[]),mc]; }
      renderBoard();
      break;
    }
  }
}

// ── Start board ────────────────────────────────────
function startBoard(){
  gameStarted=true;
  $('play-lobby').style.display='none';
  $('play-board').style.display='';
  renderBoard();
  addChat('Game started! Good luck!','sys');
}

function renderBoard(){
  const myTurn=(GS.turn===myPeerRole);
  $('board-title').textContent='⚔ '+GS.myName+' vs '+GS.oppName;
  const badge=$('board-turn-badge');
  badge.textContent=myTurn?'Your Turn':'Opponent\'s Turn';
  badge.className=myTurn?'':'enemy-turn';
  $('end-turn-btn').disabled=!myTurn;
  $('end-turn-btn').style.opacity=myTurn?'1':'0.5';
  renderMyHand();
  renderField('battle');
  renderField('support');
  renderInfoBars();
}

function renderInfoBars(){
  $('my-name-label').textContent=GS.myName||'You';
  $('my-life').textContent=GS.myLife;
  $('my-hand-count').textContent=GS.myHand.length;
  $('my-deck-count').textContent=GS.myDeck.length;
  $('my-disc-count').textContent=GS.myDiscard.length;
  $('my-rune-count').textContent=GS.myRunes.length;
  $('my-counts').textContent='Deck: '+GS.myDeck.length+' · Disc: '+GS.myDiscard.length;
  $('opp-name-label').textContent=GS.oppName||'Opponent';
  $('opp-life').textContent=GS.oppLife;
  $('opp-hand-count').textContent=GS.oppHandCount||0;
  $('opp-counts').textContent='Hand: '+(GS.oppHandCount||0)+' · Deck: '+(GS.oppDeckCount||0);
  const oppHand=$('opp-hand');
  oppHand.innerHTML='';
  for(let i=0;i<(GS.oppHandCount||0);i++){
    const b=document.createElement('div');b.className='opp-card-back';
    oppHand.appendChild(b);
  }
}

// ── Render my hand ─────────────────────────────────
function renderMyHand(){
  const container=$('my-hand');
  container.innerHTML='';
  GS.myHand.forEach((card,idx)=>{
    const el=document.createElement('div');
    el.className='hcard';
    el.draggable=true;
    el.dataset.uid=card.uid;
    el.dataset.idx=idx;
    el.innerHTML=`
      <div class="hc-dom" style="background:${domColor(card.dom)};"></div>
      ${card.cost!==null?`<div class="hc-cost">${card.cost}</div>`:''}
      <div class="hc-name">${card.name}</div>`;
    el.addEventListener('dragstart',e=>{
      dragCardId=card.uid; dragFromZone='hand';
      e.dataTransfer.effectAllowed='move';
      el.classList.add('dragging');
    });
    el.addEventListener('dragend',()=>el.classList.remove('dragging'));
    el.addEventListener('click',()=>showCardDetail(card));
    container.appendChild(el);
  });
}

// ── Render field zones ─────────────────────────────
function renderField(zoneKey){
  const myCards=GS.myField[zoneKey]||[];
  const oppCards=GS.oppField[zoneKey]||[];
  const combined=[...oppCards,...myCards];
  const container=$(zoneKey+'-cards');
  container.innerHTML='';
  combined.forEach(card=>{
    const el=document.createElement('div');
    el.className='bcard'+(card.tapped?' tapped':'');
    el.dataset.uid=card.uid;
    el.dataset.zone=zoneKey;
    el.dataset.mine=card.mine?'1':'0';
    el.innerHTML=`
      <div class="bc-dom" style="background:${domColor(card.dom)};"></div>
      ${card.cost!==null?`<div class="bc-cost">${card.cost}</div>`:''}
      <div class="bc-name">${card.name}</div>
      ${card.might!==null?`<div class="bc-might">⚔${card.might}</div>`:''}
      <div class="bcard-menu" id="menu-${card.uid}">
        ${card.mine?`<button class="bcm-btn" onclick="tapCard('${zoneKey}','${card.uid}')">Tap / Untap</button>
        <button class="bcm-btn" onclick="discardFromField('${zoneKey}','${card.uid}')">Discard</button>
        <button class="bcm-btn" onclick="returnToHand('${zoneKey}','${card.uid}')">Return to hand</button>
        <button class="bcm-btn" onclick="showCardDetail(getFieldCard('${zoneKey}','${card.uid}'))">View details</button>`
        :`<button class="bcm-btn" onclick="showCardDetail(getFieldCard('${zoneKey}','${card.uid}'))">View details</button>`}
      </div>`;
    if(card.mine){
      el.draggable=true;
      el.addEventListener('dragstart',ev=>{
        dragCardId=card.uid; dragFromZone='field'; dragFromZoneKey=zoneKey;
        ev.dataTransfer.effectAllowed='move';
        el.style.opacity='0.4';
      });
      el.addEventListener('dragend',()=>el.style.opacity='');
    }
    el.addEventListener('contextmenu',e=>{e.preventDefault();toggleCardMenu(card.uid);});
    el.addEventListener('click',()=>showCardDetail(card));
    container.appendChild(el);
  });
  const zoneEl=$(zoneKey+'-zone');
  if(zoneEl){
    zoneEl.ondragover=e=>{e.preventDefault();zoneEl.classList.add('drag-over');};
    zoneEl.ondragleave=()=>zoneEl.classList.remove('drag-over');
    zoneEl.ondrop=e=>{e.preventDefault();zoneEl.classList.remove('drag-over');dropToZone(e,zoneKey);};
  }
}

function dropToZone(e,zoneKey){
  e.preventDefault();
  if(!dragCardId)return;
  const myTurn=(GS.turn===myPeerRole);

  if(dragFromZone==='hand'){
    if(!myTurn){toast('Wait for your turn to play cards');dragCardId=null;dragFromZone=null;return;}
    const idx=GS.myHand.findIndex(c=>c.uid===dragCardId);
    if(idx<0){dragCardId=null;dragFromZone=null;return;}
    const card={...GS.myHand[idx],mine:true};
    GS.myHand.splice(idx,1);
    GS.myField[zoneKey]=[...(GS.myField[zoneKey]||[]),card];
    send({type:'play_card',zone:zoneKey,card:{...card,mine:false}});
    renderBoard();
    toast(card.name+' played to '+zoneKey);
  } else if(dragFromZone==='field' && dragFromZoneKey && dragFromZoneKey!==zoneKey){
    const idx=(GS.myField[dragFromZoneKey]||[]).findIndex(c=>c.uid===dragCardId);
    if(idx>=0){
      const card=GS.myField[dragFromZoneKey].splice(idx,1)[0];
      GS.myField[zoneKey]=[...(GS.myField[zoneKey]||[]),card];
      send({type:'move_card',from:dragFromZoneKey,to:zoneKey,uid:dragCardId});
      renderBoard();
      toast(card.name+' moved to '+zoneKey);
    }
  }
  dragCardId=null;dragFromZone=null;dragFromZoneKey=null;
}

// ── Card actions ───────────────────────────────────
function tapCard(zone,uid){
  toggleTapOnField(zone,uid,true);
  send({type:'tap_card',zone,uid});
  renderBoard();
  closeAllMenus();
}
function toggleTapOnField(zone,uid,isMine){
  const arr=isMine?GS.myField[zone]:GS.oppField[zone];
  const c=arr&&arr.find(x=>x.uid===uid);
  if(c)c.tapped=!c.tapped;
}
function discardFromField(zone,uid){
  const idx=(GS.myField[zone]||[]).findIndex(c=>c.uid===uid);
  if(idx<0)return;
  const card=GS.myField[zone].splice(idx,1)[0];
  GS.myDiscard.push(card);
  send({type:'discard_card',zone,uid});
  renderBoard();closeAllMenus();
}
function returnToHand(zone,uid){
  const idx=(GS.myField[zone]||[]).findIndex(c=>c.uid===uid);
  if(idx<0)return;
  const card=GS.myField[zone].splice(idx,1)[0];
  GS.myHand.push(card);
  send({type:'discard_card',zone,uid});
  renderBoard();closeAllMenus();toast(card.name+' returned to hand');
}
function removeFromOppField(zone,uid){
  GS.oppField[zone]=(GS.oppField[zone]||[]).filter(c=>c.uid!==uid);
}
function getFieldCard(zone,uid){
  return (GS.myField[zone]||[]).find(c=>c.uid===uid)||(GS.oppField[zone]||[]).find(c=>c.uid===uid)||{name:'?'};
}
function toggleCardMenu(uid){
  closeAllMenus();
  const m=$('menu-'+uid);
  if(m)m.classList.toggle('open');
}
function closeAllMenus(){document.querySelectorAll('.bcard-menu.open').forEach(m=>m.classList.remove('open'));}
document.addEventListener('click',e=>{if(!e.target.closest('.bcard'))closeAllMenus();});

// ── Draw ───────────────────────────────────────────
function drawCard(){
  if(!gameStarted)return;
  if(!GS.myDeck.length){toast('Deck is empty!');return;}
  const card=GS.myDeck.pop();
  GS.myHand.push(card);
  send({type:'draw'});
  renderBoard();toast('Drew '+card.name);
}

// ── Life ───────────────────────────────────────────
function adjustLife(who,delta){
  if(who==='me'){
    GS.myLife=Math.max(0,GS.myLife+delta);
    send({type:'life',value:GS.myLife});
    renderInfoBars();
    if(GS.myLife===0)showGameOver('Your life reached 0. You lose!');
  } else {
    GS.oppLife=Math.max(0,GS.oppLife+delta);
    renderInfoBars();
    if(GS.oppLife===0)showGameOver('Opponent\'s life reached 0. You win!');
  }
}

// ── End turn ───────────────────────────────────────
function endTurn(){
  if(GS.turn!==myPeerRole){toast('Not your turn');return;}
  GS.turn=(myPeerRole==='host')?'guest':'host';
  send({type:'end_turn'});
  ['battle','support'].forEach(z=>{(GS.myField[z]||[]).forEach(c=>c.tapped=false);});
  if(GS.myDeck.length){const card=GS.myDeck.pop();GS.myHand.push(card);send({type:'draw'});toast('Drew '+card.name+' — opponent\'s turn');}
  renderBoard();
  addChat('You ended your turn.','sys');
}

// ── Concede ────────────────────────────────────────
function concede(){
  if(!confirm('Concede the game?'))return;
  send({type:'concede'});
  showGameOver('You conceded.');
}

function showGameOver(msg){
  gameStarted=false;
  addChat('🏁 '+msg,'sys');
  $('end-turn-btn').disabled=true;
  toast(msg);
}

// ── Discard pile viewer ────────────────────────────
function viewDiscard(){
  if(!GS.myDiscard.length){toast('Discard pile is empty');return;}
  const names=GS.myDiscard.map(c=>c.name).join(', ');
  alert('Discard pile ('+GS.myDiscard.length+'):\n'+names);
}

// ── Card detail ────────────────────────────────────
function showCardDetail(card){
  if(!card)return;
  const overlay=$('card-detail-overlay');
  overlay.style.display='';
  overlay.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
      <div>
        <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;">${card.name}</div>
        <div style="display:flex;gap:4px;margin-top:3px;flex-wrap:wrap;">${(card.doms||[card.dom]).map(d=>`<span class="pill ${d}" style="font-size:10px;">${d[0].toUpperCase()+d.slice(1)}</span>`).join('')}</div>
      </div>
      <button onclick="document.getElementById('card-detail-overlay').style.display='none'" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;">×</button>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">${card.supertype||card.type||''}${card.rarity?' · '+card.rarity:''}</div>
    <div style="font-size:12px;color:var(--text-soft);line-height:1.5;margin-bottom:8px;">${renderCardText(card.txt)||'No text.'}</div>
    <div style="display:flex;gap:12px;font-size:12px;color:var(--text-muted);">
      ${card.cost!==null?`<span>⚡ ${card.cost}</span>`:''}
      ${card.might!==null?`<span>⚔ ${card.might}</span>`:''}
      ${card.power!==null?`<span>💪 ${card.power}</span>`:''}
    </div>
    ${card.artist&&card.artist!=='Unknown'?`<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">✦ ${card.artist}</div>`:''}`;
}
document.addEventListener('click',e=>{
  const ov=$('card-detail-overlay');
  if(ov&&ov.style.display!=='none'&&!e.target.closest('#card-detail-overlay')&&!e.target.closest('.hcard')&&!e.target.closest('.bcard'))
    ov.style.display='none';
});

// ── Chat ───────────────────────────────────────────
function toggleChat(){
  chatOpen=!chatOpen;
  $('chat-panel').style.display=chatOpen?'flex':'none';
}
function addChat(text,who){
  const msgs=$('chat-msgs');
  if(!msgs)return;
  const div=document.createElement('div');
  div.className='chat-msg '+(who==='sys'?'sys':who==='opp'?'':'mine');
  div.textContent=text;
  msgs.appendChild(div);
  msgs.scrollTop=msgs.scrollHeight;
  if(who==='sys'&&!chatOpen){toggleChat();}
}
function sendChat(){
  const inp=$('chat-input');
  const text=inp.value.trim();
  if(!text)return;
  send({type:'chat',text});
  addChat(GS.myName+': '+text,'mine');
  inp.value='';
}

// ── Helpers ────────────────────────────────────────
function domColor(dom){
  const map={fury:'#ff6b4a',chaos:'#e05aad',calm:'#3dd6a3',mind:'#5ab4f5',body:'#a0d95e',order:'#c4a9ff'};
  return map[dom]||'#888';
}
