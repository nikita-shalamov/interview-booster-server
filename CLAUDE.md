# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interview Booster Server is a NestJS backend application providing AI-powered interview preparation features. The system includes user authentication, chat messaging with AI agents, interview onboarding flows, resume handling, and RAG (Retrieval-Augmented Generation) capabilities.

## Commit Style

- Always use `feat:` prefix regardless of change type (fixes, refactors, additions)
- Lowercase message after the colon
- Short and imperative: `feat: added X`, `feat: changed Y`, `feat: fixed Z`
- Multiple changes in one commit: comma-separated — `feat: added X, fixed Y`
- No period at the end
- No commit body — single line only
- No Co-Authored-By lines

## My Rules

### Code Style

- Write comments rarely — only for non-obvious logic, never for obvious code
- Do not explain what a function does if its name already says it
- No verbose JSDoc by default unless explicitly asked

### File Management

- Do NOT create extra .md files (README, NOTES, CHANGELOG, etc.) unless I ask
- Do NOT create example or demo files
- Do NOT generate .env.example unless asked

### Behavior

- Keep changes minimal — only modify what is directly related to the request
- Do not refactor unrelated code while implementing a feature
- No "while I'm here" improvements — ask first
- Do not add console.log statements unless asked
- Short responses are preferred over long explanations — show code, not essays

## Common Development Commands

### Setup

```bash
npm install              # Install dependencies
```

### Running the Application

```bash
npm run start            # Start in production mode
npm run start:dev        # Start with file watching (recommended for development)
npm run start:debug      # Start with debugging and file watching
npm run start:prod       # Run the compiled production build
```

### Building

```bash
npm run build            # Compile TypeScript to dist/
```

### Code Quality

```bash
npm run format           # Format code with Prettier
npm run lint             # Lint and fix with ESLint
```

## Architecture Overview

### Application Structure

The app follows NestJS modular architecture organized by domain:

- **auth/** - JWT-based authentication with Passport strategy, login/registration endpoints
- **users/** - User entity and management service
- **chat/** - Chat conversations and message persistence with AI integration
- **onboarding/** - Interview preparation onboarding flows
- **agents/** - AI agent implementations
- **rag/** - Retrieval-Augmented Generation system with embeddings and vector search
- **resume/** - Resume processing and management
- **cache/** - Cache service layer

### Core Infrastructure

**Database:** PostgreSQL via TypeORM

- Entities auto-discovered from `**/*.entity{.js,.ts}` pattern (src/app.module.ts:27)
- Schema auto-synchronization enabled in development (`synchronize: true`)
- Connection params via environment variables (DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME)

**Caching:** Redis via Keyv

- Global cache manager configured in AppModule
- Connects to `redis://localhost:6379` by default
- Used for performance optimization across modules

**AI Services:**

- Multiple provider support: Anthropic, Google Generative AI, OpenAI
- LangChain integration for AI orchestration
- Vercel AI SDK for unified provider interface
- API keys configured via environment variables

**Vector Database:** Qdrant

- Used for semantic search in RAG system (src/rag/ai.module.ts)
- Paired with FastEmbed for embeddings generation

### Configuration

- **ConfigModule** is global and loads .env automatically
- **JWT Config** uses a factory pattern (src/config/jwt.config.ts)
- CORS enabled with frontend URL configurable via FRONTEND_URL env var (defaults to http://localhost:3002)
- Server listens on PORT env var (defaults to 4000)
- All endpoints prefixed with `/api`

### Request/Response Setup

- Global API prefix: `/api`
- Body parsers configured with 5MB limit for JSON and URL-encoded
- Cookie parser enabled for session handling
- CORS enabled with credentials support

## Development Environment Requirements

- Node.js with npm
- PostgreSQL database (configured via .env)
- Redis instance (configured via .env, used for caching)
- API keys for AI providers (ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, OPENAI_API_KEY)

## Code Standards

Prettier (single quotes, trailing commas), ESLint, TypeScript ES2023 with decorators and strict null checks.

## Module Dependencies

The dependency graph flows through core infrastructure:

```
Auth/Users ← JWT Strategy + Password hashing (Argon2)
Chat ← TypeORM + AiModule
AiModule ← LangChain + AI SDKs + Embeddings
Onboarding ← Database entities
Agents ← AiModule
```

AiModule and Chat are frequently imported by other modules for AI capabilities.

## Key Patterns

- **Services:** Business logic, can be injected across modules
- **Controllers:** HTTP endpoints, use @Auth() decorator for protected routes
- **DTOs:** Request/response validation using class-validator
- **Entities:** TypeORM model classes for database tables
- **Guards & Strategies:** JWT authentication via Passport
