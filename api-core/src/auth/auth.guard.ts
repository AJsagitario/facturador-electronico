import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

@Injectable()
export class SingleSessionGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No tienes llave de acceso.');
    }

    const token = authHeader.split(' ')[1]; // Extraemos el token ("Bearer eyJhb...")

    try {
      // 1. Verificamos que el token sea válido matemáticamente
      const payload = this.jwtService.verify(token);

      // 2. 🛡️ REGLA SINGLE SESSION: Buscamos al usuario en la BD
      const user = await this.userRepository.findOne({ where: { id: payload.sub } });

      if (!user) {
         throw new UnauthorizedException('Usuario no encontrado.');
      }

      if (user.token_actual !== token) {
         // ¡INTRUSO DETECTADO! Alguien inició sesión en otra PC
         throw new UnauthorizedException('SESION_DUPLICADA'); 
      }

      // Si todo está bien, lo dejamos pasar y adjuntamos los datos a la request
      request.user = payload;
      return true;

    } catch (e) {
      // Si el error es nuestra alerta personalizada, la enviamos tal cual
      if (e.message === 'SESION_DUPLICADA') {
          throw new UnauthorizedException('SESION_DUPLICADA');
      }
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }
}