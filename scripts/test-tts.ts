import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { CartesiaTtsService } from '../src/interview/voice/cartesia-tts.service.js';
import { LlmInterviewerService, Message } from '../src/interview/voice/llm-interviewer.service.js';

dotenv.config();

async function* singleMessage(text: string): AsyncGenerator<string> {
  for (const char of text) {
    yield char;
    await new Promise((r) => setTimeout(r, 1));
  }
}

async function main() {
  const ttsService = new CartesiaTtsService();
  const llmService = new LlmInterviewerService();

  console.log('Generating questions...');
  const questions = await llmService.generateQuestions('behavioral', {});

  const history: Message[] = [];
  const tokenStream = llmService.streamAnswer('behavioral', questions, history, 'Привет, начнём интервью на русском языке.');

  const chunks: Buffer[] = [];
  let chunkCount = 0;

  console.log('Streaming LLM → TTS...');

  await ttsService.streamAudio(
    tokenStream,
    (chunk) => {
      chunks.push(chunk);
      chunkCount++;
      process.stdout.write(`\rAudio chunks received: ${chunkCount}`);
    },
    () => false,
  );

  const total = Buffer.concat(chunks);
  fs.writeFileSync('test-output.pcm', total);

  console.log(`\nDone. Written ${total.length} bytes to test-output.pcm`);
  console.log('Play with: ffplay -f s16le -ar 16000 -ac 1 test-output.pcm');
}

main().catch(console.error);
