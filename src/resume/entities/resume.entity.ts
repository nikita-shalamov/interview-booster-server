import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import type { ParsedResume, ResumeEvaluation } from '../types/resume.types';

@Entity('resume')
export class Resume {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: number;

  @Column({ type: 'varchar', nullable: true })
  filename: string;

  @Column({ type: 'varchar', nullable: true })
  mimeType: string;

  @Column({ type: 'text' })
  originalText: string;

  @Column({ type: 'jsonb', nullable: true })
  parsedContent: ParsedResume;

  @Column({ type: 'jsonb', nullable: true })
  evaluation: ResumeEvaluation;

  @Column({ type: 'int', nullable: true })
  atsScore: number;

  @Column({ type: 'jsonb', nullable: true })
  atsIssues: { issue: string; severity: 'low' | 'medium' | 'high' }[];

  @Column({ type: 'jsonb', nullable: true })
  atsRecommendations: string[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
