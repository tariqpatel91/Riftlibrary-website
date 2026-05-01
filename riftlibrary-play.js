/* riftlibrary-play.js — Play tab logic */
'use strict';

const GS = {
  me:  {name:'', life:20, hand:[], deck:[], discard:[], runes:[], runeIdx:0,
         battle:[], support:[], bfLeft:[], bfRight:[], legend:null, champion:null},
  opp: {name:'', life:20, handCount:0, battle:[], support:[], legend:null, champion:null},
  myTurn: false,
  phase: 'waiting',
  roomCode: '',
  chatLog: [],
  _peer: null,
  _conn: null,
  _isHost: false
};

let _dragUid = null;
let _dragZone = null;
let _bcMenuClose = null;

/* ── DECK SELECTORS ── */
function populateDeckSelectors() {
  const decks = (JSON.parse(localStorage.getItem('rl_decks') || '[]'));
  ['host-deck-sel','join-deck-sel','solo-deck-sel'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">— choose a deck —</option>';
    decks.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name + (d.legend ? ` (${d.legend})` : '');
      sel.appendChild(opt);
    });
  });
}

/* ── SOLO PRACTICE ── */
async function startSolo() {
  const deckEl = document.getElementById('solo-deck-sel');
  const statusEl = document.getElementById('solo-status');
  if (!deckEl.value) { statusEl.textContent = 'Please select a deck first.'; return; }
  statusEl.textContent = '';
  // Ensure cards are loaded so images and names resolve
  if (typeof CARDS !== 'undefined' && (!CARDS.length || !cardsLoaded)) {
    statusEl.textContent = 'Loading card data…';
    try { if (typeof fetchAllCards === 'function') await fetchAllCards(); } catch (e) {}
    statusEl.textContent = '';
  }
  GS.me.name = 'You';
  GS.opp.name = 'Practice Dummy';
  GS._isHost = false;
  GS._conn = null;
  GS.roomCode = 'SOLO';
  _loadDeckIntoState(deckEl.value);
  startBoard(true);
}

/* ── HOST ── */
function hostGame() {
  const nameEl = document.getElementById('host-name');
  const deckEl = document.getElementById('host-deck-sel');
  const statusEl = document.getElementById('host-status');
  if (!deckEl.value) { statusEl.textContent = 'Please select a deck.'; return; }
  GS.me.name = nameEl.value.trim() || 'Player 1';
  GS._isHost = true;
  _loadDeckIntoState(deckEl.value);
  statusEl.textContent = 'Creating room…';

  const peer = new Peer();
  GS._peer = peer;
  peer.on('open', id => {
    GS.roomCode = 'RIFT-' + id.slice(0,6).toUpperCase();
    document.getElementById('host-game-id').textContent = GS.roomCode;
    document.getElementById('host-id-box').style.display = '';
    statusEl.textContent = '';
    document.getElementById('host-wait-msg').textContent = 'Waiting for opponent to connect…';
  });
  peer.on('connection', conn => {
    GS._conn = conn;
    _setupConn(conn);
    document.getElementById('host-wait-msg').textContent = 'Opponent connected! Starting…';
    setTimeout(() => {
      _send({ type:'player_join', name: GS.me.name });
      startBoard(true);
    }, 500);
  });
  peer.on('error', err => { statusEl.textContent = 'Error: ' + err.message; });
}

function copyGameId() {
  const id = document.getElementById('host-game-id').textContent;
  navigator.clipboard.writeText(id).then(() => showToast('Game ID copied!'));
}

/* ── JOIN ── */
function joinGame() {
  const nameEl = document.getElementById('join-name');
  const deckEl = document.getElementById('join-deck-sel');
  const codeEl = document.getElementById('join-game-id');
  const statusEl = document.getElementById('join-status');
  if (!deckEl.value) { statusEl.textContent = 'Please select a deck.'; return; }
  if (!codeEl.value.trim()) { statusEl.textContent = 'Please enter a Game ID.'; return; }
  GS.me.name = nameEl.value.trim() || 'Player 2';
  GS._isHost = false;
  _loadDeckIntoState(deckEl.value);
  statusEl.textContent = 'Connecting…';

  const rawId = codeEl.value.replace(/^RIFT-/i,'').toLowerCase();
  const peer = new Peer();
  GS._peer = peer;
  peer.on('open', () => {
    const conn = peer.connect(rawId);
    GS._conn = conn;
    _setupConn(conn);
    conn.on('open', () => {
      statusEl.textContent = 'Connected! Starting…';
      _send({ type:'player_join', name: GS.me.name });
      startBoard(false);
    });
    conn.on('error', err => { statusEl.textContent = 'Error: ' + err.message; });
  });
  peer.on('error', err => { statusEl.textContent = 'Error: ' + err.message; });
}

/* ── CONN SETUP ── */
function _setupConn(conn) {
  conn.on('data', data => { handleMsg(data); });
  conn.on('close', () => {
    appendChat('System', 'Opponent disconnected.');
    document.getElementById('end-turn-btn').disabled = false;
  });
}

function _send(payload) {
  if (GS._conn && GS._conn.open) GS._conn.send(payload);
}

/* ── INCOMING MESSAGES ── */
function handleMsg(msg) {
  switch (msg.type) {
    case 'player_join':
      GS.opp.name = msg.name;
      _setText('opp-name-label', msg.name);
      appendChat('System', msg.name + ' joined.');
      break;
    case 'life':
      GS.opp.life = msg.value;
      _setText('opp-life', msg.value);
      break;
    case 'hand_count':
      GS.opp.handCount = msg.count;
      _setText('opp-hand-count', msg.count);
      renderOppHand();
      break;
    case 'play_card':
      _addToOppZone(msg.zone, msg.card);
      break;
    case 'move_card':
      _moveOppCard(msg.uid, msg.from, msg.to);
      break;
    case 'remove_card':
      _removeOppCard(msg.uid, msg.zone);
      break;
    case 'end_turn':
      GS.myTurn = true;
      updateTurnBadge();
      appendChat('System', GS.opp.name + ' ended their turn. Your turn!');
      break;
    case 'chat':
      appendChat(GS.opp.name, msg.text);
      break;
    case 'concede':
      appendChat('System', GS.opp.name + ' conceded. You win!');
      break;
  }
}

/* ── LOAD DECK ── */
function _loadDeckIntoState(deckId) {
  const decks = (typeof myDecks !== 'undefined' && myDecks.length)
    ? myDecks
    : JSON.parse(localStorage.getItem('rl_decks') || '[]');
  const deck = decks.find(d => String(d.id) === String(deckId));
  if (!deck) return;
  const allCards = (typeof CARDS !== 'undefined' && CARDS.length) ? CARDS : (window._allCards || []);

  const lookup = id => allCards.find(c => c.id === id);
  const _img = c => (c && (c.imageUrl || c.image)) || '';
  const expand = (entries, skipTypes) => {
    const out = [];
    (entries || []).forEach(e => {
      if (skipTypes && skipTypes.includes(e.t)) return;
      // deck format stores the card name as e.n
      const fallbackName = e.n || e.name || e.id;
      const full = lookup(e.id) || { id:e.id, name:fallbackName };
      const card = {
        ...full,
        image: _img(full),
        name: (full && full.name) || fallbackName,
        type: full.type || e.t || ''
      };
      const cnt = e.cnt || e.qty || 1;
      for (let i = 0; i < cnt; i++) {
        out.push({ ...card, _uid: crypto.randomUUID() });
      }
    });
    return out;
  };

  // Pull legend + champion out of the cards list
  const legendEntry   = (deck.cards || []).find(c => c.t === 'Legend');
  const championEntry = (deck.cards || []).find(c => c.t === 'Champion');
  const legendFull   = legendEntry   ? lookup(legendEntry.id)   : null;
  const championFull = championEntry ? lookup(championEntry.id) : null;

  GS.me.legend = legendFull
    ? { ...legendFull,   image:_img(legendFull),   _uid: crypto.randomUUID() }
    : (deck.legend ? { name: deck.legend, _uid: crypto.randomUUID() } : null);
  GS.me.champion = championFull
    ? { ...championFull, image:_img(championFull), _uid: crypto.randomUUID() }
    : null;

  // Main deck excludes Legend/Champion (they go to their dedicated zones)
  GS.me.deck     = _shuffle(expand(deck.cards || [], ['Legend','Champion']));
  GS.me.runes    = expand(deck.runes || []);
  GS.me.battle   = [];
  GS.me.support  = [];
  GS.me.hand     = [];
  GS.me.discard  = [];
  GS.me.life     = 20;
}

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ── START BOARD ── */
function startBoard(isFirst) {
  GS.myTurn = isFirst;
  GS.phase = 'main';
  for (let i = 0; i < 5 && GS.me.deck.length; i++) {
    GS.me.hand.push(GS.me.deck.shift());
  }
  document.getElementById('play-lobby').style.display = 'none';
  document.getElementById('play-board').style.display = 'flex';
  _setText('my-name-label', GS.me.name);
  _setText('opp-name-label', GS.opp.name || 'Opponent');
  renderFullBoard();
  updateTurnBadge();
  appendChat('System', 'Game started! ' + (GS.myTurn ? 'You go first.' : (GS.opp.name||'Opponent') + ' goes first.'));
}

/* ── helpers ── */
function _setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

/* ── RENDER ── */
function renderFullBoard() {
  _setText('my-life', GS.me.life);
  _setText('opp-life', GS.opp.life);
  _setText('my-deck-count', GS.me.deck.length);
  _setText('my-disc-count', GS.me.discard.length);
  _setText('my-rune-count', GS.me.runes.length);
  renderTrashTop();
  renderMyHand();
  renderOppHand();
  // Center BASE: my units at bottom half, opp units at top half
  renderZone('battle-cards', GS.me.battle);
  renderZone('opp-base-cards', GS.opp.battle);
  // Other zones
  renderZone('support-cards', GS.me.support);
  // Hide base hint once units are placed
  const hint = document.getElementById('base-hint');
  if (hint) hint.style.display = (GS.me.battle.length || GS.opp.battle.length) ? 'none' : '';
  // Legend/champion
  if (GS.me.legend) renderZone('my-legend-cards', [GS.me.legend]);
  if (GS.me.champion) renderZone('my-champion-cards', [GS.me.champion]);
  _updateCounts();
}

function renderMyHand() {
  _setText('my-hand-count', GS.me.hand.length);
  const el = document.getElementById('my-hand');
  if (!el) return;
  const n = GS.me.hand.length;
  el.innerHTML = GS.me.hand.map((c, i) => {
    // Arch fan: middle cards sit highest, edges sweep down (parabolic arch)
    const t = n > 1 ? (i / (n - 1)) * 2 - 1 : 0; // -1 .. 1
    const maxSpread = Math.min(40, n * 5); // total degrees of fan
    const rot = (maxSpread / 2) * t; // negative on left, positive on right
    const peakLift = Math.min(48, n * 5); // px lift at center peak
    const lift = -peakLift * (1 - t * t); // arch: 0 at edges, -peak at middle
    const html = boardCardHTML(c, 'hand');
    return html.replace(
      'class="board-card',
      `style="transform:translateY(${lift}px) rotate(${rot}deg);" class="board-card`
    );
  }).join('');
}

function renderTrashTop() {
  const slot = document.getElementById('trash-top');
  if (!slot) return;
  const top = GS.me.discard.length ? GS.me.discard[GS.me.discard.length - 1] : null;
  if (top) {
    slot.classList.add('has-card');
    const img = top.image || top.img || '';
    slot.innerHTML = img
      ? `<img src="${img}" alt="${top.name||''}">`
      : `<div style="font-size:9px;color:rgba(255,255,255,0.6);text-align:center;padding:4px;">${top.name||'?'}</div>`;
    slot.setAttribute('data-img', img);
    slot.setAttribute('data-name', top.name || '');
  } else {
    slot.classList.remove('has-card');
    slot.innerHTML = '🗑';
    slot.removeAttribute('data-img');
    slot.removeAttribute('data-name');
  }
}

function renderOppHand() {
  const el = document.getElementById('opp-hand');
  if (el) el.innerHTML = Array(Math.min(GS.opp.handCount, 10)).fill(0).map(() =>
    `<div class="opp-card-back"></div>`).join('');
  const cnt = document.getElementById('opp-hand-count');
  if (cnt) cnt.textContent = GS.opp.handCount;
}

function renderZone(rowId, cards) {
  const el = document.getElementById(rowId);
  if (!el) return;
  el.innerHTML = cards.map(c => boardCardHTML(c, rowId)).join('');
}

function boardCardHTML(card, zone) {
  const img = card.image || card.img || '';
  const exhausted = card._exhausted ? ' exhausted' : '';
  const bf = (card.type||'').toLowerCase().includes('battlefield');
  const bfClass = bf ? ' bf-card' : '';
  const mine = _isMyCard(card);
  const drag = mine ? `draggable="true" ondragstart="boardDragStart(event,'${card._uid}','${zone}')"` : '';
  const cardJson = JSON.stringify(card).replace(/'/g,"\\'").replace(/"/g,'&quot;');
  // Runes (support zone) toggle exhaust on click; everything else opens the action menu
  const isRuneZone = zone === 'support-cards' || zone === 'support';
  const click = mine
    ? (isRuneZone
        ? `onclick="event.stopPropagation();_toggleExhaust('${card._uid}','support')"`
        : `onclick="showBoardCardMenu(event,'${cardJson}','${zone}')"`)
    : '';
  const safeName = (card.name||'').replace(/"/g,'&quot;');
  return `<div class="board-card${exhausted}${bfClass}" ${drag} ${click} title="${safeName}" data-uid="${card._uid||''}" data-img="${img}" data-name="${safeName}">
    ${img ? `<img src="${img}" alt="${safeName}">` : `<div style="padding:4px;font-size:9px;color:rgba(255,255,255,0.5);text-align:center;word-break:break-word;">${card.name||'?'}</div>`}
  </div>`;
}

/* ── Card hover preview ────────────────────────── */
let _hoverPreviewTimer = null;
function _onBoardHover(e) {
  const target = e.target.closest('[data-img], [data-name]');
  if (!target) return;
  const img = target.getAttribute('data-img');
  const name = target.getAttribute('data-name') || '';
  if (!img && !name) return;
  if (_hoverPreviewTimer) clearTimeout(_hoverPreviewTimer);
  _hoverPreviewTimer = setTimeout(() => _showCardPreview(img, name, target), 80);
}
function _onBoardHoverOut(e) {
  if (e.target.closest('[data-img], [data-name]')) {
    if (_hoverPreviewTimer) clearTimeout(_hoverPreviewTimer);
    const p = document.getElementById('card-hover-preview');
    if (p) p.classList.remove('show');
  }
}
function _showCardPreview(img, name, sourceEl) {
  const p = document.getElementById('card-hover-preview');
  if (!p) return;
  p.innerHTML = img
    ? `<img src="${img}" alt="${name}">`
    : `<div class="nohover-name">${name||'?'}</div>`;
  // Position near the source element, keeping inside the viewport
  const rect = sourceEl.getBoundingClientRect();
  const w = 280, h = 392;
  let left = rect.right + 14;
  if (left + w > window.innerWidth - 8) left = rect.left - w - 14;
  if (left < 8) left = 8;
  let top = rect.top + rect.height / 2 - h / 2;
  if (top < 8) top = 8;
  if (top + h > window.innerHeight - 8) top = window.innerHeight - h - 8;
  p.style.left = left + 'px';
  p.style.top  = top + 'px';
  p.classList.add('show');
}
// Bind once
if (typeof window !== 'undefined' && !window._cardHoverBound) {
  window._cardHoverBound = true;
  document.addEventListener('mouseover', _onBoardHover);
  document.addEventListener('mouseout',  _onBoardHoverOut);
}

function _isMyCard(card) {
  return GS.me.hand.some(c=>c._uid===card._uid) ||
         GS.me.battle.some(c=>c._uid===card._uid) ||
         GS.me.support.some(c=>c._uid===card._uid) ||
         (GS.me.legend && GS.me.legend._uid===card._uid) ||
         (GS.me.champion && GS.me.champion._uid===card._uid);
}

function _updateCounts() {
  const tb = document.getElementById('my-hand-count');
  if (tb) tb.textContent = GS.me.hand.length;
}

/* ── DRAG OVER (highlight drop zones) ── */
function boardDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

/* ── DRAG & DROP ── */
function boardDragStart(e, uid, zone) {
  _dragUid = uid;
  _dragZone = zone;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', uid); } catch (_) {}
  }
  e.stopPropagation();
}

function dropToZone(e, toZone) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!_dragUid) return;
  const card = _pluckMyCard(_dragUid, _dragZone);
  if (!card) return;

  // Reset transient flags when moving
  card._exhausted = false;

  switch (toZone) {
    case 'battle':
      GS.me.battle.push(card);
      _send({type:'play_card',zone:'battle',card});
      break;
    case 'support':
      GS.me.support.push(card);
      _send({type:'play_card',zone:'support',card});
      break;
    case 'hand':
      GS.me.hand.push(card);
      break;
    case 'deck':
      // Drop on top of deck (next draw will pick this up)
      GS.me.deck.unshift(card);
      break;
    case 'trash':
    case 'discard':
      GS.me.discard.push(card);
      break;
    case 'legend':
      // Send any current legend back to hand to free the slot, then equip
      if (GS.me.legend && GS.me.legend._uid !== card._uid) {
        GS.me.hand.push(GS.me.legend);
      }
      GS.me.legend = card;
      break;
    case 'champion':
      if (GS.me.champion && GS.me.champion._uid !== card._uid) {
        GS.me.hand.push(GS.me.champion);
      }
      GS.me.champion = card;
      break;
    default:
      // Unknown zone — return the card to where it came from
      _returnCardToZone(card, _dragZone);
  }

  _sendHandCount();
  renderFullBoard();
  _dragUid = null;
  _dragZone = null;
}

function _returnCardToZone(card, zone) {
  if (zone === 'battle') GS.me.battle.push(card);
  else if (zone === 'support') GS.me.support.push(card);
  else if (zone === 'legend') GS.me.legend = card;
  else if (zone === 'champion') GS.me.champion = card;
  else GS.me.hand.push(card);
}

/* ── CARD CONTEXT MENU ── */
function showBoardCardMenu(e, cardJson, zone) {
  e.stopPropagation();
  closeBoardCardMenu();
  const card = JSON.parse(cardJson);
  const menu = document.createElement('div');
  menu.className = 'board-card-menu';
  menu.style.left = e.clientX + 'px';
  menu.style.top  = Math.min(e.clientY, window.innerHeight - 200) + 'px';

  const actions = [
    ['Toggle Exhaust', () => { _toggleExhaust(card._uid, zone); }],
    ['Move to Hand',   () => { _moveToHand(card._uid, zone); }],
    ['Move to Battle', () => { _moveToZone(card._uid, zone, 'battle'); }],
    ['Move to Support',() => { _moveToZone(card._uid, zone, 'support'); }],
    ['Discard',        () => { _discardCard(card._uid, zone); }],
  ];
  actions.forEach(([label, fn]) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.onclick = () => { fn(); closeBoardCardMenu(); };
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  _bcMenuClose = () => { if (menu.parentNode) menu.parentNode.removeChild(menu); };
  setTimeout(() => document.addEventListener('click', _bcMenuClose, {once:true}), 0);
}

function closeBoardCardMenu() {
  if (_bcMenuClose) { _bcMenuClose(); _bcMenuClose = null; }
}

function _toggleExhaust(uid, zone) {
  const card = _findMyCard(uid, zone);
  if (card) { card._exhausted = !card._exhausted; renderFullBoard(); }
}

function _moveToHand(uid, zone) {
  const card = _pluckMyCard(uid, zone);
  if (card) { card._exhausted = false; GS.me.hand.push(card); _sendHandCount(); renderFullBoard(); }
}

function _moveToZone(uid, fromZone, toZone) {
  const card = _pluckMyCard(uid, fromZone);
  if (!card) return;
  card._exhausted = false;
  if (toZone === 'battle')  GS.me.battle.push(card);
  if (toZone === 'support') GS.me.support.push(card);
  _send({type:'move_card', uid, from:fromZone, to:toZone});
  renderFullBoard();
}

function _discardCard(uid, zone) {
  const card = _pluckMyCard(uid, zone);
  if (card) { GS.me.discard.push(card); _sendHandCount(); renderFullBoard(); }
}

function _findMyCard(uid, zone) {
  const arr = zone==='hand'?GS.me.hand:zone==='battle'?GS.me.battle:GS.me.support;
  return arr.find(c=>c._uid===uid);
}

function _pluckMyCard(uid, zone) {
  // Singleton zones first
  if (zone === 'legend' && GS.me.legend && GS.me.legend._uid === uid) {
    const c = GS.me.legend; GS.me.legend = null; return c;
  }
  if (zone === 'champion' && GS.me.champion && GS.me.champion._uid === uid) {
    const c = GS.me.champion; GS.me.champion = null; return c;
  }
  const zones = { hand:GS.me.hand, battle:GS.me.battle, support:GS.me.support, discard:GS.me.discard, trash:GS.me.discard };
  const arr = zones[zone];
  if (!arr) {
    // Unknown zone — search every list as a fallback so drag still works
    for (const k of Object.keys(zones)) {
      const a = zones[k];
      const i = a.findIndex(c=>c._uid===uid);
      if (i !== -1) return a.splice(i,1)[0];
    }
    return null;
  }
  const idx = arr.findIndex(c=>c._uid===uid);
  if (idx === -1) return null;
  return arr.splice(idx, 1)[0];
}

/* ── OPP ZONE UPDATES ── */
function _addToOppZone(zone, card) {
  if (zone === 'battle')  GS.opp.battle.push(card);
  if (zone === 'support') GS.opp.support.push(card);
  renderFullBoard();
}

function _moveOppCard(uid, from, to) {
  const zones = { battle:GS.opp.battle, support:GS.opp.support };
  const src = zones[from] || [];
  const idx = src.findIndex(c=>c._uid===uid);
  if (idx !== -1) {
    const [card] = src.splice(idx,1);
    if (zones[to]) zones[to].push(card);
  }
  renderFullBoard();
}

function _removeOppCard(uid, zone) {
  const zones = { battle:GS.opp.battle, support:GS.opp.support };
  const arr = zones[zone] || [];
  const idx = arr.findIndex(c=>c._uid===uid);
  if (idx !== -1) arr.splice(idx,1);
  renderFullBoard();
}

/* ── ACTIONS ── */
function adjustLife(side, delta) {
  if (side === 'me') {
    GS.me.life = Math.max(0, GS.me.life + delta);
    _setText('my-life', GS.me.life);
    _send({ type:'life', value: GS.me.life });
  } else {
    GS.opp.life = Math.max(0, GS.opp.life + delta);
    _setText('opp-life', GS.opp.life);
  }
}

function drawCard() {
  if (GS.me.deck.length === 0) { showToast && showToast('Deck empty!'); return; }
  GS.me.hand.push(GS.me.deck.shift());
  _sendHandCount && _sendHandCount();
  _setText('my-deck-count', GS.me.deck.length);
  renderMyHand();
  _updateCounts();
}

function playRune() {
  if (!GS.me.runes || GS.me.runes.length === 0) { showToast && showToast('No runes left!'); return; }
  const rune = GS.me.runes.shift();
  rune._exhausted = true;
  GS.me.support = GS.me.support || [];
  GS.me.support.push(rune);
  _setText('my-rune-count', GS.me.runes.length);
  renderZone('support-cards', GS.me.support);
}

function viewDiscard() {
  const overlay = document.getElementById('discard-overlay');
  if (!overlay) return;
  let box = document.getElementById('discard-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'discard-box';
    overlay.appendChild(box);
  }
  box.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
    <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:700;">Discard Pile (${GS.me.discard.length})</div>
    <button onclick="document.getElementById('discard-overlay').classList.remove('open')" style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer;">✕</button>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:8px;">
    ${GS.me.discard.map(c => `<div class="board-card" title="${c.name||''}">${c.image?`<img src="${c.image}">`:`<div style="padding:4px;font-size:9px;">${c.name||''}</div>`}</div>`).join('')}
  </div>`;
  overlay.classList.add('open');
  overlay.onclick = e => { if(e.target===overlay) overlay.classList.remove('open'); };
}

function endTurn() {
  if (!GS.myTurn) { showToast("It's not your turn!"); return; }
  GS.me.battle.forEach(c=>c._exhausted=false);
  GS.me.support.forEach(c=>c._exhausted=false);
  if (GS.roomCode === 'SOLO') {
    // solo: immediately flip back
    appendChat('System', 'New turn — draw a card?');
  } else {
    GS.myTurn = false;
    _send({ type:'end_turn' });
  }
  updateTurnBadge();
  renderFullBoard();
}

function concede() {
  const label = GS.roomCode === 'SOLO' ? 'Exit practice session?' : 'Concede the game?';
  if (!confirm(label)) return;
  if (GS.roomCode !== 'SOLO') _send({ type:'concede' });
  appendChat('System', GS.roomCode === 'SOLO' ? 'Practice ended.' : 'You conceded.');
  leaveBoard();
}

function leaveBoard() {
  if (GS._conn) { GS._conn.close(); GS._conn = null; }
  if (GS._peer) { GS._peer.destroy(); GS._peer = null; }
  document.getElementById('play-board').style.display = 'none';
  document.getElementById('play-lobby').style.display = '';
  document.getElementById('host-status').textContent = '';
  document.getElementById('join-status').textContent = '';
  document.getElementById('host-id-box').style.display = 'none';
}

function updateTurnBadge() {
  const badge = document.getElementById('board-turn-badge');
  if (!badge) return;
  badge.textContent = GS.myTurn ? '⚡ Your Turn' : "Opponent's Turn";
  badge.className = 'board-turn-badge' + (GS.myTurn ? ' my-turn' : '');
  const btn = document.getElementById('end-turn-btn');
  if (btn) btn.disabled = !GS.myTurn;
}

/* ── DRAG OVER HIGHLIGHT ── */
document.addEventListener('dragover', e => {
  const zone = e.target.closest('.zone');
  if (zone) { e.preventDefault(); zone.classList.add('drag-over'); }
});
document.addEventListener('dragleave', e => {
  const zone = e.target.closest('.zone');
  if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
});

/* ── CHAT ── */
function toggleChat() {
  const panel = document.getElementById('chat-panel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? '' : 'none';
}

function sendChat() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  appendChat(GS.me.name || 'Me', text);
  _send({ type:'chat', text });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement?.id === 'chat-input') sendChat();
});

function appendChat(name, msg) {
  const msgs = document.getElementById('chat-msgs');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `<strong>${name}:</strong> ${msg}`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

/* ── HELPERS ── */
function _sendHandCount() {
  _send({ type:'hand_count', count: GS.me.hand.length });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}
