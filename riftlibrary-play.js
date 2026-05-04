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
  GS.opp.name = 'Goldfish';
  GS._isHost = false;
  GS._conn = null;
  GS.roomCode = 'SOLO';
  showDeckCustomizer(deckEl.value, {
    meName: GS.me.name,
    oppName: GS.opp.name,
    onConfirm: (modifiedDeck) => {
      _loadDeckIntoStateFromObj(modifiedDeck);
      startBoard(true);
    }
  });
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
    document.getElementById('host-wait-msg').textContent = 'Opponent connected! Customize your deck…';
    setTimeout(() => {
      showDeckCustomizer(deckEl.value, {
        meName: GS.me.name,
        oppName: GS.opp.name || 'Opponent',
        onConfirm: (modifiedDeck) => {
          _loadDeckIntoStateFromObj(modifiedDeck);
          _send({ type:'player_join', name: GS.me.name });
          startBoard(true);
        }
      });
    }, 200);
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
      statusEl.textContent = 'Connected! Customize your deck…';
      showDeckCustomizer(deckEl.value, {
        meName: GS.me.name,
        oppName: GS.opp.name || 'Opponent',
        onConfirm: (modifiedDeck) => {
          _loadDeckIntoStateFromObj(modifiedDeck);
          _send({ type:'player_join', name: GS.me.name });
          startBoard(false);
        }
      });
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
  _loadDeckIntoStateFromObj(deck);
}

function _loadDeckIntoStateFromObj(deck) {
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

  // Pull legend + champion out of every place a deck might store them
  const legendEntry   = (deck.cards || []).find(c => c.t === 'Legend');
  const championEntry = (deck.cards || []).find(c => c.t === 'Champion');
  let legendFull   = legendEntry   ? lookup(legendEntry.id)   : null;
  let championFull = championEntry ? lookup(championEntry.id) : null;
  // Fallbacks: deck.legend (name string) or deck.champion ({id, n}) — older format
  if (!legendFull && deck.legend) {
    legendFull = allCards.find(c => c.name === deck.legend)
              || allCards.find(c => (c.supertype||'').toLowerCase().includes('legend') && c.name === deck.legend);
  }
  if (!championFull && deck.champion) {
    championFull = (deck.champion.id ? lookup(deck.champion.id) : null)
                || (deck.champion.n  ? allCards.find(c => c.name === deck.champion.n) : null);
  }
  // Last resort: scan the deck for a card whose supertype is Champion
  if (!championFull) {
    const fb = (deck.cards || []).find(e => {
      const f = lookup(e.id);
      return f && (f.supertype||'').toLowerCase().includes('champion');
    });
    if (fb) championFull = lookup(fb.id);
  }

  GS.me.legend = legendFull
    ? { ...legendFull,   image:_img(legendFull),   _uid: crypto.randomUUID() }
    : (deck.legend ? { name: deck.legend, _uid: crypto.randomUUID() } : null);
  GS.me.champion = championFull
    ? { ...championFull, image:_img(championFull), _uid: crypto.randomUUID() }
    : (deck.champion && deck.champion.n ? { name: deck.champion.n, _uid: crypto.randomUUID() } : null);

  // Main deck excludes Legend/Champion (they go to their dedicated zones)
  GS.me.deck     = _shuffle(expand(deck.cards || [], ['Legend','Champion']));
  GS.me.runes    = expand(deck.runes || []);
  GS.me.battle   = [];
  GS.me.support  = [];
  GS.me.hand     = [];
  GS.me.discard  = [];
  GS.me.life     = 20;

  // Chosen battlefield (single entry from deck.battlefields after the customizer narrows it down)
  const bfEntry = (deck.battlefields || []).filter(Boolean)[0];
  const bfFull = bfEntry ? lookup(bfEntry.id) : null;
  GS.me.bfLeft = bfFull
    ? [{ ...bfFull, image: _img(bfFull), name: bfFull.name || bfEntry.n || '', type: 'Battlefield', _uid: crypto.randomUUID() }]
    : (bfEntry ? [{ id: bfEntry.id, name: bfEntry.n || '', type: 'Battlefield', _uid: crypto.randomUUID() }] : []);
  GS.me.bfRight = [];
  GS.me.bfArea = [];
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
  GS.me.score = 0;
  GS.opp.score = 0;
  for (let i = 0; i < 5 && GS.me.deck.length; i++) {
    GS.me.hand.push(GS.me.deck.shift());
  }
  document.getElementById('play-lobby').style.display = 'none';
  document.getElementById('play-board').style.display = 'flex';
  _setText('my-name-label', GS.me.name);
  _setText('opp-name-label', GS.opp.name || 'Opponent');
  _setText('track-name-me', GS.me.name || 'You');
  _setText('track-name-opp', GS.opp.name || 'Opponent');
  _bindScoreTrack();
  // Battlefield + Base / Runes / Legend / Champion zones are locked — clear any drag/resize state from earlier sessions
  try {
    ['bf-pos_bf-left','bf-pos_bf-right',
     'size_play-base-zone','size_runes-zone',
     'size_my-legend-zone','size_my-champion-zone',
     'size_opp-legend-zone','size_opp-champion-zone']
      .forEach(k => localStorage.removeItem('rl_' + k));
  } catch(e) {}
  renderFullBoard();
  updateTurnBadge();
  appendChat('System', 'Game started! ' + (GS.myTurn ? 'You go first.' : (GS.opp.name||'Opponent') + ' goes first.'));
}

function _bindScoreTrack() {
  const slots = document.querySelectorAll('.track-slot');
  slots.forEach(s => {
    s.onclick = (e) => {
      const v = parseInt(s.getAttribute('data-v'), 10) || 0;
      const side = s.getAttribute('data-side');
      // Win slot (the middle 8): right-click = opp, left-click = me
      if (s.classList.contains('track-win')) {
        if (e.shiftKey || e.altKey || e.button === 2) GS.opp.score = 8;
        else GS.me.score = 8;
      } else if (side === 'me') {
        GS.me.score = v;
      } else if (side === 'opp') {
        GS.opp.score = v;
      }
      _renderScoreTrack(true);
    };
    s.oncontextmenu = (e) => {
      e.preventDefault();
      // Right-click on the middle 8 → award opp the win
      if (s.classList.contains('track-win')) {
        GS.opp.score = 8;
      } else if (s.getAttribute('data-side') === 'me') {
        // Right-click on a "me" slot → set opp to that value mirrored on the opp track
        GS.opp.score = parseInt(s.getAttribute('data-v'), 10) || 0;
      } else {
        GS.opp.score = parseInt(s.getAttribute('data-v'), 10) || 0;
      }
      _renderScoreTrack(true);
    };
  });
}

function _renderScoreTrack(animate) {
  const slots = document.querySelectorAll('.track-slot');
  const me  = GS.me.score  || 0;
  const opp = GS.opp.score || 0;
  slots.forEach(s => {
    const v = parseInt(s.getAttribute('data-v'), 10) || 0;
    const side = s.getAttribute('data-side');
    const isWin = s.classList.contains('track-win');
    let lit = false, who = '';
    if (isWin) {
      if (me >= 8)  { lit = true; who = 'me'; }
      else if (opp >= 8) { lit = true; who = 'opp'; }
    } else if (side === 'me' && v === me) { lit = true; who = 'me'; }
    else if (side === 'opp' && v === opp) { lit = true; who = 'opp'; }
    const wasLit = s.classList.contains('lit-me') || s.classList.contains('lit-opp');
    s.classList.toggle('lit-me',  lit && who === 'me');
    s.classList.toggle('lit-opp', lit && who === 'opp');
    if (animate && lit && !wasLit) {
      s.classList.remove('glint');
      // Force reflow then add to retrigger animation
      void s.offsetWidth;
      s.classList.add('glint');
    }
  });
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
  _setText('opp-deck-count', GS.opp.deckCount || 0);
  _setText('opp-disc-count', GS.opp.discardCount || 0);
  _setText('opp-rune-count', GS.opp.runeCount || 0);
  renderTrashTop();
  renderMyHand();
  renderOppHand();
  // BASE zones (visible wide rectangles): my units below, opp units above
  renderZone('play-base-cards', GS.me.battle);
  renderZone('opp-play-base-cards', GS.opp.battle);
  // Legacy render targets (kept for backward-compat with hidden control bar)
  renderZone('battle-cards', GS.me.battle);
  renderZone('opp-base-cards', GS.opp.battle);
  // Other zones
  renderZone('support-cards', GS.me.support);
  renderZone('opp-support-cards', GS.opp.support || []);
  renderZone('bf-left-cards',  GS.me.bfLeft  || []);
  renderZone('bf-right-cards', GS.me.bfRight || []);
  renderZone('my-battlefield-cards', GS.me.bfArea || []);
  _renderScoreTrack();
  // Hide base hint once units are placed
  const hint = document.getElementById('base-hint');
  if (hint) hint.style.display = (GS.me.battle.length || GS.opp.battle.length) ? 'none' : '';
  // Legend/champion
  if (GS.me.legend) renderZone('my-legend-cards', [GS.me.legend]);
  if (GS.me.champion) renderZone('my-champion-cards', [GS.me.champion]);
  _updateCounts();
  _initResizableZones();
}

// Resizable zones: each gets a corner grip that drags to change width/height.
// Battlefields additionally get a "move" grip so they can be repositioned via
// transform:translate after resizing. Sizes/offsets are persisted in
// localStorage per zone id so they survive a refresh.
const _RESIZABLE_ZONE_IDS = ['bf-left', 'bf-right', 'runes-zone'];
const _MOVABLE_ZONE_IDS = ['bf-left', 'bf-right'];

function _initResizableZones() {
  _RESIZABLE_ZONE_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el || el._zoneResizeInit) return;
    el._zoneResizeInit = true;
    // Restore saved size before adding the grip so layout is stable
    try {
      const saved = JSON.parse(localStorage.getItem('rl_zone_size_' + id) || 'null');
      if (saved) {
        if (saved.width)  { el.style.flex = '0 0 ' + saved.width + 'px'; el.style.width = saved.width + 'px'; }
        if (saved.height) el.style.height = saved.height + 'px';
      }
    } catch (e) {}
    const grip = document.createElement('div');
    grip.className = 'bf-resize-grip';
    grip.title = 'Drag to resize';
    grip.addEventListener('mousedown', e => _zoneResizeStart(e, el, id));
    el.appendChild(grip);
  });
  _MOVABLE_ZONE_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el || el._zoneMoveInit) return;
    el._zoneMoveInit = true;
    // Restore saved offset
    try {
      const saved = JSON.parse(localStorage.getItem('rl_zone_offset_' + id) || 'null');
      if (saved && (saved.x || saved.y)) {
        el.style.transform = `translate(${saved.x||0}px, ${saved.y||0}px)`;
      }
    } catch (e) {}
    const move = document.createElement('div');
    move.className = 'bf-move-grip';
    move.title = 'Drag to reposition';
    move.addEventListener('mousedown', e => _zoneMoveStart(e, el, id));
    el.appendChild(move);
  });
}

function _zoneResizeStart(e, el, id) {
  e.preventDefault();
  e.stopPropagation();
  const rect = el.getBoundingClientRect();
  const startW = rect.width;
  const startH = rect.height;
  const startX = e.clientX, startY = e.clientY;
  function onMove(ev) {
    const w = Math.max(120, startW + (ev.clientX - startX));
    const h = Math.max(80,  startH + (ev.clientY - startY));
    el.style.flex = '0 0 ' + w + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    try {
      localStorage.setItem('rl_zone_size_' + id, JSON.stringify({
        width:  parseFloat(el.style.width)  || 0,
        height: parseFloat(el.style.height) || 0,
      }));
    } catch (e) {}
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function _zoneMoveStart(e, el, id) {
  e.preventDefault();
  e.stopPropagation();
  // Parse the current translate offset from existing transform if any
  const cur = (el.style.transform || '').match(/translate\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px/);
  const startTX = cur ? parseFloat(cur[1]) : 0;
  const startTY = cur ? parseFloat(cur[2]) : 0;
  const startX = e.clientX, startY = e.clientY;
  function onMove(ev) {
    const tx = startTX + (ev.clientX - startX);
    const ty = startTY + (ev.clientY - startY);
    el.style.transform = `translate(${tx}px, ${ty}px)`;
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    const m = (el.style.transform || '').match(/translate\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px/);
    try {
      localStorage.setItem('rl_zone_offset_' + id, JSON.stringify({
        x: m ? parseFloat(m[1]) : 0,
        y: m ? parseFloat(m[2]) : 0,
      }));
    } catch (e) {}
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// Compute the per-card horizontal margin so a fan of `n` cards (each cardW px wide)
// always fits inside `containerW`. The stride (visible width per extra card) is
// clamped to stay positive so cards always march rightward — they can never pile up
// off the left edge no matter how big the hand grows.
function _handCardMargin(n, containerW, cardW) {
  if (n <= 1) return -28;
  const safety = 24; // small padding inside the container
  const targetStride = (containerW - cardW - safety) / (n - 1);
  // Loose default overlap when the hand is small enough to fan out comfortably.
  if (targetStride >= cardW - 56) return -28;
  // Otherwise compute the overlap that exactly fills the container.
  // stride = cardW - 2|m|  →  |m| = (cardW - stride) / 2.
  // Stride must stay >= 4 so cards always advance right and remain identifiable.
  const stride = Math.max(4, targetStride);
  const m = Math.round((cardW - stride) / 2);
  // Cap the absolute overlap so it never exceeds (cardW - 4) / 2 = 57 — beyond that
  // cards would visually march leftward, which is exactly what we're preventing.
  return -Math.min(57, Math.max(28, m));
}

// Width of the hand-fan box in pixels. Computed from the viewport so it matches
// the CSS `left:calc(50% + 30px); right:180px` declaration on .hand-fan-overlay.
// This avoids relying on `clientWidth`, which can return 0 / stale values for
// absolutely-positioned flex containers whose content overflows.
function _handFanWidth() {
  const vw = window.innerWidth || document.documentElement.clientWidth || 1200;
  return Math.max(260, vw * 0.5 - 210);
}

function renderMyHand() {
  _setText('my-hand-count', GS.me.hand.length);
  const el = document.getElementById('my-hand');
  if (!el) return;
  const n = GS.me.hand.length;
  const mx = _handCardMargin(n, _handFanWidth(), 118);
  el.style.setProperty('--hand-card-mx', mx + 'px');
  el.innerHTML = GS.me.hand.map((c, i) => {
    // Arch fan: middle cards sit highest, edges sweep down (parabolic arch)
    const t = n > 1 ? (i / (n - 1)) * 2 - 1 : 0; // -1 .. 1
    const maxSpread = Math.min(40, n * 5); // total degrees of fan
    const rot = (maxSpread / 2) * t; // negative on left, positive on right
    const peakLift = Math.min(48, n * 5); // px lift at center peak
    const lift = -peakLift * (1 - t * t); // arch: 0 at edges, -peak at middle
    const html = boardCardHTML(c, 'hand');
    // Apply the margin inline as well as via the CSS variable so nothing in the
    // cascade can leave a card at the default -28px when many cards are drawn.
    return html.replace(
      'class="board-card',
      `style="transform:translateY(${lift}px) rotate(${rot}deg);margin:0 ${mx}px;" class="board-card`
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
  if (el) {
    const n = Math.min(GS.opp.handCount, 10);
    const mx = _handCardMargin(n, _handFanWidth(), 118);
    el.style.setProperty('--hand-card-mx', mx + 'px');
    el.innerHTML = Array(n).fill(0).map((_, i) => {
      const t = n > 1 ? (i / (n - 1)) * 2 - 1 : 0;
      const maxSpread = Math.min(40, n * 5);
      const rot = (maxSpread / 2) * t;
      const peakLift = Math.min(48, n * 5);
      const lift = -peakLift * (1 - t * t);
      return `<div class="opp-card-back" style="transform:translateY(${lift}px) rotate(${rot}deg);margin:0 ${mx}px;"></div>`;
    }).join('');
  }
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
  // Click on a card on the board taps it (90° right). Hand cards still open the action menu on click.
  // Right-click on any in-play card opens the action menu.
  const isHand = zone === 'hand';
  const click = mine
    ? (isHand
        ? `onclick="showBoardCardMenu(event,'${cardJson}','${zone}')"`
        : `onclick="event.stopPropagation();_toggleExhaustAny('${card._uid}')" oncontextmenu="event.preventDefault();showBoardCardMenu(event,'${cardJson}','${zone}')"`)
    : '';
  const safeName = (card.name||'').replace(/"/g,'&quot;');
  // For runes only: a small button in the bottom-left to send the rune to the bottom of the deck.
  const isRuneZone = zone === 'support-cards' || zone === 'support';
  const runeBtn = (isRuneZone && mine)
    ? `<button class="rune-deck-btn" onclick="event.stopPropagation();_runeBottomOfDeck('${card._uid}')" title="Send to bottom of deck">⤓</button>`
    : '';
  return `<div class="board-card${exhausted}${bfClass}" ${drag} ${click} title="${safeName}" data-uid="${card._uid||''}" data-img="${img}" data-name="${safeName}">
    ${img ? `<img src="${img}" alt="${safeName}">` : `<div style="padding:4px;font-size:9px;color:rgba(255,255,255,0.5);text-align:center;word-break:break-word;">${card.name||'?'}</div>`}
    ${runeBtn}
  </div>`;
}

/* ── Card hover preview ────────────────────────── */
let _hoveredCard = null;
const _HOVER_SEL = '.board-card, .trash-top.has-card, .pdo-card, .pdo-champion-zone.has-card, .pdo-portrait';
function _onBoardHover(e) {
  const card = e.target.closest(_HOVER_SEL);
  if (!card) return;
  if (card === _hoveredCard) return; // still inside same card
  // Hover zoom is disabled for any rune-zone card or rune-deck stack — hovering
  // a rune should not pop up the floating card preview.
  if (card.closest('#runes-zone, #opp-runes-zone, #rune-deck-zone, #opp-rune-deck-zone')) return;
  _hoveredCard = card;
  const img = card.getAttribute('data-img') || (card.querySelector('img') && card.querySelector('img').src) || '';
  const name = card.getAttribute('data-name') || (card.querySelector('img') && card.querySelector('img').alt) || '';
  if (!img && !name) return;
  _showCardPreview(img, name, card);
}
function _onBoardHoverOut(e) {
  const card = e.target.closest(_HOVER_SEL);
  if (!card) return;
  if (e.relatedTarget && card.contains(e.relatedTarget)) return;
  _hoveredCard = null;
  _hideCardPreview();
}
function _showCardPreview(img, name, sourceEl) {
  const p = document.getElementById('card-hover-preview');
  if (!p) return;
  p.innerHTML = img
    ? `<img src="${img}" alt="${name}" style="width:100%;height:100%;object-fit:cover;display:block;">`
    : `<div class="nohover-name">${name||'?'}</div>`;
  const rect = sourceEl.getBoundingClientRect();
  const w = 280, h = 392;
  let left = rect.right + 14;
  if (left + w > window.innerWidth - 8) left = rect.left - w - 14;
  if (left < 8) left = 8;
  let top = rect.top + rect.height / 2 - h / 2;
  if (top < 8) top = 8;
  if (top + h > window.innerHeight - 8) top = window.innerHeight - h - 8;
  // Force-set styles so any leftover inline state from other pages can't suppress the preview
  p.style.cssText =
    `position:fixed;left:${left}px;top:${top}px;width:${w}px;height:${h}px;` +
    `border-radius:14px;overflow:hidden;border:2px solid rgba(232,184,85,0.85);` +
    `box-shadow:0 18px 48px rgba(0,0,0,0.85),0 0 28px rgba(200,154,58,0.45);` +
    `z-index:9999;pointer-events:none;background:#0a1428;display:block;`;
  p.classList.add('show');
}
function _hideCardPreview() {
  const p = document.getElementById('card-hover-preview');
  if (!p) return;
  p.classList.remove('show');
  p.style.display = 'none';
}
// Bind once
if (typeof window !== 'undefined' && !window._cardHoverBound) {
  window._cardHoverBound = true;
  document.addEventListener('mouseover', _onBoardHover);
  document.addEventListener('mouseout',  _onBoardHoverOut);
}

// Recompute hand-fan overlap when the viewport width changes so cards keep fitting
// inside the orange-line boundaries.
if (typeof window !== 'undefined' && !window._handFanResizeBound) {
  window._handFanResizeBound = true;
  let _handResizeRaf = 0;
  window.addEventListener('resize', () => {
    if (_handResizeRaf) return;
    _handResizeRaf = requestAnimationFrame(() => {
      _handResizeRaf = 0;
      if (typeof renderMyHand === 'function') renderMyHand();
      if (typeof renderOppHand === 'function') renderOppHand();
    });
  });
}

function _isMyCard(card) {
  // Includes battlefield arrays so cards rendered into bf-left / bf-right /
  // bfArea also get the draggable="true" + ondragstart attributes from
  // boardCardHTML, allowing them to be dragged back out to any other zone.
  const bfL = GS.me.bfLeft || [];
  const bfR = GS.me.bfRight || [];
  const bfA = GS.me.bfArea || [];
  return GS.me.hand.some(c=>c._uid===card._uid) ||
         GS.me.battle.some(c=>c._uid===card._uid) ||
         GS.me.support.some(c=>c._uid===card._uid) ||
         bfL.some(c=>c._uid===card._uid) ||
         bfR.some(c=>c._uid===card._uid) ||
         bfA.some(c=>c._uid===card._uid) ||
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
    case 'battlefield-area':
      GS.me.bfArea = GS.me.bfArea || [];
      GS.me.bfArea.push(card);
      break;
    case 'battlefield-left':
      GS.me.bfLeft = GS.me.bfLeft || [];
      GS.me.bfLeft.push(card);
      break;
    case 'battlefield-right':
      GS.me.bfRight = GS.me.bfRight || [];
      GS.me.bfRight.push(card);
      break;
    case 'hand':
      GS.me.hand.push(card);
      break;
    case 'deck':
      // Drop on top of deck (next draw will pick this up)
      GS.me.deck.unshift(card);
      break;
    case 'rune-deck':
      // Drop on top of the rune deck — used to return runes to the unrevealed pile
      GS.me.runes = GS.me.runes || [];
      GS.me.runes.unshift(card);
      _setText('my-rune-count', GS.me.runes.length);
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

// Toggle exhaust for any of my cards regardless of which zone it lives in.
// Used by the click-to-tap handler so any board card rotates 90° on click.
function _toggleExhaustAny(uid) {
  const arrays = [
    GS.me.hand, GS.me.battle, GS.me.support,
    GS.me.bfLeft, GS.me.bfRight, GS.me.bfArea
  ];
  for (const arr of arrays) {
    if (!arr) continue;
    const c = arr.find(x => x && x._uid === uid);
    if (c) { c._exhausted = !c._exhausted; renderFullBoard(); return; }
  }
  if (GS.me.legend && GS.me.legend._uid === uid) {
    GS.me.legend._exhausted = !GS.me.legend._exhausted;
    renderFullBoard(); return;
  }
  if (GS.me.champion && GS.me.champion._uid === uid) {
    GS.me.champion._exhausted = !GS.me.champion._exhausted;
    renderFullBoard(); return;
  }
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

// Send a rune from the runes zone to the bottom of the rune deck (or main deck
// if no rune deck exists). Triggered by the small ⤓ button rendered on every
// face-up rune in #runes-zone. Cards dragged to the deck zone go to the TOP
// (via dropToZone's GS.me.deck.unshift) — this button is the "bottom" variant.
function _runeBottomOfDeck(uid) {
  const i = GS.me.support.findIndex(c => c && c._uid === uid);
  if (i === -1) return;
  const c = GS.me.support.splice(i, 1)[0];
  c._exhausted = false;
  // Riftbound: runes return to the rune deck. Fall back to the main deck if
  // a separate rune deck array isn't tracked.
  const targetDeck = Array.isArray(GS.me.runes) ? GS.me.runes : GS.me.deck;
  targetDeck.push(c); // bottom of the deck
  _setText('my-deck-count', GS.me.deck.length);
  if (typeof _setText === 'function') _setText('my-rune-count', (GS.me.runes||[]).length);
  renderFullBoard();
}

function _findMyCard(uid, zone) {
  const arr = zone==='hand'?GS.me.hand:zone==='battle'?GS.me.battle:GS.me.support;
  return arr.find(c=>c._uid===uid);
}

function _pluckMyCard(uid, zone) {
  // Singleton zones first — match by uid regardless of which "zone" name was
  // passed. The render code uses rowIds like 'my-legend-cards' / 'my-champion-cards'
  // for these slots, so a strict zone === 'legend' check would miss them and
  // the drag would silently fail.
  if (GS.me.legend && GS.me.legend._uid === uid) {
    const c = GS.me.legend; GS.me.legend = null; return c;
  }
  if (GS.me.champion && GS.me.champion._uid === uid) {
    const c = GS.me.champion; GS.me.champion = null; return c;
  }
  GS.me.bfArea = GS.me.bfArea || [];
  GS.me.bfLeft = GS.me.bfLeft || [];
  GS.me.bfRight = GS.me.bfRight || [];
  const zones = {
    hand:GS.me.hand, battle:GS.me.battle, support:GS.me.support,
    discard:GS.me.discard, trash:GS.me.discard,
    'battlefield-area':GS.me.bfArea, 'my-battlefield-cards':GS.me.bfArea,
    'battle-cards':GS.me.battle, 'support-cards':GS.me.support,
    // Battlefield zones — let cards be dragged BACK out of bf-left / bf-right
    // (the rowId zones used at render time) into hand / battle / support / trash / etc.
    'bf-left-cards':GS.me.bfLeft, 'bf-right-cards':GS.me.bfRight,
    bfLeft:GS.me.bfLeft, bfRight:GS.me.bfRight,
  };
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
  if (badge) {
    badge.textContent = GS.myTurn ? '⚡ Your Turn' : "Opponent's Turn";
    badge.className = 'board-turn-badge' + (GS.myTurn ? ' my-turn' : '');
  }
  const btn = document.getElementById('end-turn-btn');
  if (btn) btn.disabled = !GS.myTurn;
  // Mirror state into the left options panel
  const status = document.getElementById('po-turn-status');
  if (status) {
    status.textContent = GS.myTurn ? '⚡ Your Turn' : "Opponent's Turn";
    status.classList.toggle('opp-turn', !GS.myTurn);
  }
  const poEnd = document.getElementById('po-end-turn');
  if (poEnd) poEnd.disabled = !GS.myTurn;
}

function togglePlayOptions(force) {
  const p = document.getElementById('play-options-panel');
  if (!p) return;
  const open = (typeof force === 'boolean') ? force : !p.classList.contains('open');
  p.classList.toggle('open', open);
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

/* ── PRE-GAME DECK CUSTOMIZER ──────────────────── */
function showDeckCustomizer(deckId, opts) {
  const decks = (typeof myDecks !== 'undefined' && myDecks.length)
    ? myDecks
    : JSON.parse(localStorage.getItem('rl_decks') || '[]');
  const deck = decks.find(d => String(d.id) === String(deckId));
  if (!deck) { opts.onConfirm && opts.onConfirm(null); return; }

  // Working copies — entries with cnt counters; click swaps single copies
  // Legend is the player's portrait, never editable in the customizer — preserve it for confirm
  const allEntries = JSON.parse(JSON.stringify(deck.cards || []));
  const legendEntries = allEntries.filter(e => e.t === 'Legend');
  const main = allEntries.filter(e => e.t !== 'Legend');
  const side = JSON.parse(JSON.stringify(deck.sideboard || []));
  // If the deck stored its champion in deck.champion (legacy), surface it as a deck entry
  if (deck.champion && deck.champion.id && !main.find(e => e.id === deck.champion.id)) {
    main.unshift({ id: deck.champion.id, n: deck.champion.n || '', t: 'Champion', cnt: 1 });
  }
  // Active champion slot — starts empty; user drags one in from the deck
  let activeChampion = null;
  // Battlefields: array of {id, n} (or null) — present in the deck file
  const battlefields = (deck.battlefields || []).filter(Boolean).map(b => ({ ...b }));
  let selectedBattlefieldId = battlefields.length ? battlefields[0].id : null;
  const allCards = (typeof CARDS !== 'undefined' && CARDS.length) ? CARDS : (window._allCards || []);
  const lookup = id => allCards.find(c => c.id === id);

  const overlay = document.getElementById('play-deck-overlay');
  if (!overlay) { opts.onConfirm && opts.onConfirm(deck); return; }

  // Headers
  document.getElementById('pdo-me-name').textContent = opts.meName || 'You';
  document.getElementById('pdo-opp-name').textContent = opts.oppName || 'Opponent';
  // Set the legend art as the player portrait if found
  const legendEntry = (deck.cards || []).find(c => c.t === 'Legend');
  const legendCard = legendEntry ? lookup(legendEntry.id) : null;
  const portraitEl = document.getElementById('pdo-me-portrait');
  if (portraitEl) {
    portraitEl.innerHTML = (legendCard && legendCard.imageUrl)
      ? `<img src="${legendCard.imageUrl}" alt="${legendCard.name||''}">`
      : `<span style="font-size:36px;color:rgba(232,212,122,0.4);">★</span>`;
  }
  const oppPortrait = document.getElementById('pdo-opp-portrait');
  if (oppPortrait) {
    if ((opts.oppName || '').toLowerCase() === 'goldfish') {
      oppPortrait.classList.add('goldfish');
      oppPortrait.innerHTML = `<span style="font-size:84px;line-height:1;">🐠</span>`;
    } else {
      oppPortrait.classList.remove('goldfish');
      oppPortrait.innerHTML = `<span style="font-size:36px;color:rgba(232,212,122,0.4);">?</span>`;
    }
  }

  function _renderEntry(entry, target) {
    const full = lookup(entry.id);
    const img = full && full.imageUrl ? full.imageUrl : '';
    const name = (full && full.name) || entry.n || entry.id;
    const safeName = name.replace(/"/g,'&quot;');
    const flag = entry.t === 'Legend' ? 'LEGEND'
              : entry.t === 'Champion' ? 'CHAMPION'
              : '';
    // Expand cnt into individual cards laid out side-by-side
    const cnt = Math.max(1, entry.cnt || 1);
    const isChampion = entry.t === 'Champion';
    const drag = (target === 'main' && isChampion)
      ? `draggable="true" ondragstart="_pdoChampionDragStart(event,'${entry.id}')"`
      : '';
    let html = '';
    for (let i = 0; i < cnt; i++) {
      html += `<div class="pdo-card${isChampion?' is-champion':''}" data-img="${img}" data-name="${safeName}" onclick="_pdoClick('${entry.id}','${target}')" ${drag}>
        ${img ? `<img src="${img}" alt="${safeName}">` : `<div class="pdo-card-no-img">${name}</div>`}
        ${flag ? `<span class="pdo-card-flag">${flag}</span>` : ''}
      </div>`;
    }
    return html;
  }

  // Sort: Legend → Champion → cost ascending → name
  function _sortEntries(arr) {
    return arr.slice().sort((a, b) => {
      const order = (e) => e.t === 'Legend' ? 0 : e.t === 'Champion' ? 1 : 2;
      const oa = order(a), ob = order(b);
      if (oa !== ob) return oa - ob;
      const fa = lookup(a.id), fb = lookup(b.id);
      const ca = fa && fa.cost != null ? fa.cost : 99;
      const cb = fb && fb.cost != null ? fb.cost : 99;
      if (ca !== cb) return ca - cb;
      const na = (fa && fa.name) || a.n || a.id;
      const nb = (fb && fb.name) || b.n || b.id;
      return String(na).localeCompare(String(nb));
    });
  }

  function _renderChampionSlot() {
    const slot = document.getElementById('pdo-champion-slot');
    if (!slot) return;
    if (activeChampion) {
      const full = lookup(activeChampion.id);
      const img = (full && full.imageUrl) || '';
      const name = ((full && full.name) || activeChampion.n || '').replace(/"/g,'&quot;');
      slot.classList.add('has-card');
      slot.setAttribute('draggable', 'true');
      slot.setAttribute('data-img', img);
      slot.setAttribute('data-name', name);
      slot.ondragstart = (e) => {
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', activeChampion.id);
          e.dataTransfer.setData('application/x-pdo-source', 'champion');
          e.dataTransfer.effectAllowed = 'move';
        }
      };
      slot.innerHTML = img
        ? `<img src="${img}" alt="${name}" data-img="${img}" data-name="${name}" draggable="false">`
        : `<div style="padding:6px;font-size:10px;text-align:center;color:rgba(255,255,255,0.7);">${name}</div>`;
    } else {
      slot.classList.remove('has-card');
      slot.removeAttribute('draggable');
      slot.removeAttribute('data-img');
      slot.removeAttribute('data-name');
      slot.ondragstart = null;
      slot.innerHTML = `<span class="pdo-champion-empty">CHAMPION<br><span style="font-size:9px;opacity:0.7;font-weight:500;">drag from deck</span></span>`;
    }
  }

  // Make deck and sideboard grids accept the champion when dragged off the slot
  function _bindDropTargets() {
    ['pdo-deck-grid','pdo-side-grid'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.ondragover = (e) => { e.preventDefault(); el.classList.add('drag-over'); };
      el.ondragleave = () => el.classList.remove('drag-over');
      el.ondrop = (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        const source = e.dataTransfer ? e.dataTransfer.getData('application/x-pdo-source') : '';
        if (source !== 'champion' || !activeChampion) return;
        const targetArr = id === 'pdo-side-grid' ? side : main;
        const existing = targetArr.find(en => en.id === activeChampion.id);
        if (existing) existing.cnt = (existing.cnt || 0) + 1;
        else targetArr.push({ ...activeChampion, cnt: 1 });
        activeChampion = null;
        refresh();
      };
    });
  }

  function _renderBattlefieldGrid() {
    const grid = document.getElementById('pdo-bf-grid');
    if (!grid) return;
    if (!battlefields.length) {
      grid.innerHTML = `<div class="pdo-empty">No battlefields in this deck.</div>`;
      return;
    }
    grid.innerHTML = battlefields.map(b => {
      const full = lookup(b.id);
      const img = (full && full.imageUrl) || '';
      const name = ((full && full.name) || b.n || '').replace(/"/g,'&quot;');
      const sel = b.id === selectedBattlefieldId ? ' bf-selected' : '';
      return `<div class="pdo-card${sel}" data-img="${img}" data-name="${name}" onclick="_pdoPickBattlefield('${b.id}')">
        ${img ? `<img src="${img}" alt="${name}">` : `<div class="pdo-card-no-img">${name}</div>`}
        <span class="pdo-card-flag">BATTLEFIELD</span>
      </div>`;
    }).join('');
  }

  // Tab switching: 'side' / 'bf' / 'rune'
  let activeBottomTab = 'side';
  window._pdoSetBottomTab = function(tab) {
    activeBottomTab = tab;
    document.querySelectorAll('.pdo-bt-tab').forEach(b => {
      b.classList.toggle('on', b.getAttribute('data-tab') === tab);
    });
    const sideGrid = document.getElementById('pdo-side-grid');
    const bfGrid   = document.getElementById('pdo-bf-grid');
    const runeGrid = document.getElementById('pdo-rune-grid');
    if (sideGrid) sideGrid.style.display = tab === 'side' ? '' : 'none';
    if (bfGrid)   bfGrid.style.display   = tab === 'bf'   ? '' : 'none';
    if (runeGrid) runeGrid.style.display = tab === 'rune' ? '' : 'none';
  };

  function _renderRuneGrid() {
    const grid = document.getElementById('pdo-rune-grid');
    if (!grid) return;
    const runes = (deck.runes || []);
    if (!runes.length) { grid.innerHTML = `<div class="pdo-empty">No runes in this deck.</div>`; return; }
    grid.innerHTML = runes.map(e => {
      const full = lookup(e.id);
      const img = (full && full.imageUrl) || '';
      const name = ((full && full.name) || e.n || '').replace(/"/g,'&quot;');
      const cnt = e.cnt || 1;
      let html = '';
      for (let i = 0; i < cnt; i++) {
        html += `<div class="pdo-card" data-img="${img}" data-name="${name}">
          ${img ? `<img src="${img}" alt="${name}">` : `<div class="pdo-card-no-img">${name}</div>`}
          <span class="pdo-card-flag">RUNE</span>
        </div>`;
      }
      return html;
    }).join('');
  }

  window._pdoPickBattlefield = function(id) {
    selectedBattlefieldId = (selectedBattlefieldId === id) ? null : id;
    _renderBattlefieldGrid();
  };

  function refresh() {
    const deckGrid = document.getElementById('pdo-deck-grid');
    const sideGrid = document.getElementById('pdo-side-grid');
    deckGrid.innerHTML = main.length
      ? _sortEntries(main).map(e => _renderEntry(e, 'main')).join('')
      : `<div class="pdo-empty">Empty deck</div>`;
    sideGrid.innerHTML = side.length
      ? _sortEntries(side).map(e => _renderEntry(e, 'side')).join('')
      : `<div class="pdo-empty">No sideboard cards. Click any deck card above to send a copy here.</div>`;
    _renderBattlefieldGrid();
    _renderRuneGrid();
    const total = main.reduce((a,e)=>a+(e.cnt||1),0) + (activeChampion ? (activeChampion.cnt || 1) : 0);
    const sideTotal = side.reduce((a,e)=>a+(e.cnt||1),0);
    const runeTotal = (deck.runes||[]).reduce((a,e)=>a+(e.cnt||1),0);
    const deckCount = document.getElementById('pdo-deck-count');
    const sideCount = document.getElementById('pdo-side-count');
    const bfCount   = document.getElementById('pdo-bf-count');
    const runeCount = document.getElementById('pdo-rune-count');
    if (deckCount) deckCount.textContent = `${total} / 40`;
    if (sideCount) sideCount.textContent = String(sideTotal);
    if (bfCount)   bfCount.textContent   = String(battlefields.length);
    if (runeCount) runeCount.textContent = String(runeTotal);
    _renderChampionSlot();
  }

  // Expose click handler on window so inline onclick can reach it
  window._pdoClick = function(cardId, source) {
    const fromArr = source === 'main' ? main : side;
    const toArr   = source === 'main' ? side : main;
    const fIdx = fromArr.findIndex(e => e.id === cardId);
    if (fIdx === -1) return;
    fromArr[fIdx].cnt = Math.max(0, (fromArr[fIdx].cnt || 1) - 1);
    const tIdx = toArr.findIndex(e => e.id === cardId);
    if (tIdx >= 0) toArr[tIdx].cnt = (toArr[tIdx].cnt || 0) + 1;
    else toArr.push({ ...fromArr[fIdx], cnt: 1 });
    if (fromArr[fIdx].cnt === 0) fromArr.splice(fIdx, 1);
    refresh();
  };

  // Drag a champion card from the deck onto the champion slot
  window._pdoChampionDragStart = function(e, cardId) {
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', cardId);
      e.dataTransfer.effectAllowed = 'move';
    }
  };
  window._pdoDropChampion = function(e) {
    e.preventDefault();
    const slot = document.getElementById('pdo-champion-slot');
    if (slot) slot.classList.remove('drag-over');
    const cardId = e.dataTransfer ? e.dataTransfer.getData('text/plain') : null;
    if (!cardId) return;
    const idx = main.findIndex(en => en.id === cardId && en.t === 'Champion');
    if (idx === -1) return;
    // Remove one copy from deck
    main[idx].cnt = Math.max(0, (main[idx].cnt || 1) - 1);
    const taken = { ...main[idx], cnt: 1 };
    if (main[idx].cnt === 0) main.splice(idx, 1);
    // If a champion was already set, send it back to the deck (one copy)
    if (activeChampion) {
      const back = main.findIndex(en => en.id === activeChampion.id);
      if (back >= 0) main[back].cnt = (main[back].cnt || 0) + 1;
      else main.push({ ...activeChampion, cnt: 1 });
    }
    activeChampion = taken;
    refresh();
  };

  // Card-size sliders — controls the auto-fill min size on each grid
  window._pdoSetSize = function(which, val) {
    const px = parseInt(val, 10) || 90;
    const id = which === 'side' ? 'pdo-side-grid' : 'pdo-deck-grid';
    const el = document.getElementById(id);
    if (el) el.style.setProperty('--pdo-min', px + 'px');
  };

  document.getElementById('pdo-confirm').onclick = () => {
    overlay.classList.remove('open');
    // Re-attach legend + active champion so the loader still finds them
    const champArr = activeChampion ? [{ id: activeChampion.id, n: activeChampion.n || '', t: 'Champion', cnt: activeChampion.cnt || 1 }] : [];
    // Only the player-picked battlefield is loaded into the game
    const chosenBattlefield = battlefields.find(b => b.id === selectedBattlefieldId) || null;
    const merged = {
      ...deck,
      cards: [...legendEntries, ...champArr, ...main],
      sideboard: side,
      battlefields: chosenBattlefield ? [chosenBattlefield] : []
    };
    opts.onConfirm && opts.onConfirm(merged);
  };
  document.getElementById('pdo-leave').onclick = () => {
    overlay.classList.remove('open');
    leaveBoard && leaveBoard();
  };

  overlay.classList.add('open');
  _bindDropTargets();
  refresh();
}

/* ── Battlefield zones — drag + resize from corners ─────────────── */
function _initBfDragResize() {
  const stage = document.getElementById('bf-stage');
  if (!stage) return;
  document.querySelectorAll('.bf-large').forEach(el => {
    if (el._bfDragInit) return;
    el._bfDragInit = true;

    // Snapshot current grid-rendered position into absolute coordinates
    const stageRect = stage.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const saved = JSON.parse(localStorage.getItem('rl_bf_pos_' + el.id) || 'null');
    el.classList.add('bf-floating');
    if (saved) {
      el.style.left = saved.left + 'px';
      el.style.top = saved.top + 'px';
      el.style.width = saved.width + 'px';
      el.style.height = saved.height + 'px';
    } else {
      el.style.left = (rect.left - stageRect.left) + 'px';
      el.style.top = (rect.top - stageRect.top) + 'px';
      el.style.width = rect.width + 'px';
      el.style.height = rect.height + 'px';
    }

    // Add 4 corner resize handles
    ['nw','ne','sw','se'].forEach(dir => {
      const h = document.createElement('div');
      h.className = 'bf-resize-handle bf-resize-' + dir;
      el.appendChild(h);
      h.addEventListener('mousedown', e => _bfStartResize(e, el, dir));
    });

    // Drag the body
    el.addEventListener('mousedown', e => {
      // Skip drag if the user clicked a corner handle, a card, or the + button
      if (e.target.closest('.bf-resize-handle, .board-card, .bf-add-btn, button')) return;
      _bfStartDrag(e, el);
    });
  });
  // Once both bf zones are floating, the grid has nothing left to lay out — collapse to 0 height row
  stage.style.minHeight = stage.style.height || '300px';
}

function _bfStartDrag(e, el) {
  const stage = el.parentElement;
  const startX = e.clientX, startY = e.clientY;
  const startLeft = parseFloat(el.style.left) || 0;
  const startTop  = parseFloat(el.style.top)  || 0;
  function onMove(ev) {
    el.style.left = (startLeft + ev.clientX - startX) + 'px';
    el.style.top  = (startTop  + ev.clientY - startY) + 'px';
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    _bfSavePos(el);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  e.preventDefault();
}

function _bfStartResize(e, el, dir) {
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX, startY = e.clientY;
  const startLeft = parseFloat(el.style.left) || 0;
  const startTop  = parseFloat(el.style.top)  || 0;
  const startW    = parseFloat(el.style.width)  || el.offsetWidth;
  const startH    = parseFloat(el.style.height) || el.offsetHeight;
  function onMove(ev) {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (dir.includes('e')) el.style.width  = Math.max(60, startW + dx) + 'px';
    if (dir.includes('s')) el.style.height = Math.max(60, startH + dy) + 'px';
    if (dir.includes('w')) {
      const w = Math.max(60, startW - dx);
      el.style.width = w + 'px';
      el.style.left  = (startLeft + (startW - w)) + 'px';
    }
    if (dir.includes('n')) {
      const h = Math.max(60, startH - dy);
      el.style.height = h + 'px';
      el.style.top    = (startTop + (startH - h)) + 'px';
    }
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    _bfSavePos(el);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function _bfSavePos(el) {
  try {
    localStorage.setItem('rl_bf_pos_' + el.id, JSON.stringify({
      left:   parseFloat(el.style.left)   || 0,
      top:    parseFloat(el.style.top)    || 0,
      width:  parseFloat(el.style.width)  || 0,
      height: parseFloat(el.style.height) || 0
    }));
  } catch(e) {}
}

/* ── Resizable zones (Base / Runes / Legend / Champion) ───────── */
const _RESIZABLE_IDS = ['play-base-zone','runes-zone','my-legend-zone','my-champion-zone','opp-legend-zone','opp-champion-zone'];
function _initZoneResize() {
  _RESIZABLE_IDS.forEach(_makeZoneResizable);
}
function _makeZoneResizable(id) {
  const el = document.getElementById(id);
  if (!el || el._resizeInit) return;
  el._resizeInit = true;
  // Restore saved size
  try {
    const saved = JSON.parse(localStorage.getItem('rl_size_' + id) || 'null');
    if (saved) {
      if (saved.width)  el.style.width  = saved.width  + 'px';
      if (saved.height) el.style.height = saved.height + 'px';
      // Hint to flex/grid that this should respect inline sizing
      el.style.flex = '0 0 auto';
    }
  } catch(e) {}
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  // Add a corner grip
  const grip = document.createElement('div');
  grip.className = 'zone-resize-grip';
  grip.title = 'Drag to resize';
  el.appendChild(grip);
  grip.addEventListener('mousedown', e => _zoneStartResize(e, el, id));
}
function _zoneStartResize(e, el, id) {
  e.preventDefault();
  e.stopPropagation();
  const rect = el.getBoundingClientRect();
  const startX = e.clientX, startY = e.clientY;
  const startW = rect.width, startH = rect.height;
  el.style.flex = '0 0 auto';
  function onMove(ev) {
    const w = Math.max(60, startW + (ev.clientX - startX));
    const h = Math.max(60, startH + (ev.clientY - startY));
    el.style.width  = w + 'px';
    el.style.height = h + 'px';
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    try {
      localStorage.setItem('rl_size_' + id, JSON.stringify({
        width:  parseFloat(el.style.width),
        height: parseFloat(el.style.height)
      }));
    } catch(e) {}
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
