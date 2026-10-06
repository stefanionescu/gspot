import type { Finding } from '#cli/types/execution/runtime.ts';

/** Authored compiler inputs, expected native diagnostics and source correction for one JavaScript project. */
export type JsconfigCase = {
    name: string;
    scope: string;
    tables: string;
    files: Record<string, string>;
    sourceFile: string;
    correctedSource: string;
    diagnostics: Required<Pick<Finding, 'file' | 'line' | 'column' | 'rule' | 'message'>>[];
};
