import * as toolRunner from '#cli/run/tool-runner.ts';
import { internalLinks, builtMarkup, deadSelectors } from '#cli/checks/static-site/output-checks.ts';
import { siteBuild } from '#cli/checks/static-site/build.ts';
import * as processes from '#cli/platform/spawn.ts';
import { siteInput, SITE_BUILD } from '#tests/support/cli/site.ts';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { expect, spyOn, test } from 'bun:test';

test.each([
    ['links', internalLinks],
    ['markup', builtMarkup],
    ['selectors', deadSelectors],
] as const)('native %s output reports a defect and accepts its correction', async (name, analyze) => {
    await using sandbox = await testdir();
    using resources = new DisposableStack();
    await createFileTree(sandbox.path, { 'build.js': SITE_BUILD });
    const request = await siteInput(sandbox.path, ['build.js'], resources);
    const build = await siteBuild(request);
    const page = (body: string) =>
        `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body>${body}</body></html>`;
    await createFileTree(sandbox.path, {
        '.gspot/html-validate-built.json': '{"extends":["html-validate:recommended"]}',
    });
    writeFileSync(
        join(build.output, 'index.html'),
        page(
            name === 'links'
                ? '<a href="/missing.html">Missing</a>'
                : name === 'markup'
                  ? '<img src="image.png">'
                  : '<p>Example</p>',
        ),
    );
    writeFileSync(join(build.output, 'style.css'), '.unused { color: red; }');
    const command = spyOn(toolRunner, 'runCheckCommand').mockImplementation(async (_input, argv, options) =>
        processes.run([join(import.meta.dir, '../../../node_modules/.bin', argv[0]!), ...argv.slice(1)], {
            ...options,
            timeoutMs: 10000,
        }),
    );
    try {
        const findings = await analyze(request);
        expect(findings.length).toBeGreaterThan(0);
        writeFileSync(join(build.output, 'index.html'), page('<p class="unused">Example</p>'));
        expect(await analyze(request)).toEqual([]);
    } finally {
        command.mockRestore();
    }
});
