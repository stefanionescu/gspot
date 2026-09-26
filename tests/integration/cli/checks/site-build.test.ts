import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { planRun } from '#cli/execution/planning/plan.ts';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { siteInput } from '#tests/support/cli/site.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { describe, expect, spyOn, test } from 'bun:test';
import { rejection } from '#tests/support/expectations.ts';
import * as toolRunner from '#cli/execution/tool-runner.ts';
import { SITE_BUILD } from '#tests/constants/support/cli.ts';
import { buildReproducible, siteBuild, filesUnder } from '#cli/checks/static-site/build.ts';
import { internalLinks, builtMarkup, deadSelectors } from '#cli/checks/static-site/output-checks.ts';

import {
    readFileSync,
    existsSync,
    writeFileSync,
    chmodSync,
    statSync,
    mkdirSync,
    symlinkSync,
    unlinkSync,
} from 'node:fs';

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
        expect(statSync(join(sandbox.path, 'dist/index.html')).mode & 0o777).toBe(0o640);
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
        'gspot.toml':
            'version = 1\nlevel = "all"\nconfigurations = ["static-site"]\n[tools.site]\nbuild = "bun build.js"\n',
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
        const outcome = await executeRun(session, {
            stage: 'all',
            skips: [],
            only: ['static-site/build'],
            fix: false,
            isDryRun: false,
            noCache: true,
        });
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

test.each([
    ['links', internalLinks],
    ['markup', builtMarkup],
    ['selectors', deadSelectors],
] as const)(
    '%s rejects fatal, absent, and malformed reports and accepts defects and corrections',
    async (name, analyze) => {
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
            stdout = JSON.stringify(
                name === 'links'
                    ? {
                          links: [
                              {
                                  url: 'https://example.com/missing',
                                  parent: 'index.html',
                                  state: 'BROKEN',
                                  status: 404,
                              },
                          ],
                      }
                    : name === 'markup'
                      ? [
                            {
                                filePath: join(build.output, 'index.html'),
                                messages: [{ ruleId: 'doctype', line: 1, message: 'Missing doctype.' }],
                            },
                        ]
                      : [{ file: 'style.css', rejected: ['.unused'] }],
            );
            code = name === 'selectors' ? 0 : 1;
            expect(await analyze(request)).toMatchObject([
                {
                    check: request.spec.name,
                    file: name === 'links' ? 'index.html' : name === 'markup' ? 'dist/index.html' : 'dist/style.css',
                    line: 1,
                    rule: name === 'links' ? 'broken-link' : name === 'markup' ? 'doctype' : 'dead-selector',
                },
            ]);
            code = 0;
            stdout = JSON.stringify(
                name === 'links' ? { links: [] } : name === 'markup' ? [] : [{ file: 'style.css', rejected: [] }],
            );
            expect(await analyze(request)).toStrictEqual([]);
        } finally {
            command.mockRestore();
        }
    },
);

test('site builds receive quoted script names and empty arguments', async () => {
    await using sandbox = await testdir();
    using resources = new DisposableStack();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            level: 'all',
            configurations: ['static-site'],
            tools: { site: { build: 'bun "build site.js" "" "two words"' } },
        }),
        'build site.js': `if (process.argv[2] !== '' || process.argv[3] !== 'two words') throw new Error('Lost arguments');\n${SITE_BUILD}`,
    });
    const session = await openSession(sandbox.path);
    session.resources = resources;
    const [planned] = await planRun(session, { stage: 'push', skips: [], only: ['static-site/build'] });
    const request = engineInput(session, planned!);
    const built = await siteBuild(request);
    expect(built.isBuilt).toBe(true);
});
