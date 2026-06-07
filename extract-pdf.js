const PDFParser = require('pdf2json');
const fs = require('fs');
const path = require('path');

const pdfPath = 'c:\\Users\\Admin\\Desktop\\proyectosengo\\Manual Técnico para la Integración Tecnológica del Sistema de Transmisión v2.pdf';

const pdfParser = new PDFParser();

pdfParser.on('pdfParser_dataError', errData => {
  console.error('Error parsing PDF:', errData.parserError);
  process.exit(1);
});

pdfParser.on('pdfParser_dataReady', pdfData => {
  const pages = pdfData.Pages || [];
  let text = '';
  
  pages.forEach((page, pageIndex) => {
    const textItems = page.Texts || [];
    const pageText = textItems.map(item => 
      item.R.map(r => decodeURIComponent(r.T)).join('')
    ).join(' ');
    text += `\n=== PÁGINA ${pageIndex + 1} ===\n${pageText}`;
  });
  
  // Buscar palabras clave
  const lines = text.split('\n');
  const relevantLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes('recepcionlote') || 
        lowerLine.includes('authorization') ||
        lowerLine.includes('bearer') ||
        lowerLine.includes('autenticación') ||
        (lowerLine.includes('header') && lowerLine.includes('auth')) ||
        (lowerLine.includes('token') && (lowerLine.includes('auth') || lowerLine.includes('envío'))) ||
        (lowerLine.includes('lote') && (lowerLine.includes('envío') || lowerLine.includes('procesar') || lowerLine.includes('request')))
    ) {
      relevantLines.push(`[LÍNEA ${i}] ${line}`);
    }
  }
  
  console.log(relevantLines.join('\n'));
  console.log('\n=== INFORMACIÓN DEL PDF ===');
  console.log(`Total de páginas: ${pages.length}`);
  console.log(`Total de líneas encontradas: ${relevantLines.length}`);
});
