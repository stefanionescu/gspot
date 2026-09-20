// Type aliases of the output modules.

export type Explanation = {
    kind: 'check' | 'tool-rule' | 'preset' | 'setting' | 'path';
    subject: string;
    text: string;
    data: Record<string, unknown>;
};

export type Verbosity = 'quiet' | 'normal' | 'verbose';

export type OutputOptions = { verbosity: Verbosity; json: boolean; color: boolean };

export type ReportOptions = { quiet: boolean; verbose: boolean };

export type PathExplanation = {
    path: string;
    scope: string;
    nature: string;
    natureSource?: string;
    tags: string[];
    presets: string[];
    checks: { check: string; stage: string; preset: string }[];
    baselines: { check: string; rule: string; count: number }[];
    ignores: { check: string; rule?: string; reason: string }[];
    unchecked?: string;
    remedy?: string;
};

/** One option of a choice question. */
export type Choice<T extends string> = { value: T; label: string; hint?: string | undefined };

/** The color functions `paint()` returns. */
export type Painter = Record<'red' | 'green' | 'yellow' | 'dim' | 'bold' | 'cyan', (text: string) => string>;

/** Column widths of the run report, from the longest scope and check name. */
export type Columns = { scope: number; check: number };
