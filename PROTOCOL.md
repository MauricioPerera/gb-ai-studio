# The GAME Protocol — *Gameplay-as-Data* v0.1 (propuesta)

> **Estado:** propuesta / borrador (`version: alpha`). Especificación del formato `GAME.md` y su
> cadena de herramientas, tal y como está implementada en **GB-AI Studio** (mini-Pokémon GBA).
> Inspirado en el patrón [`design.md`](https://github.com/google-labs-code/design.md): **YAML + Markdown**
> como fuente de verdad, con validación e integración por CLI.
>
> **Propuesta publicada (repo independiente):** https://github.com/MauricioPerera/game-protocol
> (spec generalizada + herramientas portables + ejemplo autocontenido). Este `PROTOCOL.md` es la versión
> ligada a la implementación original.
>
> **Implementación de referencia:** `GAME.md` + `tools/game-lint.js` + `tools/game-export.js` +
> `tools/yaml-min.js` en este repositorio.

---

## 1. Resumen

El **Protocolo GAME** define cómo describir el **contenido y el balance** de un juego 2D por tiles como
**datos declarativos** en un único archivo (`GAME.md`), en lugar de incrustarlos en el código del motor.

Un archivo de protocolo es a la vez:

- **Tokens** (front-matter YAML) — la *fuente única de verdad*, legible por máquina y validable.
- **Documentación** (cuerpo Markdown) — secciones canónicas que explican y restringen esos tokens.

Una herramienta de **export** compila los tokens a un artefacto consumible por el motor
(`window.GAME`), y una de **lint** valida el archivo y lo **cruza con el código**. El motor consume el
artefacto con **fallback embebido**, de modo que el juego nunca se rompe si el generado falta.

### Principios de diseño

1. **Fuente única de verdad.** Cambiar un dato = editar `GAME.md` + `export`. Nunca editar el generado.
2. **Datos, no lógica.** El protocolo describe *qué* (criaturas, arte, mapas, textos), no *cómo*
   (fórmulas, máquinas de estado, render). La lógica vive en el motor.
3. **Fallback siempre.** El motor lee `window.GAME` con un valor embebido por defecto: si falta el
   generado, degrada con gracia.
4. **Validación cruzada.** El lint no solo valida el YAML; **cruza** los tokens con el código
   (p. ej. tiles sólidos ↔ `GBA_SOLID_TILES`, knobs de balance ↔ referencias en el motor).
5. **Sin dependencias.** Parser YAML propio (subconjunto), CLI en Node puro, sin `npm install`.
6. **Determinismo / sin drift.** El generado es función pura del `GAME.md`; la CI rechaza el drift.

---

## 2. Formato del documento

```
---
<front-matter YAML: tokens>      # fuente de verdad (máquina)
---
<cuerpo Markdown: secciones>     # documentación canónica (humano)
```

- El **front-matter** (entre `---`) contiene los tokens. Se parsea con `tools/yaml-min.js`.
- El **cuerpo** contiene secciones `## Título` en un **orden canónico** (validado por `section-order`).
- Campos **obligatorios** en el front-matter: `version`, `name`.

### Subconjunto YAML soportado

El parser de referencia (`yaml-min.js`) soporta, intencionadamente, un **subconjunto**:

| Soportado | Ejemplo |
|---|---|
| Mapas de bloque (anidamiento arbitrario por indentación de 2 espacios) | `tiles:`␤`  16: {…}` |
| Mapas de flujo | `{ tile: 48, pal: 12 }` |
| Listas de flujo (anidables) | `[PLACAJE, LATIGO CEPA]`, `[[0,1],[2,3]]` |
| Escalares: number / bool / string (con espacios) | `power: 5`, `solid: true`, `name: grass` |
| Cadenas citadas (`"…"` / `'…'`) | `dialogue: "Hola, mundo"` |
| Comentarios de línea | `# …` |

**No soportado** (evítalo): secuencias de bloque (`- item`), anclas/aliases, cadenas multilínea.
→ Las listas se escriben **en flujo** (`[a, b]`) en una sola línea.

### Regla de las comas (importante)

`splitTop` divide por comas **solo en contexto de flujo** (`[…]` / `{…}`). Por tanto:

- En un **valor de bloque** (`clave: "texto, con comas"`) las comas son **seguras** (el valor es toda
  la línea). → Los textos largos (`text.*`, diálogos con comas) van como valor de bloque citado.
- En un **valor de flujo** (`dialogue: …` dentro de `{ … }` o un elemento de `[ … ]`) una coma
  **rompe** el parseo. → Los diálogos de NPC/entrenador en listas de flujo **no** deben llevar comas
  (el lint avisa: regla `overworld-ref`).

---

## 3. La cadena de herramientas (pipeline)

```bash
# 1) validar           2) generar                3) consumir (recargar)
node tools/game-lint.js GAME.md      # 0 errores antes de exportar (exit 1 si hay errores)
node tools/game-export.js            # GAME.md -> game-data.generated.js (window.GAME)
# index.html carga game-data.generated.js ANTES del motor; recargar para tomar cambios.
```

- **`game-lint.js`** — valida el front-matter contra 27 reglas (§6) y lo cruza con `simulator.js`.
  Sale con código **1** si hay errores (la CI lo bloquea); los *warnings* no bloquean.
- **`game-export.js`** — compila los tokens al artefacto `game-data.generated.js`
  (`window.GAME = { … }`). **Auto-generado, nunca se edita a mano.**
- **CI** (`.github/workflows/game.yml`) — ejecuta el lint y comprueba **sin-drift** (que el generado
  esté al día respecto a `GAME.md`).

---

## 4. Referencia de tokens (front-matter)

Cada sección es un token. Tipos: `N`=number, `S`=string, `B`=bool.

### Metadatos

| Token | Tipo | Notas |
|---|---|---|
| `version` | S | **obligatorio**. Versión del documento (`alpha`). |
| `name` | S | **obligatorio**. Nombre del juego. |
| `description` | S | Resumen libre. |
| `platform` | map | `{ mode, cols, rows, screenW, screenH }`. Define las dimensiones del mundo. |
| `palettesCount` | N | Nº de paletas de fondo (define el rango de índices de color válidos). |

### Contenido y combate

```yaml
tiles:                 # registro de IDs 16-63
  <id>: { name: S, solid: B, warp?: B, encounter?: B }

types:                 # tabla de efectividad
  <TYPE>: { <TYPE>: <multiplicador> }     # p. ej. PLANTA: { AGUA: 2, FUEGO: 0.5 }

moves:
  <NAME>: { type: <TYPE>, power: N, effect?: poison, chance?: N }

species:
  <NAME>: { type: <TYPE>, maxhp: N, pal?: S, moves: [<MOVE>...],
            wild?: B, sprite?: <sprite>, evolvesInto?: <SPECIES>, atLevel?: N }

trainers:
  <NAME>: { level: N, pal: N, prize: N, dialogue: S, team: [<SPECIES>...] }

items:
  <NAME>: { price: N, effect: heal|cure|catch, amount?: N, cures?: S }

encounters:
  <area>: [<SPECIES>...]                  # especies salvajes por área (fallback: wild:true global)

economy: { startMoney: N }
balance: { catchBase: N, catchScale: N, xpCurveMul: N, encounterRate: N }
```

### Arte

```yaml
palettes:       { <idx>: [[r,g,b]...] }   # colores 0-31; se rellena a 16 (pad16)
spritePalettes: { <idx>: [[r,g,b]...] }
sprites:        { <name>: [[…16×16…]] }   # siluetas de combate; índice 0 = transparente
tileArt:        { <id>:  [[…8×8…]] }      # arte de cada tile; índices de color 0..palettesCount-1
```

### Mundo

```yaml
maps:                                     # interiores como DSL
  <id>:
    fill:   { tile: N, pal: N }           # relleno por defecto
    legend: { <char>: { tile: N, pal: N } }
    rows:   ["WWWW…", …]                  # platform.rows filas de platform.cols chars
    entry:  { col: N, row: N }            # aparición al entrar
    exit:   { col: N, row: N }            # felpudo de salida (debe ser tile 46)
    return: { col: N, row: N }            # reaparición en el exterior

overworld:                                # entidades por área (terreno = código)
  <area>:
    npcs:     [{ col, row, pal, range, timer, dialogue }]
    trainers: [{ col, row, name: <TRAINER>, dir, sight }]
    warps:    [{ col, row, target, entry?: {col,row} }]   # target = área o interior

player: { starter: <SPECIES>, level: N, start: {x,y}, inventory: { <ITEM>: N } }

text: { <key>: "cadena" }                 # textos de sistema (intro, cartel, interior…)
```

---

## 5. Artefacto generado (`window.GAME`)

`export` transforma los tokens (algunos directos, otros **derivados**) en 20 claves:

| Clave de `window.GAME` | Origen | Transformación |
|---|---|---|
| `TYPE_CHART` | `types` | directo |
| `MOVES` | `moves` | directo |
| `SPECIES` | `species` | directo |
| `WILD_LIST` | `species` | **derivado**: las `wild:true`, con `moves` expandidos |
| `EVOLUTIONS` | `species` | **derivado**: de `evolvesInto`/`atLevel` |
| `TRAINERS` | `trainers` | equipos **expandidos** desde `species` |
| `ENCOUNTERS` | `encounters` | listas **expandidas** a entradas wild |
| `ITEMS` | `items` | directo |
| `ECONOMY` | `economy`+`items` | `startMoney` + `prices` **derivados** de `items` |
| `BALANCE` | `balance` | directo |
| `PALETTES` / `SPRITE_PALETTES` | `palettes` / `spritePalettes` | `pad16` a 16 colores |
| `SPRITES` | `sprites` | directo |
| `TILE_ART` | `tileArt` | directo |
| `MAPS` | `maps` | `rows`+`legend`+`fill` **expandidos** a `{tilemap, attrs}` + meta |
| `OVERWORLD` | `overworld` | directo |
| `PLAYER` | `player` | directo |
| `TEXT` | `text` | directo |
| `TILES` | `tiles` | directo |
| `SOLID_TILES` | `tiles` | **derivado**: IDs con `solid:true` |

### Contrato de consumo (fallback)

El motor lee cada clave con un valor por defecto embebido:

```js
const TYPE_CHART = (window.GAME && window.GAME.TYPE_CHART) || { /* fallback */ };
function gBal(k, def)  { const b = window.GAME && window.GAME.BALANCE; return (b && b[k] != null) ? b[k] : def; }
function gtext(k, def) { const t = window.GAME && window.GAME.TEXT;    return (t && t[k]) ? t[k] : def; }
```

→ Si `game-data.generated.js` falta o está incompleto, el juego usa el fallback. **El generado nunca es
un requisito duro.**

---

## 6. Reglas de validación (27)

| Regla | Nivel | Comprueba |
|---|---|---|
| `frontmatter-present` | error | Existe el front-matter `--- … ---`. |
| `required-fields` | error | `version`, `name` presentes. |
| `section-order` | error/warn | Las `##` siguen el orden canónico; avisa de secciones no canónicas. |
| `palette-range` | error | `tiles.*.pal` dentro de `0..palettesCount-1`. |
| `palette-color-range` | error | Cada color es `[r,g,b]` en `0..31`. |
| `solid-sync` | error/warn | `tiles.*.solid` ↔ `GBA_SOLID_TILES` del **código**. |
| `type-symmetry` | warn | Si `A>B` es ×2, `B>A` debería ser ×0.5 (la diagonal se exceptúa). |
| `move-type-valid` | error | `moves.*.type` ∈ `types`. |
| `species-type-valid` | error | `species.*.type` ∈ `types`. |
| `moves-exist` | error | `species.*.moves` ∈ `moves`. |
| `broken-ref` | error | `evolvesInto` ∈ `species`. |
| `trainer-team-valid` | error | `trainers.*.team` ∈ `species`. |
| `trainer-bounds` | error | `prize > 0`. |
| `sprite-ref` | error | `species.*.sprite` ∈ `sprites`. |
| `sprite-dims` | error | Cada sprite es 16×16. |
| `item-effect-valid` | error/warn | `effect` ∈ {heal,cure,catch}; `heal` requiere `amount`; `cure` `cures`. |
| `encounter-ref` | error | `encounters.*` ∈ `species`. |
| `map-dims` | error | `rows` = `platform.rows` filas × `platform.cols` columnas. |
| `map-legend-ref` | error | `legend`/`fill` referencian tiles y paletas válidos. |
| `map-meta` | error/warn | `entry`/`exit`/`return` en rango; `exit` cae sobre felpudo (tile 46). |
| `overworld-ref` | error/warn | `trainers.name` ∈ `trainers`; `warps.target` ∈ áreas/interiores; coords en rango; diálogos sin coma. |
| `player-ref` | error/warn | `starter` ∈ `species`; `start` numérico; `inventory` ∈ `items`. |
| `tileart-ref` | error/warn | `tileArt.<id>` en rango 16-63 y presente en `tiles`. |
| `tileart-dims` | error | Cada matriz es 8×8 con índices `0..palettesCount-1`. |
| `text-valid` | error | Cada texto es una cadena no vacía. |
| `economy-bounds` | error | Precios `> 0`; `catchBase + catchScale ≤ 1`. |
| `dead-token` | warn | Cada clave de `balance` está referenciada en `simulator.js` (anti-drift). |

---

## 7. La frontera datos / código

El protocolo es deliberadamente **parcial**: solo se tokeniza lo que es *contenido autorable*.

| Gobernado por `GAME.md` (datos) | En el motor (código), por diseño |
|---|---|
| Tiles (registro + **arte 8×8**), paletas, siluetas de combate | **Layout/colocación** del terreno (qué tile en cada celda) |
| Tipos, ataques (incl. `effect`), especies, evolución | **Lógica**: fórmulas de daño/captura/XP, máquinas de estado |
| Entrenadores (equipo/premio/diálogo) e **ítems** | **Render/UI**: cámara, menús, fuente de bits |
| Encuentros por zona, economía, balance | El **comportamiento** de un `effect` (el dato lo declara; el motor lo aplica) |
| **Interiores** completos (DSL + `entry/exit/return`) | Sprite de overworld del jugador/NPCs |
| **Entidades** del overworld (NPCs, entrenadores, warps) | Sonido, otros géneros, compilador de ROM |
| Estado inicial del jugador, **textos de sistema** | |

**Zona gris:** un *tipo de efecto nuevo* (p. ej. sueño) es mitad dato (se declara en `GAME.md`) y mitad
código (el motor necesita la rama que lo aplica).

---

## 8. Extender el protocolo

Para añadir una sección nueva (token), el patrón canónico es:

1. **Definir** la sección en `GAME.md` (front-matter) y documentarla en el cuerpo (sección `##` en el
   orden canónico → añadir a `CANON` en el lint).
2. **Exportar**: emitir la clave en `game-data.generated.js` (`game-export.js`), con derivaciones si
   procede.
3. **Consumir**: leerla en el motor con **fallback** embebido.
4. **Validar**: añadir una regla de lint (refs/rangos/dims) y, si aplica, un **cruce con el código**.
5. **Verificar**: editar el dato, `export`, recargar y comprobar el efecto in-game (forzando frames si
   el preview no ejecuta `requestAnimationFrame`).

> El método de extensión por datos está documentado como recetas en
> `.claude/skills/gba-pokemon-engine/SKILL.md` (sección "Datos primero").

---

## 9. Versionado y compatibilidad

- `version` declara la versión del documento (actual: `alpha`).
- **Compatibilidad hacia atrás:** gracias al contrato de fallback, un motor más nuevo lee un `GAME.md`
  más viejo (claves ausentes → fallback) y viceversa (claves desconocidas → ignoradas por el motor).
- **Sin-drift:** el artefacto generado debe regenerarse en cada cambio de tokens; la CI lo verifica.

---

## Apéndice — Glosario de archivos

| Archivo | Rol |
|---|---|
| `GAME.md` | El documento de protocolo (tokens + doc). Fuente de verdad. |
| `tools/yaml-min.js` | Parser del subconjunto YAML (sin dependencias). |
| `tools/game-lint.js` | Validador (27 reglas + cruces con el código). |
| `tools/game-export.js` | Compilador → `game-data.generated.js`. |
| `game-data.generated.js` | Artefacto `window.GAME` (auto-generado). |
| `.github/workflows/game.yml` | CI: lint + sin-drift. |
| `CLAUDE.md` / `SKILL.md` | Arquitectura del motor / recetas de extensión por datos. |
