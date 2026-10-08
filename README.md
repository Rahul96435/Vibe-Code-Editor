# VibeCode Editor
Website-link -> [code-editor-flax-nu.vercel.app](https://code-editor-flax-nu.vercel.app/) .



A smart developer playground for AI-assisted coding, live preview, and project management.

VibeCode Editor is a modern web-based code editor built with **Next.js 16**, **React 19**, **NextAuth**, and **Prisma**. It combines an AI-assisted development experience with a customizable playground, project dashboard, and in-browser WebContainer preview.

## What this project does

- Provides a **landing page** and **dashboard** for managing code playgrounds.
- Loads starter templates for React, Next.js, Express, Vue, Hono, and Angular.
- Uses a **playground editor** with file-browser workflow and save/load state.
- Integrates an **AI chat backend** for coding assistance.
- Includes a **code completion endpoint** for inline AI suggestions.
- Supports live preview via **WebContainer** and a backend code execution environment.
- Uses **NextAuth** for authentication flows and **Prisma** for database access.

## Key project features

- `app/api/chat/route.ts` — AI chat endpoint that forwards requests to a configured remote LLM API.
- `app/api/code-completion/route.ts` — contextual code completion API for editor suggestions.
- `app/api/template/[id]/route.ts` — template loader that exports starter folders as JSON.
- `app/(auth)` — authentication pages for sign-in.
- `app/dashboard` — dashboard UI to create, duplicate, and manage playground projects.
- `app/playground/[id]` — interactive editor page with file explorer and preview.
- `modules/webcontainers` — WebContainer integration for local preview and file writes.

## Repository structure

- `app/` — Next.js app routes, pages, and API route definitions.
- `components/` — shared UI components powered by Radix and Tailwind.
- `modules/` — feature modules for auth, dashboard, playground, and webcontainers.
- `lib/` — reusable helpers such as database access and template configuration.
- `prisma/` — Prisma configuration and schema metadata.
- `public/` — static assets and images.

## Setup

### Prerequisites

- Node.js 20+ and npm
- An API key for an OpenAI-compatible remote LLM endpoint
- A database configured via `DATABASE_URL` for Prisma/NextAuth

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### Environment variables

Copy the environment template, then add your actual credentials:

```powershell
Copy-Item .env.sample .env
```

Set `DATABASE_URL`, `AUTH_SECRET`, and the OAuth credentials you use. Configure the remote AI service with:

```env
LLM_API_KEY=your_provider_api_key
LLM_MODEL=gpt-4o-mini
LLM_BASE_URL=https://api.openai.com/v1
```

`LLM_BASE_URL` is the API base URL; the server appends `/chat/completions`. The sample values target the OpenAI API and can be changed to another compatible provider. Keep `.env` private. The API key is read only by Next.js server routes and must not use a `NEXT_PUBLIC_` variable name.

Then install and run the app normally:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Deployment environment

Add `LLM_API_KEY`, `LLM_MODEL`, and `LLM_BASE_URL` as server-side environment variables in the deployment platform (for example, Vercel Project Settings > Environment Variables). Also configure the app's existing `DATABASE_URL`, `AUTH_SECRET`, and OAuth credentials as needed. Redeploy after changing variables. Never add credentials to source code or client-exposed variables.

## `.gitignore` explanation

The project includes a `.gitignore` file so only source code and configuration are committed. It intentionally excludes:

- dependency folders and build artifacts (`node_modules`, `.next`, `out`, `build`)
- local environment files (`.env*`)
- system/editor noise (`.DS_Store`, log files, `*.pem`)
- generated app output and temporary archives (`output/`, `.next.zip`, `auth.zip`)
- local AI tooling and workspace files (`.agents/`, `.claude/`, `.windsurf/`)
- TypeScript cache files (`*.tsbuildinfo`, `next-env.d.ts`)

### Example `.gitignore`

```gitignore
/node_modules
/.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

/coverage
/.next/
/out/
/build

.DS_Store
*.pem
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

.env*

.agents/
.claude/
.windsurf/
.next.zip
auth.zip
output/

.vercel

*.tsbuildinfo
next-env.d.ts

/lib/generated/prisma
```

## How it helps

VibeCode Editor accelerates developer workflows by combining:

- AI-powered chat and completion
- template-based code playgrounds
- in-browser preview using WebContainer
- project and workspace management

It is designed to help developers experiment quickly, learn from AI guidance, and prototype frontend/backend code in a unified interface.

## Detailed code flow and how to add code

### 1. App entry and layout

The project uses the Next.js App Router. The main app layout is in `app/layout.tsx`, which wraps all pages with:

- `SessionProvider` from `next-auth` for authentication state
- `ThemeProvider` for light/dark theme support
- `Toaster` for notification messages

This ensures every page has access to session state and consistent UI behavior.

### 2. Dashboard and playground flow

- `app/dashboard/page.tsx` loads user playgrounds using `getAllPlaygroundForUser()` from `modules/dashboard/actions`.
- `app/playground/[id]/page.tsx` loads a single playground and template data using `usePlayground()`.
- The playground page uses `useFileExplorer()` and `useWebContainer()` to manage file state and preview.

To add a new page or feature:

1. Create a new file in `app/` or `app/<route>/page.tsx`.
2. Add a React component and export it as default.
3. Use existing UI components from `components/ui/` for consistency.

Example:

```tsx
// app/new-feature/page.tsx
import { Button } from "@/components/ui/button";

export default function NewFeaturePage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">New Feature</h1>
      <Button>Start</Button>
    </div>
  );
}
```

### 3. AI chat and code completion APIs

The backend API endpoints are in `app/api/`:

- `app/api/chat/route.ts` receives chat messages and forwards them to the configured remote LLM API through `lib/llm.ts`.
- `app/api/code-completion/route.ts` sends cursor-aware editor context through the same server-side LLM service and returns inline suggestions.
- `app/api/template/[id]/route.ts` loads starter templates and returns file structure as JSON.

Example request to chat endpoint:

```ts
const res = await fetch("/api/chat", {
  method: "POST",
  body: JSON.stringify({
    message: "Explain this code",
    history: [],
  }),
});
const data = await res.json();
console.log(data.response);
```

Conversation history remains in the chat UI and the latest messages are sent with each request. Responses are currently returned as JSON rather than streamed; the existing stream toggle does not enable token streaming.

### 4. Working with templates

Template paths are defined in `lib/template.ts`. The app loads starter code from those folders and converts them into a JSON structure for the editor.

To add a new starter template:

1. Add a folder for the starter in the project root, for example `vibecode-starters/my-template`.
2. Update `lib/template.ts`:

```ts
export const templatePaths = {
  ...
  MY_TEMPLATE: "/vibecode-starters/my-template",
}
```

3. Add support in the UI or template selector if needed.

### 5. Authentication and database

- `app/api/auth/[...nextauth]/route.ts` exports NextAuth handlers from `auth.ts`.
- `Prisma` is used for database access in `lib/db.ts` and playground actions.

To add a new authenticated API route, create an endpoint under `app/api/` and protect it with session checks.

### 6. Best practices for extending this project

- Keep UI components reusable under `components/ui/`.
- Put business logic in `modules/*` so feature code stays organized.
- Use `lib/` for shared utilities and constants.
- Keep API routes lightweight and delegate complex logic to helpers.

## Cleanup and GitHub readiness

This repo has been cleaned for GitHub publishing by:

- removing unnecessary inline comments and debug logs
- cleaning top-level layout and API route source files
- updating `.gitignore` to ignore local tool artifacts and generated files
- preserving the app structure and functional features

## Push to GitHub

If this repository is not yet initialized as Git, run:

```bash
git init
git add .
git commit -m "Initial commit - VibeCode Editor"
```

Then create a GitHub repository and push:

```bash
git remote add origin https://github.com/<your-user>/<your-repo>.git
git branch -M main
git push -u origin main
```

## Notes

- AI requests use the configured remote provider; no local model service is required.
- The project uses **Next.js App Router** and `next-auth` for session handling.
- The `WebContainer` integration is used for live file editing and preview within the browser.
