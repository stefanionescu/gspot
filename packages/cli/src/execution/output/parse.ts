import { z } from 'zod';
import { realpathSync } from 'node:fs';
import { toPosix } from '#cli/platform/paths.ts';
// Findings from a tool's output: one parser per output format a manifest can declare.
import type { Finding } from '#cli/checks/result.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { isAbsolute, relative, resolve } from 'node:path';
import { parseJson } from '#cli/execution/output/json.ts';
import type { CheckSpec } from '#cli/configurations/schema.ts';
import type { OutputFormat } from '#cli/configurations/output-format.ts';

/** What the regex output parser needs per line: the format, the compiled fixable pattern and the help text. */
type RegexParser = { output: OutputFormat; fixable: RegExp | undefined; help: string };

const DEFAULT_PATTERN = String.raw`^(?<file>[^:\s][^:]*):(?<line>\d+):(?:(?<column>\d+):)?\s*(?<message>.*)$`;
const DEFAULT_FILE_PATTERN = String.raw`^(?<file>[^\s].*):$`;
const DEFAULT_GROUPED_PATTERN = String.raw`^\s+(?<line>\d+): (?<message>.*)$`;
const TRAILING_BRACKET_RULE = /\[(?<rule>[\w:/@.-]+)\]$/u;
const TRAILING_PAREN_RULE = /\((?<rule>[a-z0-9_:/@.-]+)\)$/u;

const eslintEntry = z.object({
    ruleId: z.string().nullable(),
    line: z.number().int().positive().optional(),
    column: z.number().int().positive().optional(),
    message: z.string(),
    fix: z.unknown().optional(),
    severity: z.union([z.literal(1), z.literal(2)]),
});
const eslintFiles = z.array(z.object({ filePath: z.string().min(1), messages: z.array(eslintEntry) }));

const markdownlintEntries = z.array(
    z.object({
        fileName: z.string().min(1),
        lineNumber: z.number().int().positive(),
        ruleNames: z.tuple([z.string().min(1)]).rest(z.string().min(1)),
        ruleDescription: z.string().min(1),
        errorDetail: z.string().nullable(),
        errorContext: z.string().nullable(),
        errorRange: z.tuple([z.number().int().positive(), z.number().int().nonnegative()]).nullable(),
        fixInfo: z.record(z.string(), z.unknown()).nullable(),
        severity: z.enum(['error', 'warning']),
    }),
);

function markdownlintFindings(check: string, stdout: string, help: string, root: string, cwd: string): Finding[] {
    const sources = new Map<string, string[]>();
    try {
        return markdownlintEntries.parse(JSON.parse(stdout)).map((entry) => {
            const file = toPosix(relative(root, resolve(cwd, entry.fileName)));
            let lines = sources.get(file);
            if (lines === undefined) {
                lines = readSource(root, file).toString('utf8').split('\n');
                sources.set(file, lines);
            }
            const line = lines[entry.lineNumber - 1];
            if (line === undefined || (entry.errorRange !== null && entry.errorRange[0] > line.length + 1))
                throw new Error(`The reported position is outside the source: ${file}`);
            return {
                check,
                file,
                line: entry.lineNumber,
                ...(entry.errorRange === null ? {} : { column: entry.errorRange[0] }),
                rule: entry.ruleNames[0],
                message: [entry.ruleDescription, entry.errorDetail, entry.errorContext]
                    .filter((part) => part !== null)
                    .join(': '),
                help,
                fixable: entry.fixInfo !== null,
            };
        });
    } catch (error) {
        throw new ToolOutputError('Markdownlint returned invalid structured findings or unavailable source.', {
            cause: error,
        });
    }
}

const trufflehogFinding = z.object({
    DetectorName: z.string().min(1),
    Verified: z.literal(true),
    SourceMetadata: z.object({ Data: z.object({ JsonEnumerator: z.object({ metadata: z.string() }) }) }),
});
const historyMetadata = z.object({ commit: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u), file: z.string() });

const typosEntry = z.object({
    type: z.literal('typo'),
    path: z.string().min(1),
    line_num: z.number().int().positive().optional(),
    byte_offset: z.number().int().nonnegative(),
    typo: z.string().min(1),
    corrections: z.array(z.string()).nullable(),
});

// JSON preserves filename delimiters. Native offsets count UTF-8 bytes, while report columns count characters.
function typosFindings(check: string, stdout: string, help: string, root: string, cwd: string): Finding[] {
    const linesByPath = new Map<string, Buffer[]>();
    try {
        return stdout
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line) => {
                const entry = typosEntry.parse(JSON.parse(line));
                const path = toPosix(relative(root, resolve(cwd, entry.path)));
                const corrections = entry.corrections ?? [];
                const replacement = corrections.map((word) => `\`${word}\``).join(', ');
                const message =
                    corrections.length === 0
                        ? `\`${entry.typo}\` is not allowed`
                        : `\`${entry.typo}\` should be ${replacement}`;
                const finding: Finding = {
                    check,
                    file: path,
                    help,
                    message: entry.line_num === undefined ? `Filename: ${message}` : message,
                    fixable: entry.line_num !== undefined && corrections.length === 1,
                };
                if (entry.line_num !== undefined) {
                    let lines = linesByPath.get(path);
                    if (lines === undefined) {
                        const source = readSource(root, path);
                        lines = [];
                        let start = 0;
                        for (let index = 0; index < source.length; index += 1)
                            if (source[index] === 10) {
                                lines.push(source.subarray(start, index));
                                start = index + 1;
                            }
                        lines.push(source.subarray(start));
                        linesByPath.set(path, lines);
                    }
                    const sourceLine = lines[entry.line_num - 1];
                    if (sourceLine === undefined || entry.byte_offset > sourceLine.length)
                        throw new Error(`The reported position is outside the source: ${path}`);
                    finding.line = entry.line_num;
                    finding.column = [...sourceLine.subarray(0, entry.byte_offset).toString('utf8')].length + 1;
                }
                return finding;
            });
    } catch (error) {
        throw new ToolOutputError('typos returned invalid structured findings or unavailable source.', {
            cause: error,
        });
    }
}

function trufflehogFindings(check: string, stdout: string, help: string): Finding[] {
    const findings: Finding[] = [];
    for (const line of stdout.split('\n').filter((line) => line.trim() !== '')) {
        try {
            const result = trufflehogFinding.parse(JSON.parse(line));
            const metadata = historyMetadata.parse(JSON.parse(result.SourceMetadata.Data.JsonEnumerator.metadata));
            findings.push({
                check,
                file: metadata.file,
                rule: result.DetectorName,
                message: `Verified ${result.DetectorName} credential in commit ${metadata.commit}.`,
                help,
                fixable: false,
            });
        } catch {
            throw new ToolOutputError('TruffleHog returned invalid structured findings; raw output was withheld.');
        }
    }
    return findings;
}

const DEFAULT_OUTPUT: OutputFormat = { format: 'regex', pattern: DEFAULT_PATTERN };

function compiled(source: string | undefined, standard: string): RegExp {
    return new RegExp(source ?? standard, 'u');
}

function stripDotSlash(path: string): string {
    return path.startsWith('./') ? path.slice(2) : path;
}

function positioned(finding: Finding, groups: Record<string, string | undefined>): Finding {
    const line = groups['line'];
    const column = groups['column'];
    const rule = groups['rule'];
    if (line !== undefined && line !== '') finding.line = Number(line);
    if (column !== undefined && column !== '') finding.column = Number(column);
    if (rule !== undefined && rule !== '') finding.rule = rule;
    return finding;
}

function splitTrailingRule(finding: Finding): void {
    if (finding.rule !== undefined) return;
    const text = finding.message.trimEnd();
    const trailing = TRAILING_BRACKET_RULE.exec(text) ?? TRAILING_PAREN_RULE.exec(text);
    const rule = trailing?.groups?.['rule'];
    if (trailing === null || rule === undefined) return;
    finding.rule = rule;
    finding.message = text.slice(0, trailing.index).trim();
}

function isFixable(output: OutputFormat, fixable: RegExp | undefined, line: string): boolean {
    if (fixable) return fixable.test(line);
    return output.fixable === undefined && output.message !== undefined;
}

function regexFinding(
    check: string,
    parser: RegexParser,
    line: string,
    groups: Record<string, string | undefined>,
): Finding {
    const { output, fixable, help } = parser;
    const finding = positioned(
        {
            check,
            file: stripDotSlash(groups['file'] ?? ''),
            message: (groups['message'] ?? output.message ?? line).trim(),
            help,
            fixable: isFixable(output, fixable, line),
        },
        groups,
    );
    splitTrailingRule(finding);
    return finding;
}

function parseRegex(check: string, output: OutputFormat, text: string, help: string): Finding[] {
    const pattern = compiled(output.pattern, DEFAULT_PATTERN);
    const fixable = output.fixable === undefined ? undefined : compiled(output.fixable, '');
    const parser: RegexParser = { output, fixable, help };
    const findings = new Map<string, Finding>();
    for (const line of text.split('\n')) {
        const groups = pattern.exec(line)?.groups;
        if (groups) {
            const finding = regexFinding(check, parser, line, groups);
            findings.set(JSON.stringify(finding), finding);
        }
    }
    return findings.values().toArray();
}

function groupedFinding(
    check: string,
    file: string,
    help: string,
    line: string,
    groups: Record<string, string | undefined>,
): Finding {
    const text = (groups['message'] ?? line).trim();
    return positioned({ check, file, message: text, help, fixable: false }, groups);
}

function parseGrouped(check: string, output: OutputFormat, text: string, help: string): Finding[] {
    const filePattern = compiled(output.file_pattern, DEFAULT_FILE_PATTERN);
    const pattern = compiled(output.pattern, DEFAULT_GROUPED_PATTERN);
    const findings: Finding[] = [];
    let file = '';
    for (const line of text.split('\n')) {
        const header = filePattern.exec(line)?.groups?.['file'];
        if (header !== undefined) {
            file = stripDotSlash(header);
            continue;
        }
        const groups = pattern.exec(line)?.groups;
        if (groups) findings.push(groupedFinding(check, file, help, line, groups));
    }
    return findings;
}

function eslintFinding(check: string, file: string, entry: z.infer<typeof eslintEntry>, help: string): Finding {
    const finding: Finding = { check, file, message: entry.message, help, fixable: entry.fix !== undefined };
    if (entry.line !== undefined) finding.line = entry.line;
    if (entry.column !== undefined) finding.column = entry.column;
    if (entry.ruleId !== null) finding.rule = entry.ruleId;
    return finding;
}

function parseEslintJson(check: string, text: string, help: string, root: string): Finding[] {
    let files: z.infer<typeof eslintFiles>;
    try {
        files = eslintFiles.parse(JSON.parse(text));
    } catch (error) {
        throw new ToolOutputError('ESLint returned invalid structured findings.', { cause: error });
    }
    const prefix = `${root.replaceAll('\\', '/').replace(/\/$/u, '')}/`;
    return files.flatMap((file) => {
        const path = file.filePath.replaceAll('\\', '/');
        const relative = path.startsWith(prefix) ? path.slice(prefix.length) : path;
        return file.messages.map((entry) => eslintFinding(check, relative, entry, help));
    });
}

function parseLines(check: string, text: string, help: string): Finding[] {
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .map((line) => ({ check, file: '', message: line, help, fixable: false }));
}

/**
 * Findings from a tool's output, per the check's output format.
 * @param spec the check
 * @param stdout what the tool printed
 * @param stderr what the tool printed on its error stream
 * @param root the repository root, to make the absolute paths ESLint prints relative
 * @param cwd
 * @returns the findings
 */
function parseRaw(spec: CheckSpec, stdout: string, stderr: string, root: string, cwd: string): Finding[] {
    const output = spec.output ?? DEFAULT_OUTPUT;
    // A tool that colors its output although nothing reads colors still yields clean paths and messages.
    const text = Bun.stripANSI(`${stdout}\n${stderr}`).replaceAll('\r\n', '\n');
    switch (output.format) {
        case 'none': {
            return [];
        }
        case 'json': {
            try {
                return parseJson(spec.name, output, stdout, spec.help);
            } catch (error) {
                throw new ToolOutputError('The tool returned an invalid JSON report.', { cause: error });
            }
        }
        case 'trufflehog-json': {
            return trufflehogFindings(spec.name, stdout, spec.help);
        }
        case 'typos-json': {
            return typosFindings(spec.name, stdout, spec.help, root, cwd);
        }
        case 'markdownlint-json': {
            return markdownlintFindings(spec.name, stdout, spec.help, root, cwd);
        }
        case 'eslint-json': {
            return parseEslintJson(spec.name, stdout, spec.help, root);
        }
        case 'lines': {
            return parseLines(spec.name, text, spec.help);
        }
        case 'regex': {
            return parseRegex(spec.name, output, text, spec.help);
        }
        case 'grouped': {
            return parseGrouped(spec.name, output, text, spec.help);
        }
    }
}

function relativeTo(root: string, file: string): string {
    const prefix = `${root}/`;
    if (file.startsWith(prefix)) return file.slice(prefix.length);
    if (!isAbsolute(file)) return file;
    try {
        const canonicalRoot = `${toPosix(realpathSync(root))}/`;
        const canonicalFile = toPosix(realpathSync(file));
        return canonicalFile.startsWith(canonicalRoot) ? canonicalFile.slice(canonicalRoot.length) : file;
    } catch (error) {
        if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) return file;
        throw error;
    }
}

/**
 * The findings a tool's output holds, with every path relative to the root.
 * @param spec the check
 * @param stdout the tool's standard output
 * @param stderr the tool's standard error
 * @param root the repository root, to make absolute paths relative
 * @param cwd the tool working directory, for native relative source paths
 * @returns the findings
 */
export function parseOutput(spec: CheckSpec, stdout: string, stderr: string, root: string, cwd = root): Finding[] {
    return parseRaw(spec, stdout, stderr, root, cwd).map((finding) => ({
        ...finding,
        fixable: spec.fix_command !== undefined && finding.fixable,
        file: relativeTo(toPosix(root), toPosix(finding.file)),
    }));
}

/** A tool response that cannot be interpreted safely as findings. */
export class ToolOutputError extends Error {
    override name = 'ToolOutputError';
}
