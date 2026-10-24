import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import type { TypecheckResult } from '#tests/types/reports.ts';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { linkTypescript } from '#tests/setup/sandboxes/node-modules.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { commitAll, runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';
import { stat, chmod, readdir, symlink, readFile, writeFile } from 'node:fs/promises';
import { spawnGspot, runGspotStep, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { applySandboxChanges, buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';

import {
    OUTDIR_CASES,
    AUTHORED_TSCONFIG,
    SOLUTION_PROJECT_TREE,
    IMPLICIT_PROJECT_TREE,
    REFERENCE_BUILD_FILES,
    IMPLICIT_PROJECT_FILES,
    REFERENCE_BUILD_SETTINGS,
    TYPESCRIPT_PROJECTS_SANDBOX,
} from '#tests/config/integration/checks/language/typescript/projects.ts';

async function runTscCheck(root: string): Promise<TypecheckResult> {
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'typescript/tsc', '--json']));
    const output = result.stdout + result.stderr;
    if (result.code === 2) return { code: result.code, output, findings: [] };
    const findings = result.report.checks.flatMap((check) => check.findings);
    return { code: result.code, output, findings };
}

const installedSandbox = shareInstalledSandbox(TYPESCRIPT_PROJECTS_SANDBOX);

test('typescript/tsc reports a type error in your tsconfig.json project without files or include, and leaves tsconfig.json unchanged', async () => {
    const { root } = installedSandbox();

    await using _sourceChange = await applySandboxChanges(
        installedSandbox(),
        buildSandboxChanges(TYPESCRIPT_PROJECTS_SANDBOX.files, IMPLICIT_PROJECT_TREE),
    );
    commitAll(root);
    const failed = await runTscCheck(root);
    expect(failed.code, failed.output).toBe(1);
    expect(failed.findings).toMatchObject([{ file: 'src/broken.ts', rule: 'TS2322' }]);
    await writeFile(join(root, 'src/broken.ts'), IMPLICIT_PROJECT_FILES['src/clean.ts']);
    const clean = await runTscCheck(root);
    expect(clean.code, clean.output).toBe(0);
    expect(await readFile(join(root, 'tsconfig.json'), 'utf8')).toBe(IMPLICIT_PROJECT_FILES['tsconfig.json']);
});

test('typescript/tsc checks both projects of a solution and writes no build output', async () => {
    const { root } = installedSandbox();

    await using _sourceChange = await applySandboxChanges(
        installedSandbox(),
        buildSandboxChanges(TYPESCRIPT_PROJECTS_SANDBOX.files, SOLUTION_PROJECT_TREE),
    );
    commitAll(root);
    const failed = await runTscCheck(root);
    expect(failed.code, failed.output).toBe(1);
    expect(failed.findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'orders/order.ts', line: 1, rule: 'TS2322' },
        { file: 'users/user.ts', line: 1, rule: 'TS2322' },
    ]);
    await writeFile(join(root, 'orders/order.ts'), 'export const total: number = 3;');
    await writeFile(
        join(root, 'users/user.ts'),
        'import { total } from "../orders/order.js"; export const active: boolean = total > 0;',
    );
    const clean = await runTscCheck(root);
    expect(clean.code, clean.output).toBe(0);
    const output = await Promise.all(
        ['orders', 'users'].map((folder) => readdir(join(root, folder), { recursive: true })),
    );
    expect(output.flat().filter((path) => /\.(?:tsbuildinfo|js|d\.ts)$/u.test(path))).toStrictEqual([]);
});

test.each([...LEVELS])(
    'typescript/tsc at level %s keeps your tsconfig.json in a scope and reports its type errors',
    async (level) => {
        const { root } = installedSandbox();
        const scope = 'apps/web';
        const authored = AUTHORED_TSCONFIG.replace('%BUILD_INFO%', () =>
            JSON.stringify(join(root, scope, 'build/cache.tsbuildinfo')),
        );
        const sourceFiles = {
            'gspot.toml': buildSandboxSettings(['javascript'], {
                level,
                scopes: [{ path: scope, configurations: ['typescript'] }],
            }),
            '.gitignore': `node_modules/\n${DOT_GSPOT}/\n`,
            [`${scope}/tsconfig.json`]: authored,
            [`${scope}/src/main.ts`]: 'export const echo: number = "wrong";\n',
            [`${scope}/build/cache.tsbuildinfo`]: 'authored metadata\n',
        };
        await using _sourceChange = await applySandboxChanges(
            installedSandbox(),
            buildSandboxChanges(TYPESCRIPT_PROJECTS_SANDBOX.files, sourceFiles),
        );
        await chmod(join(root, scope, 'tsconfig.json'), 0o640);
        const failed = await runTscCheck(root);
        expect(failed.code, failed.output).toBe(1);
        expect(failed.findings).toMatchObject([
            { check: 'typescript/tsc', file: `${scope}/src/main.ts`, rule: 'TS2322', line: 1, column: 14 },
        ]);
        await writeFile(
            join(root, scope, 'src/main.ts'),
            'export function echo(value: string) { return value; }\nexport const first: number = "wrong";\n',
        );
        const second = await runTscCheck(root);
        expect(second.code, second.output).toBe(1);
        expect(second.findings).toMatchObject([
            { check: 'typescript/tsc', file: `${scope}/src/main.ts`, rule: 'TS2322', line: 2, column: 14 },
        ]);
        await writeFile(
            join(root, scope, 'src/main.ts'),
            'export function echo(value: string) { return value; }\nexport const first: number = 1;\n',
        );
        const corrected = await runTscCheck(root);
        expect(corrected.code, corrected.output).toBe(0);
        expect(await readFile(join(root, scope, 'tsconfig.json'), 'utf8')).toBe(authored);
        const { mode } = await stat(join(root, scope, 'tsconfig.json'));
        expect(mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
        expect(await readFile(join(root, scope, 'build/cache.tsbuildinfo'), 'utf8')).toBe('authored metadata\n');
    },
);

test.each([...OUTDIR_CASES])('$name', async ({ kind }) => {
    await using sandbox = await testdir();
    runGitStep(sandbox.path, ['init', '--quiet']);
    await using outside = await testdir({ 'value.js': 'authored output\n' });
    runGitStep(outside.path, ['init', '--quiet']);

    await linkTypescript(outside.path);
    const outsideFiles = await readdir(outside.path);
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        '.gitignore': `node_modules\n${DOT_GSPOT}\n`,
        'tsconfig.json': '{"files":[],"references":[{"path":"./app"}]}',
        'app/tsconfig.json': JSON.stringify({
            compilerOptions: {
                composite: true,
                types: [],
                outDir: kind === 'absolute' ? outside.path : '../node_modules',
            },
            include: ['*.ts'],
        }),
        'app/value.ts': 'export const count = 1;\n',
    });
    await (kind === 'symlink'
        ? symlink(outside.path, join(sandbox.path, 'node_modules'), 'dir')
        : linkTypescript(join(sandbox.path, 'node_modules')));
    commitAll(sandbox.path);
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['apply']);
    const checked = await runTscCheck(sandbox.path);
    expect(checked.code, checked.output).toBe(0);
    expect(await readdir(outside.path)).toStrictEqual(outsideFiles);
    expect(await readFile(join(outside.path, 'value.js'), 'utf8')).toBe('authored output\n');
    await writeFile(
        join(sandbox.path, 'app/tsconfig.json'),
        JSON.stringify({
            compilerOptions: { composite: true, types: [], outDir: './dist' },
            include: ['*.ts'],
        }),
    );
    const corrected = await runTscCheck(sandbox.path);
    expect(corrected.code, corrected.output).toBe(0);
    expect(await readFile(join(outside.path, 'value.js'), 'utf8')).toBe('authored output\n');
    expect(await readdir(outside.path)).toStrictEqual(outsideFiles);
    const files = await readdir(join(sandbox.path, 'app'));
    expect(files.toSorted((left, right) => left.localeCompare(right))).toStrictEqual(['tsconfig.json', 'value.ts']);
});

test('typescript/tsc builds a referenced project with its imported declarations and extended config and ignores other folders', async () => {
    await using sandbox = await createGitSandbox({
        ...REFERENCE_BUILD_FILES,
        'gspot.toml': buildSandboxSettings(['typescript'], REFERENCE_BUILD_SETTINGS),
    });
    await writeFile(
        join(sandbox.path, 'tsconfig.json'),
        JSON.stringify({ files: [], references: [{ path: join(sandbox.path, 'app') }] }),
    );
    await writeFile(
        join(sandbox.path, 'app/tsconfig.json'),
        JSON.stringify({ extends: join(sandbox.path, 'config/base.json'), include: ['src/**/*.ts'] }),
    );
    await linkTypescript(join(sandbox.path, 'node_modules'));
    commitAll(sandbox.path);
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const failed = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        failed.report.checks.map(({ scope, status, findings }) => ({
            scope,
            status,
            findings: findings.map(({ file, rule }) => ({ file, rule })),
        })),
    ).toStrictEqual([
        { scope: '', status: 'passed', findings: [] },
        { scope: 'app', status: 'failed', findings: [{ file: 'app/src/main.ts', rule: 'TS2322' }] },
        { scope: 'neighbor', status: 'failed', findings: [{ file: 'neighbor/source.ts', rule: 'TS2322' }] },
    ]);
    expect(await readFile(join(sandbox.path, 'app/src/main.ts'), 'utf8')).toBe(
        REFERENCE_BUILD_FILES['app/src/main.ts'],
    );
    expect(await isOnDisk(join(sandbox.path, 'app/src/main.js'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, 'app/tsconfig.tsbuildinfo'))).toBe(false);
    await writeFile(
        join(sandbox.path, 'app/src/main.ts'),
        REFERENCE_BUILD_FILES['app/src/main.ts'].replace('"wrong"', '8080'),
    );
    const corrected = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(1);
    expect(
        corrected.report.checks.flatMap(({ findings }) => findings).map(({ file, rule }) => ({ file, rule })),
    ).toStrictEqual([{ file: 'neighbor/source.ts', rule: 'TS2322' }]);
});
