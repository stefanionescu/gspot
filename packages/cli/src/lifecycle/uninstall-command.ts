// uninstall: print the plan, ask, remove what init wrote.
import { join } from 'node:path';
import { emitAll } from '#cli/emit/targets.ts';
import { openSession } from '#cli/run/session.ts';
import { hasHeader } from '#cli/emit/templates.ts';
import type { PackageContent } from '#types/emit.ts';
import { isConfirmed } from '#cli/output/prompts.ts';
import { removeHooksPath } from '#cli/emit/hooks.ts';
import { withoutLefthook } from '#cli/emit/lefthook.ts';
import { withoutBlock } from '#cli/emit/managed-blocks.ts';
import type { Session, CommandResult } from '#types/run.ts';
import { head, findRoot } from '#cli/repository/tracked.ts';
import { applyEdits, modify, parse as parseJsonc } from 'jsonc-parser';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { UninstallOptions, UninstallPlan } from '#types/lifecycle.ts';

const HEAD_BYTES = 600;
const BLOCK_FILES = [
    '.gitignore',
    'CLAUDE.md',
    'AGENTS.md',
    '.husky/pre-commit',
    '.husky/pre-push',
    '.husky/commit-msg',
];
const MARKDOWN_BLOCK_FILES = new Set(['CLAUDE.md', 'AGENTS.md']);

function renderedPaths(session: Session): string[] {
    return emitAll(session)
        .files.map((file) => file.path)
        .filter((path) => !path.startsWith('.gspot/') && existsSync(join(session.root, path)));
}

function headedPaths(session: Session): string[] {
    return session.repository.files
        .filter((file) => !file.path.startsWith('.gspot/') && file.tags.includes('text'))
        .filter((file) => hasHeader(head(session.root, file.path, HEAD_BYTES)))
        .map((file) => file.path);
}

function blockPaths(root: string): string[] {
    return BLOCK_FILES.filter((path) => {
        const full = join(root, path);
        return existsSync(full) && readFileSync(full, 'utf8').includes('gspot managed');
    });
}

function planText(plan: UninstallPlan): string {
    const lines = [
        'remove',
        ...plan.remove.map((path) => `  ${path}`),
        ...(plan.blocks.length > 0 ? ['managed blocks removed from', ...plan.blocks.map((path) => `  ${path}`)] : []),
        ...(plan.hooksPath ? ['unset core.hooksPath'] : []),
        'kept: gspot.toml and the project rule layer',
        '',
    ];
    return lines.join('\n');
}

// The devDependencies and scripts gspot wrote leave package.json when they still hold the value gspot gave them.
function removePackagePins(session: Session): string[] {
    const edited: string[] = [];
    for (const output of emitAll(session).packages) {
        const full = join(session.root, output.path);
        if (!existsSync(full)) continue;
        let text = readFileSync(full, 'utf8');
        const content = parseJsonc(text) as PackageContent;
        const owned: [string, Record<string, string>, Record<string, string>][] = [
            ['devDependencies', content.devDependencies ?? {}, output.devDependencies],
            ['scripts', content.scripts ?? {}, output.scripts],
        ];
        for (const [table, current, mine] of owned) {
            const names = Object.keys(current).filter((key) => mine[key] === current[key]);
            for (const name of names) text = applyEdits(text, modify(text, [table, name], undefined, {}));
        }
        writeFileSync(full, text);
        edited.push(output.path);
    }
    return edited;
}

function removeLefthookCommands(session: Session): string | undefined {
    const { lefthook } = emitAll(session);
    if (!lefthook || !existsSync(join(session.root, lefthook.path))) return undefined;
    const full = join(session.root, lefthook.path);
    writeFileSync(full, withoutLefthook(readFileSync(full, 'utf8'), lefthook.block));
    return lefthook.path;
}

/**
 * What uninstall removes: everything the selection renders, plus any file that carries the header.
 * @param session the session
 * @param isHooksKept whether --keep-hooks leaves core.hooksPath alone
 * @returns the paths to remove, the files whose managed block goes, and whether the hooks path is unset
 */
export function planUninstall(session: Session, isHooksKept: boolean): UninstallPlan {
    const { root } = session;
    const remove = new Set([
        ...(existsSync(join(root, '.gspot')) ? ['.gspot/'] : []),
        ...renderedPaths(session),
        ...headedPaths(session),
    ]);
    return {
        remove: [...remove].toSorted((a, b) => a.localeCompare(b)),
        blocks: blockPaths(root),
        hooksPath: !isHooksKept,
    };
}

/**
 * Applies the plan.
 * @param root the repository root
 * @param plan what to remove
 */
export function applyUninstall(root: string, plan: UninstallPlan): void {
    for (const path of plan.remove) rmSync(join(root, path), { recursive: true, force: true });
    for (const path of plan.blocks) {
        const full = join(root, path);
        const text = withoutBlock(readFileSync(full, 'utf8'), MARKDOWN_BLOCK_FILES.has(path) ? 'markdown' : 'hash');
        if (text === '') rmSync(full, { force: true });
        else writeFileSync(full, text);
    }
    if (plan.hooksPath) removeHooksPath(root);
}

/**
 * Runs uninstall: prints the plan, asks, removes.
 * @param options the parsed flags
 * @returns the command result
 */
export async function uninstallCommand(options: UninstallOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    const session = await openSession(root);
    const plan = planUninstall(session, options.isHooksKept);
    const text = planText(plan);
    if (options.isDryRun)
        return { text: `${text}--dry-run: nothing removed.\n`, json: { plan, isDryRun: true }, exitCode: 0 };
    process.stdout.write(text);
    // --yes is the answer to this one question, so it means yes; the terminal still starts on no.
    const isGo = options.yes || (await isConfirmed('Remove these?', '--yes', false, false));
    if (!isGo) return { text: 'Nothing removed.\n', json: { plan, applied: false }, exitCode: 0 };
    const edited = [...removePackagePins(session), removeLefthookCommands(session)].filter(
        (path) => path !== undefined,
    );
    applyUninstall(root, plan);
    const pins = edited.length === 0 ? '' : ` The gspot entries left ${edited.join(' and ')}.`;
    return {
        text: `removed.${pins} gspot.toml stays; delete it to finish.\n`,
        json: { plan, applied: true, edited },
        exitCode: 0,
    };
}
