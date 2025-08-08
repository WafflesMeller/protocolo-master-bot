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

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');

// Parámetros de diseño de la tarjeta (ajustados para caber en Letter)
const CARD = {
  width: 280,    // ancho reducido
  height: 90,    // alto reducido
  columns: 2,    // 2 columnas por página
  rows: 7,       // 7 filas por página
  gapX: 20,      // espacio horizontal
  gapY: 15,      // espacio vertical
  margin: 15     // margen de página
};

// Función principal
async function main() {
  const [,, inputFile, logoFile, outputPdf] = process.argv;
  if (!inputFile || !logoFile || !outputPdf) {
    console.error('Uso: node generador.js <input.xlsx> <logo.png> <output.pdf>');
    process.exit(1);
  }

  // Leer Excel
  const workbook = xlsx.readFile(inputFile);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  if (rows.length === 0) {
    console.error('El archivo Excel está vacío o no se pudo leer.');
    process.exit(1);
  }

  // Detectar encabezados
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

  // Normalizar datos
  const data = rows.map(r => ({
    name: String(r[nombreKey] || '').toUpperCase(),
    position: String(r[cargoKey]  || '').toUpperCase()
  }));

  // Generar PDF
  await generatePdf(data, logoFile, outputPdf);
  console.log(`PDF generado: ${outputPdf}`);
}

// Función que crea el PDF usando PDFKit
function generatePdf(data, logoFile, outputPdf) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: CARD.margin });
    const stream = fs.createWriteStream(outputPdf);
    doc.pipe(stream);

    const logoPath = path.resolve(__dirname, logoFile);
    const startX = CARD.margin;
    const startY = CARD.margin;

    data.forEach((item, idx) => {
      const col = idx % CARD.columns;
      const row = Math.floor((idx / CARD.columns) % CARD.rows);

      if (idx > 0 && idx % (CARD.columns * CARD.rows) === 0) {
        doc.addPage();
      }

      const x = startX + col * (CARD.width + CARD.gapX);
      const y = startY + row * (CARD.height + CARD.gapY);

      // Borde de tarjeta
      doc.save()
         .lineWidth(2)
         .strokeColor('#0737AA')
         .rect(x, y, CARD.width, CARD.height)
         .stroke()
         .restore();

      // Logo
      try {
        doc.image(logoPath, x + 8, y + 8, { width: 80 });
      } catch {}

      const textX = x + 8 + 80 + 10;
      const textW = CARD.width - (80 + 18);
      // Nombre
      doc.font('Helvetica-Bold')
         .fontSize(14)
         .text(item.name, textX, y + 15, { width: textW, align: 'center' });
      // Cargo
      doc.font('Helvetica')
         .fontSize(10)
         .text(item.position, textX, y + 40, { width: textW, align: 'center' });
    });

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
