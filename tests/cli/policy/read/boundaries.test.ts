import { stringify } from 'smol-toml';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { buildPolicy, policyFindings } from '#tests/harness/policy.ts';
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

test.each(UNSAFE_DIRECTORIES)('authored agent rules refuse an escaping project folder %j', (path) => {
    const found = policyFindings(stringify({ agent_rules: { own_rules_folder: path } }));
    expect(found).toContainEqual(textContaining('agent_rules.own_rules_folder'));
    expect(found).toContainEqual(textContaining('Use a relative path'));
});

test('authored agent rules accept a repository-relative project folder', () => {
    const policy = parseStrictPolicy(stringify({ agent_rules: { own_rules_folder: 'rules/café 100%' } }));
    expect(policy.agent_rules.own_rules_folder).toBe('rules/café 100%');
});

test.each(['../outside', 'C:outside'])('the harness role refuses the escaping folder %s', (path) => {
    expect(() =>
        parseStrictPolicy(
            buildPolicy(['jest'], { tables: `[architecture.roles]\ntest_harness = ${JSON.stringify(path)}\n` }),
        ),
    ).toThrow('Use a relative path with forward slashes, without parent traversal or a drive prefix.');
});

test('the harness role accepts an owned folder', () => {
    const policy = parseStrictPolicy(
        buildPolicy(['jest'], { tables: '[architecture.roles]\ntest_harness = "tests/fixtures"\n' }),
    );
    expect(policy.architecture.roles['test_harness']).toBe('tests/fixtures');
});
