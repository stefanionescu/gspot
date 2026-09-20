import { parseJson } from '#cli/output/json.ts';
import type { Finding } from '#types/finding.ts';
// Findings from a tool's output: one parser per output format a manifest can declare.
import { toPosix } from '#cli/platform/paths.ts';
import { UNPARSED_LIMIT } from '#config/markers.ts';
import type { CheckSpec, OutputFormat } from '#types/manifest.ts';
import type { EslintFile, EslintEntry, RegexParser } from '#types/run.ts';

const DEFAULT_PATTERN = String.raw`^(?<file>[^:\s][^:]*):(?<line>\d+):(?:(?<column>\d+):)?\s*(?<message>.*)$`;
const DEFAULT_FILE_PATTERN = String.raw`^(?<file>[^\s].*):$`;
const DEFAULT_GROUPED_PATTERN = String.raw`^\s+(?<line>\d+): (?<message>.*)$`;
const TRAILING_BRACKET_RULE = /\[(?<rule>[\w:/@.-]+)\]$/u;
const TRAILING_PAREN_RULE = /\((?<rule>[a-z0-9_:/@.-]+)\)$/u;

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

function eslintFinding(check: string, file: string, entry: EslintEntry, help: string): Finding {
    const finding: Finding = { check, file, message: entry.message, help, fixable: entry.fix !== undefined };
    if (entry.line !== undefined) finding.line = entry.line;
    if (entry.column !== undefined) finding.column = entry.column;
    if (entry.ruleId !== null) finding.rule = entry.ruleId;
    return finding;
}

function parseEslintJson(check: string, text: string, help: string, root: string): Finding[] {
    const start = text.indexOf('[');
    if (start === -1) return [];
    let files: EslintFile[];
    try {
        files = JSON.parse(text.slice(start)) as EslintFile[];
    } catch {
        return [{ check, file: '', message: text.trim().slice(0, UNPARSED_LIMIT), help, fixable: false }];
    }
    return files.flatMap((file) => {
        const isUnderRoot = file.filePath.startsWith(root);
        const relative = (isUnderRoot ? file.filePath.slice(root.length + 1) : file.filePath).replaceAll('\\', '/');
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
 * @returns the findings
 */
function parseRaw(spec: CheckSpec, stdout: string, stderr: string, root: string): Finding[] {
    const output = spec.output ?? DEFAULT_OUTPUT;
    // A tool that colors its output although nothing reads colors still yields clean paths and messages.
    const text = Bun.stripANSI(`${stdout}\n${stderr}`).replaceAll('\r\n', '\n');
    switch (output.format) {
        case 'none': {
            return [];
        }
        case 'json': {
            return parseJson(spec.name, output, stdout, spec.help);
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
    return file.startsWith(prefix) ? file.slice(prefix.length) : file;
}

/**
 * The findings a tool's output holds, with every path relative to the root.
 * @param spec the check
 * @param stdout the tool's standard output
 * @param stderr the tool's standard error
 * @param root the repository root, to make absolute paths relative
 * @returns the findings
 */
export function parseOutput(spec: CheckSpec, stdout: string, stderr: string, root: string): Finding[] {
    return parseRaw(spec, stdout, stderr, root).map((finding) => ({
        ...finding,
        file: relativeTo(toPosix(root), toPosix(finding.file)),
    }));
}
