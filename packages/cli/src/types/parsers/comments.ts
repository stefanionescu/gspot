export type SourceComment = { line: number; text: string; standalone: boolean };

/** Each syntax reader accepts source text and its path. Synchronous readers return comments directly. */
export type CommentReader = (text: string, path: string) => SourceComment[] | Promise<SourceComment[]>;
