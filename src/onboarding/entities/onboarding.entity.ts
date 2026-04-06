import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type Role =
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'mobile'
  | 'qa'
  | 'devops'
  | 'data'
  | 'product'
  | 'other';

export type Level =
  | 'junior'
  | 'junior_plus'
  | 'middle'
  | 'middle_plus'
  | 'senior'
  | 'not_sure';

@Entity('onboarding')
export class Onboarding {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: number;

  @Column({ type: 'varchar', nullable: true })
  role: Role;

  @Column({ type: 'varchar', nullable: true })
  level: Level;

  @Column({ type: 'text', nullable: true })
  resumeText: string;

  @Column({ type: 'simple-array', nullable: true })
  good: string[];

  @Column({ type: 'simple-array', nullable: true })
  bad: string[];
}
