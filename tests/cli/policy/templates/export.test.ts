// An exported template keeps the rules of the policy and leaves out what only fits this repository.
import { test, expect } from 'bun:test';
import { parse, stringify } from 'smol-toml';
import { parseTemplate, exportTemplate } from '#cli/policy/templates.ts';
import { ESLINT_OVERRIDE_POLICY } from '#tests/config/samples/javascript.ts';
import { FORMAT_OVERRIDES_POLICY } from '#tests/config/samples/formatting.ts';

test('template export preserves ESLint rules and omits repository-specific overrides', () => {
    const exported = exportTemplate(ESLINT_OVERRIDE_POLICY, 'project.template.toml');
    expect(exported.text).not.toContain('overrides');
    expect(parseTemplate(exported.text, 'project.template.toml').tables.tools?.eslint?.rules?.['eqeqeq']).toStrictEqual(
        ['smart'],
    );
    expect(exported.leftOut).toContain('tools.eslint.overrides[0]: names a repository path');
});

test('template export omits repository-specific formatter overrides', () => {
    const exported = exportTemplate(FORMAT_OVERRIDES_POLICY, 'format.template.toml');
    expect(exported.text).not.toContain('overrides');
    expect(exported.leftOut).toContain('format.overrides[0]: names a repository path');
});

test('template export preserves authored empty integrations and rule tables', () => {
    const exported = exportTemplate('configurations = []\n[hooks]\n[tools.eslint.rules]\n', 'team.template.toml');
    const imported = parseTemplate(exported.text, 'team.template.toml');
    expect(exported.text).toContain('[hooks]');
    expect(imported.tables.hooks).toStrictEqual({ push_files: 'changed' });
    expect(imported.tables.tools?.eslint?.rules).toStrictEqual({});
});

test('template export preserves advisory reasons and expiry while reporting path-specific omissions', () => {
    const advisory = {
        check: 'dependencies/osv',
        rule: 'GHSA-reviewed',
        reason: 'No fixed version is available.',
        until: '2099-05-21',
    };
    const expired = {
        check: 'dependencies/osv',
        rule: 'GHSA-expired',
        reason: 'Review remains recorded.',
        until: '2000-01-01',
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
    expect(imported.tables.ignore).toStrictEqual([advisory, expired]);
    expect(exported.leftOut).toStrictEqual(['ignore[2]: names a repository path']);
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
