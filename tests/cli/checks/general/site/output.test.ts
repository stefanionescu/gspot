import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { testModules } from '#tests/harness/environment.ts';
import * as toolRunner from '#cli/execution/command/check.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { cachedBuild } from '#cli/checks/general/site/build.ts';
import { SITE_POLICY, SITE_BUILD_SCRIPT } from '#tests/config/samples/site.ts';
import { purgecss, brokenLinks, htmlValidate } from '#cli/checks/general/site/output.ts';

test.each([
    {
        name: 'links',
        analyze: (input: CheckInput) => brokenLinks(input, false),
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
        name: 'markup',
        analyze: htmlValidate,
        check: 'site/html-validate',
        body: '<img src="image.png">',
        finding: { file: 'dist/index.html', rule: 'wcag/h37', line: 1 },
    },
    {
        name: 'selectors',
        analyze: purgecss,
        check: 'site/purgecss',
        body: '<p>Example</p>',
        finding: {
            file: 'dist/style.css',
            rule: 'dead-selector',
            line: 1,
            message: 'No built page uses the selector .unused.',
        },
    },
])('native $name output reports a defect and accepts its correction', async ({ analyze, check, body, finding }) => {
    await using sandbox = await testdir();
    using resources = new DisposableStack();
    await createFileTree(sandbox.path, { 'gspot.toml': SITE_POLICY, 'build.js': SITE_BUILD_SCRIPT });
    const request = buildCheckInput(await openSession(sandbox.path), 'site/build-reproducible', {
        paths: ['build.js'],
        resources: resources,
    });
    request.check = [...request.manifests.values()]
        .flatMap((manifest) => manifest.checks)
        .find((declaration) => declaration.name === check)!;
    const build = await cachedBuild(request);
    await createFileTree(sandbox.path, {
        'gspot.toml': SITE_POLICY,
        '.gspot/config/html-validate-built.json': '{"extends":["html-validate:recommended"]}',
    });
    writeFileSync(
        join(build.output, 'index.html'),
        `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body>${body}</body></html>`,
    );
    writeFileSync(join(build.output, 'style.css'), '.unused { color: red; }');
    const command = spyOn(toolRunner, 'runCheckTool').mockImplementation(async (_input, argv, options) =>
        processes.run([join(testModules, '.bin', argv[0]!), ...argv.slice(1)], {
            ...options,
            timeoutMs: 10_000,
        }),
    );
    try {
        const findings = await analyze(request);
        expect(findings).toMatchObject([finding]);
        writeFileSync(
            join(build.output, 'index.html'),
            `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body><p class="unused">Example</p></body></html>`,
        );
        expect(await analyze(request)).toStrictEqual([]);
    } finally {
        command.mockRestore();
    }
});
