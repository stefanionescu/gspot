import type { Finding } from '#cli/types/runs/check.ts';
import type { CHECK_RUNS } from '#cli/config/configurations/names.ts';

export type ToolOutput = OutputPaths & {
    check: string;
    help: string;
    stdout: string;
    text: string;
    output: CheckOutput;
};

export type WrittenOutput = {
    format: 'regex' | 'grouped' | 'knip' | 'semgrep' | 'typos' | 'markdownlint' | 'taplo' | 'json' | 'lines' | 'none';
    list?: string | undefined;
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

export type CheckOutput = Omit<WrittenOutput, 'format' | 'pattern' | 'file_pattern'> &
    (
        | { format: 'regex'; pattern: string; file_pattern?: string | undefined }
        | { format: 'grouped'; pattern: string; file_pattern: string }
        | {
              format: Exclude<WrittenOutput['format'], 'regex' | 'grouped'>;
              pattern?: string | undefined;
              file_pattern?: string | undefined;
          }
    );

export type OutputPaths = { cwd: string; root: string };

export type ParsingCheck = {
    id: string;
    help: string;
    runs: (typeof CHECK_RUNS)[number];
    output: CheckOutput;
    fix?: string[] | undefined;
};

export type OutputParser = {
    parse: (output: ToolOutput) => Finding[];
    namesFiles: (output: CheckOutput) => boolean;
};
