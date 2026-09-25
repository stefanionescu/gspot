import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import * as toolRunner from '#cli/execution/tool-runner.ts';
import { siteBuild } from '#cli/checks/static-site/build.ts';
import { siteInput, SITE_BUILD } from '#tests/support/cli/site.ts';
import { internalLinks, builtMarkup, deadSelectors } from '#cli/checks/static-site/output-checks.ts';

test.each([
    ['links', internalLinks],
    ['markup', builtMarkup],
    ['selectors', deadSelectors],
] as const)('native %s output reports a defect and accepts its correction', async (name, analyze) => {
    await using sandbox = await testdir();
    using resources = new DisposableStack();
    await createFileTree(sandbox.path, { 'build.js': SITE_BUILD });
    const request = await siteInput(sandbox.path, ['build.js'], resources);
    const check =
        name === 'links'
            ? 'static-site/links-internal'
            : name === 'markup'
              ? 'static-site/html-validate-built'
              : 'css/dead-selectors';
    request.spec = [...request.manifests.values()]
        .flatMap((manifest) => manifest.checks)
        .find((spec) => spec.name === check)!;
    const build = await siteBuild(request);
    const page = (body: string) =>
        `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Example</title></head><body>${body}</body></html>`;
    await createFileTree(sandbox.path, {
        '.gspot/config/html-validate-built.json': '{"extends":["html-validate:recommended"]}',
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
        processes.run([join(import.meta.dir, '../../../../node_modules/.bin', argv[0]!), ...argv.slice(1)], {
            ...options,
            timeoutMs: 10_000,
        }),
    );
    try {
        const findings = await analyze(request);
        expect(findings).toMatchObject([
            name === 'links'
                ? { check, file: './', rule: 'broken-link', line: 1, message: 'missing.html answers 404.' }
                : name === 'markup'
                  ? { file: 'dist/index.html', rule: 'wcag/h37', line: 1 }
                  : {
                        file: 'dist/style.css',
                        rule: 'dead-selector',
                        line: 1,
                        message: 'No built page uses the selector .unused.',
                    },
        ]);
        writeFileSync(join(build.output, 'index.html'), page('<p class="unused">Example</p>'));
        expect(await analyze(request)).toStrictEqual([]);
    } finally {
        command.mockRestore();
    }
});
