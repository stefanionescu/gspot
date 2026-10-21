import type { Finding } from '#cli/types/runs/check.ts';
import type { CHECK_RUNS } from '#cli/config/configurations.ts';
import type { KNIP_ISSUE_TYPES } from '#cli/config/runs/output.ts';

export type ReportInput = OutputPaths & {
    check: string;
    help: string;
    stdout: string;
    text: string;
    output: OutputSpec;
};

/** The output table accepted by configuration and command checks. */
export type OutputInput = {
    format: 'regex' | 'grouped' | 'sarif' | 'knip' | 'semgrep' | 'typos' | 'markdownlint' | 'json' | 'lines' | 'none';
    items?: string | undefined;
    children?: string | undefined;
    line_base?: 0 | 1 | undefined;
    fields?:
        | {
              file?: string | undefined;
              line?: string | undefined;
              column?: string | undefined;
              rule?: string | undefined;
              message?: string | undefined;
              fixable?: string | undefined;
          }
        | undefined;
    pattern?: string | undefined;
    file_pattern?: string | undefined;
    fixable?: string | undefined;
    message?: string | undefined;
};

/** Output patterns after the parsing schema supplies the defaults of each format. */
export type OutputSpec = Omit<OutputInput, 'format' | 'pattern' | 'file_pattern'> &
    (
        | { format: 'regex'; pattern: string; file_pattern?: string | undefined }
        | { format: 'grouped'; pattern: string; file_pattern: string }
        | {
              format: Exclude<OutputInput['format'], 'regex' | 'grouped'>;
              pattern?: string | undefined;
              file_pattern?: string | undefined;
          }
    );

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

export type OutputPaths = { cwd: string; root: string };

/** Check identity, output declaration, and fixer command consumed by output parsing. */
export type ParsingCheck = {
    name: string;
    help: string;
    runs: (typeof CHECK_RUNS)[number];
    output: OutputSpec;
    fix?: string[] | undefined;
};

/** The parser of one format and its source-file checks. */
export type OutputDescriptor = {
    read: (input: ReportInput) => Finding[];
    namesFiles: (output: OutputSpec) => boolean;
};

export type SarifMessage = { text?: string | undefined };

export type SarifArtifactLocation = {
    uri?: string | undefined;
    uriBaseId?: string | undefined;
    index?: number | undefined;
};

export type SarifRegion = { startLine?: number | undefined; startColumn?: number | undefined };

export type SarifPhysicalLocation =
    | { artifactLocation?: SarifArtifactLocation | undefined; region?: SarifRegion | undefined }
    | undefined;

export type SarifResultLocation = { physicalLocation?: SarifPhysicalLocation };

export type SarifResult = {
    ruleId?: string | undefined;
    message?: SarifMessage | undefined;
    locations?: SarifResultLocation[] | undefined;
};

export type SarifArtifact = { location?: SarifArtifactLocation | undefined };

export type SarifNotification = { level?: string | undefined; message?: SarifMessage | undefined };

export type SarifInvocation = {
    executionSuccessful?: boolean | undefined;
    toolExecutionNotifications?: SarifNotification[] | undefined;
};

export type SarifRun = {
    results: SarifResult[];
    artifacts?: SarifArtifact[] | undefined;
    originalUriBaseIds?: Record<string, SarifArtifactLocation> | undefined;
    invocations?: SarifInvocation[] | undefined;
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
