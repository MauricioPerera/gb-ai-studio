/**
 * game-build.js — Transformacion pura: `data` (YAML parseado) -> objeto GAME (window.GAME).
 * Compartido por la CLI (game-export.js) y el importador del navegador (app.js) para evitar drift.
 * Isomorfo: en Node se exporta con module.exports; en navegador se cuelga de window.GameBuild.
 */
(function (factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.GameBuild = api;
})(function () {

  function pad16(a) {
    const o = (a || []).map(c => c.slice());
    while (o.length < 16) o.push((o[o.length - 1] || [0, 0, 0]).slice());
    return o.slice(0, 16);
  }
  function palArray(obj) {
    const arr = [];
    for (const k of Object.keys(obj || {})) arr[Number(k)] = pad16(obj[k]);
    return arr;
  }

  // data (front-matter YAML ya parseado) -> objeto GAME identico al que escribe game-export.js
  function buildGame(data) {
    data = data || {};
    const moves = data.moves || {};
    const species = data.species || {};

    const expand = arr => (arr || []).map(n => {
      const m = moves[n] || {};
      const o = { name: n, type: m.type, power: m.power };
      if (m.effect) o.effect = m.effect;
      if (m.chance != null) o.chance = m.chance;
      return o;
    });

    const WILD_LIST = Object.entries(species)
      .filter(([, s]) => s.wild)
      .map(([name, s]) => ({ name, maxhp: s.maxhp, pal: s.pal, sprite: s.sprite || 'generic', type: s.type, moves: expand(s.moves) }));

    const wildEntry = name => {
      const s = species[name] || {};
      return { name, maxhp: s.maxhp, pal: s.pal, sprite: s.sprite || 'generic', type: s.type, moves: expand(s.moves) };
    };

    const ENCOUNTERS = {};
    for (const [area, list] of Object.entries(data.encounters || {}))
      ENCOUNTERS[area] = (list || []).map(wildEntry);

    const ITEMS = data.items || {};
    const prices = {};
    for (const [n, it] of Object.entries(ITEMS)) if (it && it.price != null) prices[n] = it.price;
    const ECONOMY = Object.assign({}, data.economy || {}, { prices });

    const EVOLUTIONS = {};
    for (const [name, s] of Object.entries(species)) {
      if (!s.evolvesInto) continue;
      const into = species[s.evolvesInto] || {};
      EVOLUTIONS[name] = { into: s.evolvesInto, level: s.atLevel, maxhp: into.maxhp, type: into.type, moves: expand(into.moves) };
    }

    const TRAINERS = {};
    for (const [tname, t] of Object.entries(data.trainers || {})) {
      TRAINERS[tname] = {
        prize: t.prize, dialogue: t.dialogue, pal: t.pal, level: t.level,
        team: (t.team || []).map(spName => {
          const sp = species[spName] || {};
          return { name: spName, maxhp: sp.maxhp, type: sp.type, pal: sp.pal, sprite: sp.sprite || 'generic', level: t.level, moves: expand(sp.moves) };
        })
      };
    }

    const PALETTES = palArray(data.palettes || {});
    const SPRITE_PALETTES = palArray(data.spritePalettes || {});
    const SPRITES = data.sprites || {};

    const MAPS = {};
    for (const [name, def] of Object.entries(data.maps || {})) {
      const fill = def.fill || { tile: 0, pal: 0 };
      const legend = def.legend || {};
      const tilemap = [], attrs = [];
      for (const rowStr of (def.rows || [])) {
        const trow = [], arow = [];
        for (const ch of String(rowStr)) {
          const cell = legend[ch] || fill;
          trow.push(cell.tile); arow.push(cell.pal);
        }
        tilemap.push(trow); attrs.push(arow);
      }
      MAPS[name] = { tilemap, attrs };
      if (def.entry) MAPS[name].entry = def.entry;
      if (def.exit) MAPS[name].exit = def.exit;
      if (def.return) MAPS[name].return = def.return;
    }

    const tiles = data.tiles || {};
    const solidTiles = Object.entries(tiles).filter(([, t]) => t.solid).map(([id]) => Number(id)).sort((a, b) => a - b);

    return {
      generatedFrom: 'GAME.md',
      platform: data.platform || {},
      palettesCount: data.palettesCount || 0,
      TYPE_CHART: data.types || {},
      MOVES: moves,
      SPECIES: species,
      WILD_LIST,
      EVOLUTIONS,
      TRAINERS,
      PALETTES,
      SPRITE_PALETTES,
      SPRITES,
      ITEMS,
      ENCOUNTERS,
      MAPS,
      OVERWORLD: data.overworld || {},
      PLAYER: data.player || {},
      TILE_ART: data.tileArt || {},
      TEXT: data.text || {},
      SFX: data.sfx || {},
      ECONOMY,
      BALANCE: data.balance || {},
      TILES: tiles,
      SOLID_TILES: solidTiles
    };
  }

  return { buildGame: buildGame, pad16: pad16 };
});
