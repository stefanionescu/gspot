import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSiteSettings } from '#tests/setup/cli/settings.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { runCheckSample, expectedSummary } from '#tests/setup/cli/samples.ts';

import {
    SITE_SANDBOX,
    BUILT_PAGE_CASES,
    SITE_BUILD_ARGUMENTS,
    INVALID_SITEMAP_URLS,
} from '#tests/config/checks/framework/site/pages.ts';

test.each(INVALID_SITEMAP_URLS)('site/sitemap reports %s as an invalid URL and site/lychee skips it', async (url) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSiteSettings(
            buildProgramCommand('fakes/site-build', '--copy', 'sitemap.xml=dist/sitemap.xml'),
        ),
        'sitemap.xml': `<?xml version="1.0"?>\n<urlset>\n<url><loc>${url}</loc></url>\n</urlset>\n`,
    });
    expect(await runSandboxCheck(sandbox.path, 'site/sitemap')).toStrictEqual([
        {
            check: 'site/sitemap',
            file: 'dist/sitemap.xml',
            line: 3,
            column: 6,
            rule: 'invalid-url',
            message: `The sitemap lists ${url}, which is not an absolute URL with valid escapes.`,
            fixable: false,
            help: 'Add the page to the sitemap, remove the dead URL, or leave a page out under site.allowed_unlisted_pages.',
        },
    ]);
    expect(await runSandboxCheck(sandbox.path, 'site/lychee')).toStrictEqual([]);
});

test.each([...BUILT_PAGE_CASES])(
    '$check reports its finding in the built site and passes after the fix',
    async (sample) => {
        await using repository = await createSandbox(SITE_SANDBOX);
        await writeFile(
            join(repository.root, 'gspot.toml'),
            buildSiteSettings(buildProgramCommand('fakes/site-build', ...SITE_BUILD_ARGUMENTS)),
        );
        expect(await runCheckSample(repository, sample)).toStrictEqual(expectedSummary(sample));
    },
);
