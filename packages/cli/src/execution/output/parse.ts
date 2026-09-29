// Findings from a tool's output: one parser per output format a manifest can declare.
import { z } from 'zod';
import { isAbsolute } from 'node:path';
import { realpathSync } from 'node:fs';
import type { Finding } from '#cli/types/checks.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { parseJson } from '#cli/execution/output/json.ts';
import { toPosix, toolPath } from '#cli/platform/paths.ts';
import type { CheckSpec, OutputFormat } from '#cli/types/kits.ts';
import { ESLINT_WARN, ESLINT_ERROR } from '#cli/config/native.ts';
import type { Parsing, RegexParser } from '#cli/types/execution/output.ts';
import { typosFindings, trufflehogFindings, markdownlintFindings } from '#cli/execution/output/tool-formats.ts';

import {
    DEFAULT_PATTERN,
    TRAILING_PAREN_RULE,
    DEFAULT_FILE_PATTERN,
    DEFAULT_OUTPUT_FORMAT,
    TRAILING_BRACKET_RULE,
    DEFAULT_GROUPED_PATTERN,
} from '#cli/config/execution/output.ts';

const eslintEntry = z.object({
    ruleId: z.string().nullable(),
    line: z.number().int().positive().optional(),
    column: z.number().int().positive().optional(),
    message: z.string(),
    fix: z.unknown().optional(),
    severity: z.union([z.literal(ESLINT_WARN), z.literal(ESLINT_ERROR)]),
});
const eslintFiles = z.array(z.object({ filePath: z.string().min(1), messages: z.array(eslintEntry) }));

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Its callers sit at the complexity or length limit; inlining the expression pushes them over.
function compiled(source: string | undefined, standard: string): RegExp {
    return new RegExp(source ?? standard, 'u');
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Its callers sit at the complexity or length limit; inlining the expression pushes them over.
function stripDotSlash(path: string): string {
    return path.startsWith('./') ? path.slice('./'.length) : path;
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
        if (groups) {
            const text = (groups['message'] ?? line).trim();
            findings.push(positioned({ check, file, message: text, help, fixable: false }, groups));
        }
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
        throw new GspotError('tool-output', 'ESLint returned invalid structured findings.', { cause: error });
    }
    const prefix = `${toolPath(root).replace(/\/$/u, '')}/`;
    return files.flatMap((file) => {
        const path = toolPath(file.filePath);
        const relative = path.startsWith(prefix) ? path.slice(prefix.length) : path;
        return file.messages.map((entry) => eslintFinding(check, relative, entry, help));
    });
}

// Findings from a JSON report, or an error for an unreadable report.
function jsonFindings(parsing: Parsing, output: OutputFormat): Finding[] {
    try {
        return parseJson(parsing.spec.name, output, parsing.stdout, parsing.spec.help);
    } catch (error) {
        throw new GspotError('tool-output', 'The tool returned an invalid JSON report.', { cause: error });
    }
}

// The reader of each output format a manifest can declare.
const FORMAT_READERS: Record<OutputFormat['format'], (parsing: Parsing, output: OutputFormat) => Finding[]> = {
    none: () => [],
    json: jsonFindings,
    'trufflehog-json': ({ spec, stdout }) => trufflehogFindings(spec.name, stdout, spec.help),
    'typos-json': ({ spec, stdout, root, cwd }) => typosFindings(spec.name, stdout, spec.help, root, cwd),
    'markdownlint-json': ({ spec, stdout, root, cwd }) => markdownlintFindings(spec.name, stdout, spec.help, root, cwd),
    'eslint-json': ({ spec, stdout, root }) => parseEslintJson(spec.name, stdout, spec.help, root),
    lines: ({ spec, text }) =>
        text
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line !== '')
            .map((line) => ({ check: spec.name, file: '', message: line, help: spec.help, fixable: false })),
    regex: ({ spec, text }, output) => parseRegex(spec.name, output, text, spec.help),
    grouped: ({ spec, text }, output) => parseGrouped(spec.name, output, text, spec.help),
};

// Findings from a tool's output, per the check's output format.
function parseRaw(spec: CheckSpec, stdout: string, stderr: string, root: string, cwd: string): Finding[] {
    const output = spec.output ?? DEFAULT_OUTPUT_FORMAT;
    // A tool that colors its output although nothing reads colors still yields clean paths and messages.
    const text = Bun.stripANSI(`${stdout}\n${stderr}`).replaceAll('\r\n', '\n');
    return FORMAT_READERS[output.format]({ spec, stdout, text, root, cwd }, output);
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
 * @param spec the check.
 * @param stdout the tool's standard output.
 * @param stderr the tool's standard error.
 * @param root the repository root, to make absolute paths relative.
 * @param cwd the tool working directory, for native relative source paths.
 * @returns the findings.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Its callers sit at the complexity or length limit; inlining the expression pushes them over.
export function parseOutput(spec: CheckSpec, stdout: string, stderr: string, root: string, cwd = root): Finding[] {
    return parseRaw(spec, stdout, stderr, root, cwd).map((finding) => ({
        ...finding,
        fixable: spec.fix_command !== undefined && finding.fixable,
        file: relativeTo(toolPath(root), toPosix(finding.file)),
    }));
}
