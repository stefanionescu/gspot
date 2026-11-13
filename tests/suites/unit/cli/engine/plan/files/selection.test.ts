import { symlink } from 'node:fs/promises';
import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { isActive, planChecks } from '#cli/engine/plan/checks.ts';
import { listCheckedFiles } from '#cli/engine/plan/files.ts';
import { openSession } from '#cli/engine/session.ts';
import { compareText } from '#cli/system/text/order.ts';
import { PROJECT_PATH_IGNORES, TSC_PUSH_OPTIONS, TYPESCRIPT_SCOPES_SETTINGS } from '#tests/config/engine/plan.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';

test("a file named on the command line runs its scope's project check on every file of the scope", async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': TYPESCRIPT_SCOPES_SETTINGS,
        'api/source.ts': 'export {};\n',
        'api/caller.ts': 'export {};\n',
        'api/tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'web/tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'web/source.ts': 'export {};\n',
    });

    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { ...TSC_PUSH_OPTIONS, paths: ['api/source.ts'] });
    const affected = planned.filter((check) => check.files.length > 0);
    expect(affected.map((check) => check.scope.path)).toStrictEqual(['api']);
    expect(affected[0]?.files.map((file) => file.path)).toStrictEqual([
        'api/caller.ts',
        'api/source.ts',
        'api/tsconfig.json',
    ]);
});

test.each([...PROJECT_PATH_IGNORES])(
    '$name, and the TypeScript check plans only the files that the ignore leaves',
    async ({ changed, present, check, rule, files }) => {
        const ignore = {
            check,
            ...(rule !== undefined && { rule }),
            paths: ['api/ignored.ts'],
            reason: 'This input is evaluated by its owning pipeline.',
        };
        await using sandbox = await createGitSandbox({
            'gspot.toml': `${TYPESCRIPT_SCOPES_SETTINGS}\n${stringify({ ignore: [ignore] })}`,
            'api/kept.ts': 'export {};\n',
            ...(present && { 'api/ignored.ts': 'export {};\n' }),
        });
        const session = await openSession(sandbox.path);
        const planned = planChecks(session, {
            ...TSC_PUSH_OPTIONS,
            selection: { content: 'working-tree', paths: [...changed] },
        });
        expect(planned.flatMap((plannedCheck) => plannedCheck.files.map((file) => file.path))).toStrictEqual([
            ...files,
        ]);
        expect(planned.flatMap((plannedCheck) => plannedCheck.triggerPaths)).toStrictEqual([]);
    },
);

test(`a scope's per-scope check plans every file of its scope and covers only its test files`, async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['jest'], {
            scopes: [{ path: 'apps/web' }, { path: 'apps/web/nested' }],
        }),
        'apps/web/value.test.js': 'test("value", () => expect(1).toBe(1));\n',
        'apps/web/image.bin': new Uint8Array([0, 255, 0]),
        'apps/web/jest.config.json': '{"testEnvironment":"node"}',
        'apps/web/nested/jest.config.json': '{"testEnvironment":"node"}',
        'apps/web/nested/private.txt': 'Nested scope input\n',
        'unrelated/private.txt': 'Sibling input\n',
    });

    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'all', only: ['jest/tests'] });
    const project = planned.find((each) => each.scope.path === 'apps/web')!;
    expect(project.files.map((file) => file.path).toSorted(compareText)).toStrictEqual([
        'apps/web/image.bin',
        'apps/web/jest.config.json',
        'apps/web/value.test.js',
    ]);
    expect(listCheckedFiles(session.scopes, project).map((file) => file.path)).toStrictEqual([
        'apps/web/value.test.js',
    ]);
});

test('deleting a file starts a check that any edit starts, with the deleted path as its trigger', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docs']),
        'README.md': '# Example\n\nRead `src/removed.ts`.\n',
        'src/removed.ts': 'export const value = 1;\n',
    });
    commitAll(sandbox.path);
    runGitStep(sandbox.path, ['rm', '--quiet', 'src/removed.ts']);
    const selection = { content: 'index' as const, paths: ['src/removed.ts'] };
    const planned = planChecks(await openSession(sandbox.path), {
        stage: 'commit',
        only: ['docs/missing-paths'],
        selection,
    });
    expect(
        planned.map((check) => ({ triggerPaths: check.triggerPaths, active: isActive(check, selection) })),
    ).toStrictEqual([{ triggerPaths: ['src/removed.ts'], active: true }]);
});

test('a deleted generated path is not a trigger for a configured project check', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['dependencies']),
        'source.ts': 'export const value = 1;\n',
    });
    const planned = planChecks(await openSession(sandbox.path), {
        stage: 'push',
        only: ['dependencies/osv-scanner'],
        selection: { content: 'working-tree', paths: ['.gspot/package-lock.json'] },
    });
    expect(planned.map(({ check, triggerPaths }) => ({ check: check.id, triggerPaths }))).toStrictEqual([
        { check: 'dependencies/osv-scanner', triggerPaths: [] },
    ]);
});

test('a project check leaves binary files out of its planned inputs', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docker']),
        Dockerfile: 'FROM scratch\n',
        'image.bin': new Uint8Array([0, 255, 0]),
    });
    const planned = planChecks(await openSession(sandbox.path), { stage: 'commit', only: ['docker/dockerignore'] });
    expect(
        planned.map(({ check, files }) => ({ check: check.id, files: files.map(({ path }) => path) })),
    ).toStrictEqual([{ check: 'docker/dockerignore', files: ['Dockerfile', 'gspot.toml'] }]);
});

test('a link stays out of the file list of a tool and stays in the list of a built-in check', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown']),
        'AGENTS.md': '# Agents\n',
    });
    await symlink('AGENTS.md', join(sandbox.path, 'CLAUDE.md'), 'file');
    commitAll(sandbox.path);
    const planned = planChecks(await openSession(sandbox.path), {
        stage: 'all',
        only: ['format/prettier', 'repository/local-files'],
    });
    const paths = (id: string) => planned.find(({ check }) => check.id === id)?.files.map((file) => file.path);
    expect(paths('format/prettier')).not.toContain('CLAUDE.md');
    expect(paths('format/prettier')).toContain('AGENTS.md');
    expect(paths('repository/local-files')).toContain('CLAUDE.md');
});

test('oversized and invalid UTF-8 files stay out of the planned files of a tool', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown'], { tables: '[repository]\nmax_file_kilobytes = 1\n' }),
        'small.md': '# Small\n',
        'large.md': 'x'.repeat(1025),
        'latin1.md': Buffer.from([35, 32, 67, 97, 102, 233]),
    });
    runGitStep(sandbox.path, ['add', '-A']);
    const [planned] = planChecks(await openSession(sandbox.path), { stage: 'all', only: ['format/prettier'] });
    const paths = planned?.files.map(({ path }) => path);
    expect(paths).toContain('small.md');
    expect(paths).not.toContain('large.md');
    expect(paths).not.toContain('latin1.md');
});
