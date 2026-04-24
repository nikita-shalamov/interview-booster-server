import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Resume } from '../../resume/entities/resume.entity';

@Entity('cover_letter')
export class CoverLetter {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: number;

  @ManyToOne(() => Resume, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resume_id' })
  resume: Resume;

  @Column({ nullable: true })
  resume_id: number;

  @Column({ type: 'varchar' })
  type: 'universal' | 'targeted';

  @Column({ type: 'text', nullable: true })
  jobDescription: string | null;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  created_at: Date;
}
