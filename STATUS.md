# STATUS — GB-AI Studio / mini-Pokémon GBA

Estado del proyecto. Ver `CLAUDE.md` (arquitectura) y `.claude/skills/gba-pokemon-engine/` (cómo extender).

## ✅ Hecho

### Motor del juego (modo GBA "town")
- Toggle **GBC↔GBA** (240×160, mapa 30×20) — `switchConsole`.
- **Pueblo** en color: Centro Pokémon, Tienda, casas, árboles 2×2, caminos, flores, carteles, vallas, hierba, agua.
- **Ruta 1** (segundo mapa) enlazada por **warp de borde** bidireccional (modelo de áreas: `gameState.area`/`maps`).
- **Tileset de 16 colores** con sombreado; **fuente de bits** para texto nítido.
- **Entrenador 16×16**: 4 direcciones, animación de caminar, sombra.
- **NPCs caminantes** + **entrenadores** con **línea de visión** que retan al combate (la LOS respeta las
  dimensiones del **mapa activo** `aRows()/aCols()`, así funciona en rutas con scroll, no solo en pantalla).
- **Interiores** (Centro Pokémon con curación + Tienda con menú de compra).
- **Combate por turnos**: HP, menú LUCHA/POCIÓN/BALL/HUIR, submenú de ataques, **tipos** (×2/×0.5).
- **Encuentros salvajes** (hierba alta), 5 especies; **combate de entrenador** (equipo + premio, sin captura, relevo).
- **Captura** → **equipo** (cambiar activo, relevo automático), **niveles/XP**, **evolución**.
- **Pokédex** (vistos/capturados) en el menú START; persistente.
- **Tienda** (dinero, inventario, precios), **usar Pociones** (combate y menú).
- **Menú START**: Pokémon · Mochila · Pokédex · Jugador · Guardar · Cargar.
- **Guardar/Cargar** persistente (localStorage).

### Pipeline de datos / herramientas para agentes (patrón design.md)
- `GAME.md` (tokens fuente de verdad) · `tools/game-lint.js` + `yaml-min.js` (validador) ·
  `tools/game-export.js` → `game-data.generated.js` (`window.GAME`) · `.github/workflows/game.yml` (CI lint + sin-drift).
- El motor **consume `window.GAME`** (TYPE_CHART, WILD_LIST, EVOLUTIONS, economía, balance) con fallback.
- ✅ **Importar `GAME.md` en el navegador** (botón «📥 Importar GAME.md»): parsea + `buildGame` (transformación
  compartida `tools/game-build.js`, isomorfa CLI/navegador) → `window.GAME` → regenera + `reinitPlayer`.
- ✅ **Editor `GAME.md` como panel principal** con **lint en vivo** (núcleo compartido `tools/game-lint-core.js`,
  el mismo que la CLI): resumen en la cabecera + hallazgos bajo el textarea, al escribir (debounce).
- ✅ **Editores visuales conectados a `GAME.md`**: Map Editor → `tileArt` y Sprite Editor (siluetas 16×16) →
  `sprites`, con botones de volcado «⤴ … → GAME.md» (bucle pintar → dato verificado).
  Verificado: importar un `GAME.md` con `starter: GOTIN` hace que el juego arranque con GOTIN al instante.
- Docs: `CLAUDE.md`, skill `gba-pokemon-engine`, `CONTRACT.md` (las 3 tareas del contrato **completadas**),
  **`PROTOCOL.md`** (especificación formal del formato `GAME.md` como propuesta de protocolo *gameplay-as-data*).
- ✅ **Flujo data-only probado end-to-end**: se añadió el entrenador `CAZABICHOS LEO` (equipo ORUGUI+PIDGY)
  a la Ruta 1 **tocando solo `GAME.md`** (`trainers` + `overworld.route1.trainers`) → `lint`+`export` →
  aparece y **reta en combate** con su diálogo, sin tocar código. Demuestra el contrato "otros agentes extienden por datos".

## ❌ Pendiente / deuda

### Cobertura de `GAME.md` (parcial)
- Gobierna **combate/economía + equipos de entrenadores** (equipo/premio/diálogo en `trainers`),
  **ítems** (`items`: precio + `effect` `heal`/`cure`/`catch`, consumidos por `useItem`; SÚPER POCIÓN ya
  cura), **encuentros por área** (`encounters.town`/`route1`, con fallback a la lista global) y
  **sprites de combate por especie**. Los precios de la tienda derivan de `items`.
- ✅ **Interiores completos como datos** (`maps.pokecenter`/`pokemart`: DSL `fill`/`legend`/`rows` ASCII
  **+ metadatos `entry`/`exit`/`return`** → `window.GAME.MAPS`, consumido por `generator.js` con fallback).
  Verificado **byte-idéntico** (tilemap+attrs+meta) y **funcional** (entrar deja al jugador en `entry`;
  pisar el felpudo lo devuelve a `return`). El interior ya no tiene nada hardcodeado salvo el fallback.
- ✅ **Textos de sistema como datos** (`text`: intro, cartel, bienvenida de interior, enfermera, PC,
  estantería, recuperación → `window.GAME.TEXT`, leídos con `gtext()` y fallback). Verificado in-game y
  por override. Base para traducir. (Diálogos de NPCs/entrenadores ya estaban en `overworld`/`trainers`.)
- ✅ **Arte de tiles como datos** (`tileArt`: 36 matrices 8×8 → `window.GAME.TILE_ART`; el motor construye
  `bgTiles` sobrescribiendo el arte procedural por ID, con fallback). Verificado **byte-idéntico** (data vs
  procedural) y por override en runtime. Cierra "GAME.md gobierna el arte" (mundo + siluetas de combate).
- ✅ **Estado inicial del jugador como datos** (`player`: `starter`, `level`, `start` `{x,y}`, `inventory`).
  El motor construye el Pokémon inicial desde `starter`+`species`+`moves` con fallback. Verificado
  byte-idéntico (HOJITA) y funcional (cambiar a `GOTIN` → empiezas con GOTIN; `inventory` inicial aplicado).
- ✅ **Entidades del overworld como datos** (`overworld.<area>.npcs` + `trainers` + `warps`:
  posición/diálogo/paleta de aldeanos, colocación `col/row/dir/sight` de entrenadores, y **warps**
  `col/row/target`+`entry`; equipo/premio/diálogo siguen viniendo de `trainers`). Verificado idéntico al
  procedural (data y fallback) y **funcionalmente** (warp data-driven entra al Centro Pokémon y a la Ruta 1).
- **Falta migrar el terreno del overworld**: el arte/layout del pueblo y la Ruta 1 y la **colocación de
  edificios** siguen en `generator.js` (level-design en código, por diseño).
- `GBA_SOLID_TILES` y las **paletas** (bg + sprite) **ya se generan y se consumen** desde `GAME.md`
  (registro de tiles completo, paletas como tokens; lint 0/0). Solo queda hardcodeado el **layout de
  mapas** y la **colocación** de objetos/edificios/entrenadores (level design, apropiado en código).

### Fidelidad visual / engine
- ✅ **Scroll de cámara** implementado: mapas mayores que la pantalla (la **Ruta 1 mide 30×40** y scrollea
  en vertical; el pueblo 30×20 no scrollea). La cámara se centra en el jugador y se fija a los límites del mapa.
- Tiles siguen **8×8**. Sin **fundido** al warpear.
- ✅ **Sprites de combate por especie** desde `GAME.md` (`species.sprite` + sección `sprites`); genérico y
  el del jugador también en el spec. (El sprite de overworld del jugador y los NPCs aún es código.)

### Mecánicas
- Solo el **Pokémon activo gana XP/evoluciona**; el equipo no.
- **Estado de veneno** implementado (ataque `TOXINA` con `effect: poison` en `GAME.md`; tic por ronda;
  cura con ANTÍDOTO / Centro). Faltan otros estados (sueño/parálisis), **PP** y habilidades.
- **Export de ROM real**: solo GBC produce `.gb`; **GBA no genera binario** (requiere devkitARM).
- Otros géneros (rpg/shooter/platformer) **solo en GBC**.
- ✅ **Editor de mapas mejorado**: muestra **todos** los tiles con arte (no solo 16–25) con nombre/ID y
  paleta real; tile seleccionado con info; **cuentagotas** (clic-derecho); lectura de coordenadas al pasar
  el ratón; etiqueta de tamaño dinámica; y layout apilado que cabe en el panel.

### Verificación
- Comprobado forzando frames (`GBSimulator.stop();start()`) porque el preview no ejecuta `requestAnimationFrame`.
  Pendiente confirmación visual real en navegador a 60fps.

## Próximos pasos sugeridos
1. **Llevar el overworld a `GAME.md`** (extender el DSL `maps` —ya usado en interiores— al pueblo y la Ruta 1,
   con una capa de objetos/NPCs/warps; el `export` ya genera tiles sólidos, paletas e interiores).
2. **Fidelidad visual**: sprites 16×16 por especie, scroll de cámara, transición de fundido al warpear.
3. **Profundidad de combate**: XP/evolución para todo el equipo, estados, más ataques.
