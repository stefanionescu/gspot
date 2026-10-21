/** One Markdown code block and its one-based source span. */
export type CodeFence = { language: string; meta: string; body: string; startLine: number; endLine: number };
