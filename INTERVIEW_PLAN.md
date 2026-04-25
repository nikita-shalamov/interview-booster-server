# Interview Module — План реализации

## Стек

| Роль | Технология |
|---|---|
| STT | Deepgram Nova-3 (WebSocket стриминг) |
| LLM | Claude Haiku (streaming tokens) |
| TTS | Cartesia Sonic-2 (WebSocket, `continue: true`) |
| Transport | Socket.IO (`/voice-interview` namespace) |
| Backend | NestJS WebSocket Gateway |
| Frontend | Next.js hook + WebAudio API |

---

## Структура модуля (итоговая)

```
interview/
├── entities/
│   ├── interview.entity.ts           ✅ done
│   └── interview-answer.entity.ts    ✅ done
├── dto/
│   └── create-interview.dto.ts       ✅ done
├── interview.module.ts               ✅ done (заглушка)
├── interview.controller.ts           ✅ done (заглушка)
├── interview.service.ts              ✅ done (заглушка)
└── voice/
    ├── voice-interview.gateway.ts    ← WebSocket + оркестрация
    ├── deepgram-stt.service.ts       ← STT стрим
    ├── llm-interviewer.service.ts    ← промпты + Claude streaming
    ├── cartesia-tts.service.ts       ← TTS стрим
    ├── voice-session.ts              ← состояние одной сессии
    └── barge-in.handler.ts           ← обработка перебивания (VAD)
```

---

## Этап 1 — REST API + бизнес-логика ✅ done

### 1.1 InterviewService — наполнить методы

**`create(userId, dto)`** ✅ — создать сессию:
- Сохранить `Interview` со статусом `pending`
- Вернуть `{ id, type, status }`

**`findAllByUser(userId)`** ✅ — история:
- Вернуть список интервью без `answers`

**`findOne(id, userId)`** ✅ — детали:
- Вернуть интервью + все `InterviewAnswer`

**`complete(id, userId)`** ✅ — завершить:
- Поменять `status → completed`, записать `completed_at`
- Вызвать AI-анализ всех ответов → заполнить `totalScore` и `feedback`
- Инкрементировать шаг roadmap (`hr_interview` если type=`behavioral`/`full`, иначе `tech_interview`)

**`saveAnswer(interviewId, question, userAnswer)`** ✅ — сохранить ответ из голосовой сессии:
- Создать `InterviewAnswer` с `question` и `userAnswer`
- AI оценивает ответ → заполнить `score` и `feedback`

### 1.2 AI-анализ (в AiService) ✅ done

**`evaluateAnswer(question, userAnswer, interviewType)`** ✅:
- Промпт: оценить ответ кандидата
- Вернуть: `{ score: 'correct'|'partial'|'incorrect', feedback: string }`

**`generateInterviewReport(answers, interviewType)`** ✅:
- Промпт: итоговый анализ всех ответов
- Вернуть: `{ totalScore: number, feedback: string }`

---

## Этап 2 — Voice Pipeline: STT (Deepgram) ✅ done

### 2.1 Установка ✅

```bash
npm install @deepgram/sdk
```

Env: `DEEPGRAM_API_KEY`

### 2.2 DeepgramSttService ✅

Файл: `voice/deepgram-stt.service.ts`

- Метод `createStream(onFinalTranscript, onSpeechStarted)`:
  - Открыть `deepgram.listen.live(...)` с параметрами:
    - `model: 'nova-3'`
    - `language: 'ru'` (или `'en'` — пробросить через параметр)
    - `smart_format: true`
    - `interim_results: true`
    - `utterance_end_ms: 1000`
    - `vad_events: true`
  - На событие `Transcript` с `is_final && speech_final` → вызвать `onFinalTranscript(text)`
  - На событие `SpeechStarted` → вызвать `onSpeechStarted()` (для barge-in)
- Метод `sendAudio(connection, chunk: Buffer)` — пробросить чанк в Deepgram
- Метод `closeStream(connection)` — закрыть соединение

---

## Этап 3 — Voice Pipeline: LLM (Claude) ✅ done

### 3.1 LlmInterviewerService

Файл: `voice/llm-interviewer.service.ts`

- Использовать `anthropic` из `@ai-sdk/anthropic` (уже в проекте)
- Метод `streamAnswer(interviewType, history, userText)` — AsyncGenerator<string>:
  - Сформировать `systemPrompt` по типу интервью (см. ниже)
  - Вызвать `streamText` из Vercel AI SDK
  - Yield каждый токен сразу
  - После завершения — добавить в `history` реплики user + assistant

**Системные промпты по типу:**

| type | Промпт |
|---|---|
| `behavioral` | Поведенческое интервью, STAR-метод, вопросы про опыт и soft skills |
| `algorithms` | Алгоритмы и структуры данных, задачи на coding |
| `system_design` | Проектирование систем, архитектурные вопросы |
| `full` | Комбинированное: поведенческие + технические вопросы |

Общие правила для промпта:
- Один вопрос за раз
- Краткая оценка ответа (1 предложение)
- После 10 вопросов — произнести фразу-триггер завершения (`"interview complete"`)
- Ответы до 3 предложений — это голосовой режим

---

## Этап 4 — Voice Pipeline: TTS (Cartesia) ✅ done

### 4.1 Установка

```bash
npm install @cartesia/cartesia-js
```

Env: `CARTESIA_API_KEY`, `CARTESIA_VOICE_ID`

### 4.2 CartesiaTtsService

Файл: `voice/cartesia-tts.service.ts`

- Параметры WebSocket соединения:
  - `container: 'raw'`
  - `encoding: 'pcm_s16le'`
  - `sampleRate: 16000`
  - `modelId: 'sonic-2'`

- Метод `streamAudio(tokenStream: AsyncGenerator<string>, onChunk: (buf: Buffer) => void)`:
  - Читать токены из `tokenStream`
  - Буферизировать до границы предложения (`.`, `!`, `?`, `,`)
  - Отправлять накопленный текст в Cartesia с `continue: true`
  - Получать аудио чанки → вызывать `onChunk`
  - Финальный кусок отправить с `continue: false`

---

## Этап 5 — VoiceSession ✅ done

### 5.1 voice-session.ts

Класс-контейнер состояния одной сессии:

```typescript
class VoiceSession {
  interviewId: number
  interviewType: InterviewType
  language: 'ru' | 'en'
  isAiSpeaking: boolean = false
  isCancelled: boolean = false          // флаг barge-in
  conversationHistory: Message[] = []   // история для LLM
  transcripts: { role, text }[] = []    // для сохранения в БД
}
```

---

## Этап 6 — Gateway (оркестрация) ✅ done

### 6.1 Установка Socket.IO

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
```

### 6.2 VoiceInterviewGateway

Файл: `voice/voice-interview.gateway.ts`

**Namespace:** `/voice-interview`

**События клиент → сервер:**

| Событие | Данные | Действие |
|---|---|---|
| `start_session` | `{ interviewId, language }` | Создать VoiceSession, открыть Deepgram, произнести первый вопрос AI |
| `audio_chunk` | `{ audio: string }` (base64 PCM16) | Пробросить в Deepgram; если `isAiSpeaking` → barge-in |
| `end_session` | `{}` | Сохранить транскрипты, вызвать `complete()`, закрыть Deepgram |

**События сервер → клиент:**

| Событие | Данные | Когда |
|---|---|---|
| `session_ready` | `{}` | Сессия инициализирована, первый вопрос задан |
| `audio_chunk` | `{ audio: string }` (base64 PCM16) | Чанк TTS аудио от AI |
| `transcript` | `{ role, text }` | Финальный транскрипт реплики |
| `ai_interrupted` | `{}` | Barge-in — фронт очищает очередь воспроизведения |
| `session_ended` | `{}` | Сессия завершена, отчёт готов |

**Флоу `start_session`:**
1. Создать `VoiceSession`
2. Открыть Deepgram стрим, подписаться на `onFinalTranscript` и `onSpeechStarted`
3. Вызвать `runAiTurn(session, '__START__')` — AI задаёт первый вопрос
4. Emit `session_ready`

**Флоу `audio_chunk`:**
1. Если `session.isAiSpeaking` → barge-in: `isCancelled = true`, emit `ai_interrupted`
2. Отправить чанк в Deepgram

**Флоу `onFinalTranscript` (callback от Deepgram):**
1. Добавить в `session.transcripts`
2. Emit `transcript { role: 'user', text }`
3. Вызвать `runAiTurn(session, transcript)`

**Флоу `runAiTurn`:**
1. `session.isAiSpeaking = true`, `session.isCancelled = false`
2. Получить `tokenStream` от `LlmInterviewerService.streamAnswer()`
3. Передать в `CartesiaTtsService.streamAudio()`, в `onChunk`:
   - Если `session.isCancelled` → skip
   - Иначе emit `audio_chunk`
4. После завершения: добавить AI-реплику в `session.transcripts`, emit `transcript`
5. `session.isAiSpeaking = false`
6. Если текст AI содержит `"interview complete"` → вызвать `handleEnd()`

**Флоу `end_session`:**
1. Для каждого транскрипта попарно (user + assistant) → `interviewService.saveAnswer()`
2. Вызвать `interviewService.complete()`
3. Закрыть Deepgram стрим
4. Удалить сессию из `Map`
5. Emit `session_ended`

**`handleDisconnect`:** закрыть Deepgram, удалить сессию

---

## Этап 7 — Barge-in handler ✅ done

Файл: `voice/barge-in.handler.ts`

Вспомогательный класс, инкапсулирует логику прерывания:

- `onSpeechStarted(session, client)`:
  - Если `session.isAiSpeaking` → `session.isCancelled = true`, `session.isAiSpeaking = false`, `client.emit('ai_interrupted')`
- Вызывается из Gateway через `onSpeechStarted` callback Deepgram

---

## Этап 8 — Подключение в InterviewModule ✅ done

В `interview.module.ts` добавить:
- `@nestjs/websockets`, `socket.io` в imports
- Провайдеры: `VoiceInterviewGateway`, `DeepgramSttService`, `LlmInterviewerService`, `CartesiaTtsService`, `BargeInHandler`
- Импорт `RoadmapModule` (для обновления шагов после complete)

---

## Порядок реализации

```
1. Наполнить InterviewService (saveAnswer, complete с AI-анализом)
2. Добавить evaluateAnswer и generateInterviewReport в AiService
3. voice-session.ts — класс состояния
4. deepgram-stt.service.ts — STT стрим
5. llm-interviewer.service.ts — Claude streaming с промптами
6. cartesia-tts.service.ts — TTS стрим с буферизацией по предложениям
7. barge-in.handler.ts — логика прерывания
8. voice-interview.gateway.ts — оркестрация всего пайплайна
9. Обновить interview.module.ts — зарегистрировать все провайдеры
10. Фронтенд: useVoiceInterview hook + WebAudio pipeline
```

---

## ENV переменные

```
DEEPGRAM_API_KEY=
CARTESIA_API_KEY=
CARTESIA_VOICE_ID=
```

---

## Latency бюджет

| Этап | Время |
|---|---|
| Deepgram STT | ~200–300ms |
| First LLM token (Claude Haiku) | ~200–400ms |
| Cartesia TTS first chunk | ~80–150ms |
| Network round-trip | ~20–50ms |
| **Итого (first audio)** | **~500–900ms** |

Streaming overlap: TTS стартует с первых токенов LLM — не ждём полного ответа.

---

## Прогресс

- [x] 1. Наполнить InterviewService (saveAnswer, complete с AI-анализом)
- [x] 2. Добавить evaluateAnswer и generateInterviewReport в AiService
- [x] 3. voice-session.ts — класс состояния
- [x] 4. deepgram-stt.service.ts — STT стрим
- [x] 5. llm-interviewer.service.ts — Claude streaming с промптами
- [x] 6. cartesia-tts.service.ts — TTS стрим с буферизацией по предложениям
- [x] 7. barge-in.handler.ts — логика прерывания
- [x] 8. voice-interview.gateway.ts — оркестрация всего пайплайна
- [x] 9. Обновить interview.module.ts — зарегистрировать все провайдеры
- [ ] 10. Фронтенд: useVoiceInterview hook + WebAudio pipeline
