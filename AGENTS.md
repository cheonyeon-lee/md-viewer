# Markdown File Viewer

This is a Next.js project for browsing and viewing markdown files. The application provides a user interface to select from a list of available markdown files and view their content.

## Key Commands

- `npm run dev` - Start the development server
- `npm run build` - Build the application
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint for code quality checks

## Development Setup

1. Install dependencies: `npm install`
2. Start development server: `npm run dev`
3. Open browser at http://localhost:3000

## Architecture Notes

- Main page component: `app/page.tsx` (Server Component) — reads the `docs/` markdown file tree at request time via `lib/markdown-files.ts#getMarkdownFileTree` and passes it to the client shell.
- App shell (editor/preview/toolbar, all client-side state): `components/markdown-viewer/markdown-viewer-app.tsx`
- File explorer tree UI (folder expand/collapse): `components/markdown-viewer/file-explorer.tsx`
- `docs/` file system access (list, read, write with path-traversal/extension validation): `lib/markdown-files.ts`
- Server Actions used by the client to fetch/save file content: `app/actions/markdown-files.ts`
- Markdown-to-safe-HTML rendering pipeline: `lib/render-markdown.ts` (`remark-parse` → `remark-gfm` → `remark-rehype` → `rehype-sanitize` → `rehype-stringify`)
- Dark mode: `lib/theme-script.ts` (blocking init script injected in `app/layout.tsx` to avoid FOUC) + `lib/use-theme.ts` (`useSyncExternalStore`-based hook/store used by the toggle button)
- shadcn/base-ui primitives: `components/ui/*`
- Uses Next.js 16 with App Router
- Styled with Tailwind CSS
- No Next.js Image components - all image handling removed

## Testing Guidelines

The project has no dedicated test files. It's a simple UI application that demonstrates markdown file browsing capabilities.

## Framework Quirks

- Uses Next.js 16 App Router (`app/` directory)
- Built-in font optimization with Geist (Vercel font)
- Default deployment target is Vercel
- Uses React 19 and TypeScript with strict types

## Customization Notes

- The file list is not hand-maintained: it is derived automatically from whatever `.md` files exist under `docs/` (see `lib/markdown-files.ts#getMarkdownFileTree`). Add/remove files there to change what appears in the explorer.
- Deploying to a serverless target (e.g. Vercel): `docs/**/*.md` is not imported by any JS module, so Next's file tracing won't include it automatically. `next.config.ts` sets `outputFileTracingIncludes` for `docs/` to ensure it ships with the deployment.
- Markdown parsing/sanitization uses `remark-parse`, `remark-gfm`, `remark-rehype`, `rehype-sanitize`, `rehype-stringify` (see `lib/render-markdown.ts`). Do not reintroduce `dangerouslySetInnerHTML` with unsanitized input.

## 문서 작성 규칙

- 모든 문서는 아래와 같은 규칙으로 폴더와 파일을 생성한다.
 - 문서 root 디렉토리 : /Users/dante/dev-workspace/md-viewer/docs 
 - 새로운 작업을 할 시작할때는 항상 새로운 폴더를 생성하고 생성한 폴더에 작업명으로 문서를 생성한다.
 - 새로운 폴더 생성 시 YYYYMMDD-작업명으로 영어로 작성한다.
 - 각 폴더에는 해당 작업과 관련된 문서 파일이 포함되어야 한다.
 - 문서 파일명에는 YYYYMMDD 형식을 포함하지 않는다.

---

# Global Development Rules

## Language

- User communicates primarily in Korean.
- Understand Korean instructions directly.
- Never translate Korean instructions into English before processing them.
- Respond in Korean unless the user explicitly requests English.
- All documentation files must be written in Korean.

## Development Philosophy

- Do not immediately start coding.
- First understand the existing project.
- Never rewrite existing code unnecessarily.
- Prefer small, focused changes.
- Preserve existing architecture unless there is a strong reason to change it.

## Next.js

- Use Next.js App Router.
- Use TypeScript.
- Prefer Server Components.
- Use Client Components only when required.
- Use Tailwind CSS.
- Prefer reusable components.
- Avoid duplicated logic.

## TypeScript

- Never use `any` unless absolutely unavoidable.
- Prefer explicit types.
- Use interfaces/types appropriately.
- Handle null and undefined explicitly.

## Architecture

- Separate UI, business logic, data access, and utilities.
- Do not put business logic directly inside large page components.
- Keep components small and reusable.

## API

- Validate all external input.
- Handle errors explicitly.
- Never expose secrets to the client.
- Never hard-code API keys.

## Before Implementation

Before changing code:

1. Inspect the relevant files.
2. Understand the existing architecture.
3. Identify dependencies.
4. Explain the implementation plan.
5. Wait for approval when the change is large or architectural.

## After Implementation

After modifying code:

1. Run TypeScript checking.
2. Run ESLint.
3. Run relevant tests.
4. Fix errors.
5. Review the changed files.
6. Summarize what changed.

## Git

- Never delete existing work without confirmation.
- Never reset or force-push without explicit permission.
- Keep changes focused.
- Do not modify unrelated files.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
