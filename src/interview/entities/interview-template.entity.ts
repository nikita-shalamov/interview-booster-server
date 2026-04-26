import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Interview } from './interview.entity';
import { User } from '../../users/entities/user.entity';

export type TemplateCategory = 'behavioral' | 'technical' | 'hybrid';

@Entity('interview_templates')
export class InterviewTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar' })
  category: TemplateCategory;

  @Column({ type: 'varchar' })
  interviewType: string;

  @Column({ type: 'simple-array', default: '{}' })
  applicableRoles: string[];

  @Column({ type: 'varchar' })
  minLevel: string;

  @Column({ type: 'varchar' })
  maxLevel: string;

  @Column({ type: 'simple-array', default: '{}' })
  skills: string[];

  @Column({ type: 'simple-array', default: '{}' })
  topics: string[];

  @Column({ type: 'int', default: 30 })
  estimatedDuration: number;

  @Column({ type: 'int', default: 5 })
  questionCount: number;

  @Column({ type: 'varchar' })
  difficulty: string;

  @Column({ type: 'boolean', default: false })
  isRecommended: boolean;

  @Column({ type: 'int', default: 999 })
  recommendationOrder: number;

  @Column({ type: 'text', nullable: true })
  tips: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isUserGenerated: boolean;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser?: User;

  @Column({ nullable: true })
  created_by_user_id?: number;

  @OneToMany(() => Interview, (interview) => interview.template, {
    nullable: true,
  })
  interviews?: Interview[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
