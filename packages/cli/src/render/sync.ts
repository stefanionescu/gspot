// Writes every generated file, block and merge; removes strays; sets the hooks path.
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { markExecutable } from '#cli/platform/executable-bit.ts';
import { computeDrift } from '#cli/render/drift.ts';
import { installHooksPath, removeHooksPath } from '#cli/render/hooks.ts';
import { withBlock } from '#cli/render/managed-blocks.ts';
import { renderAll } from '#cli/render/targets.ts';
import type { Session } from '#cli/run/session.ts';

export type SyncReport = { written: string[]; unchanged: string[]; removed: string[]; blocks: string[] };

/** Writes one file, read-only where asked, creating directories. */
export function writeGenerated(root: string, path: string, content: string, readOnly: boolean): boolean {
    const full = join(root, path);
    if (existsSync(full)) {
        if (readFileSync(full, 'utf8') === content) return false;
        if (process.platform !== 'win32') chmodSync(full, 0o644);
    }
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
    if (readOnly && process.platform !== 'win32') chmodSync(full, 0o444);
    return true;
}

/** Renders and writes everything. Idempotent. */
export async function syncAll(session: Session, binaryPath?: string): Promise<SyncReport> {
    const report: SyncReport = { written: [], unchanged: [], removed: [], blocks: [] };
    const drift = await computeDrift(session);
    const rendered = renderAll(session, binaryPath);
    for (const file of rendered.files) {
        const changed = writeGenerated(session.root, file.path, file.content, file.readOnly);
        if (file.executable) markExecutable(session.root, file.path);
        (changed ? report.written : report.unchanged).push(file.path);
    }
    for (const block of rendered.blocks) {
        const full = join(session.root, block.path);
        const existing = existsSync(full) ? readFileSync(full, 'utf8') : '';
        const next = withBlock(existing, block.block, block.style);
        if (next !== existing) {
            writeFileSync(full, next);
            report.blocks.push(block.path);
        }
    }
    for (const merge of rendered.merges) {
        const full = join(session.root, merge.path);
        const existing = existsSync(full) ? readFileSync(full, 'utf8') : '';
        if (existing !== merge.content) {
            mkdirSync(dirname(full), { recursive: true });
            writeFileSync(full, merge.content);
            report.written.push(merge.path);
        }
    }
    for (const entry of drift) {
        if (entry.kind !== 'stray') continue;
        if (!entry.path.startsWith('.gspot/')) continue;
        rmSync(join(session.root, entry.path), { force: true });
        report.removed.push(entry.path);
    }
    if (session.loaded.policy.hooks.manager === 'gspot' && session.repository.hasGit) installHooksPath(session.root);
    else if (session.repository.hasGit) removeHooksPath(session.root);
    return report;
}
