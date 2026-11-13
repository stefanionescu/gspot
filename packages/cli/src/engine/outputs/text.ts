import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FILE_LINK, LEADING_DOT_SLASH } from '#cli/config/engine.ts';
import { LINE_BREAK } from '#cli/config/system.ts';
import { findCanonicalPath, isInside } from '#cli/system/paths.ts';
import type { Finding } from '#cli/types/engine/run.ts';
import type { ToolOutput } from '#cli/types/engine/tool-runs.ts';
import type { CheckOutput } from '#cli/types/manifests.ts';

function setMatchedFields(finding: Finding, groups: Record<string, string | undefined>): Finding {
    const line = groups['line'];
    const column = groups['column'];
    const rule = groups['rule'];
    if (line !== undefined && line !== '') finding.line = Number(line);
    if (column !== undefined && column !== '') finding.column = Number(column);
    if (rule !== undefined && rule !== '') finding.rule = rule;
    return finding;
}

function isLinkInRoot(message: string, root: string): boolean {
    const link = FILE_LINK.exec(message)?.[0];
    if (link === undefined) return true;
    const target = fileURLToPath(link);
    return isInside(relative(root, target)) || isInside(relative(findCanonicalPath(root) ?? root, target));
}

export function parseRegexFindings(output: ToolOutput): Finding[] {
    const { check, output: format, text } = output;
    const pattern = new RegExp(format.pattern as string, 'u');
    const fixable = format.fixable === undefined ? undefined : new RegExp(format.fixable, 'u');
    const findings = text.split(LINE_BREAK).flatMap((line) => {
        const groups = pattern.exec(line)?.groups;
        if (!groups) return [];
        const finding = {
            check,
            file: (groups['file'] ?? '').replace(LEADING_DOT_SLASH, ''),
            message: (groups['message'] ?? format.message ?? line).trim(),
            fixable: fixable?.test(line) === true,
        };
        return [setMatchedFields(finding, groups)];
    });
    return new Map(findings.map((finding) => [JSON.stringify(finding), finding])).values().toArray();
}

export function hasOnlyOutsideLinks(output: CheckOutput, text: string, root: string): boolean {
    const pattern = new RegExp(output.pattern as string, 'u');
    const messages = text.split(LINE_BREAK).flatMap((line) => pattern.exec(line)?.groups?.['message'] ?? []);
    return messages.length > 0 && messages.every((message) => !isLinkInRoot(message, root));
}

/**
Read findings grouped under output file headings. A file link that leaves the repository root works on a Git host and
not in a clone, so it reports nothing.
*/
export function parseGroupedFindings(output: ToolOutput): Finding[] {
    const { check, output: format, text } = output;
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
        findings.push(setMatchedFields({ check, file, message, fixable: false }, groups));
    }
    return findings.filter(({ message }) => isLinkInRoot(message, output.root));
}
