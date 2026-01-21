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

export type RejectionStage =
  | 'no_response'
  | 'hr_interview'
  | 'hiring_manager'
  | 'after_offer';

export type RoadmapStep =
  | 'review_resume'
  | 'hr_interview'
  | 'tech_interview'
  | 'cover_letter';

export interface RoadmapItem {
  step: RoadmapStep;
  count: number;
}

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

  @Column({ type: 'varchar', nullable: true })
  rejectionStage: RejectionStage;

  @Column({ type: 'text', nullable: true })
  resumeText: string;

  // Результаты анализа
  @Column({ type: 'varchar', nullable: true })
  mostDifficult: RejectionStage;

  @Column({ type: 'simple-array', nullable: true })
  good: string[];

  @Column({ type: 'simple-array', nullable: true })
  bad: string[];

  @Column({ type: 'json', nullable: true })
  roadmap: RoadmapItem[];
}
