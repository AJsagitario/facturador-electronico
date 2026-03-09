import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PdfReaderService } from './pdf-reader.service';

// ✅ CORRECCIÓN: Apuntamos a la carpeta correcta basándonos en tu estructura
import { TicketsService } from '../tickets/tickets.service'; 

@Controller('simulation')
export class SimulationController {
  
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly pdfService: PdfReaderService
  ) {}

  @Post('parse-pdf')
  @UseInterceptors(FileInterceptor('file'))
  async parsePdf(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No se subió ningún archivo');
    // Llamamos al servicio lector que ya configuramos con el CSV
    return this.pdfService.parseTicket(file.buffer);
  }
}