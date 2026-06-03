# GB-AI Studio

**IDE en el navegador, en JavaScript vanilla y sin build**, que simula desarrollo para **Game Boy Color
(GBC)** y **Game Boy Advance (GBA)**. El modo GBA incluye un **mini-Pokémon jugable** —pueblo + Ruta 1,
combate por turnos con tipos, captura y equipo, evolución, entrenadores con línea de visión, Pokédex,
tienda, menú START y guardado— cuyo **contenido y balance se gobiernan como datos**.

▶️ **Demo en vivo:** https://mauricioperera.github.io/gb-ai-studio/ (pulsa el toggle **GBA** y escribe un prompt con "pokemon").

> 🧩 **Es la implementación de referencia (prueba viva) del [GAME Protocol](https://github.com/MauricioPerera/game-protocol)** —
> la propuesta *gameplay-as-data*. Casi todo el contenido del juego (criaturas, ataques, tipos, ítems,
> encuentros, arte de tiles, siluetas, interiores, NPCs, entrenadores, warps, starter, textos) vive en
> **`GAME.md`** y se compila a `window.GAME`, consumido por el motor **con fallback**.

## Ejecutar

```bash
npx http-server -p 8147 -c-1     # servir la carpeta (no hace falta build)
# abrir http://localhost:8147, pulsar el toggle "GBA", y escribir un prompt con "pokemon"
```

## El pipeline de datos (la prueba del protocolo)

```bash
node tools/game-lint.js GAME.md      # valida (27 reglas + cruces con el motor)
node tools/game-export.js            # GAME.md -> game-data.generated.js (window.GAME)
```

`index.html` carga `game-data.generated.js` **antes** del motor. Cambiar un dato = editar `GAME.md` +
`export`; **no** se toca el código. Probado de punta a punta: se puede añadir un entrenador, una especie,
un ítem, un mapa interior, un NPC, un warp o el starter **solo desde datos**.

🔁 **Importar en el navegador:** el botón **«📥 Importar GAME.md»** carga un `GAME.md` desde tu disco, lo
compila a `window.GAME` con el **mismo** `buildGame` que la CLI (`tools/game-build.js`, isomorfo) y
**regenera el juego al instante** — sin pasar por la línea de comandos. Ideal para ver el resultado de
tus cambios y exponer el caso del juego estilo Pokémon.

- **Especificación del formato:** [`PROTOCOL.md`](./PROTOCOL.md) (y el repo independiente del protocolo).
- **Cómo extender por datos:** `.claude/skills/gba-pokemon-engine/SKILL.md` (sección "Datos primero").

## Arquitectura (orden de carga)

| Archivo | Responsabilidad |
|---|---|
| `rombuilder.js` | Config de plataforma + compilador de ROM `.gb` (solo GBC). |
| `generator.js` | Plantillas, generador local, integración con APIs (Gemini/OpenAI/Ollama) y construcción del mundo GBA. |
| `simulator.js` | Emulador en canvas: render, físicas, warps/interiores, NPCs, combate, tienda, menú, guardado. |
| `app.js` | UI: editores (sprite/mapa/paletas), pestañas, chat, `switchConsole`, sync. |

Detalle completo en [`CLAUDE.md`](./CLAUDE.md); estado del proyecto en [`STATUS.md`](./STATUS.md).

## Notas

- El compilador de **ROM `.gb` real solo aplica a GBC**; en GBA el modo es simulador + editores
  (la ROM `.gba` real requiere compilación externa con devkitARM).
- Las **API keys** (Gemini/OpenAI) se introducen en la UI y no se guardan en el repositorio.
- Sin dependencias ni `npm install`: solo un servidor estático y Node para las herramientas CLI.

## Licencia

[MIT](./LICENSE).
