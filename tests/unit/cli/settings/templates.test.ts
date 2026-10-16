import { join } from 'node:path';
import { parse, stringify } from 'smol-toml';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/setup/matchers.ts';
import { parseExpiryDate } from '#cli/commands/ignore.ts';
import { TEMPLATE } from '#tests/config/settings/schema.ts';
import { useEnvironment } from '#tests/setup/environment.ts';
import { FORMAT_OVERRIDES_SETTINGS } from '#tests/config/formatting.ts';
import { RAW_HOST, TEMPLATE_FILE } from '#cli/config/settings/templates.ts';
import { ESLINT_OVERRIDES_SETTINGS } from '#tests/config/eslint/overrides.ts';
import { readTemplate, parseTemplate, exportTemplate } from '#cli/settings/templates.ts';

test.each([
    ['preserves ESLint rules and authored path', ESLINT_OVERRIDES_SETTINGS, 'project.template.toml'],
    ['retains authored formatter path', FORMAT_OVERRIDES_SETTINGS, 'format.template.toml'],
])('template export keeps %s', (_name, settings, filename) => {
    const exported = exportTemplate(settings);
    expect(exported.text).toContain('override');
    if (settings === ESLINT_OVERRIDES_SETTINGS)
        expect(parseTemplate(exported.text, filename).tables.tools?.eslint?.rules?.['eqeqeq']).toStrictEqual(['smart']);
    expect(exported.leftOut).toStrictEqual([
        'scope."apps/web": belongs to this repository',
        'scope."apps/web/admin": belongs to this repository',
    ]);
});

test('template export keeps advisory ignores with until dates and path rows', () => {
    const advisory = {
        check: 'dependencies/osv',
        rule: 'GHSA-reviewed',
        reason: 'No fixed version is available.',
        until: parseExpiryDate('2099-05-21'),
    };
    const expired = {
        check: 'dependencies/osv',
        rule: 'GHSA-expired',
        reason: 'Review remains recorded.',
        until: parseExpiryDate('2000-01-01'),
    };
    const exported = exportTemplate(
        stringify({
            configurations: ['dependencies'],
            ignore: [
                advisory,
                expired,
                {
                    check: 'dependencies/osv',
                    rule: 'GHSA-local',
                    paths: ['package-lock.json'],
                    reason: 'The local lockfile needs review.',
                },
            ],
        }),
    );
    const imported = parseTemplate(exported.text, 'team.template.toml');
    expect(imported.tables.ignore).toStrictEqual([
        expired,
        {
            check: 'dependencies/osv',
            rule: 'GHSA-local',
            paths: ['package-lock.json'],
            reason: 'The local lockfile needs review.',
        },
        advisory,
    ]);
    expect(exported.leftOut).toStrictEqual([]);
});

test('template export keeps empty tables as written and adds no defaults', () => {
    const written = 'configurations = []\n[naming]\n[architecture]\n[structure]\n[tools.eslint.rules]\n';
    const exported = exportTemplate(written);
    const exportedTables = parse(exported.text);
    expect({
        naming: exportedTables['naming'],
        architecture: exportedTables['architecture'],
        structure: exportedTables['structure'],
        tools: exportedTables['tools'],
    }).toStrictEqual({ naming: {}, architecture: {}, structure: {}, tools: { eslint: { rules: {} } } });
    const absent = parse(exportTemplate('configurations = []\n').text);
    for (const table of ['naming', 'architecture', 'structure', 'tools'])
        expect(Object.hasOwn(absent, table)).toBe(false);
});

test('a template given by absolute path loads from another working folder', async () => {
    const source = 'policies/café house.template.toml';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        [source]: 'configurations = ["bash"]\n',
        'project/README.md': '# Project\n',
    });
    const relative = await readTemplate(source, sandbox.path);
    const absolute = await readTemplate(join(sandbox.path, source), join(sandbox.path, 'project'));
    expect(absolute.tables).toStrictEqual(relative.tables);
    expect(absolute.digest).toBe(relative.digest);
});

test('templates keep allowed licenses and allowed packages', async () => {
    await using directory = await testdir();
    const licenses = {
        allowed: ['MPL-2.0'],
        allowed_package: [{ name: 'example', version: '1.2.3', reason: 'Reviewed package metadata.' }],
    };
    const exported = exportTemplate(stringify({ configurations: ['licenses'], licenses }));
    await createFileTree(directory.path, { 'licenses.template.toml': exported.text });
    const restored = await readTemplate('licenses.template.toml', directory.path);
    expect(restored.tables.licenses).toStrictEqual(licenses);
    expect(exported.leftOut).toStrictEqual([]);
});

test.each([
    ['https://example.com/house.template.toml', 'https://example.com/house.template.toml'],
    ['github:acme/policies', `${RAW_HOST}/acme/policies/HEAD/${TEMPLATE_FILE}`],
    ['github:acme/policies/team/house.template.toml@v2', `${RAW_HOST}/acme/policies/v2/team/house.template.toml`],
])('%s is downloaded from %s', async (source, address) => {
    using request = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(TEMPLATE));
    const template = await readTemplate(source, '.');
    expect(request.mock.calls[0]?.[0]).toBe(address);
    expect(template.tables.configurations).toStrictEqual(['bash']);
});

test('a template address that answers 404 is refused with its status', async () => {
    using request = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not found', { status: 404 }));
    expect(await rejection(readTemplate('github:acme/missing', '.'))).toContain('answered 404');
    expect(request).toHaveBeenCalledTimes(1);
});

test('a template address over plain http is refused before any request', async () => {
    using request = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No request is expected.'));

    // eslint-disable-next-line unicorn/prefer-https -- reason: The test must pass an http address to prove the refusal.
    expect(await rejection(readTemplate('http://example.com/house.template.toml', '.'))).toContain('https, not http');
    expect(request).not.toHaveBeenCalled();
});

test('a GitHub token goes only to GitHub template addresses', async () => {
    using request = spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(TEMPLATE))
        .mockResolvedValueOnce(new Response(TEMPLATE));
    const environment = useEnvironment({ GITHUB_TOKEN: 'fixture-github-token' });
    try {
        await readTemplate('github:acme/policies', '.');
        await readTemplate('https://example.com/house.template.toml', '.');
        expect(request.mock.calls[0]?.[1]?.headers).toStrictEqual({ Authorization: 'Bearer fixture-github-token' });
        expect(request.mock.calls[1]?.[1]?.headers).toStrictEqual({});
    } finally {
        environment[Symbol.dispose]();
    }
});
