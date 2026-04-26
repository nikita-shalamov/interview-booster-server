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
import { InterviewTemplate } from './interview-template.entity';

export type InterviewType = 'full' | 'algorithms' | 'system_design' | 'behavioral' | 'test';
export type InterviewStatus = 'pending' | 'in_progress' | 'completed';

export type InterviewConfig = {
  duration?: number;
  difficulty?: 'junior' | 'middle' | 'senior';
  topics?: string[];
  questionCount?: number;
};

export type GeneratedQuestion = {
  index: number;
  text: string;
};

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

  @Column({ type: 'jsonb', nullable: true })
  config: InterviewConfig | null;

  @Column({ type: 'jsonb', nullable: true })
  questions: GeneratedQuestion[] | null;

  @ManyToOne(() => InterviewTemplate, (template) => template.interviews, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({ name: 'template_id' })
  template?: InterviewTemplate;

  @Column({ nullable: true })
  template_id?: number;

  @OneToMany(() => InterviewAnswer, (a) => a.interview, { cascade: true })
  answers: InterviewAnswer[];

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;
}
