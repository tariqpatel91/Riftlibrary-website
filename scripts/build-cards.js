#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * build-cards.js — Pull every Riftbound card from Riftcodex AND DotGG,
 * merge them by tcgplayer/marketIds, and write a single ./cards.json that
 * the website loads at runtime instead of hitting either API live.
 *
 * Usage:
 *   node scripts/build-cards.js
 *
 * Output (project-root / cards.json):
 *   [
 *     {
 *       id, name, type, supertype, dom, doms, cost, might, power,
 *       rarity, set, setLabel, txt, flavour, artist, imageUrl, tags,
 *       isSignature, isAltArt, isOvernumbered, variant, riftboundId,
 *       // DotGG-sourced (null when DotGG didn't have this card)
 *       price, foilPrice, deltaPrice, delta7dPrice,
 *       tcgPlayerId, cardmarketId, hasFoil, banned
 *     },
 *     ...
 *   ]
 *
 * Re-run whenever new cards drop or you want fresh prices, then commit
 * cards.json so the deployed site picks up the update.
 */

const fs = require('fs');
const path = require('path');

const RIFTCODEX_PAGE_SIZE = 100;
const RIFTCODEX_MAX_PAGES = 200; // safety cap (current set is ~11 pages)

async function fetchAllRiftcodex() {
  const items = [];
  // First page tells us total page count, then fetch the rest in parallel
  const firstUrl = `https://api.riftcodex.com/cards?size=${RIFTCODEX_PAGE_SIZE}&page=1&sort=collector_number`;
  const firstRes = await fetch(firstUrl);
  if (!firstRes.ok) throw new Error(`Riftcodex page 1: HTTP ${firstRes.status}`);
  const first = await firstRes.json();
  items.push(...(first.items || []));
  const pages = Math.min(first.pages || 1, RIFTCODEX_MAX_PAGES);
  if (pages > 1) {
    const urls = [];
    for (let p = 2; p <= pages; p++) {
      urls.push(`https://api.riftcodex.com/cards?size=${RIFTCODEX_PAGE_SIZE}&page=${p}&sort=collector_number`);
    }
    const responses = await Promise.all(urls.map(u =>
      fetch(u).then(r => {
        if (!r.ok) throw new Error(`Riftcodex ${u}: HTTP ${r.status}`);
        return r.json();
      })
    ));
    for (const r of responses) items.push(...(r.items || []));
  }
  return items;
}

async function fetchDotGG() {
  const url = 'https://api.dotgg.gg/cgfw/getcards?game=riftbound';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DotGG: HTTP ${res.status}`);
  return await res.json();
}

// Mirrors mapCard() in riftlibrary.js so the generated JSON has the exact
// shape the frontend expects (no further transformation needed at runtime).
function mapCard(c) {
  if (!c || !c.name) return null;
  const cls = c.classification || {};
  const attr = c.attributes || {};
  const txt = c.text || {};
  const med = c.media || {};
  const set = c.set || {};
  const meta = c.metadata || {};
  const doms = (cls.domain || []).map(d => String(d).toLowerCase());
  const dom = doms[0] || 'order';
  const ctype = cls.type || 'Unit';
  const stype = cls.supertype || '';
  const statless = (
    ctype === 'Legend' || ctype === 'Battlefield' || ctype === 'Rune' || ctype === 'Token' ||
    stype === 'Legend' || stype === 'Token'
  );
  const cost = statless ? 0 : (attr.energy ?? 0);
  const might = statless ? 0 : (attr.might ?? 0);
  const power = statless ? 0 : (attr.power ?? 0);
  return {
    id: c.id || c.riftbound_id || c.name,
    name: c.name,
    type: ctype,
    supertype: stype,
    isSignature: meta.signature || false,
    isAltArt: meta.alternate_art || false,
    isOvernumbered: meta.overnumbered || false,
    variant: meta.alternate_art ? 'Alt Art'
           : meta.overnumbered ? 'Overnumbered'
           : (cls.rarity === 'Promo' ? 'Promo' : 'Standard'),
    dom,
    doms,
    cost,
    might,
    power,
    rarity: cls.rarity || '',
    set: set.set_id || '',
    setLabel: set.label || '',
    txt: txt.plain || '',
    flavour: txt.flavour || '',
    artist: med.artist || 'Unknown',
    imageUrl: med.image_url || '',
    tags: c.tags || [],
    riftboundId: c.riftbound_id || '',
    tcgplayerId: c.tcgplayer_id || '',
  };
}

// --- name reconciliation ---------------------------------------------------
// Riftcodex names are messy for newer sets: some records prefix a tag into the
// name ("Yordle, Kennen - Heart of the Tempest"), some carry only the title
// ("Heart of the Tempest"), and Vendetta uses "Champ, Title" where every other
// set uses "Champ - Title". DotGG names are the clean reference, but DotGG also
// appends promo descriptors ("(Origins Nexus Night Promo)") we don't want, so
// only borrow DotGG's base name for the specific breakages above.
function stripParenSuffix(n) { return String(n || '').replace(/\s*\([^)]*\)\s*$/, '').trim(); }
function parenSuffix(n) { const m = String(n || '').match(/\s*(\([^)]*\))\s*$/); return m ? ' ' + m[1] : ''; }
function normName(n) { return stripParenSuffix(n).toLowerCase().split(/ - |, /).join('|'); }
// Used to sanity-check the collector-number fallback match: special collector
// numbers (sp1, r01…) collide with regular ones and pair unrelated cards.
function namesCompatible(rcName, dgName) {
  const a = normName(rcName), b = normName(dgName);
  return a === b ||
    a.endsWith('|' + b) || b.endsWith('|' + a) ||
    a.startsWith(b + '|') || b.startsWith(a + '|');
}
function reconcileName(rcName, dgName) {
  const rcBase = stripParenSuffix(rcName);
  const dgBase = stripParenSuffix(dgName);
  const a = normName(rcName), b = normName(dgName);
  if (a !== b) {
    // Tag prefix ("Yordle, Kennen - X") or title-only ("X") → take DotGG's name
    if (a.endsWith('|' + b) || b.endsWith('|' + a)) return dgBase + parenSuffix(rcName);
    return rcName;
  }
  // Same words, comma instead of dash ("Kennen, Keeper of Balance") → DotGG's
  if (rcBase !== dgBase && rcBase.replace(', ', ' - ') === dgBase) return dgBase + parenSuffix(rcName);
  return rcName;
}

function num(s) {
  if (s === null || s === undefined || s === '') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function bool01(s) {
  return s === '1' || s === 1 || s === true;
}

(async () => {
  const t0 = Date.now();

  console.log('Fetching Riftcodex…');
  const rcItems = await fetchAllRiftcodex();
  console.log(`  ${rcItems.length} cards`);

  console.log('Fetching DotGG…');
  const dgItems = await fetchDotGG();
  console.log(`  ${dgItems.length} cards`);

  // Index DotGG by marketIds (= TCGPlayer product id) — cleanest cross-key.
  // Fall back to id (UNL-131 style) for cards without a TCGPlayer entry.
  const dgByTcg = new Map();
  const dgById = new Map();
  for (const c of dgItems) {
    if (c.marketIds) dgByTcg.set(String(c.marketIds), c);
    if (c.id) dgById.set(c.id, c);
  }

  let hits = 0;
  let misses = 0;
  let merged = [];
  const usedDotGGIds = new Set();
  for (const raw of rcItems) {
    const m = mapCard(raw);
    if (!m) continue;
    // 1) match by tcgplayer_id
    let dg = m.tcgplayerId && dgByTcg.get(String(m.tcgplayerId));
    // 2) fallback: derive the DotGG id from riftbound_id ("ven-113a-166" →
    //    "VEN-113A"). More precise than collector_number, which drops the
    //    alt-art letter suffix.
    if (!dg && m.riftboundId) {
      const parts = m.riftboundId.split('-');
      if (parts.length >= 2) {
        const cand = dgById.get(`${parts[0]}-${parts[1]}`.toUpperCase());
        if (cand && namesCompatible(m.name, cand.name)) dg = cand;
      }
    }
    // 3) last resort: "<SET>-<padded collector>".
    //    Name-check it: special collector numbers (sp1, r01…) collide with
    //    regular ones and would pair unrelated cards (wrong prices/images).
    if (!dg && m.set && raw.collector_number != null) {
      const pad = String(raw.collector_number).padStart(3, '0').toUpperCase();
      const cand = dgById.get(`${m.set}-${pad}`);
      if (cand && namesCompatible(m.name, cand.name)) dg = cand;
    }
    // Rank duplicate Riftcodex records for the same physical card: prefer one
    // with DotGG data, then one whose original name is the full "X - Y" form.
    m._score = (dg ? 2 : 0) + (m.name.includes(' - ') ? 1 : 0);
    if (dg) {
      hits++;
      m.name = reconcileName(m.name, dg.name);
      usedDotGGIds.add(dg.id);
      m.price = num(dg.price);
      m.foilPrice = num(dg.foilPrice);
      m.deltaPrice = num(dg.deltaPrice);
      m.delta7dPrice = num(dg.delta7dPrice);
      m.cardmarketPrice = num(dg.cmPrice);
      m.tcgPlayerId = dg.marketIds || null;
      m.cardmarketId = dg.cmid || null;
      m.hasFoil = bool01(dg.hasFoil);
      m.banned = bool01(dg.banned);
      // DotGG webp art is smaller and consistent — surface as an alt image
      m.imageUrlAlt = dg.image || null;
    } else {
      misses++;
      m.price = null;
      m.foilPrice = null;
      m.deltaPrice = null;
      m.delta7dPrice = null;
      m.cardmarketPrice = null;
      m.tcgPlayerId = null;
      m.cardmarketId = null;
      m.hasFoil = false;
      m.banned = false;
      m.imageUrlAlt = null;
    }
    merged.push(m);
  }

  // Riftcodex sometimes ships several records for one physical card (VEN
  // legends appear once with a full name and once title-only). Collapse by
  // riftbound_id, keeping the highest-ranked record.
  let dupesDropped = 0;
  const byRid = new Map();
  for (const m of merged) {
    if (!m.riftboundId) continue;
    const prev = byRid.get(m.riftboundId);
    if (!prev || (m._score || 0) > (prev._score || 0)) byRid.set(m.riftboundId, m);
  }
  merged = merged.filter(m => {
    if (!m.riftboundId) return true;
    if (byRid.get(m.riftboundId) === m) return true;
    dupesDropped++;
    return false;
  });
  for (const m of merged) delete m._score;

  // Now add DotGG-only cards (alt-art versions / additions Riftcodex hasn't
  // indexed yet). Construct a card object from DotGG fields with the same
  // shape; fields DotGG doesn't expose (power, artist, alt-art flags) stay
  // null/Unknown so the rest of the app keeps working.
  let dotggOnly = 0;
  for (const dg of dgItems) {
    if (!dg.id || usedDotGGIds.has(dg.id)) continue;
    const setId = (dg.id.split('-')[0] || '').toUpperCase();
    const colors = Array.isArray(dg.color) ? dg.color : [];
    const doms = colors.map(c => String(c).toLowerCase()).filter(c => c && c !== 'colorless');
    const cardType = dg.type || 'Unit';
    const stype = dg.supertype || '';
    const statless = (
      cardType === 'Legend' || cardType === 'Battlefield' || cardType === 'Rune' || cardType === 'Token' ||
      stype === 'Legend' || stype === 'Token'
    );
    const cost = statless ? 0 : (num(dg.cost) ?? 0);
    const might = statless ? 0 : (num(dg.might) ?? 0);
    const stripHtml = s => String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
    merged.push({
      id: dg.id,
      name: dg.name,
      type: cardType,
      supertype: stype,
      isSignature: false,
      isAltArt: false,
      isOvernumbered: false,
      variant: dg.rarity === 'Promo' ? 'Promo' : 'Standard',
      dom: doms[0] || 'order',
      doms,
      cost,
      might,
      power: 0,
      rarity: dg.rarity || '',
      set: setId,
      setLabel: dg.set_name || '',
      txt: stripHtml(dg.effect),
      flavour: dg.flavor || '',
      artist: 'Unknown',
      imageUrl: dg.image || '',
      imageUrlAlt: null,
      tags: Array.isArray(dg.tags) ? dg.tags : [],
      riftboundId: '',
      tcgplayerId: dg.marketIds || '',
      price: num(dg.price),
      foilPrice: num(dg.foilPrice),
      deltaPrice: num(dg.deltaPrice),
      delta7dPrice: num(dg.delta7dPrice),
      cardmarketPrice: num(dg.cmPrice),
      tcgPlayerId: dg.marketIds || null,
      cardmarketId: dg.cmid || null,
      hasFoil: bool01(dg.hasFoil),
      banned: bool01(dg.banned),
      _dotggOnly: true,
    });
    dotggOnly++;
  }

  // Generate a separate foil entry for every card that has a foil printing,
  // so foils show up as their own collectible / tradable entity in the UI.
  // Foil entries:
  //   - share name / image / text / stats with the regular printing
  //   - get id `<original>-foil` so the collection map tracks them separately
  //   - carry isFoil:true and variant:'Foil' for filter / rendering hooks
  //   - use foilPrice as `price` (so badges + sort treat it as the entry's price)
  //   - drop their own foilPrice (a foil card doesn't have a "foil of foil")
  //   - back-reference the source via _foilOf so the UI can link them
  let foilCount = 0;
  const foils = [];
  for (const c of merged) {
    const hasFoilPrinting = c.hasFoil === true || (typeof c.foilPrice === 'number' && c.foilPrice > 0);
    if (!hasFoilPrinting) continue;
    foils.push({
      ...c,
      id: c.id + '-foil',
      isFoil: true,
      variant: 'Foil',
      price: typeof c.foilPrice === 'number' && c.foilPrice > 0 ? c.foilPrice : null,
      foilPrice: null,
      hasFoil: false,
      _foilOf: c.id,
    });
    foilCount++;
  }
  merged.push(...foils);

  // Stable sort: by set then collector number when known, else by name
  merged.sort((a, b) => {
    if (a.set !== b.set) return (a.set || '').localeCompare(b.set || '');
    const nc = (a.name || '').localeCompare(b.name || '');
    if (nc !== 0) return nc;
    // Regular printings sort before their foil twin
    return (a.isFoil ? 1 : 0) - (b.isFoil ? 1 : 0);
  });

  const outPath = path.join(__dirname, '..', 'cards.json');
  fs.writeFileSync(outPath, JSON.stringify(merged));
  const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);

  console.log(`\nMerged ${merged.length} cards`);
  console.log(`  Riftcodex: ${rcItems.length} cards (${hits} matched DotGG, ${misses} no DotGG match)`);
  console.log(`  Duplicate Riftcodex records dropped: ${dupesDropped}`);
  console.log(`  DotGG-only additions: ${dotggOnly}`);
  console.log(`  Foil entries generated: ${foilCount}`);
  console.log(`Wrote ${outPath} (${sizeKb} KB) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
