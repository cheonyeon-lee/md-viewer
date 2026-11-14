"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Maximize, Minimize, Moon, PanelLeft, RefreshCw, Save, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileExplorer } from "@/components/markdown-viewer/file-explorer";
import {
  getMarkdownFileContentAction,
  saveMarkdownFileContentAction,
} from "@/app/actions/markdown-files";
import type { MarkdownFileNode } from "@/lib/markdown-files";
import { renderMarkdownToSafeHtml } from "@/lib/render-markdown";
import { setDarkTheme, useIsDarkTheme } from "@/lib/use-theme";

function downloadMarkdownFile(content: string, filename: string) {
  const safeName = filename.toLowerCase().endsWith(".md") ? filename : `${filename}.md`;
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName;
  anchor.click();
  URL.revokeObjectURL(url);
}

const DRAFT_STORAGE_KEY = "md-viewer-draft";

interface DraftPayload {
  content: string;
  selectedFileName: string | null;
  selectedFilePath: string | null;
}

function noopSubscribe() {
  return () => {};
}

function getDraftSnapshot(): string | null {
  try {
    return localStorage.getItem(DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getDraftServerSnapshot(): string | null {
  return null;
}

function parseDraft(raw: string | null): DraftPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DraftPayload>;
    if (typeof parsed.content !== "string" || parsed.content.trim().length === 0) return null;
    return {
      content: parsed.content,
      selectedFileName: parsed.selectedFileName ?? null,
      selectedFilePath: parsed.selectedFilePath ?? null,
    };
  } catch {
    return null;
  }
}

function ToolbarIconButton({
  label,
  onClick,
  disabled,
  size = "icon",
  className = "h-9 w-9",
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  size?: "icon" | "icon-sm";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size={size} className={className} aria-label={label} disabled={disabled} />}
        onClick={onClick}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const html = useMemo(() => renderMarkdownToSafeHtml(content), [content]);

  return (
    <div
      className="preview-content max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface MarkdownViewerAppProps {
  initialFileTree: MarkdownFileNode[];
}

export function MarkdownViewerApp({ initialFileTree }: MarkdownViewerAppProps) {
  const [content, setContent] = useState(`# 마크다운 뷰어

## 소개

이 애플리케이션은 **마크다운** 편집기와 뷰어입니다.

### 기능

- 실시간 미리보기
- 문법 강조
- 다크 모드 지원

### 코드 예시

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet("World");
\`\`\`

### 목록

- 첫 번째 항목
- 두 번째 항목
- 세 번째 항목

### 링크

[GitHub](https://github.com)

---

이것은 *이탤릭* 텍스트이고, 이것은 **볼드** 텍스트입니다.

> 이것은 인용문입니다.
`);

  const [viewMode, setViewMode] = useState<"split" | "editor" | "preview">("split");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50);
  const isDark = useIsDarkTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const hasInteractedRef = useRef(false);

  const [draftDismissed, setDraftDismissed] = useState(false);
  const storedDraftRaw = useSyncExternalStore(noopSubscribe, getDraftSnapshot, getDraftServerSnapshot);
  const draft = draftDismissed ? null : parseDraft(storedDraftRaw);

  // 편집 중인 내용을 브라우저 새로고침에도 잃지 않도록 로컬에 임시 저장한다 (React 상태 → 외부 저장소 동기화).
  useEffect(() => {
    if (!hasInteractedRef.current) return;
    const timeout = setTimeout(() => {
      try {
        const payload: DraftPayload = { content, selectedFileName, selectedFilePath };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // 저장 공간 부족, 개인정보 보호 모드 등 - 임시 저장은 최선 노력(best-effort)이므로 무시한다
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [content, selectedFileName, selectedFilePath]);

  const handleRestoreDraft = () => {
    if (!draft) return;
    setContent(draft.content);
    setSelectedFileName(draft.selectedFileName);
    setSelectedFilePath(draft.selectedFilePath);
    setSaveStatus(null);
    hasInteractedRef.current = true;
    setDraftDismissed(true);
  };

  const handleDismissDraft = () => {
    setDraftDismissed(true);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // 무시
    }
  };

  const handleToggleTheme = () => setDarkTheme(!isDark);

  // 브라우저 전체화면 API 대신, 상단 내비게이션은 유지한 채 프리뷰가 에디터 영역까지 확장되는
  // 인앱 레이아웃 전환으로 구현한다.
  const handleToggleFullscreen = () => setIsPreviewFullscreen((prev) => !prev);

  const handleDividerPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const ratio = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.min(80, Math.max(20, ratio)));
    };

    const handlePointerUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleFileOpen = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingFile(true);
    setLoadError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setIsLoadingFile(false);
      const text = event.target?.result as string;
      hasInteractedRef.current = true;
      setContent(text);
      setSelectedFileName(file.name);
      setSelectedFilePath(null);
      setSaveStatus(null);
    };
    reader.onerror = () => {
      setIsLoadingFile(false);
      setLoadError("파일을 읽는 중 오류가 발생했습니다.");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSelectDocsFile = async (node: { path: string; name: string }) => {
    setIsLoadingFile(true);
    setLoadError(null);
    const result = await getMarkdownFileContentAction(node.path);
    setIsLoadingFile(false);

    if ("error" in result) {
      setLoadError(result.error);
      return;
    }

    hasInteractedRef.current = true;
    setContent(result.content);
    setSelectedFileName(node.name);
    setSelectedFilePath(node.path);
    setSaveStatus(null);
  };

  const handleRefresh = async () => {
    if (!selectedFilePath) return;
    setIsLoadingFile(true);
    setLoadError(null);
    setSaveStatus(null);
    const result = await getMarkdownFileContentAction(selectedFilePath);
    setIsLoadingFile(false);

    if ("error" in result) {
      setLoadError(result.error);
      return;
    }
    setContent(result.content);
  };

  const handleSave = async () => {
    if (content.trim().length === 0) {
      setSaveStatus({ type: "error", message: "저장할 내용이 없습니다." });
      return;
    }

    if (!selectedFilePath) {
      downloadMarkdownFile(content, selectedFileName ?? "untitled.md");
      setSaveStatus({ type: "success", message: "파일이 다운로드되었습니다." });
      return;
    }

    setIsSaving(true);
    const result = await saveMarkdownFileContentAction(selectedFilePath, content);
    setIsSaving(false);

    if ("error" in result) {
      setSaveStatus({ type: "error", message: result.error });
      return;
    }
    setSaveStatus({ type: "success", message: "저장되었습니다." });
  };

  return (
    <TooltipProvider>
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <ToolbarIconButton label="파일 탐색기 토글" onClick={() => setSidebarOpen((prev) => !prev)}>
            <PanelLeft className="w-4 h-4" />
          </ToolbarIconButton>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">MD</span>
            </div>
            <h1 className="text-lg font-semibold text-foreground">Markdown Viewer</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tabs
            value={viewMode}
            onValueChange={(v) => {
              setViewMode(v as typeof viewMode);
              setIsPreviewFullscreen(false);
            }}
          >
            <TabsList className="h-9">
              <TabsTrigger value="split" className="px-3">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </TabsTrigger>
              <TabsTrigger value="editor" className="px-3">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </TabsTrigger>
              <TabsTrigger value="preview" className="px-3">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Separator orientation="vertical" className="h-6 mx-2" />

          <ToolbarIconButton label="파일 열기" onClick={handleFileOpen}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
          </ToolbarIconButton>

          <ToolbarIconButton
            label="콘텐츠 새로고침"
            onClick={handleRefresh}
            disabled={!selectedFilePath || isLoadingFile}
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingFile ? "animate-spin" : ""}`} />
          </ToolbarIconButton>

          <ToolbarIconButton label="변경 사항 저장" onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4" />
          </ToolbarIconButton>

          <ToolbarIconButton
            label="새 문서"
            onClick={() => {
              setContent("");
              setSelectedFileName(null);
              setSelectedFilePath(null);
              setLoadError(null);
              setSaveStatus(null);
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </ToolbarIconButton>

          <Separator orientation="vertical" className="h-6 mx-2" />

          <ToolbarIconButton
            label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
            onClick={handleToggleTheme}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </ToolbarIconButton>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt,.markdown"
          className="hidden"
          onChange={handleFileChange}
        />
      </header>

      {draft && (
        <div className="flex items-center gap-3 px-6 py-2 border-b bg-accent/40 text-sm">
          <span className="text-accent-foreground">
            이전에 작성 중이던 내용이 있습니다{draft.selectedFileName ? ` (${draft.selectedFileName})` : ""}.
          </span>
          <button
            type="button"
            onClick={handleRestoreDraft}
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            복구
          </button>
          <button
            type="button"
            onClick={handleDismissDraft}
            className="ml-auto text-muted-foreground underline underline-offset-2 hover:opacity-80"
          >
            무시
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* File Explorer Panel */}
        {sidebarOpen && (
          <div className="flex flex-col w-64 shrink-0 border-r bg-card">
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/50">
              <span className="text-sm font-medium text-muted-foreground">파일 탐색기</span>
            </div>
            <ScrollArea className="flex-1">
              <FileExplorer
                nodes={initialFileTree}
                selectedPath={selectedFilePath}
                onSelectFile={handleSelectDocsFile}
                disabled={isLoadingFile}
              />
            </ScrollArea>
            {isLoadingFile && (
              <p className="px-3 py-2 text-xs text-muted-foreground border-t">불러오는 중...</p>
            )}
            {loadError && (
              <p className="px-3 py-2 text-xs text-destructive border-t">{loadError}</p>
            )}
          </div>
        )}

        <div ref={splitContainerRef} className="flex-1 flex overflow-hidden min-w-0">
        {/* Editor Panel */}
        {!isPreviewFullscreen && (viewMode === "split" || viewMode === "editor") && (
          <div
            className="flex flex-col border-r"
            style={{ width: viewMode === "split" ? `${splitRatio}%` : "100%" }}
          >
            <div className="flex h-10 items-center gap-2 px-4 border-b bg-muted/50">
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="text-sm font-medium text-muted-foreground">에디터</span>
              {selectedFileName && (
                <span className="text-xs text-muted-foreground ml-2">- {selectedFileName}</span>
              )}
              {saveStatus && (
                <span
                  className={`text-xs ml-2 ${
                    saveStatus.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                  }`}
                >
                  {saveStatus.message}
                </span>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {isSaving ? "저장 중... · " : ""}
                {content.length}자
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <textarea
                value={content}
                onChange={(e) => {
                  hasInteractedRef.current = true;
                  setContent(e.target.value);
                  setSaveStatus(null);
                }}
                className="editor-textarea"
                placeholder="마크다운을 입력하세요..."
                spellCheck={false}
              />
            </div>
          </div>
        )}

        {!isPreviewFullscreen && viewMode === "split" && (
          <div
            onPointerDown={handleDividerPointerDown}
            className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-primary/50 active:bg-primary transition-colors"
          />
        )}

        {/* Preview Panel */}
        {(isPreviewFullscreen || viewMode === "split" || viewMode === "preview") && (
          <div
            className="flex flex-col bg-background"
            style={{
              width: isPreviewFullscreen || viewMode !== "split" ? "100%" : `${100 - splitRatio}%`,
            }}
          >
            <div className="flex h-10 items-center gap-2 px-4 border-b bg-muted/50">
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span className="text-sm font-medium text-muted-foreground">미리보기</span>
              <div className="ml-auto">
                <ToolbarIconButton
                  label={isPreviewFullscreen ? "전체 화면 종료" : "전체 화면 보기"}
                  onClick={handleToggleFullscreen}
                  size="icon-sm"
                  className="h-6 w-6"
                >
                  {isPreviewFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                </ToolbarIconButton>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-6">
                <MarkdownContent content={content} />
              </div>
            </ScrollArea>
          </div>
        )}
        </div>
      </main>
    </div>
    </TooltipProvider>
  );
}
