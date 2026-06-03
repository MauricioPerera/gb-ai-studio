/**
 * game-lint-core.js — Reglas de validación de GAME.md como función pura e isomorfa (Node + navegador).
 * lintGame(data, body, opts) -> [{ level, rule, msg }]
 *   data  : front-matter YAML ya parseado.
 *   body  : cuerpo Markdown (para section-order). Opcional.
 *   opts  : { engineSource?: string, requireEngine?: bool, frontMatterPresent?: bool }
 *           - engineSource: texto del motor (simulator.js) para los cruces solid-sync/dead-token.
 *           - requireEngine: si true y no hay engineSource, solid-sync avisa (comportamiento CLI).
 *           - frontMatterPresent: si false, emite el error frontmatter-present.
 * Usado por la CLI (game-lint.js) y por el lint en vivo del navegador (app.js) para evitar drift.
 */
(function (factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.GameLintCore = api;
})(function () {

  function lintGame(data, body, opts) {
    data = data || {}; body = body || ''; opts = opts || {};
    const findings = [];
    const add = (level, rule, msg) => findings.push({ level, rule, msg });

    // frontmatter-present
    if (opts.frontMatterPresent === false) add('error', 'frontmatter-present', 'Falta el front-matter YAML (--- ... ---).');

    // required-fields
    for (const f of ['version', 'name']) if (!(f in data)) add('error', 'required-fields', 'Falta el campo obligatorio: ' + f);

    // section-order
    const CANON = ['Overview', 'Tiles', 'Types', 'Species', 'Maps', 'Player', 'Text', 'Economy & Balance', "Do's and Don'ts"];
    const headings = (body.match(/^##\s+(.+)$/gm) || []).map(h => h.replace(/^##\s+/, '').trim());
    let last = -1;
    for (const h of headings) {
      const idx = CANON.indexOf(h);
      if (idx === -1) { add('warn', 'section-order', 'Seccion no canonica: "' + h + '"'); continue; }
      if (idx < last) add('error', 'section-order', 'Seccion fuera de orden: "' + h + '"');
      else last = idx;
    }

    const types = data.types || {};
    const moves = data.moves || {};
    const species = data.species || {};
    const tiles = data.tiles || {};
    const typeKeys = new Set(Object.keys(types).concat(['NORMAL']));

    // palette-range
    const palCount = data.palettesCount || 0;
    for (const [id, t] of Object.entries(tiles)) {
      if (typeof t.pal === 'number' && (t.pal < 0 || t.pal >= palCount))
        add('error', 'palette-range', 'tile ' + id + ' usa paleta ' + t.pal + ' fuera de 0..' + (palCount - 1));
    }

    // palette-color-range
    for (const section of ['palettes', 'spritePalettes']) {
      for (const [pi, pal] of Object.entries(data[section] || {})) {
        if (!Array.isArray(pal)) continue;
        for (const c of pal) {
          if (!Array.isArray(c) || c.length !== 3 || c.some(v => typeof v !== 'number' || v < 0 || v > 31))
            add('error', 'palette-color-range', section + ' ' + pi + ': color invalido ' + JSON.stringify(c));
        }
      }
    }

    // solid-sync (cross-check opcional con el motor): cruza tiles.solid con el Set de sólidos del código,
    // detectado por `<NOMBRE>_SOLID_TILES = new Set([...])` (genérico, sirve a cualquier motor).
    let solidSet = null;
    if (opts.engineSource) {
      const m = String(opts.engineSource).match(/SOLID_TILES\s*=\s*new Set\([^[]*\[([^\]]+)\]/);
      if (m) solidSet = new Set(m[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)));
    }
    if (solidSet) {
      for (const [id, t] of Object.entries(tiles)) {
        const n = Number(id), inSet = solidSet.has(n);
        if (t.solid === true && !inSet) add('error', 'solid-sync', 'tile ' + id + ' (' + t.name + ') es solid en GAME.md pero NO esta en el Set de solidos del motor');
        if (t.solid === false && inSet) add('error', 'solid-sync', 'tile ' + id + ' (' + t.name + ') es walkable en GAME.md pero SI esta en el Set de solidos del motor');
      }
      for (const n of solidSet) if (!(n in tiles)) add('warn', 'solid-sync', 'tile ' + n + ' es solido en el motor pero no esta declarado en GAME.md');
    } else if (opts.requireEngine) {
      add('warn', 'solid-sync', 'No se pudo leer el Set de solidos del motor (cross-check omitido)');
    }

    // type-symmetry
    for (const a of Object.keys(types)) {
      for (const [b, mult] of Object.entries(types[a])) {
        if (a === b) continue;
        const rev = (types[b] || {})[a];
        if (mult === 2 && rev !== 0.5) add('warn', 'type-symmetry', a + '>' + b + ' es x2 pero ' + b + '>' + a + ' no es x0.5');
        if (mult === 0.5 && rev !== 2) add('warn', 'type-symmetry', a + '>' + b + ' es x0.5 pero ' + b + '>' + a + ' no es x2');
      }
    }

    // moves-exist / move-type-valid
    for (const [mvName, mv] of Object.entries(moves))
      if (!typeKeys.has(mv.type)) add('error', 'move-type-valid', 'el ataque ' + mvName + ' usa tipo desconocido: ' + mv.type);
    for (const [sp, s] of Object.entries(species)) {
      if (s.type && !typeKeys.has(s.type)) add('error', 'species-type-valid', sp + ' usa tipo desconocido: ' + s.type);
      for (const mv of (s.moves || []))
        if (!(mv in moves)) add('error', 'moves-exist', sp + ' referencia un ataque inexistente: ' + mv);
      if (s.evolvesInto && !(s.evolvesInto in species))
        add('error', 'broken-ref', sp + '.evolvesInto referencia una especie inexistente: ' + s.evolvesInto);
    }

    // trainer-team-valid / trainer-bounds
    for (const [tn, t] of Object.entries(data.trainers || {})) {
      for (const sp of (t.team || []))
        if (!(sp in species)) add('error', 'trainer-team-valid', tn + ' tiene un POKEMON inexistente: ' + sp);
      if (t.prize != null && !(t.prize > 0)) add('error', 'trainer-bounds', tn + ' tiene premio invalido: ' + t.prize);
    }

    // sprite-ref / sprite-dims
    const sprites = data.sprites || {};
    for (const [sp, s] of Object.entries(species))
      if (s.sprite && !(s.sprite in sprites)) add('error', 'sprite-ref', sp + ' usa un sprite inexistente: ' + s.sprite);
    for (const [sn, mat] of Object.entries(sprites))
      if (!Array.isArray(mat) || mat.length !== 16 || mat.some(r => !Array.isArray(r) || r.length !== 16))
        add('error', 'sprite-dims', 'sprite ' + sn + ' no es 16x16');

    // item-effect-valid
    const items = data.items || {};
    const ITEM_EFFECTS = new Set(['heal', 'cure', 'catch']);
    for (const [name, it] of Object.entries(items)) {
      if (!it || !ITEM_EFFECTS.has(it.effect))
        add('error', 'item-effect-valid', name + ' tiene effect invalido: ' + (it && it.effect));
      if (it && it.effect === 'heal' && !(it.amount > 0))
        add('error', 'item-effect-valid', name + ' es heal pero no tiene amount > 0');
      if (it && it.effect === 'cure' && !it.cures)
        add('warn', 'item-effect-valid', name + ' es cure pero no declara `cures`');
    }

    // encounter-ref
    for (const [area, list] of Object.entries(data.encounters || {}))
      for (const sp of (list || []))
        if (!(sp in species)) add('error', 'encounter-ref', 'encounters.' + area + ' referencia especie inexistente: ' + sp);

    // map-dims / map-legend-ref / map-meta
    const platform = data.platform || {};
    for (const [name, def] of Object.entries(data.maps || {})) {
      const rows = def.rows || [];
      if (platform.rows && rows.length !== platform.rows)
        add('error', 'map-dims', 'mapa ' + name + ' tiene ' + rows.length + ' filas (esperado ' + platform.rows + ')');
      for (let r = 0; r < rows.length; r++)
        if (platform.cols && String(rows[r]).length !== platform.cols)
          add('error', 'map-dims', 'mapa ' + name + ' fila ' + r + ' tiene ' + String(rows[r]).length + ' cols (esperado ' + platform.cols + ')');
      const cells = Object.assign({}, def.legend || {});
      if (def.fill) cells['<fill>'] = def.fill;
      for (const [sym, cell] of Object.entries(cells)) {
        if (!cell || cell.tile == null || !(cell.tile in tiles))
          add('error', 'map-legend-ref', 'mapa ' + name + ' simbolo "' + sym + '" referencia tile inexistente: ' + (cell && cell.tile));
        if (cell && typeof cell.pal === 'number' && (cell.pal < 0 || cell.pal >= palCount))
          add('error', 'map-legend-ref', 'mapa ' + name + ' simbolo "' + sym + '" usa paleta fuera de 0..' + (palCount - 1) + ': ' + cell.pal);
      }
      const inB = pt => pt && typeof pt.col === 'number' && typeof pt.row === 'number' &&
        pt.col >= 0 && (!platform.cols || pt.col < platform.cols) && pt.row >= 0 && (!platform.rows || pt.row < platform.rows);
      for (const key of ['entry', 'exit', 'return']) {
        if (def[key] && !inB(def[key])) add('error', 'map-meta', 'mapa ' + name + '.' + key + ' fuera de los limites del mapa');
      }
      if (def.exit && inB(def.exit)) {
        const ch = String(rows[def.exit.row] || '')[def.exit.col];
        const cell = (def.legend && def.legend[ch]) || def.fill || {};
        if (cell.tile !== 46) add('warn', 'map-meta', 'mapa ' + name + ': exit en (' + def.exit.col + ',' + def.exit.row + ') no cae sobre un felpudo (tile 46)');
      }
    }

    // overworld-ref
    const trainers = data.trainers || {};
    const warpTargets = new Set([...Object.keys(data.overworld || {}), ...Object.keys(data.maps || {})]);
    for (const [area, def] of Object.entries(data.overworld || {})) {
      for (const n of (def.npcs || [])) {
        if (typeof n.col !== 'number' || typeof n.row !== 'number')
          add('error', 'overworld-ref', area + ': NPC sin col/row numericos');
        if (platform.cols && (n.col < 0 || n.col >= platform.cols))
          add('error', 'overworld-ref', area + ': NPC col ' + n.col + ' fuera de 0..' + (platform.cols - 1));
        if (!n.dialogue) add('warn', 'overworld-ref', area + ': NPC en (' + n.col + ',' + n.row + ') sin dialogue');
        if (typeof n.dialogue === 'string' && n.dialogue.includes(','))
          add('warn', 'overworld-ref', area + ': el dialogue de un NPC contiene "," (el parser YAML de flujo lo cortaria)');
      }
      for (const t of (def.trainers || [])) {
        if (!(t.name in trainers)) add('error', 'overworld-ref', area + ': entrenador inexistente en `trainers`: ' + t.name);
        if (platform.cols && (t.col < 0 || t.col >= platform.cols))
          add('error', 'overworld-ref', area + ': entrenador ' + t.name + ' col ' + t.col + ' fuera de 0..' + (platform.cols - 1));
      }
      for (const w of (def.warps || [])) {
        if (!w.target) add('error', 'overworld-ref', area + ': warp sin target');
        else if (!warpTargets.has(w.target)) add('error', 'overworld-ref', area + ': warp a destino desconocido: ' + w.target);
        if (platform.cols && (w.col < 0 || w.col >= platform.cols))
          add('error', 'overworld-ref', area + ': warp col ' + w.col + ' fuera de 0..' + (platform.cols - 1));
      }
    }

    // tileart-ref / tileart-dims
    const tileArt = data.tileArt || {};
    for (const [id, mat] of Object.entries(tileArt)) {
      const n = Number(id);
      if (!(id in tiles)) add('warn', 'tileart-ref', 'tileArt define el tile ' + id + ' que no está en el registro `tiles`');
      if (n < 16 || n > 63) add('error', 'tileart-ref', 'tileArt id ' + id + ' fuera del rango de tiles 16..63');
      if (!Array.isArray(mat) || mat.length !== 8 || mat.some(r => !Array.isArray(r) || r.length !== 8))
        add('error', 'tileart-dims', 'tileArt ' + id + ' no es 8x8');
      else if (mat.some(r => r.some(v => typeof v !== 'number' || v < 0 || v >= palCount)))
        add('error', 'tileart-dims', 'tileArt ' + id + ' tiene un índice de color fuera de 0..' + (palCount - 1));
    }

    // text-valid
    for (const [k, v] of Object.entries(data.text || {})) {
      if (typeof v !== 'string' || v.trim() === '') add('error', 'text-valid', 'text.' + k + ' debe ser una cadena no vacía');
    }

    // sfx-valid: cada efecto de sonido tiene freq (>0 Hz) y dur (0–5 s)
    for (const [k, s] of Object.entries(data.sfx || {})) {
      if (!s || typeof s.freq !== 'number' || s.freq <= 0 || s.freq > 20000) add('error', 'sfx-valid', 'sfx.' + k + ' tiene freq invalida: ' + (s && s.freq));
      if (!s || typeof s.dur !== 'number' || s.dur <= 0 || s.dur > 5) add('error', 'sfx-valid', 'sfx.' + k + ' tiene dur invalida (0–5 s): ' + (s && s.dur));
    }

    // player-ref
    const player = data.player || {};
    if (player.starter && !(player.starter in species))
      add('error', 'player-ref', 'player.starter referencia una especie inexistente: ' + player.starter);
    if (player.level != null && !(player.level > 0))
      add('error', 'player-ref', 'player.level invalido: ' + player.level);
    if (player.start && (typeof player.start.x !== 'number' || typeof player.start.y !== 'number'))
      add('error', 'player-ref', 'player.start debe tener x/y numericos');
    for (const it of Object.keys(player.inventory || {}))
      if (!(it in (data.items || {}))) add('warn', 'player-ref', 'player.inventory tiene un item desconocido: ' + it);

    // economy-bounds
    const eco = data.economy || {}, bal = data.balance || {};
    const prices = Object.assign({}, eco.prices || {});
    for (const [name, it] of Object.entries(items)) if (it && it.price != null) prices[name] = it.price;
    for (const [item, price] of Object.entries(prices))
      if (!(price > 0)) add('error', 'economy-bounds', 'precio invalido para ' + item + ': ' + price);
    if (bal.catchBase != null && bal.catchScale != null) {
      const sum = bal.catchBase + bal.catchScale;
      if (sum > 1 || bal.catchBase < 0 || bal.catchScale < 0)
        add('error', 'economy-bounds', 'catchBase+catchScale = ' + sum + ' fuera de [0,1]');
    }

    // dead-token (cross-check opcional con el motor)
    if (opts.engineSource) {
      for (const k of Object.keys(bal)) {
        const e = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const used = new RegExp("gBal\\(['\"]" + e + "['\"]|\\." + e + "\\b|\\[['\"]" + e + "['\"]\\]").test(String(opts.engineSource));
        if (!used) add('warn', 'dead-token', 'balance.' + k + ' declarado en GAME.md pero no referenciado en el motor');
      }
    }

    return findings;
  }

  return { lintGame: lintGame };
});
