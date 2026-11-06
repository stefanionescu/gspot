import { realpathSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LEADING_DOT_SLASH, MISSING_PATH_CODES } from '#cli/config/engine.ts';
import { LINE_BREAK } from '#cli/config/parsers.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { convertToPosixPath, isInside } from '#cli/system/paths.ts';
import type { CheckOutput, Finding, ToolOutput } from '#cli/types/engine/tool-runs.ts';

const FILE_LINK = /^file:\/\/\/[^\s#?]+/u;

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

/**
Find the real path of a file or folder.

@param path the path to read.
@returns undefined when the path does not exist.
*/
export function findCanonicalPath(path: string): string | undefined {
    try {
        return convertToPosixPath(realpathSync.native(path));
    } catch (error) {
        if ([...MISSING_PATH_CODES].some((code) => hasErrorCode(error, code))) return undefined;
        throw error;
    }
}

/**
Read a finding from each matching output line.

@param output the tool output to read.
*/
export function parseRegexFindings(output: ToolOutput): Finding[] {
    const { check, output: format, text, help } = output;
    const pattern = new RegExp(format.pattern as string, 'u');
    const fixable = format.fixable === undefined ? undefined : new RegExp(format.fixable, 'u');
    const findings = text.split(LINE_BREAK).flatMap((line) => {
        const groups = pattern.exec(line)?.groups;
        if (!groups) return [];
        const finding = {
            check,
            file: (groups['file'] ?? '').replace(LEADING_DOT_SLASH, ''),
            message: (groups['message'] ?? format.message ?? line).trim(),
            help,
            fixable: fixable?.test(line) === true,
        };
        return [setMatchedFields(finding, groups)];
    });
    return new Map(findings.map((finding) => [JSON.stringify(finding), finding])).values().toArray();
}

/**
Tell whether grouped output reports only file links that leave the root, which report nothing.

@param output how to read the output.
@param text the tool output to read.
@param root the repository, or the copy of it that the tool ran in.
*/
export function hasOnlyOutsideLinks(output: CheckOutput, text: string, root: string): boolean {
    const pattern = new RegExp(output.pattern as string, 'u');
    const messages = text.split(LINE_BREAK).flatMap((line) => pattern.exec(line)?.groups?.['message'] ?? []);
    return messages.length > 0 && messages.every((message) => !isLinkInRoot(message, root));
}

/**
Read findings grouped under output file headings. A file link that leaves the repository root works on a Git host and
not in a clone, so it reports nothing.

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
    return findings.filter(({ message }) => isLinkInRoot(message, output.root));
}
