# CONTRACT — GBA Pokémon: Ruta 1, Pokédex, Evolución

> **Estado: las 3 features están COMPLETADAS.** Este documento es el contrato histórico de ejecución;
> se conserva como referencia del alcance/criterios originales.
>
> **Nota de evolución del proyecto:** los *datos* que aquí aparecen como estructuras JS en código
> (entrenadores, `EVOLUTIONS`, especies, etc.) ahora viven en **`GAME.md`** y se generan a
> `window.GAME` (`node tools/game-export.js`), que el motor consume con fallback. Para **añadir
> contenido** (entrenador, especie, ítem, encuentro, NPC, warp, mapa interior…) edita `GAME.md`, NO el
> código — ver la sección **"Datos primero"** en `.claude/skills/gba-pokemon-engine/SKILL.md`. Este
> contrato describe cómo se implementó el *motor* de esas features, no cómo se añade contenido hoy.

> Leer primero `CLAUDE.md` (arquitectura, IDs de tiles 16–63, índices de paleta 0–15, método de
> verificación) y `.claude/skills/gba-pokemon-engine/SKILL.md` (recetas). No repetir ese contenido.
> Todo el trabajo es sobre el modo **GBA "town"**: `generator.js` (`buildGbaPokemonTown`),
> `simulator.js`, `app.js`. JavaScript vanilla, sin build.

## 1. Objetivo

Añadir tres features al mini-Pokémon GBA: (1) un segundo mapa "Ruta 1" con entrenadores que retan al
verte, (2) un Pokédex en el menú START, (3) evolución por nivel.
Éxito: las 3 verificables por estado/píxeles forzando frames, sin romper el modo GBC ni el pueblo actual.

## 2. Entradas y salidas (contratos de datos)

### 2.1 Ruta 1 + entrenadores
```js
// gameData (devuelto por buildGbaPokemonTown): nuevas claves
maps: { route1: { tilemap, attrs } }          // mapa overworld 30x20 (igual modelo que el pueblo)
// warps existentes + warp de borde bidireccional pueblo<->ruta:
//   { col, row, target:'route1',  entry:{col,row} }   en el pueblo (borde superior, hueco en árboles)
//   { col, row, target:'town',    entry:{col,row} }   en la ruta (borde inferior)
// Entrenador = NPC con campos extra:
trainer: {
  col,row,x,y, dir:'down', sight:4, sprite, pal,            // NPC normal + campos sig.
  team:[{ name, maxhp, type, moves:[{name,type,power}], level }],
  prize: 200, defeated:false, dialogue:'¡Te reto!'
}
// gameState.currentMap pasa a aceptar 'town' | 'route1' | 'pokecenter' | 'pokemart'
```
Disparo de combate de entrenador: cuando el jugador entra en la línea recta de visión del entrenador
(misma fila/columna, a ≤ `sight` tiles, sin sólidos en medio) y `!defeated` → iniciar combate contra `team`.

### 2.2 Pokédex
```js
gameState.pokedex = { seen: { [name]: true }, caught: { [name]: true } }
// marcar seen al aparecer un salvaje o un Pokémon rival; caught al capturar
// MENU_MAIN incluye 'POKEDEX'; vista lista: nombre + [VISTO]/[CAPTURADO]/'-----'
// contador: "Vistos N  Capturados M"
```

### 2.3 Evolución
```js
const EVOLUTIONS = {
  HOJITA: { level: 8, into: 'HOJABLOOM', maxhpBonus: 8, type: 'PLANTA',
            moves:[{name:'PLACAJE',type:'NORMAL',power:5},{name:'HOJA AFILADA',type:'PLANTA',power:10}] }
  // ampliable por especie
}
// en gainXp(): si el mon activo alcanza/supera EVOLUTIONS[name].level -> evolucionar
// efecto: name=into, maxhp+=bonus, hp=maxhp, type=type, moves=moves; mensaje "¡X evoluciona en Y!"
```

## 3. Stack y dependencias fijadas

```
- JavaScript ES5/ES6 vanilla en navegador. SIN build, SIN bundler, SIN TypeScript.
- 0 dependencias nuevas (npm). Render solo Canvas 2D.
- Editar SOLO: generator.js, simulator.js, app.js (y CLAUDE.md si cambia un dato documentado).
- NO usar: módulos ES import/export, frameworks, librerías de terceros, ctx.fillText para texto de juego.
```

## 4. Patrones del proyecto (imitar, no reinventar)

```
- Mapa nuevo:            buildGbaPokemonTown (generator.js) — tiles via T{}/put(), place(r,c,id,pal)
- Warps/cambio de mapa:  warps + interiors + checkWarp/enterInterior/exitInterior (simulator.js).
                         Generalizar a 'maps' overworld reutilizando savedOverworld (mismo patrón).
- NPCs y movimiento:     gameState.npcs + updateNpcs (simulator.js)
- Combate:               startWildBattle, moveAttack, battleEnemyTurn, drawBattle (simulator.js)
- Menú y vistas:         MENU_MAIN, menuSelect, drawMenu (simulator.js)
- Nivel/XP:              gainXp (simulator.js)
- Guardado:              saveGame/loadGame -> localStorage['gbaPokeSave'] (simulator.js)
- Sync a simulador:      syncAssetsToSimulator (app.js)
- Texto:                 drawPixelText / wrapPixelText
- Recetas detalladas:    .claude/skills/gba-pokemon-engine/SKILL.md
```

## 5. Artefactos a producir (todos = ediciones, no archivos nuevos)

```
1. generator.js — buildGbaPokemonTown
   - Construir intMap/attrs de 'route1' (30x20): borde de árboles, camino, parches de hierba alta (22),
     2 entrenadores como NPCs con team/prize, y el hueco de warp en el borde inferior.
   - Añadir warps de borde pueblo<->ruta y la clave gameData.maps.route1.
   - Añadir EVOLUTIONS y (si hace falta) sprite/paleta del Pokémon evolucionado.
   - Scope: solo dentro de buildGbaPokemonTown + constantes cercanas. No tocar otros géneros/GBC.

2. simulator.js — sistema de mapas overworld + entrenadores
   - Generalizar checkWarp/enter para soportar maps overworld ('town'<->'route1') además de interiores.
   - updateTrainers(): detectar línea de visión y disparar startTrainerBattle(team, prize, npc).
   - startTrainerBattle: como combate salvaje pero BALL deshabilitada ("¡No puedes capturar...!"),
     equipo rival con relevo, al ganar -> npc.defeated=true, money+=prize.
   - Scope: añadir funciones nuevas + ganchos en updatePhysics. No reescribir el combate salvaje.

3. simulator.js — Pokédex
   - gameState.pokedex; marcar seen/caught en los puntos indicados (2.2).
   - 'POKEDEX' en MENU_MAIN + vista en drawMenu + navegación en menuSelect.
   - Incluir pokedex en saveGame/loadGame.
   - Scope: ~vista + 3 ganchos. No tocar el render de combate.

4. simulator.js — Evolución
   - EVOLUTIONS check dentro de gainXp; mensaje de evolución (triggerDialog o cola de mensajes de combate).
   - Scope: solo gainXp + helper evolveIfReady(). 

5. app.js — sync
   - Pasar gameData.maps y entrenadores al simulador en syncAssetsToSimulator (copias frescas, como npcs).
   - Scope: 2-4 líneas.

6. CLAUDE.md
   - Añadir: mapa 'route1', estado pokedex, EVOLUTIONS, entrenadores. Solo las tablas/listas afectadas.
```

## 6. Criterios de aceptación (binario)

```
- [ ] node --check generator.js && node --check simulator.js && node --check app.js  -> sin errores
- [ ] El modo GBC sigue funcionando (switchConsole('gbc') no lanza; pueblo GBA intacto)
- [ ] Pisar el warp de borde del pueblo cambia gameState.currentMap a 'route1' y renderiza el mapa nuevo
- [ ] Pisar el warp de borde de la ruta vuelve a 'town'
- [ ] Quedar en la línea de visión de un entrenador con defeated=false inicia combate contra su team
- [ ] En combate de entrenador, elegir BALL muestra "¡No puedes capturar...!" y no captura
- [ ] Ganar a un entrenador: defeated=true y money aumenta en prize
- [ ] startWildBattle marca pokedex.seen[name]; capturar marca pokedex.caught[name]
- [ ] Menú START muestra POKEDEX con vistos/capturados; los datos sobreviven a saveGame+reload+loadGame
- [ ] Al subir el mon activo al nivel de EVOLUTIONS, cambia name/maxhp/type/moves y muestra mensaje
- [ ] Verificación hecha con frames forzados (GBSimulator.stop();start()) + lectura de gameState/píxeles
```

## 7. Restricciones duras (innegociable)

```
- NO editar archivos fuera de: generator.js, simulator.js, app.js, CLAUDE.md.
- NO añadir dependencias npm ni archivos nuevos (salvo que un criterio lo exija explícitamente).
- NO usar constantes 20/18/160/144: usar P().cols/rows/screenW/screenH (rompe GBC si no).
- NO usar ctx.fillText para texto de juego: usar drawPixelText.
- NO marcar un tile como sólido sin añadir su ID a GBA_SOLID_TILES; los walkables NO van en el Set.
- NO acceder a window.AppState / window.GBSimulator (son const; usar el nombre directo). window.GBPlatform SÍ.
- Construir paletas siempre con pad16([...]) (hasta 16 colores [r,g,b] 0–31).
- Verificar SIN depender de requestAnimationFrame: forzar frame con GBSimulator.stop();start(),
  leer GBSimulator.gameState y/o getImageData, e inyectar input con dispatchEvent(KeyboardEvent).
- Mantener gameLoop envuelto en try/catch; ningún dibujo nuevo debe asumir arrays no nulos.
- Si un criterio de la sección 6 no se puede cumplir, PARAR y reportar el bloqueo. NO implementar
  workarounds silenciosos ni entrar en loops de reparación.
```
