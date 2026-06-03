const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("=== INICIANDO VALIDACIÓN DETALLADA DE ROM GAME BOY COLOR ===");

// 1. Cargar el archivo rombuilder.js en un contexto VM de Node
const romBuilderPath = path.join(__dirname, 'rombuilder.js');
const romBuilderCode = fs.readFileSync(romBuilderPath, 'utf8');

const sandbox = {};
vm.createContext(sandbox);
const ROMBuilder = vm.runInContext(romBuilderCode + "; ROMBuilder;", sandbox);

if (!ROMBuilder) {
    console.error("❌ Fallo: ROMBuilder GBC no se cargó correctamente en el sandbox.");
    process.exit(1);
}

console.log("✅ Módulo ROMBuilder GBC cargado con éxito.");

// 2. Generar datos ficticios de juego en formato GBC
const dummySprites = [];
for (let i = 0; i < 16; i++) {
    const s = [];
    for (let r = 0; r < 8; r++) {
        s.push([1, 2, 3, 0, 1, 2, 3, 0]);
    }
    dummySprites.push(s);
}

const dummyBgTiles = [];
for (let i = 0; i < 48; i++) {
    const t = [];
    for (let r = 0; r < 8; r++) {
        t.push([3, 2, 1, 0, 3, 2, 1, 0]);
    }
    dummyBgTiles.push(t);
}

const dummyTilemap = [];
const dummyTilemapAttrs = [];
for (let r = 0; r < 18; r++) {
    const row = [];
    const attrRow = [];
    for (let c = 0; c < 20; c++) {
        row.push(16 + (c % 10)); // Tile IDs
        attrRow.push(c % 8);     // Asignar paletas 0-7 alternadamente
    }
    dummyTilemap.push(row);
    dummyTilemapAttrs.push(attrRow);
}

// 8 paletas BG y 8 paletas Sprite (4 colores RGB de 15 bits cada uno: 0-31)
const dummyBgPalettes = [];
const dummySpritePalettes = [];
for (let p = 0; p < 8; p++) {
    dummyBgPalettes.push([
        [31, 31, 31],
        [20, 10, 0],
        [10, 5, 0],
        [0, 0, 0]
    ]);
    dummySpritePalettes.push([
        [31, 0, 0],
        [0, 31, 0],
        [0, 0, 31],
        [0, 0, 0]
    ]);
}

const testGameData = {
    title: "COLORTEST",
    sprites: dummySprites,
    bgTiles: dummyBgTiles,
    tilemap: dummyTilemap,
    tilemapAttrs: dummyTilemapAttrs,
    bgPalettes: dummyBgPalettes,
    spritePalettes: dummySpritePalettes,
    playerStart: { x: 45, y: 55 }
};

// 3. Ejecutar la compilación
console.log("Compilando la ROM GBC de pruebas...");
const rom = ROMBuilder.buildRom(testGameData);

// 4. Validaciones de integridad GBC
let errors = 0;

// A. Verificar tamaño (32KB)
if (rom.length !== 32768) {
    console.error(`❌ Error: El tamaño de la ROM es ${rom.length} bytes, debería ser exactamente 32768.`);
    errors++;
} else {
    console.log("✅ Validación de Tamaño: Correcto (32KB / 32768 bytes).");
}

// B. Verificar punto de entrada en 0x0100
if (rom[0x0100] !== 0x00 || rom[0x0101] !== 0xC3 || rom[0x0102] !== 0x50 || rom[0x0103] !== 0x01) {
    console.error("❌ Error: Cabecera incorrecta en 0x0100 (Punto de entrada DMG/GBC). Esperado NOP + JP 0x0150.");
    errors++;
} else {
    console.log("✅ Validación del Punto de Entrada: Correcto (NOP + JP $0150).");
}

// C. Verificar flag de Color GBC en 0x0143
// Debe ser 0x80 (DMG/GBC compatible) o 0xC0 (GBC exclusivo)
if (rom[0x0143] !== 0x80) {
    console.error(`❌ Error: Flag de color GBC incorrecto en 0x0143. Guardado: 0x${rom[0x0143].toString(16)}, esperado: 0x80.`);
    errors++;
} else {
    console.log("✅ Validación del Flag de Color GBC: Correcto (Compatible DMG/CGB - 0x80).");
}

// D. Verificar logotipo de Nintendo
const NINTENDO_LOGO = [
    0xCE, 0xED, 0x66, 0x66, 0xCC, 0x0D, 0x00, 0x0B, 0x03, 0x73, 0x00, 0x83, 0x00, 0x0C, 0x00, 0x0D,
    0x00, 0x08, 0x11, 0x1F, 0x88, 0x89, 0x00, 0x0E, 0xDC, 0xCC, 0x6E, 0xE6, 0xDD, 0xDD, 0xD9, 0x99,
    0xBB, 0xBB, 0x67, 0x63, 0x6E, 0x0E, 0xEC, 0xCC, 0xDD, 0xDC, 0x99, 0x9F, 0xBB, 0xB9, 0x33, 0x3E
];
let logoMatch = true;
for (let i = 0; i < 48; i++) {
    if (rom[0x0104 + i] !== NINTENDO_LOGO[i]) {
        logoMatch = false;
        break;
    }
}
if (!logoMatch) {
    console.error("❌ Error: Logotipo de Nintendo incorrecto en la cabecera.");
    errors++;
} else {
    console.log("✅ Validación del Logotipo de Nintendo: Correcto.");
}

// E. Verificar título en 0x0134
const titleBytes = rom.slice(0x0134, 0x0143);
const titleStr = String.fromCharCode(...titleBytes).replace(/\0/g, '');
if (titleStr !== "COLORTEST") {
    console.error(`❌ Error: El título de la cabecera es '${titleStr}' en lugar de 'COLORTEST'.`);
    errors++;
} else {
    console.log("✅ Validación del Título de Cabecera: Correcto ('COLORTEST').");
}

// F. Verificar paletas inyectadas en 0x1F00 (BG) y 0x1F40 (Sprite)
// Comprobamos el primer color de la paleta 0 de fondo: [31,31,31] -> RGB 15 bits word: (31<<10)|(31<<5)|31 = 32767 (0x7FFF) -> Bytes: FF 7F
if (rom[0x1F00] !== 0xFF || rom[0x1F01] !== 0x7F) {
    console.error(`❌ Error: Paleta de fondo 0 no inyectada correctamente en 0x1F00. Leido: ${rom[0x1F00].toString(16)} ${rom[0x1F01].toString(16)}, esperado: FF 7F.`);
    errors++;
} else {
    console.log("✅ Validación de Estructura de Paletas GBC: Correcto (Color Blanco 0x7FFF detectado en 0x1F00).");
}

// G. Verificar atributos de mapa inyectados en 0x3400 (VRAM Bank 1)
// Celda r=0, c=0 tiene paleta 0. Celda r=0, c=1 tiene paleta 1.
if (rom[0x3400] !== 0 || rom[0x3401] !== 1) {
    console.error(`❌ Error: Atributos de mapa incorrectos en 0x3400. Leido: ${rom[0x3400]} ${rom[0x3401]}, esperado: 0 1.`);
    errors++;
} else {
    console.log("✅ Validación de Atributos de Mapa (VBK Banco 1): Correcto.");
}

// H. Validar Checksum de Cabecera en 0x014D
let headerSum = 0;
for (let i = 0x0134; i <= 0x014C; i++) {
    headerSum = headerSum - rom[i] - 1;
}
const calculatedChecksum = headerSum & 0xFF;
const storedChecksum = rom[0x014D];
if (storedChecksum !== calculatedChecksum) {
    console.error(`❌ Error: Checksum de cabecera inválido. Guardado: 0x${storedChecksum.toString(16)}, Calculado: 0x${calculatedChecksum.toString(16)}`);
    errors++;
} else {
    console.log(`✅ Validación de Checksum de Cabecera: Correcto (Valor: 0x${storedChecksum.toString(16).toUpperCase()}).`);
}

// I. Validar Checksum Global
let globalSum = 0;
for (let i = 0; i < 32768; i++) {
    if (i !== 0x014E && i !== 0x014F) {
        globalSum = (globalSum + rom[i]) & 0xFFFF;
    }
}
const storedGlobalSum = (rom[0x014E] << 8) | rom[0x014F];
if (storedGlobalSum !== globalSum) {
    console.error(`❌ Error: Checksum global inválido. Guardado: 0x${storedGlobalSum.toString(16)}, Calculado: 0x${globalSum.toString(16)}`);
    errors++;
} else {
    console.log(`✅ Validación de Checksum Global: Correcto (Valor: 0x${storedGlobalSum.toString(16).toUpperCase()}).`);
}

// 5. Guardar la ROM y reportar éxito
if (errors === 0) {
    const testRomPath = path.join(__dirname, 'test_color.gb');
    fs.writeFileSync(testRomPath, rom);
    console.log(`\n🎉 ¡TODO CORRECTO! ROM GBC compilada con éxito en: ${testRomPath}`);
} else {
    console.error(`\n❌ Se encontraron ${errors} errores durante la validación GBC.`);
    process.exit(1);
}
