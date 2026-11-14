"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

type MermaidApi = (typeof import("mermaid"))["default"];
type MermaidTheme = "dark" | "default";

interface MermaidTarget {
  /** 교체할 노드: 아직 처리되지 않은 <pre> 또는 이미 만든 div.mermaid-block */
  element: HTMLElement;
  source: string;
}

type RenderResult = { ok: true; svg: string } | { ok: false; message: string };

const MERMAID_CODE_SELECTOR = "pre > code.language-mermaid";
const MERMAID_BLOCK_SELECTOR = "div.mermaid-block[data-mermaid-source]";
const RENDER_DEBOUNCE_MS = 300;
const SVG_CACHE_LIMIT = 50;
const ERROR_MESSAGE_MAX_LENGTH = 200;

// useId 값에는 querySelector에서 문제가 되는 문자가 섞일 수 있어 모듈 카운터로 고유 id를 만든다.
let renderIdCounter = 0;
const svgCache = new Map<string, string>();
let mermaidPromise: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    const promise = import("mermaid").then((module) => module.default);
    mermaidPromise = promise;
    // 로드 실패 시 다음 시도에서 다시 받도록 초기화한다.
    promise.catch(() => {
      if (mermaidPromise === promise) mermaidPromise = null;
    });
  }
  return mermaidPromise;
}

function cacheKey(theme: MermaidTheme, source: string): string {
  return `${theme}\u0000${source}`;
}

function cacheSet(key: string, svg: string): void {
  svgCache.delete(key);
  svgCache.set(key, svg);
  while (svgCache.size > SVG_CACHE_LIMIT) {
    const oldestKey = svgCache.keys().next().value;
    if (oldestKey === undefined) break;
    svgCache.delete(oldestKey);
  }
}

function collectTargets(container: HTMLElement): MermaidTarget[] {
  const targets: MermaidTarget[] = [];

  container.querySelectorAll<HTMLElement>(MERMAID_CODE_SELECTOR).forEach((code) => {
    // 오류 블록 안의 원본 코드는 블록 단위로 따로 수집한다.
    if (code.closest(".mermaid-block")) return;
    const pre = code.parentElement;
    const source = code.textContent ?? "";
    if (!pre || source.trim().length === 0) return;
    targets.push({ element: pre, source });
  });

  container.querySelectorAll<HTMLElement>(MERMAID_BLOCK_SELECTOR).forEach((block) => {
    const source = block.dataset.mermaidSource ?? "";
    if (source.trim().length === 0) return;
    targets.push({ element: block, source });
  });

  return targets;
}

function isRenderedForTheme(target: MermaidTarget, theme: MermaidTheme): boolean {
  const { dataset } = target.element;
  return dataset.mermaidState === "rendered" && dataset.mermaidTheme === theme;
}

/** 대상이 이미 div.mermaid-block이면 재사용하고, 아니면 새 블록으로 교체한다. */
function ensureBlock(target: MermaidTarget): HTMLElement {
  if (target.element.classList.contains("mermaid-block")) return target.element;
  const block = document.createElement("div");
  block.className = "mermaid-block";
  // 원본은 속성 값으로만 보관한다(HTML로 해석되지 않음).
  block.dataset.mermaidSource = target.source;
  target.element.replaceWith(block);
  target.element = block;
  return block;
}

function applySvg(target: MermaidTarget, svg: string, theme: MermaidTheme): void {
  const block = ensureBlock(target);
  block.dataset.mermaidState = "rendered";
  block.dataset.mermaidTheme = theme;
  // securityLevel "strict"로 mermaid가 만든 SVG만 넣는다. 사용자 원문은 이 경로로 들어오지 않는다.
  block.innerHTML = svg;
}

function applyError(target: MermaidTarget, message: string): void {
  const block = ensureBlock(target);
  block.dataset.mermaidState = "error";
  delete block.dataset.mermaidTheme;

  const errorText = document.createElement("p");
  errorText.className = "mermaid-error";
  errorText.textContent = `다이어그램 오류: ${message}`;

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.className = "language-mermaid";
  code.textContent = target.source;
  pre.append(code);

  block.replaceChildren(errorText, pre);
}

function toErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lines = raw.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  // mermaid 파서 오류는 "Parse error on line N:" 다음에 "Expecting ..." 줄이 있어 함께 보여 준다.
  const expecting = lines.find((line) => line.startsWith("Expecting"));
  const summary = [lines[0] ?? "알 수 없는 오류", expecting].filter(Boolean).join(" ");
  return summary.length > ERROR_MESSAGE_MAX_LENGTH
    ? `${summary.slice(0, ERROR_MESSAGE_MAX_LENGTH)}…`
    : summary;
}

async function renderOne(mermaid: MermaidApi, source: string): Promise<RenderResult> {
  const id = `mermaid-svg-${++renderIdCounter}`;
  try {
    await mermaid.parse(source);
    const { svg } = await mermaid.render(id, source);
    return { ok: true, svg };
  } catch (error: unknown) {
    return { ok: false, message: toErrorMessage(error) };
  } finally {
    // 실패 시 mermaid가 body에 남길 수 있는 임시 노드를 정리한다.
    document.getElementById(id)?.remove();
    document.getElementById(`d${id}`)?.remove();
  }
}

/**
 * 미리보기 컨테이너 안의 ```mermaid 코드 블록을 mermaid SVG로 교체한다.
 * html 또는 테마가 바뀌면 캐시는 즉시 반영하고, 나머지는 디바운스 후 렌더링한다.
 */
export function useMermaidDiagrams(
  containerRef: RefObject<HTMLElement | null>,
  html: string,
  isDark: boolean,
): void {
  const seqRef = useRef(0);
  const theme: MermaidTheme = isDark ? "dark" : "default";

  // 입력할 때마다 React가 DOM을 원본 코드로 되돌리므로, 캐시된 SVG는 페인트 전에 바로 붙여 깜빡임을 막는다.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    for (const target of collectTargets(container)) {
      if (isRenderedForTheme(target, theme)) continue;
      const cached = svgCache.get(cacheKey(theme, target.source));
      if (cached !== undefined) applySvg(target, cached, theme);
    }
  }, [containerRef, html, theme]);

  useEffect(() => {
    const seq = ++seqRef.current;
    let cancelled = false;
    const isStale = () => cancelled || seq !== seqRef.current;

    const timer = window.setTimeout(async () => {
      const container = containerRef.current;
      if (!container || isStale()) return;
      const pending = collectTargets(container).filter((target) => !isRenderedForTheme(target, theme));
      if (pending.length === 0) return;

      let mermaid: MermaidApi;
      try {
        mermaid = await loadMermaid();
      } catch {
        if (isStale()) return;
        pending.forEach((target) => {
          if (target.element.isConnected) applyError(target, "mermaid를 불러오지 못했습니다.");
        });
        return;
      }
      if (isStale()) return;

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme,
        suppressErrorRendering: true,
      });

      for (const target of pending) {
        // 블록마다 확인해 오래된 실행이 새 실행의 전역 설정을 덮지 않게 한다.
        if (isStale()) return;
        const result = await renderOne(mermaid, target.source);
        if (isStale() || !target.element.isConnected) continue;
        if (result.ok) {
          cacheSet(cacheKey(theme, target.source), result.svg);
          applySvg(target, result.svg, theme);
        } else {
          applyError(target, result.message);
        }
      }
    }, RENDER_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [containerRef, html, theme]);
}
