import { ruleDiff } from '#cli/lifecycle/rule-diff.ts';
import { CACHE_DIRECTORY } from '#cli/platform/paths.ts';
import type { Policy } from '#cli/policy/normalize.ts';
import { createTwoFilesPatch } from 'diff';
// apply --dry-run: render in memory, read recorded generated files, compare bytes, print the diff.
import type { GeneratedProposal } from '#cli/lifecycle/apply.ts';
import { hasConfiguration } from '#cli/lifecycle/configuration-document.ts';
import { currentBlock } from '#cli/lifecycle/managed-blocks.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { isValePackageFile } from '#cli/repository/file-classification.ts';
import { packageLockDrift } from '#cli/tools/packages/project.ts';
import { pythonLockDrift } from '#cli/tools/python-project.ts';

const NEVER_STRAY = new Set([
    'gspot.toml',
    '.gitignore',
    '.gspot/version',
    '.gspot/reports/report.json',
    '.gspot/reports/report.sarif',
    '.gspot/reports/report.codequality.json',
    '.gspot/state/ownership.json',
    '.gspot/state/writer.lock',
]);
const DIFF_CONTEXT = 2;

function isStrayCandidate(path: string, policy: Policy): boolean {
    if (path.startsWith('.gspot/state/')) return false;
    if (path.startsWith('.gspot/rules/') && !policy.rules.install) return false;
    if (path.startsWith('.gspot/hooks/') && policy.hooks === undefined) return false;
    return !(path.startsWith(`${CACHE_DIRECTORY}/`) || NEVER_STRAY.has(path));
}

function patch(path: string, before: string, after: string, beforeName: string): string {
    return createTwoFilesPatch(`a/${path}`, `b/${path}`, before, after, beforeName, 'rendered', {
        context: DIFF_CONTEXT,
    });
}

const CONFLICT_MARKERS = /^(?:<{7}|={7}|>{7})(?: |$)/mu;

/**
 * Whether a text holds the markers a merge leaves behind, so no tool can read it.
 * @param text the file's text
 * @returns true when a marker line is present
 */
export function hasConflictMarkers(text: string): boolean {
    return CONFLICT_MARKERS.test(text);
}

function fileDrift(root: string, rendered: GeneratedProposal): DriftEntry[] {
    const entries: DriftEntry[] = [];
    const confined = openConfinedRoot(root);
    for (const file of rendered.files) {
        const current = confined.read(file.path);
        if (current === undefined) {
            entries.push({ path: file.path, kind: 'missing', ...ruleDiff(file, undefined) });
            continue;
        }
        const disk = current.bytes.toString('utf8');
        // A merge left its markers in the file: no tool can read it, and regeneration is the one repair (K-274).
        if (hasConflictMarkers(disk)) entries.push({ path: file.path, kind: 'conflict' });
        else if (disk !== file.content)
            entries.push({
                path: file.path,
                kind: 'changed',
                diff: patch(file.path, disk, file.content, 'on disk'),
                ...ruleDiff(file, disk),
            });
    }
    return entries;
}

function blockDrift(root: string, rendered: GeneratedProposal): DriftEntry[] {
    const entries: DriftEntry[] = [];
    const confined = openConfinedRoot(root);
    for (const block of rendered.blocks) {
        const text = confined.read(block.path)?.bytes.toString('utf8') ?? '';
        const current = currentBlock(text, block.style);
        const wanted = block.block.trim();
        if (current === undefined) entries.push({ path: block.path, kind: 'missing' });
        else if (current !== wanted)
            entries.push({
                path: block.path,
                kind: 'changed',
                diff: patch(block.path, current, wanted, 'managed block on disk'),
            });
    }
    return entries;
}

function presenceDrift(root: string, path: string): DriftEntry {
    return { path, kind: openConfinedRoot(root).read(path) === undefined ? 'missing' : 'changed' };
}

function otherDrift(root: string, rendered: GeneratedProposal): DriftEntry[] {
    const entries: DriftEntry[] = [];
    for (const merge of rendered.merges)
        if (!hasConfiguration(root, merge)) entries.push(presenceDrift(root, merge.path));
    for (const output of rendered.configurations)
        if (!hasConfiguration(root, output)) entries.push(presenceDrift(root, output.path));
    return entries;
}

function knownPaths(rendered: GeneratedProposal): Set<string> {
    return new Set([
        ...rendered.files.map((file) => file.path),
        ...rendered.blocks.map((block) => block.path),
        ...rendered.merges.map((merge) => merge.path),
        ...rendered.configurations.map((output) => output.path),
    ]);
}

/**
 * Every generated file that differs from its render, is missing, or is a stray gspot file. Blocks and merges count too.
 * @param root the repository root
 * @param policy the repository policy
 * @param hasPackageManager whether generated tools use a package manager
 * @param rendered
 * @returns the drift entries in path order
 */
export function computeDrift(
    root: string,
    policy: Policy,
    hasPackageManager: boolean,
    rendered: GeneratedProposal,
): DriftEntry[] {
    const known = knownPaths(rendered);
    const lock = packageLockDrift(root, rendered.files);
    if (lock !== undefined) known.add(lock.path);
    const python = pythonLockDrift(root, rendered.files);
    if (python !== undefined) known.add(python.path);
    const strays = readOwnership(root)
        .files.filter(
            (entry) =>
                entry.kind !== 'runtime' &&
                entry.kind !== 'hook' &&
                entry.kind !== 'export' &&
                !isValePackageFile(entry.path) &&
                (entry.kind !== 'dependency' ||
                    (entry.path.startsWith('.gspot/.venv/') ? python === undefined : !hasPackageManager)) &&
                entry.installed !== undefined &&
                !known.has(entry.path) &&
                isStrayCandidate(entry.path, policy),
        )
        .map((entry): DriftEntry => ({ path: entry.path, kind: 'stray' }));
    return [
        ...(python?.kind === undefined ? [] : [{ path: python.path, kind: python.kind }]),
        ...(lock?.kind === undefined ? [] : [{ path: lock.path, kind: lock.kind }]),
        ...fileDrift(root, rendered),
        ...blockDrift(root, rendered),
        ...otherDrift(root, rendered),
        ...strays,
    ].toSorted((a, b) => a.path.localeCompare(b.path));
}

export type DriftEntry = {
    path: string;
    kind: 'changed' | 'missing' | 'stray' | 'conflict';
    diff?: string;
    rules?: { path: string; added: string[]; removed: string[]; changed: string[] }[];
    ruleError?: string;
};
