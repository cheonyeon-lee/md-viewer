# 파일 목록/탐색 기능 구현

## 배경

기존 애플리케이션은 OS 파일 선택 창으로 로컬 파일 하나만 열 수 있었고, PRD(`docs/20260821-markdown-viewer/prd.md`)에서 요구하는 "사용 가능한 마크다운 파일 목록 표시" 기능이 없었다. `docs/` 디렉터리에 있는 문서들을 앱에서 바로 탐색할 수 있도록 파일 탐색기 기능을 추가한다.

## 아키텍처

- `docs/` 디렉터리는 서버(파일시스템)에서만 읽을 수 있으므로 `app/page.tsx`를 Server Component로 전환하고, 요청 시점에 `lib/markdown-files.ts`의 `getMarkdownFileTree()`로 파일 트리를 읽어 클라이언트 컴포넌트에 props로 전달한다.
- 기존 `page.tsx`의 UI 로직은 `components/markdown-viewer/markdown-viewer-app.tsx`(Client Component)로 이동했다.
- 파일 클릭 시 내용을 읽어오는 부분은 Server Action `app/actions/markdown-files.ts#getMarkdownFileContentAction`으로 구현했다. 전체 파일 내용을 한 번에 내려보내지 않고, 선택한 파일만 그때그때 요청한다.
- 파일 트리 UI는 `components/markdown-viewer/file-explorer.tsx`에서 폴더 접기/펼치기를 지원하는 재귀 컴포넌트로 구현했다.

## 보안: 경로 검증

`readMarkdownFile(relativePath)`는 클라이언트가 보낸 경로 문자열을 다음과 같이 검증한다.

- `path.resolve(DOCS_ROOT, relativePath)`로 절대 경로를 구한 뒤, `path.relative(DOCS_ROOT, resolved)`가 `..`로 시작하거나 절대 경로면 거부한다 (docs 바깥 경로 접근 차단).
- 확장자가 `.md`가 아니면 거부한다.

## 배포 관련

`docs/**/*.md`는 어떤 JS 코드에서도 `import`되지 않으므로 Next.js의 파일 트레이싱이 자동으로 포함시켜주지 않는다. Vercel 등에 배포했을 때 서버리스 함수가 해당 파일을 읽지 못하는 것을 방지하기 위해 `next.config.ts`에 `outputFileTracingIncludes`를 추가해 `docs/` 전체를 명시적으로 포함시켰다.

## 확인 사항

- `npx tsc --noEmit`, `npm run lint`, `npm run build` 모두 통과.
- 개발 서버에서 SSR 결과에 `docs/` 하위 폴더(`20260821-markdown-viewer`, `20260830-보안리뷰`)와 파일(`prd.md`, `lld.md`, `보안리뷰.md`)이 정상적으로 렌더링되는 것을 확인.
- 헤드리스 브라우저 도구가 환경에 없어 클릭 상호작용(파일 클릭 → 내용 로드)은 자동화된 브라우저 테스트로 검증하지 못했다. 로컬에서 `npm run dev` 후 수동 확인이 필요하다.

## 2단계: remark/rehype 전환 + XSS sanitize (완료)

- `package.json`에서 미사용 상태였던 `remark`, `remark-html`, `rehype-raw`를 제거하고, 실제로 사용하는 `remark-parse`, `remark-gfm`, `remark-rehype`, `rehype-sanitize`, `rehype-stringify`를 추가했다.
- `lib/render-markdown.ts`에 `unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeSanitize, defaultSchema).use(rehypeStringify)` 파이프라인을 구성했다. `remarkRehype`는 기본값으로 원본 HTML 태그를 hast 트리에 포함하지 않으므로(`allowDangerousHtml` 미설정) `<script>` 등 raw HTML은 애초에 결과에 나타나지 않고, `rehype-sanitize`가 `javascript:` 링크 등 위험한 속성/URL 스킴까지 2차로 제거한다.
- `components/markdown-viewer/markdown-viewer-app.tsx`의 정규식 기반 `renderMarkdown`을 제거하고 `renderMarkdownToSafeHtml`로 교체했다. `useMemo`로 content가 바뀔 때만 재계산하도록 했다.
- 정규식 파서에서 깨져 있던 인용문(`>`), 순서 목록 번호, GFM 표가 정상적으로 렌더링됨을 확인했다 (`node`로 직접 파이프라인 실행해 검증).
- `npx tsc --noEmit`, `npm run lint`, `npm run build` 모두 통과.

## 3단계: 저장/새로고침 기능 (완료)

- 저장 방식은 사용자에게 확인해 **docs/ 원본 파일 덮어쓰기**로 결정했다. `lib/markdown-files.ts`에 `writeMarkdownFile()`을 추가하고, `resolveDocsPath()`로 경로 검증 로직을 `readMarkdownFile`/`writeMarkdownFile`이 공유하도록 리팩터링했다. 대상 파일이 실제로 존재할 때만 덮어쓰며(`fs.access` 선확인), 새 파일을 임의로 생성하지 않는다.
- `app/actions/markdown-files.ts`에 `saveMarkdownFileContentAction`을 추가했다. PRD 5장의 "저장 전 유효성 검사" 요구에 따라 빈 콘텐츠와 5MB 초과 콘텐츠를 서버에서 거부한다.
- docs 트리에서 연 파일이 아닌 경우(로컬에서 연 파일, 새 문서)는 서버에 쓸 경로가 없으므로 저장 시 브라우저 다운로드(`Blob` + `<a download>`)로 자동 대체된다.
- 헤더 툴바에 "콘텐츠 새로고침"(선택된 docs 파일을 서버에서 다시 읽어 편집 중인 내용을 되돌림, 파일 미선택 시 비활성화)과 "변경 사항 저장" 버튼을 추가했다. 기존 "새 문서"(빈 문서로 초기화) 버튼은 PRD에 없는 기능이지만 기존 동작을 보존하기 위해 유지했다.
- 저장/다운로드 결과 메시지를 에디터 툴바에 표시하고, 사용자가 다시 타이핑하거나 새 파일을 선택하면 메시지를 지운다.
- 경로 검증 로직(경로 탈출 차단, 확장자 제한)과 실제 파일 쓰기·읽기 왕복을 별도 스크립트로 검증했다.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` 모두 통과.

## 4단계: 툴팁 적용 (완료)

- `components/ui/tooltip.tsx`(base-ui 래퍼, 기존에 설치만 되어 있고 미사용 상태였음)를 실제로 적용했다.
- 헤더 아이콘 버튼 5개(탐색기 토글/열기/새로고침/저장/새 문서) 공통 패턴을 `ToolbarIconButton` 컴포넌트로 추출해 중복 없이 `Tooltip`/`TooltipTrigger`(`render` prop으로 기존 `Button` 컴포넌트와 합성)/`TooltipContent`를 적용했다.
- 아이콘만 있고 텍스트가 없는 버튼이므로 `aria-label`을 함께 넣어 스크린 리더 접근성도 챙겼다. 기존 `title` 속성은 제거했다 (네이티브 툴팁과 커스텀 툴팁이 중복 표시되는 것을 방지).
- `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과. SSR 결과에 5개 버튼의 `aria-label`이 모두 렌더링되는 것을 확인했다.

## 5단계: 전체화면 토글 (완료)

- PRD 4.2 "뷰어 패널 우측 상단에 전체 화면 토글 아이콘" 요구에 맞춰, 미리보기 패널 툴바 우측에 브라우저 Fullscreen API(`requestFullscreen`/`exitFullscreen`)를 사용하는 토글 버튼을 추가했다. 이미 존재하는 `viewMode="preview"` 탭(앱 내부 레이아웃 확장)과는 별개로, 실제 브라우저 전체 화면으로 전환된다.
- `document`의 `fullscreenchange` 이벤트를 구독해 사용자가 Esc로 전체 화면을 빠져나가도 버튼 아이콘/상태가 올바르게 동기화되도록 했다.
- 전체 화면 진입 시 해당 패널이 새로운 렌더링 루트가 되므로 배경색이 비어 보이지 않도록 `bg-background` 클래스를 명시적으로 추가했다.
- 툴바가 좁은 영역이라 `ToolbarIconButton`에 `size`/`className` 오버라이드 옵션을 추가해 작은 크기로 배치했다.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과.

### 수정: 브라우저 Fullscreen API → 인앱 레이아웃 전환

사용자 피드백에 따라 실제 브라우저 전체화면(Fullscreen API) 방식을 제거했다. 그 방식은 상단 내비게이션(헤더)까지 화면에서 사라지는 문제가 있었다. 대신 `isPreviewFullscreen`을 단순 boolean state로 바꿔, 토글 시 헤더는 그대로 유지한 채 에디터 패널과 리사이즈 구분선만 숨기고 프리뷰 패널이 콘텐츠 영역(에디터가 있던 자리까지) 전체 폭을 차지하도록 변경했다. 상단 탭(split/editor/preview)에서 다른 모드를 선택하면 이 상태는 자동으로 해제된다. `fullscreenchange` 이벤트 구독과 `previewPanelRef`는 더 이상 필요 없어 제거했다.

## 6단계: 패널 리사이즈 (완료)

- PRD 4.2 "패널 사이의 재조정 가능한 구분선" 요구에 맞춰 split 모드에서 에디터/미리보기 패널 사이에 드래그로 폭을 조절할 수 있는 구분선을 추가했다.
- 에디터/구분선/미리보기를 감싸는 컨테이너(`splitContainerRef`)의 `getBoundingClientRect()`를 기준으로 `pointermove` 좌표에서 비율(%)을 계산해 `splitRatio` state(20~80 범위로 clamp)로 반영한다. 드래그 중에는 `document.body`의 `cursor`/`userSelect`를 임시로 바꿔 텍스트 선택 등 부작용을 막는다.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과.

## 7단계: 다크모드 토글 (완료)

- `app/layout.tsx`에 하드코딩되어 있던 `dark` 클래스를 제거하고, `next/script`의 `strategy="beforeInteractive"`로 `lib/theme-script.ts`의 초기화 스크립트를 주입했다. 이 스크립트는 hydration 이전에 `localStorage` 저장값(없으면 `prefers-color-scheme`)을 읽어 `<html>`에 `dark` 클래스를 반영하므로 테마 전환 시 깜빡임(FOUC)이 없다.
- 처음에는 `useEffect` 안에서 `setIsDark(document.documentElement.classList.contains("dark"))`로 mount 후 동기화하려 했으나, `eslint-plugin-react-hooks`의 `set-state-in-effect` 규칙이 "effect 안에서 외부 상태를 읽어 곧바로 setState 하는 패턴"을 안티패턴으로 지적했다. 대신 `lib/use-theme.ts`에 작은 외부 스토어(`useSyncExternalStore` + 구독자 Set)를 만들어, SSR/최초 hydration 시엔 고정값(`getServerSnapshot`)을, mount 이후엔 실제 DOM 값(`getSnapshot`)을 반환하도록 했다. 토글 시에는 `setDarkTheme()`이 `<html>` 클래스와 `localStorage`를 갱신하고 구독자에게 알려 리렌더링을 트리거한다.
- 헤더 툴바에 해/달 아이콘 토글 버튼을 추가했다.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과. SSR 결과에서 `<html>`에 더 이상 `dark`가 하드코딩되지 않고, `theme-init` 스크립트가 주입되는 것을 확인했다.

## 8단계: AGENTS.md 아키텍처 설명 최신화 (완료)

- `AGENTS.md`의 "Architecture Notes"가 실제 존재하지 않는 `app/components/MarkdownViewer.tsx`, `useEffect` 기반 파일 목록, `handleFileSelect` 목업 등 이전 설계를 문서화하고 있어 실제 코드와 어긋나 있었다. 1~7단계에서 만들어진 실제 파일 구조(`lib/markdown-files.ts`, `app/actions/markdown-files.ts`, `components/markdown-viewer/*`, `lib/render-markdown.ts`, `lib/theme-script.ts`, `lib/use-theme.ts`)를 반영해 다시 작성했다.
- "Customization Notes"도 실제 동작(파일 목록은 `docs/`를 스캔해 자동 생성됨, Vercel 배포 시 `outputFileTracingIncludes` 필요, remark/rehype 기반 sanitize 파이프라인 사용)에 맞게 갱신했다.

## 9단계: 에러 처리/로딩 상태/콘텐츠 영속성 보강 (완료)

- 로컬 파일 열기(`handleFileChange`)에 `reader.onerror` 처리를 추가하고, docs 파일 로딩과 동일한 `isLoadingFile`/`loadError` 상태를 재사용해 로딩 중 표시와 에러 메시지를 노출하도록 했다.
- 콘텐츠 영속성: 편집 중인 내용을 500ms 디바운스로 `localStorage`에 임시 저장하고, 새로고침 후 복구 배너("이전에 작성 중이던 내용이 있습니다 · 복구 / 무시")로 사용자가 원할 때만 되살리도록 구현했다. 자동 저장은 PRD 5장에서 "선택 사항"으로 명시되어 있어, 디스크에 자동으로 쓰지 않고 브라우저 로컬 저장 후 사용자 확인을 거치는 방식으로 구현했다.
- 이 과정에서 `eslint-plugin-react-hooks`의 `set-state-in-effect` 규칙이 "mount 시 외부 상태를 읽어 곧바로 setState 하는" 흔한 패턴(다크모드 동기화에서 썼던 것과 동일한 종류)을 다시 한 번 지적했다. 동일하게 `useSyncExternalStore`로 "복구 가능한 초안이 있는지" 여부를 effect 없이 읽고, 실제 상태 변경(복구/무시)은 버튼 클릭 핸들러에서만 수행하도록 구현해 규칙을 우회가 아니라 정공법으로 만족시켰다. 반대로 "React 상태 → localStorage 저장" 방향은 effect의 정상적인 용도이므로 그대로 유지했다.
- 빈 문자열(공백만 있는) 초안은 복구 후보로 취급하지 않는다.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` 모두 통과.

## 추가 반영: 기본 모드는 다크

- `lib/theme-script.ts`의 초기화 스크립트가 저장된 선택이 없을 때 `prefers-color-scheme`(시스템 설정)을 따르던 것을, 사용자 요청에 따라 항상 `dark`로 시작하도록 변경했다. 사용자가 한 번이라도 토글하면 그 이후로는 `localStorage`에 저장된 선택이 우선한다.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과.

## 전체 완료

식별된 미흡 사항 9개(파일 탐색기 → remark/rehype 전환 → 저장/새로고침 → 툴팁 → 전체화면 → 패널 리사이즈 → 다크모드 → 문서 정합성 → 견고성) 모두 순차적으로 구현을 마쳤다.
