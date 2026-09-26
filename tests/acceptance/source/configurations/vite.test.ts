import { expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { runProcess, run } from '#tests/support/cli/command.ts';
import { installPrivateTools } from '#tests/support/cli/tools.ts';
import { readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
import { containing, containingAll } from '#tests/support/expectations.ts';
import { START, VITE_POLICY } from '#tests/constants/acceptance/source/configurations/configurations.ts';

const MODULES = join(import.meta.dir, '../../../../node_modules');
const VITEST = dirname(Bun.resolveSync('vitest/package.json', import.meta.dir));
const VITE = dirname(Bun.resolveSync('vite/package.json', VITEST));
async function trivialFiles(root: string): Promise<string[]> {
    const outcome = await run(root, ['check', '--only', 'javascript/eslint', '--json', '--no-cache']);
    expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
    const report = reportSchema.parse(JSON.parse(outcome.stdout));
    expect(report.checks.map(({ check, scope, status }) => ({ check, scope, status }))).toStrictEqual([
        { check: 'javascript/eslint', scope: '', status: 'fail' },
        { check: 'javascript/eslint', scope: 'api', status: 'fail' },
    ]);
    return [
        ...new Set(
            report.checks
                .flatMap((check) => check.findings)
                .filter((finding) => finding.rule === 'gspot/no-trivial-files')
                .map((finding) => finding.file),
        ),
    ].toSorted((a, b) => a.localeCompare(b));
}

test(
    'Vite entry files retain structural enforcement at both levels and nested scopes',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            node_modules: {},
            'gspot.toml': VITE_POLICY,
            '.gitignore': 'node_modules\n.gspot/\ndist/\n',
            'package.json':
                '{"name":"entry-sandbox","private":true,"type":"module","devDependencies":{"vite":"8.3.0"}}',
            'index.html': '<!doctype html><script type="module" src="/src/main.js"></script>',
            'src/start.js':
                'export function start() { const target = document.querySelector("#app"); if (!target) throw new Error("Missing application target"); target.textContent = "Started"; }\n',
            'src/main.js': START,
            'src/task.js': START,
            'api/src/start.js':
                'export function start() { const target = document.querySelector("#app"); if (!target) throw new Error("Missing application target"); target.textContent = "Started"; }\n',
            'api/src/main.js': START,
            'api/src/task.js': START,
        });
        for (const entry of readdirSync(MODULES))
            symlinkSync(join(MODULES, entry), join(sandbox.path, 'node_modules', entry));
        symlinkSync(VITE, join(sandbox.path, 'node_modules/vite'));
        const build = await runProcess([process.execPath, join(VITE, 'bin/vite.js'), 'build'], {
            cwd: sandbox.path,
            timeoutMs: PLANTED_TIMEOUT_MS,
        });
        expect(build.code, build.stdout + build.stderr).toBe(0);
        commitAll(sandbox.path);
        const initial = await run(sandbox.path, ['apply']);
        expect(initial.code, initial.stdout + initial.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
        expect(await trivialFiles(sandbox.path)).toStrictEqual([
            'api/src/main.js',
            'api/src/task.js',
            'src/main.js',
            'src/task.js',
        ]);
        writeFileSync(
            join(sandbox.path, 'gspot.toml'),
            VITE_POLICY.replace('entry = []', 'entry = ["api/src/main.js"]'),
        );
        const inherited = await run(sandbox.path, ['apply']);
        expect(inherited.code, inherited.stdout + inherited.stderr).toBe(0);
        expect(await trivialFiles(sandbox.path)).toStrictEqual([
            'api/src/main.js',
            'api/src/task.js',
            'src/main.js',
            'src/task.js',
        ]);
        writeFileSync(
            join(sandbox.path, 'gspot.toml'),
            VITE_POLICY.replaceAll('entry = []', 'entry = ["src/*.js", "!src/task.js"]'),
        );
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        expect(await trivialFiles(sandbox.path)).toStrictEqual([
            'api/src/main.js',
            'api/src/task.js',
            'src/main.js',
            'src/task.js',
        ]);
        writeFileSync(
            join(sandbox.path, 'src/main.js'),
            "import { start } from './start.js';\nexport function boot() { start(); }\n",
        );
        for (const level of ['recommended', 'all']) {
            writeFileSync(
                join(sandbox.path, 'gspot.toml'),
                VITE_POLICY.replace(
                    'level = "all"',
                    `level = "${level}"\nextra_checks = ["javascript/eslint"]`,
                ).replaceAll('entry = []', 'entry = ["src/main.js"]'),
            );
            const configured = await run(sandbox.path, ['apply']);
            expect(configured.code, configured.stdout + configured.stderr).toBe(0);
            const checked = await run(sandbox.path, [
                'check',
                '--only',
                'javascript/eslint',
                '--json',
                '--no-cache',
                '--',
                'src/main.js',
            ]);
            const report = JSON.parse(checked.stdout) as RunReport;
            expect(checked.code, checked.stdout + checked.stderr).toBe(1);
            expect(report.checks).toMatchObject([{ check: 'javascript/eslint', status: 'fail' }]);
            expect(report.checks.flatMap((check) => check.findings)).toStrictEqual(
                containingAll([
                    containing({ rule: 'gspot/no-trivial-functions', file: 'src/main.js', line: 2 }),
                    containing({ rule: 'gspot/no-trivial-files', file: 'src/main.js', line: 1 }),
                ]),
            );
            expect(await trivialFiles(sandbox.path)).toStrictEqual([
                'api/src/main.js',
                'api/src/task.js',
                'src/main.js',
                'src/task.js',
            ]);
        }
    },
    PLANTED_TIMEOUT_MS * 3,
);
