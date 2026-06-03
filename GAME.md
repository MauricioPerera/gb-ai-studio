---
version: alpha
name: Pueblo Paleta GBA
description: Mini-Pokemon GBA de GB-AI Studio. Tokens de gameplay como fuente unica de verdad.
platform: { mode: gba, cols: 30, rows: 20, screenW: 240, screenH: 160 }
palettesCount: 16
tiles:
  16: { name: grass, solid: false }
  18: { name: objective, solid: false }
  19: { name: door, solid: true, warp: true }
  20: { name: pokeball_item, solid: false }
  21: { name: npc, solid: true }
  22: { name: tall_grass, solid: false, encounter: true }
  23: { name: water, solid: true }
  24: { name: open_object, solid: false }
  25: { name: open_door, solid: false }
  26: { name: tree, solid: true }
  27: { name: path, solid: false }
  28: { name: flowers, solid: false }
  29: { name: sign, solid: true }
  36: { name: wall, solid: true }
  42: { name: big_tree_tl, solid: true }
  46: { name: mat, solid: false }
  47: { name: fence, solid: true }
  48: { name: floor_interior, solid: false }
  49: { name: counter, solid: true }
  50: { name: heal_machine, solid: true }
  51: { name: nurse, solid: true }
  52: { name: computer, solid: true }
  53: { name: shelf, solid: true }
  17: { name: wall_alt, solid: true }
  30: { name: roof_top_l, solid: true }
  31: { name: roof_top_m, solid: true }
  32: { name: roof_top_r, solid: true }
  33: { name: roof_bot_l, solid: true }
  34: { name: roof_bot_m, solid: true }
  35: { name: roof_bot_r, solid: true }
  37: { name: window, solid: true }
  38: { name: pokeball_emblem, solid: true }
  39: { name: reserved39, solid: true }
  40: { name: shop_sign, solid: true }
  41: { name: sign_band, solid: true }
  43: { name: big_tree_tr, solid: true }
  44: { name: big_tree_bl, solid: true }
  45: { name: big_tree_br, solid: true }
types:
  PLANTA: { AGUA: 2, FUEGO: 0.5, PLANTA: 0.5 }
  FUEGO: { PLANTA: 2, AGUA: 0.5, FUEGO: 0.5 }
  AGUA: { FUEGO: 2, PLANTA: 0.5, AGUA: 0.5 }
  NORMAL: { }
moves:
  PLACAJE: { type: NORMAL, power: 5 }
  LATIGO CEPA: { type: PLANTA, power: 7 }
  HOJA AFILADA: { type: PLANTA, power: 10 }
  ATAQUE RAPIDO: { type: NORMAL, power: 5 }
  PICOTAZO: { type: NORMAL, power: 5 }
  HOJA: { type: PLANTA, power: 6 }
  ASCUAS: { type: FUEGO, power: 6 }
  BURBUJA: { type: AGUA, power: 6 }
  TOXINA: { type: AGUA, power: 4, effect: poison, chance: 0.6 }
species:
  HOJITA: { type: PLANTA, maxhp: 22, moves: [PLACAJE, LATIGO CEPA], evolvesInto: HOJABLOOM, atLevel: 8 }
  HOJABLOOM: { type: PLANTA, maxhp: 30, moves: [PLACAJE, HOJA AFILADA, TOXINA] }
  RATAGON: { type: NORMAL, maxhp: 16, pal: purple, moves: [ATAQUE RAPIDO], wild: true }
  PIDGY: { type: NORMAL, maxhp: 14, pal: brown, sprite: bird, moves: [PICOTAZO], wild: true }
  ORUGUI: { type: PLANTA, maxhp: 12, pal: green, moves: [HOJA], wild: true }
  EMBRA: { type: FUEGO, maxhp: 15, pal: red, moves: [ASCUAS], wild: true }
  GOTIN: { type: AGUA, maxhp: 15, pal: blue, moves: [BURBUJA, TOXINA], wild: true }
trainers:
  JOVEN TIM: { level: 5, pal: 1, prize: 250, dialogue: Quieres un combate?, team: [RATAGON] }
  EXPERTA ANA: { level: 6, pal: 2, prize: 400, dialogue: Tengo dos POKEMON!, team: [EMBRA, GOTIN] }
  CAZABICHOS LEO: { level: 4, pal: 2, prize: 200, dialogue: Los BICHOS son geniales!, team: [ORUGUI, PIDGY] }
items:
  POCION: { price: 300, effect: heal, amount: 20 }
  SUPER POCION: { price: 700, effect: heal, amount: 50 }
  POKE BALL: { price: 200, effect: catch }
  ANTIDOTO: { price: 100, effect: cure, cures: poison }
encounters:
  town: [ORUGUI, RATAGON]
  route1: [RATAGON, PIDGY, EMBRA, GOTIN]
economy:
  startMoney: 3000
balance:
  catchBase: 0.35
  catchScale: 0.55
  xpCurveMul: 1.5
  encounterRate: 0.18
palettes:
  0: [[8,17,7],[12,22,10],[15,25,12],[18,28,14]]
  1: [[12,22,10],[3,1,1],[16,3,3],[26,6,6],[31,12,10],[31,20,16],[31,31,31],[10,2,2]]
  2: [[12,22,10],[6,4,3],[20,16,12],[27,23,18],[31,29,24],[10,16,28],[18,24,31],[15,9,4],[9,5,2],[31,6,6],[31,31,31]]
  3: [[12,22,10],[1,3,8],[3,8,20],[6,14,28],[12,22,31],[22,29,31],[31,31,31],[2,4,10]]
  4: [[12,22,10],[6,6,8],[16,18,20],[24,26,28],[31,31,31],[10,16,28],[18,24,31],[15,9,4],[9,5,2],[31,6,6]]
  5: [[12,22,10],[5,3,1],[16,10,4],[22,14,6],[28,20,10],[31,26,16],[31,29,24],[9,5,2]]
  6: [[12,22,10],[7,5,3],[20,16,11],[27,22,15],[31,28,20],[10,16,28],[18,24,31],[15,9,4],[9,5,2]]
  7: [[12,22,10],[12,7,3],[3,12,3],[6,17,5],[10,22,8],[15,27,11],[2,8,2]]
  8: [[12,22,10],[18,13,7],[24,18,10],[28,23,14],[31,27,18]]
  9: [[2,8,20],[2,8,20],[4,13,26],[9,19,30],[20,28,31],[31,31,31]]
  10: [[12,22,10],[13,23,11],[6,15,5],[31,6,6],[31,28,8],[31,31,31]]
  11: [[12,22,10],[2,2,2],[10,11,13],[18,20,22],[27,28,30],[31,24,4],[31,30,12],[31,6,6],[31,22,16],[6,8,20],[31,31,31]]
  12: [[12,22,10],[31,29,22],[27,24,17]]
  13: [[12,22,10],[3,2,4],[31,18,24],[31,31,31],[31,4,4],[31,26,29],[31,22,16],[24,8,14]]
  14: [[12,22,10],[31,24,16],[28,18,10]]
  15: [[12,22,10],[8,5,3],[20,14,8],[31,6,6],[10,16,28],[31,28,8],[31,31,31]]
spritePalettes:
  0: [[0,0,0],[1,1,1],[6,20,8],[31,22,16],[24,15,10],[10,12,16],[18,20,28],[31,6,6],[31,31,31],[10,6,2]]
  1: [[0,0,0],[1,1,1],[14,8,3],[31,22,16],[24,15,10],[3,10,5],[8,20,10],[31,6,6],[31,31,31],[14,8,3]]
  2: [[0,0,0],[1,1,1],[18,4,4],[31,22,16],[24,15,10],[18,12,4],[31,22,8],[31,6,6],[31,31,31],[18,4,4]]
  3: [[2,2,2],[30,30,30]]
  4: [[2,2,2],[30,30,30]]
  5: [[2,2,2],[30,30,30]]
  6: [[2,2,2],[30,30,30]]
  7: [[2,2,2],[30,30,30]]
sprites:
  generic: [[0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],[0,0,0,1,3,3,3,3,3,3,1,0,0,0,0,0],[0,0,1,3,3,2,2,2,2,3,3,1,0,0,0,0],[0,1,3,2,2,2,2,2,2,2,2,3,1,0,0,0],[0,1,3,2,5,6,2,2,6,5,2,3,1,0,0,0],[0,1,3,2,2,2,7,7,2,2,2,3,1,0,0,0],[0,1,3,3,2,4,4,4,4,2,3,3,1,0,0,0],[0,0,1,3,4,4,4,4,4,4,3,1,0,0,0,0],[0,0,1,2,4,4,4,4,4,4,2,1,0,0,0,0],[0,0,1,2,2,4,4,4,4,2,2,1,0,0,0,0],[0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0],[0,0,0,1,2,1,0,0,1,2,1,0,0,0,0,0],[0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]
  playermon: [[0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],[0,0,0,0,1,3,3,3,3,3,1,0,0,0,0,0],[0,0,0,1,3,3,2,2,3,3,3,1,0,0,0,0],[0,0,1,3,2,2,2,2,2,2,3,3,1,0,0,0],[0,1,3,2,2,4,2,2,4,2,2,3,1,0,0,0],[0,1,2,2,4,2,2,2,2,4,2,2,1,0,0,0],[0,1,2,2,2,2,2,2,2,2,2,2,1,0,0,0],[0,1,2,2,2,2,2,2,2,2,2,2,1,0,0,0],[0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,0],[0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,0],[0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0],[0,0,0,1,2,1,0,0,1,2,1,0,0,0,0,0],[0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]
  bird: [[0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0],[0,0,0,0,0,1,3,3,1,0,0,0,0,0,0,0],[0,0,0,0,1,3,5,3,3,1,0,0,0,0,0,0],[0,0,0,1,3,3,3,3,3,3,1,0,0,0,0,0],[0,1,1,3,3,3,3,3,3,3,3,1,1,0,0,0],[1,3,3,1,3,3,3,3,3,3,1,3,3,1,0,0],[0,1,1,0,1,3,3,3,3,1,0,1,1,0,0,0],[0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,0],[0,0,0,0,1,4,4,4,4,1,0,0,0,0,0,0],[0,0,0,0,0,1,4,4,1,0,0,0,0,0,0,0],[0,0,0,0,0,1,7,7,1,0,0,0,0,0,0,0],[0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]
maps:
  pokecenter:
    fill: { tile: 48, pal: 12 }
    legend:
      W: { tile: 36, pal: 2 }
      C: { tile: 49, pal: 6 }
      H: { tile: 50, pal: 13 }
      N: { tile: 51, pal: 13 }
      P: { tile: 52, pal: 4 }
      M: { tile: 46, pal: 2 }
    rows: ["WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW", "W............................W", "W......NHN...................W", "W...CCCCCCCCC.............P..W", "W............................W", "W............................W", "W............................W", "W............................W", "W............................W", "W............................W", "W............................W", "W............................W", "W............................W", "W............................W", "W............................W", "W............................W", "W............................W", "W............................W", "W..............M.............W", "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"]
    entry: { col: 15, row: 16 }
    exit: { col: 15, row: 18 }
    return: { col: 5, row: 17 }
  pokemart:
    fill: { tile: 48, pal: 14 }
    legend:
      W: { tile: 36, pal: 2 }
      S: { tile: 53, pal: 15 }
      C: { tile: 49, pal: 6 }
      D: { tile: 21, pal: 11 }
      M: { tile: 46, pal: 2 }
    rows: ["WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW", "W............................W", "W..SSSSSSSS...........D......W", "W...................CCCCCC...W", "W............................W", "W............................W", "W..SSSSSSSS..................W", "W..SSSSSSSS..................W", "W............................W", "W............................W", "W............................W", "W............................W", "W............................W", "W............................W", "W............................W", "W............................W", "W............................W", "W............................W", "W..............M.............W", "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"]
    entry: { col: 15, row: 16 }
    exit: { col: 15, row: 18 }
    return: { col: 25, row: 7 }
overworld:
  town:
    npcs: [{ col: 13, row: 12, pal: 1, range: 3, timer: 30, dialogue: "¡Hola! Bienvenido a Pueblo Paleta. ¡Hace un dia precioso!" }, { col: 22, row: 13, pal: 2, range: 2, timer: 55, dialogue: "La TIENDA vende Pociones muy utiles para tu viaje." }]
    warps: [{ col: 5, row: 16, target: pokecenter }, { col: 25, row: 6, target: pokemart }, { col: 15, row: 1, target: route1, entry: { col: 15, row: 38 } }]
  route1:
    trainers: [{ col: 15, row: 30, name: JOVEN TIM, dir: down, sight: 5 }, { col: 14, row: 12, name: EXPERTA ANA, dir: down, sight: 5 }, { col: 15, row: 20, name: CAZABICHOS LEO, dir: down, sight: 5 }]
    warps: [{ col: 15, row: 39, target: town, entry: { col: 15, row: 2 } }]
player:
  starter: HOJITA
  level: 5
  start: { x: 80, y: 80 }
  inventory: { }
text:
  intro: "¡Bienvenido entrenador! Cruza la hierba alta, habla con el Profesor y consigue la llave del laboratorio."
  sign_town: "CARTEL: Bienvenido a Pueblo Paleta. ¡Centro Pokemon a la izquierda!"
  interior_welcome: "CENTRO POKEMON: ¡Bienvenido! Pisa el felpudo para salir."
  nurse_heal: "Enfermera: ¡Tus POKEMON ya están totalmente curados!"
  counter_empty: "No hay nadie en el mostrador."
  pc_storage: "Es un PC de almacenamiento de POKEMON."
  shelf: "Estantería llena de Pociones y Poké Balls."
  faint_recover: "Te recuperas en el Centro Pokémon."
sfx:
  encounter: { freq: 440, dur: 0.08 }
  trainer: { freq: 330, dur: 0.1 }
  hit: { freq: 660, dur: 0.07 }
  playerHurt: { freq: 220, dur: 0.08 }
  heal: { freq: 880, dur: 0.1 }
  catch: { freq: 880, dur: 0.1 }
  evolve: { freq: 523, dur: 0.1 }
  buy: { freq: 880, dur: 0.08 }
tileArt:
  16: [[1,1,2,1,1,0,3,1],[1,0,1,1,2,1,1,1],[2,1,1,3,1,1,1,0],[1,1,1,1,1,1,2,1],[1,3,1,0,1,1,1,1],[0,1,1,2,1,1,1,3],[1,1,1,1,1,0,1,1],[3,1,1,1,2,1,1,1]]
  18: [[0,0,1,1,1,1,0,0],[0,1,5,6,6,5,1,0],[1,5,6,6,6,6,5,1],[1,5,6,4,4,6,5,1],[1,5,6,6,6,6,5,1],[0,1,5,6,6,5,1,0],[0,0,1,1,1,1,0,0],[0,0,3,3,3,3,0,0]]
  19: [[1,1,1,1,1,1,1,1],[1,7,7,7,7,7,7,1],[1,7,8,8,8,8,7,1],[1,7,8,8,8,8,7,1],[1,7,8,8,8,8,7,1],[1,7,8,8,4,8,7,1],[1,7,8,8,8,8,7,1],[1,1,1,1,1,1,1,1]]
  20: [[0,0,0,0,0,0,0,0],[0,0,1,1,1,1,0,0],[0,1,7,7,7,7,1,0],[0,1,1,10,10,1,1,0],[0,1,10,10,10,10,1,0],[0,1,10,10,10,10,1,0],[0,0,1,1,1,1,0,0],[0,0,0,0,0,0,0,0]]
  21: [[0,0,1,1,1,1,0,0],[0,1,8,8,8,8,1,0],[1,8,1,8,8,1,8,1],[1,8,8,8,8,8,8,1],[0,1,7,7,7,7,1,0],[0,1,7,8,8,7,1,0],[0,1,9,9,9,9,1,0],[0,0,1,0,0,1,0,0]]
  22: [[0,0,2,0,0,2,0,0],[0,2,3,2,2,3,2,0],[2,3,4,3,3,4,3,2],[2,3,3,4,4,3,3,2],[3,4,3,3,3,3,4,3],[2,3,4,3,3,4,3,2],[2,2,3,2,2,3,2,2],[0,2,2,0,0,2,2,0]]
  23: [[2,2,3,3,2,2,3,3],[3,3,2,2,3,3,2,2],[2,2,3,4,2,2,3,3],[3,3,2,2,3,3,2,2],[2,2,3,3,2,5,3,2],[3,3,2,2,3,3,2,2],[2,2,3,3,2,2,3,3],[3,3,2,2,3,3,2,2]]
  24: [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,2,2,2,2,0,0],[0,2,3,3,3,3,2,0],[0,2,3,3,3,3,2,0],[0,0,2,2,2,2,0,0],[0,0,3,3,3,3,0,0],[0,0,0,0,0,0,0,0]]
  25: [[1,1,1,1,1,1,1,1],[1,7,2,2,2,2,7,1],[1,7,1,1,1,1,7,1],[1,7,1,1,1,1,7,1],[1,7,1,1,1,1,7,1],[1,7,1,1,1,1,7,1],[1,7,2,2,2,2,7,1],[1,1,1,1,1,1,1,1]]
  26: [[0,0,3,3,3,3,0,0],[0,3,4,4,4,4,3,0],[3,4,5,4,4,5,4,3],[3,4,4,4,4,4,4,3],[2,3,4,4,4,4,3,2],[2,2,3,3,3,3,2,2],[6,6,1,1,1,1,6,6],[0,0,1,1,1,1,0,0]]
  27: [[2,2,2,3,2,2,2,2],[2,3,2,2,2,2,3,2],[2,2,2,2,4,2,2,2],[3,2,2,2,2,2,2,3],[2,2,4,2,2,2,2,2],[2,2,2,2,2,3,2,2],[2,3,2,2,2,2,2,4],[2,2,2,3,2,2,2,2]]
  28: [[1,1,3,1,1,4,1,1],[1,4,1,1,1,1,3,1],[1,1,1,5,1,1,1,1],[3,1,1,1,1,1,4,1],[1,1,4,1,1,1,1,1],[1,3,1,1,5,1,1,3],[1,1,1,1,1,1,1,1],[4,1,1,3,1,1,4,1]]
  29: [[0,0,0,0,0,0,0,0],[0,2,3,3,3,3,2,0],[0,3,4,4,4,4,3,0],[0,3,4,4,4,4,3,0],[0,2,3,3,3,3,2,0],[0,0,2,0,0,2,0,0],[0,0,2,0,0,2,0,0],[0,0,0,0,0,0,0,0]]
  30: [[0,0,0,0,1,1,1,1],[0,0,0,1,2,2,2,2],[0,0,1,2,3,3,3,3],[0,1,2,3,3,4,4,4],[1,2,3,3,4,4,5,5],[1,2,3,4,4,5,5,4],[1,2,3,4,4,4,4,4],[1,2,3,4,4,4,4,4]]
  31: [[1,1,1,1,1,1,1,1],[2,2,2,2,2,2,2,2],[3,3,3,3,3,3,3,3],[3,4,4,4,4,4,4,3],[4,4,5,5,5,5,4,4],[4,5,5,4,4,5,5,4],[4,4,4,4,4,4,4,4],[4,4,4,4,4,4,4,4]]
  32: [[1,1,1,1,0,0,0,0],[2,2,2,2,1,0,0,0],[3,3,3,3,2,1,0,0],[4,4,4,3,3,2,1,0],[5,5,4,4,3,3,2,1],[4,5,5,4,4,3,2,1],[4,4,4,4,3,2,1,1],[4,4,4,4,4,3,2,1]]
  33: [[1,2,3,4,4,4,4,4],[1,2,3,4,4,4,4,4],[1,2,3,4,4,4,4,4],[1,2,3,3,4,4,4,4],[1,2,2,3,3,3,3,3],[7,1,2,2,2,2,2,2],[6,7,1,1,1,1,1,1],[0,6,7,7,7,7,7,7]]
  34: [[4,4,4,4,4,4,4,4],[4,4,4,4,4,4,4,4],[4,4,4,4,4,4,4,4],[3,3,3,3,3,3,3,3],[2,2,2,2,2,2,2,2],[1,1,1,1,1,1,1,1],[6,6,6,6,6,6,6,6],[7,7,7,7,7,7,7,7]]
  35: [[4,4,4,4,4,3,2,1],[4,4,4,4,4,3,2,1],[4,4,4,4,4,3,2,1],[4,4,4,4,3,3,2,1],[3,3,3,3,3,2,2,1],[2,2,2,2,2,2,1,7],[1,1,1,1,1,1,7,6],[7,7,7,7,7,7,6,0]]
  36: [[1,1,1,1,1,1,1,1],[1,3,3,3,3,3,3,1],[1,3,4,4,4,4,3,1],[1,3,4,4,4,4,3,1],[1,3,4,4,4,4,3,1],[1,3,3,3,3,3,3,1],[1,2,2,2,2,2,2,1],[1,1,1,1,1,1,1,1]]
  37: [[1,1,1,1,1,1,1,1],[1,3,3,3,3,3,3,1],[1,3,5,5,5,5,3,1],[1,3,5,6,6,5,3,1],[1,3,5,5,5,5,3,1],[1,3,3,3,3,3,3,1],[1,2,2,2,2,2,2,1],[1,1,1,1,1,1,1,1]]
  38: [[4,4,1,1,1,1,4,4],[4,1,6,6,6,6,1,4],[1,6,6,6,6,6,6,1],[1,6,1,6,6,1,6,1],[1,1,1,1,1,1,1,1],[1,6,6,6,6,6,6,1],[4,1,6,6,6,6,1,4],[7,7,1,1,1,1,7,7]]
  40: [[1,1,1,1,1,1,1,1],[1,3,3,3,3,3,3,1],[1,9,9,9,9,9,9,1],[1,9,4,9,9,4,9,1],[1,9,9,9,9,9,9,1],[1,3,3,3,3,3,3,1],[1,2,2,2,2,2,2,1],[1,1,1,1,1,1,1,1]]
  41: [[1,1,1,1,1,1,1,1],[1,3,3,3,3,3,3,1],[1,9,9,9,9,9,9,1],[1,9,4,9,4,9,4,1],[1,9,9,9,9,9,9,1],[1,3,3,3,3,3,3,1],[1,2,2,2,2,2,2,1],[1,1,1,1,1,1,1,1]]
  42: [[0,0,0,0,2,2,3,3],[0,0,0,2,3,3,3,4],[0,0,2,3,3,4,4,4],[0,2,3,3,4,4,4,5],[0,2,3,4,4,4,5,5],[2,3,3,4,4,5,5,4],[2,3,4,4,4,4,4,4],[2,3,4,4,4,4,4,4]]
  43: [[3,3,2,2,0,0,0,0],[4,3,3,3,2,0,0,0],[4,4,4,3,3,2,0,0],[5,4,4,4,3,3,2,0],[5,5,4,4,4,3,2,0],[4,5,5,4,4,3,3,2],[4,4,4,4,4,4,3,2],[4,4,4,4,4,4,3,2]]
  44: [[2,3,4,4,4,4,4,4],[2,3,3,4,4,4,4,4],[0,2,3,3,4,4,4,4],[0,2,3,3,3,3,4,4],[0,0,2,2,3,3,3,3],[0,0,0,2,2,2,2,2],[0,0,0,0,1,1,2,0],[0,0,0,0,1,1,0,0]]
  45: [[4,4,4,4,4,4,3,2],[4,4,4,4,4,3,3,2],[4,4,4,4,3,3,2,0],[4,4,3,3,3,3,2,0],[3,3,3,3,2,2,0,0],[2,2,2,2,2,0,0,0],[0,2,1,1,0,0,0,0],[0,0,1,1,0,0,0,0]]
  46: [[1,1,1,1,1,1,1,1],[1,4,4,4,4,4,4,1],[1,4,3,3,3,3,4,1],[1,4,3,9,9,3,4,1],[1,4,3,9,9,3,4,1],[1,4,3,3,3,3,4,1],[1,4,4,4,4,4,4,1],[1,1,1,1,1,1,1,1]]
  47: [[0,0,0,0,0,0,0,0],[3,4,3,3,4,3,3,4],[2,1,0,2,1,0,2,1],[3,4,3,3,4,3,3,4],[2,1,0,2,1,0,2,1],[2,1,0,2,1,0,2,1],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]]
  48: [[1,1,2,2,1,1,2,2],[1,1,2,2,1,1,2,2],[2,2,1,1,2,2,1,1],[2,2,1,1,2,2,1,1],[1,1,2,2,1,1,2,2],[1,1,2,2,1,1,2,2],[2,2,1,1,2,2,1,1],[2,2,1,1,2,2,1,1]]
  49: [[1,1,1,1,1,1,1,1],[1,4,4,4,4,4,4,1],[1,3,3,3,3,3,3,1],[1,2,3,3,3,3,2,1],[1,2,2,2,2,2,2,1],[1,2,2,2,2,2,2,1],[1,2,2,2,2,2,2,1],[1,1,1,1,1,1,1,1]]
  50: [[0,0,1,1,1,1,0,0],[0,1,3,3,3,3,1,0],[1,3,5,5,5,5,3,1],[1,3,4,3,3,4,3,1],[1,2,2,2,2,2,2,1],[1,4,2,4,4,2,4,1],[1,2,2,2,2,2,2,1],[1,1,1,1,1,1,1,1]]
  51: [[0,0,1,1,1,1,0,0],[0,1,2,2,2,2,1,0],[1,2,2,2,2,2,2,1],[1,6,6,6,6,6,6,1],[1,6,1,6,6,1,6,1],[1,6,6,6,6,6,6,1],[1,3,4,3,3,4,3,1],[1,3,3,3,3,3,3,1]]
  52: [[1,1,1,1,1,1,1,1],[1,2,2,2,2,2,2,1],[1,2,5,5,5,5,2,1],[1,2,5,4,4,5,2,1],[1,2,5,5,5,5,2,1],[1,2,2,2,2,2,2,1],[1,3,3,3,3,3,3,1],[1,1,1,1,1,1,1,1]]
  53: [[1,1,1,1,1,1,1,1],[1,2,2,2,2,2,2,1],[1,3,6,4,6,5,6,1],[1,2,2,2,2,2,2,1],[1,4,6,5,6,3,6,1],[1,2,2,2,2,2,2,1],[1,5,6,3,6,4,6,1],[1,1,1,1,1,1,1,1]]
---

## Overview
Mini-Pokemon en modo GBA: pueblo + interiores, hierba alta con encuentros, combate por turnos
con tipos. Estos tokens son la fuente de verdad; el motor (generator.js / simulator.js) debe
mantenerse en sincronia con ellos (ver regla `solid-sync` del linter).
La **especificación del formato** (secciones, reglas, cadena de herramientas) está en `PROTOCOL.md`.

## Tiles
Registro de IDs 16-63 (8x8). `solid:true` debe coincidir con `GBA_SOLID_TILES` en simulator.js.
Tiles clave: `tall_grass` dispara encuentros; `door` es warp; `mat` es la salida de interiores.
El **arte** de cada tile vive en `tileArt` (front-matter): ID → matriz 8×8 de índices de color (0–15).
El motor construye `bgTiles` sobrescribiendo el arte procedural por ID, con fallback si falta. Es el
"arte del mundo" como dato (igual que `sprites` para las siluetas de combate).

## Types
Triangulo de efectividad PLANTA > AGUA > FUEGO > PLANTA (x2 a favor, x0.5 en contra).
Referencia: `{types.PLANTA.AGUA}` = 2.

## Species
Cada especie tiene `type` y `moves` (referencian la tabla `moves`). `HOJITA` evoluciona en
`HOJABLOOM` al nivel 8. Las marcadas `wild:true` aparecen en la hierba alta. La tabla `encounters`
define qué especies salen **por área** (`town`, `route1`); si un área no está listada, se usa la
lista global de `wild:true` como fallback.

## Maps
Los **interiores** (`pokecenter`, `pokemart`) se definen como datos: `fill` (tile/paleta de relleno),
`legend` (un carácter → `{ tile, pal }`) y `rows` (lista de cadenas ASCII, una por fila). El `export`
expande esto a `window.GAME.MAPS[name] = { tilemap, attrs }` y `generator.js` lo consume con **fallback**
al builder procedural. Dimensiones: `rows` = `platform.rows` filas, cada cadena = `platform.cols` cols.
Cada interior incluye además sus **metadatos** `entry`/`exit`/`return` (`{ col, row }`): dónde aparece el
jugador al entrar, el felpudo de salida (tile 46), y dónde reaparece en el exterior. El **terreno** del
overworld (pueblo, Ruta 1) sigue en `generator.js` (level-design en código). Las
**entidades** del overworld sí están en datos: `overworld.<area>.npcs` (posición/paleta/diálogo de los
aldeanos), `overworld.<area>.trainers` (colocación `col/row/dir/sight`; el equipo/premio/diálogo del
entrenador viene de `trainers`) y `overworld.<area>.warps` (`col/row/target` + `entry` opcional; el
`target` es un área de `overworld` o un interior de `maps`). Consumido por `generator.js` con fallback.
Aviso: los diálogos no deben llevar `,` (el parser de listas de flujo cortaría por la coma).

## Player
Estado inicial: `starter` (especie con la que empiezas, referencia a `species`), `level`, `start`
(`{x,y}` en píxeles del pueblo) e `inventory` opcional (`{ ITEM: cantidad }`). El `startMoney` está en
`economy`. El motor (`simulator.js`) construye el Pokémon inicial desde `starter` + `species` + `moves`,
con fallback embebido a HOJITA.

## Text
`text` centraliza los **textos de sistema** del pueblo (intro, cartel, bienvenida de interior, enfermera,
PC, estantería, recuperación) como `clave: "cadena"`. El motor los lee con `gtext(clave, fallback)` y el
generador toma `intro` de aquí. Los diálogos de NPCs/entrenadores viven en `overworld`/`trainers`, no aquí.

## Economy & Balance
`economy.startMoney` y el catálogo `items` (precio + efecto). Cada ítem tiene `effect`:
`heal` (cura `amount` PS), `cure` (quita el estado `cures`) o `catch` (Poké Ball). Los precios de la
tienda derivan de `items`. Captura: `catchBase + catchScale * (1 - PS/PSmax)`; la suma no debe superar 1.

## Do's and Don'ts
- Todo tile con `solid:true` debe estar en `GBA_SOLID_TILES`; los walkable NO.
- Indices de paleta dentro de `0..palettesCount-1`.
- `species.moves` y `move.type` deben existir en `moves` y `types`.
- `evolvesInto` debe referenciar una especie definida.
- `items.effect` debe ser `heal` | `cure` | `catch`; `heal` requiere `amount`.
- Las especies de `encounters` deben existir en `species`.
- En `maps`, cada fila mide `platform.cols` y hay `platform.rows` filas; los tiles de `legend`/`fill` existen.
- En `maps`, `entry`/`exit`/`return` van dentro de los límites; `exit` debe caer sobre un felpudo (tile 46).
- En `overworld`, los `trainers.name` deben existir en `trainers`; los diálogos de NPC no llevan `,`.
- Los `warps.target` deben ser un área de `overworld` o un interior de `maps`.
- En `sfx`, cada evento tiene `freq` (>0 Hz) y `dur` (0–5 s); el motor lo reproduce con `gsfx(nombre, ...)`.
- `player.starter` debe existir en `species`; los ítems de `player.inventory` deben existir en `items`.
