import { Injectable, Logger } from '@nestjs/common';
import { streamText, generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { InterviewType, InterviewConfig, GeneratedQuestion } from '../entities/interview.entity';

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
After the third answer give a short warm closing and say: "interview complete"`,
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
- Use the same language as the candidate (if they answer in Russian, conduct the interview in Russian)
- Start by greeting the candidate and asking the first question immediately
- When the interview is finished, say the phrase "interview complete" to signal the end`;

@Injectable()
export class LlmInterviewerService {
  private readonly logger = new Logger(LlmInterviewerService.name);

  async generateQuestions(
    interviewType: InterviewType,
    config: InterviewConfig,
  ): Promise<GeneratedQuestion[]> {
    this.logger.log(
      `[generateQuestions] ▶️  START: type=${interviewType} config=${JSON.stringify(config)}`,
    );

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

    this.logger.log(`[generateQuestions] 🧠 Claude response: ${text.slice(0, 200)}...`);

    let questions: GeneratedQuestion[];
    try {
      questions = JSON.parse(text);
      this.logger.log(`[generateQuestions] ✅ Parsed ${questions.length} questions`);
    } catch {
      this.logger.error(`[generateQuestions] ❌ Failed to parse JSON: ${text}`);
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
    this.logger.log(
      `[streamAnswer] ▶️  START: type=${interviewType} userText="${userText}" questionsLen=${questions.length} historyLen=${history.length}`,
    );
    history.push({ role: 'user', content: userText });

    const questionsText = questions
      .map((q) => `${q.index}. ${q.text}`)
      .join('\n');

    const systemPrompt = `${SYSTEM_PROMPTS[interviewType]}

Questions to cover (in order):
${questionsText}

Based on the conversation history, work through the questions in order.
You can ask follow-ups, request clarification, or ask the candidate to elaborate.
If the answer is off-topic or incomplete, push back or ask again.
Move to the next question only when satisfied with the current answer.

When all questions are covered, say "interview complete".

${COMMON_RULES}`;

    this.logger.log(
      `[streamAnswer] 🧠 Using ${interviewType} interview prompt with ${questions.length} questions, streaming tokens from Claude Haiku...`,
    );
    const { textStream } = streamText({
      model: anthropic('claude-haiku-4-5'),
      system: systemPrompt,
      messages: history,
    });

    let fullResponse = '';
    let tokenCount = 0;
    for await (const token of textStream) {
      fullResponse += token;
      tokenCount++;
      yield token;
    }

    this.logger.log(
      `[streamAnswer] ✅ DONE: tokens=${tokenCount} fullResponse="${fullResponse}"`,
    );
    history.push({ role: 'assistant', content: fullResponse });
  }
}
