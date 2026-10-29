import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { getTool } from '#cli/configurations/tools.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { testModules } from '#tests/setup/sandboxes/node-modules.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { SITE_SANDBOX, SITE_BUILD_ARGUMENTS } from '#tests/config/site.ts';

import {
    BUILT_PAGE_CASES,
    INVALID_SITEMAP_URLS,
    PURGECSS_STYLE_CASES,
} from '#tests/config/checks/framework/site/pages.ts';

test.each(INVALID_SITEMAP_URLS)('site/sitemap reports %s as an invalid URL and site/lychee skips it', async (url) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['site'], {
            level: 'all',
            tables: `[site]\nbuild_command = ${JSON.stringify(buildProgramCommand('fakes/site-build', '--copy', 'sitemap.xml=dist/sitemap.xml'))}\n`,
        }),
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
            buildSandboxSettings(['site'], {
                level: 'all',
                tables: `[site]\nbuild_command = ${JSON.stringify(buildProgramCommand('fakes/site-build', ...SITE_BUILD_ARGUMENTS))}\n`,
            }),
        );
        await assertCheckSample(repository, sample);
    },
);

test.each([...PURGECSS_STYLE_CASES])('site/purgecss checks $name', async ({ source, css, expected }) => {
    const { version } = getTool(readConfigurations().values(), 'purgecss');
    const library = pathToFileURL(join(testModules, 'purgecss/lib/purgecss.esm.js')).href;
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], {
            level: 'all',
            tables: `[site]\nbuild_command = ${JSON.stringify(
                buildProgramCommand(
                    'fakes/site-build',
                    '--copy',
                    'index.html=dist/index.html',
                    '--copy',
                    'bundle.txt=dist/site.css',
                ),
            )}\n`,
        }),
        'index.html':
            '<!doctype html><html lang="en"><body><h1 class="w-[13px] w-1.5 !mt-0 md:w-1/2">Test</h1></body></html>\n',
        'bundle.txt': css,
        ...source,
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
    const findings = await runSandboxCheck(sandbox.path, 'site/purgecss');
    expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual(
        expected.map((selector) => ({
            file: 'dist/site.css',
            rule: 'unused-selector',
            message: `No built page uses the selector ${selector}.`,
        })),
    );
});
