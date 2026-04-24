import { Injectable, Logger } from '@nestjs/common';
import { generateText, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type {
  ParsedResume,
  ResumeEvaluation,
} from '../resume/types/resume.types';

const evaluationSchema = z.object({
  overallScore: z.number(),
  strengths: z.array(z.string()).min(1),
  weaknesses: z.array(z.string()).min(1),
  issues: z.array(
    z.object({
      description: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
    }),
  ),
  recommendations: z.array(z.string()).min(1),
  suitableRoles: z.array(z.string()).min(1),
  estimatedLevel: z.enum(['junior', 'middle', 'senior']),
});

const atsSchema = z.object({
  atsScore: z.number(),
  issues: z.array(
    z.object({
      issue: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
    }),
  ),
  recommendations: z.array(z.string()),
});

const diffListSchema = z.object({
  diffs: z.array(
    z.object({
      original: z.string().min(1),
      improved: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
});

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  async generateChatTitle(firstUserMessage: string) {
    try {
      const { text } = await generateText({
        model: anthropic('claude-haiku-4-5'),
        system: `Сгенерируй короткое название чата по первому сообщению пользователя.
        ВАЖНО!! Оно должно описывать то, что юзер просит в первом сообщении!! Используй те же слова, которые использует юзер!!
Ответь одной строкой: только заголовок.
Без кавычек, без префиксов вроде "Название:", максимум 20-30 символов.`,
        prompt: firstUserMessage.trim(),
      });
      return text;
    } catch (error) {
      this.logger.error('generateChatTitle failed', error);
    }
  }

  async parseResume(originalText: string): Promise<ParsedResume> {
    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5'),
      system: `You are a resume parser. Extract structured data from the resume text and return ONLY valid JSON matching this exact schema:
{
  "contacts": {
    "name": "full name or empty string",
    "email": "email or empty string",
    "phone": "phone or empty string",
    "telegram": "telegram handle or empty string",
    "github": "github url or handle or empty string",
    "linkedin": "linkedin url or empty string",
    "location": "city/country or empty string",
    "other": []
  },
  "sections": [
    {
      "type": "summary" | "experience" | "education" | "skills" | "projects" | "certifications" | "languages" | "other",
      "title": "original section heading",
      "items": [
        // For experience: { "kind": "experience", "company": "", "role": "", "period": "", "location": "", "bullets": [] }
        // For education: { "kind": "education", "institution": "", "degree": "bachelor/master/etc or empty string", "field": "specialization", "period": "", "location": "city/country or empty string", "gpa": "" }
        // For skills: { "kind": "skills", "category": "", "items": [] }
        // For summary/other: { "kind": "text", "content": "" }
      ]
    }
  ]
}
Rules:
- Always extract contacts from the header/top of the resume, even if not in a named section.
- For contacts: look for name, email, phone, telegram (@handle), github (URL or just the word "GitHub" if no link), linkedin (URL or just the word "LinkedIn"), and location.
- If you find just the text "GitHub" or "LinkedIn" without a URL, extract it as the value (e.g., github: "GitHub" if no actual URL found).
- For education: "degree" is the academic degree level. Use the same language as the resume. If not explicitly stated but it's a university, infer the degree in the resume language (e.g. "Бакалавр" for Russian resumes, "Bachelor" for English). "field" is the specialization/major. Extract "location" (city) if present.
- Return ONLY the JSON object, no markdown, no explanation.`,
      prompt: originalText,
    });

    const clean = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    return JSON.parse(clean) as ParsedResume;
  }

  async analyzeDiff(
    parsedContent: ParsedResume,
    role: string,
    level: string,
  ): Promise<{ original: string; improved: string; reason: string }[]> {
    const { output } = await generateText({
      model: anthropic('claude-haiku-4-5'),
      system: `You are a professional resume coach. Analyze the resume and return a list of improvement suggestions.

Context: candidate role — ${role}, level — ${level}.

For each suggestion return:
- original: exact text from the resume (a bullet point or summary sentence), copied character-for-character
- improved: improved version in the same language
- reason: 1-2 sentences why this is better

Rules:
- "original" must match exactly what is in the resume — do not paraphrase or trim
- Focus on: quantifying achievements, stronger action verbs, adding missing context
- Suggest improvements for 4-8 items across different sections
- Tailor to level: junior — clarity and concrete results; senior — metrics and business impact`,
      output: Output.object({ schema: diffListSchema }),
      prompt: JSON.stringify(parsedContent),
    });

    return output.diffs;
  }

  async evaluateResume(
    parsedContent: ParsedResume,
    role: string,
    level: string,
  ): Promise<ResumeEvaluation> {
    const { output } = await generateText({
      model: anthropic('claude-haiku-4-5'),
      system: `You are a professional resume reviewer. Evaluate the resume and return a structured assessment.

Context: candidate role — ${role}, level — ${level}.

Rules:
- overallScore: 0–100, honest assessment of resume quality
- strengths: 3–5 strong points
- weaknesses: 3–5 areas that need improvement
- issues: specific problems with severity (low/medium/high)
- recommendations: top 3–5 actionable improvements
- suitableRoles: job titles this resume is suitable for
- estimatedLevel: your assessment of the candidate's level (junior/middle/senior)
- Use the same language as the resume`,
      output: Output.object({ schema: evaluationSchema }),
      prompt: JSON.stringify(parsedContent),
    });

    return output as ResumeEvaluation;
  }

  async atsResume(parsedContent: ParsedResume): Promise<{
    atsScore: number;
    issues: { issue: string; severity: 'low' | 'medium' | 'high' }[];
    recommendations: string[];
  }> {
    const { output } = await generateText({
      model: anthropic('claude-haiku-4-5'),
      system: `You are an ATS (Applicant Tracking System) expert. Evaluate the resume for ATS compatibility and return a structured result.

Check:
- Standard section headings (ATS scanners look for specific names)
- Keywords relevant to the specialization
- Absence of tables, columns, non-standard elements (parsed poorly by ATS)
- Contact information completeness
- Length and format

Rules:
- atsScore: 0–100, honest ATS compatibility score
- issues: specific ATS problems with severity (low/medium/high)
- recommendations: actionable fixes to improve ATS score
- Use the same language as the resume`,
      output: Output.object({ schema: atsSchema }),
      prompt: JSON.stringify(parsedContent),
    });

    return output;
  }

  async generateCoverLetter(params: {
    resumeText: string;
    role: string;
    level: string;
    type: 'universal' | 'targeted';
    jobDescription?: string;
  }): Promise<string> {
    const { resumeText, role, level, type, jobDescription } = params;

    const system =
      type === 'targeted'
        ? `You are a professional cover letter writer. Write a compelling cover letter tailored to the job description.
Context: candidate role — ${role}, level — ${level}.
Rules:
- Address the specific requirements from the job description
- Highlight relevant experience and skills from the resume
- 3–4 paragraphs, professional tone
- Use the same language as the resume
- Return only the cover letter text, no subject line, no placeholders`
        : `You are a professional cover letter writer. Write a compelling universal cover letter based on the resume.
Context: candidate role — ${role}, level — ${level}.
Rules:
- Highlight the strongest skills and achievements from the resume
- 3–4 paragraphs, professional tone
- Use the same language as the resume
- Return only the cover letter text, no subject line, no placeholders`;

    const prompt =
      type === 'targeted'
        ? `Resume:\n${resumeText}\n\nJob description:\n${jobDescription}`
        : `Resume:\n${resumeText}`;

    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5'),
      system,
      prompt,
    });

    return text.trim();
  }

  async searchGoogle(query: string): Promise<string> {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
        },
        body: JSON.stringify({ query, max_results: 1 }),
      });

      const data = await res.json();
      return data.results[0].content as string;
    } catch (error) {
      this.logger.error('searchGoogle failed', error);
      return '';
    }
  }
}
