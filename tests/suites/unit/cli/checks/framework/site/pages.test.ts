import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { getTool } from '#cli/configurations/tools.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { buildSiteSettings } from '#tests/setup/cli/settings.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { testModules } from '#tests/setup/sandboxes/node-modules.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { SITE_SANDBOX, SITE_BUILD_ARGUMENTS } from '#tests/config/site.ts';
import { runCheckSample, buildExpectedSummary } from '#tests/setup/cli/samples.ts';
import { BUILT_PAGE_CASES, INVALID_SITEMAP_URLS } from '#tests/config/checks/framework/site/pages.ts';

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
        expect(await runCheckSample(repository, sample)).toStrictEqual(buildExpectedSummary(sample));
    },
);

test('site/purgecss starts its PurgeCSS process from the source tree and reports the unused selector', async () => {
    const { version } = getTool(readConfigurations().values(), 'purgecss');
    const library = pathToFileURL(join(testModules, 'purgecss/lib/purgecss.esm.js')).href;
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSiteSettings(
            buildProgramCommand(
                'fakes/site-build',
                '--copy',
                'index.html=dist/index.html',
                '--copy',
                'site.css=dist/site.css',
            ),
        ),
        'index.html': '<!doctype html><html lang="en"><body><h1 class="title">Test</h1></body></html>\n',
        'site.css': '.title { color: #333; }\n.unused { color: red; }\n',
        [`${GSPOT_PATHS.nodeModules}/purgecss/package.json`]: JSON.stringify({
            name: 'purgecss',
            version,
            main: 'index.mjs',
        }),
        [`${GSPOT_PATHS.nodeModules}/purgecss/index.mjs`]: `export * from ${JSON.stringify(library)};\n`,
    });
    await writeProgramCommand(
        sandbox.path,
        `${GSPOT_PATHS.nodeModules}/.bin/purgecss`,
        'fakes/tool',
        '--line',
        version!,
    );
    await applyGeneratedFiles(sandbox.path);
    expect(await runSandboxCheck(sandbox.path, 'site/purgecss')).toMatchObject([
        { file: 'dist/site.css', rule: 'unused-selector', message: 'No built page uses the selector .unused.' },
    ]);
});
