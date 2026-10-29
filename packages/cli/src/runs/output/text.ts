import { LINE_BREAK } from '#cli/config/text.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { LEADING_DOT_SLASH } from '#cli/config/runs/output/text.ts';
import { type ToolOutput } from '#cli/types/runs/output/formats.ts';

function setMatchedFields(finding: Finding, groups: Record<string, string | undefined>): Finding {
    const line = groups['line'];
    const column = groups['column'];
    const rule = groups['rule'];
    if (line !== undefined && line !== '') finding.line = Number(line);
    if (column !== undefined && column !== '') finding.column = Number(column);
    if (rule !== undefined && rule !== '') finding.rule = rule;
    return finding;
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Inlined, parseRegexFindings passes the complexity limit.
function buildMatchedFinding(
    output: ToolOutput,
    fixable: RegExp | undefined,
    line: string,
    groups: Record<string, string | undefined>,
): Finding {
    const { check, output: format, help } = output;
    return setMatchedFields(
        {
            check,
            file: (groups['file'] ?? '').replace(LEADING_DOT_SLASH, ''),
            message: (groups['message'] ?? format.message ?? line).trim(),
            help,
            fixable: fixable?.test(line) === true,
        },
        groups,
    );
}

/**
Read a finding from each matching output line.

@param output the tool output to read.
*/
export function parseRegexFindings(output: ToolOutput): Finding[] {
    const { output: format, text } = output;
    const pattern = new RegExp(format.pattern as string, 'u');
    const fixable = format.fixable === undefined ? undefined : new RegExp(format.fixable, 'u');
    const findings = new Map<string, Finding>();
    for (const line of text.split(LINE_BREAK)) {
        const groups = pattern.exec(line)?.groups;
        if (!groups) continue;
        const finding = buildMatchedFinding(output, fixable, line, groups);
        findings.set(JSON.stringify(finding), finding);
    }
    return findings.values().toArray();
}

/**
Read findings grouped under output file headings.

@param output the tool output to read.
*/
export function parseGroupedFindings(output: ToolOutput): Finding[] {
    const { check, output: format, text, help } = output;
    const filePattern = new RegExp(format.file_pattern as string, 'u');
    const pattern = new RegExp(format.pattern as string, 'u');
    const findings: Finding[] = [];
    let file = '';
    for (const line of text.split(LINE_BREAK)) {
        const header = filePattern.exec(line)?.groups?.['file'];
        if (header !== undefined) {
            file = header.replace(LEADING_DOT_SLASH, '');
            continue;
        }
        const groups = pattern.exec(line)?.groups;
        if (!groups) continue;
        const message = (groups['message'] ?? line).trim();
        findings.push(setMatchedFields({ check, file, message, help, fixable: false }, groups));
    }
    return findings;
}

/**
Read one finding from each nonempty output line.

@param output the tool output to read.
*/
export function parseLineFindings(output: ToolOutput): Finding[] {
    const { check, text, help } = output;
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .map((line) => ({ check, file: '', message: line, help, fixable: false }));
}
