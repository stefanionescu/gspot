import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { captureRejection } from '#tests/setup/matchers.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { overrideEnvironment } from '#tests/setup/environment.ts';
import { parse, stringify, LocalDate } from '@decimalturn/toml-patch';
import { BASH_TEMPLATE_SETTINGS } from '#tests/data/settings/schema.ts';
import { FORMAT_OVERRIDES_SETTINGS } from '#tests/data/checks/format.ts';
import { readTemplate, exportTemplate } from '#cli/settings/templates.ts';
import { RAW_HOST, TEMPLATE_FILE } from '#cli/config/settings/templates.ts';
import { ESLINT_OVERRIDES_SETTINGS } from '#tests/data/generated-files/eslint/overrides.ts';

test.each([
    ['preserves ESLint rules and authored path', ESLINT_OVERRIDES_SETTINGS, 'project.template.toml'],
    ['retains authored formatter path', FORMAT_OVERRIDES_SETTINGS, 'format.template.toml'],
])('template export keeps %s', async (_name, settings, filename) => {
    await using sandbox = await testdir();
    const exported = exportTemplate(settings);
    expect(exported.text).toContain('override');
    await createFileTree(sandbox.path, { [filename]: exported.text });
    if (settings === ESLINT_OVERRIDES_SETTINGS) {
        const imported = await readTemplate(filename, sandbox.path);
        expect(imported.tables.tools?.eslint?.rules?.['eqeqeq']).toStrictEqual(['smart']);
    }
    expect(exported.leftOut).toStrictEqual([
        'scope."apps/web": belongs to this repository',
        'scope."apps/web/admin": belongs to this repository',
    ]);
});

test('template export keeps advisory ignores with until dates and path rows', async () => {
    await using sandbox = await testdir();
    const advisory = {
        check: 'dependencies/osv-scanner',
        rule: 'GHSA-reviewed',
        reason: 'No fixed version is available.',
        until: new LocalDate('2099-05-21'),
    };
    const expired = {
        check: 'dependencies/osv-scanner',
        rule: 'GHSA-expired',
        reason: 'Review remains recorded.',
        until: new LocalDate('2000-01-01'),
    };
    const exported = exportTemplate(
        stringify({
            configurations: ['dependencies'],
            ignore: [
                advisory,
                expired,
                {
                    check: 'dependencies/osv-scanner',
                    rule: 'GHSA-local',
                    paths: ['package-lock.json'],
                    reason: 'The local lockfile needs review.',
                },
            ],
        }),
    );
    await createFileTree(sandbox.path, { 'team.template.toml': exported.text });
    const imported = await readTemplate('team.template.toml', sandbox.path);
    expect(imported.tables.ignore).toStrictEqual([
        expired,
        {
            check: 'dependencies/osv-scanner',
            rule: 'GHSA-local',
            paths: ['package-lock.json'],
            reason: 'The local lockfile needs review.',
        },
        advisory,
    ]);
    expect(exported.leftOut).toStrictEqual([]);
});

test('template export keeps empty tables as written and adds no defaults', () => {
    const written = 'configurations = []\n[naming]\n[javascript]\n[structure]\n[tools.eslint.rules]\n';
    const exported = exportTemplate(written);
    const exportedTables = parse(exported.text) as TomlTable;
    expect({
        naming: exportedTables['naming'],
        javascript: exportedTables['javascript'],
        structure: exportedTables['structure'],
        tools: exportedTables['tools'],
    }).toStrictEqual({ naming: {}, javascript: {}, structure: {}, tools: { eslint: { rules: {} } } });
    const absent = parse(exportTemplate('configurations = []\n').text) as TomlTable;
    for (const table of ['naming', 'javascript', 'structure', 'tools'])
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

test.each([
    ['https://example.com/house.template.toml', 'https://example.com/house.template.toml'],
    ['github:acme/policies', `${RAW_HOST}/acme/policies/HEAD/${TEMPLATE_FILE}`],
    ['github:acme/policies/team/house.template.toml@v2', `${RAW_HOST}/acme/policies/v2/team/house.template.toml`],
])('%s is downloaded from %s', async (source, address) => {
    using request = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(BASH_TEMPLATE_SETTINGS));
    const template = await readTemplate(source, '.');
    expect(request.mock.calls[0]?.[0]).toBe(address);
    expect(template.tables.configurations).toStrictEqual(['bash']);
});

test('a template address that answers 404 is refused with its status', async () => {
    using request = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not found', { status: 404 }));
    expect(await captureRejection(readTemplate('github:acme/missing', '.'))).toContain('answered 404');
    expect(request).toHaveBeenCalledTimes(1);
});

test('a template address over plain http is refused before any request', async () => {
    using request = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No request is expected.'));

    // eslint-disable-next-line unicorn/prefer-https -- reason: The test must pass an http address to prove the refusal.
    expect(await captureRejection(readTemplate('http://example.com/house.template.toml', '.'))).toContain(
        'https, not http',
    );
    expect(request).not.toHaveBeenCalled();
});

test('a GitHub token goes only to GitHub template addresses', async () => {
    using request = spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(BASH_TEMPLATE_SETTINGS))
        .mockResolvedValueOnce(new Response(BASH_TEMPLATE_SETTINGS));
    const environment = overrideEnvironment({ GITHUB_TOKEN: 'fixture-github-token' });
    try {
        await readTemplate('github:acme/policies', '.');
        await readTemplate('https://example.com/house.template.toml', '.');
        expect(request.mock.calls[0]?.[1]?.headers).toStrictEqual({ Authorization: 'Bearer fixture-github-token' });
        expect(request.mock.calls[1]?.[1]?.headers).toStrictEqual({});
    } finally {
        environment[Symbol.dispose]();
    }
});
