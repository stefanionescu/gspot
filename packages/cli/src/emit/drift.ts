import { pythonLockDrift } from '#cli/lifecycle/python-project.ts';
import { packageLockDrift } from '#cli/lifecycle/package-project.ts';
import { isValePackageFile } from '#cli/repository/natures.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
// apply --dry-run: render in memory, read recorded generated files, compare bytes, print the diff.
import { join } from 'node:path';
import { createTwoFilesPatch } from 'diff';
import type { Session } from '#types/run.ts';
import type { Policy } from '#types/config.ts';
import { existsSync, readFileSync } from 'node:fs';
import { isMergeStubHeld } from '#cli/emit/stubs.ts';
import { isLefthookHeld } from '#cli/emit/lefthook.ts';
import type { DriftEntry, GeneratedProposal } from '#types/emit.ts';
import { hasPackageScripts, emitAll } from '#cli/emit/targets.ts';
import { currentBlock, fileText } from '#cli/emit/managed-blocks.ts';

const NEVER_STRAY = new Set([
    'gspot.toml',
    '.gitignore',
    '.gspot/version',
    '.gspot/report.json',
    '.gspot/report.sarif',
    '.gspot/report.codequality.json',
    '.gspot/ownership.json',
    '.gspot/mutation.lock',
]);
const DIFF_CONTEXT = 2;

function isStrayCandidate(path: string, policy: Policy): boolean {
    if (path.startsWith('.gspot/recovery/')) return false;
    if (path.startsWith('.gspot/rules/') && !policy.rules.install) return false;
    if (path.startsWith('.gspot/hooks/') && policy.hooks === undefined) return false;
    return !(path.startsWith('.gspot/cache/') || NEVER_STRAY.has(path));
}

function patch(path: string, before: string, after: string, beforeName: string): string {
    return createTwoFilesPatch(`a/${path}`, `b/${path}`, before, after, beforeName, 'rendered', {
        context: DIFF_CONTEXT,
    });
}

function fileDrift(root: string, rendered: GeneratedProposal): DriftEntry[] {
    const entries: DriftEntry[] = [];
    for (const file of rendered.files) {
        const full = join(root, file.path);
        if (!existsSync(full)) {
            entries.push({ path: file.path, kind: 'missing' });
            continue;
        }
        const disk = readFileSync(full, 'utf8');
        if (disk !== file.content)
            entries.push({ path: file.path, kind: 'changed', diff: patch(file.path, disk, file.content, 'on disk') });
    }
    return entries;
}

function blockDrift(root: string, rendered: GeneratedProposal): DriftEntry[] {
    const entries: DriftEntry[] = [];
    for (const block of rendered.blocks) {
        const current = currentBlock(fileText(root, block.path), block.style);
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
    return { path, kind: existsSync(join(root, path)) ? 'changed' : 'missing' };
}

function otherDrift(root: string, rendered: GeneratedProposal): DriftEntry[] {
    const entries: DriftEntry[] = [];
    for (const merge of rendered.merges)
        if (!isMergeStubHeld(root, merge.stub, merge.path, merge.target)) entries.push(presenceDrift(root, merge.path));
    for (const output of rendered.packages)
        if (!hasPackageScripts(root, output)) entries.push({ path: output.path, kind: 'changed' });
    const { lefthook } = rendered;
    if (lefthook && !isLefthookHeld(root, lefthook.path, lefthook.block))
        entries.push(presenceDrift(root, lefthook.path));
    return entries;
}

function knownPaths(rendered: GeneratedProposal): Set<string> {
    return new Set([
        ...rendered.files.map((file) => file.path),
        ...rendered.blocks.map((block) => block.path),
        ...rendered.merges.map((merge) => merge.path),
        ...rendered.packages.map((output) => output.path),
        ...(rendered.lefthook ? [rendered.lefthook.path] : []),
    ]);
}

/**
 * Every generated file that differs from its render, is missing, or is a stray gspot file. Blocks and merges count too.
 * @param session the session
 * @returns the drift entries in path order
 */
export function computeDrift(session: Session, rendered: GeneratedProposal = emitAll(session)): DriftEntry[] {
    const known = knownPaths(rendered);
    const lock = packageLockDrift(session.root, rendered.files);
    if (lock !== undefined) known.add(lock.path);
    const python = pythonLockDrift(session.root, rendered.files);
    if (python !== undefined) known.add(python.path);
    const strays = readOwnership(session.root)
        .files.filter(
            (entry) =>
                entry.kind !== 'runtime' &&
                !isValePackageFile(entry.path) &&
                (entry.kind !== 'dependency' ||
                    (entry.path.startsWith('.gspot/.venv/')
                        ? python === undefined
                        : session.packageManager === undefined)) &&
                entry.installed !== undefined &&
                !known.has(entry.path) &&
                isStrayCandidate(entry.path, session.policyFiles.policy),
        )
        .map((entry): DriftEntry => ({ path: entry.path, kind: 'stray' }));
    return [
        ...(python?.kind === undefined ? [] : [{ path: python.path, kind: python.kind }]),
        ...(lock?.kind === undefined ? [] : [{ path: lock.path, kind: lock.kind }]),
        ...fileDrift(session.root, rendered),
        ...blockDrift(session.root, rendered),
        ...otherDrift(session.root, rendered),
        ...strays,
    ].toSorted((a, b) => a.path.localeCompare(b.path));
}
