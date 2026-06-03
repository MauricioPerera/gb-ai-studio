#!/usr/bin/env node
/**
 * game-export.js — Genera las constantes del motor desde GAME.md (como `design.md export`).
 * Uso:  node tools/game-export.js [GAME.md] [salida.js]
 * Salida por defecto: game-data.generated.js  (global window.GAME consumible por el motor).
 * El GAME.md es la FUENTE DE VERDAD; este archivo se regenera, nunca se edita a mano.
 */
const fs = require('fs');
const path = require('path');
const { splitFrontMatter, parseYamlSubset } = require('./yaml-min');

const file = process.argv[2] || path.join(__dirname, '..', 'GAME.md');
const outFile = process.argv[3] || path.join(__dirname, '..', 'game-data.generated.js');

const { fm } = splitFrontMatter(fs.readFileSync(file, 'utf8'));
if (!fm) { console.error('GAME.md sin front-matter YAML.'); process.exit(2); }
const data = parseYamlSubset(fm);

const moves = data.moves || {};
const species = data.species || {};

// Expande ["PLACAJE", ...] -> [{name,type,power,effect?,chance?}, ...] usando la tabla de movimientos
const expand = arr => (arr || []).map(n => {
  const m = moves[n] || {};
  const o = { name: n, type: m.type, power: m.power };
  if (m.effect) o.effect = m.effect;
  if (m.chance != null) o.chance = m.chance;
  return o;
});

// WILD_LIST: especies wild:true en la forma exacta que usa simulator.js
const WILD_LIST = Object.entries(species)
  .filter(([, s]) => s.wild)
  .map(([name, s]) => ({ name, maxhp: s.maxhp, pal: s.pal, sprite: s.sprite || 'generic', type: s.type, moves: expand(s.moves) }));

// Entrada wild estándar (la forma exacta que usa simulator.js) a partir de un nombre de especie
const wildEntry = name => {
  const s = species[name] || {};
  return { name, maxhp: s.maxhp, pal: s.pal, sprite: s.sprite || 'generic', type: s.type, moves: expand(s.moves) };
};

// ENCOUNTERS: tabla de encuentros por área -> lista de entradas wild expandidas
const ENCOUNTERS = {};
for (const [area, list] of Object.entries(data.encounters || {}))
  ENCOUNTERS[area] = (list || []).map(wildEntry);

// ITEMS: catálogo (precio + efecto). Los precios de la tienda derivan de aquí.
const ITEMS = data.items || {};
const prices = {};
for (const [n, it] of Object.entries(ITEMS)) if (it && it.price != null) prices[n] = it.price;
const ECONOMY = Object.assign({}, data.economy || {}, { prices });

// EVOLUTIONS: especie -> objetivo de evolución con sus stats expandidos
const EVOLUTIONS = {};
for (const [name, s] of Object.entries(species)) {
  if (!s.evolvesInto) continue;
  const into = species[s.evolvesInto] || {};
  EVOLUTIONS[name] = { into: s.evolvesInto, level: s.atLevel, maxhp: into.maxhp, type: into.type, moves: expand(into.moves) };
}

// TRAINERS: equipos expandidos desde la tabla de especies
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

// Paletas: rellena a 16 colores (pad16) y arma el array indexado
function pad16(a) {
  const o = a.map(c => c.slice());
  while (o.length < 16) o.push((o[o.length - 1] || [0, 0, 0]).slice());
  return o.slice(0, 16);
}
function palArray(obj) {
  const arr = [];
  for (const k of Object.keys(obj)) arr[Number(k)] = pad16(obj[k]);
  return arr;
}
const PALETTES = palArray(data.palettes || {});
const SPRITE_PALETTES = palArray(data.spritePalettes || {});
const SPRITES = data.sprites || {};

// MAPS: expande cada mapa DSL (fill + legend + rows ASCII) a { tilemap, attrs }
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
  // Metadatos de interior (opcionales): puntos de aparición/salida/retorno
  if (def.entry) MAPS[name].entry = def.entry;
  if (def.exit) MAPS[name].exit = def.exit;
  if (def.return) MAPS[name].return = def.return;
}

// Registro de tiles e IDs sólidos (para cruzar/generar GBA_SOLID_TILES)
const tiles = data.tiles || {};
const solidTiles = Object.entries(tiles).filter(([, t]) => t.solid).map(([id]) => Number(id)).sort((a, b) => a - b);

const GAME = {
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
  ECONOMY,
  BALANCE: data.balance || {},
  TILES: tiles,
  SOLID_TILES: solidTiles
};

const header = '// AUTO-GENERADO por tools/game-export.js desde GAME.md — NO EDITAR A MANO.\n' +
  '// Regenerar con:  node tools/game-export.js\n';
const out = header + 'window.GAME = ' + JSON.stringify(GAME, null, 2) + ';\n';
fs.writeFileSync(outFile, out);
console.log('Generado ' + path.relative(process.cwd(), outFile) +
  '  (especies:' + Object.keys(species).length + ' wild:' + WILD_LIST.length +
  ' evol:' + Object.keys(EVOLUTIONS).length + ' tilesSolidos:' + solidTiles.length + ')');
