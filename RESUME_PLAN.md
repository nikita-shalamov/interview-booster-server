# Resume Module — Plan

## Этап 1 — Загрузка резюме

Поддерживаемые форматы: PDF, DOCX, plain text (.txt).

**Зависимости:** `multer`, `pdfkit`, `@types/multer`, `@types/pdfkit` (pdf-parse и mammoth уже установлены)

**API:**

```
POST /resume/upload   — multipart/form-data, поле "file"
GET  /resume          — список резюме пользователя
GET  /resume/:id      — одно резюме
DELETE /resume/:id    — удаление
```

**Что происходит при загрузке:**

1. Multer принимает файл в memory storage (не сохраняем на диск)
2. Из буфера извлекается сырой текст через pdf-parse / mammoth / прямое чтение
3. Создаётся запись `Resume` с `originalText` и метаданными

**Resume entity (базовая, без AI-полей):**

```
id, user_id, filename, mimeType, originalText, createdAt, updatedAt
```

**Статус:** ✅ сделано

---

## Этап 2 — Структурированный парсинг резюме нейронкой

Задача: взять `originalText` и превратить его в структурированный объект — секции, подсекции, списки, метаданные. Хранить в JSONB поле `parsedContent` в таблице `resume`.

### Почему JSONB, а не отдельные таблицы

Резюме бывают разные: у кого-то 2 секции, у кого-то 10. JSONB позволяет хранить гибкую вложенную структуру без миграций при изменении схемы. Читается и пишется одним запросом. Достаточно для наших сценариев (отображение, diff, ATS).

### Структура `parsedContent`

```typescript
interface ParsedResume {
  sections: ResumeSection[];
}

interface ResumeSection {
  type: SectionType; // тип секции для бизнес-логики
  title: string; // оригинальный заголовок ("Work Experience", "Опыт работы")
  items: ResumeSectionItem[];
}

type SectionType =
  | 'summary' // краткое описание / objective
  | 'experience' // опыт работы
  | 'education' // образование
  | 'skills' // навыки
  | 'projects' // проекты
  | 'certifications'
  | 'languages'
  | 'other'; // всё остальное

type ResumeSectionItem = ExperienceItem | EducationItem | SkillsItem | TextItem;

interface ExperienceItem {
  kind: 'experience';
  company: string;
  role: string;
  period: string; // "Jan 2022 — Mar 2024"
  location?: string;
  bullets: string[]; // список достижений/обязанностей
}

interface EducationItem {
  kind: 'education';
  institution: string;
  degree: string;
  field?: string;
  period?: string;
  gpa?: string;
}

interface SkillsItem {
  kind: 'skills';
  category?: string; // "Frontend", "Databases", etc.
  items: string[]; // ["React", "TypeScript", ...]
}

interface TextItem {
  kind: 'text'; // для summary, other — просто текст
  content: string;
}
```

**API:**

```
POST /resume/:id/analyze   — запускает AI-парсинг (и в будущем весь анализ), сохраняет parsedContent
```

**Что хранится в БД:**

```
resume.parsedContent: ParsedResume (JSONB, nullable)
```

**Статус:** ✅ сделано

---

## Этап 3 — Diff: было / стало / обоснование

После парсинга нейронка проходит по каждой секции и находит слабые места. Для каждого — возвращает тройку `original / improved / reason`.

**API:**

```
POST /resume/:id/analyze   — запустить diff-анализ
```

**Что делает сервис:**

1. Берёт `parsedContent` из Resume
2. Отправляет в AI с контекстом пользователя (role, level из Onboarding)
3. Сохраняет массив `ResumeDiff` в отдельную таблицу

**ResumeDiff entity:**

```
id, resume_id, section (SectionType), original, improved, reason, createdAt
```

**Промпт:** получает структурированный `parsedContent` (не сырой текст) → AI понимает контекст каждой секции → генерирует точные, применимые правки

**Инкремент roadmap:** после успешного analyze → `roadmapService.updateStep(userId, 'review_resume', +1)`

**Статус:** ⬜ не начато

---

## Этап 4 — Общая оценка резюме

Отдельный AI-вызов: анализ силы резюме в целом, без привязки к конкретным правкам.

**API:**

```
POST /resume/:id/evaluate   — запустить общую оценку
```

**Что возвращает AI:**

```typescript
interface ResumeEvaluation {
  overallScore: number; // 0..100 — общая сила резюме
  strengths: string[]; // сильные стороны (3-5 пунктов)
  weaknesses: string[]; // слабые стороны (3-5 пунктов)
  issues: ResumeIssue[]; // конкретные проблемы
  recommendations: string[]; // что улучшить (топ-5)
  suitableRoles: string[]; // на какие позиции подходит
  estimatedLevel: string; // оцениваемый уровень (junior/middle/senior)
}

interface ResumeIssue {
  description: string;
  severity: 'low' | 'medium' | 'high';
}
```

**Что хранится в БД:** `resume.evaluation: ResumeEvaluation (JSONB, nullable)`

**Статус:** ⬜ не начато

---

## Этап 5 — ATS-рейтинг

Отдельный AI-вызов с фокусом на соответствие ATS-фильтрам (не про содержание, а про формат/ключевые слова/структуру).

**API:**

```
POST /resume/:id/ats   — запустить ATS-анализ
```

**Что проверяет AI:**

- Стандартные заголовки секций (ATS-сканеры ищут конкретные названия)
- Ключевые слова по специализации
- Отсутствие таблиц, колонок, нестандартных элементов (плохо парсятся)
- Контактная информация
- Длина и формат

**Что возвращает AI:**

```typescript
interface AtsResult {
  atsScore: number; // 0..100
  issues: { issue: string; severity: 'low' | 'medium' | 'high' }[];
  recommendations: string[];
}
```

**Что хранится в БД:** `resume.atsScore`, `resume.atsIssues`, `resume.atsRecommendations` (отдельные колонки для удобства dashboard)

**Статус:** ⬜ не начато

---

## Этап 6 — Экспорт в PDF

Генерация PDF из улучшенного резюме через `pdfkit`.

**API:**

```
GET /resume/:id/export   — скачать PDF (Content-Disposition: attachment)
```

**Логика:**

- Берёт `parsedContent` (или `originalText` если парсинг не запускался)
- Применяет принятые изменения из `ResumeDiff` (если есть)
- Генерирует PDF: заголовки секций, списки, форматирование

**Response:** `Content-Type: application/pdf`, стриминг через pdfkit pipe в `res`

**Статус:** ⬜ не начато

---

## Итоговая схема Resume entity

```
id
user_id
filename
mimeType
originalText           — сырой текст после парсинга файла
parsedContent          — JSONB: структурированные секции (после этапа 2)
evaluation             — JSONB: общая оценка (после этапа 4)
atsScore               — int (после этапа 5)
atsIssues              — JSONB
atsRecommendations     — JSONB
created_at
updated_at
```

```
resume_diffs
id, resume_id, section, original, improved, reason, created_at
```

---

## Прогресс

| Этап | Описание                                          | Статус |
| ---- | ------------------------------------------------- | ------ |
| 1    | Загрузка (PDF/DOCX/TXT) + сохранение originalText | ✅     |
| 2    | AI-парсинг → parsedContent (JSONB)                | ✅     |
| 3    | AI diff → ResumeDiff таблица                      | ⬜     |
| 4    | AI общая оценка → evaluation (JSONB)              | ⬜     |
| 5    | AI ATS-рейтинг → atsScore + issues                | ⬜     |
| 6    | Экспорт в PDF через pdfkit                        | ⬜     |
