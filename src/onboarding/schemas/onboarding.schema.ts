import { z } from 'zod';

const roadmapItemSchema = z.object({
  step: z.enum([
    'review_resume',
    'hr_interview',
    'tech_interview',
    'cover_letter',
  ]),
  count: z.number(),
});

export const onboardingAnalysisSchema = z.object({
  good: z.array(z.string()).min(1),
  bad: z.array(z.string()).min(1),
  roadmap: z.array(roadmapItemSchema).min(1),
  resumeText: z.string(),
});
