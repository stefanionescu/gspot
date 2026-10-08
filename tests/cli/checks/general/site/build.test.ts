import { join } from 'node:path';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { buildCheckInput } from '#tests/harness/input.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import * as toolRunner from '#cli/execution/command/check.ts';
import { runGspot, buildRunOptions } from '#tests/harness/gspot.ts';
import type { SiteReportCase } from '#tests/types/cli/checks/general/site.ts';
import { SITE_POLICY, SITE_BUILD_SCRIPT } from '#tests/config/samples/site.ts';
import { purgecss, linkinator, htmlValidate } from '#cli/checks/general/site/output.ts';
import { stat, chmod, mkdir, unlink, symlink, readFile, writeFile } from 'node:fs/promises';
import { filesUnder, cachedBuild, buildReproducible } from '#cli/checks/general/site/build.ts';

const SITE_REPORTS: SiteReportCase[] = [
    {
        name: 'links',
        check: 'site/linkinator',
        analyze: (input) => linkinator(input, false),
        report: () => ({
            links: [{ url: 'https://example.com/missing', parent: 'index.html', state: 'BROKEN', status: 404 }],
        }),
        corrected: { links: [] },
        status: 1,
        file: 'dist/index.html',
        rule: 'broken-link',
    },
    {
        name: 'markup',
        check: 'site/html-validate',
        analyze: htmlValidate,
        report: (output: string) => [
            {
                filePath: join(output, 'index.html'),
                messages: [{ ruleId: 'doctype', line: 1, message: 'Missing doctype.' }],
            },
        ],
        corrected: [],
        status: 1,
        file: 'dist/index.html',
        rule: 'doctype',
    },
    {
        name: 'selectors',
        check: 'site/purgecss',
        analyze: purgecss,
        report: () => [{ file: 'style.css', rejected: ['.unused'] }],
        corrected: [{ file: 'style.css', rejected: [] }],
        status: 0,
        file: 'dist/style.css',
        rule: 'dead-selector',
    },
];

test('push builds preserve tracked dist bytes and Git status', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SITE_POLICY,
        '.gitignore': '.gspot/\n',
        'build.js': SITE_BUILD_SCRIPT,
        'dist/index.html': 'committed output\n',
    });
    commitAll(sandbox.path);
    const outcome = await runGspot(sandbox.path, [
        'check',
        '--only',
        'site/build',
        'site/build-reproducible',
        '--json',
    ]);
    expect(outcome.code, outcome.stdout + outcome.stderr).toBe(0);
    expect(gitOutput(sandbox.path, ['status', '--porcelain=v1'])).toBe('');
    expect(await Bun.file(join(sandbox.path, 'dist/index.html')).text()).toBe('committed output\n');
});

describe('site build reproducibility', () => {
    test('the second build preserves the output shared with other checks', async () => {
        await using sandbox = await testdir();
        using resources = new DisposableStack();
        await createFileTree(sandbox.path, {
            'gspot.toml': SITE_POLICY,
            'build.js': SITE_BUILD_SCRIPT,
            'dist/index.html': 'edited output',
        });
        await chmod(join(sandbox.path, 'dist/index.html'), 0o640);
        const request = buildCheckInput(await openSession(sandbox.path), 'site/build-reproducible', {
            paths: ['build.js'],
            resources: resources,
        });
        const first = await cachedBuild(request);
        const before = await readFile(join(first.output, 'index.html'), 'utf8');
        expect(first.isBuilt).toBe(true);
        expect(await buildReproducible(request)).toStrictEqual([]);
        expect(await readFile(join(first.output, 'index.html'), 'utf8')).toBe(before);
        expect(await readFile(join(sandbox.path, 'dist/index.html'), 'utf8')).toBe('edited output');
        // Windows keeps no POSIX mode bits, so the file stays at its default there.
        const output = await stat(join(sandbox.path, 'dist/index.html'));
        expect(output.mode & 0o777).toBe(process.platform === 'win32' ? 0o666 : 0o640);
        resources.dispose();
        expect(await pathExists(first.cwd)).toBe(false);
    });

    test('the first build does not import an unrelated working-tree input', async () => {
        await using sandbox = await testdir();
        using resources = new DisposableStack();
        await createFileTree(sandbox.path, {
            'gspot.toml': SITE_POLICY,
            'local-input.txt': 'Only available in the working tree.',
            'build.js': `import { readFileSync } from 'node:fs';
readFileSync('local-input.txt');
${SITE_BUILD_SCRIPT}`,
        });
        const request = buildCheckInput(await openSession(sandbox.path), 'site/build-reproducible', {
            paths: ['build.js'],
            resources: resources,
        });
        const first = await cachedBuild(request);
        expect(first.isBuilt).toBe(false);
        expect(first.outputTail).toContain('local-input.txt');
        const corrected = await cachedBuild(
            buildCheckInput(await openSession(sandbox.path), 'site/build-reproducible', {
                paths: ['build.js', 'local-input.txt'],
                resources: resources,
            }),
        );
        expect(corrected.isBuilt).toBe(true);
        expect(await pathExists(join(sandbox.path, 'dist'))).toBe(false);
        expect(await readFile(join(sandbox.path, 'local-input.txt'), 'utf8')).toBe(
            'Only available in the working tree.',
        );
    });
});

test('a failed reproducibility build retains the first isolated output', async () => {
    await using sandbox = await testdir();
    using resources = new DisposableStack();
    await createFileTree(sandbox.path, {
        'gspot.toml': SITE_POLICY,
        'build.js': `${SITE_BUILD_SCRIPT}
if (existsSync('built-once')) throw new Error('Test build failure');
writeFileSync('built-once', 'yes');`,
    });
    const request = buildCheckInput(await openSession(sandbox.path), 'site/build-reproducible', {
        paths: ['build.js'],
        resources: resources,
    });
    const first = await cachedBuild(request);
    expect(first.isBuilt).toBe(true);
    expect(await rejection(buildReproducible(request))).toContain('The second site build failed');
    expect(await readFile(join(first.output, 'index.html'), 'utf8')).toBe('first');
    expect(await pathExists(join(sandbox.path, 'dist'))).toBe(false);
});

test.each([
    {
        name: 'keeps the absolute source path fixed',
        script: "import {mkdirSync,writeFileSync} from 'node:fs'; mkdirSync('dist'); writeFileSync('dist/index.html',process.cwd());",
        findings: [],
    },
    {
        name: 'reports output files that appear and disappear',
        script: `import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
const second = existsSync('built-once');
mkdirSync('dist', {recursive:true});
writeFileSync(second ? 'dist/later.html' : 'dist/earlier.html', 'built');
writeFileSync('built-once', 'yes');`,
        findings: [
            { file: 'dist/earlier.html', rule: 'not-reproducible' },
            { file: 'dist/later.html', rule: 'not-reproducible' },
        ],
    },
])('reproducibility $name', async ({ script, findings: expected }) => {
    await using sandbox = await testdir();
    using resources = new DisposableStack();
    await createFileTree(sandbox.path, { 'gspot.toml': SITE_POLICY, 'build.js': script });
    const input = buildCheckInput(await openSession(sandbox.path), 'site/build-reproducible', {
        paths: ['build.js'],
        resources,
    });
    const findings = await buildReproducible(input);
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([...expected]);
    expect(await readFile(join(sandbox.path, 'build.js'), 'utf8')).toBe(script);
    expect(await pathExists(join(sandbox.path, 'built-once'))).toBe(false);
    expect(await pathExists(join(sandbox.path, 'dist'))).toBe(false);
});

test.each([0, 7])('a run cleans isolated site output after build exit %i', async (code) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SITE_POLICY,
        'build.js': SITE_BUILD_SCRIPT,
        'dist/index.html': 'authored output',
    });
    const session = await openSession(sandbox.path);
    let cwd = '';
    const run = spyOn(processes, 'run').mockImplementation(async (_argv, options) => {
        cwd = options.cwd!;
        await mkdir(join(cwd, 'dist'), { recursive: true });
        await writeFile(join(cwd, 'dist/index.html'), 'isolated output');
        return {
            code,
            stdout: '',
            stderr: code === 0 ? '' : 'Test build failure',
            missing: false,
            duration: 1,
        };
    });
    try {
        const outcome = await executeRun(session, buildRunOptions({ only: ['site/build'] }));
        expect(outcome.report.exitCode).toBe(code === 0 ? 0 : 1);
        expect(cwd).not.toBe(sandbox.path);
        expect(cwd).not.toBe('');
        expect(await pathExists(cwd)).toBe(false);
        expect(await readFile(join(sandbox.path, 'dist/index.html'), 'utf8')).toBe('authored output');
    } finally {
        run.mockRestore();
    }
});

test('site output inventory refuses external links and passes after the fix', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SITE_POLICY,
        'dist/local.txt': 'local',
        'external.txt': 'external',
    });
    const link = join(sandbox.path, 'dist/linked.txt');
    await symlink('../external.txt', link);
    expect(() => filesUnder(join(sandbox.path, 'dist'))).toThrow('Source link leaves the repository');
    await unlink(link);
    await symlink('local.txt', link);
    expect(filesUnder(join(sandbox.path, 'dist'))).toStrictEqual(['linked.txt', 'local.txt']);
});

test.each(SITE_REPORTS)(
    '$name rejects fatal, absent, and malformed reports and handles findings before and after fixes',
    async ({ analyze, check, report, status, file, rule, corrected }) => {
        await using sandbox = await testdir();
        using resources = new DisposableStack();
        await createFileTree(sandbox.path, { 'gspot.toml': SITE_POLICY, 'build.js': SITE_BUILD_SCRIPT });
        const request = buildCheckInput(await openSession(sandbox.path), check, {
            paths: ['build.js'],
            resources: resources,
        });
        const build = await cachedBuild(request);
        await writeFile(join(build.output, 'style.css'), 'body { color: red; }');
        let code = 2;
        let stdout = '';
        const command = spyOn(toolRunner, 'runCheckTool').mockImplementation(async (_input, argv) => {
            if (Array.isArray(argv)) {
                const formatter = argv.find((argument) => argument.startsWith('json='));
                if (formatter !== undefined) await writeFile(formatter.slice('json='.length), stdout);
            }
            return { code, stdout, stderr: 'Test tool diagnostic', missing: false, duration: 1 };
        });
        try {
            await rejection(analyze(request));
            code = 0;
            for (const invalid of ['', '{ broken', '{}']) {
                stdout = invalid;
                await rejection(analyze(request));
            }
            stdout = JSON.stringify(report(build.output));
            code = status;
            expect(await analyze(request)).toMatchObject([{ check: request.check.name, file, line: 1, rule }]);
            code = 0;
            stdout = JSON.stringify(corrected);
            expect(await analyze(request)).toStrictEqual([]);
        } finally {
            command.mockRestore();
        }
    },
);

test('scoped site builds reuse only declared workspace sources for both native builds', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], {
            tables: '[scope.web]\nconfigurations = ["site", "javascript"]\n[scope.web.site]\nbuild_command = ["bun", "build.js"]\n',
        }),
        'package.json': '{"private":true,"workspaces":["web","packages/*"]}',
        'web/package.json': '{"name":"web","type":"module","dependencies":{"core":"workspace:*"}}',
        'web/build.js':
            'import {mkdirSync,writeFileSync} from "node:fs"; import {value} from "core"; mkdirSync("dist"); writeFileSync("dist/index.html",value);',
        'packages/core/package.json': '{"name":"core","type":"module","main":"value.js"}',
        'packages/core/value.js': 'export const value = "<h1>Workspace site</h1>";',
        'packages/unused/package.json': '{"name":"unused"}',
        'packages/unused/private.txt': 'Unrelated site bytes',
    });
    await mkdir(join(sandbox.path, 'node_modules'));
    await symlink('../packages/core', join(sandbox.path, 'node_modules/core'));
    await symlink('../packages/unused', join(sandbox.path, 'node_modules/unused'));
    using resources = new DisposableStack();
    const session = await openSession(sandbox.path);
    const input = buildCheckInput(session, 'site/build', { scope: 'web', resources });
    const built = await cachedBuild(input);
    expect(built.isBuilt, built.outputTail).toBe(true);
    expect(await readFile(join(built.output, 'index.html'), 'utf8')).toBe('<h1>Workspace site</h1>');
    expect(await pathExists(join(built.cwd, '../packages/unused/private.txt'))).toBe(false);
    expect(await buildReproducible(input)).toStrictEqual([]);
    expect(await pathExists(join(sandbox.path, 'web/dist'))).toBe(false);
    expect(await readFile(join(sandbox.path, 'packages/core/value.js'), 'utf8')).toBe(
        'export const value = "<h1>Workspace site</h1>";',
    );
});
