import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize, defaultSchema)
  .use(rehypeStringify);

/** 마크다운을 안전한(sanitize된) HTML 문자열로 변환합니다. 원본 HTML 태그는 렌더링되지 않습니다. */
export function renderMarkdownToSafeHtml(markdown: string): string {
  return String(processor.processSync(markdown));
}
