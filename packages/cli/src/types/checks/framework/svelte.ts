export type SvelteFinding = {
    filename: string;
    start: { line: number; character: number };
    message: string;
    code?: string | number | undefined;
};
