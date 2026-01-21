import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Onboarding } from '../../onboarding/entities/onboarding.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  password?: string;

  @Column({ nullable: true })
  googleId?: string;

  @OneToOne(() => Onboarding, (onboarding) => onboarding.user)
  onboarding?: Onboarding;
}
