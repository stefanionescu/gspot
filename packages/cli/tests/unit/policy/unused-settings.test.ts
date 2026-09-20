import { expect, test } from 'bun:test';
import { parsePolicyText } from '#cli/policy/read-policy.ts';
import { assertPolicyComplete } from '#cli/policy/validate-policy.ts';

const policy = 'version = 1\npresets = ["structure", "secrets"]\n';

const architectureKeys = [
    'package_roots',
    'route_directories',
    'shared_directories',
    'feature_contracts',
    'imports_allowed',
];

test.each(architectureKeys)('rejects the unused architecture.%s field at root and in a scope', (key) => {
    for (const scope of ['', '[[scope]]\npath = "api"\n']) {
        const table = scope === '' ? 'architecture' : 'scope.architecture';
        expect(() => parsePolicyText(`${policy}${scope}[${table}]\n${key} = []\n`, 'gspot.toml')).toThrow(`\`${key}\``);
    }
});

test('rejects the unused editor table', () => {
    expect(() => parsePolicyText(`${policy}[editor]\nvscode = true\n`, 'gspot.toml')).toThrow('`editor`');
    expect(parsePolicyText(policy, 'gspot.toml')).not.toHaveProperty('editor');
});

test.each(['limits.line_length', 'limits.trivial_ast_nodes', 'tools.trufflehog.verified_only'])(
    'rejects the unused setting %s during selection validation',
    (key) => {
        const table = key.slice(0, key.lastIndexOf('.'));
        const name = key.slice(key.lastIndexOf('.') + 1);
        const config = parsePolicyText(`${policy}[${table}]\n${name} = 1\n`, 'gspot.toml');
        expect(() => {
            assertPolicyComplete(config);
        }).toThrow(key);
    },
);
