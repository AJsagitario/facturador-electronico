import { Injectable } from '@nestjs/common';

@Injectable()
export class TicketsService {
  // Simulación de base de datos en memoria
  private tickets = [];

  // Método para crear un ticket (Versión Simulación)
  create(ticketData: any) {
    const newTicket = {
      id: Date.now(),
      ...ticketData, // <--- Esto ya incluye automáticamente el 'ticket_origen' que viene del Payload
      estado: 'EMITIDO',
      created_at: new Date().toISOString()
    };
    
    this.tickets.push(newTicket);
    
    // Esto es para que veas en tu consola que el dato está llegando
    console.log('✅ Ticket guardado con origen:', newTicket.ticket_origen);
    
    return newTicket;
  }

  // Método para listar tickets (Reporte)
  findAll() {
    return this.tickets;
  }
}