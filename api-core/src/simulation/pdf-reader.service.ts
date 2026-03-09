import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as csvParser from 'csv-parse/sync'; 
const pdf = require('pdf-parse');

interface ProductoCatalogo {
  nombre: string;
  glosa: string;
}

@Injectable()
export class PdfReaderService implements OnModuleInit {
  private readonly logger = new Logger(PdfReaderService.name);
  private catalogoProductos: Map<string, ProductoCatalogo> = new Map();

  onModuleInit() {
    this.cargarCatalogoCsv();
  }

  private cargarCatalogoCsv() {
    try {
      const possiblePaths = [
        path.join(process.cwd(), 'src', 'assets', 'productos.csv'),
        '/app/src/assets/productos.csv'
      ];
      let csvPath = possiblePaths.find(p => fs.existsSync(p));

      if (csvPath) {
        const fileContent = fs.readFileSync(csvPath, 'utf-8');
        const records = csvParser.parse(fileContent, {
          columns: false,
          skip_empty_lines: true,
          delimiter: ',', // 👈 AQUÍ ESTÁ EL CAMBIO (Comas en lugar de punto y coma)
          trim: true
        });

        records.forEach((row: any) => {
          // El CSV de Drive empieza con una columna vacía, así que los índices son:
          // row[1] = Tryton
          // row[2] = Simplificado
          // row[3] = Glosa (Columna D)
          if (row[1] && row[1].includes('[')) { // Validación extra para saltar cabeceras vacías
            const rawKey = this.normalizarTexto(row[1]); 
            const cleanName = row[2] ? row[2].trim() : row[1].trim();
            const glosaContable = row[3] ? row[3].trim() : '';

            this.catalogoProductos.set(rawKey, { 
                nombre: cleanName, 
                glosa: glosaContable 
            });
          }
        });
        this.logger.log(`✅ Catálogo cargado: ${this.catalogoProductos.size} productos con Glosa.`);
      }
    } catch (e) {
      this.logger.error('Error cargando CSV:', e);
    }
  }

  async parseTicket(buffer: Buffer) {
    try {
      if (!buffer) return { error: 'Buffer vacío' };

      // Validación HTML
      const header = buffer.toString('utf8', 0, 50);
      if (header.includes('<!DOCTYPE html') || header.includes('<html') || header.trim().startsWith('<')) {
          return { warning: '⚠️ El archivo es una BOLETA WEB (HTML). Sube un PDF original.' };
      }

      const data = await pdf(buffer);
      const text = data.text;

      // BLOQUEO DE BORRADORES
      if (text.toUpperCase().includes('BORRADOR') || text.toUpperCase().includes('DRAFT SALE')) {
        this.logger.warn('🚫 Documento bloqueado: Es un BORRADOR/DRAFT');
        return { error: 'INVALID_FORMAT' };
      }

      const esTicketValido = text.includes('20557698770') || text.includes('JR EMILIO ALTHAUS 121');

      if (!esTicketValido) {
          return { error: 'El PDF no parece ser un ticket válido' };
      }
      const ticketMatch = text.match(/(Ticket de Venta\s*N°\s*|N°\s*|Draft Sale\s*N[°º]\s*)(TK-\d+)/i);
      const nroTicket = ticketMatch ? ticketMatch[2] : null;
      this.logger.log(`🔍 Ticket detectado: ${nroTicket}`);
      
      const igvMatch = text.match(/IGV:[\s]*(\d+\.\d{2})/i);
      const igvDetectado = igvMatch ? parseFloat(igvMatch[1]) : 0;
      
      const lines = text.split(/\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0);

      // --- 1. Extracción de Cabecera ---
      let fecha = new Date().toISOString().split('T')[0];
      const fechaMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (fechaMatch) fecha = fechaMatch[1].split('/').reverse().join('-');

      let clienteNombre = '';
      const clienteIndex = lines.findIndex((l: string) => l.toUpperCase().includes('CLIENTE'));
      if (clienteIndex !== -1) {
          let rawCliente = lines[clienteIndex].replace(/CLIENTE[:\s]*/i, '');
          if (rawCliente.length < 3 && lines[clienteIndex + 1]) rawCliente = lines[clienteIndex + 1];
          clienteNombre = rawCliente
              .replace(/,/g, ' ')
              .replace(/[^a-zA-ZñÑáéíóúÁÉÍÓÚ\s]/g, '')
              .replace(/\s+/g, ' ')
              .trim();
      }

      // --- 2. Procesamiento por BLOQUES ---
      const itemsEncontrados: any[] = [];
      let currentBlock: string[] = [];
      
      const regexInicioItem = /^(\s*\[|IMG-|\[?SER-|\[?CX-)/i; 
      const regexStop = /^(PAGADO|NOTA|CAJERO|OP\.|SON:|LINCE Efectivo|Total:)/i;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (regexStop.test(line)) {
            if (currentBlock.length > 0) this.procesarBloque(currentBlock, itemsEncontrados);
            currentBlock = [];
            break; 
        }

        if (regexInicioItem.test(line)) {
             if (currentBlock.length > 0) this.procesarBloque(currentBlock, itemsEncontrados);
             currentBlock = [line]; 
        } else {
             if (currentBlock.length > 0 && !line.match(/^(Cant|Monto|Descripción|PIU)/i)) {
                 currentBlock.push(line);
             }
        }
      }
      if (currentBlock.length > 0) this.procesarBloque(currentBlock, itemsEncontrados);

      const sumaTotal = itemsEncontrados.reduce((sum, it) => sum + it.total, 0);

      return {
        status: 'ok',
        fecha,
        cliente: { nombre: clienteNombre },
        items: itemsEncontrados,
        total_detectado: sumaTotal,
        igv_detectado: igvDetectado,
        nroTicket,
      };

    } catch (error) {
      this.logger.error(error);
      return { error: 'Error procesando PDF' };
    }
  }

  private procesarBloque(blockLines: string[], itemsOutput: any[]) {
    const fullText = blockLines.join(' ');
    
    const esCortesiaTexto = /CORTESIA|GRATUIT/i.test(fullText);
    const regexPrecios = /(\d+)[u\s]+(\d+\.\d{2})[\s]*(\d+\.\d{2})?/;
    const matchPrecio = fullText.match(regexPrecios);

    let precio = 0;
    let cantidad = 1;

    if (matchPrecio) {
        cantidad = parseInt(matchPrecio[1]);
        precio = matchPrecio[3] ? parseFloat(matchPrecio[3]) : parseFloat(matchPrecio[2]);
    } else {
        const decimales = fullText.match(/(\d+\.\d{2})/g);
        if (decimales) precio = Math.max(...decimales.map(d => parseFloat(d)));
    }

    if (esCortesiaTexto || precio <= 0.10) return;

    let rawDesc = fullText.replace(regexPrecios, '').trim();

    // 🧹 LIMPIEZA DE BASURA DEL TICKET (NUEVO)
    // Cortamos cualquier texto desde que dice "Total (in IGV)", "IGV:", etc.
    const garbageTotalIndex = rawDesc.search(/Total\s*\(/i);
    if (garbageTotalIndex !== -1) {
        rawDesc = rawDesc.substring(0, garbageTotalIndex).trim();
    }
    
    const igvIndex = rawDesc.search(/IGV:/i);
    if (igvIndex !== -1) {
        rawDesc = rawDesc.substring(0, igvIndex).trim();
    }
    
    // Quitamos guiones sueltos al final (ej: "CONSULTA - " -> "CONSULTA")
    rawDesc = rawDesc.replace(/-\s*$/, '').trim();
    
    const matchCatalogo = this.buscarEnCatalogo(rawDesc);
    
    const nombreFinal = matchCatalogo 
        ? matchCatalogo.nombre 
        : rawDesc.replace(/^\[[A-Z0-9-]+\]\s*/i, '').trim();

    const glosaFinal = matchCatalogo ? matchCatalogo.glosa : '';

    itemsOutput.push({
        producto: nombreFinal,
        glosa: glosaFinal, 
        cantidad,
        precio_unitario: precio / cantidad,
        total: precio
    });
   }

  private normalizarTexto(texto: string): string {
     return texto.toUpperCase().replace(/[^A-Z0-9]/g, '').trim(); 
   }

  private buscarEnCatalogo(descPDF: string): ProductoCatalogo | null {
    const normalizedPDF = this.normalizarTexto(descPDF);
    for (const [keyRaw, itemValue] of this.catalogoProductos) {
        const normalizedKey = this.normalizarTexto(keyRaw);
        const normalizedSimpleName = this.normalizarTexto(itemValue.nombre);
        
        if (normalizedPDF.includes(normalizedKey) || (normalizedSimpleName.length > 5 && normalizedPDF.includes(normalizedSimpleName))) {
            return itemValue;
        }
    }
    return null;
  }
}