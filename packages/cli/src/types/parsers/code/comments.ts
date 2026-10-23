export type SourceComment = { line: number; text: string; standalone: boolean };

export type CommentParser = (text: string, path: string) => SourceComment[] | Promise<SourceComment[]>;
