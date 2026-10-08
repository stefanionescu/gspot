// An exported template keeps the rules of the policy and leaves out what only fits this repository.
import { test, expect } from 'bun:test';
import { parse, stringify } from 'smol-toml';
import { parseExpiryDate } from '#cli/policy/file.ts';
import { parseTemplate, exportTemplate } from '#cli/policy/templates.ts';
import { ESLINT_OVERRIDE_POLICY } from '#tests/config/samples/javascript.ts';
import { FORMAT_OVERRIDES_POLICY } from '#tests/config/samples/formatting.ts';

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
    const exported = exportTemplate('configurations = []\n[hooks]\n[tools.eslint.rules]\n', 'team.template.toml');
    const imported = parseTemplate(exported.text, 'team.template.toml');
    expect(exported.text).toContain('[hooks]');
    expect(imported.tables.hooks).toStrictEqual({});
    expect(imported.tables.tools?.eslint?.rules).toStrictEqual({});
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
