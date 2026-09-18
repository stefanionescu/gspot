// The inverse of init: remove what gspot wrote; leave gspot.toml and the project rule layer.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { removeHooksPath } from '#cli/render/hooks.ts';
import { withoutBlock } from '#cli/render/managed-blocks.ts';
import { renderAll } from '#cli/render/targets.ts';
import { carriesHeader } from '#cli/render/templates.ts';
import { head } from '#cli/repository/tracked.ts';
import type { Session } from '#cli/run/session.ts';

export type UninstallPlan = { remove: string[]; blocks: string[]; hooksPath: boolean };

/** What uninstall would remove: everything the selection renders, plus any file that carries the header. */
export function planUninstall(session: Session, keepHooks: boolean): UninstallPlan {
    const remove = new Set<string>();
    const blocks: string[] = [];
    const { root } = session;
    if (existsSync(join(root, '.gspot'))) remove.add('.gspot/');
    const rendered = renderAll(session);
    for (const file of rendered.files)
        if (!file.path.startsWith('.gspot/') && existsSync(join(root, file.path))) remove.add(file.path);
    for (const file of session.repository.files) {
        if (file.path.startsWith('.gspot/') || !file.tags.includes('text')) continue;
        if (carriesHeader(head(root, file.path, 600))) remove.add(file.path);
    }
    for (const path of ['.gitignore', 'CLAUDE.md', 'AGENTS.md']) {
        const full = join(root, path);
        if (existsSync(full) && readFileSync(full, 'utf8').includes('gspot managed')) blocks.push(path);
    }
    return { remove: [...remove].sort(), blocks, hooksPath: !keepHooks };
}

/** Applies the plan. */
export function applyUninstall(root: string, plan: UninstallPlan): void {
    for (const path of plan.remove) rmSync(join(root, path), { recursive: true, force: true });
    for (const path of plan.blocks) {
        const full = join(root, path);
        const text = withoutBlock(readFileSync(full, 'utf8'), path === '.gitignore' ? 'hash' : 'markdown');
        if (text === '') rmSync(full, { force: true });
        else writeFileSync(full, text);
    }
    if (plan.hooksPath) removeHooksPath(root);
}
