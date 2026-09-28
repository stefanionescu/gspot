import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { SITE_BUILD } from '#tests/constants/cli.ts';
import { siteInput } from '#tests/support/cli/site.ts';
import * as toolRunner from '#cli/execution/tool/runner.ts';
import { siteBuild } from '#cli/checks/static-site/build.ts';
import { builtMarkup, deadSelectors, internalLinks } from '#cli/checks/static-site/output-checks.ts';

test.each([
    {
        name: 'links',
        analyze: internalLinks,
        check: 'static-site/links-internal',
        body: '<a href="/missing.html">Missing</a>',
        finding: {
            check: 'static-site/links-internal',
            file: './',
            rule: 'broken-link',
            line: 1,
            message: 'missing.html answers 404.',
        },
    },
    {
        name: 'markup',
        analyze: builtMarkup,
        check: 'static-site/html-validate-built',
        body: '<img src="image.png">',
        finding: { file: 'dist/index.html', rule: 'wcag/h37', line: 1 },
    },
    {
        name: 'selectors',
        analyze: deadSelectors,
        check: 'css/dead-selectors',
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
    await createFileTree(sandbox.path, { 'build.js': SITE_BUILD });
    const request = await siteInput(sandbox.path, ['build.js'], resources);
    request.spec = [...request.manifests.values()]
        .flatMap((manifest) => manifest.checks)
        .find((spec) => spec.name === check)!;
    const build = await siteBuild(request);
    await createFileTree(sandbox.path, {
        '.gspot/config/html-validate-built.json': '{"extends":["html-validate:recommended"]}',
    });
    writeFileSync(
        join(build.output, 'index.html'),
        `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body>${body}</body></html>`,
    );
    writeFileSync(join(build.output, 'style.css'), '.unused { color: red; }');
    const command = spyOn(toolRunner, 'runCheckCommand').mockImplementation(async (_input, argv, options) =>
        processes.run([join(import.meta.dir, '../../../../node_modules/.bin', argv[0]!), ...argv.slice(1)], {
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
