// Checks used by a TypeScript repository report their expected findings and pass after the fixes.
import { join } from 'node:path';
import { commitAll } from '#tests/harness/git.ts';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { TYPO } from '#tests/config/samples/spelling.ts';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { applyChanges } from '#tests/harness/preservation.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { shareRepository } from '#tests/harness/repository.ts';
import { installedModules } from '#tests/harness/environment.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';
import type { TypecheckOutcome } from '#tests/types/tools/configurations/typescript.ts';
import { stat, chmod, mkdir, readdir, symlink, writeFile, appendFile } from 'node:fs/promises';
import { REPOSITORY, JAVASCRIPT_CONFIG } from '#tests/config/tools/configurations/language/typescript/checks.ts';

import {
    ARCHITECTURE,
    OUTDIR_CASES,
    TSCONFIG_PROJECT,
    AUTHORED_TSCONFIG,
} from '#tests/config/tools/configurations/language/typescript/source.ts';

const repository: InstalledScenario = {
    ...REPOSITORY,
    files: { ...REPOSITORY.files, 'jsconfig.json': JSON.stringify(JAVASCRIPT_CONFIG, null, 4) + '\n' },
    prepare: async (root, environment) => {
        await appendFile(join(root, 'gspot.toml'), ARCHITECTURE);
        const applied = await spawnGspot(root, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const formatted = await spawnGspot(root, ['check', '--only', 'format/prettier', '--fix'], environment);
        expect(formatted.code, formatted.stdout + formatted.stderr).toBe(0);
    },
};
const testRepository = shareRepository(() => repository);

describe('the typescript configuration', () => {
    test('every check passes on the clean repository', async () => {
        const { root, environment } = testRepository();
        const whole = await spawnGspot(root, ['check'], environment);
        expect(whole.code, whole.stdout).toBe(0);
    });

    // typos forgets its exclude list for a file named on the command line unless it is told to keep it.
    test('spelling/typos keeps its exclusions for a file named on the command line', async () => {
        const { root, environment } = testRepository();
        const restore = await applyChanges(root, {
            check: 'spelling/typos',
            files: { 'assets/mark.svg': `<svg><title>${TYPO.the}</title></svg>\n` },
        });
        try {
            const excluded = await spawnGspot(
                root,
                ['check', '--only', 'spelling/typos', '--json', '--', 'assets/mark.svg'],
                environment,
            );
            expect(excluded.code, excluded.stdout + excluded.stderr).toBe(0);
            expect((JSON.parse(excluded.stdout) as RunReport).checks).toMatchObject([
                { check: 'spelling/typos', status: 'passed', fileCount: 1 },
            ]);
        } finally {
            await restore();
        }
    });
});

// The installed TypeScript compiler checks project references, authored compiler settings, and build output bounds.
// Apply authored compiler policy through the same pipeline used by repositories.
async function applyPolicy(root: string, policy?: string): Promise<void> {
    if (policy !== undefined) await Bun.write(join(root, 'gspot.toml'), policy);
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
}

// Runs the TypeScript check and returns its exit code, output, and findings.
async function checkTypes(root: string): Promise<TypecheckOutcome> {
    const result = await spawnGspot(root, ['check', '--only', 'typescript/tsc', '--json']);
    const output = result.stdout + result.stderr;
    if (result.code === 2) return { code: result.code, output, findings: [] };
    const findings = (JSON.parse(result.stdout) as RunReport).checks.flatMap((check) => check.findings);
    return { code: result.code, output, findings };
}

// Links the installed compiler into the repository's own packages.
async function linkCompiler(root: string): Promise<void> {
    await mkdir(join(root, 'node_modules/.bin'), { recursive: true });
    await symlink(join(installedModules, 'typescript'), join(root, 'node_modules/typescript'), 'dir');
    await symlink('../typescript/bin/tsc', join(root, 'node_modules/.bin/tsc'));
}

test('a TypeScript solution checks both projects without writing build output', async () => {
    const solution =
        '{// The solution has no sources.\n"files":[],"references":[{"path":"./orders"},{"path":"./users"}],}';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], { level: 'all' }),
        '.gitignore': 'node_modules/\n.gspot/\n',
        'tsconfig.json': solution,
        'orders/tsconfig.json': TSCONFIG_PROJECT,
        'users/tsconfig.json': TSCONFIG_PROJECT.replace('"include"', '"references":[{"path":"../orders"}],"include"'),
        'orders/order.ts': 'export const total: number = "wrong";',
        'users/user.ts': 'import { total } from "../orders/order.js"; export const active: boolean = total;',
    });
    await linkCompiler(sandbox.path);
    commitAll(sandbox.path);
    await applyPolicy(sandbox.path);
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

test('a TypeScript scope keeps authored compiler settings while both levels enforce type safety', async () => {
    await using sandbox = await testdir();
    const scope = 'apps/web';
    const scopeTable = `[scope."${scope}"]\nconfigurations = ["typescript"]\n`;
    const authored = AUTHORED_TSCONFIG.replace(
        '%BUILD_INFO%',
        JSON.stringify(join(sandbox.path, scope, 'build/cache.tsbuildinfo')),
    );
    await createFileTree(sandbox.path, {
        '.gitignore': 'node_modules/\n.gspot/\n',
        [`${scope}/tsconfig.json`]: authored,
        [`${scope}/src/main.ts`]: 'export function echo(value) { return value; }\n',
        [`${scope}/build/cache.tsbuildinfo`]: 'authored metadata\n',
    });
    await linkCompiler(sandbox.path);
    await chmod(join(sandbox.path, scope, 'tsconfig.json'), 0o640);
    await applyPolicy(sandbox.path, buildPolicy(['javascript'], { tables: scopeTable, level: 'recommended' }));
    const failed = await checkTypes(sandbox.path);
    expect(failed.code, failed.output).toBe(1);
    expect(failed.findings).toMatchObject([
        { check: 'typescript/tsc', file: `${scope}/src/main.ts`, rule: 'TS7006', line: 1, column: 22 },
    ]);
    await writeFile(
        join(sandbox.path, scope, 'src/main.ts'),
        'export function echo(value: string) { return value; }\nexport const first: number = [1][0];\n',
    );
    for (const level of ['recommended', 'all'] as const) {
        await applyPolicy(sandbox.path, buildPolicy(['javascript'], { tables: scopeTable, level: level }));
        const checked = await checkTypes(sandbox.path);
        expect(checked.code, checked.output).toBe(1);
        expect(checked.findings).toMatchObject([
            { check: 'typescript/tsc', file: `${scope}/src/main.ts`, rule: 'TS2322', line: 2, column: 14 },
        ]);
    }
    await writeFile(
        join(sandbox.path, scope, 'src/main.ts'),
        'export function echo(value: string) { return value; }\nexport const first: number = [1][0] ?? 0;\n',
    );
    const corrected = await checkTypes(sandbox.path);
    expect(corrected.code, corrected.output).toBe(0);
    expect(await Bun.file(join(sandbox.path, scope, 'tsconfig.json')).text()).toBe(authored);
    const { mode } = await stat(join(sandbox.path, scope, 'tsconfig.json'));
    expect(mode & 0o777).toBe(getKeptMode(0o640));
    expect(await Bun.file(join(sandbox.path, scope, 'build/cache.tsbuildinfo')).text()).toBe('authored metadata\n');
});

test.each(OUTDIR_CASES)('$name', async ({ kind, code }) => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(outside.path, { 'value.js': 'authored output\n', '.bin': {} });
    await symlink(join(installedModules, 'typescript'), join(outside.path, 'typescript'), 'dir');
    await symlink('../typescript/bin/tsc', join(outside.path, '.bin/tsc'));
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], { level: 'all' }),
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
    await symlink(kind === 'symlink' ? outside.path : installedModules, join(sandbox.path, 'node_modules'), 'dir');
    commitAll(sandbox.path);
    await applyPolicy(sandbox.path);
    const checked = await checkTypes(sandbox.path);
    expect(checked.code, checked.output).toBe(code);
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
    const files = await readdir(join(sandbox.path, 'app'));
    expect(files.toSorted((left, right) => left.localeCompare(right))).toStrictEqual(['tsconfig.json', 'value.ts']);
});
