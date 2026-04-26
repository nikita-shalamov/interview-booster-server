import { Injectable } from '@nestjs/common';
import { streamText, generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type {
  InterviewType,
  InterviewConfig,
  GeneratedQuestion,
} from '../entities/interview.entity';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPTS: Record<InterviewType, string> = {
  test: `You are a friendly interviewer conducting a short introductory session.
Ask exactly these 3 questions in order, one at a time:
1. "Привет! Это тестовое интервью, чтобы ты мог познакомиться с форматом. Скажи, как тебя зовут?"
2. "Где ты живёшь?"
3. "Какое направление в IT тебя интересует?"
After the third answer give a short warm closing and end your message with the exact phrase: "interview complete"`,
  behavioral: `You are a professional HR interviewer conducting a behavioral interview.
Ask questions using the STAR method (Situation, Task, Action, Result).
Focus on past experience, teamwork, conflict resolution, leadership, and soft skills.`,

  algorithms: `You are a senior software engineer conducting a technical interview.
Ask questions about algorithms, data structures, time/space complexity, and coding problems.
Ask the candidate to explain their approach and reasoning step by step.`,

  system_design: `You are a staff engineer conducting a system design interview.
Ask questions about designing scalable distributed systems, architecture decisions, databases, APIs, and trade-offs.
Probe for depth on scalability, reliability, and performance considerations.`,

  full: `You are an experienced technical interviewer conducting a comprehensive interview.
Alternate between behavioral questions (STAR method, soft skills) and technical questions (algorithms, system design).
Cover both communication/experience and engineering depth.`,
};

const COMMON_RULES = `
Rules:
- Ask ONE question at a time
- After the candidate answers, give a brief 1-sentence acknowledgment, then ask the next question
- Keep your responses under 3 sentences — this is a voice interview
- Conduct the interview in the same language as the questions are written. If the candidate responds in a different language, switch to their language and stay in it
- Start by greeting the candidate and asking the first question immediately
- CRITICAL: When the interview is finished, you MUST end your final message with the exact phrase "interview complete" — this is required to close the session`;

@Injectable()
export class LlmInterviewerService {
  constructor() {}

  private parseJson<T>(text: string): T {
    const cleaned = text
      .replace(/```(?:json)?\s*/gi, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(cleaned) as T;
  }

  async generateQuestions(
    interviewType: InterviewType,
    config: InterviewConfig,
  ): Promise<GeneratedQuestion[]> {
    const questionCounts: Record<InterviewType, number> = {
      test: 3,
      behavioral: 5,
      algorithms: 5,
      system_design: 4,
      full: 7,
    };

    const count = config.questionCount ?? questionCounts[interviewType];
    const difficulty = config.difficulty ?? 'middle';
    const topics = config.topics?.join(', ') ?? 'general';

    const prompt = `You are an interview question generator. Generate exactly ${count} interview questions for a ${interviewType} interview.
Difficulty level: ${difficulty}
Topics: ${topics}

Return ONLY a valid JSON array with no markdown code blocks, no extra text. Each object should have "index" (1-based) and "text" fields.
Example format: [{"index": 1, "text": "Question 1?"}, {"index": 2, "text": "Question 2?"}]`;

    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5'),
      prompt,
    });

    let questions: GeneratedQuestion[];
    try {
      questions = this.parseJson<GeneratedQuestion[]>(text);
    } catch {
      throw new Error('Failed to generate questions');
    }

    return questions;
  }

  async *streamAnswer(
    interviewType: InterviewType,
    questions: GeneratedQuestion[],
    history: Message[],
    userText: string,
  ): AsyncGenerator<string> {
    history.push({ role: 'user', content: userText });

    const questionsSection =
      interviewType !== 'test'
        ? `\n\nYou MUST follow this exact list of questions. Do NOT ask any questions outside this list:\n${questions.map((q) => `${q.index}. ${q.text}`).join('\n')}\n\nRules for question flow:\n- Ask each question in order, one at a time\n- You may ask ONE brief clarifying follow-up if the answer is vague or incomplete, then move on\n- Do NOT invent new topics, new questions, or go off-script\n- After the last question is answered, close the interview and say "interview complete"`
        : '';

    const systemPrompt = `${SYSTEM_PROMPTS[interviewType]}${questionsSection}

${COMMON_RULES}`;

    const { textStream } = streamText({
      model: anthropic('claude-haiku-4-5'),
      system: systemPrompt,
      messages: history,
    });

    let fullResponse = '';
    for await (const token of textStream) {
      fullResponse += token;
      yield token;
    }

    history.push({ role: 'assistant', content: fullResponse });
  }
}
