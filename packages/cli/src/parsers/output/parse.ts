// Findings from a tool's output: one parser per output format a manifest can declare.
import { isAbsolute } from 'node:path';
import { realpathSync } from 'node:fs';
import { GspotError } from '#cli/platform/errors.ts';
import { stripVTControlCharacters } from 'node:util';
import { parseJson } from '#cli/parsers/output/json.ts';
import { knipFindings } from '#cli/parsers/output/knip.ts';
import { toPosix, toolPath } from '#cli/platform/paths.ts';
import { semgrepFindings } from '#cli/parsers/output/semgrep.ts';

import {
    typosFindings,
    eslintFindings,
    trufflehogFindings,
    markdownlintFindings,
} from '#cli/parsers/output/reports.ts';
import type {
    Finding,
    Parsing,
    OutputSpec,
    OutputPaths,
    RegexParser,
    ParsingCheck,
} from '#cli/types/parsers/output.ts';
import {
    DEFAULT_PATTERN,
    LEADING_DOT_SLASH,
    TRAILING_PAREN_RULE,
    DEFAULT_FILE_PATTERN,
    DEFAULT_OUTPUT_FORMAT,
    TRAILING_BRACKET_RULE,
    DEFAULT_GROUPED_PATTERN,
} from '#cli/config/parsers/output.ts';

function compiled(source: string | undefined, standard: string): RegExp {
    return new RegExp(source ?? standard, 'u');
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

function isFixable(output: OutputSpec, fixable: RegExp | undefined, line: string): boolean {
    if (fixable) return fixable.test(line);
    // A fixed message describes files the tool marks for formatting.
    return output.message !== undefined;
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
            file: (groups['file'] ?? '').replace(LEADING_DOT_SLASH, ''),
            message: (groups['message'] ?? output.message ?? line).trim(),
            help,
            fixable: isFixable(output, fixable, line),
        },
        groups,
    );
    splitTrailingRule(finding);
    return finding;
}

function parseRegex(check: string, output: OutputSpec, text: string, help: string): Finding[] {
    const pattern = compiled(output.pattern, DEFAULT_PATTERN);
    const fixable = output.fixable === undefined ? undefined : new RegExp(output.fixable, 'u');
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

function parseGrouped(check: string, output: OutputSpec, text: string, help: string): Finding[] {
    const filePattern = compiled(output.file_pattern, DEFAULT_FILE_PATTERN);
    const pattern = compiled(output.pattern, DEFAULT_GROUPED_PATTERN);
    const findings: Finding[] = [];
    let file = '';
    for (const line of text.split('\n')) {
        const header = filePattern.exec(line)?.groups?.['file'];
        if (header !== undefined) {
            file = header.replace(LEADING_DOT_SLASH, '');
            continue;
        }
        const groups = pattern.exec(line)?.groups;
        if (groups) {
            const diagnostic = (groups['message'] ?? line).trim();
            findings.push(positioned({ check, file, message: diagnostic, help, fixable: false }, groups));
        }
    }
    return findings;
}

// Findings from a JSON report, or an error for an unreadable report.
function jsonFindings(parsing: Parsing, output: OutputSpec): Finding[] {
    try {
        return parseJson(parsing.spec.name, output, parsing.stdout, parsing.spec.help);
    } catch (error) {
        throw new GspotError('output', 'The tool returned an invalid JSON report.', { cause: error });
    }
}

// The reader of each output format a manifest can declare.
const FORMAT_READERS: Record<OutputSpec['format'], (parsing: Parsing, output: OutputSpec) => Finding[]> = {
    none: () => [],
    json: jsonFindings,
    'trufflehog-json': ({ spec, stdout }) => trufflehogFindings(spec.name, stdout, spec.help),
    typos: ({ spec, stdout, root, cwd }) => typosFindings(spec.name, stdout, spec.help, root, cwd),
    markdownlint: ({ spec, stdout, root, cwd }) => markdownlintFindings(spec.name, stdout, spec.help, root, cwd),
    knip: ({ spec, stdout }) => knipFindings(spec.name, stdout, spec.help),
    eslint: ({ spec, stdout }) => eslintFindings(spec.name, stdout, spec.help),
    semgrep: ({ spec, stdout }) => semgrepFindings(spec.name, stdout, spec.help),
    lines: ({ spec, text }) =>
        text
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line !== '')
            .map((line) => ({ check: spec.name, file: '', message: line, help: spec.help, fixable: false })),
    regex: ({ spec, text }, output) => parseRegex(spec.name, output, text, spec.help),
    grouped: ({ spec, text }, output) => parseGrouped(spec.name, output, text, spec.help),
};

function relativeTo(root: string, file: string): string {
    const prefix = `${root}/`;
    if (file.startsWith(prefix)) return file.slice(prefix.length);
    if (!isAbsolute(file)) return file;
    try {
        // The native call gives Windows paths one drive letter case and their long folder names.
        const canonicalRoot = `${toPosix(realpathSync.native(root))}/`;
        const canonicalFile = toPosix(realpathSync.native(file));
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
 * @param paths the repository root and tool working directory, for resolving reported source paths.
 * @returns the findings.
 */
export function parseOutput(spec: ParsingCheck, stdout: string, stderr: string, paths: OutputPaths): Finding[] {
    const { root, cwd } = paths;
    const nativeRoot = isAbsolute(root) ? toPosix(root) : toolPath(root);
    const output = spec.output ?? DEFAULT_OUTPUT_FORMAT;
    // A tool that colors its output although nothing reads colors still yields clean paths and messages.
    const text = stripVTControlCharacters(`${stdout}\n${stderr}`).replaceAll('\r\n', '\n');
    return FORMAT_READERS[output.format]({ spec, stdout, text, root, cwd }, output).map((finding) => ({
        ...finding,
        fixable: spec.fix !== undefined && finding.fixable,
        file: relativeTo(nativeRoot, toPosix(finding.file)),
    }));
}
