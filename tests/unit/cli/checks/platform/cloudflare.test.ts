import { join } from 'node:path';
import * as tools from '#cli/tools/find.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { CHECK_FUNCTIONS } from '#cli/checks/built-in.ts';
import { planRun, isActive } from '#cli/planning/checks.ts';
import { checkFindings, buildCheckInput } from '#tests/setup/check-input.ts';
import { WRANGLER_SCHEMA, CLOUDFLARE_HEADERS, CLOUDFLARE_REDIRECTS } from '#tests/config/cloudflare.ts';

test('Cloudflare redirects refuse Netlify-only status codes in root and child scopes', async () => {
    await using sandbox = await testdir();
    const text = CLOUDFLARE_REDIRECTS;
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['cloudflare'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["cloudflare"]\n',
        }),
        _redirects: text,
        'app/_redirects': text,
    });
    const session = await openSession(sandbox.path);
    for (const scope of ['', 'app']) {
        const path = scope === '' ? '_redirects' : `${scope}/_redirects`;
        const awaitedFindings = await checkFindings(session.root, 'cloudflare/redirects', { scope });
        expect(
            awaitedFindings.map(({ file, line, message }) => ({
                file,
                line,
                message,
            })),
        ).toStrictEqual([
            { file: path, line: 8, message: 'Use a supported Cloudflare redirect status instead of 404.' },
            { file: path, line: 9, message: 'Use a supported Cloudflare redirect status instead of 410.' },
            { file: path, line: 10, message: 'Use a supported Cloudflare redirect status instead of 302!.' },
        ]);
    }
});

test('_headers syntax is checked in both scopes', async () => {
    await using sandbox = await testdir();
    const text = CLOUDFLARE_HEADERS;
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['cloudflare'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["cloudflare"]\n',
        }),
        _headers: text,
        'app/_headers': text,
    });
    const session = await openSession(sandbox.path);
    for (const scope of ['', 'app']) {
        const path = scope === '' ? '_headers' : 'app/_headers';
        const nextAwaitedFindings = await checkFindings(session.root, 'cloudflare/headers', { scope });
        expect(
            nextAwaitedFindings.map(({ file, line, message }) => ({
                file,
                line,
                message,
            })),
        ).toStrictEqual([
            { file: path, line: 1, message: 'Add a path line before this header.' },
            { file: path, line: 9, message: 'Write this header as Name: value.' },
        ]);
    }
});

test('wrangler.json values are checked against the installed schema', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['cloudflare'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["cloudflare"]\n',
        }),
        'wrangler.json': '{"workers_dev":"wrong"}\n',
        'app/wrangler.json': '{"name":"app","compatibility_date":"2026-01-15","workers_dev":"wrong"}\n',
        'node_modules/wrangler/package.json': '{"exports":{"./package.json":"./package.json"}}\n',
        'node_modules/wrangler/config-schema.json': JSON.stringify(WRANGLER_SCHEMA),
    });
    const nativeInspection = tools.inspectTool;
    using _inspection = spyOn(tools, 'inspectTool').mockImplementation((context, tool) =>
        tool.name === 'wrangler'
            ? { name: tool.name, state: 'ok', path: join(sandbox.path, 'node_modules/wrangler/bin/wrangler.js') }
            : nativeInspection(
                  {
                      ...context,
                      root: join(import.meta.dir, '../../../../..'),
                      cwd: join(import.meta.dir, '../../../../..'),
                      installedRoot: join(import.meta.dir, '../../../../..'),
                  },
                  tool,
              ),
    );
    for (const scope of ['', 'app']) {
        const session = await openSession(sandbox.path);

        const findings = await checkFindings(session.root, 'cloudflare/wrangler', { scope });
        expect(findings).toMatchObject(
            scope === ''
                ? [
                      { file: 'wrangler.json', message: '/workers_dev must be boolean' },
                      { rule: 'missing-name', file: 'wrangler.json', line: 1 },
                      { rule: 'compatibility-date', file: 'wrangler.json', line: 1 },
                  ]
                : [{ file: 'app/wrangler.json', message: '/workers_dev must be boolean' }],
        );
        await Bun.write(
            join(sandbox.path, scope, 'wrangler.json'),
            '{"name":"fixed","compatibility_date":"2026-01-15","workers_dev":true}\n',
        );
        expect(await checkFindings(sandbox.path, 'cloudflare/wrangler', { scope })).toStrictEqual([]);
    }
});

test('Wrangler reads installed schema assets for a copied child scope', async () => {
    await using installed = await testdir({
        'node_modules/wrangler/package.json': '{"exports":{"./package.json":"./package.json"}}\n',
        'node_modules/wrangler/config-schema.json': JSON.stringify(WRANGLER_SCHEMA),
        'app/wrangler.json': '{"name":"original","compatibility_date":"2026-01-15","workers_dev":true}\n',
    });
    await using revision = await testdir({
        'gspot.toml': settingsText(['cloudflare'], {
            tables: '[[scope]]\npath = "app"\nconfigurations = ["cloudflare"]\n',
        }),
        'app/wrangler.json': '{"name":"copy","compatibility_date":"2026-01-15","workers_dev":"wrong"}\n',
    });
    const nativeInspection = tools.inspectTool;
    using _inspection = spyOn(tools, 'inspectTool').mockImplementation((context, tool) =>
        tool.name === 'wrangler'
            ? { name: tool.name, state: 'ok', path: join(installed.path, 'node_modules/wrangler/bin/wrangler.js') }
            : nativeInspection(
                  {
                      ...context,
                      root: join(import.meta.dir, '../../../../..'),
                      cwd: join(import.meta.dir, '../../../../..'),
                      installedRoot: join(import.meta.dir, '../../../../..'),
                  },
                  tool,
              ),
    );
    const session = await openSession(revision.path);
    session.installedRoot = installed.path;
    const findings = await CHECK_FUNCTIONS['cloudflare/wrangler'](
        buildCheckInput(session, 'cloudflare/wrangler', { scope: 'app' }),
    );
    expect(findings).toMatchObject([{ file: 'app/wrangler.json', message: '/workers_dev must be boolean' }]);
});

test('Cloudflare Pages without a Wrangler configuration skips schema validation without tools', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['cloudflare']),
        _headers: '/*\n  X-Frame-Options: DENY\n',
    });
    const selected = planRun(await openSession(sandbox.path), {
        stage: 'all',

        only: ['cloudflare/wrangler'],
    });
    expect(
        selected.map((entry) => ({ check: entry.check.name, active: isActive(entry), files: entry.files })),
    ).toStrictEqual([{ check: 'cloudflare/wrangler', active: false, files: [] }]);
});
