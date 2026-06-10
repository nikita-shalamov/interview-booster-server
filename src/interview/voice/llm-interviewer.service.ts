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
  behavioral: `Ты профессиональный HR-интервьюер, проводящий поведенческое интервью на русском языке.
Задавай вопросы по методу STAR (Ситуация, Задача, Действие, Результат).
Фокусируйся на прошлом опыте, командной работе, разрешении конфликтов, лидерстве и soft skills.`,

  algorithms: `Ты senior-разработчик, проводящий техническое интервью на русском языке.
Задавай вопросы по алгоритмам, структурам данных, сложности по времени и памяти, задачам на код.
Просто кандидата объяснять свой подход и рассуждения шаг за шагом.`,

  system_design: `Ты staff-инженер, проводящий интервью по системному дизайну на русском языке.
Задавай вопросы о проектировании масштабируемых распределённых систем, архитектурных решениях, базах данных, API и компромиссах.
Углубляйся в масштабируемость, надёжность и производительность.`,

  full: `Ты опытный технический интервьюер, проводящий комплексное интервью на русском языке.
Чередуй поведенческие вопросы (метод STAR, soft skills) и технические вопросы (алгоритмы, системный дизайн).
Охватывай и коммуникацию/опыт, и инженерную глубину.`,
};

const COMMON_RULES = `
Правила:
- Задавай ОДИН вопрос за раз
- После ответа кандидата дай краткое подтверждение в 1 предложение, затем задай следующий вопрос
- Держи ответы не длиннее 3 предложений — это голосовое интервью
- Всегда говори на русском языке, независимо от языка ответов кандидата
- Начни с приветствия и сразу задай первый вопрос
- КРИТИЧНО: когда интервью завершено, ты ОБЯЗАН закончить последнее сообщение точной фразой "interview complete" — это нужно для закрытия сессии`;

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

    const prompt = `Ты генератор вопросов для интервью. Сгенерируй ровно ${count} вопросов для ${interviewType} интервью на русском языке.
Уровень сложности: ${difficulty}
Темы: ${topics}

Верни ТОЛЬКО валидный JSON-массив без markdown-блоков и лишнего текста. Каждый объект должен иметь поля "index" (с 1) и "text".
Пример формата: [{"index": 1, "text": "Вопрос 1?"}, {"index": 2, "text": "Вопрос 2?"}]`;

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
