import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { DeepgramClient } from '@deepgram/sdk';

dotenv.config();

async function main() {
  const audioPath = path.resolve('test-audio.wav');
  if (!fs.existsSync(audioPath)) {
    console.error('Audio file not found:', audioPath);
    process.exit(1);
  }

  const client = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });

  console.log('Connecting to Deepgram...');

  const connection = await client.listen.v1.connect({
    Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
    model: 'nova-3',
    language: 'en',
    encoding: 'linear16',
    sample_rate: 44100,
    smart_format: 'true',
    interim_results: 'true',
    utterance_end_ms: 1000,
    vad_events: 'true',
  });

  connection.on('message', (msg) => {
    if (msg.type === 'SpeechStarted') {
      console.log('[SPEECH STARTED]');
    } else if (msg.type === 'Results' && msg.is_final && msg.speech_final) {
      const text = msg.channel.alternatives[0]?.transcript?.trim();
      if (text) console.log('[TRANSCRIPT]', text);
    } else if (msg.type === 'UtteranceEnd') {
      console.log('[UTTERANCE END]');
    }
  });

  connection.on('error', (e) => console.error('[ERROR]', e));
  connection.on('close', () => console.log('[CLOSED]'));

  connection.connect();
  await connection.waitForOpen();
  console.log('Connected. Streaming audio...');

  const audioBuffer = fs.readFileSync(audioPath);
  // пропустить WAV-заголовок (44 байта)
  const pcmData = audioBuffer.subarray(44);
  const chunkSize = 4096;

  for (let i = 0; i < pcmData.length; i += chunkSize) {
    connection.sendMedia(pcmData.subarray(i, i + chunkSize));
    await new Promise((r) => setTimeout(r, 20));
  }

  console.log('Done streaming. Waiting for final transcripts...');
  await new Promise((r) => setTimeout(r, 3000));

  connection.sendFinalize({ type: 'Finalize' });
  await new Promise((r) => setTimeout(r, 1000));
  connection.close();
}

main().catch(console.error);
