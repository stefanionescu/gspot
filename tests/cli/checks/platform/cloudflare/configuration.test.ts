// The built-in Cloudflare checks on a test site, run in-process: each reports its finding and passes after the fix.
import { join } from 'node:path';
import { createRequire } from 'node:module';
import * as tools from '#cli/tools/public.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { planRun, isActive } from '#cli/planning/public.ts';
import { BUILT_IN_CALCULATIONS } from '#cli/checks/public.ts';
import { levelSchema } from '#cli/parsers/schema/contracts.ts';
import { WRANGLER_SCHEMA } from '#tests/config/cli/checks/platform/cloudflare/configuration.ts';

test('Cloudflare header checks report only files in their owning scope', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['cloudflare'], {
            tables: '[scope."workers/api"]\nconfigurations = ["cloudflare"]\n',
        }),
        _headers: '  Invalid header\n',
        'workers/api/_headers': '/*\n  X-Frame-Options: DENY\n',
    });
    const session = await openSession(directory.path);
    const input = buildCheckInput(session, 'cloudflare/headers');
    expect(BUILT_IN_CALCULATIONS['cloudflare/headers'](input).map(({ file }) => file)).toStrictEqual(['_headers']);
    expect(
        BUILT_IN_CALCULATIONS['cloudflare/headers'](
            buildCheckInput(session, 'cloudflare/headers', { scope: 'workers/api' }),
        ),
    ).toStrictEqual([]);
});

test.each(levelSchema.options)(
    'Cloudflare redirects refuse Netlify-only status syntax at level %s in root and child scopes',
    async (level) => {
        await using sandbox = await testdir();
        const text =
            '/old /new 200\n/old /new 301\n/old /new 302\n/old /new 303\n/old /new 307\n/old /new 308\n/old /new\n/old /new 404\n/old /new 410\n/old /new 302!\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['cloudflare'], {
                level,
                tables: '[scope.app]\nconfigurations = ["cloudflare"]\n',
            }),
            _redirects: text,
            'app/_redirects': text,
        });
        const session = await openSession(sandbox.path);
        for (const scope of ['', 'app']) {
            const path = scope === '' ? '_redirects' : `${scope}/_redirects`;
            expect(
                BUILT_IN_CALCULATIONS['cloudflare/redirects'](
                    buildCheckInput(session, 'cloudflare/redirects', { scope }),
                ).map(({ file, line, message }) => ({ file, line, message })),
            ).toStrictEqual([
                { file: path, line: 8, message: 'Use a supported Cloudflare redirect status instead of 404.' },
                { file: path, line: 9, message: 'Use a supported Cloudflare redirect status instead of 410.' },
                { file: path, line: 10, message: 'Use a supported Cloudflare redirect status instead of 302!.' },
            ]);
        }
    },
);

test.each(levelSchema.options)('headers share syntax and hosting security in both scopes at %s', async (level) => {
    await using sandbox = await testdir();
    const text =
        '  Header-before-path: value\n# Comment\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: same-origin\n  Content-Security-Policy: frame-ancestors none\n/assets/*\n  X-Frame-Options: INVALID\n  No colon\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['cloudflare'], { level, tables: '[scope.app]\nconfigurations = ["cloudflare"]\n' }),
        _headers: text,
        'app/_headers': text,
    });
    const session = await openSession(sandbox.path);
    for (const scope of ['', 'app']) {
        const path = scope === '' ? '_headers' : 'app/_headers';
        expect(
            BUILT_IN_CALCULATIONS['cloudflare/headers'](buildCheckInput(session, 'cloudflare/headers', { scope })).map(
                ({ file, line, message }) => ({
                    file,
                    line,
                    message,
                }),
            ),
        ).toStrictEqual([
            { file: path, line: 1, message: 'Add a path line before this header.' },
            { file: path, line: 9, message: 'Write this header as Name: value.' },
        ]);
        expect(
            BUILT_IN_CALCULATIONS['cloudflare/security-headers'](
                buildCheckInput(session, 'cloudflare/security-headers', { scope }),
            ),
        ).toStrictEqual([]);
    }
    const site = await testdir({ 'gspot.toml': buildPolicy(['site'], { level }), _headers: text });
    await using isolated = site;
    const siteSession = await openSession(isolated.path);
    expect(siteSession.scopes[0]!.selected.some((manifest) => manifest.configuration.name === 'cloudflare')).toBe(
        false,
    );
});

test.each(levelSchema.options)(
    'Wrangler validates native schema leaves and retains its requirements at %s',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['cloudflare'], {
                level,
                tables: '[scope.app]\nconfigurations = ["cloudflare"]\n',
            }),
            'wrangler.json': '{"workers_dev":"wrong"}\n',
            'app/wrangler.json': '{"name":"app","compatibility_date":"2026-01-15","workers_dev":"wrong"}\n',
            'node_modules/wrangler/package.json': '{"exports":{"./package.json":"./package.json"}}\n',
            'node_modules/wrangler/config-schema.json': JSON.stringify(WRANGLER_SCHEMA),
        });
        const library = createRequire(import.meta.url).resolve('ajv/package.json');
        using _inspection = spyOn(tools, 'inspectTool').mockImplementation((_context, tool) => ({
            name: tool.name,
            state: 'ok',
            path: tool.name === 'ajv' ? library : join(sandbox.path, 'node_modules/wrangler/bin/wrangler.js'),
        }));
        for (const scope of ['', 'app']) {
            const session = await openSession(sandbox.path);
            const input = buildCheckInput(session, 'cloudflare/wrangler', { scope });
            const findings = await BUILT_IN_CALCULATIONS['cloudflare/wrangler'](input);
            expect(findings).toMatchObject(
                scope === ''
                    ? [
                          { rule: 'missing-name', file: 'wrangler.json', line: 1 },
                          { rule: 'compatibility-date', file: 'wrangler.json', line: 1 },
                          { rule: 'schema', file: 'wrangler.json', line: 1, message: '/workers_dev must be boolean' },
                      ]
                    : [{ rule: 'schema', file: 'app/wrangler.json', line: 1, message: '/workers_dev must be boolean' }],
            );
            await Bun.write(
                join(sandbox.path, scope, 'wrangler.json'),
                '{"name":"fixed","compatibility_date":"2026-01-15","workers_dev":true}\n',
            );
            expect(
                await BUILT_IN_CALCULATIONS['cloudflare/wrangler'](
                    buildCheckInput(await openSession(sandbox.path), 'cloudflare/wrangler', { scope }),
                ),
            ).toStrictEqual([]);
        }
    },
);

test('Wrangler reads installed schema assets for a copied child scope', async () => {
    await using installed = await testdir({
        'node_modules/wrangler/package.json': '{"exports":{"./package.json":"./package.json"}}\n',
        'node_modules/wrangler/config-schema.json': JSON.stringify(WRANGLER_SCHEMA),
        'app/wrangler.json': '{"name":"original","compatibility_date":"2026-01-15","workers_dev":true}\n',
    });
    await using revision = await testdir({
        'gspot.toml': buildPolicy(['cloudflare'], { tables: '[scope.app]\nconfigurations = ["cloudflare"]\n' }),
        'app/wrangler.json': '{"name":"copy","compatibility_date":"2026-01-15","workers_dev":"wrong"}\n',
    });
    const library = createRequire(import.meta.url).resolve('ajv/package.json');
    using _inspection = spyOn(tools, 'inspectTool').mockImplementation((context, tool) => ({
        name: tool.name,
        state: 'ok',
        path: tool.name === 'ajv' ? library : join(context.cwd!, 'node_modules/wrangler/bin/wrangler.js'),
    }));
    const session = await openSession(revision.path);
    session.installedRoot = installed.path;
    const findings = await BUILT_IN_CALCULATIONS['cloudflare/wrangler'](
        buildCheckInput(session, 'cloudflare/wrangler', { scope: 'app' }),
    );
    expect(findings).toMatchObject([
        { file: 'app/wrangler.json', rule: 'schema', line: 1, message: '/workers_dev must be boolean' },
    ]);
    expect(await Bun.file(join(installed.path, 'app/wrangler.json')).text()).toBe(
        '{"name":"original","compatibility_date":"2026-01-15","workers_dev":true}\n',
    );
});

test('Cloudflare Pages without a Wrangler configuration skips schema validation without tools', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['cloudflare']),
        _headers: '/*\n  X-Frame-Options: DENY\n',
    });
    const selected = planRun(await openSession(sandbox.path), {
        stage: 'all',
        skips: [],
        only: ['cloudflare/wrangler'],
    });
    expect(
        selected.map((entry) => ({ check: entry.check.name, active: isActive(entry), files: entry.files })),
    ).toStrictEqual([{ check: 'cloudflare/wrangler', active: false, files: [] }]);
});
