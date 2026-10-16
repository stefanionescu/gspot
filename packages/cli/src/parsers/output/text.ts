// Reads tool messages with declared text patterns.
import type { Finding } from '#cli/types/execution/check.ts';
import type { OutputSpec, RegexParser } from '#cli/types/parsers/output.ts';
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
 * Read findings from individually matched output lines.
 * @param check the check name.
 * @param output the declared output format.
 * @param text the source text.
 * @param help the advice attached to each finding.
 * @returns the findings from matched lines.
 */
export function parseRegexFindings(
    check: string,
    output: Extract<OutputSpec, { format: 'regex' }>,
    text: string,
    help: string,
): Finding[] {
    const pattern = new RegExp(output.pattern, 'u');
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
 * @param check the check name.
 * @param output the declared output format.
 * @param text the source text.
 * @param help the advice attached to each finding.
 * @returns the findings under each matched file heading.
 */
export function parseGroupedFindings(
    check: string,
    output: Extract<OutputSpec, { format: 'grouped' }>,
    text: string,
    help: string,
): Finding[] {
    const filePattern = new RegExp(output.file_pattern, 'u');
    const pattern = new RegExp(output.pattern, 'u');
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
