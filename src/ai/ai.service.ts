import { Injectable, Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { ParsedResume } from '../resume/types/resume.types';

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
