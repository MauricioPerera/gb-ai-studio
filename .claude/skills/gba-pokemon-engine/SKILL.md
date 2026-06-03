---
name: gba-pokemon-engine
description: >-
  Playbook para extender el motor del mini-Pokémon GBA de GB-AI Studio (carpeta gb-ai-studio,
  archivos generator.js + simulator.js + app.js, JavaScript vanilla sin build). Úsala al añadir
  o modificar tiles, paletas, mapas, edificios con interior, NPCs, combate por turnos con tipos,
  tienda, menú START o guardado en el modo GBA "town". La mayoría del CONTENIDO (especies, ataques,
  ítems, encuentros, entrenadores, NPCs, warps, mapas interiores, balance, paletas) se añade editando
  `GAME.md` + `node tools/game-export.js`, SIN tocar código; el código se reserva para mecánicas/arte
  nuevos. Cubre las convenciones del motor (rango de IDs, índices de paleta, colisiones por tile) y el
  método de verificación cuando el preview no ejecuta requestAnimationFrame.
---

# Extender el motor GBA-Pokémon (GB-AI Studio)

Motor 2D tipo Pokémon escrito en **JS vanilla, sin build**. Tres archivos importan:
`generator.js` (construye el mundo), `simulator.js` (lo ejecuta/dibuja), `app.js` (UI/sync).
Lee `CLAUDE.md` del proyecto para el mapa completo. Esta skill es el **cómo hacer**.

## Datos primero: extiende por `GAME.md` (no por código)

La mayoría del **contenido** se añade editando `GAME.md` + `node tools/game-export.js` — **sin tocar `.js`**.
El motor consume `window.GAME` (generado) con *fallback* embebido, así que el juego nunca se rompe si
falta el generado. Reserva el código para **mecánicas, arte o lógica nuevas**. El flujo es siempre el mismo:

```bash
# 1) editar GAME.md   2) validar   3) generar   4) recargar el navegador
node tools/game-lint.js GAME.md      # 0 errores antes de exportar
node tools/game-export.js            # regenera game-data.generated.js (window.GAME)
```
`game-data.generated.js` se carga en `index.html` ANTES del resto. Tras exportar, **recarga la página**
(el navegador cachea `window.GAME` del load anterior). La CI valida lint + sin-drift del generado.

### Qué editar para añadir…

| Quiero añadir… | Sección de `GAME.md` | Forma |
|---|---|---|
| Pokémon/especie | `species` | `{ type, maxhp, pal, moves:[...], wild?, sprite?, evolvesInto?, atLevel? }` |
| Ataque | `moves` | `{ type, power, effect?: poison, chance? }` |
| Ítem | `items` | `{ price, effect: heal\|cure\|catch, amount?, cures? }` (el precio alimenta la tienda) |
| Encuentro por zona | `encounters.<area>` | lista de especies; fallback a las `wild:true` globales |
| Entrenador | `trainers` + `overworld.<area>.trainers` | equipo/premio/diálogo en `trainers`; colocación en `overworld` |
| NPC de pueblo | `overworld.town.npcs` | `{ col,row,pal,range,timer,dialogue }` (diálogo **sin** `,`) |
| Warp | `overworld.<area>.warps` | `{ col,row,target,entry? }`; `target` = área (`overworld`) o interior (`maps`) |
| Mapa interior | `maps.<id>` | DSL `fill` + `legend` + `rows` + `entry`/`exit`/`return` (`exit` sobre felpudo tile 46) |
| Sprite de combate | `sprites` + `species.sprite` | matriz 16×16; índice 0 = transparente |
| Arte de un tile | `tileArt.<id>` | matriz 8×8 de índices de color 0–15 (sobrescribe el arte procedural) |
| Estado inicial del jugador | `player` | `{ starter, level, start:{x,y}, inventory }` (starter ∈ `species`) |
| Texto de sistema (intro/cartel/interior) | `text.<clave>` | `"cadena"`; el motor lo lee con `gtext(clave, fallback)` |
| Tipos / balance / economía / paletas | `types`/`balance`/`economy`/`palettes` | el lint valida rangos y refs |

### Receta probada: entrenador nuevo, 100 % por datos
```yaml
# 1) en `trainers:`  (equipo/premio/diálogo; el equipo referencia `species`)
CAZABICHOS LEO: { level: 4, pal: 2, prize: 200, dialogue: Los BICHOS son geniales!, team: [ORUGUI, PIDGY] }
# 2) en `overworld.route1.trainers:`  (colocación; la lista es de FLUJO, una línea)
{ col: 15, row: 20, name: CAZABICHOS LEO, dir: down, sight: 5 }
```
`node tools/game-export.js`, recarga, y el entrenador **aparece y reta por línea de visión** con su
diálogo — sin tocar `generator.js`/`simulator.js`. Verifícalo: warp a la ruta, sitúa al jugador en su
cono de visión (misma columna, dentro de `sight`), fuerza frames y lee `gameState.battle`.

### El lint te cubre
`node tools/game-lint.js GAME.md` valida: refs rotas, `solid-sync` (tiles sólidos ↔ `GBA_SOLID_TILES`),
simetría de tipos, `item-effect-valid`, `encounter-ref`, `map-dims`/`map-legend-ref`, `overworld-ref`
(entrenador/warp válidos), límites de economía y `dead-token` (un knob de `balance` declarado pero no
referenciado en el motor). Sale con código 1 si hay errores → la CI lo bloquea.

### Cuándo SÍ toca código (las recetas de la sección siguiente)
- **Arte de tile nuevo** (matriz 8×8) y la **colocación** en el mapa del overworld (level-design).
- **Un `effect` nuevo** (de ataque, p. ej. sueño; o de ítem): el *dato* va en `GAME.md`, pero el motor
  necesita la rama que lo aplica (`tickPoison`/`useItem`…).
- **Mecánicas o UI nuevas** (vistas de menú, fórmulas de combate, sistemas).
- El **terreno del overworld** (pueblo / Ruta 1) y la colocación de edificios siguen en `generator.js`.
- Reglas/IDs/paletas → mantén `GAME.md` y el código en sync (el lint `solid-sync`/`dead-token` lo cruza).

## Reglas del motor (memorízalas)

1. **Tiles 8×8.** `bgTiles` tiene 48 entradas, **IDs 16–63**, acceso `bgTiles[id-16]`. Cada tile es
   una matriz 8×8 de índices 0–15. `tilemap[r][c]=id`, `tilemapAttrs[r][c]=paleta`.
2. **Paletas = arrays de hasta 16 colores `[r,g,b]` (0–31).** Usa `pad16([...])` para rellenar.
   El render es `bgPalettes[attr][tilePixel]`. El **mismo tile** se recolorea cambiando la paleta.
3. **Sprites: color índice 0 = transparente.** Player/NPCs son 16×16 (`drawGbcSprite` soporta
   cualquier tamaño y `flipH`).
4. **Colisión por tile en GBA:** añade el ID a `GBA_SOLID_TILES` (Set en simulator.js) si bloquea.
   Lo no listado es transitable. Las puertas-warp se exceptúan; los NPCs bloquean dinámicamente.
5. **Dimensiones dinámicas:** usa `P().cols/rows/screenW/screenH`, nunca constantes 20/18/160/144.
6. **Texto nítido:** dibuja siempre con `drawPixelText(txt, x, y, scale, css)` (fuente de bits),
   no con `ctx.fillText` (se ve borroso al escalar).

## Verificación (preview sin requestAnimationFrame)

El loop no avanza solo. Para comprobar cualquier cambio:

```js
// 1) preparar y forzar UN frame (síncrono)
switchConsole('gba');                 // global de app.js; regenera el mundo en GBA
GBSimulator.stop(); GBSimulator.start();   // ejecuta gameLoop() una vez

// 2) leer estado o píxeles
GBSimulator.gameState.battle          // estado (exportado)
const cx = document.getElementById('gb-canvas').getContext('2d');
cx.getImageData(x, y, 1, 1).data      // [r,g,b,a] de un pixel tras el frame

// 3) simular input real
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));  // x=A, z=B, flechas, Enter=START
```

`AppState`/`GBSimulator` son `const` de nivel superior → accede por nombre (NO `window.`).
`window.GBPlatform` sí está en `window`. Para avanzar N frames, repite `stop();start()` en bucle.
Siempre `node --check simulator.js` antes de dar por bueno.

## Recetas (camino de código)

> Usa esto **solo** cuando el cambio NO cabe en `GAME.md` (arte nuevo, mecánica nueva, lógica). Para
> contenido (especies/ataques/ítems/encuentros/entrenadores/NPCs/warps/interiores) usa "Datos primero".

### Añadir un tile de fondo
> **Arte por datos:** registra el tile en `tiles` (ID/solidez) y su matriz 8×8 en `tileArt.<id>` de
> `GAME.md`; `export`. Si el tile es nuevo, añade su ID a `tiles` (y a `GBA_SOLID_TILES` si es sólido).
> Lo de abajo (objeto `T`/`put()`) es el fallback procedural en código.
1. En `buildGbaPokemonTown` (generator.js), define la matriz 8×8 en el objeto `T`:
   `nombre:[[...],[...],...8 filas...]` usando índices de la paleta que le toque.
2. Regístralo con `put(<id>, T.nombre)` (elige un ID libre 16–63; revisa los `put(...)` existentes).
3. Si es sólido, añade `<id>` a `GBA_SOLID_TILES` en simulator.js.
4. Colócalo en el mapa con `place(row, col, <id>, <paletaIdx>)`.
5. Verifica: `place` el tile, fuerza frame, lee un pixel central con el color esperado de su paleta.

### Añadir una especie salvaje (combate)
> **Preferido: por datos.** Añade la especie a `species` (con `wild: true`) en `GAME.md` y, si quieres,
> a `encounters.<area>`; `export`. Lo de abajo es el fallback embebido en código (solo si editas el motor).
1. En `WILD_LIST` (simulator.js): `{ name, maxhp, pal, type, moves:[{name,type,power}] }`.
2. Si usa color nuevo, añade una paleta a `MON_PALS` (array `[null, outline, ...]`, índice 0 = null).
3. Tipos válidos: `PLANTA, FUEGO, AGUA, NORMAL` (ver `TYPE_CHART`). El triángulo es
   PLANTA›AGUA›FUEGO›PLANTA (×2 a favor, ×0.5 en contra). Los capturados conservan `type` y `moves`.
4. Verifica: `GBSimulator.startWildBattle()` varias veces; comprueba `gameState.battle.enemy.type`.

### Añadir un ataque al Pokémon del jugador
- Edita `gameState.playerMon.moves` (init en gameState): `{name, type, power}`. El submenú LUCHA
  los lista automáticamente. El daño es `(power + nivel/3 + rand) × efectividad`.

### Añadir un edificio con interior (warp)
> **Casi todo por datos:** el **tilemap interior** y sus **metadatos** (`entry`/`exit`/`return`) van en
> `maps.<id>` (DSL `fill`/`legend`/`rows` + esos 3 puntos), y el **warp** en `overworld.<area>.warps`
> (`target` = `<id>`); `export`. Solo sigue en código el **exterior** del edificio (arte + puerta en el
> tilemap del overworld). Los pasos 2–4 de abajo ya los cubren el DSL y los datos.
1. En `buildGbaPokemonTown`: dibuja el edificio en el exterior con `stamp(...)` o tiles sueltos;
   deja una **puerta** (tile 19) accesible desde abajo.
2. Construye el mapa interior: arrays `tilemap`/`attrs` 30×20, muros (36) en el borde, suelo y mobiliario.
3. Añade a `interiors`: `{ tilemap, attrs, entry:{col,row}, exit:{col,row}, returnCol, returnRow }`.
4. Añade a `warps`: `{ col, row, target:'<id-interior>' }` en la posición de la puerta exterior.
5. La lógica (`checkWarp`/`enterInterior`/`exitInterior` en simulator.js) ya es genérica: una puerta
   nueva funciona sin tocar el simulador. El felpudo (tile 46) en `exit` devuelve al exterior.
6. Verifica: coloca al jugador sobre la puerta (`playerX=col*8+8; playerY=row*8+8`), fuerza frame,
   comprueba `gameState.currentMap === '<id-interior>'` y lee píxeles del interior.

### Añadir un NPC que camina
> **Preferido: por datos.** Añádelo a `overworld.town.npcs` en `GAME.md` (`{col,row,pal,range,timer,dialogue}`)
> y `export`. Lo de abajo es el fallback en código.
- En `buildGbaPokemonTown`, array `npcs`: `{ col,row, x:col*8, y:row*8, homeCol,homeRow, range,
  timer, tx:null, ty:null, sprite: playerSprite, pal:1|2, dialogue }`. `app.js` los copia frescos al
  simulador en `syncAssetsToSimulator`. `updateNpcs()` los mueve; hablan con A (`handleButtonA`).
- Verifica el movimiento avanzando ~200 frames (`for(...) { stop(); start(); }`) y mirando `npc.col/row`.

### Añadir una opción de menú o de tienda
- **START:** `MENU_MAIN` (array) define las opciones; maneja la acción en `menuSelect()` (vista `main`)
  y dibuja en `drawMenu()`. La intercepción de teclas está en `handleKeyDown` (`gameState.menuOpen`).
- **Tienda:** `openShop()` define `shopItems`; `shopBuy()` descuenta `money` y suma a `inventory`.

### Guardado
- `saveGame()`/`loadGame()` serializan `{money, inventory, playerMon, party, posición}` a
  `localStorage['gbaPokeSave']`. Si añades estado persistente nuevo, inclúyelo en ambas funciones.

## Errores típicos a evitar

- **Paleta equivocada → color raro.** Cada índice de paleta tiene un significado fijo (ver CLAUDE.md).
  Un fallo común: colocar un tile con la paleta de otro (p. ej. valla con paleta "tejado azul").
  Si un color sale mal, vuelca `gameState.bgPalettes[attr]` y compáralo con el tile.
- **"Pantalla negra"** suele ser el game loop parado (forzaste un reload por eval) o el cuadro de
  diálogo de intro tapando la franja inferior — no un crash. Limpia `gameState.dialogue=null` y
  `stop();start()` para distinguir.
- **No uses `window.AppState`/`window.GBSimulator`** en evals: son `const`, accede por nombre.
- **No metas constantes 20/18/160/144;** rompe el modo GBC. Usa `P()`.
- Mantén el **bucle robusto**: cualquier dibujo nuevo no debe lanzar si los assets aún no están
  sincronizados (el try/catch de `gameLoop` te cubre, pero evita asumir arrays no nulos).
