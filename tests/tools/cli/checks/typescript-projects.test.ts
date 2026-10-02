// The installed TypeScript compiler checks project references, authored compiler settings, and build output bounds.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { keptMode } from '#tests/harness/cli/platforms.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { writeConfigs } from '#tests/harness/cli/generated.ts';
import { INSTALLED_MODULES } from '#tests/harness/cli/modules.ts';
import type { Finding, RunReport } from '#cli/types/execution/execution.ts';
import { statSync, chmodSync, mkdirSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';

const PROJECTS_POLICY = `level = "all"
kits = ["typescript"]
[guides]
install = false
`;

const TSCONFIG_PROJECT =
    '{"compilerOptions":{"composite":true,"strict":true,"types":[],"target":"ES2020"},"include":["*.ts"]}';

const AUTHORED_TSCONFIG = `{
    // The application owns its build and module settings.
    "compilerOptions": {
        "strict": false,
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "types": [],
        "incremental": true,
        "tsBuildInfoFile": %BUILD_INFO%
    },
    "include": ["src"],
}\n`;

// Writes the configurations apply writes, without the lockfile apply resolves.
async function writeGenerated(root: string, policy?: string): Promise<void> {
    if (policy !== undefined) await Bun.write(join(root, 'gspot.toml'), policy);
    await writeConfigs(await openSession(root), root);
}

// Runs the TypeScript check and returns its exit code, output, and findings.
async function checkTypes(root: string): Promise<{ code: number; output: string; findings: Finding[] }> {
    const result = await spawnGspot(root, ['check', '--only', 'typescript/tsc', '--json']);
    const output = result.stdout + result.stderr;
    if (result.code === 2) return { code: result.code, output, findings: [] };
    const findings = (JSON.parse(result.stdout) as RunReport).checks.flatMap((check) => check.findings);
    return { code: result.code, output, findings };
}

// Links the installed compiler into the repository's own packages.
function linkCompiler(root: string): void {
    mkdirSync(join(root, 'node_modules/.bin'), { recursive: true });
    symlinkSync(join(INSTALLED_MODULES, 'typescript'), join(root, 'node_modules/typescript'), 'dir');
    symlinkSync('../typescript/bin/tsc', join(root, 'node_modules/.bin/tsc'));
}

test(
    'a TypeScript solution checks both projects without writing build output',
    async () => {
        const solution =
            '{// The solution has no sources.\n"files":[],"references":[{"path":"./orders"},{"path":"./users"}],}';
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': PROJECTS_POLICY,
            '.gitignore': 'node_modules/\n.gspot/\n',
            'tsconfig.json': solution,
            'orders/tsconfig.json': TSCONFIG_PROJECT,
            'users/tsconfig.json': TSCONFIG_PROJECT.replace(
                '"include"',
                '"references":[{"path":"../orders"}],"include"',
            ),
            'orders/order.ts': 'export const total: number = "wrong";',
            'users/user.ts': 'import { total } from "../orders/order.js"; export const active: boolean = total;',
        });
        linkCompiler(sandbox.path);
        commitAll(sandbox.path);
        await writeGenerated(sandbox.path);
        const failed = await checkTypes(sandbox.path);
        expect(failed.code, failed.output).toBe(1);
        expect(
            failed.findings
                .filter((finding) => finding.rule === 'TS2322')
                .map((finding) => finding.file)
                .toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(['orders/order.ts', 'users/user.ts']);
        writeFileSync(join(sandbox.path, 'orders/order.ts'), 'export const total: number = 3;');
        writeFileSync(
            join(sandbox.path, 'users/user.ts'),
            'import { total } from "../orders/order.js"; export const active: boolean = total > 0;',
        );
        const clean = await checkTypes(sandbox.path);
        expect(clean.code, clean.output).toBe(0);
        const output = ['orders', 'users'].flatMap((folder) =>
            readdirSync(join(sandbox.path, folder), { recursive: true }).map(String),
        );
        expect(output.filter((path) => /\.(?:tsbuildinfo|js|d\.ts)$/u.test(path))).toStrictEqual([]);
    },
    PLANTED_TIMEOUT_MS * 3,
);

test(
    'a TypeScript scope keeps authored compiler settings while both levels enforce type safety',
    async () => {
        await using sandbox = await testdir();
        const scope = 'apps/web';
        const scopeTable = `[guides]\ninstall = false\n[[scope]]\npath = "${scope}"\nkits = ["typescript"]\n`;
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
        linkCompiler(sandbox.path);
        chmodSync(join(sandbox.path, scope, 'tsconfig.json'), 0o640);
        await writeGenerated(sandbox.path, policyOf(['javascript'], scopeTable, 'recommended'));
        const failed = await checkTypes(sandbox.path);
        expect(failed.code, failed.output).toBe(1);
        expect(failed.findings).toMatchObject([
            { check: 'typescript/tsc', file: `${scope}/src/main.ts`, rule: 'TS7006', line: 1, column: 22 },
        ]);
        writeFileSync(
            join(sandbox.path, scope, 'src/main.ts'),
            'export function echo(value: string) { return value; }\nexport const first: number = [1][0];\n',
        );
        for (const level of ['recommended', 'all']) {
            await writeGenerated(sandbox.path, policyOf(['javascript'], scopeTable, level));
            const checked = await checkTypes(sandbox.path);
            expect(checked.code, checked.output).toBe(1);
            expect(checked.findings).toMatchObject([
                { check: 'typescript/tsc', file: `${scope}/src/main.ts`, rule: 'TS2322', line: 2, column: 14 },
            ]);
        }
        writeFileSync(
            join(sandbox.path, scope, 'src/main.ts'),
            'export function echo(value: string) { return value; }\nexport const first: number = [1][0] ?? 0;\n',
        );
        const corrected = await checkTypes(sandbox.path);
        expect(corrected.code, corrected.output).toBe(0);
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
        await writeGenerated(sandbox.path);
        const failed = await checkTypes(sandbox.path);
        expect(failed.code, failed.output).toBe(kind === 'absolute' ? 2 : 0);
        expect(failed.output.includes('Unsafe lifecycle path')).toBe(kind === 'absolute');
        expect(await Bun.file(join(outside.path, 'value.js')).text()).toBe('authored output\n');
        writeFileSync(
            join(sandbox.path, 'app/tsconfig.json'),
            JSON.stringify({
                compilerOptions: { composite: true, types: [], outDir: './dist' },
                include: ['*.ts'],
            }),
        );
        const corrected = await checkTypes(sandbox.path);
        expect(corrected.code, corrected.output).toBe(0);
        expect(await Bun.file(join(outside.path, 'value.js')).text()).toBe('authored output\n');
        expect(
            readdirSync(join(sandbox.path, 'app')).toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(['tsconfig.json', 'value.ts']);
    },
    PLANTED_TIMEOUT_MS * 3,
);
