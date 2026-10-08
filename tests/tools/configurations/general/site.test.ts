// Sandbox for the site configuration: a small site with a build script, broken one way for each check.
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { assetPath } from '#cli/platform/assets.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { initRepository } from '#tests/harness/install.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { buildInitArguments } from '#tests/harness/init.ts';
import { containing } from '#tests/harness/expectations.ts';
import { testModules } from '#tests/harness/environment.ts';
import * as toolRunner from '#cli/execution/command/check.ts';
import { cachedBuild } from '#cli/checks/general/site/build.ts';
import type { RunReport, CheckInput } from '#cli/types/execution/check.ts';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { test, spyOn, expect, afterAll, describe, beforeAll } from 'bun:test';
import { SITE_POLICY, SITE_BUILD_SCRIPT } from '#tests/config/samples/site.ts';
import { purgecss, linkinator, htmlValidate } from '#cli/checks/general/site/output.ts';
import type { CheckToolOptions, CheckToolProgram } from '#cli/types/execution/command.ts';
import { createTestRepository, prepareTestRepository } from '#tests/harness/repository.ts';

import {
    COMMAND,
    REPOSITORY,
    ORPHAN_SITE_FILES,
    USED_SELECTOR_CSS,
    USED_SELECTOR_BODY,
    REVIEWED_SELECTOR_POLICY,
} from '#tests/config/tools/configurations/general/site.ts';

describe('the site configuration', () => {
    const resources = new AsyncDisposableStack();
    let testRepository: OwnedTestRepository;
    beforeAll(async () => {
        testRepository = resources.use(await createTestRepository(REPOSITORY, spawnGspot, prepareTestRepository));
    });
    afterAll(async () => {
        await resources.disposeAsync();
    });

    test('the default check inspects the built site without selecting external links', async () => {
        const { root, environment } = testRepository;
        const checked = await spawnGspot(root, ['check', '--json'], environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        const report = JSON.parse(checked.stdout) as RunReport;
        expect(report.checks.map(({ check }) => check)).not.toContain('site/linkinator-external');
        expect(report.checks).toContainEqual(containing({ check: 'site/build', status: 'passed' }));
    });
});

// Recommended savings thresholds and strict optimization both pass after the fix.
async function expectSvgThresholds(root: string, svg: string): Promise<void> {
    await Bun.write(join(root, 'icon.svg'), `${svg} `);
    const small = await spawnGspot(root, COMMAND);
    expect(small.code, small.stdout + small.stderr).toBe(0);
    await Bun.write(join(root, 'icon.svg'), svg + ' '.repeat(Buffer.byteLength(svg)));
    const large = await spawnGspot(root, COMMAND);
    expect(large.code, large.stdout + large.stderr).toBe(1);
    expect((JSON.parse(large.stdout) as RunReport).checks[0]!.findings).toStrictEqual([
        containing({ file: 'icon.svg', rule: 'unoptimized' }),
    ]);
    await Bun.write(join(root, 'icon.svg'), `${svg} `);
    const configured = await spawnGspot(root, ['set', 'level', 'all']);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    const strict = await spawnGspot(root, COMMAND);
    expect(strict.code, strict.stdout + strict.stderr).toBe(1);
    const relaxed = await spawnGspot(root, [
        'set',
        'tools.svgo.min_saving_percent',
        '100',
        '--reason',
        'Required optimization threshold for generated SVG assets.',
    ]);
    expect(relaxed.code, relaxed.stdout + relaxed.stderr).toBe(0);
    await Bun.write(join(root, 'icon.svg'), svg + ' '.repeat(Buffer.byteLength(svg)));
    const allowed = await spawnGspot(root, COMMAND);
    expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
    const tightened = await spawnGspot(root, ['set', 'tools.svgo.min_saving_percent', '0']);
    expect(tightened.code, tightened.stdout + tightened.stderr).toBe(0);
    await Bun.write(join(root, 'icon.svg'), `${svg} `);
    const restored = await spawnGspot(root, COMMAND);
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    await Bun.write(join(root, 'icon.svg'), svg);
    const corrected = await spawnGspot(root, COMMAND);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'site/svgo', status: 'passed', fileCount: 1, findings: [] },
    ]);
}

// Explicit file selection excludes malformed neighbors, which fail when selected.
async function expectSvgSelection(root: string, svg: string): Promise<void> {
    const configured = await spawnGspot(root, ['set', 'level', 'all']);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    await Bun.write(join(root, 'icon.svg'), svg);
    await Bun.write(join(root, 'other.svg'), '<svg><broken>');
    // A path goes before --only, which takes every word up to the next command option.
    const selected = await spawnGspot(root, ['check', 'icon.svg', ...COMMAND.slice(1)]);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const malformed = await spawnGspot(root, COMMAND);
    expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
    expect((JSON.parse(malformed.stdout) as RunReport).checks[0]!.status).toBe('error');
    await Bun.write(join(root, 'other.svg'), svg);
    const repaired = await spawnGspot(root, COMMAND);
    expect(repaired.code, repaired.stdout + repaired.stderr).toBe(0);
    expect((JSON.parse(repaired.stdout) as RunReport).checks).toMatchObject([
        { check: 'site/svgo', status: 'passed', fileCount: 2, findings: [] },
    ]);
}

test('native SVG optimization enforces both level thresholds and explicit file selection', async () => {
    await using sandbox = await testdir();
    const root = sandbox.path;
    await createFileTree(root, {
        'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8H0z"/></svg>\n',
    });
    await initRepository(root, buildInitArguments(['site']), {});
    const native = await runTestCommand(
        [join(root, '.gspot/node_modules/.bin/svgo'), '--input', 'icon.svg', '--output', '-'],
        { cwd: root },
    );
    expect(native.code, native.stdout + native.stderr).toBe(0);
    await expectSvgThresholds(root, native.stdout);
    await expectSvgSelection(root, native.stdout);
});

test.each([
    {
        name: 'links',
        analyze: (input: CheckInput) => linkinator(input, false),
        check: 'site/linkinator',
        body: '<a href="/missing.html">Missing</a>',
        finding: {
            check: 'site/linkinator',
            file: 'dist/index.html',
            rule: 'broken-link',
            line: 1,
            message: 'missing.html answers 404.',
        },
    },
    {
        name: 'fragments',
        analyze: (input: CheckInput) => linkinator(input, false),
        check: 'site/linkinator',
        body: '<h1 id="good">Good</h1><a href="#good">Good</a><a href="#missing">Missing</a><a name="encoded id"></a><a href="#encoded%20id">Encoded</a>',
        finding: {
            check: 'site/linkinator',
            file: 'dist/index.html',
            rule: 'broken-link',
            line: 1,
            message: 'index.html#missing has no matching fragment.',
        },
    },
    {
        name: 'public origins and orphan pages',
        analyze: (input: CheckInput) => linkinator(input, false),
        check: 'site/linkinator',
        body: '<p>Landing page</p>',
        files: ORPHAN_SITE_FILES,
        finding: {
            check: 'site/linkinator',
            file: 'dist/orphan.html',
            rule: 'broken-link',
            line: 1,
            message: 'orphan.html#missing has no matching fragment.',
        },
    },
    {
        name: 'markup',
        analyze: htmlValidate,
        check: 'site/html-validate',
        body: '<img src="image.png">',
        finding: { file: 'dist/index.html', rule: 'wcag/h37', line: 1 },
    },
    ...['recommended', 'all'].map((level) => ({
        name: `selectors at level ${level}`,
        level,
        analyze: purgecss,
        check: 'site/purgecss',
        body: USED_SELECTOR_BODY,
        finding: {
            file: 'dist/style.css',
            rule: 'dead-selector',
            line: 1,
            message: 'No built page uses the selector .unused.',
        },
    })),
])('native $name output reports its finding and passes after the fix', async (scenario) => {
    const { analyze, check, body, finding } = scenario;
    await using sandbox = await testdir();
    using resources = new DisposableStack();
    const policy =
        'level' in scenario ? SITE_POLICY.replace('all', scenario.level) + REVIEWED_SELECTOR_POLICY : SITE_POLICY;
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'build.js': SITE_BUILD_SCRIPT });
    const session = await openSession(sandbox.path);
    const request = buildCheckInput(session, check, {
        paths: ['build.js'],
        resources: resources,
    });
    const build = await cachedBuild(request);
    if ('files' in scenario) await createFileTree(build.output, scenario.files);
    await createFileTree(sandbox.path, {
        '.gspot/config/purgecss.config.mjs': emitAll(session).files.find(
            (file) => file.path === '.gspot/config/purgecss.config.mjs',
        )!.content,
        'gspot.toml': policy,
        '.gspot/config/html-validate-built.json': '{"extends":["html-validate:recommended"]}',
    });
    await createFileTree(build.output, {
        'index.html': `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body>${body}</body></html>`,
        'style.css': check === 'site/purgecss' ? USED_SELECTOR_CSS : '.unused { color: red; }',
    });
    resources.use(
        spyOn(toolRunner, 'runCheckTool').mockImplementation(
            async (_input: CheckInput, argv: string[] | CheckToolProgram, options: CheckToolOptions) =>
                processes.run(
                    Array.isArray(argv)
                        ? [join(testModules, '.bin', argv[0]!), ...argv.slice(1)]
                        : [process.execPath, assetPath(argv.entry), join(testModules, '.bin', argv.tool)],
                    options,
                ),
        ),
    );
    const findings = await analyze(request);
    expect(findings).toMatchObject(
        check === 'site/purgecss'
            ? [finding, { ...finding, message: 'No built page uses the selector .unused:focus-visible.' }]
            : [finding],
    );
    if (check === 'site/html-validate') {
        await writeFile(
            join(build.output, 'index.html'),
            `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body>${body.repeat(400)}</body></html>`,
        );
        const large = await analyze(request);
        expect(large).toHaveLength(400);
        expect(large.at(-1)).toMatchObject(finding);
    }
    if ('files' in scenario)
        await writeFile(join(build.output, 'orphan.html'), scenario.files['orphan.html'].replace('#missing', '#good'));
    await writeFile(
        join(build.output, 'index.html'),
        `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body>${check === 'site/purgecss' ? USED_SELECTOR_BODY : ''}<p class="unused">Example</p></body></html>`,
    );
    expect(await analyze(request)).toStrictEqual([]);
});
