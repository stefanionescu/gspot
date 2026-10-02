// apply --dry-run: render in memory, read recorded generated files, compare bytes, print the diff.
import { createTwoFilesPatch } from 'diff';
import { toPosix } from '#cli/platform/paths.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { pythonLockDrift } from '#cli/tools/python.ts';
import type { Policy } from '#cli/types/policy/policy.ts';
import { currentBlock } from '#cli/generation/markers.ts';
import { ruleDiff } from '#cli/lifecycle/preview/compare.ts';
import { packageLockDrift } from '#cli/tools/packages/project.ts';
import { readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import type { DriftEntry } from '#cli/types/lifecycle/lifecycle.ts';
import { hasConfiguration } from '#cli/lifecycle/merge/document.ts';
import type { Generated } from '#cli/types/generation/generation.ts';
import { NEVER_STRAY, CONFLICT_MARKERS, DRIFT_DIFF_CONTEXT } from '#cli/config/lifecycle/lifecycle.ts';

function isStrayCandidate(path: string, policy: Policy): boolean {
    if (path.startsWith('.gspot/guides/') && !policy.guides.install) return false;
    if (path.startsWith('.gspot/hooks/') && policy.hooks === undefined) return false;
    return !NEVER_STRAY.has(path);
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Two drift entries carry a patch; the caller sits at the complexity limit.
function patch(path: string, before: string, after: string, beforeName: string): string {
    return createTwoFilesPatch(`a/${toPosix(path)}`, `b/${toPosix(path)}`, before, after, beforeName, 'rendered', {
        context: DRIFT_DIFF_CONTEXT,
    });
}

function fileDrift(root: string, rendered: Generated): DriftEntry[] {
    const entries: DriftEntry[] = [];
    const files = openRoot(root);
    for (const file of rendered.files) {
        const current = files.read(file.path);
        if (current === undefined) {
            entries.push({ path: file.path, kind: 'missing', ...ruleDiff(file, undefined) });
            continue;
        }
        const disk = current.bytes.toString('utf8');
        // A merge left its markers in the file: no tool can read it, and regeneration is the one repair.
        if (CONFLICT_MARKERS.test(disk)) entries.push({ path: file.path, kind: 'conflict' });
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

function blockDrift(root: string, rendered: Generated): DriftEntry[] {
    const entries: DriftEntry[] = [];
    const files = openRoot(root);
    for (const block of rendered.blocks) {
        const text = files.read(block.path)?.bytes.toString('utf8') ?? '';
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

// The merged and configuration outputs whose fields are gone: missing when the file is gone, changed otherwise.
function otherDrift(root: string, rendered: Generated): DriftEntry[] {
    using files = openRoot(root);
    return [...rendered.merges, ...rendered.configurations]
        .filter((output) => !hasConfiguration(root, output))
        .map((output) => ({ path: output.path, kind: files.read(output.path) === undefined ? 'missing' : 'changed' }));
}

/**
 * Every generated file that differs from its render, is missing, or is a stray gspot file. Blocks and merges count too.
 * @param root the repository root
 * @param policy the repository policy
 * @param rendered the generated files as rendered now
 * @returns the drift entries in path order
 */
export function computeDrift(root: string, policy: Policy, rendered: Generated): DriftEntry[] {
    const known = new Set([
        ...rendered.files.map((file) => file.path),
        ...rendered.blocks.map((block) => block.path),
        ...rendered.merges.map((merge) => merge.path),
        ...rendered.configurations.map((output) => output.path),
    ]);
    const lock = packageLockDrift(root, rendered.files);
    if (lock !== undefined) known.add(lock.path);
    const python = pythonLockDrift(root, rendered.files);
    if (python !== undefined) known.add(python.path);
    const strays = readOwnership(root)
        .files.filter(
            (entry) =>
                !['hook', 'export'].includes(entry.kind) &&
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
