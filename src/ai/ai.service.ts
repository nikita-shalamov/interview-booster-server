import { Injectable, Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  async generateChatTitle(firstUserMessage: string) {
    try {
      const { text } = await generateText({
        model: anthropic('claude-haiku-4-5'),
        system: `Сгенерируй короткое название чата по первому сообщению пользователя.
Ответь одной строкой: только заголовок на русском языке.
Без кавычек, без префиксов вроде "Название:", максимум 80 символов.
Если сообщение на другом языке — заголовок всё равно на русском.`,
        prompt: firstUserMessage.trim(),
      });
      return text;
    } catch (error) {
      this.logger.error('generateChatTitle failed', error);
    }
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
