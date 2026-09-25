import { parsePolicyText, PolicyError } from '#cli/policy/read.ts';
import { policyProblems } from '#tests/support/cli/policy-problems.ts';
import { describe, expect, test } from 'bun:test';
import { readFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { createFileTree, testdir } from 'testdirs';

describe('configuration directory boundaries', () => {
    test.each([
        '../outside',
        'api/../../outside',
        '/outside',
        'C:outside',
        'C:/outside',
        String.raw`..\outside`,
        String.raw`\\host\share`,
        'bad\0path',
        'api\n/../../outside',
        'api\u{2028}/../../outside',
        '',
    ])('refuses escaping directory %j before filesystem discovery', (path) => {
        for (const settings of [{ scope: [{ path }] }, { rules: { directory: path } }]) {
            expect(() => parsePolicyText(stringify({ version: 1, ...settings }), 'gspot.toml')).toThrow(PolicyError);
        }
    });

    test('accepts relative directories containing spaces, percent signs, and Unicode', async () => {
        const path = 'apps/café 100%';
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { [`${path}/source.ts`]: 'export const count = 1;\n' });
        const policy = parsePolicyText(
            stringify({ version: 1, scope: [{ path }], rules: { directory: 'agent rules/café 100%' } }),
            'gspot.toml',
            sandbox.path,
        );
        expect(policy.scopes[0]?.path).toBe(path);
        expect(policy.rules.directory).toBe('agent rules/café 100%');
    });
});

for (const scoped of [false, true]) {
    test.each(['"off"', '0', '["off"]', '[0]'])(
        `disabled ESLint severity %s is refused in ${scoped ? 'scoped' : 'root'} rule settings`,
        (severity) => {
            const prefix = scoped ? '[[scope]]\npath = "src"\n[scope.tools.eslint.rules]' : '[tools.eslint.rules]';
            expect(() =>
                parsePolicyText(
                    `version = 1\nconfigurations = ["javascript"]\n${prefix}\n"no-console" = ${severity}\n`,
                    'gspot.toml',
                ),
            ).toThrow('gspot ignore');
        },
    );
}

test.each([
    'paths = []\nrules = {eqeqeq = "error"}',
    'paths = ["src"]\nrules = {eqeqeq = 0}',
    'paths = ["src"]\nrules = {eqeqeq = ["off"]}',
    'paths = ["src"]\nrules = {eqeqeq = true}',
    'paths = ["src"]\nrulez = {eqeqeq = "error"}',
])('invalid ESLint override refuses configuration: %s', (entry) => {
    expect(() =>
        parsePolicyText(
            `version = 1\nconfigurations = ["javascript"]\n[[tools.eslint.overrides]]\n${entry}\n`,
            'gspot.toml',
        ),
    ).toThrow();
});

test('ESLint selector bases and local registrations reject links while future selector directories remain valid', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/README.md': 'inside\n',
        'outside/processing.mjs': 'export default {};\n',
    });
    const root = join(directory.path, 'project');
    symlinkSync('../outside', join(root, 'linked'));
    const configured = (adopted: unknown[]) =>
        stringify({ version: 1, configurations: ['javascript'], tools: { eslint: { adopted } } });
    expect(() => parsePolicyText(configured([{ basePath: 'linked' }]), 'gspot.toml', root)).toThrow('Unsafe lifecycle');
    expect(() =>
        parsePolicyText(
            configured([{ processor: { module: './linked/processing.mjs', export: 'default' } }]),
            'gspot.toml',
            root,
        ),
    ).toThrow('Unsafe lifecycle');
    expect(() => parsePolicyText(configured([{ basePath: '../outside' }]), 'gspot.toml', root)).toThrow(
        'relative path',
    );
    expect(() =>
        parsePolicyText(
            configured([{ processor: { module: '../outside/processing.mjs', export: 'default' } }]),
            'gspot.toml',
            root,
        ),
    ).toThrow('must belong to the repository');
    expect(() => parsePolicyText(configured([{ basePath: 'future/source' }]), 'gspot.toml', root)).not.toThrow();
    expect(readFileSync(join(directory.path, 'outside/processing.mjs'), 'utf8')).toBe('export default {};\n');
});

test.each(["author's name", 'two words', '$(printf injected); *', 'line\nbreak'])(
    'suggested naming recovery preserves the argument %j through a shell',
    (name) => {
        const found = policyProblems(stringify({ version: 1, require_reasons: true, naming: { allowed: [{ name }] } }));
        const message = found.find((problem) => problem.includes('gspot set naming.allowed'))!;
        const command = message.slice(message.indexOf('gspot set naming.allowed')).replace(/`?\.?$/u, '');
        const executed = Bun.spawnSync(['sh', '-c', String.raw`gspot() { printf "%s\0" "$@"; }; ` + command], {
            stdout: 'pipe',
            stderr: 'pipe',
        });
        expect(executed.exitCode, executed.stderr.toString()).toBe(0);
        expect(executed.stdout.toString().split('\0').slice(0, 3)).toStrictEqual([
            'set',
            'naming.allowed',
            JSON.stringify({ name }),
        ]);
    },
);
