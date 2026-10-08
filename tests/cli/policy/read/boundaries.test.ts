import { stringify } from 'smol-toml';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { textContaining } from '#tests/harness/expectations.ts';
import { buildPolicy, policyFindings } from '#tests/harness/policy.ts';
import { readPolicyText, parseStrictPolicy } from '#cli/policy/read.ts';
import { UNSAFE_DIRECTORIES } from '#tests/config/cli/policy/boundaries.ts';

describe('configuration directory boundaries', () => {
    test.each(
        UNSAFE_DIRECTORIES.flatMap(
            (path) =>
                [
                    ['scope', path],
                    ['agent_rules', path],
                ] as const,
        ),
    )('%s refuses escaping directory %j before filesystem discovery', (table, path) => {
        const text = stringify(table === 'scope' ? { scope: { [path]: {} } } : { agent_rules: { folder: path } });
        const errors = policyFindings(text);
        expect(errors.join('\n')).toContain(table === 'scope' ? `scope.${path}` : 'agent_rules.folder');
        expect(errors.join('\n')).toContain('Use a relative path');
    });

    test('accepts relative directories containing spaces, percent signs, and Unicode', async () => {
        const path = 'apps/café 100%';
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { [`${path}/source.ts`]: 'export const count = 1;\n' });
        const policy = parseStrictPolicy(
            stringify({ scope: { [path]: {} }, agent_rules: { folder: 'agent rules/café 100%' } }),
            sandbox.path,
        );
        expect(Object.keys(policy.scope)).toStrictEqual([path]);
        expect(policy.agent_rules.folder).toBe('agent rules/café 100%');
    });
});

test.each([
    { source: 'paths = []\nrules = {eqeqeq = ["always"]}', message: 'gspot.toml: tools.eslint.overrides.0.paths:' },
    { source: 'paths = ["src"]\nrules = {eqeqeq = 0}', message: 'gspot.toml: tools.eslint.overrides.0.rules.eqeqeq:' },
    {
        source: 'paths = ["src"]\nrules = {eqeqeq = true}',
        message: 'gspot.toml: tools.eslint.overrides.0.rules.eqeqeq:',
    },
    {
        source: 'paths = ["src"]\nrulez = {eqeqeq = ["always"]}',
        message: 'gspot.toml: `rulez` is not a setting gspot knows under [tools.eslint.overrides.0]',
    },
])('invalid ESLint override names its refusal: $message', ({ source, message: diagnostic }) => {
    const errors = policyFindings(buildPolicy(['javascript'], { tables: `[[tools.eslint.overrides]]\n${source}\n` }));
    expect(errors).toContainEqual(textContaining(diagnostic));
});

test.each(["author's name", '$(printf injected); *'])(
    'an existing naming entry %j asks for a reason on that entry',
    (name) => {
        const found = policyFindings(stringify({ configurations: ['naming'], naming: { allowed: { [name]: '' } } }));
        expect(found).toHaveLength(1);
        expect(found[0]).toContain(name);
        expect(found[0]).toContain('reason');
        expect(found[0]).not.toContain('run:');
        const reason = 'The external interface fixes this exact name.';
        const corrected = parseStrictPolicy(
            stringify({ configurations: ['naming'], naming: { allowed: { [name]: reason } } }),
        );
        expect(corrected.naming.allowed).toStrictEqual({ [name]: reason });
    },
);

test.each([false, true])(
    'override rule severities are refused without accepting sibling rule selections (scoped: %s)',
    (nested) => {
        const prefix = nested ? '[scope."app"]\n[[scope."app".tools.eslint.overrides]]' : '[[tools.eslint.overrides]]';
        const source = buildPolicy(['javascript'], {
            tables: `${prefix}\npaths = ["src/**"]\nrules = {eqeqeq = 0, "no-var" = []}\n`,
        });
        expect(() => parseStrictPolicy(source)).toThrow('gspot ignore');
        expect(() => readPolicyText(source)).toThrow('gspot ignore');
        const corrected = parseStrictPolicy(source.replace('eqeqeq = 0, ', ''));
        expect(nested ? corrected.scopeTables['app']?.tools?.['eslint'] : corrected.tools['eslint']).toStrictEqual({
            overrides: [{ paths: [nested ? 'app/src/**' : 'src/**'], rules: { 'no-var': [] } }],
        });
    },
);

test.each(UNSAFE_DIRECTORIES)('authored agent rules refuse an escaping project folder %j', (path) => {
    const found = policyFindings(stringify({ agent_rules: { own_rules_folder: path } }));
    expect(found).toContainEqual(textContaining('agent_rules.own_rules_folder'));
    expect(found).toContainEqual(textContaining('Use a relative path'));
});

test('authored agent rules accept a repository-relative project folder', () => {
    const policy = parseStrictPolicy(stringify({ agent_rules: { own_rules_folder: 'rules/café 100%' } }));
    expect(policy.agent_rules.own_rules_folder).toBe('rules/café 100%');
});
