import type { KNIP_ISSUE_MESSAGES } from '#cli/config/runs/output/knip.ts';

export type MarkdownlintResult = {
    fileName: string;
    lineNumber: number;
    ruleNames: [string, ...string[]];
    ruleDescription: string;
    errorDetail: string | null;
    errorContext: string | null;
    errorRange: [number, number] | null;
    fixInfo: Record<string, unknown> | null;
};

export type KnipOutput = {
    issues: ({ file: string; owners?: { name: string }[] | undefined } & Partial<
        Record<Exclude<keyof typeof KNIP_ISSUE_MESSAGES, 'cycles' | 'duplicates'>, KnipSymbol[] | undefined>
    > & { cycles?: KnipSymbol[][] | undefined; duplicates?: KnipSymbol[][] | undefined })[];
};

export type ReportedTypo = {
    type: 'typo';
    path: string;
    byte_offset: number;
    typo: string;
    corrections: string[] | null;
    line_num?: number | undefined;
};

export type SemgrepOutput = {
    results: { check_id: string; path: string; start: { line: number; col: number }; extra: { message: string } }[];
    errors: {
        code: number;
        type: string | [string, unknown];
        message: string;
        path?: string | undefined;
        spans?: { file: string; start: { line: number; col: number } }[] | undefined;
    }[];
};

export type KnipSymbol = {
    name: string;
    namespace?: string | undefined;
    line?: number | undefined;
    col?: number | undefined;
};
