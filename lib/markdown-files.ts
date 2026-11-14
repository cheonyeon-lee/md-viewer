import fs from "node:fs/promises";
import path from "node:path";

const DOCS_ROOT = path.join(process.cwd(), "docs");

export type MarkdownFileNode =
  | { type: "file"; name: string; path: string }
  | { type: "folder"; name: string; path: string; children: MarkdownFileNode[] };

async function buildTree(dir: string, relativeDir: string): Promise<MarkdownFileNode[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nodes: MarkdownFileNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const entryRelativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const children = await buildTree(path.join(dir, entry.name), entryRelativePath);
      if (children.length > 0) {
        nodes.push({ type: "folder", name: entry.name, path: entryRelativePath, children });
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      nodes.push({ type: "file", name: entry.name, path: entryRelativePath });
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, "ko");
  });

  return nodes;
}

/** docs/ 디렉터리 하위의 마크다운 파일을 폴더 구조 그대로 트리로 반환합니다. */
export async function getMarkdownFileTree(): Promise<MarkdownFileNode[]> {
  try {
    await fs.access(DOCS_ROOT);
  } catch {
    return [];
  }
  return buildTree(DOCS_ROOT, "");
}

/**
 * relativePath(클라이언트가 전달한 값)가 docs/ 바깥으로 벗어나지 않고
 * 확장자가 .md인지 검증한 뒤 절대 경로를 반환합니다.
 */
function resolveDocsPath(relativePath: string): string {
  const resolved = path.resolve(DOCS_ROOT, relativePath);
  const relativeToRoot = path.relative(DOCS_ROOT, resolved);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("잘못된 파일 경로입니다.");
  }
  if (path.extname(resolved).toLowerCase() !== ".md") {
    throw new Error("마크다운(.md) 파일만 열 수 있습니다.");
  }

  return resolved;
}

/** docs/ 하위의 마크다운 파일 하나를 읽습니다. */
export async function readMarkdownFile(relativePath: string): Promise<string> {
  const resolved = resolveDocsPath(relativePath);

  try {
    return await fs.readFile(resolved, "utf-8");
  } catch {
    throw new Error("파일을 찾을 수 없습니다.");
  }
}

/** docs/ 하위의 이미 존재하는 마크다운 파일 하나를 덮어씁니다. 새 파일은 만들지 않습니다. */
export async function writeMarkdownFile(relativePath: string, content: string): Promise<void> {
  const resolved = resolveDocsPath(relativePath);

  try {
    await fs.access(resolved);
  } catch {
    throw new Error("파일을 찾을 수 없습니다.");
  }

  await fs.writeFile(resolved, content, "utf-8");
}
