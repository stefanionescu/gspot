import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { installCompiler } from '#tests/setup/install.ts';
import { stat, readFile, writeFile } from 'node:fs/promises';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';

import {
    STRICT_TSCONFIG_TEXT,
    ANCESTOR_SCOPE_SETTINGS,
    STANDALONE_FIXED_SOURCE,
    ANCESTOR_TYPESCRIPT_FILES,
    ANCESTOR_TYPESCRIPT_PROJECT,
    STANDALONE_TYPESCRIPT_FILES,
    STANDALONE_TYPESCRIPT_FINDINGS,
    STANDALONE_TYPESCRIPT_SETTINGS,
} from '#tests/data/checks/typescript/projects.ts';

const installedSandbox = registerSharedSandbox({
    install: false,
    configurations: ['typescript'],
    level: 'all',
    files: { 'package.json': '{"private":true}\n' },
});

/** The standalone sources for one level; .gitignore keeps tool declarations out of the source changes. */
function buildStandaloneSources(level: (typeof LEVELS)[number]): Record<string, string> {
    return {
        ...STANDALONE_TYPESCRIPT_FILES,
        '.gitignore': '.gspot/\nnode_modules/\n',
        'gspot.toml': buildSandboxSettings(['typescript'], { level, tables: STANDALONE_TYPESCRIPT_SETTINGS }),
    };
}

test.each([...LEVELS])(
    "typescript/tsc at level %s checks each scope alone and keeps your declarations, without gspot's own @types",
    async (level) => {
        const { root } = installedSandbox();
        await using _sourceChange = await updateSandbox(installedSandbox(), {
            check: '',
            files: buildStandaloneSources(level),
        });
        const broken = parseCheckReport(await spawnGspot(root, ['check', '--only', 'typescript/tsc', '--json']));
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        const report = broken.report;
        expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
            { scope: '', status: 'passed' },
            { scope: 'app', status: 'failed' },
        ]);
        expect(report.checks.flatMap(({ findings }) => findings)).toStrictEqual(
            STANDALONE_TYPESCRIPT_FINDINGS[level].map((finding) => matchFields(finding)),
        );
        await writeFile(join(root, 'app/source.ts'), STANDALONE_FIXED_SOURCE);
        const corrected = parseCheckReport(await spawnGspot(root, ['check', '--only', 'typescript/tsc', '--json']));
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toStrictEqual([
            matchFields({ scope: '', status: 'passed', findings: [] }),
            matchFields({ scope: 'app', status: 'passed', findings: [] }),
        ]);
        for (const path of [
            'app/ambient.d.ts',
            'app/emitted/generated.ts',
            'app/vendor/dependency.ts',
            '.gspot/node_modules/@types/private/index.d.ts',
        ] as const)
            expect(await readFile(join(root, path), 'utf8')).toBe(STANDALONE_TYPESCRIPT_FILES[path]);
    },
);

test('typescript/tsc runs a covering parent tsconfig once for nested scopes', async () => {
    await using sandbox = await testdir();
    const authored = JSON.stringify(ANCESTOR_TYPESCRIPT_PROJECT);
    await createFileTree(sandbox.path, {
        ...ANCESTOR_TYPESCRIPT_FILES,
        'tsconfig.json': authored,
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all', tables: ANCESTOR_SCOPE_SETTINGS }),
    });
    await installCompiler(sandbox.path);
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const command = ['check', '--only', 'typescript/tsconfig,typescript/tsc', '--json'];
    const original = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(original.code, original.stdout + original.stderr).toBe(0);
    const report = original.report;
    for (const check of ['typescript/tsconfig', 'typescript/tsc'])
        expect(
            report.checks.filter((entry) => entry.check === check).map(({ scope, status }) => ({ scope, status })),
        ).toStrictEqual([
            { scope: '', status: 'passed' },
            { scope: 'app', status: 'skipped' },
            { scope: 'app/deep', status: 'skipped' },
        ]);
    await writeFile(join(sandbox.path, 'app/deep/source.ts'), 'export const deepValue: number = "wrong";\n');
    const failed = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'app/deep/source.ts', rule: 'TS2322', line: 1, column: 14 },
    ]);
    await writeFile(join(sandbox.path, 'app/deep/source.ts'), ANCESTOR_TYPESCRIPT_FILES['app/deep/source.ts']);
    const corrected = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'tsconfig.json'), 'utf8')).toBe(authored);
});

test('typescript/tsc checks a scope through the parent tsconfig, alone when named, and in staged files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['typescript'] }],
        }),
        '.gitignore': '.gspot/\nnode_modules/\n',
        'tsconfig.json': STRICT_TSCONFIG_TEXT.replace('}}', '},"include":["root.ts","app/**/*.ts"]}'),
        'root.ts': 'export const total = 3;\n',
        'app/source.ts': 'export const active: boolean = 3;\n',
    });

    await installCompiler(sandbox.path);
    const selection = ['--only', 'typescript/tsc', '--json'];
    const { mode } = await stat(join(sandbox.path, 'tsconfig.json'));
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const checked = parseCheckReport(await spawnGspot(sandbox.path, ['check', ...selection]));
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = checked.report;
    expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: 'failed' },
        { scope: 'app', status: 'skipped' },
    ]);
    expect(report.checks.flatMap(({ findings }) => findings).map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'app/source.ts', rule: 'TS2322' },
    ]);
    const child = parseCheckReport(await spawnGspot(sandbox.path, ['check', 'app', ...selection]));
    expect(child.code, child.stdout + child.stderr).toBe(1);
    expect(child.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: 'skipped' },
        { scope: 'app', status: 'failed' },
    ]);
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'app/source.ts'), 'export const active: boolean = "staged";\n');
    readGitOutput(sandbox.path, ['add', 'app/source.ts']);
    await writeFile(join(sandbox.path, 'app/source.ts'), 'export const active: boolean = true;\n');
    const staged = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--staged', ...selection]));
    expect(staged.code, staged.stdout + staged.stderr).toBe(1);
    const snapshot = staged.report;
    expect(snapshot.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: 'skipped' },
        { scope: 'app', status: 'failed' },
    ]);
    expect(snapshot.checks.flatMap(({ findings }) => findings).map(({ file, rule }) => ({ file, rule }))).toStrictEqual(
        [{ file: 'app/source.ts', rule: 'TS2322' }],
    );

    const corrected = parseCheckReport(await spawnGspot(sandbox.path, ['check', ...selection]));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: 'passed' },
        { scope: 'app', status: 'skipped' },
    ]);
    expect(await stat(join(sandbox.path, 'tsconfig.json'))).toMatchObject({ mode });
    expect(await readFile(join(sandbox.path, 'tsconfig.json'), 'utf8')).toBe(
        STRICT_TSCONFIG_TEXT.replace('}}', '},"include":["root.ts","app/**/*.ts"]}'),
    );
});
