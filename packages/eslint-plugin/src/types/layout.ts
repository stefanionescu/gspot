import type { TSESTree } from '@typescript-eslint/utils';

export type LayoutLine = {
    node: TSESTree.Statement;
    start: number;
    end: number;
    text: string;
    sortText: string;
    lineSpan: number;
    multiLine: boolean;
    index: number;
};

export type LayoutMessages = 'layout' | 'names';

/** The beginning of a statement, including an earlier class decorator. */
export type StatementStart = { offset: number; line: number };
