// sync --check: render in memory, find generated files by header, compare bytes, print the diff.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createTwoFilesPatch } from 'diff';

import { currentBlock, fileText } from '#cli/render/managed-blocks.ts';
import { mergeStubHolds } from '#cli/render/stubs.ts';
import { renderAll } from '#cli/render/targets.ts';
import { carriesHeader } from '#cli/render/templates.ts';
import { head } from '#cli/repository/tracked.ts';
import type { Session } from '#cli/run/session.ts';
import type { DriftEntry } from '#types/render.ts';

const NEVER_STRAY = ['.gspot/version', '.gspot/last.json', '.gspot/last.sarif'];

function isStrayCandidate(path: string): boolean {
    if (path.startsWith('.gspot/cache/') || path.startsWith('.gspot/baseline/') || NEVER_STRAY.includes(path))
        return false;
    return true;
}

/** Every generated file that differs from its render, is missing, or is a stray gspot file. Blocks and merges count too. */
export async function computeDrift(session: Session): Promise<DriftEntry[]> {
    const rendered = renderAll(session);
    const entries: DriftEntry[] = [];
    const known = new Set<string>();
    for (const file of rendered.files) {
        known.add(file.path);
        const full = join(session.root, file.path);
        if (!existsSync(full)) {
            entries.push({ path: file.path, kind: 'missing' });
            continue;
        }
        const disk = readFileSync(full, 'utf8');
        if (disk !== file.content)
            entries.push({
                path: file.path,
                kind: 'changed',
                diff: createTwoFilesPatch(
                    `a/${file.path}`,
                    `b/${file.path}`,
                    disk,
                    file.content,
                    'on disk',
                    'rendered',
                    { context: 2 },
                ),
            });
    }
    for (const block of rendered.blocks) {
        known.add(block.path);
        const text = fileText(session.root, block.path);
        const current = currentBlock(text, block.style);
        if (current === undefined) entries.push({ path: block.path, kind: 'missing' });
        else if (current !== block.block.trim())
            entries.push({
                path: block.path,
                kind: 'changed',
                diff: createTwoFilesPatch(
                    `a/${block.path}`,
                    `b/${block.path}`,
                    current,
                    block.block.trim(),
                    'managed block on disk',
                    'rendered',
                    { context: 2 },
                ),
            });
    }
    for (const merge of rendered.merges) {
        known.add(merge.path);
        if (!mergeStubHolds(session.root, merge.stub, merge.path, merge.target))
            entries.push({
                path: merge.path,
                kind: existsSync(join(session.root, merge.path)) ? 'changed' : 'missing',
            });
    }
    for (const file of session.repository.files) {
        if (known.has(file.path) || !isStrayCandidate(file.path) || !file.tags.includes('text')) continue;
        if (file.path.startsWith('.gspot/') || carriesHeader(head(session.root, file.path, 600))) {
            if (file.path.startsWith('.gspot/rules/') && !session.loaded.policy.rules.install) continue;
            entries.push({ path: file.path, kind: 'stray' });
        }
    }
    return entries.sort((a, b) => a.path.localeCompare(b.path));
}
