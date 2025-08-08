// generador.js

/**
 * Generador de precedencias - generador.js
 *
 * Este script:
 *   1) Lee un archivo Excel (.xlsx/.xls) con columnas “nombre” y “cargo”.
 *   2) Genera un PDF con tarjetas formateadas utilizando PDFKit.
 *
 * Uso:
 *   node generador.js <input.xlsx> <logo.png> <output.pdf>
 */

// 1. Importar módulos necesarios
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');

// 2. Parámetros de diseño de la tarjeta
const CARD = {
  width: 340,
  height: 100,
  columns: 2,
  rows: 7,
  gapX: 20,
  gapY: 20,
  margin: 20
};

// 3. Función principal
async function main() {
  const [,, inputFile, logoFile, outputPdf] = process.argv;
  if (!inputFile || !logoFile || !outputPdf) {
    console.error('Uso: node generador.js <input.xlsx> <logo.png> <output.pdf>');
    process.exit(1);
  }

  // 3.1. Leer y parsear Excel
  const workbook = xlsx.readFile(inputFile);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  if (rows.length === 0) {
    console.error('El archivo Excel está vacío o no se pudo leer.');
    process.exit(1);
  }

  // 3.2. Detectar campos nombre/cargo
  const headers = Object.keys(rows[0]);
  let nombreKey = headers.find(h => /nombre/i.test(h));
  let cargoKey  = headers.find(h => /cargo/i.test(h));
  if (!nombreKey || !cargoKey) {
    if (headers.length === 2) [nombreKey, cargoKey] = headers;
    else {
      console.error('Encabezados inválidos. Se requieren columnas "nombre" y "cargo" o exactamente 2 columnas.');
      process.exit(1);
    }
  }

  // 3.3. Normalizar datos
  const data = rows.map(r => ({
    name: String(r[nombreKey] || '').toUpperCase(),
    position: String(r[cargoKey]  || '').toUpperCase()
  }));

  // 4. Generar PDF
  await generatePdf(data, logoFile, outputPdf);
  console.log(`PDF generado: ${outputPdf}`);
}

/**
 * generatePdf: crea un PDF con tarjetas usando PDFKit
 */
function generatePdf(data, logoFile, outputPdf) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: CARD.margin });
    const stream = fs.createWriteStream(outputPdf);
    doc.pipe(stream);

    // Cargar logo
    const logoPath = path.resolve(__dirname, logoFile);

    // Coordenadas iniciales
    const startX = CARD.margin;
    const startY = CARD.margin;

    data.forEach((item, idx) => {
      const col = idx % CARD.columns;
      const row = Math.floor((idx / CARD.columns) % CARD.rows);

      // Nueva página si corresponde
      if (idx > 0 && idx % (CARD.columns * CARD.rows) === 0) {
        doc.addPage();
      }

      const x = startX + col * (CARD.width + CARD.gapX);
      const y = startY + row * (CARD.height + CARD.gapY);

      // Dibujar borde de tarjeta
      doc.save()
         .lineWidth(2)
         .strokeColor('#0737AA')
         .rect(x, y, CARD.width, CARD.height)
         .stroke()
         .restore();

      // Insertar logo
      try {
        doc.image(logoPath, x + 8, y + 8, { width: 110 });
      } catch (e) {
        console.warn('No se pudo cargar logo:', e.message);
      }

      // Texto: Nombre
      const textX = x + 8 + 110 + 12;
      const textWidth = CARD.width - (110 + 28);
      doc.font('Helvetica-Bold')
         .fontSize(18)
         .text(item.name, textX, y + 20, { width: textWidth, align: 'center' });

      // Texto: Cargo
      doc.font('Helvetica')
         .fontSize(14)
         .text(item.position, textX, y + 60, { width: textWidth, align: 'center' });
    });

    // Finalizar documento
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

// Ejecutar
main().catch(err => {
  console.error('Error generando PDF:', err);
  process.exit(1);
});
