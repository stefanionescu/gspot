import { expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { createFixture } from 'fs-fixture';
import type { RunReport } from '#types/report.ts';
import { run as runProcess } from '#cli/platform/spawn.ts';
import { symlinkSync, writeFileSync, readdirSync } from 'node:fs';
import { commitAll, PLANTED_TIMEOUT_MS, run } from '#tests/harness/planted.ts';

const MODULES = join(import.meta.dir, '../../../node_modules');
const VITEST = dirname(Bun.resolveSync('vitest/package.json', import.meta.dir));
const VITE = dirname(Bun.resolveSync('vite/package.json', VITEST));
const POLICY = `version = 1
presets = ["javascript"]
[runner]
tool = "none"
[hooks]
tool = "none"
[ci]
provider = "none"
[rules]
install = false
[tools.knip]
entry = []
[[scope]]
path = "api"
presets = ["javascript"]
[scope.tools.knip]
entry = []
`;
const START = "import { start } from './start.js';\nstart();\n";

async function trivialFiles(root: string): Promise<string[]> {
    const outcome = await run(root, ['check', 'javascript/eslint', '--json', '--no-cache']);
    const report = JSON.parse(outcome.stdout) as RunReport;
    expect(
        report.checks.every((check) => check.status === 'ok' || check.status === 'fail'),
        outcome.stderr,
    ).toBe(true);
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
    'Vite startup files follow the declared entry points of their own scope',
    async () => {
        await using fixture = await createFixture({
            node_modules: {},
            'gspot.toml': POLICY,
            '.gitignore': 'node_modules\n.gspot/\ndist/\n',
            'package.json':
                '{"name":"entry-fixture","private":true,"type":"module","devDependencies":{"vite":"8.3.0"}}',
            'index.html': '<!doctype html><script type="module" src="/src/main.js"></script>',
            'src/start.js': 'export function start() { console.info("started"); }\n',
            'src/main.js': START,
            'src/task.js': START,
            'api/src/start.js': 'export function start() { console.info("started"); }\n',
            'api/src/main.js': START,
            'api/src/task.js': START,
        });
        for (const entry of readdirSync(MODULES))
            symlinkSync(join(MODULES, entry), join(fixture.path, 'node_modules', entry));
        symlinkSync(VITE, join(fixture.path, 'node_modules/vite'));
        const build = await runProcess([process.execPath, join(VITE, 'bin/vite.js'), 'build'], {
            cwd: fixture.path,
            timeoutMs: PLANTED_TIMEOUT_MS,
        });
        expect(build.code, build.stdout + build.stderr).toBe(0);
        commitAll(fixture.path);
        const initial = await run(fixture.path, ['apply']);
        expect(initial.code, initial.stdout + initial.stderr).toBe(0);
        expect(await trivialFiles(fixture.path)).toEqual([
            'api/src/main.js',
            'api/src/task.js',
            'src/main.js',
            'src/task.js',
        ]);
        writeFileSync(join(fixture.path, 'gspot.toml'), POLICY.replace('entry = []', 'entry = ["api/src/main.js"]'));
        const inherited = await run(fixture.path, ['apply']);
        expect(inherited.code, inherited.stdout + inherited.stderr).toBe(0);
        expect(await trivialFiles(fixture.path)).toEqual(['api/src/task.js', 'src/main.js', 'src/task.js']);
        writeFileSync(
            join(fixture.path, 'gspot.toml'),
            POLICY.replaceAll('entry = []', 'entry = ["src/*.js", "!src/task.js"]'),
        );
        const applied = await run(fixture.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        expect(await trivialFiles(fixture.path)).toEqual(['api/src/task.js', 'src/task.js']);
    },
    PLANTED_TIMEOUT_MS * 3,
);
