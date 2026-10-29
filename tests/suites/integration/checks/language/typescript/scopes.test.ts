import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { APP_SCOPE_SETTINGS } from '#tests/config/toml.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { stat, readFile, writeFile } from 'node:fs/promises';
import { changeSandbox } from '#tests/setup/sandboxes/changes.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { linkTypescript } from '#tests/setup/sandboxes/node-modules.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { STRICT_TSCONFIG_TEXT, STRICT_COMPILER_OPTIONS } from '#tests/config/typescript.ts';
import { spawnGspot, runGspotStep, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    KEPT_DECLARATION_FILES,
    ANCESTOR_TYPESCRIPT_FILES,
    TYPESCRIPT_SCOPES_SANDBOX,
    STANDALONE_TYPESCRIPT_FILES,
    STANDALONE_TYPESCRIPT_FINDINGS,
} from '#tests/config/integration/checks/language/typescript/scopes.ts';

const installedSandbox = shareInstalledSandbox(TYPESCRIPT_SCOPES_SANDBOX);

test.each([...LEVELS])(
    "typescript/tsc at level %s checks each scope alone and keeps the authored declarations, without gspot's own @types",
    async (level) => {
        const { root } = installedSandbox();
        await using _sourceChange = await changeSandbox(installedSandbox(), {
            files: {
                ...STANDALONE_TYPESCRIPT_FILES,
                '.gitignore': `${GSPOT_FOLDER}/\nnode_modules/\n`,
                'gspot.toml': buildSandboxSettings(['typescript'], {
                    level,
                    tables: APP_SCOPE_SETTINGS,
                }),
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
        await writeFile(
            join(root, 'app/source.ts'),
            `export const value = 1;
export const project = acceptedNumber;
export function select(flag: boolean) { return flag ? 1 : 0; }
`,
        );
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
    const authored = JSON.stringify({
        compilerOptions: STRICT_COMPILER_OPTIONS,
        include: ['source.ts', 'app/**/*.ts'],
    });
    await using sandbox = await createGitSandbox({
        ...ANCESTOR_TYPESCRIPT_FILES,
        'tsconfig.json': authored,
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [
                { path: 'app', configurations: ['typescript'] },
                { path: 'app/deep', configurations: ['typescript'] },
            ],
        }),
    });
    await linkTypescript(join(sandbox.path, 'node_modules'));
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['apply']);
    const command = ['check', '--only', 'typescript/tsconfig,typescript/tsc', '--json'];
    const clean = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
    for (const check of ['typescript/tsconfig', 'typescript/tsc'])
        expect(
            clean.report.checks.filter((each) => each.check === check).map(({ scope, status }) => ({ scope, status })),
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
        '.gitignore': `${GSPOT_FOLDER}/\nnode_modules/\n`,
        'tsconfig.json': tsconfig,
        'root.ts': 'export const total = 3;\n',
        'app/source.ts': 'export const active: boolean = 3;\n',
    });

    await linkTypescript(join(sandbox.path, 'node_modules'));
    const selection = ['--only', 'typescript/tsc', '--json'];
    const { mode } = await stat(join(sandbox.path, 'tsconfig.json'));
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['apply']);
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
