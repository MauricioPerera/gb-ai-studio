/**
 * rombuilder.js - Generador de binarios .gb para Game Boy Color (GBC)
 * Toma los recursos visuales, mapas, paletas de color y posiciones,
 * y los empaqueta en una ROM de 32KB compatible con color.
 */

// ====================================================
// CONFIGURACIÓN DE PLATAFORMA (consola objetivo)
// Define las dimensiones de pantalla y mapa según la consola activa.
// 'gbc' = Game Boy Color (160x144, 20x18 tiles)
// 'gba' = Game Boy Advance (240x160, 30x20 tiles)
// Es global para que generator.js, simulator.js y app.js compartan el mismo estado.
// ====================================================
window.GBPlatform = {
    mode: 'gbc',
    cols: 20, rows: 18, screenW: 160, screenH: 144,
    set: function(mode) {
        this.mode = (mode === 'gba') ? 'gba' : 'gbc';
        if (this.mode === 'gba') {
            this.cols = 30; this.rows = 20; this.screenW = 240; this.screenH = 160;
        } else {
            this.cols = 20; this.rows = 18; this.screenW = 160; this.screenH = 144;
        }
        return this;
    }
};

const ROMBuilder = (function() {
    
    // Logotipo de Nintendo obligatorio en la cabecera (offset 0x0104 - 0x0133)
    const NINTENDO_LOGO = new Uint8Array([
        0xCE, 0xED, 0x66, 0x66, 0xCC, 0x0D, 0x00, 0x0B, 0x03, 0x73, 0x00, 0x83, 0x00, 0x0C, 0x00, 0x0D,
        0x00, 0x08, 0x11, 0x1F, 0x88, 0x89, 0x00, 0x0E, 0xDC, 0xCC, 0x6E, 0xE6, 0xDD, 0xDD, 0xD9, 0x99,
        0xBB, 0xBB, 0x67, 0x63, 0x6E, 0x0E, 0xEC, 0xCC, 0xDD, 0xDC, 0x99, 0x9F, 0xBB, 0xB9, 0x33, 0x3E
    ]);

    // Opcodes del juego precompilados en ASM para la CPU de Game Boy Color
    // Inicia en el offset 0x0150 de la ROM
    const ENGINE_CODE = new Uint8Array([
        0xF3,                         // di (Desactivar interrupciones)
        0x31, 0xFE, 0xFF,             // ld sp, $FFFE (Inicia la pila)
        
        // Esperar VBlank para apagar la pantalla
        0xF0, 0x44,                   // ldh a, ($44) ; Carga LY (línea vertical actual)
        0xFE, 0x90,                   // cp $90       ; Compara con 144
        0x20, 0xFA,                   // jr nz, -6    ; Si no está en VBlank, repite loop
        
        // Apagar LCD
        0xAF,                         // xor a
        0xE0, 0x40,                   // ldh ($40), a ; LCDC = 0 (Pantalla desactivada)
        
        // ----------------------------------------------------
        // CARGAR PALETAS DE FONDO GBC ($FF68-$FF69)
        // ----------------------------------------------------
        // Escribir $80 a $FF68 (BCPS) para activar auto-incremento de paleta 0
        0x3E, 0x80,                   // ld a, $80
        0xE0, 0x68,                   // ldh ($68), a
        // Copiar 64 bytes de paletas de fondo desde la ROM ($1F00)
        0x21, 0x00, 0x1F,             // ld hl, $1F00 ; Origen
        0x0E, 0x69,                   // ld c, $69    ; Destino ($FF69 - BCPD)
        0x06, 0x40,                   // ld b, 64     ; Cantidad de bytes (8 paletas * 4 colores * 2 bytes)
    // LoopBgPal:
        0x2A,                         // ld a, (hl+)
        0xE2,                         // ldh (c), a
        0x05,                         // dec b
        0x20, 0xFB,                   // jr nz, LoopBgPal (rel -5 = $FB)

        // ----------------------------------------------------
        // CARGAR PALETAS DE SPRITES GBC ($FF6A-$FF6B)
        // ----------------------------------------------------
        // Escribir $80 a $FF6A (OCPS) para activar auto-incremento
        0x3E, 0x80,                   // ld a, $80
        0xE0, 0x6A,                   // ldh ($6A), a
        // Copiar 64 bytes de paletas de sprites desde la ROM ($1F40)
        0x21, 0x40, 0x1F,             // ld hl, $1F40 ; Origen
        0x0E, 0x6B,                   // ld c, $6B    ; Destino ($FF6B - OCPD)
        0x06, 0x40,                   // ld b, 64
    // LoopSpPal:
        0x2A,                         // ld a, (hl+)
        0xE2,                         // ldh (c), a
        0x05,                         // dec b
        0x20, 0xFB,                   // jr nz, LoopSpPal (rel -5 = $FB)
        
        // ----------------------------------------------------
        // COPIAR GRÁFICOS TILES A VRAM ($8000)
        // ----------------------------------------------------
        // Copiar 64 Tiles desde la ROM (0x2000) a VRAM (0x8000)
        // 64 tiles * 16 bytes = 1024 bytes (0x0400 bytes)
        0x21, 0x00, 0x20,             // ld hl, $2000 ; Origen
        0x11, 0x00, 0x80,             // ld de, $8000 ; Destino
        0x01, 0x00, 0x04,             // ld bc, 1024  ; Cantidad de bytes
    // LoopCopiaTiles:
        0x2A,                         // ld a, (hl+)
        0x12,                         // ld (de), a
        0x13,                         // inc de
        0x0B,                         // dec bc
        0x78,                         // ld a, b
        0xB1,                         // or c
        0x20, 0xF7,                   // jr nz, LoopCopiaTiles (rel -9 = $F7)
        
        // ----------------------------------------------------
        // COPIAR TILEMAP (FONDO) A VRAM BANCO 0 ($9800)
        // ----------------------------------------------------
        // Seleccionar VRAM Banco 0
        0xAF,                         // xor a
        0xE0, 0x4F,                   // ldh ($4F), a ; VBK = 0
        // Copiar 1024 bytes (32x32) desde ROM ($3000)
        0x21, 0x00, 0x30,             // ld hl, $3000 ; Origen
        0x11, 0x00, 0x98,             // ld de, $9800 ; Destino
        0x01, 0x00, 0x04,             // ld bc, 1024  ; Cantidad de bytes
    // LoopCopiaMapa:
        0x2A,                         // ld a, (hl+)
        0x12,                         // ld (de), a
        0x13,                         // inc de
        0x0B,                         // dec bc
        0x78,                         // ld a, b
        0xB1,                         // or c
        0x20, 0xF7,                   // jr nz, LoopCopiaMapa (rel -9 = $F7)

        // ----------------------------------------------------
        // COPIAR ATRIBUTOS TILEMAP A VRAM BANCO 1 ($9800)
        // ----------------------------------------------------
        // Seleccionar VRAM Banco 1
        0x3E, 0x01,                   // ld a, 1
        0xE0, 0x4F,                   // ldh ($4F), a ; VBK = 1
        // Copiar 1024 bytes (32x32) desde ROM ($3400)
        0x21, 0x00, 0x34,             // ld hl, $3400 ; Origen
        0x11, 0x00, 0x98,             // ld de, $9800 ; Destino
        0x01, 0x00, 0x04,             // ld bc, 1024  ; Cantidad de bytes
    // LoopCopiaAttrs:
        0x2A,                         // ld a, (hl+)
        0x12,                         // ld (de), a
        0x13,                         // inc de
        0x0B,                         // dec bc
        0x78,                         // ld a, b
        0xB1,                         // or c
        0x20, 0xF7,                   // jr nz, LoopCopiaAttrs (rel -9 = $F7)

        // Restaurar VRAM Banco 0 antes de continuar
        0xAF,                         // xor a
        0xE0, 0x4F,                   // ldh ($4F), a ; VBK = 0

        // ----------------------------------------------------
        // LIMPIAR OAM Y SPRITES ($FE00-$FE9F)
        // ----------------------------------------------------
        0x21, 0x00, 0xFE,             // ld hl, $FE00 ; OAM
        0x01, 0xA0, 0x00,             // ld bc, 160
    // LoopBorrarOAM:
        0xAF,                         // xor a
        0x22,                         // ld (hl+), a
        0x0B,                         // dec bc
        0x78,                         // ld a, b
        0xB1,                         // or c
        0x20, 0xF7,                   // jr nz, LoopBorrarOAM (rel -9 = $F7)
        
        // Configurar Sprite del Jugador (OAM Entry 0)
        0x21, 0x00, 0xFE,             // ld hl, $FE00
        0x3E, 0x50,                   // ld a, 80      ; Pos Y (Se parcheará dinámicamente)
        0x22,                         // ld (hl+), a
        0x3E, 0x50,                   // ld a, 80      ; Pos X
        0x22,                         // ld (hl+), a
        0x3E, 0x01,                   // ld a, 1       ; ID de Tile (Héroe)
        0x22,                         // ld (hl+), a
        0x3E, 0x00,                   // ld a, 0       ; Atributos del sprite (GBC Paleta 0)
        0x22,                         // ld (hl+), a
        
        // Encender LCD
        0x3E, 0x93,                   // ld a, $93
        0xE0, 0x40,                   // ldh ($40), a
        
        // ============================================
        // BUCLE PRINCIPAL DE JUEGO (GAME LOOP)
        // ============================================
        // Espera VBlank
        // (Buscamos este patrón dinámicamente para parchear el jp al final)
        0xF0, 0x44,                   // ldh a, ($44)
        0xFE, 0x90,                   // cp $90
        0x20, 0xFA,                   // jr nz, -6
        
        // Leer Joypad D-PAD
        0x3E, 0x20,                   // ld a, $20
        0xE0, 0x00,                   // ldh ($00), a
        0xF0, 0x00,                   // ldh a, ($00)
        0xF0, 0x00,                   // ldh a, ($00)
        0x2F,                         // cpl
        0xE6, 0x0F,                   // and $0F
        0x47,                         // ld b, a      ; B = D-pad
        
        // Leer Joypad Botones
        0x3E, 0x10,                   // ld a, $10
        0xE0, 0x00,                   // ldh ($00), a
        0xF0, 0x00,                   // ldh a, ($00)
        0xF0, 0x00,                   // ldh a, ($00)
        0x2F,                         // cpl
        0xE6, 0x0F,                   // and $0F
        0x4F,                         // ld c, a      ; C = Botones
        
        // Apagar Joypad
        0x3E, 0x30,                   // ld a, $30
        0xE0, 0x00,                   // ldh ($00), a
        
        // Mover Sprite
        0x21, 0x00, 0xFE,             // ld hl, $FE00
        0x7E,                         // ld a, (hl)
        
        // Abajo
        0xCB, 0x58,                   // bit 3, b
        0x28, 0x02,                   // jr z, +2
        0x3C,                         // inc a
        0x3C,                         // inc a
        
        // Arriba
        0xCB, 0x50,                   // bit 2, b
        0x28, 0x02,                   // jr z, +2
        0x3D,                         // dec a
        0x3D,                         // dec a
        
        0x22,                         // ld (hl+), a  ; Guarda Y, HL apunta a X
        0x7E,                         // ld a, (hl)
        
        // Derecha
        0xCB, 0x40,                   // bit 0, b
        0x28, 0x02,                   // jr z, +2
        0x3C,                         // inc a
        0x3C,                         // inc a
        
        // Izquierda
        0xCB, 0x48,                   // bit 1, b
        0x28, 0x02,                   // jr z, +2
        0x3D,                         // dec a
        0x3D,                         // dec a
        
        0x77,                         // ld (hl), a   ; Guarda X
        
        // Bucle infinito: volverá dinámicamente al inicio del Game Loop
        0xC3, 0x00, 0x00              // jp $XXXX (Se parchea en buildRom)
    ]);

    /**
     * Convierte una matriz bidimensional 8x8 con índices de color 0-3 a formato Game Boy 2bpp.
     * @param {Array<Array<number>>} pixelMatrix Matriz de 8x8
     * @returns {Uint8Array} Array de 16 bytes listo para VRAM de Game Boy
     */
    function convertPixelsTo2bpp(pixelMatrix) {
        const bytes = new Uint8Array(16);
        for (let r = 0; r < 8; r++) {
            let lowByte = 0;
            let highByte = 0;
            for (let c = 0; c < 8; c++) {
                const colorIndex = pixelMatrix[r][c] & 3; // Asegurar rango 0-3
                const bit0 = colorIndex & 1;
                const bit1 = (colorIndex >> 1) & 1;
                
                // Formato Game Boy: el pixel de la izquierda es el MSB (Bit 7)
                lowByte = (lowByte << 1) | bit0;
                highByte = (highByte << 1) | bit1;
            }
            bytes[r * 2] = lowByte;
            bytes[r * 2 + 1] = highByte;
        }
        return bytes;
    }

    /**
     * Genera un archivo binario Uint8Array representativo de una ROM de 32KB en formato GBC
     * @param {Object} gameData Datos del juego que contienen:
     *   - title: String con el título del juego (máx. 15 carac.)
     *   - sprites: Lista de matrices 8x8 de sprites (máx. 16)
     *   - bgTiles: Lista de matrices 8x8 de tiles de fondo (máx. 48)
     *   - tilemap: Matriz 20x18 de índices de fondo
     *   - tilemapAttrs: Matriz 20x18 de IDs de paletas (atributos)
     *   - bgPalettes: Lista de 8 paletas de fondo (cada una con 4 colores [r,g,b] en rango 0..31)
     *   - spritePalettes: Lista de 8 paletas de sprites (cada una con 4 colores [r,g,b] en rango 0..31)
     *   - playerStart: {x, y} inicial
     * @returns {Uint8Array} ROM binaria completa lista para guardar
     */
    function buildRom(gameData) {
        const ROM_SIZE = 32768; // 32KB (Min ROM size)
        const rom = new Uint8Array(ROM_SIZE);

        // 1. Escribir punto de entrada de cabecera en 0x0100
        rom[0x0100] = 0x00; // nop
        rom[0x0101] = 0xC3; // jp $0150 (Salto al código de juego en 0x0150)
        rom[0x0102] = 0x50; // byte bajo
        rom[0x0103] = 0x01; // byte alto

        // 2. Escribir Logotipo de Nintendo en 0x0104 - 0x0133
        rom.set(NINTENDO_LOGO, 0x0104);

        // 3. Escribir Título del Juego en 0x0134 (Mayúsculas, relleno de 0x00)
        const rawTitle = (gameData.title || "GBC-AI GAME").toUpperCase().substring(0, 15);
        for (let i = 0; i < 15; i++) {
            rom[0x0134 + i] = i < rawTitle.length ? rawTitle.charCodeAt(i) : 0x00;
        }

        // 4. Parámetros de cabecera para compatibilidad de Color GBC
        rom[0x0143] = 0x80; // flag de color GBC (0x80 = GBC y DMG compatible, 0xC0 = GBC exclusivo)
        rom[0x0147] = 0x00; // Cartridge type (0x00 = Solo ROM, sin Mapper MBC)
        rom[0x0148] = 0x00; // ROM Size (0x00 = 32KB)
        rom[0x0149] = 0x00; // RAM Size (0x00 = Sin RAM externa)
        rom[0x014A] = 0x01; // Destination code (0x01 = No-Japón)
        rom[0x014B] = 0x33; // Old Licensee Code
        rom[0x014C] = 0x00; // Mask ROM Version

        // 5. Inyectar código ejecutable del motor en 0x0150
        const codeCopy = new Uint8Array(ENGINE_CODE);
        
        // Modificar coordenadas de inicio en el motor buscando dinámicamente la secuencia de OAM init
        if (gameData.playerStart) {
            let oamInitIndex = -1;
            for (let i = 0; i < codeCopy.length - 8; i++) {
                if (codeCopy[i] === 0x21 && codeCopy[i+1] === 0x00 && codeCopy[i+2] === 0xFE && codeCopy[i+3] === 0x3E) {
                    oamInitIndex = i;
                    break;
                }
            }
            if (oamInitIndex !== -1) {
                codeCopy[oamInitIndex + 4] = gameData.playerStart.y || 80;
                codeCopy[oamInitIndex + 7] = gameData.playerStart.x || 80;
            }
        }

        // Parchear la dirección absoluta del inicio del Game Loop
        let gameLoopIndex = -1;
        for (let i = 80; i < codeCopy.length - 5; i++) {
            if (codeCopy[i] === 0xF0 && codeCopy[i+1] === 0x44 && codeCopy[i+2] === 0xFE && codeCopy[i+3] === 0x90) {
                gameLoopIndex = i;
                break;
            }
        }
        if (gameLoopIndex !== -1) {
            const jumpTarget = 0x0150 + gameLoopIndex;
            // El salto jp $XXXX está en las últimas 3 bytes de ENGINE_CODE: C3 XX XX
            codeCopy[codeCopy.length - 2] = jumpTarget & 0xFF;         // Byte bajo
            codeCopy[codeCopy.length - 1] = (jumpTarget >> 8) & 0xFF;  // Byte alto
        }
        
        rom.set(codeCopy, 0x0150);

        // 6. Inyectar Paletas de Color en la ROM
        // - Paletas de Fondo: 0x1F00 (64 bytes)
        let bgPalOffset = 0x1F00;
        for (let p = 0; p < 8; p++) {
            const palette = gameData.bgPalettes ? gameData.bgPalettes[p] : [[31,31,31], [20,20,20], [10,10,10], [0,0,0]];
            for (let c = 0; c < 4; c++) {
                const color = palette[c] || [31,31,31];
                const r = color[0] & 31;
                const g = color[1] & 31;
                const b = color[2] & 31;
                const word = (b << 10) | (g << 5) | r;
                rom[bgPalOffset++] = word & 0xFF;
                rom[bgPalOffset++] = (word >> 8) & 0xFF;
            }
        }

        // - Paletas de Sprites: 0x1F40 (64 bytes)
        let spPalOffset = 0x1F40;
        for (let p = 0; p < 8; p++) {
            const palette = gameData.spritePalettes ? gameData.spritePalettes[p] : [[31,31,31], [20,20,20], [10,10,10], [0,0,0]];
            for (let c = 0; c < 4; c++) {
                const color = palette[c] || [31,31,31];
                const r = color[0] & 31;
                const g = color[1] & 31;
                const b = color[2] & 31;
                const word = (b << 10) | (g << 5) | r;
                rom[spPalOffset++] = word & 0xFF;
                rom[spPalOffset++] = (word >> 8) & 0xFF;
            }
        }

        // 7. Inyectar gráficos de Tiles en 0x2000
        let tileOffset = 0x2000;
        
        // Empaquetar Sprites (hasta 16)
        const maxSprites = 16;
        for (let i = 0; i < maxSprites; i++) {
            const spritePixels = gameData.sprites[i] || createBlankTile();
            const bppData = convertPixelsTo2bpp(spritePixels);
            rom.set(bppData, tileOffset);
            tileOffset += 16;
        }

        // Empaquetar Tiles de Fondo (hasta 48)
        const maxBgTiles = 48;
        for (let i = 0; i < maxBgTiles; i++) {
            const bgPixels = gameData.bgTiles[i] || createBlankTile();
            const bppData = convertPixelsTo2bpp(bgPixels);
            rom.set(bppData, tileOffset);
            tileOffset += 16;
        }

        // 8. Inyectar Tilemap de Fondo (Banco 0) en 0x3000 (1024 bytes)
        const mapOffset = 0x3000;
        const backgroundMap = new Uint8Array(1024);
        backgroundMap.fill(16); // Suelo (Tile 16) por defecto

        if (gameData.tilemap) {
            for (let r = 0; r < 18; r++) {
                for (let c = 0; c < 20; c++) {
                    const tileVal = gameData.tilemap[r][c];
                    const mapIdx = r * 32 + c;
                    backgroundMap[mapIdx] = tileVal;
                }
            }
        }
        rom.set(backgroundMap, mapOffset);

        // 9. Inyectar Atributos del Tilemap (Banco 1) en 0x3400 (1024 bytes)
        // En GBC, el byte de atributo define la paleta (bits 0-2)
        const attrOffset = 0x3400;
        const backgroundAttrs = new Uint8Array(1024);
        backgroundAttrs.fill(0); // Relleno por defecto: Paleta 0

        if (gameData.tilemapAttrs) {
            for (let r = 0; r < 18; r++) {
                for (let c = 0; c < 20; c++) {
                    const attrVal = gameData.tilemapAttrs[r][c] & 7; // Asegurar 3 bits (paletas 0 a 7)
                    const mapIdx = r * 32 + c;
                    backgroundAttrs[mapIdx] = attrVal;
                }
            }
        }
        rom.set(backgroundAttrs, attrOffset);

        // 10. Calcular checksum de cabecera en 0x014D
        let headerSum = 0;
        for (let i = 0x0134; i <= 0x014C; i++) {
            headerSum = headerSum - rom[i] - 1;
        }
        rom[0x014D] = headerSum & 0xFF;

        // 11. Calcular Global Checksum en 0x014E (Big Endian)
        let globalSum = 0;
        for (let i = 0; i < ROM_SIZE; i++) {
            if (i !== 0x014E && i !== 0x014F) {
                globalSum = (globalSum + rom[i]) & 0xFFFF;
            }
        }
        rom[0x014E] = (globalSum >> 8) & 0xFF; // MSB
        rom[0x014F] = globalSum & 0xFF;        // LSB

        return rom;
    }

    // Genera un tile vacío
    function createBlankTile() {
        const matrix = [];
        for (let i = 0; i < 8; i++) {
            matrix.push([0, 0, 0, 0, 0, 0, 0, 0]);
        }
        return matrix;
    }

    return {
        buildRom: buildRom
    };
})();
