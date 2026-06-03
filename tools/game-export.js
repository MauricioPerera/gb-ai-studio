#!/usr/bin/env node
/**
 * game-export.js — Genera las constantes del motor desde GAME.md (como `design.md export`).
 * Uso:  node tools/game-export.js [GAME.md] [salida.js]
 * Salida por defecto: game-data.generated.js  (global window.GAME consumible por el motor).
 * El GAME.md es la FUENTE DE VERDAD; este archivo se regenera, nunca se edita a mano.
 * La transformacion vive en game-build.js (compartida con el importador del navegador).
 */
const fs = require('fs');
const path = require('path');
const { splitFrontMatter, parseYamlSubset } = require('./yaml-min');
const { buildGame } = require('./game-build');

const file = process.argv[2] || path.join(__dirname, '..', 'GAME.md');
const outFile = process.argv[3] || path.join(__dirname, '..', 'game-data.generated.js');

const { fm } = splitFrontMatter(fs.readFileSync(file, 'utf8'));
if (!fm) { console.error('GAME.md sin front-matter YAML.'); process.exit(2); }

const GAME = buildGame(parseYamlSubset(fm));

const header = '// AUTO-GENERADO por tools/game-export.js desde GAME.md — NO EDITAR A MANO.\n' +
  '// Regenerar con:  node tools/game-export.js\n';
const out = header + 'window.GAME = ' + JSON.stringify(GAME, null, 2) + ';\n';
fs.writeFileSync(outFile, out);
console.log('Generado ' + path.relative(process.cwd(), outFile) +
  '  (especies:' + Object.keys(GAME.SPECIES).length + ' wild:' + GAME.WILD_LIST.length +
  ' evol:' + Object.keys(GAME.EVOLUTIONS).length + ' tilesSolidos:' + GAME.SOLID_TILES.length + ')');
