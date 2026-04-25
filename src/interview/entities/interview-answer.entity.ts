import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Interview } from './interview.entity';

export type AnswerScore = 'correct' | 'partial' | 'incorrect';

@Entity('interview_answer')
export class InterviewAnswer {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Interview, (i) => i.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'interview_id' })
  interview: Interview;

  @Column()
  interview_id: number;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text', nullable: true })
  userAnswer: string | null;

  @Column({ type: 'varchar', nullable: true })
  score: AnswerScore | null;

  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  @CreateDateColumn()
  created_at: Date;
}
