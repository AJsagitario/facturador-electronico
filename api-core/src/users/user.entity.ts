import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum UserRole {
  ADMIN = 'ADMIN',           // Contadora / Administradora (Todo + Dashboard)
  RECEPCION = 'RECEPCION',   // Chicas de recepción (Solo Emisión)
  CONTADOR = 'CONTADOR'      // El contador externo (Solo Reportes + Excel Contasis)
}
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string; // Guardaremos esto encriptado con Bcrypt

  @Column()
  nombre_completo: string;

  @Column({ type: 'int', default: 18 })
  edad: number;

  @Column({ type: 'text', nullable: true }) 
  foto: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.RECEPCION
  })
  role: UserRole;

  @Column({ type: 'text', nullable: true })
  token_actual: string;
}