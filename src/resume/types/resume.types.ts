export type SectionType =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'languages'
  | 'other';

export interface ExperienceItem {
  kind: 'experience';
  company: string;
  role: string;
  period: string;
  location?: string;
  bullets: string[];
}

export interface EducationItem {
  kind: 'education';
  institution: string;
  degree: string;
  field?: string;
  period?: string;
  location?: string;
  gpa?: string;
}

export interface SkillsItem {
  kind: 'skills';
  category?: string;
  items: string[];
}

export interface TextItem {
  kind: 'text';
  content: string;
}

export type ResumeSectionItem =
  | ExperienceItem
  | EducationItem
  | SkillsItem
  | TextItem;

export interface ResumeSection {
  type: SectionType;
  title: string;
  items: ResumeSectionItem[];
}

export interface ResumeContacts {
  name?: string;
  email?: string;
  phone?: string;
  telegram?: string;
  github?: string;
  linkedin?: string;
  location?: string;
  other?: string[];
}

export interface ParsedResume {
  contacts: ResumeContacts;
  sections: ResumeSection[];
}

export interface ResumeIssue {
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ResumeEvaluation {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  issues: ResumeIssue[];
  recommendations: string[];
  suitableRoles: string[];
  estimatedLevel: string;
}
