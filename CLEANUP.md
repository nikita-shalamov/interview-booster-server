# Cleanup Plan — Interview Feature

## 1. Убрать избыточные logger.log
Оставить только `logger.warn` и `logger.error`. Убрать все `logger.log` из:
- `voice-interview.gateway.ts` — 38 вызовов: handleConnection, constructor, onStartSession, onFinalTranscript, runAiTurn, handleEnd, getUserId
- `llm-interviewer.service.ts` — 7 вызовов: generateQuestionsFromTemplate, generateQuestions, streamAnswer
- `deepgram-stt.service.ts` — 9 вызовов: createStream, SpeechStarted handler, UtteranceEnd handler, speech_final handlers, closeStream
- `cartesia-tts.service.ts` — 8 вызовов: streamAudio, _pushTokens, _receiveAudio

## 2. Убрать переменные, нужные только для логов
После удаления логов станут мёртвыми:
- `voice-interview.gateway.ts:230` — `turnStart` (используется только в timing-логах runAiTurn)
- `llm-interviewer.service.ts:270` — `tokenCount` / `fullResponse` (только в финальном логе streamAnswer)
- `cartesia-tts.service.ts:113–114` — `audioChunkCount`, `receiveStart` (только в логах _receiveAudio)
- `cartesia-tts.service.ts:72` — `chunkCount` (только в логах _pushTokens)

## 3. Убрать эмодзи из всех строк логов
🎙️ 🤖 ✅ ❌ 📋 🎯 📤 📊 📝 🔊 ▶️ ⚠️ 🏁 🎤 🔚 🔄 📝 💾 🧠 ⏸️ — во всех voice-файлах.

## 4. Убрать JSDoc комментарии (llm-interviewer.service.ts)
Строки 59–61, 107–109, 142–144, 165–167, 191–193 — `/** ... */` блоки над методами.

## 5. Убрать очевидные inline-комментарии (interview-template.service.ts)
Строки 53, 80, 89, 100, 120, 130, 136, 143, 148, 159, 166 — комментарии типа `// Фильтры`, `// Сортировка`, `// Пагинация`, `// Получить профиль пользователя` и т.д.
Аналогично в `voice-interview.gateway.ts` строки 313–314, 321–322.

## 6. Убрать section-dividers в контроллере (interview.controller.ts)
Строки 19, 41, 72 — `// ===== СТАРЫЕ ENDPOINTS =====` и т.д.

## 7. Заменить `any` типы
- `interview-template.service.ts:229` — `let parsed: any` → `let parsed: Record<string, unknown>`
- `interview-template.service.ts:288` — `const config: any` → `const config: InterviewConfig`
- `interview-template.service.ts:296` — `as any` → `as InterviewType`
- `deepgram-stt.service.ts:42` — `msg as any` → использовать конкретный тип из SDK или `Record<string, unknown>`
- `voice-interview.gateway.ts:358` — `(client.handshake.auth as any)` → `(client.handshake.auth as Record<string, string>)`

## 8. Убрать eslint-disable (cartesia-tts.service.ts:1)
`/* eslint-disable @typescript-eslint/no-unsafe-return */` — убрать, заменить `(context as any)._ws` на typed wrapper или точечный `// eslint-disable-next-line` на нужной строке.

## 9. Дедублировать JSON-parsing логику (llm-interviewer.service.ts)
Одинаковый блок `text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()` на строках 179 и 230 — вынести в приватный метод `parseJsonResponse(text: string)`.
