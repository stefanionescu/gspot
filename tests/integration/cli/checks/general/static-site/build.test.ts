import { join } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { siteInput } from '#tests/harness/cli/site.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { test, spyOn, expect, describe } from 'bun:test';
import { SITE_BUILD } from '#tests/samples/static-site.ts';
import { rejection } from '#tests/harness/expectations.ts';
import * as toolRunner from '#cli/execution/tool/runner.ts';
import { commitAll, gitOutput } from '#tests/harness/cli/git.ts';
import { runGspot, runOptions } from '#tests/harness/cli/command.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';
import { brokenLinks, builtMarkup, deadSelectors } from '#cli/checks/general/static-site/output.ts';
import { siteBuild, filesUnder, buildReproducible } from '#cli/checks/general/static-site/build.ts';

import {
    statSync,
    chmodSync,
    mkdirSync,
    existsSync,
    unlinkSync,
    symlinkSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';

const SITE_REPORTS: {
    name: string;
    analyze: (input: EngineInput) => Promise<Finding[]>;
    defect: (output: string) => Record<string, unknown> | Record<string, unknown>[];
    corrected: Record<string, unknown> | Record<string, unknown>[];
    status: number;
    file: string;
    rule: string;
}[] = [
    {
        name: 'links',
        analyze: (input) => brokenLinks(input, false),
        defect: () => ({
            links: [{ url: 'https://example.com/missing', parent: 'index.html', state: 'BROKEN', status: 404 }],
        }),
        corrected: { links: [] },
        status: 1,
        file: 'index.html',
        rule: 'broken-link',
    },
    {
        name: 'markup',
        analyze: builtMarkup,
        defect: (output: string) => [
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
        analyze: deadSelectors,
        defect: () => [{ file: 'style.css', rejected: ['.unused'] }],
        corrected: [{ file: 'style.css', rejected: [] }],
        status: 0,
        file: 'dist/style.css',
        rule: 'dead-selector',
    },
];

test('push builds preserve tracked dist bytes and Git status', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['static-site'], '[tools.site]\nbuild = "bun build.js"\n', 'all'),
        '.gitignore': '.gspot/\n',
        'build.js': SITE_BUILD,
        'dist/index.html': 'committed output\n',
    });
    commitAll(sandbox.path);
    const outcome = await runGspot(sandbox.path, [
        'check',
        '--stage',
        'push',
        '--only',
        'static-site/build',
        'static-site/build-reproducible',
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
        await createFileTree(sandbox.path, { 'build.js': SITE_BUILD, 'dist/index.html': 'edited output' });
        chmodSync(join(sandbox.path, 'dist/index.html'), 0o640);
        const request = await siteInput(sandbox.path, ['build.js'], resources);
        const first = await siteBuild(request);
        const before = readFileSync(join(first.output, 'index.html'), 'utf8');
        expect(first.isBuilt).toBe(true);
        expect(await buildReproducible(request)).toStrictEqual([]);
        expect(readFileSync(join(first.output, 'index.html'), 'utf8')).toBe(before);
        expect(readFileSync(join(sandbox.path, 'dist/index.html'), 'utf8')).toBe('edited output');
        // Windows keeps no POSIX mode bits, so the file stays at its default there.
        expect(statSync(join(sandbox.path, 'dist/index.html')).mode & 0o777).toBe(
            process.platform === 'win32' ? 0o666 : 0o640,
        );
        resources.dispose();
        expect(existsSync(first.cwd)).toBe(false);
    });

    test('the first build does not import an unrelated working-tree input', async () => {
        await using sandbox = await testdir();
        using resources = new DisposableStack();
        await createFileTree(sandbox.path, {
            'local-input.txt': 'Only available in the working tree.',
            'build.js': `import { readFileSync } from 'node:fs';
readFileSync('local-input.txt');
${SITE_BUILD}`,
        });
        const request = await siteInput(sandbox.path, ['build.js'], resources);
        const first = await siteBuild(request);
        expect(first.isBuilt).toBe(false);
        expect(first.said).toContain('local-input.txt');
        const corrected = await siteBuild(await siteInput(sandbox.path, ['build.js', 'local-input.txt'], resources));
        expect(corrected.isBuilt).toBe(true);
        expect(existsSync(join(sandbox.path, 'dist'))).toBe(false);
        expect(readFileSync(join(sandbox.path, 'local-input.txt'), 'utf8')).toBe('Only available in the working tree.');
    });
});

test('a failed reproducibility build retains the first isolated output', async () => {
    await using sandbox = await testdir();
    using resources = new DisposableStack();
    await createFileTree(sandbox.path, { 'build.js': SITE_BUILD });
    const request = await siteInput(sandbox.path, ['build.js'], resources);
    const first = await siteBuild(request);
    expect(first.isBuilt).toBe(true);
    writeFileSync(join(sandbox.path, 'build.js'), 'throw new Error("Planted build failure");');
    expect(await rejection(buildReproducible(request))).toContain('The second site build failed');
    expect(readFileSync(join(first.output, 'index.html'), 'utf8')).toBe('first');
    expect(existsSync(join(sandbox.path, 'dist'))).toBe(false);
});

test.each([0, 7])('a run cleans isolated site output after build exit %i', async (code) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['static-site'], '[tools.site]\nbuild = "bun build.js"\n', 'all'),
        'build.js': SITE_BUILD,
        'dist/index.html': 'authored output',
    });
    const session = await openSession(sandbox.path);
    let cwd = '';
    const run = spyOn(processes, 'run').mockImplementation((_argv, options) => {
        cwd = options.cwd!;
        mkdirSync(join(cwd, 'dist'), { recursive: true });
        writeFileSync(join(cwd, 'dist/index.html'), 'isolated output');
        return Promise.resolve({
            code,
            stdout: '',
            stderr: code === 0 ? '' : 'Planted build failure',
            missing: false,
            duration: 1,
        });
    });
    try {
        const outcome = await executeRun(session, runOptions({ only: ['static-site/build'] }));
        expect(outcome.report.exitCode).toBe(code === 0 ? 0 : 1);
        expect(cwd).not.toBe(sandbox.path);
        expect(cwd).not.toBe('');
        expect(existsSync(cwd)).toBe(false);
        expect(readFileSync(join(sandbox.path, 'dist/index.html'), 'utf8')).toBe('authored output');
    } finally {
        run.mockRestore();
    }
});

test('site output inventory refuses external links and accepts corrected assets', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'dist/local.txt': 'local', 'external.txt': 'external' });
    const link = join(sandbox.path, 'dist/linked.txt');
    symlinkSync('../external.txt', link);
    expect(() => filesUnder(join(sandbox.path, 'dist'))).toThrow('Source link leaves the repository');
    unlinkSync(link);
    symlinkSync('local.txt', link);
    expect(filesUnder(join(sandbox.path, 'dist'))).toStrictEqual(['linked.txt', 'local.txt']);
});

test.each(SITE_REPORTS)(
    '$name rejects fatal, absent, and malformed reports and accepts defects and corrections',
    async ({ analyze, defect, status, file, rule, corrected }) => {
        await using sandbox = await testdir();
        using resources = new DisposableStack();
        await createFileTree(sandbox.path, { 'build.js': SITE_BUILD });
        const request = await siteInput(sandbox.path, ['build.js'], resources);
        const build = await siteBuild(request);
        writeFileSync(join(build.output, 'style.css'), 'body { color: red; }');
        let code = 2;
        let stdout = '';
        const command = spyOn(toolRunner, 'runCheckCommand').mockImplementation(() =>
            Promise.resolve({
                code,
                stdout,
                stderr: 'Planted tool diagnostic',
                missing: false,
                duration: 1,
            }),
        );
        try {
            await rejection(analyze(request));
            code = 0;
            for (const invalid of ['', '{ broken', '{}']) {
                stdout = invalid;
                await rejection(analyze(request));
            }
            stdout = JSON.stringify(defect(build.output));
            code = status;
            expect(await analyze(request)).toMatchObject([{ check: request.spec.name, file, line: 1, rule }]);
            code = 0;
            stdout = JSON.stringify(corrected);
            expect(await analyze(request)).toStrictEqual([]);
        } finally {
            command.mockRestore();
        }
    },
);
