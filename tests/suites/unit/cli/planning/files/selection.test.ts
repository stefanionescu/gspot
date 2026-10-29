import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { planChecks } from '#cli/planning/checks.ts';
import { symlink, writeFile } from 'node:fs/promises';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { BROKEN_IF_SCRIPT } from '#tests/config/bash.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { listCheckedFiles } from '#cli/planning/files.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/setup/sandboxes.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeNpmTool, writeProgramCommand } from '#tests/setup/system/fakes.ts';

import {
    TSC_PUSH_OPTIONS,
    EDITORCONFIG_FILES,
    PROJECT_PATH_IGNORES,
    LAYERED_SCOPE_SETTINGS,
    PROJECT_FINDING_MESSAGE,
    TYPESCRIPT_SCOPES_SETTINGS,
} from '#tests/config/planning/files.ts';

test("a file named on the command line runs its scope's project check on every file of the scope", async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': TYPESCRIPT_SCOPES_SETTINGS,
        'api/source.ts': 'export {};\n',
        'api/caller.ts': 'export {};\n',
        'api/tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'web/tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'web/source.ts': 'export {};\n',
    });

    const declaration = await fakeNpmTool(sandbox.path, 'tsc');
    await writeProgramCommand(
        sandbox.path,
        `${GSPOT_PATHS.nodeModules}/.bin/tsc`,
        'fakes/tool',
        '--version-line',
        String(declaration.version),
        '--line',
        'source.ts(1,1): error TS2304: Project finding',
        '--exit',
        '1',
    );
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { ...TSC_PUSH_OPTIONS, paths: ['api/source.ts'] });
    const affected = planned.filter((check) => check.files.length > 0);
    expect(affected.map((check) => check.scope.path)).toStrictEqual(['api']);
    expect(affected[0]?.files.map((file) => file.path)).toStrictEqual([
        'api/caller.ts',
        'api/source.ts',
        'api/tsconfig.json',
    ]);
    const result = await runChecks(session, buildRunOptions({ ...TSC_PUSH_OPTIONS, paths: ['api/source.ts'] }));
    expect(result.report.exitCode, JSON.stringify(result.report)).toBe(1);
    expect(result.report.checks.find(({ scope }) => scope === 'api')?.findings[0]?.message).toBe(
        PROJECT_FINDING_MESSAGE,
    );
});

test.each([...PROJECT_PATH_IGNORES])(
    '$name, and the TypeScript check plans only the files that the ignore leaves',
    async ({ changed, present, check, rule, files }) => {
        await using sandbox = await createGitSandbox({});
        const ignore = {
            check,
            ...(rule !== undefined && { rule }),
            paths: ['api/ignored.ts'],
            reason: 'This input is evaluated by its owning pipeline.',
        };
        await createFileTree(sandbox.path, {
            'gspot.toml': `${TYPESCRIPT_SCOPES_SETTINGS}\n${stringify({ ignore: [ignore] })}`,
            'api/kept.ts': 'export {};\n',
            ...(present && { 'api/ignored.ts': 'export {};\n' }),
        });
        const session = await openSession(sandbox.path);
        const planned = planChecks(session, {
            ...TSC_PUSH_OPTIONS,
            changed: [...changed],
        });
        expect(planned.flatMap((plannedCheck) => plannedCheck.files.map((file) => file.path))).toStrictEqual([
            ...files,
        ]);
        expect(planned.flatMap((plannedCheck) => plannedCheck.triggerPaths)).toStrictEqual([]);
    },
);

test('EditorConfig checks source files beyond the Prettier extensions and skips binary files', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['format']),
        ...EDITORCONFIG_FILES,
        'binary.dat': Buffer.from([0, 255, 0]),
    });

    const session = await openSession(sandbox.path);
    const [planned] = planChecks(session, { stage: 'commit', only: ['format/editorconfig-checker'] });
    expect(planned!.files.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
        [...Object.keys(EDITORCONFIG_FILES), 'gspot.toml'].toSorted((left, right) => left.localeCompare(right)),
    );
    expect(planned!.skip).toBeUndefined();
});

test('a project-wide TypeScript check counts its source file and tsconfig.json, not unrelated files', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'source.ts': 'export const value = 1;\n',
        ...Object.fromEntries(
            Array.from({ length: 20 }, (_, index) => [`notes-${String(index)}.txt`, 'Other input.\n']),
        ),
    });
    commitAll(sandbox.path);
    const declaration = await fakeNpmTool(sandbox.path, 'tsc');
    await writeProgramCommand(
        sandbox.path,
        `${GSPOT_PATHS.nodeModules}/.bin/tsc`,
        'fakes/tool',
        '--version-line',
        String(declaration.version),
    );
    const all = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']));
    expect(all.code, all.stdout + all.stderr).toBe(0);
    expect(all.report.checks).toMatchObject([{ check: 'typescript/tsc', fileCount: 2 }]);
    await writeFile(join(sandbox.path, 'source.ts'), 'export const value = 2;\n');
    runGitStep(sandbox.path, ['add', 'source.ts']);
    const staged = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'typescript/tsc', '--staged', '--json']),
    );
    expect(staged.code, staged.stdout + staged.stderr).toBe(0);
    expect(staged.report.checks).toMatchObject([{ check: 'typescript/tsc', fileCount: 2 }]);
});

test(`a scope's per-scope check plans every file of its scope and covers only its test files`, async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['jest'], {
            scopes: [{ path: 'apps/web' }, { path: 'apps/web/nested' }],
        }),
        'apps/web/value.test.js': 'test("value", () => expect(1).toBe(1));\n',
        'apps/web/image.bin': new Uint8Array([0, 255, 0]),
        'apps/web/jest.config.json': '{"testEnvironment":"node"}',
        'apps/web/nested/private.txt': 'Nested scope input\n',
        'unrelated/private.txt': 'Sibling input\n',
    });

    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'all', only: ['jest/coverage'] });
    const project = planned.find((each) => each.scope.path === 'apps/web')!;
    expect(project.files.map((file) => file.path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'apps/web/image.bin',
        'apps/web/jest.config.json',
        'apps/web/value.test.js',
    ]);
    expect(listCheckedFiles(session.scopes, project).map((file) => file.path)).toStrictEqual([
        'apps/web/value.test.js',
    ]);
});

test('Xcode plutil and general xmllint checks select their Apple and XML files', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            level: 'basic',
            rules: true,
            scopes: [{ path: 'api', configurations: ['xcode'] }],
        }),
        'root.plist': '<plist><dict/></plist>\n',
        'api/app.plist': '<plist><dict/></plist>\n',
        'api/app.storyboard': '<document/>\n',
        'api/data.xml': '<document/>\n',
    });

    const session = await openSession(sandbox.path);
    const checks = planChecks(session, {
        stage: 'all',
        only: ['xcode/plutil', 'data-files/xmllint'],
    });
    expect(
        checks
            .filter(({ files }) => files.length > 0)
            .map(({ check, files }) => [check.id, files.map(({ path }) => path)]),
    ).toStrictEqual([
        ['data-files/xmllint', ['api/app.storyboard', 'api/data.xml']],
        ['xcode/plutil', ['api/app.plist']],
    ]);
});

test('Prettier gets every matching file, also those its ignore file lists', async () => {
    await using sandbox = await createGitSandbox({});
    const ignored = 'ignored.md\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['markdown']),
        'settings/format.ignore': ignored,
        [`${GSPOT_PATHS.configurations}/.keep`]: '',
        'ignored.md': '# Ignored\n',
        'kept.md': '# Kept\n',
    });
    await symlink('settings/format.ignore', join(sandbox.path, '.prettierignore'));
    const session = await openSession(sandbox.path);
    const plans = planChecks(session, { stage: 'commit', only: ['format/prettier'] });
    expect(plans[0]!.files.map((file) => file.path)).toStrictEqual(['ignored.md', 'kept.md']);
});

test('a command check reads each matching file once across nested scopes', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': LAYERED_SCOPE_SETTINGS + BASH_SYNTAX_CHECK,
        'api/entry.sh': BROKEN_IF_SCRIPT,
        'api/worker/entry.sh': BROKEN_IF_SCRIPT,
        'api/worker/query.sql': 'SELECT 1;\n',
    });

    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'project/bash-syntax', '--json']),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const checks = checked.report.checks;
    expect(
        checks.map((check) => ({ check: check.check, scope: check.scope, fileCount: check.fileCount })),
    ).toStrictEqual([{ check: 'project/bash-syntax', scope: '', fileCount: 2 }]);
    expect(new Set(checks[0]?.findings.map((finding) => finding.file))).toStrictEqual(
        new Set(['api/entry.sh', 'api/worker/entry.sh']),
    );
});

test('a deleted generated path is not a trigger for a configured project check', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['dependencies']),
        'source.ts': 'export const value = 1;\n',
    });
    const planned = planChecks(await openSession(sandbox.path), {
        stage: 'push',
        only: ['dependencies/osv-scanner'],
        changed: ['.gspot/package-lock.json'],
    });
    expect(planned.map(({ check, triggerPaths }) => ({ check: check.id, triggerPaths }))).toStrictEqual([
        { check: 'dependencies/osv-scanner', triggerPaths: [] },
    ]);
});

test('a project check leaves binary files out of its planned inputs', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['docker']),
        Dockerfile: 'FROM scratch\n',
        'image.bin': new Uint8Array([0, 255, 0]),
    });
    const planned = planChecks(await openSession(sandbox.path), { stage: 'commit', only: ['docker/dockerignore'] });
    expect(
        planned.map(({ check, files }) => ({ check: check.id, files: files.map(({ path }) => path) })),
    ).toStrictEqual([{ check: 'docker/dockerignore', files: ['Dockerfile', 'gspot.toml'] }]);
});
