import type { KNIP_ISSUE_TYPES } from '#cli/config/runs/output/knip.ts';

export type SarifMessage = { text?: string | undefined };

export type SarifRegion = { startLine?: number | undefined; startColumn?: number | undefined };

export type SarifResultLocation = { physicalLocation?: SarifPhysicalLocation };

export type SarifResult = {
    ruleId?: string | undefined;
    message?: SarifMessage | undefined;
    locations?: SarifResultLocation[] | undefined;
};

export type SarifArtifact = { location?: SarifArtifactLocation | undefined };

export type SarifNotification = { level?: string | undefined; message?: SarifMessage | undefined };

export type SarifAnalysis = {
    executionSuccessful?: boolean | undefined;
    toolExecutionNotifications?: SarifNotification[] | undefined;
};

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

export type KnipReport = {
    issues: ({ file: string; owners?: { name: string }[] | undefined } & Partial<
        Record<Exclude<(typeof KNIP_ISSUE_TYPES)[number], 'cycles' | 'duplicates'>, KnipSymbol[] | undefined>
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

export type SarifArtifactLocation = {
    uri?: string | undefined;
    uriBaseId?: string | undefined;
    index?: number | undefined;
};

export type SarifPhysicalLocation =
    | { artifactLocation?: SarifArtifactLocation | undefined; region?: SarifRegion | undefined }
    | undefined;

export type SarifRun = {
    results: SarifResult[];
    artifacts?: SarifArtifact[] | undefined;
    originalUriBaseIds?: Record<string, SarifArtifactLocation> | undefined;
    invocations?: SarifAnalysis[] | undefined;
};

/** The rule matches and scanner errors that Semgrep reports. */
export type SemgrepReport = {
    results: { check_id: string; path: string; start: { line: number; col: number }; extra: { message: string } }[];
    errors: {
        code: number;
        type: string | [string, unknown];
        message: string;
        path?: string | undefined;
        spans?: { file: string; start: { line: number; col: number } }[] | undefined;
    }[];
};

/** A reported Knip symbol and its source location. */
export type KnipSymbol = {
    name: string;
    namespace?: string | undefined;
    line?: number | undefined;
    col?: number | undefined;
};

/** The Static Analysis Results Interchange Format (SARIF) version and reports from its runs. */
export type SarifLog = { version: '2.1.0'; runs: SarifRun[] };
