import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// --- COMPONENTES DE TICKETS ---
import { TicketsController } from './tickets/tickets.controller';
import { TicketsService } from './tickets/tickets.service';
import { Ticket } from './tickets/ticket.entity'; 
// --- COMPONENTES DE SIMULACIÓN/PDF ---
import { SimulationController } from './simulation/simulation.controller';
import { PdfReaderService } from './simulation/pdf-reader.service';
// --- COMPONENTES DE SEGURIDAD (USUARIOS) ---
import { User } from './users/user.entity';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 1. Configuración de Conexión a Base de Datos
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: parseInt(configService.get<string>('DB_PORT')),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [Ticket, User], // 👈 IMPORTANTE: Ambas entidades deben estar aquí
        synchronize: true, // Crea las tablas automáticamente
      }),
    }),
    // 2. Registro de Tablas para poder usarlas en los Services
    TypeOrmModule.forFeature([Ticket, User]), // 👈 ESTO ES LO QUE FALTABA INTEGRAR
    // 3. Configuración de la "Llave" de Seguridad (JWT)
    JwtModule.register({
      global: true,
      secret: 'SECRET_KEY_GOVISION_2026', // Clave secreta
      signOptions: { expiresIn: '8h' },   // El login dura 8 horas
    }),
  ],
  controllers: [
    AppController, 
    TicketsController, 
    SimulationController,
    AuthController // Controlador de Login
  ],
  providers: [
    AppService, 
    TicketsService, 
    PdfReaderService,
    AuthService // Servicio de Autenticación
  ],
})
export class AppModule {}