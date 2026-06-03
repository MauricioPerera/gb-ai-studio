#!/usr/bin/env node
/**
 * game-lint.js — Linter de tokens de gameplay para GAME.md (inspirado en design.md).
 * Sin dependencias. Uso:  node tools/game-lint.js GAME.md
 * Valida el front-matter YAML contra reglas de juego y lo cruza con el código (simulator.js).
 * Las reglas viven en game-lint-core.js (compartido con el lint en vivo del navegador).
 */
const fs = require('fs');
const path = require('path');
const { splitFrontMatter, parseYamlSubset } = require('./yaml-min');
const { lintGame } = require('./game-lint-core');

const file = process.argv[2] || 'GAME.md';
const root = path.dirname(path.resolve(file));

let text;
try { text = fs.readFileSync(file, 'utf8'); }
catch (e) { console.error('No se pudo leer ' + file); process.exit(2); }

const { fm, body } = splitFrontMatter(text);
const data = fm ? parseYamlSubset(fm) : {};

let engineSource = null;
try { engineSource = fs.readFileSync(path.join(root, 'simulator.js'), 'utf8'); } catch (e) { /* sin motor */ }

const findings = lintGame(data, body || '', { engineSource, requireEngine: true, frontMatterPresent: !!fm });

const errors = findings.filter(f => f.level === 'error').length;
const warns = findings.filter(f => f.level === 'warn').length;
const tiles = data.tiles || {}, types = data.types || {}, moves = data.moves || {}, species = data.species || {};
const report = {
  file,
  summary: { errors, warnings: warns, ok: errors === 0 },
  counts: { tiles: Object.keys(tiles).length, types: Object.keys(types).length, moves: Object.keys(moves).length, species: Object.keys(species).length },
  findings
};
console.log(JSON.stringify(report, null, 2));
process.exit(errors > 0 ? 1 : 0);
