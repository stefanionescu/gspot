// --fix: every fixer in order, then the checks again; --dry-run through a scratch copy and a diff.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { createTwoFilesPatch } from 'diff';

import { probeTool } from '#cli/doctor/probes.ts';
import { toPlatform } from '#cli/platform/paths.ts';
import { run } from '#cli/platform/spawn.ts';
import { byFixOrder } from '#cli/run/concurrency.ts';
import type { PlannedCheck } from '#cli/run/plan.ts';
import type { Session } from '#cli/run/session.ts';
import { substitute } from '#cli/run/tool-runner.ts';

export type FixReport = { ran: { id: string; files: number }[]; changed: string[]; diffs: string[] };

function fixable(planned: PlannedCheck[]): PlannedCheck[] {
    return byFixOrder(
        planned
            .filter((check) => check.spec.fix_command && !check.skip && check.files.length > 0)
            .map((check) => ({ ...check, order: check.spec.fix_order })),
    ).map(({ order: _order, ...check }) => check as PlannedCheck);
}

async function runFixer(session: Session, planned: PlannedCheck, root: string): Promise<boolean> {
    const { spec, tool } = planned;
    if (!spec.fix_command || !tool) return false;
    const probe = probeTool(session.root, tool);
    if (!probe.path) return false;
    const argv = substitute(session, planned, spec.fix_command, {
        files: planned.files.map((file) => file.path),
        scope: planned.scope.scope.path,
        root,
        indent: planned.scope.view.format.indent_width,
    });
    argv[0] = probe.path;
    await run(argv, { cwd: root, env: { NO_COLOR: '1' } });
    return true;
}

function snapshot(root: string, paths: string[]): Map<string, string> {
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

/** Runs every fixer in order. With dryRun, runs them in a scratch copy and returns diffs; nothing under the repository changes. */
export async function applyFixers(session: Session, planned: PlannedCheck[], dryRun: boolean): Promise<FixReport> {
    const checks = fixable(planned);
    const paths = [...new Set(checks.flatMap((check) => check.files.map((file) => file.path)))].sort();
    const report: FixReport = { ran: [], changed: [], diffs: [] };
    let root = session.root;
    let scratch: string | undefined;
    if (dryRun) {
        scratch = mkdtempSync(join(tmpdir(), 'gspot-fix-'));
        for (const path of [
            ...paths,
            ...session.repository.files.filter((file) => file.path.startsWith('.gspot/')).map((file) => file.path),
            'gspot.toml',
            'package.json',
            'tsconfig.json',
            'pyproject.toml',
        ]) {
            const source = join(session.root, path);
            if (!existsSync(source)) continue;
            mkdirSync(dirname(join(scratch, path)), { recursive: true });
            cpSync(source, join(scratch, path));
        }
        for (const dir of ['node_modules', '.venv'])
            if (existsSync(join(session.root, dir)))
                cpSync(join(session.root, dir), join(scratch, dir), {
                    recursive: true,
                    dereference: false,
                    errorOnExist: false,
                    force: false,
                });
        root = scratch;
    }
    const before = snapshot(root, paths);
    for (const check of checks) {
        const ran = await runFixer(session, check, root);
        if (ran) report.ran.push({ id: check.id, files: check.files.length });
    }
    const after = snapshot(root, paths);
    for (const path of paths) {
        const was = before.get(path) ?? '';
        const now = after.get(path) ?? '';
        if (was === now) continue;
        report.changed.push(path);
        if (dryRun)
            report.diffs.push(
                createTwoFilesPatch(`a/${toPlatform(path)}`, `b/${toPlatform(path)}`, was, now, '', '', { context: 3 }),
            );
    }
    if (scratch) rmSync(scratch, { recursive: true, force: true });
    return report;
}
