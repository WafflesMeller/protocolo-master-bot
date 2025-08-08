// generador.js

/**
 * Generador de precedencias - generador.js
 *
 * Este script:
 *   1) Lee un archivo Excel (.xlsx/.xls) con columnas “nombre” y “cargo”.
 *   2) Genera un PDF con tarjetas formateadas utilizando PDFKit y fuentes Arial.
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
  width: 280,
  height: 95,
  gapX: 20,
  gapY: 15,
  margin: 15
};

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

function generatePdf(data, logoFile, outputPdf) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: CARD.margin });
    // Registrar fuentes Arial
    doc.registerFont('Arial', path.resolve(__dirname, 'Arial.ttf'));
    doc.registerFont('Arial-Bold', path.resolve(__dirname, 'Arial-Bold.ttf'));

    const stream = fs.createWriteStream(outputPdf);
    doc.pipe(stream);

    // Calcular columnas y filas
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const columns = Math.floor((pageWidth - 2 * CARD.margin + CARD.gapX) / (CARD.width + CARD.gapX));
    const rowsCount = Math.floor((pageHeight - 2 * CARD.margin + CARD.gapY) / (CARD.height + CARD.gapY));
    const itemsPerPage = columns * rowsCount;
    const logoPath = path.resolve(__dirname, logoFile);

    // Dividir datos en páginas
    for (let p = 0; p * itemsPerPage < data.length; p++) {
      if (p > 0) doc.addPage();
      const pageItems = data.slice(p * itemsPerPage, p * itemsPerPage + itemsPerPage);
      pageItems.forEach((item, idx) => {
        const col = idx % columns;
        const row = Math.floor(idx / columns);
        const x = CARD.margin + col * (CARD.width + CARD.gapX);
        const y = CARD.margin + row * (CARD.height + CARD.gapY);

        // Borde de tarjeta
        doc.save()
           .lineWidth(2)
           .strokeColor('#0737AA')
           .rect(x, y, CARD.width, CARD.height)
           .stroke()
           .restore();

        // Logo centrado verticalmente
        try {
          const img = doc.openImage(logoPath);
          const imgWidth = 80;
          const imgHeight = (img.height / img.width) * imgWidth;
          const imgY = y + (CARD.height - imgHeight) / 2;
          doc.image(logoPath, x + 8, imgY, { width: imgWidth, height: imgHeight });
        } catch {}

        // Área de texto con padding
        const textPaddingLeft = 10;
        const textPaddingRight = 10;
        const textX = x + 8 + 80 + textPaddingLeft;
        const textW = CARD.width - (80 + 8 + textPaddingLeft + textPaddingRight);
        const spacing = 4;

        // Ajuste dinámico de nombre (hasta 2 líneas)
        let nameSize = 14;
        const minNameSize = 6;
        let nameHeight;
        for (let sz = 14; sz >= minNameSize; sz--) {
          doc.font('Arial-Bold').fontSize(sz);
          nameHeight = doc.heightOfString(item.name, { width: textW, align: 'center' });
          const lineSpacing = sz * 1.2;
          const lines = Math.ceil(nameHeight / lineSpacing);
          if (lines <= 2) { nameSize = sz; break; }
        }
        doc.font('Arial-Bold').fontSize(nameSize);
        nameHeight = doc.heightOfString(item.name, { width: textW, align: 'center' });

        // Ajuste dinámico de cargo (hasta 2 líneas)
        let posSize = 10;
        const minPosSize = 6;
        let posHeight;
        for (let sz = 10; sz >= minPosSize; sz--) {
          doc.font('Arial').fontSize(sz);
          posHeight = doc.heightOfString(item.position, { width: textW, align: 'center' });
          const lineSpacing = sz * 1.2;
          const lines = Math.ceil(posHeight / lineSpacing);
          if (lines <= 2) { posSize = sz; break; }
        }
        doc.font('Arial').fontSize(posSize);
        posHeight = doc.heightOfString(item.position, { width: textW, align: 'center' });

        // Calcular posición vertical centrada del bloque texto
        const totalTextHeight = nameHeight + spacing + posHeight;
        const textY = y + (CARD.height - totalTextHeight) / 2;

        // Dibujar nombre y cargo en Arial
        doc.font('Arial-Bold').fontSize(nameSize)
           .text(item.name, textX, textY, { width: textW, align: 'center' });
        doc.font('Arial').fontSize(posSize)
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
