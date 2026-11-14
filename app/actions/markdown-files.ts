"use server";

import { readMarkdownFile, writeMarkdownFile } from "@/lib/markdown-files";

const MAX_CONTENT_LENGTH = 5_000_000; // 5MB

export async function getMarkdownFileContentAction(
  relativePath: string
): Promise<{ content: string } | { error: string }> {
  try {
    const content = await readMarkdownFile(relativePath);
    return { content };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "파일을 불러오지 못했습니다.",
    };
  }
}

export async function saveMarkdownFileContentAction(
  relativePath: string,
  content: string
): Promise<{ success: true } | { error: string }> {
  if (content.trim().length === 0) {
    return { error: "저장할 내용이 없습니다." };
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return { error: "파일 크기가 너무 큽니다 (5MB 초과)." };
  }

  try {
    await writeMarkdownFile(relativePath, content);
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "파일을 저장하지 못했습니다.",
    };
  }
}
