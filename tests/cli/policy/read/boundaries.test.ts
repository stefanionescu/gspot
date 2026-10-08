import { stringify } from 'smol-toml';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { policyFindings } from '#tests/harness/policy.ts';
import { UNSAFE_DIRECTORIES } from '#tests/config/cli/policy/boundaries.ts';

describe('configuration directory boundaries', () => {
    test.each(
        UNSAFE_DIRECTORIES.flatMap((path) => [
            { where: `scope.${path}`, path, values: { scope: { [path]: {} } } },
            { where: 'agent_rules.folder', path, values: { agent_rules: { folder: path } } },
            {
                where: 'architecture.roles.test_harness',
                path,
                values: { architecture: { roles: { test_harness: path } } },
            },
            { where: 'agent_rules.own_rules_folder', path, values: { agent_rules: { own_rules_folder: path } } },
        ]),
    )('$where refuses escaping directory $path before filesystem discovery', ({ where, values }) => {
        const errors = policyFindings(stringify(values));
        expect(errors.join('\n')).toContain(where);
        expect(() => parseStrictPolicy(stringify(values))).toThrow(
            'Use a relative path with forward slashes, without parent traversal or a drive prefix.',
        );
    });

    test('accepts relative directories containing spaces, percent signs, and Unicode', async () => {
        const path = 'apps/café 100%';
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { [`${path}/source.ts`]: 'export const count = 1;\n' });
        const policy = parseStrictPolicy(
            stringify({
                scope: { [path]: {} },
                agent_rules: { folder: 'agent rules/café 100%', own_rules_folder: 'rules/café 100%' },
                architecture: { roles: { test_harness: 'tests/fixtures' } },
            }),
            sandbox.path,
        );
        expect(Object.keys(policy.scope)).toStrictEqual([path]);
        expect(policy.agent_rules.folder).toBe('agent rules/café 100%');
        expect(policy.architecture.roles['test_harness']).toBe('tests/fixtures');
        expect(policy.agent_rules.own_rules_folder).toBe('rules/café 100%');
    });
});
