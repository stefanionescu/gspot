// An exported template keeps the rules of the policy and leaves out what only fits this repository.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse, stringify } from 'smol-toml';
import { testdir, createFileTree } from 'testdirs';
import { parseStrictPolicy } from '#cli/policy/public.ts';
import { ESLINT_OVERRIDE_POLICY } from '#tests/config/samples/javascript.ts';
import { FORMAT_OVERRIDES_POLICY } from '#tests/config/samples/formatting.ts';
import { parseTomlText, parseExpiryDate } from '#cli/policy/document/public.ts';
import { getTemplate, parseTemplate, exportTemplate } from '#cli/policy/document/contracts.ts';

test.each([
    ['preserves ESLint rules and authored path', ESLINT_OVERRIDE_POLICY, 'project.template.toml'],
    ['retains authored formatter path', FORMAT_OVERRIDES_POLICY, 'format.template.toml'],
])('template export %s overrides', (_name, policy, filename) => {
    const exported = exportTemplate(policy, filename);
    expect(exported.text).toContain('overrides');
    if (policy === ESLINT_OVERRIDE_POLICY)
        expect(parseTemplate(exported.text, filename).tables.tools?.eslint?.rules?.['eqeqeq']).toStrictEqual(['smart']);
    expect(exported.leftOut).toStrictEqual([
        'scope."apps/web": belongs to this repository',
        'scope."apps/web/admin": belongs to this repository',
    ]);
});

test('template export preserves authored empty integrations and rule tables', () => {
    const checks = Object.fromEntries(
        ['ordinary', '__proto__', 'constructor'].map((key) => [
            key,
            {
                command: ['git', 'status'],
                paths: ['**/*'],
                stage: 'manual',
            },
        ]),
    );
    const authored = 'configurations = []\n[hooks]\n[tools.eslint.rules]\n' + stringify({ check: checks });
    const exported = exportTemplate(authored, 'team.template.toml');
    const imported = parseTemplate(exported.text, 'team.template.toml');
    expect(exported.text).toContain('[hooks]');
    expect(imported.tables.hooks).toStrictEqual({});
    expect(imported.tables.tools?.eslint?.rules).toStrictEqual({});
    expect(parseTomlText(authored, 'source.template.toml', 'template')['check']).toStrictEqual(imported.tables.check);
    expect(Object.keys(parseStrictPolicy(stringify({ check: imported.tables.check })).check)).toStrictEqual(
        Object.keys({ ...imported.tables.check }),
    );
    expect(Object.hasOwn(Object.prototype, 'command')).toBe(false);
});

test('template export preserves advisory reasons and expiry and path-specific rows', () => {
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
        'team.template.toml',
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

test('template export retains authored empty tables without writing schema defaults into them', () => {
    const authored = 'configurations = []\n[naming]\n[architecture]\n[structure]\n[tools.eslint.rules]\n';
    const exported = exportTemplate(authored, 'empty.template.toml');
    const raw = parse(exported.text);
    expect({
        naming: raw['naming'],
        architecture: raw['architecture'],
        structure: raw['structure'],
        tools: raw['tools'],
    }).toStrictEqual({ naming: {}, architecture: {}, structure: {}, tools: { eslint: { rules: {} } } });
    const absent = parse(exportTemplate('configurations = []\n', 'absent.template.toml').text);
    for (const table of ['naming', 'architecture', 'structure', 'tools'])
        expect(Object.hasOwn(absent, table)).toBe(false);
});

test('an absolute template loads from a different working directory', async () => {
    const source = 'policies/café house.template.toml';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        [source]: 'template = "house"\nselection = "exact"\nconfigurations = ["bash"]\n',
        'project/README.md': '# Project\n',
    });
    const relative = await getTemplate(source, sandbox.path);
    const absolute = await getTemplate(join(sandbox.path, source), join(sandbox.path, 'project'));
    expect(absolute.tables).toStrictEqual(relative.tables);
    expect(absolute.digest).toBe(relative.digest);
});

test('templates retain runner coverage settings and authored architecture roles', async () => {
    await using directory = await testdir();
    const tools = { eslint: { runtimes: { 'src/**': 'node' } } };
    const coverage = { lines: 90 };
    const roles = { test_harness: 'tests/fixtures' };
    const exported = exportTemplate(
        stringify({ configurations: ['jest'], tools, coverage, architecture: { roles } }),
        'shared.template.toml',
    );
    await createFileTree(directory.path, { 'shared.template.toml': exported.text });
    const restored = await getTemplate('shared.template.toml', directory.path);
    expect(restored.tables.tools?.['eslint']).toStrictEqual(tools.eslint);
    expect(restored.tables.coverage).toStrictEqual(coverage);
    expect(exported.leftOut).toStrictEqual([]);
    expect(restored.tables.architecture?.roles).toStrictEqual(roles);
    await createFileTree(directory.path, {
        'invalid.template.toml': stringify({
            template: 'local',
            selection: 'exact',
            configurations: ['jest'],
            architecture: { roles },
        }),
    });
    const invalid = await getTemplate('invalid.template.toml', directory.path);
    expect(invalid.tables.architecture?.roles).toStrictEqual(roles);
});

test('templates round-trip license allowances and exact-version exceptions', async () => {
    await using directory = await testdir();
    const licenses = {
        allowed: ['MPL-2.0'],
        exceptions: { 'example@1.2.3': { license: 'BSD', reason: 'Reviewed package metadata.' } },
    };
    const exported = exportTemplate(stringify({ configurations: ['licenses'], licenses }), 'licenses.template.toml');
    await createFileTree(directory.path, { 'licenses.template.toml': exported.text });
    const restored = await getTemplate('licenses.template.toml', directory.path);
    expect(restored.tables.licenses).toStrictEqual(licenses);
    expect(exported.leftOut).toStrictEqual([]);
});
