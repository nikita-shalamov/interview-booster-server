import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { InterviewAnswer } from './interview-answer.entity';

export type InterviewType = 'full' | 'algorithms' | 'system_design' | 'behavioral' | 'test';
export type InterviewStatus = 'pending' | 'in_progress' | 'completed';

@Entity('interview')
export class Interview {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: number;

  @Column({ type: 'varchar' })
  type: InterviewType;

  @Column({ type: 'varchar', default: 'pending' })
  status: InterviewStatus;

  @Column({ type: 'int', nullable: true })
  totalScore: number | null;

  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  @OneToMany(() => InterviewAnswer, (a) => a.interview, { cascade: true })
  answers: InterviewAnswer[];

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;
}
