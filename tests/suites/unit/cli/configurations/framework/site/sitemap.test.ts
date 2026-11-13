import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from 'bun:test';

import { readConfigurations } from '#cli/manifests/read.ts';
import { getTool } from '#cli/manifests/tools.ts';
import { escapeRegExp } from '#cli/system/patterns.ts';
import { INVALID_SITEMAP_URLS } from '#tests/config/configurations/framework.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { fakeToolExecutables } from '#tests/setup/cli/tools.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test('a sitemap index supplies the base path for encoded and CDATA page URLs and Lychee remaps', async () => {
    const buildCommand = buildProgramCommand('fakes/site-build', '--copy', 'built=dist');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], {
            level: 'all',
            tables: `[site]\nbuild_command = ${JSON.stringify(buildCommand)}\n`,
        }),
        'built/index.html': '<h1>Home</h1><a href="/docs/guide/">Guide</a>\n',
        'built/guide/index.html': '<h1>Guide</h1>\n',
        'built/sitemap-index.xml':
            '<sitemapindex><sitemap><loc>https://example.com/docs/sitemap-0.xml</loc></sitemap></sitemapindex>\n',
        'built/sitemap-0.xml':
            '<urlset><url><loc><![CDATA[https://example.com/docs/]]></loc></url><url><loc>https://example.com/docs/guide/?a=1&amp;b=2</loc></url></urlset>\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'site/sitemap')).toStrictEqual([]);
    using _pins = fakeToolExecutables([getTool(readConfigurations().values(), 'lychee')]);
    const remaps: string[][] = [];
    using _spawn = fakeCommands('lychee', (command, options) => {
        const mappings = command.filter((_, index) => command[index - 1] === '--remap');
        const buildUrl = `${pathToFileURL(options.cwd).href}/`;
        const remapped: string[] = [];
        for (const mapping of mappings) {
            const [pattern, target] = mapping.split(' ', 2);
            remapped.push('https://example.com/docs/guide/'.replace(new RegExp(pattern!), () => target!));
        }
        remaps.push(remapped);
        const docsUrl = escapeRegExp(`${buildUrl}docs/`);
        expect(mappings[1]).toBe(`^${docsUrl} ${buildUrl}`);
        expect(remaps.at(-1)?.[0]).toBe(`${buildUrl}guide/`);
        return Promise.resolve(buildProcessResult());
    });
    expect(await runSandboxCheck(sandbox.path, 'site/lychee')).toStrictEqual([]);
    expect(remaps).toHaveLength(1);
    await writeFile(
        join(sandbox.path, 'built/sitemap-0.xml'),
        '<urlset><url><loc><![CDATA[https://example.com/docs/]]></loc></url><url><loc>https://example.com/docs/guide/</loc></url><url><loc>https://example.com/docs/missing/</loc></url></urlset>\n',
    );
    const missing = await runSandboxCheck(sandbox.path, 'site/sitemap');
    expect(
        missing.map(({ file, rule, message }) => ({
            file,
            rule,
            message,
        })),
    ).toStrictEqual([
        {
            file: 'dist/sitemap-0.xml',
            rule: 'missing-page',
            message: expect.stringContaining('https://example.com/docs/missing/') as string,
        },
    ]);
});

test.each(INVALID_SITEMAP_URLS)('site/sitemap reports %s as an invalid URL', async (url) => {
    const buildCommand = buildProgramCommand('fakes/site-build', '--copy', 'sitemap.xml=dist/sitemap.xml');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], {
            level: 'all',
            tables: `[site]\nbuild_command = ${JSON.stringify(buildCommand)}\n`,
        }),
        'sitemap.xml': `<?xml version="1.0"?>\n<urlset>\n<url><loc>${url}</loc></url>\n</urlset>\n`,
    });
    expect(await runSandboxCheck(sandbox.path, 'site/sitemap')).toStrictEqual([
        expect.objectContaining({
            file: 'dist/sitemap.xml',
            line: 3,
            column: 6,
            rule: 'invalid-url',
            message: expect.stringContaining(url) as string,
        }),
    ]);
});

test('site/sitemap reports a built page that the sitemap leaves out, unless the setting allows it', async () => {
    const buildCommand = buildProgramCommand('fakes/site-build', '--copy', 'built=dist');
    const tables = `[site]\nbuild_command = ${JSON.stringify(buildCommand)}\n`;
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], { level: 'all', tables }),
        'built/index.html': '<h1>Home</h1>\n',
        'built/extra.html': '<h1>Extra</h1>\n',
        'built/sitemap.xml': '<urlset><url><loc>https://example.com/</loc></url></urlset>\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'site/sitemap');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'dist/extra.html', rule: 'unlisted-page' },
    ]);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['site'], {
            level: 'all',
            tables: `${tables}allowed_unlisted_pages = { value = ["dist/extra.html"], reason = "A landing page." }\n`,
        }),
    );
    expect(await runSandboxCheck(sandbox.path, 'site/sitemap')).toStrictEqual([]);
});
