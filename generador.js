// generador.js

/**
 * Generador de precedencias - generador.js
 *
 * Este script:
 *   1) Lee un archivo Excel (.xlsx/.xls) con columnas “nombre” y “cargo”.
 *   2) Genera un HTML con tarjetas formateadas.
 *   3) Convierte ese HTML a PDF usando Puppeteer.
 *
 * Uso:
 *   node generador.js <input.xlsx> <logo.png> <output.pdf>
 */

// 1. Importar módulos
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const puppeteer = require('puppeteer');

// Parámetros de la tarjeta
const CARD = { width: 370, height: 120, gap: 30, padding: 20 };

// CSS para las tarjetas
const CSS = `
<style>
  body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
  .page {
    page-break-after: always;
    display: flex;
    flex-wrap: wrap;
    gap: ${CARD.gap}px;
    padding: ${CARD.padding/2}px ${CARD.padding}px;
    justify-content: center;
    align-items: center;
  }
  .card {
    width: ${CARD.width}px;
    height: ${CARD.height}px;
    border: 2px solid #0737AA;
    box-sizing: border-box;
    padding: 8px;
    display: flex;
    align-items: center;
    position: relative;
  }
  .logo { width: 110px; margin-right: 12px; flex-shrink: 0; }
  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
  }
  .name { font-weight: bold; font-size: 18px; margin-bottom: 4px; }
  .position { font-size: 14px; }
  /* Márgenes de corte punteados */
  .card::after { content: ''; position: absolute; right: -17px; top: -15px;
    height: calc(100% + ${CARD.gap}px); border-left: 1px dashed #999; }
  .card:nth-child(2n)::after { content: none; }
  .card::before { content: ''; position: absolute; left: -15px; bottom: -${CARD.gap}px;
    width: calc(100% + ${CARD.gap}px); border-top: 1px dashed #999; }
  .page .card:nth-last-child(-n+2)::before { content: none; }
</style>`;

// Script para ajustar fuente si excede espacio
const SCRIPT = `
<script>
  window.addEventListener('load', ()=>{
    document.querySelectorAll('.card').forEach(card => {
      ['name','position'].forEach(cls => {
        const el = card.querySelector('.'+cls);
        const parent = el.parentElement;
        let fs = parseInt(getComputedStyle(el).fontSize);
        while(fs > 6 && (el.scrollWidth > parent.clientWidth ||
                         el.scrollHeight > parent.clientHeight/2)){
          el.style.fontSize = (--fs) + 'px';
        }
      });
    });
  });
</script>`;

/**
 * main: flujo principal
 */
async function main(){
  const [,, inFile, logoFile, outFile] = process.argv;
  if(!inFile || !logoFile || !outFile) {
    console.error('Uso: node generador.js <input.xlsx> <logo.png> <output.pdf>');
    process.exit(1);
  }

  // 2. Leer Excel
  const wb = xlsx.readFile(inFile);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  if(!rows.length) {
    console.error('Excel vacío o no legible.');
    process.exit(1);
  }

  // 3. Detectar encabezados
  const hdr = Object.keys(rows[0]);
  let nKey = hdr.find(h=>/nombre/i.test(h));
  let cKey = hdr.find(h=>/cargo/i.test(h));
  if(!nKey||!cKey){
    if(hdr.length===2) [nKey,cKey]=hdr;
    else { console.error('Encabezados inválidos.'); process.exit(1);}  
  }

  // 4. Preparar datos normalizados
  const data = rows.map(r=>({
    name: String(r[nKey]).toUpperCase(),
    position: String(r[cKey]).toUpperCase()
  }));

  // 5. Generar HTML
  const logoPath = path.resolve(__dirname, logoFile);
  const html = `<!doctype html><html><head><meta charset="utf-8">${CSS}${SCRIPT}</head><body>${paginate(data,logoPath)}</body></html>`;
  fs.writeFileSync('precedes.html', html);
  console.log('HTML generado: precedes.html');

  // 6. Convertir a PDF
  await generatePdf('precedes.html', outFile);
  console.log(`PDF generado: ${outFile}`);
}

/**
 * paginate: divide en páginas de 14 tarjetas
 */
function paginate(arr, logo){
  return arr.reduce((acc,cur,i)=>{
    if(i%14===0) acc+='<div class="page">';
    acc+=`<div class="card">`+
         `<img class="logo" src="file://${logo}"/>`+
         `<div class="text"><div class="name">${escape(cur.name)}</div>`+
         `<div class="position">${escape(cur.position)}</div></div></div>`;
    if(i%14===13||i===arr.length-1) acc+='</div>';
    return acc;
  }, '');
}

/**
 * escape: evita HTML no deseado
 */
function escape(s){
  return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[m]);
}

/**
 * generatePdf: usa Puppeteer para crear el PDF
 */
async function generatePdf(htmlFile, outFile){
  const browser = await puppeteer.launch({
    args:['--no-sandbox','--disable-setuid-sandbox'],headless:true
  });
  const page = await browser.newPage();
  await page.goto(`file://${path.resolve(htmlFile)}`,{waitUntil:'networkidle0'});
  await page.pdf({path:outFile,format:'Letter',printBackground:true});
  await browser.close();
}

// Ejecutar
main().catch(err=>{ console.error('Error:',err); process.exit(1); });
