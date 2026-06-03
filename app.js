/**
 * app.js - Orchestrador Principal de GB-AI Studio (GBC Version)
 * Conecta los eventos de la interfaz de usuario, inicializa editores GBC,
 * maneja el estado global del proyecto y ejecuta la compilación y exportaciones.
 */

// Estado global de la aplicación
const AppState = {
    // Datos cargados del proyecto actual (GBC)
    gameData: null,
    
    // Configuración del editor de sprites
    selectedSpriteIdx: 1, // Tile ID 1 (Héroe)
    selectedColor: 3,     // Negro por defecto (Color 3)
    spriteSource: 'gbc',  // 'gbc' = gameData.sprites 8x8 | 'mon' = silueta de combate de GAME.md (16x16)
    selectedMon: null,    // nombre de la silueta de GAME.md (window.GAME.SPRITES) en edición
    
    // Configuración del editor de mapas
    selectedTileIdx: 16,  // Tile ID 16 (Suelo por defecto)
    selectedMapPaletteIdx: 0, // Paleta de fondo seleccionada (0-7) para pintar
    mapTool: 'pencil',    // pencil / fill
    
    // Configuración del editor de paletas GBC
    selectedPaletteIdx: 0, // Paleta de fondo seleccionada para editar en la pestaña
    
    // Configuración de API
    apiProvider: 'local',
    apiKey: '',
    ollamaUrl: 'http://localhost:11434',

    // Último prompt generado (para regenerar al cambiar de consola)
    lastPrompt: 'Crea un juego de mazmorras de exploración tipo Zelda con un cofre y una llave.',

    // Sonidos
    soundParams: {
        1: { freq: 800, sweep: 3 },
        2: { freq: 1200, length: 15 },
        4: { freq: 4, vol: 10 }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    loadDefaultProject();
});

// Inicialización de componentes e interfaces
function initUI() {
    // 1. Inicializar simulador de Game Boy
    GBSimulator.init('gb-canvas');
    
    // 2. Interacciones de D-pad y Botones físicos
    setupConsoleControls();

    // 3. Sistema de pestañas del workspace
    setupTabs();

    // 4. Configurar eventos de Chat
    setupEditor();

    // 5. Configurar Editores (Sprites y Mapas)
    setupSpriteEditor();
    setupMapEditor();

    // 6. Configurar Editor de Paletas GBC
    setupPaletteEditor();

    // 7. Configurar pestañas adicionales (Sonido y Código)
    setupSoundPanel();
    setupCodeExporter();

    // 8. Modales de Configuración de API
    setupConfigModal();

    // 9. Selector de consola GBC / GBA
    setupConsoleSwitch();
}

// Cargar un proyecto de demostración inicial
async function loadDefaultProject() {
    addSystemMessage("Cargando entorno de desarrollo Game Boy Color...");
    
    // Simular que la IA genera el proyecto base GBC
    const initialPrompt = "Crea un juego de mazmorras de exploración tipo Zelda con un cofre y una llave.";
    AppState.lastPrompt = initialPrompt;
    AppState.gameData = await GBGenerator.generateGame(initialPrompt, '', 'local');
    
    // Cargar assets en el simulador
    syncAssetsToSimulator();
    GBSimulator.resetGame();
    GBSimulator.start();
    
    addAIMessage("¡He creado un proyecto **GBC de Mazmorra RPG** en todo color! Puedes moverte con las teclas físicas, o presionar **Z** y **X** (B y A). Mira las pestañas de **Paletas GBC** y **Map Editor** para pintar en color.", AppState.gameData.title);

    // Inicializar visualizaciones
    updateSpritePicker();
    updateTilePicker();
    drawSpriteToEditor();
    drawMapToEditor();
    updatePaletteSliders();
    updateCodeView();
}

// Sincroniza datos de AppState al simulador
function syncAssetsToSimulator() {
    if (!AppState.gameData) return;
    GBSimulator.setAssets(
        AppState.gameData.sprites,
        AppState.gameData.bgTiles,
        AppState.gameData.tilemap,
        AppState.gameData.tilemapAttrs,
        AppState.gameData.bgPalettes,
        AppState.gameData.spritePalettes
    );
    // Sprite de jugador 16x16 + animación 4 direcciones (solo GBA); en otros modos vuelve al tile 8x8
    GBSimulator.gameState.playerSprite = AppState.gameData.playerSprite || null;
    GBSimulator.gameState.playerSpriteWalk = AppState.gameData.playerSpriteWalk || null;
    GBSimulator.gameState.playerAnim = AppState.gameData.playerAnim || null;

    // Sistema de warps / interiores (entrar al Centro Pokémon). Se reinicia al exterior.
    GBSimulator.gameState.warps = AppState.gameData.warps || null;
    GBSimulator.gameState.interiors = AppState.gameData.interiors || null;
    GBSimulator.gameState.currentMap = 'overworld';
    GBSimulator.gameState.savedOverworld = null;
    GBSimulator.gameState.warpLock = null;

    // NPCs que caminan (copias frescas para reiniciar posiciones al regenerar)
    const townNpcs = AppState.gameData.npcs
        ? AppState.gameData.npcs.map(n => Object.assign({}, n))
        : [];
    GBSimulator.gameState.npcs = townNpcs;

    // Registro de áreas overworld (pueblo + Ruta 1) para los warps de borde
    const gd = AppState.gameData;
    const maps = {
        town: { tilemap: gd.tilemap, attrs: gd.tilemapAttrs, npcs: townNpcs, warps: gd.warps }
    };
    if (gd.maps && gd.maps.route1) {
        const r = gd.maps.route1;
        maps.route1 = {
            tilemap: r.tilemap, attrs: r.attrs, warps: r.warps,
            npcs: (r.npcs || []).map(n => Object.assign({}, n))
        };
    }
    GBSimulator.gameState.maps = maps;
    GBSimulator.gameState.area = 'town';
    GBSimulator.gameState.warps = gd.warps;
}

// Configurar controles físicos de la consola Game Boy en la UI
function setupConsoleControls() {
    const bindControl = (elementId, keyName) => {
        const btn = document.getElementById(elementId);
        if (!btn) return;
        
        const press = (e) => {
            e.preventDefault();
            GBSimulator.gameState.keys[keyName] = true;
            if (keyName === 'a') {
                GBSimulator.resetGame && GBSimulator.gameState.dialogue && GBSimulator.triggerDialog(null);
                if (GBSimulator.gameState.gameWon) {
                    GBSimulator.resetGame();
                } else {
                    const event = new KeyboardEvent('keydown', { key: 'x' });
                    window.dispatchEvent(event);
                }
            }
            if (keyName === 'b') {
                const event = new KeyboardEvent('keydown', { key: 'z' });
                window.dispatchEvent(event);
            }
        };

        const release = (e) => {
            e.preventDefault();
            GBSimulator.gameState.keys[keyName] = false;
        };

        btn.addEventListener('mousedown', press);
        btn.addEventListener('mouseup', release);
        btn.addEventListener('mouseleave', release);
        btn.addEventListener('touchstart', press);
        btn.addEventListener('touchend', release);
    };

    bindControl('ctrl-up', 'up');
    bindControl('ctrl-down', 'down');
    bindControl('ctrl-left', 'left');
    bindControl('ctrl-right', 'right');
    bindControl('ctrl-a', 'a');
    bindControl('ctrl-b', 'b');
    
    // SELECT para reiniciar
    const btnSelect = document.getElementById('ctrl-select');
    if (btnSelect) {
        btnSelect.addEventListener('click', () => {
            GBSimulator.resetGame();
            addSystemMessage("Simulador GBC reiniciado.");
        });
    }
    
    // START -> abre/cierra el menú (equipo / mochila / datos)
    const btnStart = document.getElementById('ctrl-start');
    if (btnStart) {
        btnStart.addEventListener('click', () => {
            if (window.GBPlatform.mode === 'gba') GBSimulator.toggleMenu();
            else GBSimulator.triggerDialog("GBC-AI Studio. v1.0. Antigravity.");
        });
    }
}

// Manejo de Pestañas (Tabs)
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            const pane = document.getElementById(targetId);
            if (pane) pane.classList.add('active');

            if (targetId === 'tab-sprites') {
                drawSpriteToEditor();
                updateSpritePicker();
            } else if (targetId === 'tab-map') {
                drawMapToEditor();
                updateTilePicker();
            } else if (targetId === 'tab-palettes') {
                updatePaletteSliders();
            } else if (targetId === 'tab-code') {
                updateCodeView();
            }
        });
    });
}

// Editor de GAME.md (panel izquierdo): editar datos -> ver el juego
function setupEditor() {
    const editor = document.getElementById('gamemd-editor');
    const fileInput = document.getElementById('gamemd-file');
    const apply = () => { if (editor) importGameMd(editor.value); };

    const btnApply = document.getElementById('btn-md-apply');
    if (btnApply) btnApply.addEventListener('click', apply);
    if (editor) editor.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); apply(); }
    });

    const btnCase = document.getElementById('btn-md-case');
    if (btnCase) btnCase.addEventListener('click', () => loadGameMdIntoEditor(true));

    const btnOpen = document.getElementById('btn-md-open');
    if (btnOpen && fileInput) {
        btnOpen.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = () => { if (editor) editor.value = String(reader.result); addSystemMessage('Archivo cargado: ' + f.name + '. Pulsa «Aplicar».'); fileInput.value = ''; };
            reader.onerror = () => addSystemMessage('No se pudo leer el archivo.');
            reader.readAsText(f);
        });
    }

    const btnSyncArt = document.getElementById('btn-md-sync-art');
    if (btnSyncArt) btnSyncArt.addEventListener('click', syncArtToGameMd);

    const btnDownload = document.getElementById('btn-md-download');
    if (btnDownload) btnDownload.addEventListener('click', () => {
        if (editor) downloadBlob(editor.value, 'GAME.md', 'text/markdown');
    });

    // Al arrancar, precargar el GAME.md del repo en el editor (sin aplicar todavía).
    loadGameMdIntoEditor(false);
}

// Conecta los editores visuales con GAME.md: vuelca el arte de tiles editado (gameData.bgTiles,
// que pinta el Map Editor) a la sección `tileArt:` del GAME.md del editor. Cierra el bucle
// pintar → dato. (El sentido inverso GAME.md → bgTiles ya ocurre al pulsar «Aplicar».)
function syncArtToGameMd() {
    const editor = document.getElementById('gamemd-editor');
    const bg = AppState.gameData && AppState.gameData.bgTiles;
    if (!editor || !bg) { addSystemMessage('No hay arte que sincronizar (genera/aplica un juego primero).'); return; }
    const isEmpty = m => !m || m.every(r => r.every(v => v === 0));
    const lines = [];
    bg.forEach((m, i) => { if (!isEmpty(m)) lines.push('  ' + (16 + i) + ': ' + JSON.stringify(m)); });
    if (!lines.length) { addSystemMessage('No hay tiles con arte para volcar.'); return; }
    const block = 'tileArt:\n' + lines.join('\n') + '\n';
    editor.value = upsertFrontMatterSection(editor.value, 'tileArt', block);
    addSystemMessage('⤴ Arte volcado a `tileArt` (' + lines.length + ' tiles). Pulsa «▶ Aplicar» o «💾 Descargar».');
}

// Reemplaza una sección de nivel raíz del front-matter por `block`; si no existe, la inserta antes del cierre.
function upsertFrontMatterSection(text, key, block) {
    const re = new RegExp('^' + key + ':\\n(?:[ \\t]+.*\\n?)*', 'm');
    if (re.test(text)) return text.replace(re, block);
    const m = text.match(/^(---\n[\s\S]*?\n)(---\n[\s\S]*)$/);
    if (m) return m[1] + block + m[2];
    return text.replace(/\s*$/, '\n') + block;
}

// Carga el GAME.md del repo en el editor; si apply=true, ademas lo aplica al juego.
async function loadGameMdIntoEditor(apply) {
    const editor = document.getElementById('gamemd-editor');
    try {
        const res = await fetch('GAME.md', { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        if (editor) editor.value = text;
        if (apply) importGameMd(text);
        else addSystemMessage('GAME.md del repo cargado en el editor. Pulsa «▶ Aplicar» (o Ctrl+Enter).');
    } catch (e) {
        addSystemMessage('No se pudo cargar GAME.md del repo: ' + e.message);
    }
}

// Configurar Chat (panel retirado; se conserva inerte por compatibilidad)
function setupChat() {
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    if (!chatForm || !chatInput) return; // panel de chat retirado (ahora editor GAME.md)

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const prompt = chatInput.value.trim();
        if (!prompt) return;

        chatInput.value = '';
        AppState.lastPrompt = prompt;
        addUserMessage(prompt);

        const typingId = addTypingIndicator();

        try {
            // Generar nuevo juego compatible con GBC
            const newGame = await GBGenerator.generateGame(prompt, AppState.apiKey, AppState.apiProvider, AppState.ollamaUrl);
            removeTypingIndicator(typingId);

            AppState.gameData = newGame;
            syncAssetsToSimulator();
            GBSimulator.resetGame();
            
            addAIMessage(`He generado el juego de GBC según tus instrucciones: **"${prompt}"**.\n\n*   Gráficos coloreados cargados.\n*   Mapa con matriz de atributos cargada (VBK Bank 1).\n*   Paletas RGB de 15 bits generadas en base al género **${newGame.genre.toUpperCase()}**.\n*   Código fuente GBC con registros coloreados actualizado.`, newGame.title);
            
            updateSpritePicker();
            updateTilePicker();
            drawSpriteToEditor();
            drawMapToEditor();
            updatePaletteSliders();
            updateCodeView();
        } catch(err) {
            removeTypingIndicator(typingId);
            addSystemMessage("Error de generación IA: " + err.message);
        }
    });

    document.querySelectorAll('.btn-suggestion').forEach(btn => {
        btn.addEventListener('click', () => {
            const prompt = btn.getAttribute('data-prompt');
            chatInput.value = prompt;
            chatForm.dispatchEvent(new Event('submit'));
        });
    });
}

// Formateadores de Chat
function addUserMessage(text) {
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = 'message user';
    msg.innerHTML = `<div class="msg-content">${escapeHTML(text)}</div>`;
    container.appendChild(msg);
    scrollToBottom();
}

function addAIMessage(text, gameTitle) {
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = 'message ai';
    msg.innerHTML = `
        <div class="msg-content">
            <strong>IA Designer (${gameTitle || 'GBC-AI'}):</strong>
            <p>${markdownToSimpleHTML(text)}</p>
        </div>
    `;
    container.appendChild(msg);
    scrollToBottom();
}

function addSystemMessage(text) {
    const container = document.getElementById('editor-log') || document.getElementById('chat-messages');
    if (!container) return;
    const line = document.createElement('div');
    line.className = 'log-line';
    line.textContent = text;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
}

function addTypingIndicator() {
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    const id = 'typing-' + Date.now();
    msg.id = id;
    msg.className = 'message system';
    msg.innerHTML = `<div class="msg-content"><em>La IA está estructurando las paletas de 15 bits y los atributos de video... 🎨</em></div>`;
    container.appendChild(msg);
    scrollToBottom();
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages');
    container.scrollTop = container.scrollHeight;
}

// ====================================================
// EDITOR DE SPRITES (GBC)
// ====================================================
let spriteCanvas, spriteCtx;
let isDrawingSprite = false;

function setupSpriteEditor() {
    spriteCanvas = document.getElementById('sprite-editor-canvas');
    spriteCtx = spriteCanvas.getContext('2d');
    spriteCtx.imageSmoothingEnabled = false;

    spriteCanvas.addEventListener('mousedown', startDrawingSprite);
    spriteCanvas.addEventListener('mousemove', drawSpritePixel);
    window.addEventListener('mouseup', stopDrawingSprite);
    
    // (Las muestras de color se generan dinámicamente en updateSpriteColorSwatches.)

    // Selector de silueta de combate (GAME.md). Vacío = volver a los sprites GBC 8x8.
    const monSelect = document.getElementById('sprite-mon-select');
    if (monSelect) monSelect.addEventListener('change', () => {
        const name = monSelect.value;
        if (name && window.GAME && window.GAME.SPRITES && window.GAME.SPRITES[name]) {
            AppState.spriteSource = 'mon'; AppState.selectedMon = name;
            document.querySelectorAll('.sprite-item').forEach(el => el.classList.remove('active'));
        } else {
            AppState.spriteSource = 'gbc'; AppState.selectedMon = null;
        }
        drawSpriteToEditor(); updateSpriteColorSwatches();
    });

    const btnSyncSprites = document.getElementById('btn-sync-sprites');
    if (btnSyncSprites) btnSyncSprites.addEventListener('click', syncSpritesToGameMd);

    document.getElementById('btn-clear-sprite').addEventListener('click', () => {
        const sprite = currentSpriteMatrix(); if (!sprite) return;
        sprite.forEach(row => row.fill(0));
        afterSpriteEdit();
    });

    document.getElementById('btn-fill-sprite').addEventListener('click', () => {
        const sprite = currentSpriteMatrix(); if (!sprite) return;
        sprite.forEach(row => row.fill(AppState.selectedColor));
        afterSpriteEdit();
    });
}

// Matriz en edición: sprite GBC 8x8 (gameData.sprites) o silueta de combate 16x16 (window.GAME.SPRITES).
function currentSpriteMatrix() {
    if (AppState.spriteSource === 'mon' && window.GAME && window.GAME.SPRITES) return window.GAME.SPRITES[AppState.selectedMon] || null;
    return (AppState.gameData && AppState.gameData.sprites) ? AppState.gameData.sprites[AppState.selectedSpriteIdx] : null;
}
function currentSpritePalette() {
    return (AppState.gameData && AppState.gameData.spritePalettes && AppState.gameData.spritePalettes[0]) || [[0, 0, 0]];
}
// Tras editar un píxel: redibuja, sincroniza con simulador/combate y refresca picker/código.
function afterSpriteEdit() {
    drawSpriteToEditor();
    if (AppState.spriteSource === 'gbc') syncAssetsToSimulator(); // las siluetas de combate ya se leen en vivo
    updateSpritePicker();
    updateCodeView();
}

// Vuelca las siluetas de combate editadas (window.GAME.SPRITES) a la sección `sprites:` del editor GAME.md.
function syncSpritesToGameMd() {
    const editor = document.getElementById('gamemd-editor');
    const S = window.GAME && window.GAME.SPRITES;
    if (!editor || !S || !Object.keys(S).length) { addSystemMessage('No hay siluetas que sincronizar.'); return; }
    const lines = Object.keys(S).map(n => '  ' + n + ': ' + JSON.stringify(S[n]));
    const block = 'sprites:\n' + lines.join('\n') + '\n';
    editor.value = upsertFrontMatterSection(editor.value, 'sprites', block);
    addSystemMessage('⤴ Siluetas volcadas a `sprites` (' + lines.length + '). Pulsa «▶ Aplicar» o «💾 Descargar».');
}

function updateSpritePicker() {
    if (!AppState.gameData) return;
    const picker = document.getElementById('sprite-picker');
    picker.innerHTML = '';
    
    // Los sprites del jugador y los NPCs usan la paleta de sprites 0 o 1
    const palette = AppState.gameData.spritePalettes[0];
    
    for (let i = 1; i < 8; i++) {
        const item = document.createElement('div');
        item.className = `sprite-item ${AppState.selectedSpriteIdx === i ? 'active' : ''}`;
        item.setAttribute('data-index', i);
        
        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 8;
        renderTileToCanvas(AppState.gameData.sprites[i], canvas, palette);
        
        item.appendChild(canvas);
        item.addEventListener('click', () => {
            document.querySelectorAll('.sprite-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            AppState.selectedSpriteIdx = i;
            AppState.spriteSource = 'gbc'; AppState.selectedMon = null;
            const sel = document.getElementById('sprite-mon-select'); if (sel) sel.value = '';
            drawSpriteToEditor(); updateSpriteColorSwatches();
        });

        picker.appendChild(item);
    }

    // Poblar el desplegable de siluetas de combate desde GAME.md (window.GAME.SPRITES)
    const monSelect = document.getElementById('sprite-mon-select');
    if (monSelect) {
        const names = (window.GAME && window.GAME.SPRITES) ? Object.keys(window.GAME.SPRITES) : [];
        const cur = AppState.spriteSource === 'mon' ? AppState.selectedMon : '';
        monSelect.innerHTML = '<option value="">— Sprites GBC (arriba) —</option>' +
            names.map(n => '<option value="' + n + '">🐾 ' + n + ' (16×16)</option>').join('');
        monSelect.value = cur || '';
    }

    // Actualizar colores de las muestras de la paleta en el editor de sprites
    updateSpriteColorSwatches();
}

function updateSpriteColorSwatches() {
    // Genera las muestras de color dinámicamente según la paleta (4 para GBC, hasta 8 para siluetas).
    const cont = document.getElementById('sprite-color-palette');
    if (!cont) return;
    const palette = currentSpritePalette();
    const count = AppState.spriteSource === 'mon' ? Math.min(8, palette.length) : 4;
    if (AppState.selectedColor >= count) AppState.selectedColor = count - 1;
    cont.innerHTML = '';
    for (let idx = 0; idx < count; idx++) {
        const rgb = palette[idx] || [0, 0, 0];
        const sw = document.createElement('div');
        sw.className = 'color-swatch' + (AppState.selectedColor === idx ? ' active' : '');
        sw.setAttribute('data-color', idx);
        sw.title = (idx === 0 ? '0 (transparente)' : 'color ' + idx);
        sw.style.backgroundColor = `rgb(${Math.floor(rgb[0] * 255 / 31)}, ${Math.floor(rgb[1] * 255 / 31)}, ${Math.floor(rgb[2] * 255 / 31)})`;
        if (idx === 0) sw.style.backgroundImage = 'linear-gradient(45deg,#555 25%,transparent 25%,transparent 75%,#555 75%),linear-gradient(45deg,#555 25%,transparent 25%,transparent 75%,#555 75%)', sw.style.backgroundSize = '8px 8px', sw.style.backgroundPosition = '0 0,4px 4px';
        sw.addEventListener('click', () => {
            AppState.selectedColor = idx;
            cont.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            sw.classList.add('active');
        });
        cont.appendChild(sw);
    }
}

function drawSpriteToEditor() {
    if (!AppState.gameData || !spriteCtx) return;
    const sprite = currentSpriteMatrix();
    if (!sprite) return;
    const N = sprite.length;
    const pixelSize = 128 / N;
    const palette = currentSpritePalette();

    spriteCtx.clearRect(0, 0, 128, 128);
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            const colorIdx = sprite[r][c];
            if (colorIdx !== 0) { // 0 = transparente (se ve el fondo del lienzo)
                const rgb = palette[colorIdx] || [31, 31, 31];
                spriteCtx.fillStyle = `rgb(${Math.floor(rgb[0] * 255 / 31)}, ${Math.floor(rgb[1] * 255 / 31)}, ${Math.floor(rgb[2] * 255 / 31)})`;
                spriteCtx.fillRect(c * pixelSize, r * pixelSize, pixelSize, pixelSize);
            }
            spriteCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            spriteCtx.lineWidth = 0.5;
            spriteCtx.strokeRect(c * pixelSize, r * pixelSize, pixelSize, pixelSize);
        }
    }
    const lbl = document.getElementById('sprite-size-label');
    if (lbl) lbl.textContent = 'Tamaño: ' + N + '×' + N + ' px | ' +
        (AppState.spriteSource === 'mon' ? 'silueta de combate: ' + AppState.selectedMon + ' (GAME.md)' : 'sprite GBC');
}

function startDrawingSprite(e) {
    isDrawingSprite = true;
    drawSpritePixel(e);
}

function drawSpritePixel(e) {
    if (!isDrawingSprite) return;
    const sprite = currentSpriteMatrix();
    if (!sprite) return;
    const N = sprite.length;
    const rect = spriteCanvas.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / (rect.width / N));
    const row = Math.floor((e.clientY - rect.top) / (rect.height / N));

    if (col >= 0 && col < N && row >= 0 && row < N) {
        sprite[row][col] = AppState.selectedColor;
        afterSpriteEdit();
    }
}

function stopDrawingSprite() {
    isDrawingSprite = false;
}

// ====================================================
// EDITOR DE MAPAS (TILEMAP GBC)
// ====================================================
let mapCanvas, mapCtx;
let isDrawingMap = false;

function setupMapEditor() {
    mapCanvas = document.getElementById('map-editor-canvas');
    mapCtx = mapCanvas.getContext('2d');
    mapCtx.imageSmoothingEnabled = false;

    mapCanvas.addEventListener('mousedown', startDrawingMap);
    mapCanvas.addEventListener('mousemove', drawMapTile);
    window.addEventListener('mouseup', stopDrawingMap);

    // Mapear selector de paleta GBC del mapa
    const mapPalSelector = document.getElementById('map-tile-palette');
    mapPalSelector.addEventListener('change', (e) => {
        AppState.selectedMapPaletteIdx = parseInt(e.target.value);
    });

    const btnPencil = document.getElementById('tool-pencil');
    const btnFill = document.getElementById('tool-fill');
    
    btnPencil.addEventListener('click', () => {
        btnPencil.classList.add('active');
        btnFill.classList.remove('active');
        AppState.mapTool = 'pencil';
    });

    btnFill.addEventListener('click', () => {
        btnFill.classList.add('active');
        btnPencil.classList.remove('active');
        AppState.mapTool = 'fill';
    });

    document.getElementById('btn-clear-map').addEventListener('click', () => {
        const ROWS = window.GBPlatform.rows;
        const COLS = window.GBPlatform.cols;
        for (let r = 0; r < ROWS; r++) {
            AppState.gameData.tilemap[r].fill(16);
            AppState.gameData.tilemapAttrs[r].fill(0); // Restablecer a Paleta 0
        }
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
                    AppState.gameData.tilemap[r][c] = 17; // Pared
                    AppState.gameData.tilemapAttrs[r][c] = 1; // Paleta 1 (Paredes)
                }
            }
        }
        drawMapToEditor();
        syncAssetsToSimulator();
    });

    document.getElementById('btn-random-map').addEventListener('click', () => {
        const genres = ['rpg', 'shooter', 'platformer'];
        const randomGenre = genres[Math.floor(Math.random() * genres.length)];
        AppState.gameData = GBGenerator.generateGameLocal(`Crea un mapa aleatorio de género ${randomGenre}`);
        syncAssetsToSimulator();
        GBSimulator.resetGame();
        updateSpritePicker();
        updateTilePicker();
        drawSpriteToEditor();
        drawMapToEditor();
        updateCodeView();
    });
}

// Devuelve el ID de la paleta sugerida por defecto para renderizar tiles del Picker
function getPickerPaletteForTile(tileId) {
    if (!AppState.gameData) return 0;
    const genre = AppState.gameData.genre;
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

function updateTilePicker() {
    if (!AppState.gameData) return;
    const picker = document.getElementById('tile-picker');
    picker.innerHTML = '';
    
    for (let i = 16; i <= 25; i++) {
        const item = document.createElement('div');
        item.className = `tile-item ${AppState.selectedTileIdx === i ? 'active' : ''}`;
        item.setAttribute('data-index', i);
        
        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 8;
        
        const bgTilePixels = AppState.gameData.bgTiles[i - 16];
        if (bgTilePixels) {
            // Obtener paleta sugerida según su ID para renderizar la miniatura a color
            const palIdx = getPickerPaletteForTile(i);
            const palette = AppState.gameData.bgPalettes[palIdx];
            renderTileToCanvas(bgTilePixels, canvas, palette);
        }
        
        item.appendChild(canvas);
        item.addEventListener('click', () => {
            document.querySelectorAll('.tile-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            AppState.selectedTileIdx = i;
            
            // Auto-seleccionar paleta sugerida en el dropdown para facilitar la pintura
            const palIdx = getPickerPaletteForTile(i);
            document.getElementById('map-tile-palette').value = palIdx;
            AppState.selectedMapPaletteIdx = palIdx;
        });
        
        picker.appendChild(item);
    }
}

function drawMapToEditor() {
    if (!AppState.gameData) return;

    const ROWS = window.GBPlatform.rows;
    const COLS = window.GBPlatform.cols;
    const tilemap = AppState.gameData.tilemap;
    const attrs = AppState.gameData.tilemapAttrs;
    const tileW = mapCanvas.width / COLS;
    const tileH = mapCanvas.height / ROWS;

    mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const tileId = tilemap[r][c];
            const palIdx = attrs[r][c] !== undefined ? attrs[r][c] : 0;
            const palette = AppState.gameData.bgPalettes[palIdx];

            let tilePixels = null;
            if (tileId >= 16) {
                tilePixels = AppState.gameData.bgTiles[tileId - 16];
            } else {
                tilePixels = AppState.gameData.sprites[tileId];
            }

            if (tilePixels && palette) {
                const pxSize = tileW / 8;
                for (let tr = 0; tr < 8; tr++) {
                    for (let tc = 0; tc < 8; tc++) {
                        const colorIdx = tilePixels[tr][tc];
                        const rgb = palette[colorIdx];
                        const r8 = Math.floor(rgb[0] * 255 / 31);
                        const g8 = Math.floor(rgb[1] * 255 / 31);
                        const b8 = Math.floor(rgb[2] * 255 / 31);
                        
                        mapCtx.fillStyle = `rgb(${r8}, ${g8}, ${b8})`;
                        mapCtx.fillRect(c * tileW + tc * pxSize, r * tileH + tr * pxSize, pxSize, pxSize);
                    }
                }
            }

            mapCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            mapCtx.lineWidth = 0.5;
            mapCtx.strokeRect(c * tileW, r * tileH, tileW, tileH);
        }
    }
}

function startDrawingMap(e) {
    isDrawingMap = true;
    drawMapTile(e);
}

function drawMapTile(e) {
    if (!isDrawingMap) return;
    
    const rect = mapCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const col = Math.floor(x / (rect.width / window.GBPlatform.cols));
    const row = Math.floor(y / (rect.height / window.GBPlatform.rows));

    if (col >= 0 && col < window.GBPlatform.cols && row >= 0 && row < window.GBPlatform.rows) {
        if (AppState.mapTool === 'pencil') {
            AppState.gameData.tilemap[row][col] = AppState.selectedTileIdx;
            AppState.gameData.tilemapAttrs[row][col] = AppState.selectedMapPaletteIdx;
        } else if (AppState.mapTool === 'fill') {
            const targetTileId = AppState.gameData.tilemap[row][col];
            floodFillMapGbc(col, row, targetTileId, AppState.selectedTileIdx, AppState.selectedMapPaletteIdx);
        }
        
        drawMapToEditor();
        syncAssetsToSimulator();
        updateCodeView();
    }
}

function floodFillMapGbc(startCol, startRow, targetId, replacementId, paletteId) {
    if (targetId === replacementId) return;
    
    const map = AppState.gameData.tilemap;
    const attrs = AppState.gameData.tilemapAttrs;
    const queue = [[startCol, startRow]];
    
    while(queue.length > 0) {
        const [c, r] = queue.shift();
        
        if (r < 0 || r >= window.GBPlatform.rows || c < 0 || c >= window.GBPlatform.cols) continue;
        if (map[r][c] !== targetId) continue;
        
        map[r][c] = replacementId;
        attrs[r][c] = paletteId;
        
        queue.push([c + 1, r]);
        queue.push([c - 1, r]);
        queue.push([c, r + 1]);
        queue.push([c, r - 1]);
    }
}

function stopDrawingMap() {
    isDrawingMap = false;
}

// ====================================================
// EDITOR DE PALETAS GBC
// ====================================================
function setupPaletteEditor() {
    const palSelector = document.getElementById('palette-selector-idx');
    palSelector.addEventListener('change', (e) => {
        AppState.selectedPaletteIdx = parseInt(e.target.value);
        updatePaletteSliders();
    });

    // Escuchar cambios en los inputs color picker de paleta
    for (let c = 0; c < 4; c++) {
        const input = document.getElementById(`palette-color-${c}`);
        input.addEventListener('input', (e) => {
            const hex = e.target.value;
            // Convertir hex #RRGGBB a RGB 15 bits (0-31)
            const r8 = parseInt(hex.substring(1, 3), 16);
            const g8 = parseInt(hex.substring(3, 5), 16);
            const b8 = parseInt(hex.substring(5, 7), 16);

            const r5 = Math.floor(r8 * 31 / 255);
            const g5 = Math.floor(g8 * 31 / 255);
            const b5 = Math.floor(b8 * 31 / 255);

            // Actualizar paleta
            AppState.gameData.bgPalettes[AppState.selectedPaletteIdx][c] = [r5, g5, b5];
            
            // Actualizar etiqueta texto
            document.getElementById(`palette-rgb-val-${c}`).innerText = `RGB: ${r5}, ${g5}, ${b5}`;

            // Refrescar vistas
            syncAssetsToSimulator();
            drawSpriteToEditor();
            drawMapToEditor();
            updateTilePicker();
            updateCodeView();
        });
    }
}

function updatePaletteSliders() {
    if (!AppState.gameData) return;
    
    const palette = AppState.gameData.bgPalettes[AppState.selectedPaletteIdx];
    
    for (let c = 0; c < 4; c++) {
        const rgb = palette[c];
        const r8 = Math.floor(rgb[0] * 255 / 31);
        const g8 = Math.floor(rgb[1] * 255 / 31);
        const b8 = Math.floor(rgb[2] * 255 / 31);

        // Convertir a hex
        const hex = '#' + 
            r8.toString(16).padStart(2, '0') + 
            g8.toString(16).padStart(2, '0') + 
            b8.toString(16).padStart(2, '0');

        const input = document.getElementById(`palette-color-${c}`);
        input.value = hex;
        
        document.getElementById(`palette-rgb-val-${c}`).innerText = `RGB: ${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
    }
}

// ====================================================
// DIAPASÓN Y PRUEBA DE SONIDOS
// ====================================================
function setupSoundPanel() {
    document.querySelectorAll('.sound-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const channel = slider.getAttribute('data-channel');
            const param = slider.getAttribute('data-param');
            const value = parseInt(e.target.value);
            
            AppState.soundParams[channel][param] = value;
            updateSoundRegistersDisplay();
        });
    });

    document.querySelectorAll('.btn-play-sound').forEach(btn => {
        btn.addEventListener('click', () => {
            const channel = btn.getAttribute('data-channel');
            playChiptuneSim(channel);
        });
    });
}

function playChiptuneSim(channel) {
    const params = AppState.soundParams[channel];
    let freq = 440;
    let duration = 0.2;

    if (channel === '1') {
        freq = params.freq;
        const factor = params.sweep > 3 ? 1.5 : 0.7;
        GBSimulator.playBeep(freq, 0.1);
        setTimeout(() => {
            GBSimulator.playBeep(freq * factor, 0.15);
        }, 100);
    } else if (channel === '2') {
        freq = params.freq;
        duration = params.length / 30;
        GBSimulator.playBeep(freq, duration);
    } else if (channel === '4') {
        freq = 60 + params.freq * 15;
        duration = params.vol / 15 * 0.3;
        GBSimulator.playBeep(freq, duration);
    }
}

function updateSoundRegistersDisplay() {
    const r1 = AppState.soundParams[1];
    const r2 = AppState.soundParams[2];

    const nr10 = '0x' + (r1.sweep << 4 | 2).toString(16).toUpperCase().padStart(2, '0');
    const nr13 = '0x' + (r1.freq & 0xFF).toString(16).toUpperCase().padStart(2, '0');
    const nr14 = '0x' + (0x80 | ((r1.freq >> 8) & 0x07)).toString(16).toUpperCase().padStart(2, '0');
    
    const nr21 = '0x' + (r2.length & 0x3F).toString(16).toUpperCase().padStart(2, '0');
    const nr23 = '0x' + (r2.freq & 0xFF).toString(16).toUpperCase().padStart(2, '0');

    const codeBox = document.getElementById('sound-registers-code');
    codeBox.innerText = `; Registros de audio modificados en tiempo real (GBC Sound)
NR10: ${nr10}  ; Sweep
NR11: 0x82  ; Wave Duty
NR13: ${nr13}  ; Frecuencia Baja
NR14: ${nr14}  ; Frecuencia Alta (Activa canal 1)

NR21: ${nr21}  ; Canal 2 Length
NR23: ${nr23}  ; Canal 2 Frecuencia Baja`;
}

// ====================================================
// EXPORTADORES (ASM Y ROM)
// ====================================================
function setupCodeExporter() {
    const btnCopy = document.getElementById('btn-copy-code');
    btnCopy.addEventListener('click', () => {
        const codeText = document.getElementById('assembly-code-box').innerText;
        navigator.clipboard.writeText(codeText)
            .then(() => {
                btnCopy.innerText = "¡Copiado!";
                setTimeout(() => btnCopy.innerText = "Copiar Código", 2000);
            })
            .catch(err => alert("Error al copiar: " + err));
    });

    document.getElementById('btn-export-asm').addEventListener('click', () => {
        if (!AppState.gameData) return;
        const codeText = AppState.gameData.asmCode;
        downloadBlob(codeText, 'game.asm', 'text/plain');
    });

    // (El import/carga de GAME.md vive ahora en el panel Editor — ver setupEditor.)

    document.getElementById('btn-export-rom').addEventListener('click', () => {
        if (!AppState.gameData) return;

        if (window.GBPlatform.mode === 'gba') {
            addSystemMessage("La exportación de ROM .gba real requiere compilación externa (devkitARM/Butano). En modo GBA usa 'Exportar ASM' o vuelve a GBC para descargar una .gb binaria.");
            return;
        }

        addSystemMessage("Compilando recursos gráficos de color GBC...");
        try {
            const romBytes = ROMBuilder.buildRom(AppState.gameData);
            downloadBlob(romBytes, 'juego_color.gb', 'application/octet-stream');
            addSystemMessage("¡Compilación de ROM GBC completada con éxito!");
        } catch(e) {
            addSystemMessage("Error compilando la ROM GBC: " + e.message);
        }
    });
}

function updateCodeView() {
    if (!AppState.gameData) return;
    const box = document.getElementById('assembly-code-box');
    box.innerText = AppState.gameData.asmCode;
}

// ====================================================
// CONFIGURACIÓN DE API MODAL
// ====================================================
function setupConfigModal() {
    const modal = document.getElementById('modal-api');
    const btnConfig = document.getElementById('btn-config');
    if (!modal || !btnConfig) return; // panel de chat IA retirado: configuración de API en desuso
    const btnClose = document.getElementById('modal-close');
    const btnCancel = document.getElementById('modal-cancel');
    const btnSave = document.getElementById('modal-save');
    
    const apiProvider = document.getElementById('api-provider');
    const apiKeyGroup = document.getElementById('api-key-group');
    const apiKeyInput = document.getElementById('api-key');
    const ollamaUrlGroup = document.getElementById('ollama-url-group');
    const ollamaUrlInput = document.getElementById('ollama-url');

    btnConfig.addEventListener('click', () => {
        apiProvider.value = AppState.apiProvider;
        apiKeyInput.value = AppState.apiKey;
        if (ollamaUrlInput) ollamaUrlInput.value = AppState.ollamaUrl;
        toggleApiKeyField();
        modal.style.display = 'flex';
    });

    const closeModal = () => modal.style.display = 'none';
    btnClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);
    apiProvider.addEventListener('change', toggleApiKeyField);

    btnSave.addEventListener('click', () => {
        AppState.apiProvider = apiProvider.value;
        AppState.apiKey = apiKeyInput.value.trim();
        if (ollamaUrlInput) AppState.ollamaUrl = ollamaUrlInput.value.trim();
        closeModal();
        addSystemMessage(`Configuración de API GBC guardada. Proveedor: ${AppState.apiProvider.toUpperCase()}`);
    });

    function toggleApiKeyField() {
        if (apiProvider.value === 'local') {
            apiKeyGroup.style.display = 'none';
            if (ollamaUrlGroup) ollamaUrlGroup.style.display = 'none';
        } else if (apiProvider.value === 'ollama') {
            apiKeyGroup.style.display = 'none';
            if (ollamaUrlGroup) ollamaUrlGroup.style.display = 'flex';
        } else {
            apiKeyGroup.style.display = 'flex';
            if (ollamaUrlGroup) ollamaUrlGroup.style.display = 'none';
        }
    }
}

// ====================================================
// SELECTOR DE CONSOLA GBC / GBA
// ====================================================
function setupConsoleSwitch() {
    const btnGbc = document.getElementById('btn-gbc');
    const btnGba = document.getElementById('btn-gba');
    if (!btnGbc || !btnGba) return;
    btnGbc.addEventListener('click', () => switchConsole('gbc'));
    btnGba.addEventListener('click', () => switchConsole('gba'));
    applyEditorPlatform();
}

// Ajusta la resolución del canvas del editor de mapas a la consola activa
function applyEditorPlatform() {
    if (!mapCanvas) return;
    if (window.GBPlatform.mode === 'gba') {
        mapCanvas.width = 480; mapCanvas.height = 320; // 30x20 tiles a 16px
    } else {
        mapCanvas.width = 320; mapCanvas.height = 288; // 20x18 tiles a 16px
    }
}

// Importa un documento GAME.md (texto), lo compila a window.GAME con el MISMO buildGame que la CLI,
// y regenera el mundo en GBA para ver el resultado al instante (caso de uso: el juego estilo Pokémon).
function importGameMd(text) {
    if (!window.YamlMin || !window.GameBuild) { addSystemMessage('Importador no disponible (faltan yaml-min/game-build).'); return; }
    try {
        const split = window.YamlMin.splitFrontMatter(text);
        if (!split.fm) throw new Error('el archivo no tiene front-matter YAML (--- … ---)');
        const built = window.GameBuild.buildGame(window.YamlMin.parseYamlSubset(split.fm));
        if (!built.SPECIES || !Object.keys(built.SPECIES).length) throw new Error('el GAME.md no define `species`');
        window.GAME = built;
        AppState.lastPrompt = 'un juego de pokemon';
        if (window.GBPlatform.mode !== 'gba') {
            switchConsole('gba');   // configura la UI y regenera con lastPrompt (pokemon)
        } else {
            AppState.gameData = GBGenerator.generateGameLocal('un juego de pokemon');
            syncAssetsToSimulator();
            GBSimulator.resetGame();
        }
        if (GBSimulator.reinitPlayer) GBSimulator.reinitPlayer();
        try { updateSpritePicker(); drawSpriteToEditor(); updateTilePicker(); updatePaletteSliders(); drawMapToEditor(); updateCodeView(); } catch (e) { /* vistas opcionales */ }
        const nm = (built.platform && built.platform.mode) || '?';
        addSystemMessage('✅ GAME.md importado (' + nm + '): ' + Object.keys(built.SPECIES).length + ' especies · ' +
            Object.keys(built.TRAINERS || {}).length + ' entrenadores · starter ' + ((built.PLAYER && built.PLAYER.starter) || '—') + '.');
    } catch (e) {
        addSystemMessage('❌ Error al importar GAME.md: ' + e.message);
    }
}

function switchConsole(mode) {
    if (window.GBPlatform.mode === mode) return;
    window.GBPlatform.set(mode);

    // Estado visual de los botones
    document.getElementById('btn-gbc').classList.toggle('active', mode === 'gbc');
    document.getElementById('btn-gba').classList.toggle('active', mode === 'gba');

    // Ajustar relación de aspecto de la pantalla y el badge del hardware
    document.getElementById('app').classList.toggle('mode-gba', mode === 'gba');
    const badge = document.getElementById('console-badge');
    if (badge) badge.textContent = (mode === 'gba') ? 'ADVANCE' : 'COLOR';

    // Aplicar nueva resolución a simulador y editor
    GBSimulator.applyPlatform();
    applyEditorPlatform();

    // Regenerar el proyecto actual con las nuevas dimensiones de mapa
    AppState.gameData = GBGenerator.generateGameLocal(AppState.lastPrompt || 'mazmorra');
    syncAssetsToSimulator();
    GBSimulator.resetGame();

    // Refrescar todas las vistas
    updateSpritePicker();
    updateTilePicker();
    drawSpriteToEditor();
    drawMapToEditor();
    updatePaletteSliders();
    updateCodeView();

    // El export de ROM .gb binaria solo aplica a GBC
    const btnRom = document.getElementById('btn-export-rom');
    if (btnRom) {
        btnRom.disabled = (mode === 'gba');
        btnRom.style.opacity = (mode === 'gba') ? '0.5' : '1';
        btnRom.title = (mode === 'gba')
            ? 'La ROM .gba real requiere compilación externa (devkitARM)'
            : '';
    }

    addSystemMessage(mode === 'gba'
        ? 'Modo Game Boy Advance activado: pantalla 240×160, mapa 30×20 tiles.'
        : 'Modo Game Boy Color activado: pantalla 160×144, mapa 20×18 tiles.');
}

// ====================================================
// FUNCIONES AUXILIARES GLOBALES
// ====================================================

// Renderiza un tile 8x8 con paleta RGB 15 bits
function renderTileToCanvas(tilePixels, canvas, palette) {
    if (!palette) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 8, 8);
    
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const colorIdx = tilePixels[r][c];
            const rgb = palette[colorIdx] || [31,31,31];
            const r8 = Math.floor(rgb[0] * 255 / 31);
            const g8 = Math.floor(rgb[1] * 255 / 31);
            const b8 = Math.floor(rgb[2] * 255 / 31);
            
            ctx.fillStyle = `rgb(${r8}, ${g8}, ${b8})`;
            ctx.fillRect(c, r, 1, 1);
        }
    }
}

function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function markdownToSimpleHTML(text) {
    let html = escapeHTML(text);
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^\*\s(.*)$/gm, '<li>$1</li>');
    html = html.replace(/\n/g, '<br>');
    return html;
}
