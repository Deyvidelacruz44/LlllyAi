/**
 * Script para generar iconos PNG desde SVG
 * Ejecutar: node scripts/generate-icons.js
 * 
 * Requiere: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Intentar usar sharp si está disponible
async function generateWithSharp() {
  try {
    const sharp = require('sharp');
    
    const publicDir = path.join(__dirname, '..', 'public');
    const svgPath = path.join(publicDir, 'icon-192.svg');
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    
    // Generar 192x192
    await sharp(Buffer.from(svgContent))
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'icon-192.png'));
    
    console.log('✅ Generado: icon-192.png');
    
    // Generar 512x512
    await sharp(Buffer.from(svgContent))
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'icon-512.png'));
    
    console.log('✅ Generado: icon-512.png');
    
    // Generar apple-touch-icon (180x180)
    await sharp(Buffer.from(svgContent))
      .resize(180, 180)
      .png()
      .toFile(path.join(publicDir, 'apple-touch-icon.png'));
    
    console.log('✅ Generado: apple-touch-icon.png');
    
    console.log('\n🎉 Todos los iconos generados correctamente!');
    
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('⚠️ Sharp no está instalado.');
      console.log('Para generar iconos PNG, ejecuta:');
      console.log('  npm install sharp --save-dev');
      console.log('  node scripts/generate-icons.js');
      console.log('\nAlternativa: Usa un convertidor online como:');
      console.log('  https://svgtopng.com/');
      console.log('  https://cloudconvert.com/svg-to-png');
      process.exit(1);
    }
    throw error;
  }
}

generateWithSharp().catch(console.error);
