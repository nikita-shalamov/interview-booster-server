import * as dotenv from 'dotenv';
import { LlmInterviewerService, Message } from '../src/interview/voice/llm-interviewer.service.js';

dotenv.config();

async function main() {
  const service = new LlmInterviewerService();
  const history: Message[] = [];

  console.log('Generating questions...');
  const questions = await service.generateQuestions('behavioral', {});
  console.log(`Generated ${questions.length} questions`);

  const exchanges = [
    '__START__',
    'Я работал в команде из 5 человек, мы делали мобильное приложение.',
    'Был конфликт с коллегой по поводу архитектуры, я предложил провести встречу и обсудить плюсы и минусы каждого подхода.',
  ];

  for (const userText of exchanges) {
    console.log(`\n[USER]: ${userText}`);
    process.stdout.write('[AI]: ');
    for await (const token of service.streamAnswer('behavioral', questions, history, userText)) {
      process.stdout.write(token);
    }
    console.log();
  }
}

main().catch(console.error);
