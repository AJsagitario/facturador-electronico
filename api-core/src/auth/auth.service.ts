import { Injectable, OnModuleInit, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/user.entity';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}
  // 🚀 CREACIÓN AUTOMÁTICA DE LOS 3 USUARIOS (Solo la primera vez)
  async onModuleInit() {
    const count = await this.userRepository.count();
    if (count === 0) {
      // Definimos la estructura clara para que TypeScript no se queje
      const usersToCreate = [
        { user: 'admin', pass: 'Gv2026admin', role: UserRole.ADMIN, nombre: 'Contadora Administradora', edad: 35 },
        { user: 'recepcion', pass: 'Gv2026recep', role: UserRole.RECEPCION, nombre: 'Personal de Recepción', edad: 25 },
        { user: 'contador', pass: 'Gv2026cont', role: UserRole.CONTADOR, nombre: 'Contador Externo', edad: 40 }
      ];

      for (const u of usersToCreate) {
        const hashedPassword = await bcrypt.hash(u.pass, 10);
        const newUser = this.userRepository.create({
          username: u.user,
          password: hashedPassword,
          role: u.role,
          nombre_completo: u.nombre,
          edad: u.edad
        });
        await this.userRepository.save(newUser);
      }
      console.log('✅ Usuarios iniciales creados exitosamente.');
    }
  }
  // Listar usuarios con filtro opcional por rol
  async findAllUsers(role?: UserRole) {
    const query = role ? { where: { role } } : {};
    const users = await this.userRepository.find(query);
    return users.map(({ password, ...user }) => user); // Ocultar contraseñas
  }
  // Crear nuevo usuario (Para el Admin)
  async createUser(data: any) {
    const exists = await this.userRepository.findOne({ where: { username: data.username } });
    if (exists) throw new BadRequestException('El nombre de usuario ya existe');
    
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const newUser = this.userRepository.create({ ...data, password: hashedPassword });
    return this.userRepository.save(newUser);
  }
  async removeUser(id: number) {
    return this.userRepository.delete(id);
  }
  // Actualizar Perfil (Cualquier usuario)
  async updateProfile(id: number, data: any) {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    // El rol no se actualiza aquí por seguridad
    const { role, ...updateData } = data; 
    await this.userRepository.update(id, updateData);
    return this.userRepository.findOne({ where: { id } });
  }
  // Lógica para validar el login
  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.userRepository.findOne({ where: { username } });
    if (user && await bcrypt.compare(pass, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }
  async login(user: any) {
    const payload = { username: user.username, sub: user.id, role: user.role };
    const nuevoToken = this.jwtService.sign(payload);

    // 1. Sobrescribimos el token en la base de datos (Expulsa a la PC anterior)
    await this.userRepository.update(user.id, { token_actual: nuevoToken });

    return {
      access_token: nuevoToken,
      user: {
        id: user.id,
        nombre: user.nombre_completo,
        role: user.role,
        foto: user.foto,
        edad: user.edad,
        username: user.username
      }
    };
  }
}