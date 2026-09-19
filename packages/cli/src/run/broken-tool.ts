// Telling a tool that found something from a tool that fell over: a crash must never pass for a finding, or enter a baseline.
import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { Finding } from '#types/finding.ts';
import type { SpawnResult } from '#types/platform.ts';
import type { CheckSpec, OutputFormat } from '#types/manifest.ts';

// These formats have no file in their findings by design, so a finding with no file says nothing about the tool.
const FILELESS_FORMATS = new Set(['lines', 'none']);

function hasFileField(output: OutputFormat): boolean {
    return output.pattern?.includes('(?<file>') ?? output.fields?.file !== undefined;
}

// Whether the findings of this output name files of the repository: a link target, a coverage floor and a plain line do not.
function isFileNamed(output: OutputFormat | undefined): boolean {
    if (output === undefined || output.format === 'eslint-json') return true;
    if (FILELESS_FORMATS.has(output.format) || (output.file_is ?? 'path') !== 'path') return false;
    return hasFileField(output);
}

function isOnDisk(file: string, roots: string[]): boolean {
    if (file === '') return false;
    return roots.some((root) => existsSync(isAbsolute(file) ? file : join(root, file)));
}

/**
 * Whether a run that exited nonzero produced nothing that points at a real file.
 * @param spec the check
 * @param parsed the findings read from the output
 * @param roots the folders a finding path may be relative to: the working folder of the tool, then the repository root
 * @returns true when the tool broke
 */
export function isToolBroken(spec: CheckSpec, parsed: Finding[], roots: string[]): boolean {
    if (spec.count_regex !== undefined || !isFileNamed(spec.output)) return false;
    return parsed.every((finding) => !isOnDisk(finding.file, roots));
}

/**
 * Whether one command of a check crashed: it exited nonzero, it runs over many files, and nothing it printed names a real file.
 * @param spec the check
 * @param result what the command returned
 * @param parsed the findings read from its output
 * @param roots the folders a finding path may be relative to
 * @returns true for a crash
 */
export function isCrash(spec: CheckSpec, result: SpawnResult, parsed: Finding[], roots: string[]): boolean {
    if (result.code === 0 || (spec.command?.includes('{file}') ?? false)) return false;
    return isToolBroken(spec, parsed, roots);
}
