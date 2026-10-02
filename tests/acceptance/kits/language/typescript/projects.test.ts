// Source CLI journeys for TypeScript project references, authored compiler settings, and files build output.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/harness/cli/command.ts';
import { commitAll } from '#tests/harness/cli/git.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { initArgs } from '#tests/harness/planted/init.ts';
import { keptMode } from '#tests/harness/cli/platforms.ts';
import { INSTALLED_MODULES } from '#tests/harness/cli/modules.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { statSync, chmodSync, mkdirSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';

import {
    PROJECTS_POLICY,
    TSCONFIG_PROJECT,
    AUTHORED_TSCONFIG,
} from '#tests/inputs/acceptance/source/kits/typescript.ts';

for (const scope of ['', 'api/']) {
    test(
        `TypeScript solution ${scope || 'root'} checks both projects without writing build output`,
        async () => {
            const solution =
                '{// The solution has no sources.\n"files":[],"references":[{"path":"./orders"},{"path":"./users"}],}';
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'gspot.toml':
                    scope === ''
                        ? PROJECTS_POLICY
                        : PROJECTS_POLICY + '\n[[scope]]\npath = "api"\nkits = ["typescript"]\n',
                '.gitignore': 'node_modules/\n.gspot/\n',
                'tsconfig.json': scope === '' ? solution : '{"files":["root.ts"],"compilerOptions":{"types":[]}}',
                'root.ts': 'export const root = 1;',
                [`${scope}tsconfig.json`]: solution,
                [`${scope}orders/tsconfig.json`]: TSCONFIG_PROJECT,
                [`${scope}users/tsconfig.json`]: TSCONFIG_PROJECT.replace(
                    '"include"',
                    '"references":[{"path":"../orders"}],"include"',
                ),
                [`${scope}orders/order.ts`]: 'export const total: number = "wrong";',
                [`${scope}users/user.ts`]:
                    'import { total } from "../orders/order.js"; export const active: boolean = total;',
            });
            mkdirSync(join(sandbox.path, 'node_modules/.bin'), { recursive: true });
            symlinkSync(join(INSTALLED_MODULES, 'typescript'), join(sandbox.path, 'node_modules/typescript'), 'dir');
            symlinkSync('../typescript/bin/tsc', join(sandbox.path, 'node_modules/.bin/tsc'));
            commitAll(sandbox.path);
            const applied = await run(sandbox.path, ['apply']);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            const failed = await run(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']);
            const report = JSON.parse(failed.stdout) as RunReport;
            expect(failed.code, failed.stdout + failed.stderr).toBe(1);
            const findings = report.checks.flatMap((check) => check.findings);
            expect(
                findings
                    .filter((finding) => finding.rule === 'TS2322')
                    .map((finding) => finding.file)
                    .toSorted((left, right) => left.localeCompare(right)),
            ).toStrictEqual([`${scope}orders/order.ts`, `${scope}users/user.ts`]);
            writeFileSync(join(sandbox.path, `${scope}orders/order.ts`), 'export const total: number = 3;');
            writeFileSync(
                join(sandbox.path, `${scope}users/user.ts`),
                'import { total } from "../orders/order.js"; export const active: boolean = total > 0;',
            );
            const clean = await run(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']);
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            const output = ['orders', 'users'].flatMap((folder) =>
                readdirSync(join(sandbox.path, scope, folder), { recursive: true }).map(String),
            );
            expect(output.filter((path) => /\.(?:tsbuildinfo|js|d\.ts)$/u.test(path))).toStrictEqual([]);
        },
        PLANTED_TIMEOUT_MS * 3,
    );
}
test.each(['', 'apps/web'])(
    'Vite initialization in %s preserves authored compiler settings while both levels enforce type safety',
    async (scope) => {
        await using sandbox = await testdir();
        const prefix = scope === '' ? '' : `${scope}/`;
        const authored = AUTHORED_TSCONFIG.replace(
            '%BUILD_INFO%',
            JSON.stringify(join(sandbox.path, scope, 'build/cache.tsbuildinfo')),
        );
        await createFileTree(sandbox.path, {
            'package.json':
                '{"name":"preserved-vite","private":true,"type":"module","devDependencies":{"vite":"8.3.0"}}',
            '.gitignore': 'node_modules/\n.gspot/\n',
            [`${prefix}tsconfig.json`]: authored,
            [`${prefix}src/main.ts`]: 'export function echo(value) { return value; }\n',
            [`${prefix}build/cache.tsbuildinfo`]: 'authored metadata\n',
        });
        mkdirSync(join(sandbox.path, 'node_modules/.bin'), { recursive: true });
        symlinkSync(join(INSTALLED_MODULES, 'typescript'), join(sandbox.path, 'node_modules/typescript'), 'dir');
        symlinkSync('../typescript/bin/tsc', join(sandbox.path, 'node_modules/.bin/tsc'));
        chmodSync(join(sandbox.path, scope, 'tsconfig.json'), 0o640);
        const initialized = await run(sandbox.path, [
            ...initArgs([scope === '' ? 'typescript' : 'javascript']),
            ...(scope === '' ? [] : ['--scope', `${scope}=typescript`]),
        ]);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, scope, 'tsconfig.json')).text()).toBe(authored);
        expect(statSync(join(sandbox.path, scope, 'tsconfig.json')).mode & 0o777).toBe(keptMode(0o640));
        const failed = await run(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        expect(report.checks.flatMap((check) => check.findings)).toMatchObject([
            { check: 'typescript/tsc', file: `${prefix}src/main.ts`, rule: 'TS7006', line: 1, column: 22 },
        ]);
        writeFileSync(
            join(sandbox.path, scope, 'src/main.ts'),
            'export function echo(value: string) { return value; }\nexport const first: number = [1][0];\n',
        );
        for (const level of ['recommended', 'all']) {
            const selected = await run(sandbox.path, ['set', 'level', level]);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const checked = await run(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']);
            expect(checked.code, checked.stdout + checked.stderr).toBe(1);
            const report = JSON.parse(checked.stdout) as RunReport;
            expect(report.checks.flatMap((check) => check.findings)).toMatchObject([
                { check: 'typescript/tsc', file: `${prefix}src/main.ts`, rule: 'TS2322', line: 2, column: 14 },
            ]);
        }
        writeFileSync(
            join(sandbox.path, scope, 'src/main.ts'),
            'export function echo(value: string) { return value; }\nexport const first: number = [1][0] ?? 0;\n',
        );
        const corrected = await run(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, scope, 'tsconfig.json')).text()).toBe(authored);
        expect(statSync(join(sandbox.path, scope, 'tsconfig.json')).mode & 0o777).toBe(keptMode(0o640));
        expect(await Bun.file(join(sandbox.path, scope, 'build/cache.tsbuildinfo')).text()).toBe('authored metadata\n');
    },
    PLANTED_TIMEOUT_MS * 3,
);

test.each(['absolute', 'symlink'])(
    'TypeScript bounds %s build output to its disposable project',
    async (kind) => {
        await using sandbox = await testdir();
        await using outside = await testdir();
        await createFileTree(outside.path, { 'value.js': 'authored output\n', '.bin': {} });
        symlinkSync(join(INSTALLED_MODULES, 'typescript'), join(outside.path, 'typescript'), 'dir');
        symlinkSync('../typescript/bin/tsc', join(outside.path, '.bin/tsc'));
        await createFileTree(sandbox.path, {
            'gspot.toml': PROJECTS_POLICY,
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
        symlinkSync(kind === 'symlink' ? outside.path : INSTALLED_MODULES, join(sandbox.path, 'node_modules'), 'dir');
        commitAll(sandbox.path);
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const failed = await run(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']);
        expect(failed.code, failed.stdout + failed.stderr).toBe(kind === 'absolute' ? 2 : 0);
        expect((failed.stdout + failed.stderr).includes('Unsafe lifecycle path')).toBe(kind === 'absolute');
        expect(await Bun.file(join(outside.path, 'value.js')).text()).toBe('authored output\n');
        writeFileSync(
            join(sandbox.path, 'app/tsconfig.json'),
            JSON.stringify({
                compilerOptions: { composite: true, types: [], outDir: './dist' },
                include: ['*.ts'],
            }),
        );
        const corrected = await run(sandbox.path, ['check', '--only', 'typescript/tsc', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await Bun.file(join(outside.path, 'value.js')).text()).toBe('authored output\n');
        expect(
            readdirSync(join(sandbox.path, 'app')).toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(['tsconfig.json', 'value.ts']);
    },
    PLANTED_TIMEOUT_MS * 3,
);
