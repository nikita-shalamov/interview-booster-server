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
    onInterimTranscript?: (text: string) => void,
  ): Promise<DeepgramConnection> {
    const connection = await this.client.listen.v1.connect({
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      model: 'nova-3',
      language,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1,
      smart_format: 'true',
      interim_results: 'true',
      utterance_end_ms: 2000,
      vad_events: 'true',
      endpointing: 1000,
    });

    let isFinalBuffer: string[] = [];

    connection.on('message', (msg) => {
      if (msg.type === 'SpeechStarted') {
        onSpeechStarted();
        return;
      }

      if (msg.type === 'UtteranceEnd') {
        const buffered = isFinalBuffer.join(' ').trim();
        if (buffered) {
          onFinalTranscript(buffered);
          isFinalBuffer = [];
        }
        return;
      }

      if (msg.type === 'Results' && msg.is_final && msg.speech_final) {
        const text = msg.channel.alternatives[0]?.transcript?.trim();
        if (text) {
          isFinalBuffer.push(text);
        }
        const buffered = isFinalBuffer.join(' ').trim();
        if (buffered) {
          onFinalTranscript(buffered);
          isFinalBuffer = [];
        } else {
          this.logger.warn('speech_final fired but buffer is empty');
        }
      } else if (msg.type === 'Results' && msg.is_final) {
        const text = msg.channel.alternatives[0]?.transcript?.trim();
        if (text) {
          isFinalBuffer.push(text);
        }
      } else if (msg.type === 'Results' && !msg.is_final) {
        const text = msg.channel.alternatives[0]?.transcript?.trim();
        if (text) {
          const full = isFinalBuffer.length
            ? isFinalBuffer.join(' ') + ' ' + text
            : text;
          onInterimTranscript?.(full);
        }
      }
    });

    connection.on('error', (err) => {
      this.logger.error(`Deepgram WebSocket error: ${err}`);
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
    try {
      connection.sendFinalize({ type: 'Finalize' });
      connection.close();
    } catch {
      // ignore close errors
    }
  }
}
