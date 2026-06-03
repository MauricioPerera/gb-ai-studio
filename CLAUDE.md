# GB-AI Studio — Guía para agentes

SPA en **JavaScript vanilla, sin build ni dependencias**. Es un IDE en el navegador que simula
desarrollo para **Game Boy Color (GBC)** y **Game Boy Advance (GBA)**. El modo GBA incluye un
**mini-Pokémon jugable**: pueblo + Ruta 1 enlazados, combate por turnos con tipos, captura y equipo,
niveles y evolución, entrenadores con línea de visión, Pokédex, tienda/dinero/objetos, menú START y
guardado. Los datos de gameplay se gobiernan desde **`GAME.md`** (ver pipeline más abajo).

## Cómo ejecutar y verificar

```bash
npx http-server -p 8147 -c-1     # servir la carpeta (no hace falta build)
# abrir http://localhost:8147, pulsar el toggle "GBA", y escribir un prompt con "pokemon"
node --check simulator.js        # comprobar sintaxis antes de dar por bueno un cambio
```

**Importante (quirk de verificación):** en algunos previews `requestAnimationFrame` no se ejecuta,
así que el game loop no avanza solo. Para verificar:

- **Forzar un frame:** `GBSimulator.stop(); GBSimulator.start();` ejecuta `gameLoop()` una vez
  (síncrono: `updatePhysics()` + `drawScreen()`).
- **Leer estado:** `GBSimulator.gameState` (está exportado).
- **Leer píxeles:** `canvas.getContext('2d').getImageData(x,y,1,1).data` tras forzar un frame.
- **Simular input:** `window.dispatchEvent(new KeyboardEvent('keydown',{key:'x'}))`.
- `AppState` y `GBSimulator` son `const` de nivel superior → **NO** están en `window`; accede a
  ellos por nombre directo. En cambio `window.GBPlatform` **sí** está en `window`.
- Cambiar de consola: `switchConsole('gba')` (global de app.js). Regenera el juego con `lastPrompt`.

## Arquitectura (orden de carga de scripts)

| Archivo | Global | Responsabilidad |
|---|---|---|
| `rombuilder.js` | `window.GBPlatform`, `ROMBuilder` | Config de plataforma (dimensiones) + compilador de ROM `.gb` (solo GBC) |
| `generator.js` | `GBGenerator` | Plantillas, generador local por palabras clave, integración con APIs (Gemini/OpenAI/Ollama) y **`buildGbaPokemonTown()`** (todo el mundo GBA) |
| `simulator.js` | `GBSimulator` | Emulador en canvas: render, físicas/colisiones, warps/interiores, NPCs, **combate**, tienda, menú, guardado, fuente de bits |
| `app.js` | `AppState` + funciones globales | Orquestación de UI, editores (sprite/mapa/paletas), pestañas, chat, `switchConsole`, `syncAssetsToSimulator` |
| `verify_rom.js` | — | Test en Node del compilador de ROM (solo GBC) |

## Configuración de plataforma — `window.GBPlatform`

```js
window.GBPlatform = { mode, cols, rows, screenW, screenH, set(mode) }
// gbc: 20x18 tiles / 160x144 px    |    gba: 30x20 tiles / 240x160 px
```
Todo el código dimension-aware lee `P()` (= `window.GBPlatform`) en lugar de constantes fijas.

## Modelo de datos gráfico

- **Tiles de fondo:** `bgTiles` (48 entradas, **IDs 16–63**). Cada tile es una matriz **8×8** de
  índices de color (0–15 en GBA, 0–3 en GBC). Se accede con `bgTiles[tileId - 16]`.
- **Mapa:** `tilemap[row][col] = tileId` y `tilemapAttrs[row][col] = índice de paleta`.
- **Paletas:** `bgPalettes[palIdx]` es un array de hasta 16 colores `[r,g,b]` en escala 0–31.
  Render: `color = bgPalettes[ tilemapAttrs[r][c] ][ tilePixels[r][c] ]`.
- **Sprites:** `spritePalettes`; el **color índice 0 = transparente**. Player y NPCs son sprites 16×16.
- El **mismo tile** se recolorea con distinta paleta (p. ej. el tejado se reusa en rojo/azul/marrón).

### IDs de tiles del pueblo GBA (`buildGbaPokemonTown` en generator.js)
```
16 césped   18 objetivo  19 puerta   20 pokébola(item) 21 NPC      22 hierba alta
23 agua     24 obj.abierto 25 puerta abierta            26 árbol    27 camino
28 flores   29 cartel    30-32 tejado(L/M/R sup)  33-35 tejado(L/M/R inf)
36 muro     37 ventana   38 emblema pokébola      40 cartel tienda  41 banda cartel
42-45 árbol grande 2×2    46 felpudo  47 valla
48 suelo interior  49 mostrador  50 máquina curación  51 enfermera  52 ordenador  53 estantería
```

### Índices de paleta del pueblo GBA (`bgPalettes`)
```
0 césped  1 tejado PC(rojo)  2 muro PC(crema)  3 tejado tienda(azul)  4 muro tienda
5 tejado casa(marrón) 6 muro casa(tan)  7 árboles  8 camino  9 agua  10 flores
11 objetos/cartel/NPC  12 suelo interior(beige)  13 máquina/enfermera  14 suelo tienda  15 estantería
```
Sprite palettes: `0` entrenador, `1` aldeano verde, `2` aldeano naranja.

## Dónde vive cada sistema (todo en `simulator.js` salvo nota)

- **Plataforma / dimensiones:** `applyPlatform()`, `P()`. Editor de mapa en `app.js` (`applyEditorPlatform`).
- **Colisión:** `GBA_SOLID_TILES` (Set, desde `window.GAME.SOLID_TILES` con fallback) + `isSolid()`
  dentro de `updatePhysics()`. Las puertas-warp son transitables; los NPCs bloquean.
- **Jugador 4 direcciones + sombra:** `gameState.playerAnim` `{down,up,side}` (right = volteo H),
  `gameState.facing`. Sprite 16×16 vía `drawGbcSprite(...flipH)`.
- **NPCs caminantes:** `gameState.npcs`, `updateNpcs()`; hablar en `handleButtonA`. Los **entrenadores**
  son NPCs con `{trainer, sight, dir, team, prize, defeated}`; `checkTrainers()` los activa por **línea
  de visión** y `startTrainerBattle()` inicia el combate.
- **Mapas / áreas overworld:** `gameState.area` (`'town'|'route1'`) + `gameState.maps` (registro de áreas).
  `goWarp()` enruta un warp a un **interior** (`enterInterior`) o a otra **área** (`switchArea`).
- **Cámara / scroll:** los mapas pueden ser mayores que la pantalla (Ruta 1 = 30×40). `setMapDims()`
  fija `gameState.mapCols/mapRows` desde el tilemap; `aCols()/aRows()` se usan en la lógica de mapa
  (colisión/bounds, NO en la de pantalla). `drawScreen` calcula `camX/camY` (centrada en el jugador,
  fijada a los límites) y dibuja solo la ventana visible; jugador y NPCs llevan el offset de cámara.
- **Interiores:** `gameState.interiors` (pokecenter/pokemart), `gameState.currentMap`
  (`'overworld'|'pokecenter'|'pokemart'`), `enterInterior`/`exitInterior`, salida por felpudo (tile 46).
- **Combate:** `gameState.battle` (máquina de estados, fases `msg/menu/moves/win/lose/run/caught`).
  `startWildBattle` (encuentros en hierba, tile 22) y `startTrainerBattle` (equipo + premio, **sin captura**).
  `battleSelect`→submenú de ataques `moveAttack`, `battleEnemyTurn`, `onEnemyFaint` (relevo de equipo de
  entrenador), `battleThrowBall`, `drawBattle`. Daño = `(power + nivel/3 + rand) × efectividad`.
- **Tipos:** `TYPE_CHART` (PLANTA›AGUA›FUEGO›PLANTA, ×2/×0.5), `effectiveness()`. Cada Pokémon tiene `type` y `moves[]`.
- **Estados:** un ataque con `effect: 'poison'` (en `GAME.md`) puede **envenenar**; `tickPoison()` resta PS
  por ronda (mín. 1, no debilita), `gameState.playerMon.status`, badge `PSN`. Cura: `useAntidote()` (ANTÍDOTO) y el Centro Pokémon.
- **Captura y equipo:** `battleThrowBall` (prob. por PS restantes), `gameState.party` (máx 6), cambiar
  el activo en la vista POKEMON del menú, **relevo automático** al debilitarse (`battleEnemyTurn`).
- **Niveles y evolución:** `gainXp` (sube nivel/PS máx), `EVOLUTIONS` + `evolveActiveMon()` (cambia
  nombre/PS/tipo/ataques al alcanzar el nivel; se dispara al ganar).
- **Pokédex:** `gameState.pokedex {seen, caught}`, marcado en `startWildBattle`/`startTrainerBattle`/captura;
  vista `pokedex` en `drawMenu`; roster desde `window.GAME.SPECIES`.
- **Tienda:** `openShop`/`shopBuy`, `gameState.money`, `gameState.inventory`.
- **Menú START:** `toggleMenu`/`menuSelect`/`menuBack`, vistas `main/pokemon/bag/pokedex/player`, `drawMenu`.
  Abre con Enter o el botón START. La mochila usa `usePotion` (también disponible en combate).
- **Guardado:** `saveGame`/`loadGame` → `localStorage['gbaPokeSave']` (dinero, inventario, mon, equipo, pokédex, posición).
- **Fuente de bits (texto nítido):** `FONT_3x5`, `drawPixelText`, `drawPixelTextCentered`, `wrapPixelText`.

## Pipeline de datos — `GAME.md` (tokens de gameplay)

Los datos de **combate/economía** son tokens en `GAME.md` (front-matter YAML), validados y exportados
(patrón estilo `design.md` de Google). **La especificación formal del formato y la cadena de
herramientas está en `PROTOCOL.md`** (propuesta de protocolo *gameplay-as-data*):

- **`GAME.md`** — fuente de verdad: `tiles` (registro) + `tileArt` (matrices 8×8), `types`, `moves`, `species` (con `evolvesInto`/`wild`/`pal`/`sprite`),
  `trainers` (equipo + premio + diálogo), `items` (precio + efecto), `encounters` (especies por área),
  `maps` (interiores como DSL `fill`/`legend`/`rows` + metadatos `entry`/`exit`/`return`), `overworld` (entidades por área: `npcs` + colocación
  de `trainers` + `warps`), `player` (starter + posición + inventario inicial), `text` (textos de sistema),
  `economy` (dinero inicial), `balance` (captura/XP). Cuerpo Markdown con secciones canónicas.
- **`node tools/game-lint.js GAME.md`** — valida: refs rotas, `solid-sync` (cruza con `GBA_SOLID_TILES`
  del código), simetría de tipos, `item-effect-valid`, `encounter-ref`, `map-dims`/`map-legend-ref`/`map-meta`,
  `overworld-ref`, `player-ref`, `tileart-ref`/`tileart-dims`, límites de economía, orden de secciones, y
  `dead-token` (avisa si una clave de `balance` no se referencia en `simulator.js`). Sale con código 1 si hay errores.
- **`node tools/game-export.js`** — genera `game-data.generated.js` (un `window.GAME` con `TYPE_CHART`,
  `WILD_LIST`, `ENCOUNTERS`, `EVOLUTIONS`, `TRAINERS`, `PALETTES`, `SPRITE_PALETTES`, `SPRITES`,
  `MAPS` (interiores expandidos a `{tilemap,attrs}`), `OVERWORLD`, `PLAYER`, `SOLID_TILES`, `TILE_ART`, `ITEMS`, `ECONOMY`, `BALANCE`,
  `SPECIES`…). Cargado en `index.html` **antes** del resto.
  La **silueta** de un Pokémon en combate viene de `species.sprite` → `window.GAME.SPRITES[name]`
  (helper `monSprite()`); el `BALANCE` (incl. `encounterRate`/`xpCurveMul`) se lee con `gBal()`.
  Los **ítems** (`window.GAME.ITEMS`, con `effect` `heal`/`cure`/`catch`) los consume `useItem()`; los
  **encuentros por área** (`ENCOUNTERS[area]`) los elige `encounterList()` (fallback `WILD_LIST`); los
  **precios** de tienda derivan de `items` (`ECONOMY.prices`). Los **interiores** (`window.GAME.MAPS`)
  los consume `buildGbaPokemonTown` con fallback al builder procedural. Las **entidades** del overworld
  (`window.GAME.OVERWORLD.<area>.npcs`/`trainers`/`warps`) también las consume `buildGbaPokemonTown`/
  `buildRoute1` con fallback; el **terreno** del overworld y la **colocación de edificios** siguen en código.
  Los entrenadores de la Ruta 1 toman su equipo/premio/diálogo de `window.GAME.TRAINERS` (la colocación
  en el mapa sigue en `buildRoute1`).
- **El motor consume `window.GAME` con fallback:** `const TYPE_CHART = (window.GAME && window.GAME.TYPE_CHART) || {…}`
  (igual `WILD_LIST`, `EVOLUTIONS`, dinero inicial, precios de tienda, balance de captura). Si falta el
  archivo generado, usa el fallback embebido → el juego nunca se rompe.
- **CI** (`.github/workflows/game.yml`): ejecuta el lint y comprueba que el export esté al día (sin drift).
- Parser YAML compartido en `tools/yaml-min.js`. **Cambiar un dato = editar `GAME.md` + `export`**, no el código.
- **Transformación compartida `tools/game-build.js`** (`buildGame(data)` → objeto GAME): isomorfa (Node +
  navegador). La usan tanto `game-export.js` (CLI) como el **importador del navegador**.
- **Importar `GAME.md` en vivo:** `index.html` carga `tools/yaml-min.js` + `tools/game-build.js`; el botón
  «Importar GAME.md» llama a `importGameMd(text)` (app.js) → parsea, `buildGame`, fija `window.GAME`,
  regenera en GBA y `GBSimulator.reinitPlayer()` (reconstruye starter/inventario/posición desde `PLAYER`).

## Convenciones y gotchas

- El **bucle de juego está envuelto en try/catch** (`gameLoop`) para no morir por un error transitorio
  durante un cambio de consola; si “se queda negro”, suele ser el loop parado, no un throw real.
- `switchConsole('gba')` con género `town` enruta a `buildGbaPokemonTown()` (return temprano en
  `generateGameLocal`). El resto de géneros/GBC usan el camino clásico.
- El **cuadro de diálogo de intro** cubre la franja inferior unos ~3 s (fondo verde) al entrar — no es un bug.
- El compilador de **ROM `.gb` solo aplica a GBC**; en GBA el botón avisa que requiere compilación
  externa (devkitARM). El modo GBA es simulador + editores, no genera binario.
- Para añadir features sigue el playbook de la skill **`gba-pokemon-engine`** (en `.claude/skills/`).
