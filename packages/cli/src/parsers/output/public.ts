import { realpathSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { GspotError } from '#cli/platform/public.ts';
import { stripVTControlCharacters } from 'node:util';
import { toPosix, toolPath } from '#cli/platform/contracts.ts';
import { typosFindings, trufflehogFindings, markdownlintFindings } from '#cli/parsers/output/contracts.ts';
import { parseJson, knipFindings, sarifFindings, semgrepFindings } from '#cli/parsers/output/structured/public.ts';

import type {
    Finding,
    Parsing,
    OutputSpec,
    OutputPaths,
    RegexParser,
    ParsingCheck,
    OutputDescriptor,
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

// Findings from a tool's output: one parser per output format a manifest can declare.

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
        return parseJson(parsing.check.name, output, parsing.stdout, parsing.check.help);
    } catch (error) {
        throw new GspotError('output', 'The tool returned an invalid JSON report.', { cause: error });
    }
}

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

/** Native parsing and execution contracts, declared once for each supported output format. */
export const outputFormats: Record<OutputSpec['format'], OutputDescriptor> = {
    none: {
        read: () => [],
        namesFiles: () => false,
        verifyFiles: false,
        withholdOutput: false,
    },
    json: {
        read: jsonFindings,
        namesFiles: (output) => (output.file_type ?? 'path') === 'path' && output.fields?.file !== undefined,
        verifyFiles: false,
        withholdOutput: false,
    },
    sarif: {
        read: ({ check, stdout, root }) => {
            try {
                return sarifFindings(JSON.parse(stdout), check.name, check.help, root);
            } catch (error) {
                throw new GspotError('output', 'The tool returned an invalid SARIF report.', { cause: error });
            }
        },
        namesFiles: () => true,
        verifyFiles: false,
        withholdOutput: false,
    },
    'trufflehog-json': {
        read: ({ check, stdout }) => trufflehogFindings(check.name, stdout, check.help),
        namesFiles: () => false,
        verifyFiles: false,
        withholdOutput: true,
    },
    typos: {
        read: ({ check, stdout, root, cwd }) => typosFindings(check.name, stdout, check.help, root, cwd),
        namesFiles: () => true,
        verifyFiles: true,
        withholdOutput: false,
    },
    markdownlint: {
        read: ({ check, stdout, root, cwd }) => markdownlintFindings(check.name, stdout, check.help, root, cwd),
        namesFiles: () => true,
        verifyFiles: true,
        withholdOutput: false,
    },
    knip: {
        read: ({ check, stdout }) => knipFindings(check.name, stdout, check.help),
        namesFiles: () => true,
        verifyFiles: false,
        withholdOutput: false,
    },
    semgrep: {
        read: ({ check, stdout }) => semgrepFindings(check.name, stdout, check.help),
        namesFiles: () => true,
        verifyFiles: false,
        withholdOutput: false,
    },
    lines: {
        read: ({ check, text }) =>
            text
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line !== '')
                .map((line) => ({ check: check.name, file: '', message: line, help: check.help, fixable: false })),
        namesFiles: () => false,
        verifyFiles: false,
        withholdOutput: false,
    },
    regex: {
        read: ({ check, text }, output) => parseRegex(check.name, output, text, check.help),
        namesFiles: (output) =>
            (output.file_type ?? 'path') === 'path' &&
            (output.pattern === undefined ? output.fields?.file !== undefined : output.pattern.includes('(?<file>')),
        verifyFiles: false,
        withholdOutput: false,
    },
    grouped: {
        read: ({ check, text }, output) => parseGrouped(check.name, output, text, check.help),
        namesFiles: (output) =>
            (output.file_type ?? 'path') === 'path' &&
            (output.pattern === undefined ? output.fields?.file !== undefined : output.pattern.includes('(?<file>')),
        verifyFiles: false,
        withholdOutput: false,
    },
};

/**
 * The findings a tool's output holds, with every path relative to the root.
 * @param check the check.
 * @param stdout the tool's standard output.
 * @param stderr the tool's standard error.
 * @param paths the repository root and tool working directory, for resolving reported source paths.
 * @returns the findings.
 */
export function parseOutput(check: ParsingCheck, stdout: string, stderr: string, paths: OutputPaths): Finding[] {
    const { root, cwd } = paths;
    const nativeRoot = isAbsolute(root) ? toPosix(root) : toolPath(root);
    const output = check.output ?? DEFAULT_OUTPUT_FORMAT;
    // A tool that colors its output although nothing reads colors still yields clean paths and messages.
    const text = stripVTControlCharacters(`${stdout}\n${stderr}`).replaceAll('\r\n', '\n');
    return outputFormats[output.format].read({ check, stdout, text, root, cwd }, output).map((finding) => ({
        ...finding,
        fixable: check.fix !== undefined && finding.fixable,
        file: relativeTo(nativeRoot, toPosix(finding.file)),
    }));
}
