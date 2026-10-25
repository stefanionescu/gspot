import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { stat, readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { linkTypescript } from '#tests/setup/sandboxes/node-modules.ts';
import { changeAppliedSandbox } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { STRICT_TSCONFIG_TEXT } from '#tests/config/checks/language/typescript.ts';
import { commitAll, runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';
import { spawnGspot, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    ANCESTOR_SCOPE_TABLES,
    KEPT_DECLARATION_FILES,
    ANCESTOR_TYPESCRIPT_FILES,
    TYPESCRIPT_SCOPES_SANDBOX,
    ANCESTOR_TYPESCRIPT_PROJECT,
    STANDALONE_CORRECTED_SOURCE,
    STANDALONE_TYPESCRIPT_FILES,
    STANDALONE_TYPESCRIPT_TABLES,
    STANDALONE_TYPESCRIPT_FINDINGS,
} from '#tests/config/integration/checks/language/typescript/scopes.ts';

const installedSandbox = shareInstalledSandbox(TYPESCRIPT_SCOPES_SANDBOX);

test.each([...LEVELS])(
    "typescript/tsc at level %s checks each scope alone and keeps your declarations, without gspot's own @types",
    async (level) => {
        const { root } = installedSandbox();
        await using _sourceChange = await changeAppliedSandbox(installedSandbox(), {
            files: {
                ...STANDALONE_TYPESCRIPT_FILES,
                '.gitignore': `${DOT_GSPOT}/\nnode_modules/\n`,
                'gspot.toml': buildSandboxSettings(['typescript'], { level, tables: STANDALONE_TYPESCRIPT_TABLES }),
            },
        });
        const broken = parseCheckReport(await spawnGspot(root, ['check', '--only', 'typescript/tsc', '--json']));
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        expect(broken.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
            { scope: '', status: 'passed' },
            { scope: 'app', status: 'failed' },
        ]);
        expect(broken.report.checks.flatMap(({ findings }) => findings)).toStrictEqual(
            STANDALONE_TYPESCRIPT_FINDINGS[level].map((finding) => matchFields(finding)),
        );
        await writeFile(join(root, 'app/source.ts'), STANDALONE_CORRECTED_SOURCE);
        const corrected = parseCheckReport(await spawnGspot(root, ['check', '--only', 'typescript/tsc', '--json']));
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toStrictEqual([
            matchFields({ scope: '', status: 'passed', findings: [] }),
            matchFields({ scope: 'app', status: 'passed', findings: [] }),
        ]);
        for (const path of KEPT_DECLARATION_FILES)
            expect(await readFile(join(root, path), 'utf8')).toBe(STANDALONE_TYPESCRIPT_FILES[path]);
    },
);

test('typescript/tsc runs a covering parent tsconfig once for nested scopes', async () => {
    await using sandbox = await testdir();
    runGitStep(sandbox.path, ['init', '--quiet']);
    const authored = JSON.stringify(ANCESTOR_TYPESCRIPT_PROJECT);
    await createFileTree(sandbox.path, {
        ...ANCESTOR_TYPESCRIPT_FILES,
        'tsconfig.json': authored,
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all', tables: ANCESTOR_SCOPE_TABLES }),
    });
    await linkTypescript(join(sandbox.path, 'node_modules'));
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const command = ['check', '--only', 'typescript/tsconfig,typescript/tsc', '--json'];
    const previous = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(previous.code, previous.stdout + previous.stderr).toBe(0);
    for (const check of ['typescript/tsconfig', 'typescript/tsc'])
        expect(
            previous.report.checks
                .filter((each) => each.check === check)
                .map(({ scope, status }) => ({ scope, status })),
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
    const tsconfig = STRICT_TSCONFIG_TEXT.replace('}}', '},"include":["root.ts","app/**/*.ts"]}');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['typescript'] }],
        }),
        '.gitignore': `${DOT_GSPOT}/\nnode_modules/\n`,
        'tsconfig.json': tsconfig,
        'root.ts': 'export const total = 3;\n',
        'app/source.ts': 'export const active: boolean = 3;\n',
    });

    await linkTypescript(join(sandbox.path, 'node_modules'));
    const selection = ['--only', 'typescript/tsc', '--json'];
    const { mode } = await stat(join(sandbox.path, 'tsconfig.json'));
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const checked = parseCheckReport(await spawnGspot(sandbox.path, ['check', ...selection]));
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(checked.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: 'failed' },
        { scope: 'app', status: 'skipped' },
    ]);
    expect(listFindingRows(checked.report)).toStrictEqual([{ file: 'app/source.ts', line: 1, rule: 'TS2322' }]);
    const child = parseCheckReport(await spawnGspot(sandbox.path, ['check', 'app', ...selection]));
    expect(child.code, child.stdout + child.stderr).toBe(1);
    expect(child.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: 'skipped' },
        { scope: 'app', status: 'failed' },
    ]);
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'app/source.ts'), 'export const active: boolean = "staged";\n');
    runGitStep(sandbox.path, ['add', 'app/source.ts']);
    await writeFile(join(sandbox.path, 'app/source.ts'), 'export const active: boolean = true;\n');
    const staged = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--staged', ...selection]));
    expect(staged.code, staged.stdout + staged.stderr).toBe(1);
    expect(staged.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: 'skipped' },
        { scope: 'app', status: 'failed' },
    ]);
    expect(listFindingRows(staged.report)).toStrictEqual([{ file: 'app/source.ts', line: 1, rule: 'TS2322' }]);
    const corrected = parseCheckReport(await spawnGspot(sandbox.path, ['check', ...selection]));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: 'passed' },
        { scope: 'app', status: 'skipped' },
    ]);
    expect(await stat(join(sandbox.path, 'tsconfig.json'))).toMatchObject({ mode });
    expect(await readFile(join(sandbox.path, 'tsconfig.json'), 'utf8')).toBe(tsconfig);
});
