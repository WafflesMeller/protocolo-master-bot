// generador.js

/*
Generador de precedencias - generador.js 

Este script lee un archivo Excel (.xlsx o .xls) con columnas que contengan 'nombre' y 'cargo',
con independencia de mayúsculas/minúsculas, y genera:
  1) un archivo HTML con un formato de "tarjetas" para imprimir reservaciones de silla, incluyendo un logo a la izquierda.
  2) un PDF con todas las tarjetas, usando Puppeteer.

Adicionalmente, ajusta dinámicamente el tamaño de fuente de cada campo (nombre o cargo) por separado
si su contenido excede el espacio asignado en la tarjeta, y dibuja marcas de corte completas (líneas punteadas)
entre tarjetas para facilitar el recorte tras la impresión.

Uso:
  1. Instalar dependencias:
     npm init -y
     npm install xlsx puppeteer fs path

  2. Ejecutar:
     node generador.js datos.xlsx logo.png output.pdf
*/

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const puppeteer = require('puppeteer');

async function main() {
  const [,, inputFile, logoFile, outputPdf] = process.argv;
  if (!inputFile || !logoFile || !outputPdf) {
    console.error('Uso: node generador.js <input.xlsx> <logo.png> <output.pdf>');
    process.exit(1);
  }

  // Leer workbook de Excel
  const workbook = xlsx.readFile(inputFile);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  if (rows.length === 0) {
    console.error('El archivo Excel está vacío o no se pudo leer.');
    process.exit(1);
  }

  // Detectar dinámicamente los campos de nombre y cargo (case-insensitive)
  const headers = Object.keys(rows[0]);
  let nombreField = headers.find(h => h.toLowerCase().includes('nombre'));
  let cargoField  = headers.find(h => h.toLowerCase().includes('cargo'));
  if (!nombreField || !cargoField) {
    if (headers.length === 2) {
      nombreField = headers[0];
      cargoField  = headers[1];
      console.warn('No se detectaron encabezados "nombre" o "cargo". Usando primeras dos columnas.');
    } else {
      console.error('Encabezados inválidos. Se requieren columnas "nombre" y "cargo" o exactamente 2 columnas.');
      process.exit(1);
    }
  }
  console.log(`Usando columnas: nombre -> "${nombreField}", cargo -> "${cargoField}"`);

  // Generar HTML intermedio
  const logoPath = path.resolve(__dirname, logoFile);
  const html     = buildHtml(rows, nombreField, cargoField, logoPath);
  const htmlFile = path.join(__dirname, 'precedes.html');
  fs.writeFileSync(htmlFile, html, 'utf8');
  console.log(`HTML generado: ${htmlFile}`);

  // Generar PDF usando Puppeteer
  await generatePdf(htmlFile, outputPdf);
  console.log(`PDF generado: ${outputPdf}`);
}

function buildHtml(data, nombreKey, cargoKey, logoPath) {
  const logoUrl = 'file://' + logoPath;
  const cardWidth  = 370;
  const cardHeight = 120;
  const gap        = 30;
  const padding    = 20;
  const style = `
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
      .page { page-break-after: always; padding: ${padding/2}px ${padding}px; display: flex; justify-content: center; flex-wrap: wrap; gap: ${gap}px; align-items: center; }
      .card { width: ${cardWidth}px; height: ${cardHeight}px; border: 2px solid #0737AA; box-sizing: border-box; padding: 8px; display: flex; align-items: center; position: relative; }
      .page .card:last-child:nth-child(odd) { margin-right: auto; margin-left: 3px; }
      .card::after { content: ''; position: absolute; right: -17px; top: -15px; height: calc(100% + 32px); border-left: 1px dashed #999; }
      .card:nth-child(2n)::after { content: none; }
      .card::before { content: ''; position: absolute; left: -15px; bottom: -17px; width: calc(100% + 32px); border-top: 1px dashed #999; }
      .page .card:nth-last-child(-n+2)::before { content: none; }
      .logo { align-self: center; flex-shrink: 0; width: 110px; height: auto; margin-right: 12px; }
      .text { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; width: calc(100% - 100px - 12px); height: 100%; }
      .name { font-weight: bold; font-size: 18px; line-height: 1.2; margin-bottom: 4px; word-break: break-word; }
      .position { font-size: 14px; line-height: 1.2; word-break: break-word; }
    </style>`;
  const adjustScript = `
    <script>
      window.addEventListener('load', () => {
        document.querySelectorAll('.card').forEach(card => {
          ['name', 'position'].forEach(cls => {
            const el = card.querySelector('.' + cls);
            const container = el.parentElement;
            let fontSize = parseInt(window.getComputedStyle(el).fontSize);
            while (fontSize > 6 && (el.scrollWidth > container.clientWidth || el.scrollHeight > container.clientHeight/2)) {
              fontSize--;
              el.style.fontSize = fontSize + 'px';
            }
          });
        });
      });
    </script>`;
  const pages = [];
  for (let i = 0; i < data.length; i += 14) pages.push(data.slice(i, i + 14));
  const pagesHtml = pages.map(pageData => {
    const cards = pageData.map(row => {
      const nombre = escapeHtml(String(row[nombreKey] || '').toUpperCase());
      const cargo  = escapeHtml(String(row[cargoKey]  || '').toUpperCase());
      return `<div class="card"><img class="logo" src="${logoUrl}"/><div class="text"><div class="name">${nombre}</div><div class="position">${cargo}</div></div></div>`;
    }).join('');
    return `<div class="page">${cards}</div>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${style}${adjustScript}<title>Precedencias</title></head><body>${pagesHtml}</body></html>`;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'' :'&#39;' })[m]);
}

async function generatePdf(htmlPath, outputPdf) {
  let browser;
  try {
    // Intentar usar Chromium instalado en el sistema
    browser = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true
    });
  } catch (e) {
    console.warn('No se encontró Chrome en CHROME_PATH, usando Chromium bundled de Puppeteer');
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true });
  }
  const page = await browser.newPage();
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' });
  await page.pdf({ path: outputPdf, format: 'Letter', printBackground: true });
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
