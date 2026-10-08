// Sandbox for the site configuration: a small site with a build script, broken one way for each check.
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { initRepository } from '#tests/harness/install.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { buildInitArguments } from '#tests/harness/init.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { runGspot, spawnGspot } from '#tests/harness/gspot.ts';
import { linkinator } from '#cli/checks/general/site/public.ts';
import { cachedBuild } from '#cli/checks/general/site/contracts.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { SITE_POLICY, SITE_BUILD_SCRIPT } from '#tests/config/samples/site.ts';
import type { SiteOutputCase } from '#tests/types/tools/configurations/general/site.ts';
import { createTestRepository, prepareTestRepository } from '#tests/harness/repository.ts';

import {
    COMMAND,
    LINK_CASES,
    REPOSITORY,
    OUTPUT_CASES,
    USED_SELECTOR_CSS,
    USED_SELECTOR_BODY,
    REVIEWED_SELECTOR_POLICY,
} from '#tests/config/tools/configurations/general/site.ts';

const resources = new AsyncDisposableStack();
let testRepository: OwnedTestRepository;
beforeAll(async () => {
    testRepository = resources.use(await createTestRepository(REPOSITORY, spawnGspot, prepareTestRepository));
});
afterAll(async () => {
    await resources.disposeAsync();
});

describe('the site configuration', () => {
    test('the default check inspects the built site without selecting external links', async () => {
        const { root, environment } = testRepository;
        const checked = await spawnGspot(root, ['check', '--json'], environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        const report = JSON.parse(checked.stdout) as RunReport;
        expect(report.checks.map(({ check }) => check)).not.toContain('site/linkinator-external');
        expect(report.checks).toContainEqual(containing({ check: 'site/build', status: 'passed' }));
    });
});
async function inspectSiteOutput(scenario: SiteOutputCase): Promise<void> {
    const { check, body, finding } = scenario;
    const analyze = {
        'site/linkinator': linkinator,
        'site/html-validate': BUILT_IN_CHECKS['site/html-validate'].input,
        'site/purgecss': BUILT_IN_CHECKS['site/purgecss'].input,
    }[check];
    const { root, environment } = testRepository;
    using resources = new DisposableStack();
    const policy =
        scenario.level === undefined
            ? SITE_POLICY
            : SITE_POLICY.replace('all', scenario.level) + REVIEWED_SELECTOR_POLICY;
    await createFileTree(root, { 'gspot.toml': policy, 'build.js': SITE_BUILD_SCRIPT });
    const applied = await runGspot(root, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const session = await openSession(root);
    const request = buildCheckInput(session, check, {
        paths: ['build.js'],
        resources: resources,
    });
    const build = await cachedBuild(request);
    if (scenario.files !== undefined) await createFileTree(build.output, scenario.files);
    await createFileTree(build.output, {
        'index.html': `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body>${body}</body></html>`,
        'style.css': check === 'site/purgecss' ? USED_SELECTOR_CSS : '.unused { color: red; }',
    });
    const findings = await analyze(request, false);
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
        const large = await analyze(request, false);
        expect(large).toHaveLength(400);
        expect(large.at(-1)).toMatchObject(finding);
    }
    if (scenario.files !== undefined)
        await writeFile(join(build.output, 'orphan.html'), scenario.files['orphan.html'].replace('#missing', '#good'));
    await writeFile(
        join(build.output, 'index.html'),
        `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body>${check === 'site/purgecss' ? USED_SELECTOR_BODY : ''}<p class="unused">Example</p></body></html>`,
    );
    expect(await analyze(request, false)).toStrictEqual([]);
}

describe('site links', () => {
    test.each(LINK_CASES)('native $name output reports its finding and passes after the fix', inspectSiteOutput);
});

describe('site markup and selectors', () => {
    test.each(OUTPUT_CASES)('native $name output reports its finding and passes after the fix', inspectSiteOutput);
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
