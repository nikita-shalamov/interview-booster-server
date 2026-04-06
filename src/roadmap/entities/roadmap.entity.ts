import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type RoadmapStepKey =
  | 'review_resume'
  | 'hr_interview'
  | 'tech_interview'
  | 'cover_letter';

export interface RoadmapStepItem {
  key: RoadmapStepKey;
  totalCount: number;
  completedCount: number;
  isCompleted: boolean;
}

@Entity('roadmap')
export class Roadmap {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ unique: true })
  user_id: number;

  @Column({ type: 'json' })
  steps: RoadmapStepItem[];
}
