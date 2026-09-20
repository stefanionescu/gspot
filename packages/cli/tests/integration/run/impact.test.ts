import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { planRun } from '#cli/run/plan.ts';
import type { Session } from '#types/run.ts';
import { createSandbox } from '@gspot/testing';
import { applyFixers } from '#cli/run/fixers.ts';
import { executeRun } from '#cli/run/execute.ts';
import { openSession } from '#cli/run/session.ts';
import type { CheckSpec } from '#types/manifest.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import { stagedFiles } from '#cli/repository/staged.ts';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

const options = { stage: 'commit' as const, skips: [], localSkips: [], only: ['sandbox/project'] };
const policy = `version = 1
presets = []
[[scope]]
path = "api"
presets = []
[[scope]]
path = "web"
presets = []
`;

function git(root: string, ...argv: string[]): void {
    const result = runBlocking(['git', ...argv], { cwd: root });
    expect(result.code, result.stderr).toBe(0);
}

function projectChecks(session: Session): void {
    const manifest = session.manifests.get('typescript')!;
    const spec: CheckSpec = {
        name: 'sandbox/project',
        stage: 'commit',
        runs: 'per-scope',
        coverage: [],
        summary: 'Reports the planted project finding.',
        why: 'Changed files trigger the complete project check.',
        help: 'Fix the planted project finding.',
        cwd: 'root' as const,
        command: [process.execPath, '-e', "console.log('Project finding'); process.exitCode = 1"],
        output: { format: 'lines' as const },
        claims: manifest.claims,
        fix_order: 'codemod' as const,
        fix_command: [process.execPath, '-e', "await Bun.write('{scope}/source.ts', 'restored')"],
    };
    const fileCheck = { ...spec, name: 'sandbox/files', runs: 'per-file-list' as const };
    for (const scope of session.scopes) {
        if (scope.scope.path !== '') scope.selected = [{ ...manifest, tools: [], checks: [spec, fileCheck] }];
    }
}

test.each(['delete', 'rename'])('a last-file %s triggers the affected project through execution', async (operation) => {
    await using sandbox = await createSandbox({
        'gspot.toml': policy,
        'api/source.ts': 'export {};\n',
        'web/kept.ts': 'export {};\n',
    });
    git(sandbox.path, 'init');
    git(sandbox.path, 'add', '.');
    git(sandbox.path, '-c', 'user.name=Sandbox', '-c', 'user.email=sandbox@example.com', 'commit', '-qm', 'Sandbox');
    if (operation === 'delete') git(sandbox.path, 'rm', 'api/source.ts');
    else git(sandbox.path, 'mv', 'api/source.ts', 'web/source.ts');
    mkdirSync(join(sandbox.path, 'api'), { recursive: true });
    const session = await openSession(sandbox.path);
    projectChecks(session);
    const staged = stagedFiles(sandbox.path).staged;
    const planned = planRun(session, { ...options, staged });
    const api = planned.find((check) => check.scope.scope.path === 'api')!;
    expect(api.files).toEqual([]);
    expect(api.triggerPaths).toContain('api/source.ts');
    const fileChecks = planRun(session, { ...options, only: ['sandbox/files'], staged });
    expect(fileChecks.flatMap((check) => check.triggerPaths)).toEqual([]);
    expect(fileChecks.flatMap((check) => check.files.map((file) => file.path))).toEqual(
        operation === 'delete' ? [] : ['web/source.ts'],
    );
    const outcome = await executeRun(session, { ...options, staged, fix: false, isDryRun: false, noCache: true });
    expect(outcome.report.exitCode).toBe(1);
    expect(outcome.report.checks.map((check) => check.scope)).toEqual(
        operation === 'delete' ? ['api'] : ['api', 'web'],
    );
    expect(
        outcome.report.checks.every((check) => check.findings.some((finding) => finding.message === 'Project finding')),
    ).toBe(true);
    const preview = await applyFixers(session, [api], true);
    expect(preview.changed).toEqual(['api/source.ts']);
    expect(existsSync(join(sandbox.path, 'api/source.ts'))).toBe(false);
    const applied = await applyFixers(session, [api], false);
    expect(applied.changed).toEqual(['api/source.ts']);
    expect(readFileSync(join(sandbox.path, 'api/source.ts'), 'utf8')).toBe('restored');
});

test('a positional file trigger preserves project-wide input and findings', async () => {
    await using sandbox = await createSandbox({
        'gspot.toml': policy,
        'api/source.ts': 'export {};\n',
        'api/caller.ts': 'export {};\n',
        'web/source.ts': 'export {};\n',
    });
    const session = await openSession(sandbox.path);
    projectChecks(session);
    const planned = planRun(session, { ...options, paths: ['api/source.ts'] });
    const affected = planned.filter((check) => check.files.length > 0);
    expect(affected.map((check) => check.scope.scope.path)).toEqual(['api']);
    expect(affected[0]?.files.map((file) => file.path)).toEqual(['api/caller.ts', 'api/source.ts']);
    const outcome = await executeRun(session, {
        ...options,
        paths: ['api/source.ts'],
        fix: false,
        isDryRun: false,
        noCache: true,
    });
    expect(outcome.report.exitCode).toBe(1);
    expect(outcome.report.checks[0]?.findings[0]?.message).toBe('Project finding');
});
