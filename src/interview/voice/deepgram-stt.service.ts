import { Injectable, Logger } from '@nestjs/common';
import { DeepgramClient } from '@deepgram/sdk';

type DeepgramConnection = Awaited<
  ReturnType<DeepgramClient['listen']['v1']['connect']>
>;

@Injectable()
export class DeepgramSttService {
  private readonly logger = new Logger(DeepgramSttService.name);
  private readonly client = new DeepgramClient({
    apiKey: process.env.DEEPGRAM_API_KEY,
  });

  async createStream(
    language: 'ru' | 'en',
    onFinalTranscript: (text: string) => void,
    onSpeechStarted: () => void,
  ): Promise<DeepgramConnection> {
    this.logger.log(
      `[createStream] 🎤 Creating Deepgram stream: language=${language} apiKeyPresent=${!!process.env.DEEPGRAM_API_KEY}`,
    );

    const connection = await this.client.listen.v1.connect({
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      model: 'nova-3',
      language,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1,
      smart_format: 'true',
      interim_results: 'true',
      utterance_end_ms: 1000,
      vad_events: 'true',
    });

    connection.on('message', (msg) => {
      if (msg.type === 'SpeechStarted') {
        this.logger.log(`[Deepgram] 🔊 SpeechStarted (VAD detected user speaking)`);
        onSpeechStarted();
        return;
      }

      if (msg.type === 'Results' && msg.is_final && msg.speech_final) {
        const text = msg.channel.alternatives[0]?.transcript?.trim();
        if (text) {
          this.logger.log(`[Deepgram] ✅ Final transcript: "${text}"`);
          onFinalTranscript(text);
        }
      } else if (msg.type === 'Results' && msg.is_final) {
        const text = msg.channel.alternatives[0]?.transcript?.trim();
        if (text) {
          this.logger.debug(
            `[Deepgram] 📝 Interim is_final (not speech_final): "${text}"`,
          );
        }
      }
    });

    connection.on('error', (err) => {
      this.logger.error(`[Deepgram] ❌ WebSocket error: ${err}`);
    });

    connection.connect();

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            'Deepgram connection timeout (10s) — check network/firewall access to wss://api.deepgram.com',
          ),
        );
      }, 10_000);

      connection.on('open', () => {
        clearTimeout(timer);
        this.logger.log(`[createStream] ✅ Deepgram WebSocket connected and ready`);
        resolve();
      });

      connection.on('close', (event) => {
        clearTimeout(timer);
        reject(new Error(`Deepgram closed before open: code=${event?.code}`));
      });
    });

    return connection;
  }

  sendAudio(connection: DeepgramConnection, chunk: Buffer): void {
    try {
      connection.sendMedia(chunk);
    } catch {
      // socket temporarily closed during reconnect — skip chunk
    }
  }

  closeStream(connection: DeepgramConnection): void {
    this.logger.log(`[closeStream] Closing Deepgram stream`);
    try {
      connection.sendFinalize({ type: 'Finalize' });
      connection.close();
    } catch {
      // ignore close errors
    }
  }
}
