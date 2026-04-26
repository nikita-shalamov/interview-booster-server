import { Injectable } from '@nestjs/common';
import Cartesia from '@cartesia/cartesia-js';
import type { TTSWSContext } from '@cartesia/cartesia-js/resources/tts/ws.js';

const SENTENCE_BOUNDARIES = /[.!?,]/;

@Injectable()
export class CartesiaTtsService {
  private readonly client = new Cartesia({
    apiKey: process.env.CARTESIA_API_KEY,
  });

  async streamAudio(
    tokenStream: AsyncGenerator<string>,
    onChunk: (buf: Buffer) => void,
    isCancelled: () => boolean,
    language: 'ru' | 'en' = 'ru',
  ): Promise<void> {
    const ws = await this.client.tts.websocket();

    const context = ws.context({
      model_id: 'sonic-2-2025-03-07',
      voice: { id: process.env.CARTESIA_VOICE_ID!, mode: 'id' },
      output_format: {
        container: 'raw',
        encoding: 'pcm_s16le',
        sample_rate: 16000,
      },
    });

    await Promise.all([
      this._pushTokens(tokenStream, context, isCancelled, language),
      this._receiveAudio(context, onChunk, isCancelled),
    ]);

    ws.close();
  }

  private async _pushTokens(
    tokenStream: AsyncGenerator<string>,
    context: TTSWSContext,
    isCancelled: () => boolean,
    language: 'ru' | 'en',
  ): Promise<void> {
    const sendChunk = (transcript: string, cont: boolean) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (context as any)._ws.send({
        model_id: 'sonic-2-2025-03-07',
        voice: { id: process.env.CARTESIA_VOICE_ID!, mode: 'id' },
        output_format: {
          container: 'raw',
          encoding: 'pcm_s16le',
          sample_rate: 16000,
        },
        language,
        transcript,
        context_id: context.contextId,
        continue: cont,
      });

    let buffer = '';
    let chunkCount = 0;

    for await (const token of tokenStream) {
      if (isCancelled()) break;
      buffer += token;
      if (SENTENCE_BOUNDARIES.test(buffer)) {
        const cleaned = buffer.replace(/\s*interview complete\s*/gi, '').trim();
        if (cleaned) {
          await sendChunk(cleaned, true);
          chunkCount++;
        }
        buffer = '';
      }
    }

    if (buffer.trim() && !isCancelled()) {
      const cleaned = buffer.replace(/\s*interview complete\s*/gi, '').trim();
      if (cleaned) {
        await sendChunk(cleaned, true);
        chunkCount++;
      }
    }

    if (chunkCount > 0) {
      await context.no_more_inputs();
    }
  }

  private async _receiveAudio(
    context: TTSWSContext,
    onChunk: (buf: Buffer) => void,
    isCancelled: () => boolean,
  ): Promise<void> {
    for await (const event of context.receive()) {
      if (isCancelled()) break;
      if (event.type === 'chunk' && event.audio) {
        onChunk(event.audio);
      }
    }
  }
}
