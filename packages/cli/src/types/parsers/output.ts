import type { Finding } from '#cli/types/execution/check.ts';
import type { OUTPUT_FILE_TYPES, KNIP_ISSUE_CATEGORIES, MARKDOWNLINT_SEVERITIES } from '#cli/config/parsers/output.ts';

type Parsing = OutputPaths & { check: ParsingCheck; stdout: string; text: string };

/** The output table accepted by configuration and command checks. */
export type OutputInput = {
    format:
        | 'regex'
        | 'grouped'
        | 'sarif'
        | 'knip'
        | 'semgrep'
        | 'trufflehog'
        | 'typos'
        | 'markdownlint'
        | 'json'
        | 'lines'
        | 'none';
    items?: string | undefined;
    children?: string | undefined;
    line_base?: 0 | 1 | undefined;
    file_type?: (typeof OUTPUT_FILE_TYPES)[number] | undefined;
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

/** Output patterns after the parsing schema supplies each format's defaults. */
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

export type MarkdownlintEntry = {
    fileName: string;
    lineNumber: number;
    ruleNames: [string, ...string[]];
    ruleDescription: string;
    errorDetail: string | null;
    errorContext: string | null;
    errorRange: [number, number] | null;
    fixInfo: Record<string, unknown> | null;
    severity: (typeof MARKDOWNLINT_SEVERITIES)[number];
};

export type KnipReport = {
    issues: ({ file: string; owners?: { name: string }[] | undefined } & Partial<
        Record<Exclude<(typeof KNIP_ISSUE_CATEGORIES)[number], 'cycles' | 'duplicates'>, KnipSymbol[] | undefined>
    > & { cycles?: KnipSymbol[][] | undefined; duplicates?: KnipSymbol[][] | undefined })[];
};

export type TypoEntry = {
    type: 'typo';
    path: string;
    byte_offset: number;
    typo: string;
    corrections: string[] | null;
    line_num?: number | undefined;
};

/** Output patterns and metadata owned by the parsing boundary. */
export type RegexParser = { output: OutputSpec; fixable: RegExp | undefined; help: string };

export type OutputPaths = { cwd: string; root: string };

/** Check identity, output declaration, and fixer command consumed by output parsing. */
export type ParsingCheck = { name: string; help: string; output: OutputSpec; fix?: string[] | undefined };

/** Manifest field mappings and public metadata for one JSON finding. */
export type JsonFindingSpec = { check: string; help: string; output: OutputSpec };

/** A Vale diagnostic normalized to a repository path and one-based source location. */

/** One format's parser, source-file checks and protection of captured output. */
export type OutputDescriptor = {
    read?: (parsing: Parsing, output: OutputSpec) => Finding[];
    namesFiles: (output: OutputSpec) => boolean;
    redactsOutput: boolean;
};

export type SarifRun = {
    results: {
        ruleId?: string | undefined;
        message?: { text?: string | undefined } | undefined;
        locations?:
            | {
                  physicalLocation?:
                      | {
                            artifactLocation?:
                                | {
                                      uri?: string | undefined;
                                      uriBaseId?: string | undefined;
                                      index?: number | undefined;
                                  }
                                | undefined;
                            region?: { startLine?: number | undefined; startColumn?: number | undefined } | undefined;
                        }
                      | undefined;
              }[]
            | undefined;
    }[];
    artifacts?:
        | {
              location?:
                  | { uri?: string | undefined; uriBaseId?: string | undefined; index?: number | undefined }
                  | undefined;
          }[]
        | undefined;
    originalUriBaseIds?:
        | Record<string, { uri?: string | undefined; uriBaseId?: string | undefined; index?: number | undefined }>
        | undefined;
    invocations?:
        | {
              executionSuccessful?: boolean | undefined;
              toolExecutionNotifications?:
                  | { level?: string | undefined; message?: { text?: string | undefined } | undefined }[]
                  | undefined;
          }[]
        | undefined;
};

export type SarifArtifactLocation = NonNullable<NonNullable<SarifRun['artifacts']>[number]['location']>;

export type SarifPhysicalLocation = NonNullable<SarifRun['results'][number]['locations']>[number]['physicalLocation'];

/** Rule matches and scanner diagnostics emitted by native Semgrep. */
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
    kind?: string | undefined;
    specifier?: string | undefined;
    line?: number | undefined;
    col?: number | undefined;
    pos?: number | undefined;
};

/** The Static Analysis Results Interchange Format (SARIF) version and reports from its runs. */
export type SarifLog = { version: '2.1.0'; runs: SarifRun[] };

export type TrufflehogResult = {
    DetectorName: string;
    Verified: true;
    SourceMetadata: {
        Data: {
            JsonEnumerator: {
                metadata: string;
            };
        };
    };
};
export type TrufflehogMetadata = { commit: string; file: string };
