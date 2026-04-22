# Resume — Frontend TZ

## API

База: `https://<host>/api`

### Эндпоинты

```
POST   /resume/upload        — загрузить файл резюме
GET    /resume               — список резюме пользователя (без originalText)
GET    /resume/:id           — одно резюме со всеми полями
POST   /resume/:id/analyze   — запустить AI-анализ (парсинг + оценка + ATS)
DELETE /resume/:id           — удалить резюме
```

Все запросы с `Authorization: Bearer <token>` (или куки, смотри как реализована авторизация на фронте).

---

## Типы

Эти типы полностью зеркалят бэкенд. Можно положить в `types/resume.ts`.

```typescript
export type SectionType =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'languages'
  | 'other';

export interface ExperienceItem {
  kind: 'experience';
  company: string;
  role: string;
  period: string;
  location?: string;
  bullets: string[];
}

export interface EducationItem {
  kind: 'education';
  institution: string;
  degree: string;           // "Бакалавр", "Магистр", "Bachelor", "Master" и т.д.
  field?: string;           // специальность/направление
  period?: string;
  location?: string;        // город/страна
  gpa?: string;
}

export interface SkillsItem {
  kind: 'skills';
  category?: string;
  items: string[];
}

export interface TextItem {
  kind: 'text';
  content: string;
}

export type ResumeSectionItem =
  | ExperienceItem
  | EducationItem
  | SkillsItem
  | TextItem;

export interface ResumeSection {
  type: SectionType;
  title: string;
  items: ResumeSectionItem[];
}

export interface ResumeContacts {
  name?: string;            // имя (напр. "Никита Шаламов")
  email?: string;
  phone?: string;
  telegram?: string;        // ник или ссылка (напр. "@nikita_frl")
  github?: string;          // ссылка или ник
  linkedin?: string;        // ссылка
  location?: string;        // город/страна
  other?: string[];         // прочие контакты
}

export interface ParsedResume {
  contacts: ResumeContacts;
  sections: ResumeSection[];
}

export interface ResumeIssue {
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ResumeEvaluation {
  overallScore: number;         // 0–100
  strengths: string[];
  weaknesses: string[];
  issues: ResumeIssue[];
  recommendations: string[];
  suitableRoles: string[];
  estimatedLevel: string;       // "junior" | "middle" | "senior"
}

export interface AtsIssue {
  issue: string;
  severity: 'low' | 'medium' | 'high';
}

// Полный объект резюме (GET /resume/:id)
export interface Resume {
  id: number;
  user_id: number;
  filename: string;
  mimeType: string;
  originalText: string;
  parsedContent: ParsedResume | null;
  evaluation: ResumeEvaluation | null;
  atsScore: number | null;
  atsIssues: AtsIssue[] | null;
  atsRecommendations: string[] | null;
  created_at: string;
  updated_at: string;
}

// Краткий объект резюме (GET /resume — список)
export interface ResumeListItem {
  id: number;
  user_id: number;
  filename: string;
  mimeType: string;
  atsScore: number | null;
  created_at: string;
  updated_at: string;
}
```

---

## API-функции

```typescript
// Загрузить файл
async function uploadResume(file: File): Promise<Resume> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/resume/upload', { method: 'POST', body: form });
  return res.json();
}

// Список резюме
async function getResumes(): Promise<ResumeListItem[]> {
  const res = await fetch('/api/resume');
  return res.json();
}

// Одно резюме
async function getResume(id: number): Promise<Resume> {
  const res = await fetch(`/api/resume/${id}`);
  return res.json();
}

// Запустить анализ
async function analyzeResume(id: number): Promise<Resume> {
  const res = await fetch(`/api/resume/${id}/analyze`, { method: 'POST' });
  return res.json();
}

// Удалить
async function deleteResume(id: number): Promise<void> {
  await fetch(`/api/resume/${id}`, { method: 'DELETE' });
}
```

---

## Страницы и компоненты

### 1. Страница со списком резюме + загрузка (`/resume`)

**Что делает:**
- Показывает список загруженных резюме пользователя
- Даёт возможность загрузить новый файл
- С каждого резюме в списке можно перейти на страницу результатов

**Загрузка файла:**
- Drag-and-drop зона или обычный `<input type="file">`
- Принимаемые форматы: `.pdf`, `.docx`, `.doc`, `.txt`
- Ограничение: 5 МБ (валидировать на клиенте до отправки)
- При выборе файла — сразу вызвать `POST /resume/upload`
- Во время загрузки — показывать прогресс/спиннер, заблокировать повторный выбор
- После успеха — добавить новое резюме в список, показать кнопку "Анализировать"
- При ошибке — toast с текстом ошибки от сервера

**Список резюме:**

Каждая карточка показывает:
- `filename` — название файла
- `created_at` — дата загрузки (форматировать: "21 апр 2026")
- `atsScore` — если не null, показать шильдик с оценкой и цветом:
  - `< 50` → красный
  - `50–74` → жёлтый
  - `≥ 75` → зелёный
  - `null` — шильдик "Не проанализировано" (серый)
- Кнопка "Посмотреть результат" → переход на `/resume/:id/result` (активна только если `atsScore !== null` или `parsedContent !== null`)
- Кнопка "Анализировать" → вызвать `POST /resume/:id/analyze`, показать статус загрузки прямо на карточке, после успеха — обновить карточку и предложить перейти к результатам
- Кнопка удаления → подтверждение, потом `DELETE /resume/:id`

---

### 2. Страница результатов анализа (`/resume/:id/result`)

При заходе на страницу — вызвать `GET /resume/:id`. Если `parsedContent === null` — значит анализ не запускался: показать заглушку с кнопкой "Запустить анализ" (вызывает `POST /resume/:id/analyze`, после — перезагружает данные).

Страница разбита на секции. Секции рендерятся только если соответствующее поле не null.

---

#### Секция: Контакты (`parsedContent.contacts`)

Рендерится первой, если `parsedContent !== null`.

Выводим заголовок с именем (если есть) и контакты в один или несколько рядов:

```
Никита Шаламов

📧 nikita.shalamovv@ya.ru  |  💬 @nikita_frl  |  🔗 github.com/...  |  📍 Пермь, Россия
```

Правила вывода:
- Если `name` есть — заголовок H1 или H2
- Каждый контакт как иконка + значение, разделены `|`
- Пустые поля не показываем
- email, phone, telegram → кликабельные ссылки (tel:, mailto:, t.me/)
- github, linkedin → кликабельные ссылки
- other[] → если есть, добавляем как есть

---

#### Секция: Структурированное резюме (`parsedContent.sections`)

Проходим по `parsedContent.sections` и рендерим каждую секцию по `type`:

**`experience`:**
```
Для каждого items[i] (kind === 'experience'):
  - Заголовок: role @ company
  - Подзаголовок: period  |  location (если есть)
  - Список bullets (маркированный)
```

**`education`:**
```
Для каждого items[i] (kind === 'education'):
  - Заголовок: degree, field (если есть) — institution
  - Подзаголовок: period (если есть)  |  location (если есть)  |  GPA (если есть)
  Пример: "Бакалавр, Информационные системы и технологии — Пермский Государственный Университет"
          "2022 – 2026  |  Пермь, Россия"
```

**`skills`:**
```
Для каждого items[i] (kind === 'skills'):
  - Если есть category — показать как подзаголовок
  - items — теги в строку
```

**`summary` / `other` / `projects` / `certifications` / `languages`:**
```
Для каждого items[i] (kind === 'text'):
  - Просто параграф с content
```

---

#### Секция: Общая оценка (`evaluation`)

Рендерится если `evaluation !== null`. Будет доступна после этапа 4 бэка.

```
overallScore      → большой круговой прогресс-бар в центре, число внутри
estimatedLevel    → badge рядом с заголовком ("Junior" / "Middle" / "Senior")

Сильные стороны (strengths):
  → зелёные чекмарки, список строк

Слабые стороны (weaknesses):
  → красные крестики, список строк

Конкретные проблемы (issues):
  → каждая проблема с severity-иконкой:
      high   → красный восклицательный знак
      medium → жёлтый треугольник
      low    → серый кружок
  → текст: issue.description

Рекомендации (recommendations):
  → нумерованный список

Подходящие роли (suitableRoles):
  → теги
```

---

#### Секция: ATS-рейтинг (`atsScore`, `atsIssues`, `atsRecommendations`)

Рендерится если `atsScore !== null`. Будет доступна после этапа 5 бэка.

```
atsScore → горизонтальный прогресс-бар
  цвет: < 50 красный, 50–74 жёлтый, ≥ 75 зелёный
  подпись слева: "ATS Score", справа: число/100

atsIssues → список проблем
  каждая строка: [severity-иконка] текст проблемы
  severity: low / medium / high (те же иконки что выше)

atsRecommendations → нумерованный список
```

---

## Состояния загрузки

На странице результатов может быть несколько независимых загрузок — важно показывать их правильно:

| Состояние | Что показывать |
|---|---|
| Идёт анализ (`POST /analyze`) | Оверлей или инлайн-спиннер поверх страницы, текст "Анализируем резюме..." |
| Загрузка данных (`GET /resume/:id`) | Скелетоны вместо карточек секций |
| Ошибка анализа | Toast с текстом ошибки, кнопка "Попробовать снова" |
| `parsedContent === null` после анализа | Показать "Не удалось распарсить резюме", кнопка повтора |

---

## Прогресс

| Этап | Описание                                              | Статус |
| ---- | ----------------------------------------------------- | ------ |
| 2    | Получение `parsedContent` с контактами и секциями    | ✅     |
| 2.UI | Отображение контактов и структурированного резюме    | ⬜     |
| 3    | AI diff анализ → улучшенный текст + сравнение       | ⬜     |
| 4    | Блок общей оценки (evaluation)                       | ⬜     |
| 5    | Блок ATS-рейтинга                                    | ⬜     |
