import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { assetPath } from '#cli/platform/assets.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { testModules } from '#tests/harness/environment.ts';
import * as toolRunner from '#cli/execution/command/check.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { cachedBuild } from '#cli/checks/general/site/build.ts';
import { SITE_POLICY, SITE_BUILD_SCRIPT } from '#tests/config/samples/site.ts';
import { purgecss, linkinator, htmlValidate } from '#cli/checks/general/site/output.ts';
import type { CheckToolOptions, CheckToolProgram } from '#cli/types/execution/command.ts';

import {
    ORPHAN_SITE_FILES,
    USED_SELECTOR_CSS,
    USED_SELECTOR_BODY,
    REVIEWED_SELECTOR_POLICY,
} from '#tests/config/cli/checks/general/site/output.ts';

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
