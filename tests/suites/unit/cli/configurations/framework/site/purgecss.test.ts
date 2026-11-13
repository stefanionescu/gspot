import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from 'bun:test';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { getTool } from '#cli/manifests/tools.ts';
import { PURGECSS_STYLE_CASES } from '#tests/config/configurations/framework.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { toolModules } from '#tests/setup/sandboxes/node-modules.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test.each([...PURGECSS_STYLE_CASES])('site/purgecss checks $name', async ({ source, css, expected }) => {
    const { version } = getTool(readConfigurations().values(), 'purgecss');
    const library = pathToFileURL(join(toolModules, 'purgecss/lib/purgecss.esm.js')).href;
    const buildCommand = buildProgramCommand(
        'fakes/site-build',
        '--copy',
        'index.html=dist/index.html',
        '--copy',
        'bundle.txt=dist/site.css',
    );
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], {
            level: 'all',
            tables: `[site]\nbuild_command = ${JSON.stringify(buildCommand)}\n`,
        }),
        'index.html': '<!doctype html><html lang="en"><body><h1>Test</h1></body></html>\n',
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
            message: expect.stringContaining(selector) as string,
        })),
    );
});
