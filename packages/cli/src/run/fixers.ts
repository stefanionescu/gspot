// --fix: every fixer in order, then the checks again; --dry-run through a scratch copy and a diff.
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createTwoFilesPatch } from 'diff';
import { run } from '#cli/platform/spawn.ts';
import { toPlatform } from '#cli/platform/paths.ts';
import { byFixOrder } from '#cli/run/concurrency.ts';
import { substitute } from '#cli/run/tool-runner.ts';
import { probeTool } from '#cli/platform/tool-probe.ts';
import type { FixReport, Session, PlannedCheck } from '#types/run.ts';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';

const DIFF_CONTEXT = 3;
const SCRATCH_EXTRAS = ['gspot.toml', 'package.json', 'tsconfig.json', 'pyproject.toml'];
const SCRATCH_DIRECTORIES = ['node_modules', '.venv'];

function isFixable(check: PlannedCheck): boolean {
    return check.spec.fix_command !== undefined && check.skip === undefined && check.files.length > 0;
}

function fixable(planned: PlannedCheck[]): PlannedCheck[] {
    const ordered = byFixOrder(
        planned.filter((check) => isFixable(check)).map((check) => ({ ...check, order: check.spec.fix_order })),
    );
    return ordered.map(({ order: _order, ...check }) => check);
}

async function didRunFixer(session: Session, planned: PlannedCheck, root: string, failed: string[]): Promise<boolean> {
    const { spec, tool } = planned;
    if (tool === undefined || spec.fix_command === undefined) return false;
    const probe = probeTool(session.root, tool);
    if (probe.path === undefined) return false;
    const argv = substitute(session, planned, spec.fix_command, {
        files: planned.files.map((file) => file.path),
        scope: planned.scope.scope.path,
        root,
        indent: planned.scope.view.format.indent_width,
    });
    argv[0] = probe.path;
    const result = await run(argv, { cwd: root, env: { NO_COLOR: '1' } });
    if (result.missing || result.isTimedOut === true) failed.push(`${planned.id}: ${tool.name} did not run`);
    return true;
}

function contentsOf(root: string, paths: string[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const path of paths) {
        try {
            map.set(path, readFileSync(join(root, path), 'utf8'));
        } catch {
            map.set(path, '');
        }
    }
    return map;
}

function scratchCopy(session: Session, paths: string[]): string {
    const scratch = mkdtempSync(join(tmpdir(), 'gspot-fix-'));
    const owned = session.repository.files.filter((file) => file.path.startsWith('.gspot/')).map((file) => file.path);
    for (const path of [...paths, ...owned, ...SCRATCH_EXTRAS]) {
        const source = join(session.root, path);
        if (!existsSync(source)) continue;
        mkdirSync(dirname(join(scratch, path)), { recursive: true });
        cpSync(source, join(scratch, path));
    }
    for (const dir of SCRATCH_DIRECTORIES)
        if (existsSync(join(session.root, dir))) symlinkSync(join(session.root, dir), join(scratch, dir), 'dir');
    return scratch;
}

function diffOf(path: string, was: string, now: string): string {
    return createTwoFilesPatch(`a/${toPlatform(path)}`, `b/${toPlatform(path)}`, was, now, '', '', {
        context: DIFF_CONTEXT,
    });
}

/**
 * Runs every fixer in order. On a dry run, runs them in a scratch copy and returns diffs; nothing under the repository changes.
 * @param session the session
 * @param planned the planned checks
 * @param isDryRun whether to run in a scratch copy and report diffs
 * @returns which fixers ran, which files changed, and the diffs on a dry run
 */
export async function applyFixers(session: Session, planned: PlannedCheck[], isDryRun: boolean): Promise<FixReport> {
    const checks = fixable(planned);
    const paths = [...new Set(checks.flatMap((check) => check.files.map((file) => file.path)))].toSorted((a, b) =>
        a.localeCompare(b),
    );
    const scratch = isDryRun ? scratchCopy(session, paths) : undefined;
    const root = scratch ?? session.root;
    const before = contentsOf(root, paths);
    const ran: FixReport['ran'] = [];
    const failed: string[] = [];
    for (const check of checks)
        if (await didRunFixer(session, check, root, failed)) ran.push({ id: check.id, files: check.files.length });
    const after = contentsOf(root, paths);
    const changed = paths.filter((path) => (before.get(path) ?? '') !== (after.get(path) ?? ''));
    const diffs = isDryRun ? changed.map((path) => diffOf(path, before.get(path) ?? '', after.get(path) ?? '')) : [];
    if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true });
    return { ran, changed, diffs, failed };
}
