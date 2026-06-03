/**
 * simulator.js - Motor de Simulación GBC en Canvas para GB-AI Studio
 * Emula la pantalla de Game Boy Color (160x144) a 60 FPS,
 * soportando 8 paletas de fondo y 8 de sprites (RGB 15 bits),
 * atributos de mapa y colisiones físicas.
 */

const GBSimulator = (function() {
    let canvas, ctx;
    let animationId = null;
    let isRunning = false;

    // Tiles sólidos del pueblo Pokémon GBA. Fuente: GAME.md -> window.GAME.SOLID_TILES; fallback hardcodeado.
    const GBA_SOLID_TILES = new Set((window.GAME && window.GAME.SOLID_TILES) ||
        [17, 19, 21, 23, 26, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 47, 49, 50, 51, 52, 53]);

    // ---- Estado inicial del jugador desde GAME.md (window.GAME.PLAYER) con fallback embebido ----
    function gPlayer() { return (window.GAME && window.GAME.PLAYER) || {}; }
    function starterName() { return gPlayer().starter || 'HOJITA'; }
    function startPos() { const s = gPlayer().start || {}; return { x: (s.x != null ? s.x : 80), y: (s.y != null ? s.y : 80) }; }
    function startInventory() { return Object.assign({}, gPlayer().inventory || {}); }
    function buildStarter() {
        const name = starterName();
        const sp = window.GAME && window.GAME.SPECIES && window.GAME.SPECIES[name];
        const MV = (window.GAME && window.GAME.MOVES) || {};
        if (sp) {
            const moves = (sp.moves || []).map(n => ({ name: n, type: (MV[n] || {}).type, power: (MV[n] || {}).power }));
            return { name: name, hp: sp.maxhp, maxhp: sp.maxhp, level: gPlayer().level || 5, xp: 0, xpNext: 20, type: sp.type, status: null, moves: moves };
        }
        // Fallback embebido (si falta el generado): el HOJITA original.
        return { name: 'HOJITA', hp: 22, maxhp: 22, level: 5, xp: 0, xpNext: 20, type: 'PLANTA', status: null,
            moves: [{ name: 'PLACAJE', type: 'NORMAL', power: 5 }, { name: 'LATIGO CEPA', type: 'PLANTA', power: 7 }] };
    }

    // Estado del juego simulado en formato GBC
    const gameState = {
        playerX: startPos().x,
        playerY: startPos().y,
        playerSpeed: 1.5,
        playerTile: 1,
        playerSprite: null,     // Sprite 16x16 opcional (GBA); si es null se usa el tile 8x8
        playerSpriteWalk: null, // Segundo frame para la animación de caminar
        playerAnim: null,       // { down:[stand,walk], up:[...], side:[...] } para 4 direcciones
        facing: 'down',         // Dirección a la que mira el jugador
        walkTimer: 0,

        // Sistema de warps / interiores (entrar a edificios)
        warps: null,            // [{col,row,target}] en el mapa exterior
        interiors: null,        // { id: {tilemap, attrs, entry, exit, returnCol, returnRow} }
        currentMap: 'overworld',
        area: 'town',           // mapa overworld activo ('town' | 'route1')
        maps: null,             // registro de áreas overworld
        mapCols: 0, mapRows: 0, // dimensiones del mapa activo (en tiles; puede ser mayor que la pantalla)
        camX: 0, camY: 0,       // cámara (px) — se calcula cada frame en drawScreen
        savedOverworld: null,
        warpLock: null,         // tile en el que acabamos de aparecer (evita re-warp inmediato)
        npcs: null,             // NPCs que caminan por el mapa exterior

        // Sistema de tienda (Poké Mart) — dinero inicial desde GAME.md
        money: (window.GAME && window.GAME.ECONOMY && window.GAME.ECONOMY.startMoney) || 3000,
        inventory: startInventory(),
        shopOpen: false,
        shopItems: [],
        shopCursor: 0,
        shopMsg: '',

        // Sistema de combate Pokémon — starter desde GAME.md (window.GAME.PLAYER.starter)
        playerMon: buildStarter(),
        party: [],              // Pokémon capturados
        pokedex: { seen: { [starterName()]: true }, caught: { [starterName()]: true } }, // registro de vistos/capturados
        battle: { active: false },
        lastGrassTile: null,

        // Menú START (equipo / mochila / datos)
        menuOpen: false,
        menuView: 'main',
        menuCursor: 0,
        menuMsg: '',
        sprites: [],        // Matrices 8x8 de sprites (0-15)
        bgTiles: [],        // Matrices 8x8 de fondo (0-47)
        tilemap: [],        // Matriz 20x18 de celdas
        tilemapAttrs: [],   // Matriz 20x18 de atributos (índice de paleta de fondo 0-7)
        
        // Paletas GBC RGB de 15 bits (Cargadas dinámicamente)
        bgPalettes: [],     // 8 paletas, cada una con 4 colores [R, G, B] (0..31)
        spritePalettes: [], // 8 paletas, cada una con 4 colores [R, G, B] (0..31)
        
        keys: {
            up: false,
            down: false,
            left: false,
            right: false,
            a: false,
            b: false
        },

        dialogue: null,
        dialogueTimer: 0,
        
        hasKey: false,
        doorUnlocked: false,
        gameWon: false
    };

    function init(canvasId) {
        canvas = document.getElementById(canvasId);
        ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        applyPlatform();
        resetKeys();

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
    }

    // Atajo a la configuración de plataforma activa (GBC/GBA)
    function P() { return window.GBPlatform; }

    // Lee un valor de balance desde GAME.md (window.GAME.BALANCE) con valor por defecto
    function gBal(key, def) {
        const b = window.GAME && window.GAME.BALANCE;
        return (b && b[key] != null) ? b[key] : def;
    }

    // Lee un texto de sistema desde GAME.md (window.GAME.TEXT) con fallback embebido
    function gtext(key, def) {
        const t = window.GAME && window.GAME.TEXT;
        return (t && t[key]) ? t[key] : def;
    }

    // Reproduce un efecto de sonido por nombre desde GAME.md (window.GAME.SFX) con fallback freq/dur.
    function gsfx(name, freq, dur) {
        const s = window.GAME && window.GAME.SFX && window.GAME.SFX[name];
        playBeep((s && s.freq != null) ? s.freq : freq, (s && s.dur != null) ? s.dur : dur);
    }

    // Dimensiones del MAPA activo en tiles (puede ser mayor que la pantalla -> cámara con scroll)
    function aCols() { return gameState.mapCols || P().cols; }
    function aRows() { return gameState.mapRows || P().rows; }
    // Recalcula las dimensiones del mapa activo a partir del tilemap actual
    function setMapDims() {
        gameState.mapRows = (gameState.tilemap && gameState.tilemap.length) || P().rows;
        gameState.mapCols = (gameState.tilemap && gameState.tilemap[0] && gameState.tilemap[0].length) || P().cols;
    }

    // Ajusta la resolución del canvas a la consola activa
    function applyPlatform() {
        if (!canvas) return;
        canvas.width = P().screenW;
        canvas.height = P().screenH;
        ctx.imageSmoothingEnabled = false;
    }

    function resetKeys() {
        gameState.keys.up = false;
        gameState.keys.down = false;
        gameState.keys.left = false;
        gameState.keys.right = false;
        gameState.keys.a = false;
        gameState.keys.b = false;
    }

    // Carga los recursos del proyecto actual en el simulador GBC
    function setAssets(sprites, bgTiles, tilemap, tilemapAttrs, bgPalettes, spritePalettes) {
        gameState.sprites = sprites;
        gameState.bgTiles = bgTiles;
        gameState.tilemap = tilemap;
        gameState.tilemapAttrs = tilemapAttrs || createDefaultAttrs();
        gameState.bgPalettes = bgPalettes;
        gameState.spritePalettes = spritePalettes;
        setMapDims();
    }

    function createDefaultAttrs() {
        const rows = (gameState.tilemap && gameState.tilemap.length) || P().rows;
        const cols = (gameState.tilemap && gameState.tilemap[0] && gameState.tilemap[0].length) || P().cols;
        const attrs = [];
        for (let r = 0; r < rows; r++) attrs.push(new Array(cols).fill(0));
        return attrs;
    }

    function start() {
        if (isRunning) return;
        isRunning = true;
        
        const led = document.getElementById('console-led');
        const batLed = document.getElementById('battery-led');
        if (led) led.classList.add('active');
        if (batLed) batLed.classList.add('active');

        gameLoop();
    }

    function stop() {
        isRunning = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }

        const led = document.getElementById('console-led');
        const batLed = document.getElementById('battery-led');
        if (led) led.classList.remove('active');
        if (batLed) batLed.classList.remove('active');
    }

    function resetGame() {
        // Volver siempre al pueblo (sea desde un interior o desde la Ruta 1)
        if (gameState.maps && gameState.maps.town) {
            const t = gameState.maps.town;
            gameState.tilemap = t.tilemap; gameState.tilemapAttrs = t.attrs;
            gameState.npcs = t.npcs; gameState.warps = t.warps;
        } else if (gameState.savedOverworld) {
            gameState.tilemap = gameState.savedOverworld.tilemap;
            gameState.tilemapAttrs = gameState.savedOverworld.tilemapAttrs;
        }
        setMapDims();
        gameState.currentMap = 'overworld';
        gameState.area = 'town';
        gameState.warpLock = null;
        gameState.battle = { active: false };
        gameState.lastGrassTile = null;
        if (gameState.playerMon) gameState.playerMon.hp = gameState.playerMon.maxhp;
        gameState.playerX = startPos().x;
        gameState.playerY = startPos().y;
        gameState.hasKey = false;
        gameState.doorUnlocked = false;
        gameState.gameWon = false;
        gameState.dialogue = "¡GBC Iniciado! Explora en todo color.";
        gameState.dialogueTimer = 180;
    }

    function triggerDialog(text) {
        gameState.dialogue = text;
        gameState.dialogueTimer = 150;
    }

    function handleKeyDown(e) {
        if (document.activeElement.tagName === 'INPUT') return;

        // Si hay un combate activo, las teclas lo controlan
        if (gameState.battle && gameState.battle.active) {
            const k = e.key.toLowerCase();
            const b = gameState.battle;
            if (b.phase === 'menu') {
                if (k === 'arrowup' || k === 'w' || k === 'arrowdown' || k === 's') b.cursor ^= 2;
                else if (k === 'arrowleft' || k === 'a' || k === 'arrowright' || k === 'd') b.cursor ^= 1;
                else if (k === 'x') battleSelect();
            } else if (b.phase === 'moves') {
                const mvs = gameState.playerMon.moves || [];
                if (k === 'arrowup' || k === 'w') b.moveCursor = (b.moveCursor - 1 + mvs.length) % mvs.length;
                else if (k === 'arrowdown' || k === 's') b.moveCursor = (b.moveCursor + 1) % mvs.length;
                else if (k === 'x') moveAttack(b.moveCursor);
                else if (k === 'z') b.phase = 'menu';
            } else if (k === 'x') {
                battleAdvance();
            }
            e.preventDefault();
            return;
        }

        // Si el menú de la tienda está abierto, las teclas lo controlan a él
        if (gameState.shopOpen) {
            const k = e.key.toLowerCase();
            const n = gameState.shopItems.length;
            if (k === 'arrowup' || k === 'w') gameState.shopCursor = (gameState.shopCursor - 1 + n) % n;
            else if (k === 'arrowdown' || k === 's') gameState.shopCursor = (gameState.shopCursor + 1) % n;
            else if (k === 'x') shopBuy();
            else if (k === 'z') gameState.shopOpen = false;
            e.preventDefault();
            return;
        }

        // Menú START abierto: las teclas lo controlan
        if (gameState.menuOpen) {
            const k = e.key.toLowerCase();
            const n = menuListLen();
            if (k === 'arrowup' || k === 'w') gameState.menuCursor = (gameState.menuCursor - 1 + n) % n;
            else if (k === 'arrowdown' || k === 's') gameState.menuCursor = (gameState.menuCursor + 1) % n;
            else if (k === 'x') menuSelect();
            else if (k === 'z') menuBack();
            else if (k === 'enter') gameState.menuOpen = false;
            e.preventDefault();
            return;
        }
        // START (Enter) abre el menú
        if (e.key === 'Enter') { toggleMenu(); e.preventDefault(); return; }

        let keyMatched = true;
        switch(e.key.toLowerCase()) {
            case 'arrowup':
            case 'w':
                gameState.keys.up = true;
                break;
            case 'arrowdown':
            case 's':
                gameState.keys.down = true;
                break;
            case 'arrowleft':
            case 'a':
                gameState.keys.left = true;
                break;
            case 'arrowright':
            case 'd':
                gameState.keys.right = true;
                break;
            case 'x':
                if (!gameState.keys.a) {
                    gameState.keys.a = true;
                    handleButtonA();
                }
                break;
            case 'z':
                if (!gameState.keys.b) {
                    gameState.keys.b = true;
                    handleButtonB();
                }
                break;
            default:
                keyMatched = false;
        }
        
        if (keyMatched) {
            e.preventDefault();
        }
    }

    function handleKeyUp(e) {
        switch(e.key.toLowerCase()) {
            case 'arrowup':
            case 'w':
                gameState.keys.up = false;
                break;
            case 'arrowdown':
            case 's':
                gameState.keys.down = false;
                break;
            case 'arrowleft':
            case 'a':
                gameState.keys.left = false;
                break;
            case 'arrowright':
            case 'd':
                gameState.keys.right = false;
                break;
            case 'x':
                gameState.keys.a = false;
                break;
            case 'z':
                gameState.keys.b = false;
                break;
        }
    }

    function handleButtonA() {
        if (gameState.dialogue) {
            gameState.dialogue = null;
            return;
        }

        const gridPos = getGridPositionAhead();
        if (gridPos) {
            // ¿Hay un NPC caminante en el tile de enfrente? Hablar con él.
            if (gameState.currentMap === 'overworld' && gameState.npcs) {
                const npc = gameState.npcs.find(n =>
                    (n.col === gridPos.x && n.row === gridPos.y) ||
                    (n.tx != null && n.tx / 8 === gridPos.x && n.ty / 8 === gridPos.y));
                if (npc) {
                    if (npc.trainer && !npc.defeated) { startTrainerBattle(npc); return; }
                    triggerDialog(npc.defeated ? '¡Fue un buen combate!' : npc.dialogue);
                    return;
                }
            }

            const tileId = getTileAt(gridPos.x, gridPos.y);

            if (tileId === 18) { // Cofre
                if (gameState.hasKey) {
                    triggerDialog("¡Abriste el cofre! ¡Has ganado el juego!");
                    gameState.gameWon = true;
                    setTileAt(gridPos.x, gridPos.y, 24); // Abrir cofre
                } else {
                    triggerDialog("El cofre está cerrado. Encuentra la llave.");
                }
            } else if (tileId === 20) { // Llave / Moneda
                triggerDialog("¡Conseguiste el objeto!");
                gameState.hasKey = true;
                setTileAt(gridPos.x, gridPos.y, 16); // Borrar llave (poner suelo)
            } else if (tileId === 19) { // Puerta
                if (gameState.hasKey) {
                    triggerDialog("¡La puerta cerrada se abre!");
                    gameState.doorUnlocked = true;
                    setTileAt(gridPos.x, gridPos.y, 25); // Abrir puerta
                } else {
                    triggerDialog("Puerta sellada. Busca la llave.");
                }
            } else if (tileId === 21) { // NPC
                triggerDialog("Sabio: '¡El color le da vida a este mundo de 8 bits!'");
            } else if (tileId === 29) { // Cartel
                triggerDialog(gtext('sign_town', "CARTEL: Bienvenido a Pueblo Paleta. ¡Centro Pokemon a la izquierda!"));
            } else if (tileId === 49 || tileId === 50 || tileId === 51) { // Mostrador / Máquina / Enfermera
                if (gameState.currentMap === 'pokecenter') {
                    gameState.playerMon.hp = gameState.playerMon.maxhp; // Curación real
                    gameState.playerMon.status = null;                  // cura estados (veneno)
                    triggerDialog(gtext('nurse_heal', "Enfermera: ¡Tus POKEMON ya están totalmente curados!"));
                    gsfx('heal', 880, 0.1);
                    setTimeout(() => playBeep(1320, 0.15), 140);
                } else if (gameState.currentMap === 'pokemart') {
                    openShop(); // Abre el menú de compra
                } else {
                    triggerDialog(gtext('counter_empty', "No hay nadie en el mostrador."));
                }
            } else if (tileId === 52 || tileId === 53) { // Ordenador / Estantería
                triggerDialog(tileId === 52 ? gtext('pc_storage', "Es un PC de almacenamiento de POKEMON.") : gtext('shelf', "Estantería llena de Pociones y Poké Balls."));
            } else {
                triggerDialog("Botón A presionado.");
            }
        }
    }

    function handleButtonB() {
        triggerDialog("¡Ataque espada! *Chiptune SFX*");
        playBeep(600, 0.08);
    }

    function getGridPositionAhead() {
        const xPx = gameState.playerX - 8;
        const yPx = gameState.playerY - 16;
        const col = Math.floor((xPx + 4) / 8);
        const row = Math.floor((yPx + 8) / 8);
        
        const maxRow = aRows() - 1;
        const maxCol = aCols() - 1;
        if (gameState.keys.up) return { x: col, y: Math.max(0, row - 1) };
        if (gameState.keys.down) return { x: col, y: Math.min(maxRow, row + 1) };
        if (gameState.keys.left) return { x: Math.max(0, col - 1), y: row };
        if (gameState.keys.right) return { x: Math.min(maxCol, col + 1), y: row };

        return { x: col, y: Math.min(maxRow, row + 1) };
    }

    function getTileAt(col, row) {
        if (row < 0 || row >= aRows() || col < 0 || col >= aCols()) return 0;
        return gameState.tilemap[row][col];
    }

    function setTileAt(col, row, tileId) {
        if (row >= 0 && row < P().rows && col >= 0 && col < P().cols) {
            gameState.tilemap[row][col] = tileId;
            // En GBA se conserva la paleta del tile (los edificios usan paletas dedicadas)
            if (window.GBPlatform.mode === 'gba') {
                if (window.AppState && window.AppState.gameData) {
                    window.AppState.gameData.tilemap[row][col] = tileId;
                }
                return;
            }
            // Actualizar la paleta de este tile basándonos en el género actual
            if (window.AppState && window.AppState.gameData) {
                const genre = window.AppState.gameData.genre;
                // Si existe la función getPaletteIdForTile en el generador, mapear
                if (window.GBGenerator && typeof window.GBGenerator.generateGame === 'function') {
                    // Mapear tile id a atributo de color directamente en AppState
                    const palId = getLocalPaletteForTile(tileId, genre);
                    gameState.tilemapAttrs[row][col] = palId;
                    window.AppState.gameData.tilemapAttrs[row][col] = palId;
                }
            }
            if (window.MapEditor && typeof window.MapEditor.drawMap === 'function') {
                window.MapEditor.drawMap();
            }
        }
    }

    function getLocalPaletteForTile(tileId, genre) {
        if (genre === 'rpg') {
            if (tileId === 17) return 1;
            if (tileId === 18 || tileId === 24) return 2;
            if (tileId === 19 || tileId === 25) return 3;
            if (tileId === 20) return 5;
            if (tileId === 21) return 4;
            if (tileId === 23) return 4;
            return 0;
        } else if (genre === 'shooter') {
            if (tileId === 17) return 1;
            if (tileId === 18) return 2;
            if (tileId === 20) return 3;
            if (tileId === 19) return 4;
            return 0;
        } else if (genre === 'town') {
            if (tileId === 17) return 1;
            if (tileId === 18 || tileId === 24) return 2;
            if (tileId === 19 || tileId === 25) return 3;
            if (tileId === 20) return 5;
            if (tileId === 21) return 4;
            if (tileId === 22) return 6;
            if (tileId === 23) return 7;
            return 0;
        } else {
            if (tileId === 17) return 1;
            if (tileId === 20) return 2;
            if (tileId === 18) return 4;
            if (tileId === 19) return 3;
            return 0;
        }
    }

    function gameLoop() {
        if (!isRunning) return;

        // Un error transitorio (p. ej. durante un cambio de consola, cuando los assets
        // y las dimensiones aún no están sincronizados) no debe matar el bucle.
        try {
            updatePhysics();
            drawScreen();
        } catch (e) {
            // Se ignora un frame puntual; el siguiente se redibujará correctamente.
        }

        animationId = requestAnimationFrame(gameLoop);
    }

    function updatePhysics() {
        // Durante un combate, el mundo exterior se congela
        if (gameState.battle && gameState.battle.active) return;

        let nextX = gameState.playerX;
        let nextY = gameState.playerY;

        if (gameState.keys.up) nextY -= gameState.playerSpeed;
        if (gameState.keys.down) nextY += gameState.playerSpeed;
        if (gameState.keys.left) nextX -= gameState.playerSpeed;
        if (gameState.keys.right) nextX += gameState.playerSpeed;

        // Actualizar dirección a la que mira el jugador
        if (gameState.keys.up) gameState.facing = 'up';
        else if (gameState.keys.down) gameState.facing = 'down';
        else if (gameState.keys.left) gameState.facing = 'left';
        else if (gameState.keys.right) gameState.facing = 'right';

        if (nextX < 8) nextX = 8;
        if (nextX > aCols() * 8) nextX = aCols() * 8;
        if (nextY < 16) nextY = 16;
        if (nextY > aRows() * 8 + 8) nextY = aRows() * 8 + 8;

        const left = nextX - 8;
        const right = nextX - 1;
        const top = nextY - 16;
        const bottom = nextY - 9;

        const isSolid = (x, y) => {
            const col = Math.floor(x / 8);
            const row = Math.floor(y / 8);
            const tileId = getTileAt(col, row);
            if (window.GBPlatform.mode === 'gba') {
                // Los NPCs caminantes bloquean al jugador
                if (gameState.currentMap === 'overworld' && npcAtTile(col, row)) return true;
                // Las puertas-warp del exterior son transitables (entras al edificio)
                if (gameState.currentMap === 'overworld' && gameState.warps &&
                    gameState.warps.some(w => w.col === col && w.row === row)) {
                    return false;
                }
                // Sólidos del pueblo Pokémon: muros/techos/árboles/agua/puerta/NPC/cartel
                return GBA_SOLID_TILES.has(tileId);
            }
            return tileId === 17 || tileId === 19 || tileId === 21 || tileId >= 26;
        };

        let xCollision = false;
        if (gameState.keys.left || gameState.keys.right) {
            const checkX = gameState.keys.left ? left : right;
            if (isSolid(checkX, top + 1) || isSolid(checkX, bottom - 1)) {
                xCollision = true;
            }
        }
        if (!xCollision) {
            gameState.playerX = nextX;
        }

        let yCollision = false;
        if (gameState.keys.up || gameState.keys.down) {
            const checkY = gameState.keys.up ? top : bottom;
            if (isSolid(left + 1, checkY) || isSolid(right - 1, checkY)) {
                yCollision = true;
            }
        }
        if (!yCollision) {
            gameState.playerY = nextY;
        }

        // Encuentros con Pokémon salvajes en la hierba alta
        if (window.GBPlatform.mode === 'gba' && gameState.currentMap === 'overworld') {
            const pc = Math.floor((gameState.playerX - 4) / 8);
            const pr = Math.floor((gameState.playerY - 8) / 8);
            if (getTileAt(pc, pr) === 22) {
                const tkey = pc + ',' + pr;
                if (gameState.lastGrassTile !== tkey) {
                    gameState.lastGrassTile = tkey;
                    if (Math.random() < gBal('encounterRate', 0.18)) { startWildBattle(); return; }
                }
            } else {
                gameState.lastGrassTile = null;
            }
        }

        // Mover NPCs, entrenadores (línea de visión) y warps
        updateNpcs();
        checkTrainers();
        checkWarp();

        if (gameState.dialogue && gameState.dialogueTimer > 0) {
            gameState.dialogueTimer--;
            if (gameState.dialogueTimer === 0) {
                gameState.dialogue = null;
            }
        }
    }

    // ¿Hay un NPC en este tile? (excluye uno opcional)
    function npcAtTile(col, row, exclude) {
        if (!gameState.npcs) return false;
        return gameState.npcs.some(n => n !== exclude && (
            (n.col === col && n.row === row) ||
            (n.tx != null && n.tx / 8 === col && n.ty / 8 === row)
        ));
    }

    // Movimiento de NPCs: deambulan dentro de su rango, evitando sólidos, jugador y otros NPCs
    function updateNpcs() {
        if (gameState.currentMap !== 'overworld' || !gameState.npcs) return;
        const pcol = Math.floor((gameState.playerX - 4) / 8);
        const prow = Math.floor((gameState.playerY - 8) / 8);
        for (const n of gameState.npcs) {
            if (n.trainer) continue; // los entrenadores no deambulan
            if (n.tx != null) {
                // Avanzar 1px hacia el tile objetivo
                if (n.x < n.tx) n.x++; else if (n.x > n.tx) n.x--;
                if (n.y < n.ty) n.y++; else if (n.y > n.ty) n.y--;
                if (n.x === n.tx && n.y === n.ty) {
                    n.col = n.tx / 8; n.row = n.ty / 8; n.tx = null; n.ty = null;
                    n.timer = 30 + Math.floor(Math.random() * 60);
                }
            } else if (--n.timer <= 0) {
                const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
                const d = dirs[Math.floor(Math.random() * 4)];
                const nc = n.col + d[0], nr = n.row + d[1];
                if (Math.abs(nc - n.homeCol) <= n.range && Math.abs(nr - n.homeRow) <= n.range &&
                    !GBA_SOLID_TILES.has(getTileAt(nc, nr)) &&
                    !(nc === pcol && nr === prow) && !npcAtTile(nc, nr, n)) {
                    n.tx = nc * 8; n.ty = nr * 8;
                } else {
                    n.timer = 12;
                }
            }
        }
    }

    // Un entrenador no derrotado que vea al jugador en su línea de visión inicia combate
    function checkTrainers() {
        if (gameState.currentMap !== 'overworld' || !gameState.npcs) return;
        if (gameState.battle && gameState.battle.active) return;
        const pcol = Math.floor((gameState.playerX - 4) / 8);
        const prow = Math.floor((gameState.playerY - 8) / 8);
        for (const n of gameState.npcs) {
            if (!n.trainer || n.defeated) continue;
            const dir = n.dir || 'down';
            const dc = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
            const dr = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
            for (let s = 1; s <= (n.sight || 4); s++) {
                const cc = n.col + dc * s, rr = n.row + dr * s;
                if (cc < 0 || rr < 0 || cc >= aCols() || rr >= aRows()) break; // límites del MAPA activo (no de pantalla)
                if (GBA_SOLID_TILES.has(getTileAt(cc, rr))) break; // visión bloqueada
                if (cc === pcol && rr === prow) { startTrainerBattle(n); return; }
            }
        }
    }

    function startTrainerBattle(npc) {
        const mon = npc.team[0];
        gameState.battle = {
            active: true, phase: 'msg', next: 'menu', cursor: 0,
            enemy: { name: mon.name, hp: mon.maxhp, maxhp: mon.maxhp, type: mon.type, moves: mon.moves, pal: mon.pal || 'purple', sprite: mon.sprite },
            isTrainer: true, trainerNpc: npc, team: npc.team, teamIdx: 0, prize: npc.prize || 200,
            msg: (npc.name || 'ENTRENADOR') + ': ' + (npc.dialogue || '¡Te reto!')
        };
        gameState.pokedex.seen[mon.name] = true;
        resetKeys();
        gsfx('trainer', 330, 0.1);
    }

    // Tile sobre el que está parado el jugador (sus pies)
    function playerTilePos() {
        return {
            col: Math.floor((gameState.playerX - 4) / 8),
            row: Math.floor((gameState.playerY - 8) / 8)
        };
    }

    // Detecta y ejecuta warps según la posición del jugador
    function checkWarp() {
        if (window.GBPlatform.mode !== 'gba') return;
        const { col, row } = playerTilePos();
        const key = col + ',' + row;
        if (gameState.warpLock === key) return;   // seguimos en el tile de aparición
        gameState.warpLock = null;

        if (gameState.currentMap === 'overworld') {
            const w = gameState.warps && gameState.warps.find(w => w.col === col && w.row === row);
            if (w) goWarp(w);
        } else {
            const inter = gameState.interiors && gameState.interiors[gameState.currentMap];
            if (inter && inter.exit && inter.exit.col === col && inter.exit.row === row) {
                exitInterior();
            }
        }
    }

    // Enruta un warp: a un interior (Centro/Tienda) o a otra área overworld (Ruta 1)
    function goWarp(w) {
        if (gameState.interiors && gameState.interiors[w.target]) {
            enterInterior(w.target);
        } else if (gameState.maps && gameState.maps[w.target]) {
            switchArea(w.target, w.entry);
        }
    }

    // Cambia el mapa overworld activo (pueblo <-> Ruta 1)
    function switchArea(target, entry) {
        const m = gameState.maps[target];
        if (!m) return;
        gameState.tilemap = m.tilemap;
        gameState.tilemapAttrs = m.attrs;
        gameState.npcs = m.npcs;
        gameState.warps = m.warps;
        gameState.area = target;
        gameState.currentMap = 'overworld';
        setMapDims();
        const e = entry || { col: 15, row: 10 };
        gameState.playerX = e.col * 8 + 8;
        gameState.playerY = e.row * 8 + 8;
        gameState.warpLock = e.col + ',' + e.row;
    }

    function enterInterior(id) {
        const inter = gameState.interiors && gameState.interiors[id];
        if (!inter) return;
        gameState.savedOverworld = { tilemap: gameState.tilemap, tilemapAttrs: gameState.tilemapAttrs };
        gameState.tilemap = inter.tilemap;
        gameState.tilemapAttrs = inter.attrs;
        setMapDims();
        gameState.currentMap = id;
        gameState.playerX = inter.entry.col * 8 + 8;
        gameState.playerY = inter.entry.row * 8 + 8;
        gameState.warpLock = inter.entry.col + ',' + inter.entry.row;
        triggerDialog(gtext('interior_welcome', "CENTRO POKEMON: ¡Bienvenido! Pisa el felpudo para salir."));
    }

    // ---- Tienda (Poké Mart) ----
    function openShop() {
        // Precios desde GAME.md (window.GAME.ECONOMY.prices), con fallback
        const _prices = (window.GAME && window.GAME.ECONOMY && window.GAME.ECONOMY.prices) ||
            { 'POCION': 300, 'SUPER POCION': 700, 'POKE BALL': 200, 'ANTIDOTO': 100 };
        gameState.shopItems = Object.keys(_prices).map(n => ({ name: n, price: _prices[n] }));
        gameState.shopItems.push({ name: 'SALIR', exit: true });
        gameState.shopCursor = 0;
        gameState.shopMsg = 'Elige con flechas, compra con A.';
        gameState.shopOpen = true;
        resetKeys();
    }

    function shopBuy() {
        const it = gameState.shopItems[gameState.shopCursor];
        if (!it) return;
        if (it.exit) { gameState.shopOpen = false; return; }
        if (gameState.money >= it.price) {
            gameState.money -= it.price;
            gameState.inventory[it.name] = (gameState.inventory[it.name] || 0) + 1;
            gameState.shopMsg = 'Has comprado ' + it.name + '!';
            gsfx('buy', 880, 0.08);
        } else {
            gameState.shopMsg = 'No tienes suficiente dinero.';
            playBeep(180, 0.12);
        }
    }

    function exitInterior() {
        const inter = gameState.interiors && gameState.interiors[gameState.currentMap];
        const m = gameState.maps && gameState.maps[gameState.area];
        if (m) {
            gameState.tilemap = m.tilemap; gameState.tilemapAttrs = m.attrs;
            gameState.npcs = m.npcs; gameState.warps = m.warps;
        } else if (gameState.savedOverworld) {
            gameState.tilemap = gameState.savedOverworld.tilemap;
            gameState.tilemapAttrs = gameState.savedOverworld.tilemapAttrs;
        }
        setMapDims();
        gameState.currentMap = 'overworld';
        if (inter) {
            gameState.playerX = inter.returnCol * 8 + 8;
            gameState.playerY = inter.returnRow * 8 + 8;
            gameState.warpLock = inter.returnCol + ',' + inter.returnRow;
        }
    }

    // ====================================================
    // FUENTE DE MAPA DE BITS 3x5 (estilo Game Boy)
    // Cada glifo se dibuja pixel a pixel sobre el canvas nativo (160x144),
    // así el texto queda perfectamente nítido al escalar (sin desenfoque).
    // ====================================================
    const FONT_3x5 = {
        ' ': ['...','...','...','...','...'],
        'A': ['.#.','#.#','###','#.#','#.#'],
        'B': ['##.','#.#','##.','#.#','##.'],
        'C': ['.##','#..','#..','#..','.##'],
        'D': ['##.','#.#','#.#','#.#','##.'],
        'E': ['###','#..','##.','#..','###'],
        'F': ['###','#..','##.','#..','#..'],
        'G': ['.##','#..','#.#','#.#','.##'],
        'H': ['#.#','#.#','###','#.#','#.#'],
        'I': ['###','.#.','.#.','.#.','###'],
        'J': ['..#','..#','..#','#.#','.#.'],
        'K': ['#.#','#.#','##.','#.#','#.#'],
        'L': ['#..','#..','#..','#..','###'],
        'M': ['#.#','###','###','#.#','#.#'],
        'N': ['#.#','##.','#.#','#.#','#.#'],
        'O': ['.#.','#.#','#.#','#.#','.#.'],
        'P': ['##.','#.#','##.','#..','#..'],
        'Q': ['.#.','#.#','#.#','.#.','..#'],
        'R': ['##.','#.#','##.','#.#','#.#'],
        'S': ['.##','#..','.#.','..#','##.'],
        'T': ['###','.#.','.#.','.#.','.#.'],
        'U': ['#.#','#.#','#.#','#.#','###'],
        'V': ['#.#','#.#','#.#','#.#','.#.'],
        'W': ['#.#','#.#','###','###','#.#'],
        'X': ['#.#','#.#','.#.','#.#','#.#'],
        'Y': ['#.#','#.#','.#.','.#.','.#.'],
        'Z': ['###','..#','.#.','#..','###'],
        '0': ['.#.','#.#','#.#','#.#','.#.'],
        '1': ['.#.','##.','.#.','.#.','###'],
        '2': ['##.','..#','.#.','#..','###'],
        '3': ['##.','..#','.#.','..#','##.'],
        '4': ['#.#','#.#','###','..#','..#'],
        '5': ['###','#..','##.','..#','##.'],
        '6': ['.##','#..','##.','#.#','.#.'],
        '7': ['###','..#','.#.','.#.','.#.'],
        '8': ['.#.','#.#','.#.','#.#','.#.'],
        '9': ['.#.','#.#','.##','..#','##.'],
        '!': ['.#.','.#.','.#.','...','.#.'],
        '¡': ['.#.','...','.#.','.#.','.#.'],
        '?': ['##.','..#','.#.','...','.#.'],
        '¿': ['.#.','...','.#.','#..','.##'],
        '.': ['...','...','...','...','.#.'],
        ',': ['...','...','...','.#.','#..'],
        ':': ['...','.#.','...','.#.','...'],
        "'": ['.#.','.#.','...','...','...'],
        '-': ['...','...','###','...','...'],
        '(': ['.#.','#..','#..','#..','.#.'],
        ')': ['.#.','..#','..#','..#','.#.']
    };

    // Normaliza a mayúsculas y quita acentos (la fuente no incluye tildes)
    function normalizeFontText(s) {
        return (s || '').toUpperCase()
            .replace(/[ÁÀÄÂ]/g, 'A').replace(/[ÉÈËÊ]/g, 'E')
            .replace(/[ÍÌÏÎ]/g, 'I').replace(/[ÓÒÖÔ]/g, 'O')
            .replace(/[ÚÙÜÛ]/g, 'U').replace(/Ñ/g, 'N');
    }

    // Ancho en píxeles de una cadena renderizada (3px glifo + 1px de separación)
    function pixelTextWidth(text, scale) {
        const len = normalizeFontText(text).length;
        return len > 0 ? (len * 4 * scale - scale) : 0;
    }

    // Dibuja texto con la fuente de mapa de bits, alineado al pixel
    function drawPixelText(text, x, y, scale, colorCss) {
        ctx.fillStyle = colorCss;
        const t = normalizeFontText(text);
        let cx = x;
        for (const ch of t) {
            const glyph = FONT_3x5[ch];
            if (glyph) {
                for (let r = 0; r < 5; r++) {
                    const row = glyph[r];
                    for (let c = 0; c < 3; c++) {
                        if (row[c] === '#') {
                            ctx.fillRect(cx + c * scale, y + r * scale, scale, scale);
                        }
                    }
                }
            }
            cx += 4 * scale; // 3px de glifo + 1px de separación
        }
    }

    // Texto centrado horizontalmente respecto a centerX
    function drawPixelTextCentered(text, centerX, y, scale, colorCss) {
        const w = pixelTextWidth(text, scale);
        drawPixelText(text, Math.round(centerX - w / 2), y, scale, colorCss);
    }

    // Ajuste de línea por palabras a un máximo de caracteres
    function wrapPixelText(text, maxChars) {
        const words = (text || '').split(' ');
        const lines = [];
        let cur = '';
        for (const w of words) {
            if (cur.length === 0) {
                cur = w;
            } else if ((cur + ' ' + w).length <= maxChars) {
                cur += ' ' + w;
            } else {
                lines.push(cur);
                cur = w;
            }
        }
        if (cur) lines.push(cur);
        return lines;
    }

    // Convierte color GBC [R, G, B] (escala 0-31) a cadena de color CSS RGB [0-255]
    function gbcColorToCss(colorArr) {
        if (!colorArr) return 'rgb(255,255,255)';
        const r = Math.floor((colorArr[0] & 31) * 255 / 31);
        const g = Math.floor((colorArr[1] & 31) * 255 / 31);
        const b = Math.floor((colorArr[2] & 31) * 255 / 31);
        return `rgb(${r}, ${g}, ${b})`;
    }

    function drawScreen() {
        // Si hay un combate activo, la pantalla de batalla toma el control
        if (gameState.battle && gameState.battle.active) { drawBattle(); return; }

        // Limpiar pantalla con el color de fondo por defecto (Color 0 de la Paleta 0 de GBC)
        const SW = P().screenW, SH = P().screenH;
        const bgClearColor = gbcColorToCss(gameState.bgPalettes[0] ? gameState.bgPalettes[0][0] : [31,31,31]);
        ctx.fillStyle = bgClearColor;
        ctx.fillRect(0, 0, SW, SH);

        // Cámara: centrada en el jugador, fijada a los límites del mapa (no muestra fuera del mapa).
        const mapW = aCols() * 8, mapH = aRows() * 8;
        let camX = Math.round(gameState.playerX - SW / 2);
        let camY = Math.round(gameState.playerY - SH / 2);
        camX = Math.max(0, Math.min(camX, Math.max(0, mapW - SW)));
        camY = Math.max(0, Math.min(camY, Math.max(0, mapH - SH)));
        gameState.camX = camX; gameState.camY = camY;

        // 1. Dibujar solo los tiles visibles (ventana de la cámara)
        if (gameState.tilemap && gameState.tilemap.length > 0) {
            const c0 = Math.max(0, Math.floor(camX / 8)), c1 = Math.min(aCols() - 1, Math.floor((camX + SW) / 8));
            const r0 = Math.max(0, Math.floor(camY / 8)), r1 = Math.min(aRows() - 1, Math.floor((camY + SH) / 8));
            for (let r = r0; r <= r1; r++) {
                const row = gameState.tilemap[r];
                if (!row) continue;
                for (let c = c0; c <= c1 && c < row.length; c++) {
                    const tileId = row[c];
                    const palIdx = (gameState.tilemapAttrs[r] && gameState.tilemapAttrs[r][c] !== undefined)
                        ? gameState.tilemapAttrs[r][c] : 0;
                    const tilePixels = (tileId >= 16) ? gameState.bgTiles[tileId - 16] : gameState.sprites[tileId];
                    if (tilePixels) drawGbcTile(tilePixels, c * 8 - camX, r * 8 - camY, palIdx);
                }
            }
        }

        // 1.5 Dibujar NPCs caminantes (solo en el exterior), con su sombra
        if (gameState.currentMap === 'overworld' && gameState.npcs) {
            for (const n of gameState.npcs) {
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.beginPath();
                ctx.ellipse(Math.round(n.x + 4 - camX), Math.round(n.y + 4 - camY), 5, 2, 0, 0, Math.PI * 2);
                ctx.fill();
                drawGbcSprite(n.sprite, Math.round(n.x - 4 - camX), Math.round(n.y - 12 - camY), n.pal);
            }
        }

        // 2. Dibujar Sprite del Jugador (Paleta de Sprites 0) con offset de cámara
        const drawX = Math.round(gameState.playerX - 12 - camX);
        const drawY = Math.round(gameState.playerY - 20 - camY);
        const moving = gameState.keys.up || gameState.keys.down || gameState.keys.left || gameState.keys.right;

        if (gameState.playerAnim) {
            // 4 direcciones con animación de caminar
            if (moving) gameState.walkTimer++; else gameState.walkTimer = 0;
            const frame = (moving && Math.floor(gameState.walkTimer / 8) % 2 === 1) ? 1 : 0;
            const f = gameState.facing;
            const set = (f === 'up') ? gameState.playerAnim.up
                      : (f === 'down') ? gameState.playerAnim.down
                      : gameState.playerAnim.side; // left/right usan 'side'
            const spr = set[frame];
            const flip = (f === 'right'); // 'side' mira a la izquierda; se voltea para la derecha

            // Sombra bajo el personaje
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.beginPath();
            ctx.ellipse(Math.round(gameState.playerX - 4 - camX), Math.round(gameState.playerY - 6 - camY), 6, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();

            drawGbcSprite(spr, drawX, drawY, 0, flip);
        } else if (gameState.playerSprite) {
            let spr = gameState.playerSprite;
            if (gameState.playerSpriteWalk && moving) {
                gameState.walkTimer++;
                if (Math.floor(gameState.walkTimer / 8) % 2 === 1) spr = gameState.playerSpriteWalk;
            } else {
                gameState.walkTimer = 0;
            }
            drawGbcSprite(spr, drawX, drawY, 0);
        } else {
            const playerPixels = gameState.sprites[gameState.playerTile];
            if (playerPixels) {
                drawGbcSprite(playerPixels, Math.round(gameState.playerX - 8 - camX), Math.round(gameState.playerY - 16 - camY), 0);
            }
        }

        // 3. Dibujar Mensaje de Diálogo
        if (gameState.dialogue) {
            // Fondo cuadro de diálogo (Color 0 de Paleta 0)
            const textBgColor = gbcColorToCss(gameState.bgPalettes[0] ? gameState.bgPalettes[0][0] : [31,31,31]);
            const borderDarkColor = gbcColorToCss(gameState.bgPalettes[0] ? gameState.bgPalettes[0][3] : [0,0,0]);
            const borderLightColor = gbcColorToCss(gameState.bgPalettes[0] ? gameState.bgPalettes[0][1] : [20,20,20]);

            // Cuadro de diálogo dimensionado a la pantalla activa (GBC/GBA)
            const boxX = 8;
            const boxW = P().screenW - 16;
            const boxH = 34;
            const boxY = P().screenH - boxH - 4;

            ctx.fillStyle = textBgColor;
            ctx.fillRect(boxX, boxY, boxW, boxH);

            ctx.strokeStyle = borderDarkColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(boxX + 1, boxY + 1, boxW - 2, boxH - 2);

            ctx.strokeStyle = borderLightColor;
            ctx.strokeRect(boxX + 3, boxY + 3, boxW - 6, boxH - 6);

            // Texto con fuente de mapa de bits (nítido) y ajuste de línea por palabras
            const maxChars = Math.floor((boxW - 14) / 4);
            const lines = wrapPixelText(gameState.dialogue, maxChars);
            const maxLines = 3;
            for (let i = 0; i < lines.length && i < maxLines; i++) {
                drawPixelText(lines[i], boxX + 7, boxY + 6 + i * 7, 1, borderDarkColor);
            }
        }
        
        // 4. Pantalla de Victoria
        if (gameState.gameWon) {
            // Fondo verde semi-transparente
            ctx.fillStyle = 'rgba(15, 56, 15, 0.85)';
            ctx.fillRect(0, 0, P().screenW, P().screenH);
            const cx = P().screenW / 2;
            const cy = P().screenH / 2;
            const title = P().mode === 'gba' ? "VICTORIA GBA" : "VICTORIA GBC";
            drawPixelTextCentered(title, cx, cy - 22, 2, '#ffffff');
            drawPixelTextCentered("HAS GANADO EN COLOR", cx, cy + 6, 1, '#cfe8a0');
            drawPixelTextCentered("SELECT PARA REINICIAR", cx, cy + 20, 1, '#cfe8a0');
        }

        // 5. Menú de la Tienda (Poké Mart)
        if (gameState.shopOpen) {
            const bx = 14, by = 12, bw = P().screenW - 28, bh = P().screenH - 24;
            ctx.fillStyle = 'rgba(248,248,248,0.97)';
            ctx.fillRect(bx, by, bw, bh);
            ctx.strokeStyle = '#303030'; ctx.lineWidth = 2;
            ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
            ctx.strokeStyle = '#8090a0'; ctx.lineWidth = 1;
            ctx.strokeRect(bx + 4, by + 4, bw - 8, bh - 8);

            drawPixelText('TIENDA', bx + 8, by + 8, 1, '#203060');
            drawPixelText('DINERO ' + gameState.money, bx + bw - 90, by + 8, 1, '#206020');

            for (let i = 0; i < gameState.shopItems.length; i++) {
                const it = gameState.shopItems[i];
                const ly = by + 22 + i * 9;
                if (i === gameState.shopCursor) drawPixelText('>', bx + 8, ly, 1, '#d03030');
                drawPixelText(it.name, bx + 16, ly, 1, '#202020');
                if (it.price != null) drawPixelText('' + it.price, bx + bw - 40, ly, 1, '#202020');
            }
            if (gameState.shopMsg) drawPixelText(gameState.shopMsg, bx + 8, by + bh - 12, 1, '#404040');
        }

        // 6. Menú START (equipo / mochila / datos)
        if (gameState.menuOpen) drawMenu();
    }

    function drawMenu() {
        const W = P().screenW, H = P().screenH;
        const v = gameState.menuView;
        if (v === 'main') {
            const bw = 92, bx = W - bw - 6, by = 6;
            drawBattleBox(bx, by, bw, 70);
            MENU_MAIN.forEach((o, i) => {
                const oy = by + 7 + i * 10;
                if (i === gameState.menuCursor) drawPixelText('>', bx + 6, oy, 1, '#d03030');
                drawPixelText(o, bx + 14, oy, 1, '#202020');
            });
            if (gameState.menuMsg) drawPixelText(gameState.menuMsg, 8, H - 12, 1, '#306030');
            return;
        }
        drawBattleBox(8, 8, W - 16, H - 16);
        if (v === 'pokemon') {
            drawPixelText('POKEMON', 16, 14, 1, '#203060');
            const list = [gameState.playerMon].concat(gameState.party);
            list.forEach((m, i) => {
                const ly = 28 + i * 13;
                if (i === gameState.menuCursor) drawPixelText('>', 14, ly, 1, '#d03030');
                drawPixelText(m.name + ' Nv' + (m.level || 5), 22, ly, 1, '#202020');
                drawPixelText('PS ' + m.hp + '/' + m.maxhp, W - 96, ly, 1, '#206020');
            });
            if (gameState.menuMsg) drawPixelText(gameState.menuMsg, 16, H - 28, 1, '#306030');
            drawPixelText('(A) Elegir  (B) Volver', 16, H - 16, 1, '#808080');
            return;
        } else if (v === 'bag') {
            drawPixelText('MOCHILA', 16, 14, 1, '#603020');
            const items = bagList();
            if (!items.length) drawPixelText('Vacia.', 22, 30, 1, '#404040');
            items.forEach((it, i) => {
                const ly = 28 + i * 12;
                if (i === gameState.menuCursor) drawPixelText('>', 14, ly, 1, '#d03030');
                drawPixelText(it.name, 22, ly, 1, '#202020');
                drawPixelText('x' + it.count, W - 64, ly, 1, '#202020');
            });
            if (gameState.menuMsg) drawPixelText(gameState.menuMsg, 16, H - 28, 1, '#306030');
            drawPixelText('(A) Usar   (B) Volver', 16, H - 16, 1, '#808080');
            return;
        } else if (v === 'pokedex') {
            drawPixelText('POKEDEX', 16, 14, 1, '#902020');
            const dex = (window.GAME && window.GAME.SPECIES) ? Object.keys(window.GAME.SPECIES)
                : ['HOJITA', 'HOJABLOOM', 'RATAGON', 'PIDGY', 'ORUGUI', 'EMBRA', 'GOTIN'];
            let seen = 0, caught = 0;
            dex.forEach((sp, i) => {
                const isCaught = !!gameState.pokedex.caught[sp];
                const isSeen = isCaught || !!gameState.pokedex.seen[sp];
                if (isSeen) seen++;
                if (isCaught) caught++;
                const ly = 26 + i * 12;
                drawPixelText((i + 1 < 10 ? '00' : '0') + (i + 1), 16, ly, 1, '#707070');
                drawPixelText(isSeen ? sp : '?????', 40, ly, 1, '#202020');
                drawPixelText(isCaught ? 'CAPTURADO' : (isSeen ? 'VISTO' : '-----'), W - 90, ly, 1, isCaught ? '#208020' : '#909090');
            });
            drawPixelText('Vistos ' + seen + '   Capturados ' + caught, 16, H - 16, 1, '#404040');
            return;
        } else if (v === 'player') {
            drawPixelText('JUGADOR', 16, 14, 1, '#203060');
            drawPixelText('Dinero: ' + gameState.money, 22, 32, 1, '#206020');
            drawPixelText('Capturados: ' + gameState.party.length, 22, 44, 1, '#202020');
            drawPixelText(gameState.playerMon.name + '  Nv' + gameState.playerMon.level, 22, 56, 1, '#202020');
            drawPixelText('PS ' + gameState.playerMon.hp + '/' + gameState.playerMon.maxhp, 22, 68, 1, '#206020');
        }
        drawPixelText('(B) Volver', 16, H - 16, 1, '#808080');
    }

    // Dibuja un tile GBC opaco aplicando una paleta de fondo
    function drawGbcTile(tilePixels, screenX, screenY, palIdx) {
        const palette = gameState.bgPalettes[palIdx] || [[31,31,31], [20,20,20], [10,10,10], [0,0,0]];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const colorIndex = tilePixels[r][c];
                ctx.fillStyle = gbcColorToCss(palette[colorIndex]);
                ctx.fillRect(screenX + c, screenY + r, 1, 1);
            }
        }
    }

    // Dibuja un sprite aplicando una paleta de sprites con transparencia (Color 0 = transparente).
    // Soporta cualquier tamaño de matriz (8x8 en GBC, 16x16 en GBA) y volteo horizontal.
    function drawGbcSprite(tilePixels, screenX, screenY, palIdx, flipH) {
        const palette = gameState.spritePalettes[palIdx] || [[31,31,31], [20,20,20], [10,10,10], [0,0,0]];
        for (let r = 0; r < tilePixels.length; r++) {
            const w = tilePixels[r].length;
            for (let c = 0; c < w; c++) {
                const colorIndex = tilePixels[r][c];
                if (colorIndex > 0) { // Color 0 es transparente para sprites en hardware
                    ctx.fillStyle = gbcColorToCss(palette[colorIndex]);
                    const dc = flipH ? (w - 1 - c) : c;
                    ctx.fillRect(screenX + dc, screenY + r, 1, 1);
                }
            }
        }
    }

    // ====================================================
    // SISTEMA DE COMBATE POKÉMON
    // ====================================================
    // Tabla de tipos: multiplicador de daño (atacante -> defensor)
    // Fuente: GAME.md (vía game-data.generated.js -> window.GAME). Fallback hardcodeado.
    const TYPE_CHART = (window.GAME && window.GAME.TYPE_CHART) || {
        PLANTA: { AGUA: 2, FUEGO: 0.5, PLANTA: 0.5 },
        FUEGO:  { PLANTA: 2, AGUA: 0.5, FUEGO: 0.5 },
        AGUA:   { FUEGO: 2, PLANTA: 0.5, AGUA: 0.5 },
        NORMAL: {}
    };
    function effectiveness(atk, def) {
        return (TYPE_CHART[atk] && TYPE_CHART[atk][def]) || 1;
    }

    const WILD_LIST = (window.GAME && window.GAME.WILD_LIST) || [
        { name: 'RATAGON', maxhp: 16, pal: 'purple', type: 'NORMAL', moves: [{ name: 'ATAQUE RAPIDO', type: 'NORMAL', power: 5 }] },
        { name: 'PIDGY',   maxhp: 14, pal: 'brown',  type: 'NORMAL', moves: [{ name: 'PICOTAZO', type: 'NORMAL', power: 5 }] },
        { name: 'ORUGUI',  maxhp: 12, pal: 'green',  type: 'PLANTA', moves: [{ name: 'HOJA', type: 'PLANTA', power: 6 }] },
        { name: 'EMBRA',   maxhp: 15, pal: 'red',    type: 'FUEGO',  moves: [{ name: 'ASCUAS', type: 'FUEGO', power: 6 }] },
        { name: 'GOTIN',   maxhp: 15, pal: 'blue',   type: 'AGUA',   moves: [{ name: 'BURBUJA', type: 'AGUA', power: 6 }] }
    ];
    // Evoluciones (fuente: GAME.md -> window.GAME.EVOLUTIONS). Fallback hardcodeado.
    const EVOLUTIONS = (window.GAME && window.GAME.EVOLUTIONS) || {
        HOJITA: { into: 'HOJABLOOM', level: 8, maxhp: 30, type: 'PLANTA',
                  moves: [{ name: 'PLACAJE', type: 'NORMAL', power: 5 }, { name: 'HOJA AFILADA', type: 'PLANTA', power: 10 }] }
    };

    const MON_PALS = {
        purple: [null, [1,1,1], [18,8,24], [26,14,31], [31,26,28], [31,31,31], [2,2,2], [31,12,18]],
        brown:  [null, [1,1,1], [18,12,5], [26,19,10], [31,28,20], [31,31,31], [2,2,2], [28,8,4]],
        green:  [null, [1,1,1], [6,18,6], [12,26,10], [26,28,14], [31,31,31], [2,2,2], [28,22,6]],
        red:    [null, [1,1,1], [24,6,4], [31,14,6], [31,24,12], [31,31,31], [2,2,2], [31,20,8]],
        blue:   [null, [1,1,1], [4,10,24], [8,18,30], [16,26,31], [31,31,31], [2,2,2], [14,24,31]],
        playermon: [null, [1,1,1], [6,18,6], [12,26,10], [26,22,6], [20,28,14]]
    };
    // Sprite genérico de bicho salvaje 16x16 (fuente: GAME.md -> window.GAME.SPRITES.generic; fallback).
    const MON_SPRITE = (window.GAME && window.GAME.SPRITES && window.GAME.SPRITES.generic) || [
        [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
        [0,0,0,1,3,3,3,3,3,3,1,0,0,0,0,0],
        [0,0,1,3,3,2,2,2,2,3,3,1,0,0,0,0],
        [0,1,3,2,2,2,2,2,2,2,2,3,1,0,0,0],
        [0,1,3,2,5,6,2,2,6,5,2,3,1,0,0,0],
        [0,1,3,2,2,2,7,7,2,2,2,3,1,0,0,0],
        [0,1,3,3,2,4,4,4,4,2,3,3,1,0,0,0],
        [0,0,1,3,4,4,4,4,4,4,3,1,0,0,0,0],
        [0,0,1,2,4,4,4,4,4,4,2,1,0,0,0,0],
        [0,0,1,2,2,4,4,4,4,2,2,1,0,0,0,0],
        [0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0],
        [0,0,0,1,2,1,0,0,1,2,1,0,0,0,0,0],
        [0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ];
    // Pokémon del jugador, vista de espaldas 16x16 (fuente: GAME.md; fallback)
    const PLAYERMON_SPRITE = (window.GAME && window.GAME.SPRITES && window.GAME.SPRITES.playermon) || [
        [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
        [0,0,0,0,1,3,3,3,3,3,1,0,0,0,0,0],
        [0,0,0,1,3,3,2,2,3,3,3,1,0,0,0,0],
        [0,0,1,3,2,2,2,2,2,2,3,3,1,0,0,0],
        [0,1,3,2,2,4,2,2,4,2,2,3,1,0,0,0],
        [0,1,2,2,4,2,2,2,2,4,2,2,1,0,0,0],
        [0,1,2,2,2,2,2,2,2,2,2,2,1,0,0,0],
        [0,1,2,2,2,2,2,2,2,2,2,2,1,0,0,0],
        [0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,0],
        [0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,0],
        [0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0],
        [0,0,0,1,2,1,0,0,1,2,1,0,0,0,0,0],
        [0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ];

    // Devuelve la matriz del sprite por nombre (GAME.md) o el genérico
    function monSprite(name) {
        return (window.GAME && window.GAME.SPRITES && window.GAME.SPRITES[name]) || MON_SPRITE;
    }

    // Lista de encuentros del área actual (window.GAME.ENCOUNTERS) o la global como fallback
    function encounterList() {
        const enc = window.GAME && window.GAME.ENCOUNTERS;
        const list = enc && enc[gameState.area];
        return (list && list.length) ? list : WILD_LIST;
    }

    function startWildBattle() {
        const list = encounterList();
        const w = list[Math.floor(Math.random() * list.length)];
        gameState.battle = {
            active: true,
            phase: 'menu',           // menu | msg | win | lose | run
            cursor: 0,               // 0 = LUCHA, 1 = HUIR
            enemy: { name: w.name, hp: w.maxhp, maxhp: w.maxhp, pal: w.pal, sprite: w.sprite, type: w.type, moves: w.moves },
            msg: '¡Un ' + w.name + ' salvaje (' + w.type + ') apareció!'
        };
        gameState.pokedex.seen[w.name] = true; // registrar en el Pokédex
        gameState.battle.phase = 'msg';
        gameState.battle.next = 'menu';
        resetKeys();
        gsfx('encounter', 440, 0.08);
    }

    // Avanza el combate al pulsar A
    function battleAdvance() {
        const b = gameState.battle;
        if (!b.active) return;
        if (b.phase === 'msg') {
            b.phase = b.next || 'menu';
            if (b.phase === 'enemyturn') battleEnemyTurn();
            return;
        }
        if (b.phase === 'win' || b.phase === 'lose' || b.phase === 'run' || b.phase === 'caught') {
            endBattle(b.phase);
            return;
        }
    }

    // ---- Pociones / Mochila ----
    function bagList() {
        return Object.keys(gameState.inventory)
            .filter(k => gameState.inventory[k] > 0)
            .map(k => ({ name: k, count: gameState.inventory[k] }));
    }

    // Catálogo de ítems desde GAME.md (window.GAME.ITEMS) con fallback
    function itemDef(name) {
        const it = window.GAME && window.GAME.ITEMS && window.GAME.ITEMS[name];
        if (it) return it;
        const FB = {
            'POCION': { effect: 'heal', amount: 20 }, 'SUPER POCION': { effect: 'heal', amount: 50 },
            'ANTIDOTO': { effect: 'cure', cures: 'poison' }, 'POKE BALL': { effect: 'catch' }
        };
        return FB[name] || {};
    }

    // Usa un ítem de la mochila según su `effect` declarado en GAME.md (heal | cure | catch)
    function useItem(name) {
        if ((gameState.inventory[name] || 0) <= 0) return 'No tienes ' + name + '.';
        const def = itemDef(name), mon = gameState.playerMon;
        if (def.effect === 'heal') {
            if (mon.hp >= mon.maxhp) return 'Los PS ya están al máximo.';
            gameState.inventory[name]--;
            mon.hp = Math.min(mon.maxhp, mon.hp + (def.amount || 20));
            playBeep(660, 0.08);
            return '¡' + mon.name + ' recuperó PS!';
        }
        if (def.effect === 'cure') {
            const st = def.cures || 'poison';
            if (mon.status !== st) return mon.name + ' no lo necesita.';
            gameState.inventory[name]--;
            mon.status = null;
            playBeep(660, 0.08);
            return '¡' + mon.name + ' curado!';
        }
        return name + ': no se puede usar aquí.';
    }

    // Envoltorios por compatibilidad (combate y menú llaman a estos)
    function useAntidote() { return useItem('ANTIDOTO'); }
    function usePotion() { return useItem('POCION'); }

    // ---- Menú START ----
    function toggleMenu() {
        if (gameState.battle && gameState.battle.active) return;
        if (gameState.shopOpen) return;
        gameState.menuOpen = !gameState.menuOpen;
        gameState.menuView = 'main';
        gameState.menuCursor = 0;
        gameState.menuMsg = '';
        if (gameState.menuOpen) resetKeys();
    }

    const MENU_MAIN = ['POKEMON', 'MOCHILA', 'POKEDEX', 'JUGADOR', 'GUARDAR', 'CARGAR', 'SALIR'];

    function menuListLen() {
        if (gameState.menuView === 'main') return MENU_MAIN.length;
        if (gameState.menuView === 'pokemon') return 1 + gameState.party.length;
        if (gameState.menuView === 'bag') return Math.max(1, bagList().length);
        return 1;
    }

    function saveGame() {
        try {
            localStorage.setItem('gbaPokeSave', JSON.stringify({
                money: gameState.money, inventory: gameState.inventory,
                playerMon: gameState.playerMon, party: gameState.party,
                pokedex: gameState.pokedex,
                x: gameState.playerX, y: gameState.playerY
            }));
            return 'Partida guardada.';
        } catch (e) { return 'No se pudo guardar.'; }
    }

    function loadGame() {
        try {
            const raw = localStorage.getItem('gbaPokeSave');
            if (!raw) return 'No hay partida guardada.';
            const d = JSON.parse(raw);
            gameState.money = d.money;
            gameState.inventory = d.inventory || {};
            gameState.playerMon = d.playerMon;
            gameState.party = d.party || [];
            gameState.pokedex = d.pokedex || { seen: {}, caught: {} };
            gameState.playerX = d.x; gameState.playerY = d.y;
            return 'Partida cargada.';
        } catch (e) { return 'No se pudo cargar.'; }
    }

    function menuSelect() {
        const v = gameState.menuView, c = gameState.menuCursor;
        if (v === 'main') {
            if (c === 0) { gameState.menuView = 'pokemon'; gameState.menuCursor = 0; gameState.menuMsg = ''; }
            else if (c === 1) { gameState.menuView = 'bag'; gameState.menuCursor = 0; gameState.menuMsg = ''; }
            else if (c === 2) { gameState.menuView = 'pokedex'; gameState.menuCursor = 0; gameState.menuMsg = ''; }
            else if (c === 3) { gameState.menuView = 'player'; gameState.menuCursor = 0; gameState.menuMsg = ''; }
            else if (c === 4) gameState.menuMsg = saveGame();
            else if (c === 5) gameState.menuMsg = loadGame();
            else gameState.menuOpen = false;
        } else if (v === 'bag') {
            const items = bagList();
            const it = items[c];
            if (it) gameState.menuMsg = useItem(it.name);
        } else if (v === 'pokemon') {
            if (c === 0) {
                gameState.menuMsg = gameState.playerMon.name + ' ya está activo.';
            } else if (gameState.party[c - 1] && gameState.party[c - 1].hp > 0) {
                const tmp = gameState.playerMon;
                gameState.playerMon = gameState.party[c - 1];
                gameState.party[c - 1] = tmp;
                gameState.menuMsg = '¡Adelante, ' + gameState.playerMon.name + '!';
            } else {
                gameState.menuMsg = 'Está debilitado.';
            }
        }
    }

    function menuBack() {
        if (gameState.menuView === 'main') { gameState.menuOpen = false; return; }
        gameState.menuView = 'main';
        gameState.menuCursor = 0;
        gameState.menuMsg = '';
    }

    // Sube experiencia y de nivel al Pokémon del jugador
    function gainXp(amt) {
        const m = gameState.playerMon;
        m.xp += amt;
        while (m.xp >= m.xpNext) {
            m.xp -= m.xpNext;
            m.level++;
            m.maxhp += 3;
            m.hp = m.maxhp;
            m.xpNext = Math.round(m.xpNext * gBal('xpCurveMul', 1.5));
        }
    }

    function battleThrowBall() {
        const b = gameState.battle;
        if (b.isTrainer) {
            b.msg = '¡No puedes capturar el POKEMON de otro!';
            b.phase = 'msg'; b.next = 'menu';
            return;
        }
        if ((gameState.inventory['POKE BALL'] || 0) <= 0) {
            b.msg = 'No te quedan POKE BALLS. Compra en la tienda.';
            b.phase = 'msg'; b.next = 'menu';
            return;
        }
        gameState.inventory['POKE BALL']--;
        playBeep(520, 0.08);
        const ratio = b.enemy.hp / b.enemy.maxhp;
        // Balance de captura desde GAME.md (con fallback): menos PS = más fácil
        const _bal = (window.GAME && window.GAME.BALANCE) || {};
        const _cb = (_bal.catchBase != null ? _bal.catchBase : 0.35);
        const _cs = (_bal.catchScale != null ? _bal.catchScale : 0.55);
        const chance = _cb + _cs * (1 - ratio);
        if (Math.random() < chance && gameState.party.length < 6) {
            gameState.party.push({ name: b.enemy.name, hp: b.enemy.maxhp, maxhp: b.enemy.maxhp, level: 4, type: b.enemy.type, moves: b.enemy.moves });
            gameState.pokedex.caught[b.enemy.name] = true; // registrar captura
            b.msg = '¡Capturaste a ' + b.enemy.name + '! Equipo: ' + gameState.party.length;
            b.phase = 'msg'; b.next = 'caught';
            gsfx('catch', 880, 0.1); setTimeout(() => playBeep(1320, 0.12), 130);
        } else {
            b.msg = (gameState.party.length >= 6) ? '¡Equipo lleno!' : '¡Oh no! ' + b.enemy.name + ' se soltó.';
            b.phase = 'msg'; b.next = 'enemyturn';
        }
    }

    // Evoluciona al Pokémon activo si alcanzó el nivel de su evolución. Devuelve el mensaje o ''.
    function evolveActiveMon() {
        const m = gameState.playerMon;
        const evo = EVOLUTIONS[m.name];
        if (!evo || m.level < evo.level) return '';
        const from = m.name;
        m.name = evo.into;
        if (evo.maxhp) m.maxhp = evo.maxhp;
        if (evo.type) m.type = evo.type;
        if (evo.moves) m.moves = evo.moves.map(x => ({ name: x.name, type: x.type, power: x.power }));
        m.hp = m.maxhp;
        gsfx('evolve', 523, 0.1); setTimeout(() => playBeep(784, 0.16), 130);
        return '¡' + from + ' evoluciona en ' + m.name + '!';
    }

    // Resuelve la caída del enemigo (salvaje o entrenador con relevo de equipo)
    function onEnemyFaint() {
        const b = gameState.battle;
        const before = gameState.playerMon.level;
        gainXp(8 + Math.floor(Math.random() * 6));
        const lvlMsg = gameState.playerMon.level > before ? ' ¡Sube a Nv.' + gameState.playerMon.level + '!' : '';
        if (b.isTrainer) {
            b.teamIdx++;
            if (b.teamIdx < b.team.length) {
                const fallen = b.enemy.name;
                const next = b.team[b.teamIdx];
                b.enemy = { name: next.name, hp: next.maxhp, maxhp: next.maxhp, type: next.type, moves: next.moves, pal: next.pal || 'purple', sprite: next.sprite };
                gameState.pokedex.seen[next.name] = true;
                b.msg = '¡' + fallen + ' cae!' + lvlMsg + ' El rival envia a ' + next.name + '.';
                b.phase = 'msg'; b.next = 'menu';
            } else {
                if (b.trainerNpc) b.trainerNpc.defeated = true;
                gameState.money += b.prize;
                let m = '¡Ganaste! ' + ((b.trainerNpc && b.trainerNpc.name) || 'El rival') + ' te da ' + b.prize + ' dinero.' + lvlMsg;
                const evo = evolveActiveMon(); if (evo) m += ' ' + evo;
                b.msg = m; b.phase = 'msg'; b.next = 'win';
            }
        } else {
            const reward = 80 + Math.floor(Math.random() * 120);
            gameState.money += reward;
            let m = '¡' + b.enemy.name + ' se debilitó! +' + reward + ' dinero.' + lvlMsg;
            const evo = evolveActiveMon(); if (evo) m += ' ' + evo;
            b.msg = m; b.phase = 'msg'; b.next = 'win';
        }
    }

    // Ejecuta un ataque del jugador con su tipo y efectividad
    function moveAttack(idx) {
        const b = gameState.battle;
        const mv = gameState.playerMon.moves[idx];
        if (!mv) return;
        const eff = effectiveness(mv.type, b.enemy.type || 'NORMAL');
        let dmg = Math.round((mv.power + Math.floor(gameState.playerMon.level / 3) + Math.floor(Math.random() * 4)) * eff);
        dmg = Math.max(1, dmg);
        b.enemy.hp = Math.max(0, b.enemy.hp - dmg);
        gsfx('hit', 660, 0.07);
        const extra = eff > 1 ? ' ¡Muy eficaz!' : (eff < 1 ? ' No es muy eficaz.' : '');
        if (b.enemy.hp <= 0) {
            onEnemyFaint();
        } else {
            let ex = extra;
            if (mv.effect === 'poison' && !b.enemy.status && Math.random() < (mv.chance != null ? mv.chance : 0.5)) {
                b.enemy.status = 'poison';
                ex += ' ¡' + b.enemy.name + ' envenenado!';
            }
            b.msg = gameState.playerMon.name + ' usa ' + mv.name + '.' + ex + ' -' + dmg + ' PS.';
            b.phase = 'msg'; b.next = 'enemyturn';
        }
    }

    function battleSelect() {
        const b = gameState.battle;
        if (b.phase !== 'menu') return;
        if (b.cursor === 0) {
            // LUCHA: abrir el submenú de ataques
            b.phase = 'moves'; b.moveCursor = 0;
        } else if (b.cursor === 1) {
            // POCIÓN: curar (gasta el turno si se usa)
            const r = usePotion();
            b.msg = r;
            if (r.charAt(0) === '¡') { b.phase = 'msg'; b.next = 'enemyturn'; }
            else { b.phase = 'msg'; b.next = 'menu'; }
        } else if (b.cursor === 2) {
            // BALL: lanzar Poké Ball
            battleThrowBall();
        } else {
            // HUIR
            if (Math.random() < 0.6) {
                b.msg = '¡Escapaste sin problemas!';
                b.phase = 'msg'; b.next = 'run';
            } else {
                b.msg = '¡No pudiste escapar!';
                b.phase = 'msg'; b.next = 'enemyturn';
            }
        }
    }

    // El turno del enemigo se resuelve al pasar el mensaje del jugador
    // Daño de veneno al final de la ronda (no debilita: mínimo 1 PS). Devuelve el texto.
    function tickPoison(b) {
        let msg = '';
        if (b.enemy.status === 'poison' && b.enemy.hp > 1) {
            const d = Math.max(1, Math.ceil(b.enemy.maxhp / 8));
            b.enemy.hp = Math.max(1, b.enemy.hp - d);
            msg += ' ' + b.enemy.name + ' sufre veneno (-' + d + ').';
        }
        if (gameState.playerMon.status === 'poison' && gameState.playerMon.hp > 1) {
            const d = Math.max(1, Math.ceil(gameState.playerMon.maxhp / 8));
            gameState.playerMon.hp = Math.max(1, gameState.playerMon.hp - d);
            msg += ' ' + gameState.playerMon.name + ' sufre veneno (-' + d + ').';
        }
        return msg;
    }

    function battleEnemyTurn() {
        const b = gameState.battle;
        const mv = (b.enemy.moves && b.enemy.moves.length)
            ? b.enemy.moves[Math.floor(Math.random() * b.enemy.moves.length)]
            : { name: 'ATAQUE', type: 'NORMAL', power: 5 };
        const eff = effectiveness(mv.type, gameState.playerMon.type || 'NORMAL');
        let dmg = Math.round((mv.power + Math.floor(Math.random() * 4)) * eff);
        dmg = Math.max(1, dmg);
        gameState.playerMon.hp = Math.max(0, gameState.playerMon.hp - dmg);
        gsfx('playerHurt', 220, 0.08);
        const extra = eff > 1 ? ' ¡Muy eficaz!' : (eff < 1 ? ' No es muy eficaz.' : '');
        const pname = gameState.playerMon.name;
        if (gameState.playerMon.hp <= 0) {
            // Relevo: cambiar a un Pokémon sano del equipo si lo hay
            const idx = gameState.party.findIndex(p => p.hp > 0);
            if (idx >= 0) {
                const fainted = gameState.playerMon;
                gameState.playerMon = gameState.party[idx];
                gameState.party[idx] = fainted;
                b.msg = '¡' + pname + ' se debilitó! ¡Adelante, ' + gameState.playerMon.name + '!';
                b.phase = 'msg'; b.next = 'menu';
            } else {
                b.msg = '¡Todos tus POKEMON se debilitaron! Vuelves al inicio.';
                b.phase = 'msg'; b.next = 'lose';
            }
        } else {
            let ex = extra;
            if (mv.effect === 'poison' && !gameState.playerMon.status && Math.random() < (mv.chance != null ? mv.chance : 0.5)) {
                gameState.playerMon.status = 'poison';
                ex += ' ¡' + pname + ' envenenado!';
            }
            b.msg = b.enemy.name + ' usa ' + mv.name + '.' + ex + ' ' + pname + ' -' + dmg + ' PS.';
            b.msg += tickPoison(b);
            b.phase = 'msg'; b.next = 'menu';
        }
    }

    function endBattle(result) {
        const b = gameState.battle;
        b.active = false;
        if (result === 'lose') {
            gameState.playerMon.hp = gameState.playerMon.maxhp; // revivir
            gameState.playerX = 80; gameState.playerY = 80;
            triggerDialog(gtext('faint_recover', 'Te recuperas en el Centro Pokémon.'));
        }
        gameState.lastGrassTile = null;
    }

    function drawMon(sprite, palette, x, y, scale) {
        for (let r = 0; r < sprite.length; r++) {
            for (let c = 0; c < sprite[r].length; c++) {
                const idx = sprite[r][c];
                if (idx > 0 && palette[idx]) {
                    ctx.fillStyle = gbcColorToCss(palette[idx]);
                    ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
                }
            }
        }
    }

    function drawHpBar(x, y, name, hp, maxhp, status) {
        drawPixelText(name, x, y, 1, '#202020');
        if (status === 'poison') drawPixelText('PSN', x + name.length * 4 + 3, y, 1, '#a040c0');
        const bw = 56, bx = x, by = y + 8;
        ctx.fillStyle = '#303030'; ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
        ctx.fillStyle = '#202020'; ctx.fillRect(bx, by, bw, 4);
        const ratio = Math.max(0, hp / maxhp);
        ctx.fillStyle = ratio > 0.5 ? '#48c048' : (ratio > 0.2 ? '#e0c040' : '#e04040');
        ctx.fillRect(bx, by, Math.round(bw * ratio), 4);
        drawPixelText(hp + '/' + maxhp, x, by + 7, 1, '#303030');
    }

    function drawBattle() {
        const b = gameState.battle;
        const W = P().screenW, H = P().screenH;
        // Fondo: cielo + suelo
        ctx.fillStyle = '#d8e8f0'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#c8e0a0'; ctx.fillRect(0, H - 70, W, 70);

        // Plataformas (elipses)
        ctx.fillStyle = 'rgba(120,160,90,0.6)';
        ctx.beginPath(); ctx.ellipse(W - 56, 64, 34, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(60, H - 56, 38, 10, 0, 0, Math.PI * 2); ctx.fill();

        // Enemigo (arriba-derecha) y su caja de HP (arriba-izquierda)
        drawMon(monSprite(b.enemy.sprite), MON_PALS[b.enemy.pal] || MON_PALS.purple, W - 72, 28, 2);
        drawBattleBox(8, 8, 96, 26);
        drawHpBar(14, 12, b.enemy.name, b.enemy.hp, b.enemy.maxhp, b.enemy.status);

        // Pokémon del jugador (abajo-izquierda) y su caja (abajo-derecha)
        drawMon(PLAYERMON_SPRITE, MON_PALS.playermon, 28, H - 90, 2);
        drawBattleBox(W - 104, H - 96, 96, 26);
        drawHpBar(W - 98, H - 92, gameState.playerMon.name, gameState.playerMon.hp, gameState.playerMon.maxhp, gameState.playerMon.status);

        // Caja inferior: mensaje o menú
        drawBattleBox(4, H - 40, W - 8, 36);
        if (b.phase === 'menu') {
            drawPixelText('¿Que hara', 12, H - 32, 1, '#202020');
            drawPixelText(gameState.playerMon.name + '?', 12, H - 24, 1, '#202020');
            const balls = gameState.inventory['POKE BALL'] || 0;
            const opts = ['LUCHA', 'POCION', 'BALL' + balls, 'HUIR'];
            for (let i = 0; i < 4; i++) {
                const col = i % 2, row = Math.floor(i / 2);
                const ox = (col === 0 ? W - 116 : W - 58), oy = H - 33 + row * 11;
                if (i === b.cursor) drawPixelText('>', ox - 8, oy, 1, '#d03030');
                drawPixelText(opts[i], ox, oy, 1, '#202020');
            }
        } else if (b.phase === 'moves') {
            drawPixelText('Elige ataque (B vuelve):', 12, H - 35, 1, '#202020');
            const mvs = gameState.playerMon.moves || [];
            for (let i = 0; i < mvs.length; i++) {
                const oy = H - 26 + i * 9;
                if (i === b.moveCursor) drawPixelText('>', 14, oy, 1, '#d03030');
                drawPixelText(mvs[i].name, 22, oy, 1, '#202020');
                drawPixelText(mvs[i].type, W - 70, oy, 1, '#406090');
            }
        } else {
            const lines = wrapPixelText(b.msg || '', Math.floor((W - 24) / 4));
            for (let i = 0; i < lines.length && i < 2; i++) {
                drawPixelText(lines[i], 12, H - 32 + i * 8, 1, '#202020');
            }
            drawPixelText('(A)', W - 24, H - 12, 1, '#a0a0a0');
        }
    }

    function drawBattleBox(x, y, w, h) {
        ctx.fillStyle = 'rgba(248,248,248,0.96)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#303030'; ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    }

    let audioCtx = null;
    function playBeep(freq, duration) {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        } catch(e) {}
    }

    // Reconstruye el estado inicial del jugador desde window.GAME.PLAYER (usado al importar un GAME.md).
    function reinitPlayer() {
        gameState.playerMon = buildStarter();
        gameState.inventory = startInventory();
        gameState.party = [];
        gameState.pokedex = { seen: { [starterName()]: true }, caught: { [starterName()]: true } };
        gameState.playerX = startPos().x;
        gameState.playerY = startPos().y;
        gameState.money = (window.GAME && window.GAME.ECONOMY && window.GAME.ECONOMY.startMoney != null)
            ? window.GAME.ECONOMY.startMoney : gameState.money;
    }

    return {
        init: init,
        setAssets: setAssets,
        start: start,
        stop: stop,
        resetGame: resetGame,
        reinitPlayer: reinitPlayer,
        applyPlatform: applyPlatform,
        gameState: gameState,
        playBeep: playBeep,
        triggerDialog: triggerDialog,
        startWildBattle: startWildBattle,
        toggleMenu: toggleMenu
    };
})();
