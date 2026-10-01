import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { installPrivateTools } from '#tests/support/cli/tools.ts';
import { readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { containing, containingAll } from '#tests/support/expectations.ts';
import { START, VITE_POLICY } from '#tests/inputs/acceptance/source/kits/kits.ts';

const MODULES = join(import.meta.dir, '../../../../node_modules');
const VITEST = dirname(Bun.resolveSync('vitest/package.json', import.meta.dir));
const VITE = dirname(Bun.resolveSync('vite/package.json', VITEST));
const VITE_FILES = {
    node_modules: {},
    'gspot.toml': VITE_POLICY,
    '.gitignore': 'node_modules\n.gspot/\ndist/\n',
    'package.json': '{"name":"entry-sandbox","private":true,"type":"module","devDependencies":{"vite":"8.3.0"}}',
    'index.html': '<!doctype html><script type="module" src="/src/main.js"></script>',
    'src/start.js':
        'export function start() { const target = document.querySelector("#app"); if (!target) throw new Error("Missing application target"); target.textContent = "Started"; }\n',
    'src/main.js': START,
    'src/task.js': START,
    'api/src/start.js':
        'export function start() { const target = document.querySelector("#app"); if (!target) throw new Error("Missing application target"); target.textContent = "Started"; }\n',
    'api/src/main.js': START,
    'api/src/task.js': START,
};

const ESLINT_CHECK = ['check', '--only', 'javascript/eslint', '--json'];
const ENTRY_FILES = ['api/src/main.js', 'api/src/task.js', 'src/main.js', 'src/task.js'];

async function trivialFiles(root: string): Promise<string[]> {
    const outcome = await run(root, ESLINT_CHECK);
    expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
    const report = JSON.parse(outcome.stdout) as RunReport;
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
    'Vite entry files retain selected structural rules at both levels and nested scopes',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, VITE_FILES);
        for (const entry of readdirSync(MODULES))
            symlinkSync(join(MODULES, entry), join(sandbox.path, 'node_modules', entry));
        symlinkSync(VITE, join(sandbox.path, 'node_modules/vite'));
        const build = await processes.run([process.execPath, join(VITE, 'bin/vite.js'), 'build'], {
            cwd: sandbox.path,
            timeoutMs: PLANTED_TIMEOUT_MS,
        });
        expect(build.code, build.stdout + build.stderr).toBe(0);
        commitAll(sandbox.path);
        const initial = await run(sandbox.path, ['apply']);
        expect(initial.code, initial.stdout + initial.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
        expect(await trivialFiles(sandbox.path)).toStrictEqual(ENTRY_FILES);
        for (const policy of [
            VITE_POLICY.replace('entry = []', 'entry = ["api/src/main.js"]'),
            VITE_POLICY.replaceAll('entry = []', 'entry = ["src/*.js", "!src/task.js"]'),
        ]) {
            writeFileSync(join(sandbox.path, 'gspot.toml'), policy);
            const applied = await run(sandbox.path, ['apply']);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            expect(await trivialFiles(sandbox.path)).toStrictEqual(ENTRY_FILES);
        }
        writeFileSync(
            join(sandbox.path, 'src/main.js'),
            "import { start } from './start.js';\nexport function boot() { start(); }\n",
        );
        for (const level of ['recommended', 'all']) {
            writeFileSync(
                join(sandbox.path, 'gspot.toml'),
                VITE_POLICY.replace('level = "all"', `level = "${level}"`)
                    .replace(
                        '[tools.knip]',
                        '[tools.eslint.rules]\n"gspot/no-trivial-functions" = "error"\n"gspot/no-trivial-files" = "error"\n[tools.knip]',
                    )
                    .replaceAll('entry = []', 'entry = ["src/main.js"]'),
            );
            const configured = await run(sandbox.path, ['apply']);
            expect(configured.code, configured.stdout + configured.stderr).toBe(0);
            const checked = await run(sandbox.path, [...ESLINT_CHECK, '--', 'src/main.js']);
            const report = JSON.parse(checked.stdout) as RunReport;
            expect(checked.code, checked.stdout + checked.stderr).toBe(1);
            expect(report.checks).toMatchObject([{ check: 'javascript/eslint', status: 'fail' }]);
            expect(report.checks.flatMap((check) => check.findings)).toStrictEqual(
                containingAll([
                    containing({ rule: 'gspot/no-trivial-functions', file: 'src/main.js', line: 2 }),
                    containing({ rule: 'gspot/no-trivial-files', file: 'src/main.js', line: 1 }),
                ]),
            );
            expect(await trivialFiles(sandbox.path)).toStrictEqual(ENTRY_FILES);
        }
    },
    PLANTED_TIMEOUT_MS * 3,
);
