import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Resume } from './resume.entity';
import type { ParsedResumeWithDiffs } from '../types/resume.types';

@Entity('resume_diffs')
export class ResumeDiff {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Resume, (r) => r.diffs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resume_id' })
  resume: Resume;

  @Column()
  resume_id: number;

  @Column({ type: 'jsonb' })
  content: ParsedResumeWithDiffs;

  @CreateDateColumn()
  created_at: Date;
}
