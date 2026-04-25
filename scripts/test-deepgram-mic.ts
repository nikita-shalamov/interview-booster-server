import * as dotenv from 'dotenv';
import { spawn } from 'child_process';
import { DeepgramClient } from '@deepgram/sdk';

dotenv.config();

async function main() {
  const client = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });

  console.log('Connecting to Deepgram...');

  const connection = await client.listen.v1.connect({
    Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
    model: 'nova-3',
    language: 'ru',
    encoding: 'linear16',
    sample_rate: 16000,
    smart_format: 'true',
    interim_results: 'true',
    utterance_end_ms: 1000,
    vad_events: 'true',
  });

  const finalPhrases: string[] = [];

  connection.on('message', (msg) => {
    if (msg.type === 'SpeechStarted') {
      process.stdout.write('\n[слушаю...] ');
    } else if (msg.type === 'Results') {
      const text = msg.channel.alternatives[0]?.transcript?.trim();
      if (!text) return;
      if (msg.is_final && msg.speech_final) {
        finalPhrases.push(text);
        console.log('\n[ФИНАЛ]', text);
      } else if (!msg.is_final) {
        process.stdout.write(`\r[...] ${text}    `);
      }
    }
  });

  connection.on('error', (e) => console.error('[ERROR]', e));
  connection.on('close', () => console.log('\n[соединение закрыто]'));

  connection.connect();
  await connection.waitForOpen();

  console.log('Микрофон активен. Говори! Ctrl+C для остановки.\n');

  // ffmpeg захватывает микрофон → raw PCM16 16kHz mono → stdout
  const ffmpeg = spawn(
    'ffmpeg',
    [
      '-f',
      'avfoundation', // macOS audio capture
      '-i',
      ':0', // дефолтный микрофон
      '-ar',
      '16000', // 16kHz
      '-ac',
      '1', // mono
      '-f',
      's16le', // raw PCM16 little-endian
      '-', // в stdout
    ],
    { stdio: ['ignore', 'pipe', 'ignore'] },
  );

  ffmpeg.stdout.on('data', (chunk: Buffer) => {
    connection.sendMedia(chunk);
  });

  ffmpeg.on('error', (e) => console.error('ffmpeg error:', e.message));

  process.on('SIGINT', () => {
    console.log('\nОстанавливаю...');
    ffmpeg.kill();
    connection.sendFinalize({ type: 'Finalize' });
    setTimeout(() => {
      connection.close();
      console.log('\n─────────────────────────────────');
      console.log('ИТОГОВЫЙ ТЕКСТ:');
      console.log(finalPhrases.join(' '));
      console.log('─────────────────────────────────');
      process.exit(0);
    }, 1500);
  });
}

main().catch(console.error);
