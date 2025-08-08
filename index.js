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

// Parámetros de diseño de la tarjeta
const CARD = {
  width: 280,    // ancho de cada tarjeta
  height: 95,    // alto de cada tarjeta
  gapX: 20,      // espacio horizontal entre tarjetas
  gapY: 15,      // espacio vertical entre tarjetas
  margin: 15     // margen de página
};

async function main() {
  const [,, inputFile, logoFile, outputPdf] = process.argv;
  if (!inputFile || !logoFile || !outputPdf) {
    console.error('Uso: node generador.js <input.xlsx> <logo.png> <output.pdf>');
    process.exit(1);
  }

  // Leer y parsear Excel
  const workbook = xlsx.readFile(inputFile);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  if (rows.length === 0) {
    console.error('El archivo Excel está vacío o no se pudo leer.');
    process.exit(1);
  }

  // Detectar encabezados dinámicamente
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

function generatePdf(data, logoFile, outputPdf) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: CARD.margin });
    const stream = fs.createWriteStream(outputPdf);
    doc.pipe(stream);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const columns = Math.floor((pageWidth - 2 * CARD.margin + CARD.gapX) / (CARD.width + CARD.gapX));
    const rowsCount = Math.floor((pageHeight - 2 * CARD.margin + CARD.gapY) / (CARD.height + CARD.gapY));
    const itemsPerPage = columns * rowsCount;
    const logoPath = path.resolve(__dirname, logoFile);

    // Dividir en páginas
    for (let p = 0; p * itemsPerPage < data.length; p++) {
      if (p > 0) doc.addPage();
      const pageItems = data.slice(p * itemsPerPage, p * itemsPerPage + itemsPerPage);
      pageItems.forEach((item, idx) => {
        const col = idx % columns;
        const row = Math.floor(idx / columns);
        const x = CARD.margin + col * (CARD.width + CARD.gapX);
        const y = CARD.margin + row * (CARD.height + CARD.gapY);

        // Dibujar borde de tarjeta
        doc.save()
           .lineWidth(2)
           .strokeColor('#0737AA')
           .rect(x, y, CARD.width, CARD.height)
           .stroke()
           .restore();

        // Insertar logo
        try {
          doc.image(logoPath, x + 8, y + 8, { width: 80 });
        } catch {}

        const textX = x + 8 + 80 + 10;
        const textW = CARD.width - (80 + 18);

        // Ajuste dinámico de nombre
        let nameSize = 14;
        doc.font('Helvetica-Bold').fontSize(nameSize);
        while (doc.widthOfString(item.name) > textW && nameSize > 6) {
          nameSize -= 1;
          doc.fontSize(nameSize);
        }
        const nameHeight = doc.heightOfString(item.name, { width: textW, align: 'center' });

        // Ajuste dinámico de cargo
        let posSize = 10;
        doc.font('Helvetica').fontSize(posSize);
        while (doc.widthOfString(item.position) > textW && posSize > 6) {
          posSize -= 1;
          doc.fontSize(posSize);
        }
        const posHeight = doc.heightOfString(item.position, { width: textW, align: 'center' });

        // Calcular posición vertical centrada
        const spacing = 4;
        const totalTextHeight = nameHeight + spacing + posHeight;
        const textY = y + (CARD.height - totalTextHeight) / 2;

        // Dibujar nombre
        doc.font('Helvetica-Bold').fontSize(nameSize)
           .text(item.name, textX, textY, { width: textW, align: 'center' });

        // Dibujar cargo
        doc.font('Helvetica').fontSize(posSize)
           .text(item.position, textX, textY + nameHeight + spacing, { width: textW, align: 'center' });
      });
    }

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
