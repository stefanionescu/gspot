// Reads tool messages with declared text patterns.
import type { Finding } from '#cli/types/runs/check.ts';
import { type ReportInput } from '#cli/types/runs/output.ts';
import { LEADING_DOT_SLASH } from '#cli/config/runs/output.ts';

function setMatchedFields(finding: Finding, groups: Record<string, string | undefined>): Finding {
    const line = groups['line'];
    const column = groups['column'];
    const rule = groups['rule'];
    if (line !== undefined && line !== '') finding.line = Number(line);
    if (column !== undefined && column !== '') finding.column = Number(column);
    if (rule !== undefined && rule !== '') finding.rule = rule;
    return finding;
}

function readMatchedFinding(
    input: ReportInput,
    fixable: RegExp | undefined,
    line: string,
    groups: Record<string, string | undefined>,
): Finding {
    const { check, output, help } = input;
    return setMatchedFields(
        {
            check,
            file: (groups['file'] ?? '').replace(LEADING_DOT_SLASH, ''),
            message: (groups['message'] ?? output.message ?? line).trim(),
            help,
            fixable: fixable?.test(line) === true,
        },
        groups,
    );
}

/**
 * Read a finding from each matching output line.
 *
 * @param input the tool output to read.
 * @returns the findings from matched lines.
 */
export function parseRegexFindings(input: ReportInput): Finding[] {
    const { output, text } = input;
    const pattern = new RegExp(output.pattern as string, 'u');
    const fixable = output.fixable === undefined ? undefined : new RegExp(output.fixable, 'u');
    const findings = new Map<string, Finding>();
    for (const line of text.split(/\r?\n/u)) {
        const groups = pattern.exec(line)?.groups;
        if (groups) {
            const finding = readMatchedFinding(input, fixable, line, groups);
            findings.set(JSON.stringify(finding), finding);
        }
    }
    return findings.values().toArray();
}

/**
 * Read findings grouped under output file headings.
 *
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

/**
 * Read one finding from each nonempty output line.
 *
 * @param input the tool output to read.
 * @returns the findings from the output lines.
 */
export function parseLineFindings(input: ReportInput): Finding[] {
    const { check, text, help } = input;
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .map((line) => ({ check, file: '', message: line, help, fixable: false }));
}
