// apply --check: render in memory, find generated files by header, compare bytes, print the diff.
import { join } from 'node:path';
import { createTwoFilesPatch } from 'diff';
import type { Session } from '#types/run.ts';
import { head } from '#cli/repository/tracked.ts';
import { existsSync, readFileSync } from 'node:fs';
import { hasHeader } from '#cli/emit/templates.ts';
import { isMergeStubHeld } from '#cli/emit/stubs.ts';
import { isLefthookHeld } from '#cli/emit/lefthook.ts';
import type { DriftEntry, RenderedSet } from '#types/emit.ts';
import { hasPackagePins, emitAll } from '#cli/emit/targets.ts';
import { isValePackageFile } from '#cli/repository/natures.ts';
import { currentBlock, fileText } from '#cli/emit/managed-blocks.ts';

const NEVER_STRAY = new Set(['.gspot/version', '.gspot/report.json', '.gspot/report.sarif']);
const HEAD_BYTES = 600;
const DIFF_CONTEXT = 2;

function isStrayCandidate(path: string): boolean {
    return !(path.startsWith('.gspot/cache/') || path.startsWith('.gspot/baselines/') || NEVER_STRAY.has(path));
}

function patch(path: string, before: string, after: string, beforeName: string): string {
    return createTwoFilesPatch(`a/${path}`, `b/${path}`, before, after, beforeName, 'rendered', {
        context: DIFF_CONTEXT,
    });
}

function fileDrift(root: string, rendered: RenderedSet): DriftEntry[] {
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

function blockDrift(root: string, rendered: RenderedSet): DriftEntry[] {
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

function otherDrift(root: string, rendered: RenderedSet): DriftEntry[] {
    const entries: DriftEntry[] = [];
    for (const merge of rendered.merges)
        if (!isMergeStubHeld(root, merge.stub, merge.path, merge.target)) entries.push(presenceDrift(root, merge.path));
    for (const output of rendered.packages)
        if (!hasPackagePins(root, output)) entries.push({ path: output.path, kind: 'changed' });
    const { lefthook } = rendered;
    if (lefthook && !isLefthookHeld(root, lefthook.path, lefthook.block))
        entries.push(presenceDrift(root, lefthook.path));
    return entries;
}

function knownPaths(rendered: RenderedSet): Set<string> {
    return new Set([
        ...rendered.files.map((file) => file.path),
        ...rendered.blocks.map((block) => block.path),
        ...rendered.merges.map((merge) => merge.path),
        ...rendered.packages.map((output) => output.path),
        ...(rendered.lefthook ? [rendered.lefthook.path] : []),
    ]);
}

function isStray(session: Session, path: string, known: Set<string>, tags: string[]): boolean {
    if (known.has(path) || !isStrayCandidate(path) || !tags.includes('text')) return false;
    if (path.startsWith('.gspot/rules/') && !session.policyFiles.policy.rules.install) return false;
    if (isValePackageFile(path)) return false;
    return path.startsWith('.gspot/') || hasHeader(head(session.root, path, HEAD_BYTES));
}

/**
 * Every generated file that differs from its render, is missing, or is a stray gspot file. Blocks and merges count too.
 * @param session the session
 * @returns the drift entries in path order
 */
export function computeDrift(session: Session): DriftEntry[] {
    const rendered = emitAll(session);
    const known = knownPaths(rendered);
    const strays = session.repository.files
        .filter((file) => isStray(session, file.path, known, file.tags))
        .map((file): DriftEntry => ({ path: file.path, kind: 'stray' }));
    return [
        ...fileDrift(session.root, rendered),
        ...blockDrift(session.root, rendered),
        ...otherDrift(session.root, rendered),
        ...strays,
    ].toSorted((a, b) => a.path.localeCompare(b.path));
}
