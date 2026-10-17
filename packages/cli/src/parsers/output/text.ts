// Reads tool messages with declared text patterns.
import type { Finding } from '#cli/types/checks/run/check.ts';
import { type ReportInput, type RegexParser } from '#cli/types/parsers/output.ts';
import { LEADING_DOT_SLASH, TRAILING_PAREN_RULE, TRAILING_BRACKET_RULE } from '#cli/config/parsers/output.ts';

function setMatchedFields(finding: Finding, groups: Record<string, string | undefined>): Finding {
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

function buildFinding(
    check: string,
    parser: RegexParser,
    line: string,
    groups: Record<string, string | undefined>,
): Finding {
    const { output, fixable, help } = parser;
    const finding = setMatchedFields(
        {
            check,
            file: (groups['file'] ?? '').replace(LEADING_DOT_SLASH, ''),
            message: (groups['message'] ?? output.message ?? line).trim(),
            help,
            // Formatters list only files that need changes, so a fixed message means the finding supports fixing.
            fixable: fixable?.test(line) ?? output.message !== undefined,
        },
        groups,
    );
    splitTrailingRule(finding);
    return finding;
}

/**
 * Read a finding from each matching output line.
 * @param input the tool output to read.
 * @returns the findings from matched lines.
 */
export function parseRegexFindings(input: ReportInput): Finding[] {
    const { check, output, text, help } = input;
    const pattern = new RegExp(output.pattern as string, 'u');
    const fixable = output.fixable === undefined ? undefined : new RegExp(output.fixable, 'u');
    const parser: RegexParser = { output, fixable, help };
    const findings = new Map<string, Finding>();
    for (const line of text.split(/\r?\n/u)) {
        const groups = pattern.exec(line)?.groups;
        if (groups) {
            const finding = buildFinding(check, parser, line, groups);
            findings.set(JSON.stringify(finding), finding);
        }
    }
    return findings.values().toArray();
}

/**
 * Read findings grouped under output file headings.
 * @param input the tool output to read.
 * @returns the findings under each matched file heading.
 */
export function parseGroupedFindings(input: ReportInput): Finding[] {
    const { check, output, text, help } = input;
    const filePattern = new RegExp(output.file_pattern as string, 'u');
    const pattern = new RegExp(output.pattern as string, 'u');
    const findings: Finding[] = [];
    let file = '';
    for (const line of text.split(/\r?\n/u)) {
        const header = filePattern.exec(line)?.groups?.['file'];
        if (header !== undefined) {
            file = header.replace(LEADING_DOT_SLASH, '');
            continue;
        }
        const groups = pattern.exec(line)?.groups;
        if (groups) {
            const message = (groups['message'] ?? line).trim();
            findings.push(setMatchedFields({ check, file, message: message, help, fixable: false }, groups));
        }
    }
    return findings;
}
