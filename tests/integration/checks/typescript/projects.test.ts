import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { installCompiler } from '#tests/setup/install.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import type { TypecheckResult } from '#tests/types/tool-output.ts';
import { stat, chmod, readdir, symlink, writeFile } from 'node:fs/promises';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';

import {
    OUTDIR_CASES,
    YOUR_TSCONFIG,
    TSCONFIG_PROJECT,
    SOLUTION_TSCONFIG,
    REFERENCE_BUILD_FILES,
    IMPLICIT_PROJECT_FILES,
    TYPESCRIPT_PROJECTS_SANDBOX,
} from '#tests/data/checks/typescript/projects.ts';

const installedSandbox = registerSharedSandbox(TYPESCRIPT_PROJECTS_SANDBOX);

/** Apply one authored compiler project and restore the shared installation after the scenario. */
async function prepareCompilerSources(files: Record<string, string>): Promise<AsyncDisposable> {
    const sandbox = installedSandbox();
    await using resources = new AsyncDisposableStack();
    resources.use(await updateSandbox(sandbox, buildSandboxChanges(TYPESCRIPT_PROJECTS_SANDBOX.files, files)));
    const applied = await spawnGspot(sandbox.root, ['apply'], sandbox.environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    return resources.move();
}

test('typescript/tsc checks an authored project without files or include', async () => {
    const sandbox = { path: installedSandbox().root };
    const sourceFiles = {
        ...IMPLICIT_PROJECT_FILES,
        'gspot.toml': buildSettingsText(['typescript'], { level: 'all' }),
    };
    await using _sourceChange = await prepareCompilerSources(sourceFiles);
    commitAll(sandbox.path);
    const failed = await checkTypes(sandbox.path);
    expect(failed.code, failed.output).toBe(1);
    expect(failed.findings).toMatchObject([{ file: 'src/broken.ts', rule: 'TS2322' }]);
    await writeFile(join(sandbox.path, 'src/broken.ts'), IMPLICIT_PROJECT_FILES['src/clean.ts']);
    const clean = await checkTypes(sandbox.path);
    expect(clean.code, clean.output).toBe(0);
    expect(await Bun.file(join(sandbox.path, 'tsconfig.json')).text()).toBe(IMPLICIT_PROJECT_FILES['tsconfig.json']);
});

// The installed TypeScript compiler checks project references, authored compiler settings, and build output bounds.
// Apply authored compiler settings through the same pipeline used by repositories.
async function runGspotApply(root: string, settings?: string): Promise<void> {
    if (settings !== undefined) await Bun.write(join(root, 'gspot.toml'), settings);
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
}

// Runs the TypeScript check and returns its exit code, output, and findings.
async function checkTypes(root: string): Promise<TypecheckResult> {
    const result = await spawnGspot(root, ['check', '--only', 'typescript/tsc', '--json']);
    const output = result.stdout + result.stderr;
    if (result.code === 2) return { code: result.code, output, findings: [] };
    const findings = (JSON.parse(result.stdout) as RunReport).checks.flatMap((check) => check.findings);
    return { code: result.code, output, findings };
}

test('typescript/tsc checks both projects of a solution and writes no build output', async () => {
    const sandbox = { path: installedSandbox().root };
    const sourceFiles = {
        'gspot.toml': buildSettingsText(['typescript'], { level: 'all' }),
        '.gitignore': 'node_modules/\n.gspot/\n',
        'tsconfig.json': SOLUTION_TSCONFIG,
        'orders/tsconfig.json': TSCONFIG_PROJECT,
        'users/tsconfig.json': TSCONFIG_PROJECT.replace('"include"', '"references":[{"path":"../orders"}],"include"'),
        'orders/order.ts': 'export const total: number = "wrong";',
        'users/user.ts': 'import { total } from "../orders/order.js"; export const active: boolean = total;',
    };
    await using _sourceChange = await prepareCompilerSources(sourceFiles);
    commitAll(sandbox.path);
    const failed = await checkTypes(sandbox.path);
    expect(failed.code, failed.output).toBe(1);
    expect(
        failed.findings
            .filter((finding) => finding.rule === 'TS2322')
            .map((finding) => finding.file)
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['orders/order.ts', 'users/user.ts']);
    await writeFile(join(sandbox.path, 'orders/order.ts'), 'export const total: number = 3;');
    await writeFile(
        join(sandbox.path, 'users/user.ts'),
        'import { total } from "../orders/order.js"; export const active: boolean = total > 0;',
    );
    const clean = await checkTypes(sandbox.path);
    expect(clean.code, clean.output).toBe(0);
    const output = await Promise.all(
        ['orders', 'users'].map((folder) => readdir(join(sandbox.path, folder), { recursive: true })),
    );
    expect(output.flat().filter((path) => /\.(?:tsbuildinfo|js|d\.ts)$/u.test(path))).toStrictEqual([]);
});

test.each([...LEVELS])(
    'typescript/tsc keeps your tsconfig.json in a scope and reports type errors at both levels',
    async (level) => {
        const sandbox = { path: installedSandbox().root };
        const scope = 'apps/web';
        const scopeTable = `[[scope]]
path = "${scope}"
configurations = ["typescript"]
`;
        const authored = YOUR_TSCONFIG.replace(
            '%BUILD_INFO%',
            JSON.stringify(join(sandbox.path, scope, 'build/cache.tsbuildinfo')),
        );
        const sourceFiles = {
            '.gitignore': 'node_modules/\n.gspot/\n',
            [`${scope}/tsconfig.json`]: authored,
            [`${scope}/src/main.ts`]: 'export const echo: number = "wrong";\n',
            [`${scope}/build/cache.tsbuildinfo`]: 'authored metadata\n',
        };
        await using _sourceChange = await prepareCompilerSources(sourceFiles);
        await chmod(join(sandbox.path, scope, 'tsconfig.json'), 0o640);
        await runGspotApply(sandbox.path, buildSettingsText(['javascript'], { tables: scopeTable, level }));
        const failed = await checkTypes(sandbox.path);
        expect(failed.code, failed.output).toBe(1);
        expect(failed.findings).toMatchObject([
            { check: 'typescript/tsc', file: `${scope}/src/main.ts`, rule: 'TS2322', line: 1, column: 14 },
        ]);
        await writeFile(
            join(sandbox.path, scope, 'src/main.ts'),
            'export function echo(value: string) { return value; }\nexport const first: number = "wrong";\n',
        );
        {
            const checked = await checkTypes(sandbox.path);
            expect(checked.code, checked.output).toBe(1);
            expect(checked.findings).toMatchObject([
                { check: 'typescript/tsc', file: `${scope}/src/main.ts`, rule: 'TS2322', line: 2, column: 14 },
            ]);
        }
        await writeFile(
            join(sandbox.path, scope, 'src/main.ts'),
            'export function echo(value: string) { return value; }\nexport const first: number = 1;\n',
        );
        const corrected = await checkTypes(sandbox.path);
        expect(corrected.code, corrected.output).toBe(0);
        expect(await Bun.file(join(sandbox.path, scope, 'tsconfig.json')).text()).toBe(authored);
        const { mode } = await stat(join(sandbox.path, scope, 'tsconfig.json'));
        expect(mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
        expect(await Bun.file(join(sandbox.path, scope, 'build/cache.tsbuildinfo')).text()).toBe('authored metadata\n');
    },
);

test.each([...OUTDIR_CASES])('$name', async ({ kind }) => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(outside.path, { 'value.js': 'authored output\n' });
    await installCompiler(sandbox.path, outside.path);
    const outsideFiles = await readdir(outside.path);
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['typescript'], { level: 'all' }),
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
    await runGspotApply(sandbox.path);
    const checked = await checkTypes(sandbox.path);
    expect(checked.code, checked.output).toBe(0);
    expect(await readdir(outside.path)).toStrictEqual(outsideFiles);
    expect(await Bun.file(join(outside.path, 'value.js')).text()).toBe('authored output\n');
    await writeFile(
        join(sandbox.path, 'app/tsconfig.json'),
        JSON.stringify({
            compilerOptions: { composite: true, types: [], outDir: './dist' },
            include: ['*.ts'],
        }),
    );
    const corrected = await checkTypes(sandbox.path);
    expect(corrected.code, corrected.output).toBe(0);
    expect(await Bun.file(join(outside.path, 'value.js')).text()).toBe('authored output\n');
    expect(await readdir(outside.path)).toStrictEqual(outsideFiles);
    const files = await readdir(join(sandbox.path, 'app'));
    expect(files.toSorted((left, right) => left.localeCompare(right))).toStrictEqual(['tsconfig.json', 'value.ts']);
});

test('typescript/tsc builds a referenced project with its imported declarations and extended config and ignores other folders', async () => {
    await using sandbox = await testdir({
        ...REFERENCE_BUILD_FILES,
        'gspot.toml': buildSettingsText(['typescript'], {
            level: 'all',
            tables: `[[scope]]
path = "app"

configurations = ["typescript"]
[[scope]]
path = "neighbor"

configurations = ["typescript"]
`,
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
    const failed = await spawnGspot(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const rootCheck = (JSON.parse(failed.stdout) as RunReport).checks.find((check) => check.scope === '')!;
    expect(rootCheck.status).toBe('failed');
    expect(rootCheck.findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'app/src/main.ts', rule: 'TS2322' },
    ]);
    expect(await Bun.file(join(sandbox.path, 'app/src/main.ts')).text()).toBe(REFERENCE_BUILD_FILES['app/src/main.ts']);
    expect(await Bun.file(join(sandbox.path, 'app/src/main.js')).exists()).toBe(false);
    expect(await Bun.file(join(sandbox.path, 'app/tsconfig.tsbuildinfo')).exists()).toBe(false);
    await Bun.write(
        join(sandbox.path, 'app/src/main.ts'),
        REFERENCE_BUILD_FILES['app/src/main.ts'].replace('"wrong"', '8080'),
    );
    const corrected = await spawnGspot(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(1);
    expect(
        (JSON.parse(corrected.stdout) as RunReport).checks
            .flatMap(({ findings }) => findings)
            .map(({ file, rule }) => ({ file, rule })),
    ).toStrictEqual([{ file: 'neighbor/source.ts', rule: 'TS2322' }]);
});
