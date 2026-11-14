import { MarkdownViewerApp } from "@/components/markdown-viewer/markdown-viewer-app";
import { getMarkdownFileTree } from "@/lib/markdown-files";

export default async function Home() {
  const fileTree = await getMarkdownFileTree();

  return <MarkdownViewerApp initialFileTree={fileTree} />;
}
