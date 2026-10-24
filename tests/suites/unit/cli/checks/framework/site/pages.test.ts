import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';

import {
    SITE_SANDBOX,
    SITE_SETTINGS,
    BUILT_PAGE_CASES,
    INVALID_SITEMAP_URLS,
} from '#tests/config/checks/framework/site/pages.ts';

test.each(INVALID_SITEMAP_URLS)('site/sitemap reports %s as an invalid URL and site/lychee skips it', async (url) => {
    await using sandbox = await testdir({
        'gspot.toml': SITE_SETTINGS,
        'build.js':
            "import { mkdir, copyFile } from 'node:fs/promises'; await mkdir('dist'); await copyFile('sitemap.xml', 'dist/sitemap.xml');",
        'sitemap.xml': `<?xml version="1.0"?>\n<urlset>\n<url><loc>${url}</loc></url>\n</urlset>\n`,
    });
    expect(await runSandboxCheck(sandbox.path, 'site/sitemap')).toMatchObject([
        {
            file: 'dist/sitemap.xml',
            line: 3,
            column: 6,
            rule: 'invalid-url',
            message: `The sitemap lists ${url}, which is not an absolute URL with valid escapes.`,
        },
    ]);
    expect(await runSandboxCheck(sandbox.path, 'site/lychee')).toStrictEqual([]);
});

test.each([...BUILT_PAGE_CASES])(
    '$check reports its finding in the built site and passes after the fix',
    async (sample) => {
        await using repository = await createSandbox(SITE_SANDBOX);
        const result = await runCheckSample(repository, sample, SITE_SANDBOX);
        expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(sample));
    },
);
