import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { stat } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { openWriter } from '#cli/ownership/writer.ts';
import { openSession } from '#cli/commands/session.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { generate } from '#cli/generation/generate.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { commitAll, gitOutput } from '#tests/setup/git.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { STRICT_TSCONFIG_TEXT } from '#tests/config/typescript.ts';
import { installCompiler, installToolProjects } from '#tests/setup/install.ts';

import {
    ANCESTOR_SCOPE_SETTINGS,
    STANDALONE_FIXED_SOURCE,
    ANCESTOR_TYPESCRIPT_FILES,
    ANCESTOR_TYPESCRIPT_PROJECT,
    STANDALONE_TYPESCRIPT_FILES,
    STANDALONE_TYPESCRIPT_SETTINGS,
    STANDALONE_TYPESCRIPT_DIAGNOSTICS,
} from '#tests/config/tsconfig.ts';

test.each([...LEVELS])(
    "typescript/tsc at level %s checks each scope alone and keeps your declarations, without gspot's own @types",
    async (level) => {
        await using sandbox = await testdir();
        const { '.gspot/node_modules/@types/private/index.d.ts': privateTypes, ...authoredFiles } =
            STANDALONE_TYPESCRIPT_FILES;
        await createFileTree(sandbox.path, {
            ...authoredFiles,
            '.gitignore': '.gspot/\nnode_modules/\n',
            'gspot.toml': settingsText(['typescript'], { level, tables: STANDALONE_TYPESCRIPT_SETTINGS }),
        });
        await installToolProjects(sandbox.path);
        await createFileTree(sandbox.path, {
            '.gspot/node_modules/@types/private/index.d.ts': privateTypes,
        });
        const session = await openSession(sandbox.path);
        using log = openWriter(sandbox.path);
        writeGeneratedFiles(session, generate(session), log);
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
        ).toStrictEqual([...STANDALONE_TYPESCRIPT_DIAGNOSTICS[level]]);
        await Bun.write(join(sandbox.path, 'app/source.ts'), STANDALONE_FIXED_SOURCE);
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

test('typescript/tsc runs a covering parent tsconfig once for nested scopes', async () => {
    await using sandbox = await testdir();
    const authored = JSON.stringify(ANCESTOR_TYPESCRIPT_PROJECT);
    await createFileTree(sandbox.path, {
        ...ANCESTOR_TYPESCRIPT_FILES,
        'tsconfig.json': authored,
        'gspot.toml': settingsText(['typescript'], { level: 'all', tables: ANCESTOR_SCOPE_SETTINGS }),
    });
    await installCompiler(sandbox.path);
    const session = await openSession(sandbox.path);
    using log = openWriter(sandbox.path);
    writeGeneratedFiles(session, generate(session), log);
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
});

test('typescript/tsc checks a scope through the parent tsconfig, alone when named, and in staged files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['typescript'], {
            level: 'all',
            tables: `[[scope]]
path = "app"

configurations = ["typescript"]`,
        }),
        '.gitignore': '.gspot/\nnode_modules/\n',
        'tsconfig.json': STRICT_TSCONFIG_TEXT.replace('}}', '},"include":["root.ts","app/**/*.ts"]}'),
        'root.ts': 'export const total = 3;\n',
        'app/source.ts': 'export const active: boolean = 3;\n',
    });
    await installCompiler(sandbox.path);
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
    expect(report.checks.flatMap(({ findings }) => findings).map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'app/source.ts', rule: 'TS2322' },
    ]);
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
    expect(snapshot.checks.flatMap(({ findings }) => findings).map(({ file, rule }) => ({ file, rule }))).toStrictEqual(
        [{ file: 'app/source.ts', rule: 'TS2322' }],
    );

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
        STRICT_TSCONFIG_TEXT.replace('}}', '},"include":["root.ts","app/**/*.ts"]}'),
    );
});

test.each([...LEVELS])('typescript/tsc at level %s checks staged files, not working-tree fixes', async (level) => {
    await using sandbox = await testdir();
    const { '.gspot/node_modules/@types/private/index.d.ts': privateTypes, ...authoredFiles } =
        STANDALONE_TYPESCRIPT_FILES;
    await createFileTree(sandbox.path, {
        ...authoredFiles,
        '.gitignore': '.gspot/\nnode_modules/\n',
        'gspot.toml': settingsText(['typescript'], { level, tables: STANDALONE_TYPESCRIPT_SETTINGS }),
        'app/source.ts': STANDALONE_FIXED_SOURCE,
    });
    await installToolProjects(sandbox.path);
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/@types/private/index.d.ts': privateTypes,
    });
    commitAll(sandbox.path);
    await Bun.write(join(sandbox.path, 'app/source.ts'), STANDALONE_TYPESCRIPT_FILES['app/source.ts']);
    gitOutput(sandbox.path, ['add', 'app/source.ts']);
    await Bun.write(join(sandbox.path, 'app/source.ts'), STANDALONE_FIXED_SOURCE);
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
    ).toStrictEqual([...STANDALONE_TYPESCRIPT_DIAGNOSTICS[level]]);
    expect(await Bun.file(join(sandbox.path, 'app/source.ts')).text()).toBe(STANDALONE_FIXED_SOURCE);
});
