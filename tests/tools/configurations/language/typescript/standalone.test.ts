import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { VALID } from '#tests/config/samples/typescript.ts';
import { cp, stat, mkdir, symlink } from 'node:fs/promises';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import { getTsconfig } from '#cli/parsers/packages/public.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { installedModules } from '#tests/harness/environment.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';

import {
    ANCESTOR_TYPESCRIPT_FILES,
    ANCESTOR_TYPESCRIPT_TABLES,
    ANCESTOR_TYPESCRIPT_PROJECT,
    STANDALONE_CORRECTED_SOURCE,
    STANDALONE_TYPESCRIPT_FILES,
    STANDALONE_TYPESCRIPT_TABLES,
    STANDALONE_TYPESCRIPT_DIAGNOSTICS,
} from '#tests/config/tools/configurations/language/typescript/standalone.ts';

test.skipIf(!isPosix).each(['recommended', 'all'] as const)(
    '%s standalone TypeScript checks its own scope and keeps project declarations without private globals',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...STANDALONE_TYPESCRIPT_FILES,
            '.gitignore': '.gspot/\nnode_modules/\n',
            'gspot.toml': buildPolicy(['typescript'], { level, tables: STANDALONE_TYPESCRIPT_TABLES }),
        });
        await cp(join(installedModules, 'typescript'), join(sandbox.path, '.gspot/node_modules/typescript'), {
            recursive: true,
            dereference: true,
        });
        await mkdir(join(sandbox.path, '.gspot/node_modules/.bin'));
        await symlink('../typescript/bin/tsc', join(sandbox.path, '.gspot/node_modules/.bin/tsc'));
        const session = await openSession(sandbox.path);
        using log = openOwnership(sandbox.path);
        writeGeneratedFiles(session, emitAll(session), log);
        const rootConfig = getTsconfig(sandbox.path, join(sandbox.path, '.gspot/config/tsconfig.json'), session.reads)!;
        const appConfig = getTsconfig(
            sandbox.path,
            join(sandbox.path, '.gspot/config/app/tsconfig.json'),
            session.reads,
        )!;
        expect(rootConfig.fileNames).toStrictEqual([join(sandbox.path, 'source.ts')]);
        expect(appConfig.fileNames).toStrictEqual([
            join(sandbox.path, 'app/ambient.d.ts'),
            join(sandbox.path, 'app/source.ts'),
        ]);
        const broken = await spawnGspot(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        const report = JSON.parse(broken.stdout) as RunReport;
        expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
            { scope: '', status: 'passed' },
            { scope: 'app', status: 'failed' },
        ]);
        expect(
            report.checks.flatMap(({ findings }) =>
                findings.map(({ file, line, column, rule, message }) => ({ file, line, column, rule, message })),
            ),
        ).toStrictEqual(STANDALONE_TYPESCRIPT_DIAGNOSTICS[level]);
        await Bun.write(join(sandbox.path, 'app/source.ts'), STANDALONE_CORRECTED_SOURCE);
        const corrected = await spawnGspot(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(
            (JSON.parse(corrected.stdout) as RunReport).checks.map(({ scope, status, findings }) => ({
                scope,
                status,
                findings,
            })),
        ).toStrictEqual([
            { scope: '', status: 'passed', findings: [] },
            { scope: 'app', status: 'passed', findings: [] },
        ]);
        for (const path of [
            'app/ambient.d.ts',
            'app/emitted/generated.ts',
            'app/vendor/dependency.ts',
            '.gspot/node_modules/@types/private/index.d.ts',
        ] as const)
            expect(await Bun.file(join(sandbox.path, path)).text()).toBe(STANDALONE_TYPESCRIPT_FILES[path]);
    },
);

test.each(['recommended', 'all'] as const)(
    '%s runs a covering ancestor compiler once across nested scopes',
    async (level) => {
        await using sandbox = await testdir();
        const authored = JSON.stringify(ANCESTOR_TYPESCRIPT_PROJECT);
        await createFileTree(sandbox.path, {
            ...ANCESTOR_TYPESCRIPT_FILES,
            'tsconfig.json': authored,
            'gspot.toml': buildPolicy(['typescript'], { level, tables: ANCESTOR_TYPESCRIPT_TABLES }),
        });
        await mkdir(join(sandbox.path, 'node_modules/.bin'), { recursive: true });
        await symlink(join(installedModules, 'typescript'), join(sandbox.path, 'node_modules/typescript'), 'dir');
        await symlink('../typescript/bin/tsc', join(sandbox.path, 'node_modules/.bin/tsc'));
        const session = await openSession(sandbox.path);
        using log = openOwnership(sandbox.path);
        writeGeneratedFiles(session, emitAll(session), log);
        const command = ['check', '--only', 'typescript/tsconfig', 'typescript/tsc', '--json'];
        const original = await spawnGspot(sandbox.path, command);
        expect(original.code, original.stdout + original.stderr).toBe(0);
        const report = JSON.parse(original.stdout) as RunReport;
        for (const check of ['typescript/tsconfig', 'typescript/tsc'])
            expect(
                report.checks.filter((entry) => entry.check === check).map(({ scope, status }) => ({ scope, status })),
            ).toStrictEqual([
                { scope: '', status: 'passed' },
                { scope: 'app', status: 'skipped' },
                { scope: 'app/deep', status: 'skipped' },
            ]);
        await Bun.write(join(sandbox.path, 'app/deep/source.ts'), 'export const deepValue: number = "wrong";\n');
        const failed = await spawnGspot(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
            { file: 'app/deep/source.ts', rule: 'TS2322', line: 1, column: 14 },
        ]);
        await Bun.write(join(sandbox.path, 'app/deep/source.ts'), ANCESTOR_TYPESCRIPT_FILES['app/deep/source.ts']);
        const corrected = await spawnGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'tsconfig.json')).text()).toBe(authored);
    },
);

test.each(['recommended', 'all'] as const)(
    '%s compiles covering ancestors once and checks child-only selections',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['typescript'], {
                level,
                tables: '[agent_rules]\nenabled = false\n[scope."app"]\nconfigurations = ["typescript"]',
            }),
            '.gitignore': '.gspot/\nnode_modules/\n',
            'tsconfig.json': VALID.replace('}}', '},"include":["root.ts","app/**/*.ts"]}'),
            'root.ts': 'export const total = 3;\n',
            'app/source.ts': 'export const active: boolean = 3;\n',
        });
        await mkdir(join(sandbox.path, 'node_modules/.bin'), { recursive: true });
        await symlink(join(installedModules, 'typescript'), join(sandbox.path, 'node_modules/typescript'), 'dir');
        await symlink('../typescript/bin/tsc', join(sandbox.path, 'node_modules/.bin/tsc'));
        const { mode } = await stat(join(sandbox.path, 'tsconfig.json'));
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const checked = await spawnGspot(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']);
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        const report = JSON.parse(checked.stdout) as RunReport;
        expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
            { scope: '', status: 'failed' },
            { scope: 'app', status: 'skipped' },
        ]);
        expect(
            report.checks.flatMap(({ findings }) => findings).map(({ file, rule }) => ({ file, rule })),
        ).toStrictEqual([{ file: 'app/source.ts', rule: 'TS2322' }]);
        const child = await spawnGspot(sandbox.path, ['check', 'app', '--only', 'typescript/tsc', '--json']);
        expect(child.code, child.stdout + child.stderr).toBe(1);
        expect(
            (JSON.parse(child.stdout) as RunReport).checks.map(({ scope, status }) => ({ scope, status })),
        ).toStrictEqual([{ scope: 'app', status: 'failed' }]);
        commitAll(sandbox.path);
        await Bun.write(join(sandbox.path, 'app/source.ts'), 'export const active: boolean = "staged";\n');
        gitOutput(sandbox.path, ['add', 'app/source.ts']);
        await Bun.write(join(sandbox.path, 'app/source.ts'), 'export const active: boolean = true;\n');
        const staged = await spawnGspot(sandbox.path, ['check', '--staged', '--only', 'typescript/tsc', '--json']);
        expect(staged.code, staged.stdout + staged.stderr).toBe(1);
        const snapshot = JSON.parse(staged.stdout) as RunReport;
        expect(snapshot.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
            { scope: 'app', status: 'failed' },
        ]);
        expect(
            snapshot.checks.flatMap(({ findings }) => findings).map(({ file, rule }) => ({ file, rule })),
        ).toStrictEqual([{ file: 'app/source.ts', rule: 'TS2322' }]);

        const corrected = await spawnGspot(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(
            (JSON.parse(corrected.stdout) as RunReport).checks.map(({ scope, status }) => ({ scope, status })),
        ).toStrictEqual([
            { scope: '', status: 'passed' },
            { scope: 'app', status: 'skipped' },
        ]);
        expect(await stat(join(sandbox.path, 'tsconfig.json'))).toMatchObject({ mode });
        expect(await Bun.file(join(sandbox.path, 'tsconfig.json')).text()).toBe(
            VALID.replace('}}', '},"include":["root.ts","app/**/*.ts"]}'),
        );
    },
);

test.skipIf(!isPosix).each(['recommended', 'all'] as const)(
    '%s staged standalone TypeScript checks index sources without working-tree fixes',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...STANDALONE_TYPESCRIPT_FILES,
            '.gitignore': '.gspot/\nnode_modules/\n',
            'gspot.toml': buildPolicy(['typescript'], { level, tables: STANDALONE_TYPESCRIPT_TABLES }),
            'app/source.ts': STANDALONE_CORRECTED_SOURCE,
        });
        await cp(join(installedModules, 'typescript'), join(sandbox.path, '.gspot/node_modules/typescript'), {
            recursive: true,
            dereference: true,
        });
        await mkdir(join(sandbox.path, '.gspot/node_modules/.bin'));
        await symlink('../typescript/bin/tsc', join(sandbox.path, '.gspot/node_modules/.bin/tsc'));
        commitAll(sandbox.path);
        await Bun.write(join(sandbox.path, 'app/source.ts'), STANDALONE_TYPESCRIPT_FILES['app/source.ts']);
        gitOutput(sandbox.path, ['add', 'app/source.ts']);
        await Bun.write(join(sandbox.path, 'app/source.ts'), STANDALONE_CORRECTED_SOURCE);
        const staged = await spawnGspot(sandbox.path, ['check', '--staged', '--only', 'typescript/tsc', '--json']);
        expect(staged.code, staged.stdout + staged.stderr).toBe(1);
        const report = JSON.parse(staged.stdout) as RunReport;
        expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
            { scope: 'app', status: 'failed' },
        ]);
        expect(
            report.checks.flatMap(({ findings }) =>
                findings.map(({ file, line, column, rule, message }) => ({ file, line, column, rule, message })),
            ),
        ).toStrictEqual(STANDALONE_TYPESCRIPT_DIAGNOSTICS[level]);
        expect(await Bun.file(join(sandbox.path, 'app/source.ts')).text()).toBe(STANDALONE_CORRECTED_SOURCE);
    },
);
