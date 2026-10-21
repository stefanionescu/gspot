import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import type { TypecheckResult } from '#tests/types/tool-output.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { runSandboxStep, installCompiler } from '#tests/setup/install.ts';
import { applySandboxChanges, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { stat, chmod, readdir, symlink, readFile, writeFile } from 'node:fs/promises';

import {
    OUTDIR_CASES,
    YOUR_TSCONFIG,
    IMPLICIT_PROJECT_TREE,
    SOLUTION_PROJECT_TREE,
    REFERENCE_BUILD_FILES,
    IMPLICIT_PROJECT_FILES,
    TYPESCRIPT_PROJECTS_SANDBOX,
} from '#tests/data/checks/typescript/projects.ts';

// The installed TypeScript compiler checks project references, authored compiler settings, and build output bounds.
// Runs the TypeScript check and returns its exit code, output, and findings.
async function checkTypes(root: string): Promise<TypecheckResult> {
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'typescript/tsc', '--json']));
    const output = result.stdout + result.stderr;
    if (result.code === 2) return { code: result.code, output, findings: [] };
    const findings = result.report.checks.flatMap((check) => check.findings);
    return { code: result.code, output, findings };
}

const installedSandbox = registerSharedSandbox(TYPESCRIPT_PROJECTS_SANDBOX);

test('typescript/tsc checks an authored project without files or include', async () => {
    const { root } = installedSandbox();

    await using _sourceChange = await applySandboxChanges(
        installedSandbox(),
        buildSandboxChanges(TYPESCRIPT_PROJECTS_SANDBOX.files, IMPLICIT_PROJECT_TREE),
    );
    commitAll(root);
    const failed = await checkTypes(root);
    expect(failed.code, failed.output).toBe(1);
    expect(failed.findings).toMatchObject([{ file: 'src/broken.ts', rule: 'TS2322' }]);
    await writeFile(join(root, 'src/broken.ts'), IMPLICIT_PROJECT_FILES['src/clean.ts']);
    const clean = await checkTypes(root);
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
    const failed = await checkTypes(root);
    expect(failed.code, failed.output).toBe(1);
    expect(
        failed.findings
            .filter((finding) => finding.rule === 'TS2322')
            .map((finding) => finding.file)
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['orders/order.ts', 'users/user.ts']);
    await writeFile(join(root, 'orders/order.ts'), 'export const total: number = 3;');
    await writeFile(
        join(root, 'users/user.ts'),
        'import { total } from "../orders/order.js"; export const active: boolean = total > 0;',
    );
    const clean = await checkTypes(root);
    expect(clean.code, clean.output).toBe(0);
    const output = await Promise.all(
        ['orders', 'users'].map((folder) => readdir(join(root, folder), { recursive: true })),
    );
    expect(output.flat().filter((path) => /\.(?:tsbuildinfo|js|d\.ts)$/u.test(path))).toStrictEqual([]);
});

test.each([...LEVELS])(
    'typescript/tsc keeps your tsconfig.json in a scope and reports type errors at both levels',
    async (level) => {
        const { root } = installedSandbox();
        const scope = 'apps/web';
        const scopeTable = `[[scope]]
path = "${scope}"
configurations = ["typescript"]
`;
        const authored = YOUR_TSCONFIG.replace(
            '%BUILD_INFO%',
            JSON.stringify(join(root, scope, 'build/cache.tsbuildinfo')),
        );
        const sourceFiles = {
            'gspot.toml': buildSandboxSettings(['javascript'], { tables: scopeTable, level }),
            '.gitignore': 'node_modules/\n.gspot/\n',
            [`${scope}/tsconfig.json`]: authored,
            [`${scope}/src/main.ts`]: 'export const echo: number = "wrong";\n',
            [`${scope}/build/cache.tsbuildinfo`]: 'authored metadata\n',
        };
        await using _sourceChange = await applySandboxChanges(
            installedSandbox(),
            buildSandboxChanges(TYPESCRIPT_PROJECTS_SANDBOX.files, sourceFiles),
        );
        await chmod(join(root, scope, 'tsconfig.json'), 0o640);
        const failed = await checkTypes(root);
        expect(failed.code, failed.output).toBe(1);
        expect(failed.findings).toMatchObject([
            { check: 'typescript/tsc', file: `${scope}/src/main.ts`, rule: 'TS2322', line: 1, column: 14 },
        ]);
        await writeFile(
            join(root, scope, 'src/main.ts'),
            'export function echo(value: string) { return value; }\nexport const first: number = "wrong";\n',
        );
        const second = await checkTypes(root);
        expect(second.code, second.output).toBe(1);
        expect(second.findings).toMatchObject([
            { check: 'typescript/tsc', file: `${scope}/src/main.ts`, rule: 'TS2322', line: 2, column: 14 },
        ]);
        await writeFile(
            join(root, scope, 'src/main.ts'),
            'export function echo(value: string) { return value; }\nexport const first: number = 1;\n',
        );
        const corrected = await checkTypes(root);
        expect(corrected.code, corrected.output).toBe(0);
        expect(await readFile(join(root, scope, 'tsconfig.json'), 'utf8')).toBe(authored);
        const { mode } = await stat(join(root, scope, 'tsconfig.json'));
        expect(mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
        expect(await readFile(join(root, scope, 'build/cache.tsbuildinfo'), 'utf8')).toBe('authored metadata\n');
    },
);

test.each([...OUTDIR_CASES])('$name', async ({ kind }) => {
    await using sandbox = await testdir();
    await using outside = await testdir({ 'value.js': 'authored output\n' });

    await installCompiler(sandbox.path, outside.path);
    const outsideFiles = await readdir(outside.path);
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        '.gitignore': 'node_modules\n.gspot\n',
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
    // The linked case points node_modules outside; the absolute case installs only the compiler, so copies stay small.
    await (kind === 'symlink'
        ? symlink(outside.path, join(sandbox.path, 'node_modules'), 'dir')
        : installCompiler(sandbox.path));
    commitAll(sandbox.path);
    await runSandboxStep({ root: sandbox.path, environment: {}, run: spawnGspot }, ['apply']);
    const checked = await checkTypes(sandbox.path);
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
    const corrected = await checkTypes(sandbox.path);
    expect(corrected.code, corrected.output).toBe(0);
    expect(await readFile(join(outside.path, 'value.js'), 'utf8')).toBe('authored output\n');
    expect(await readdir(outside.path)).toStrictEqual(outsideFiles);
    const files = await readdir(join(sandbox.path, 'app'));
    expect(files.toSorted((left, right) => left.localeCompare(right))).toStrictEqual(['tsconfig.json', 'value.ts']);
});

test('typescript/tsc builds a referenced project with its imported declarations and extended config and ignores other folders', async () => {
    await using sandbox = await testdir({
        ...REFERENCE_BUILD_FILES,
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [
                { path: 'app', configurations: ['typescript'] },
                { path: 'neighbor', configurations: ['typescript'] },
            ],
        }),
    });
    await writeFile(
        join(sandbox.path, 'tsconfig.json'),
        JSON.stringify({ files: [], references: [{ path: join(sandbox.path, 'app') }] }),
    );
    await writeFile(
        join(sandbox.path, 'app/tsconfig.json'),
        JSON.stringify({ extends: join(sandbox.path, 'config/base.json'), include: ['src/**/*.ts'] }),
    );
    await installCompiler(sandbox.path);
    commitAll(sandbox.path);
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const failed = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const rootCheck = failed.report.checks.find((check) => check.scope === '')!;
    expect(rootCheck.status).toBe('failed');
    expect(rootCheck.findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'app/src/main.ts', rule: 'TS2322' },
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
