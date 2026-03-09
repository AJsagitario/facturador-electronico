import { Controller, Post, Body, UnauthorizedException, Get, Query, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SingleSessionGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login') 
  async login(@Body() body: any) {
    const user = await this.authService.validateUser(body.username, body.password);
    if (!user) throw new UnauthorizedException('Usuario o contraseña incorrectos');
    return this.authService.login(user);
  }

  @UseGuards(SingleSessionGuard)
  @Get('users') // Listar todos (Admin)
  async getUsers(@Query('role') role: any) {
    return this.authService.findAllUsers(role);
  }

  @UseGuards(SingleSessionGuard)
  @Get('check-session')
  async checkSession() {
    return { status: 'ok', message: 'Sesión válida'};
  }

  @UseGuards(SingleSessionGuard)
  @Post('register') // Crear nuevo (Admin)
  async register(@Body() body: any) {
    return this.authService.createUser(body);
  }

  @UseGuards(SingleSessionGuard)
  @Patch('profile/:id') // Editar perfil propio
  async updateProfile(@Param('id') id: string, @Body() body: any) {
    return this.authService.updateProfile(+id, body);
  }

  @UseGuards(SingleSessionGuard)
  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.authService.removeUser(+id);
  }
}