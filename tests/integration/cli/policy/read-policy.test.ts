import { parsePolicyText, PolicyError, readPolicy } from '#cli/policy/read-policy.ts';
import { describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { createFileTree, testdir } from 'testdirs';

const minimal = 'version = 1\nconfigurations = ["bash"]\n';

function problems(text: string, root?: string): string[] {
    try {
        parsePolicyText(text, 'gspot.toml', root);
        return [];
    } catch (error) {
        if (error instanceof PolicyError) return error.problems;
        throw error;
    }
}

describe('parsePolicyText', () => {
    test('missing adopted executables identify the module value and accept a repository file', async () => {
        await using sandbox = await testdir();
        const text =
            'version = 1\n[[tools.eslint.adopted]]\n[tools.eslint.adopted.processor]\nmodule = "./processing.mjs"\nexport = "default"\n';
        const found = problems(text, sandbox.path);
        expect(found).toHaveLength(1);
        expect(found[0]).toStartWith('gspot.toml:4:');
        expect(found[0]).toContain('executable module is missing');
        await createFileTree(sandbox.path, { 'processing.mjs': 'export default {};\n' });
        expect(problems(text, sandbox.path)).toEqual([]);
    });
    test.each([
        {
            name: 'a missing ignore reason',
            text: 'version = 1\nrequire_reasons = true\n[[ignore]]\ncheck = "bash/syntax"\n',
            line: 3,
            before: '',
            after: 'reason = "The native shell is checked by the project command."\n',
        },
        {
            name: 'a grouped limit reason',
            text: 'version = 1\nrequire_reasons = true\n[limits.python]\nfile_lines = {value = 300, reason = "N/A"}\n',
            line: 4,
            before: 'N/A',
            after: 'The generated route table is reviewed as one file.',
        },
        {
            name: 'a scoped disabled rule',
            text: 'version = 1\n[[scope]]\npath = "api"\n[scope.tools.eslint.rules]\n"no-console" = "off"\n',
            line: 5,
            before: '"off"',
            after: '"error"',
        },
    ])('semantic errors locate $name and accept its correction', ({ text, line, before, after }) => {
        const found = problems(text);
        expect(found).toHaveLength(1);
        expect(found[0]).toStartWith(`gspot.toml:${String(line)}:`);
        const corrected = before === '' ? text + after : text.replace(before, after);
        expect(problems(corrected)).toEqual([]);
    });
    test.each([
        {
            name: 'a multiline array value',
            text: 'version = 1\nconfigurations = [\n"bash",\n12\n]\n',
            line: 4,
            correction: ['12', '"toml"'],
        },
        {
            name: 'a quoted key',
            text: 'version = 1\n"require_reasons" = "wrong"\n',
            line: 2,
            correction: ['"wrong"', 'true'],
        },
        {
            name: 'an inline table value',
            text: 'version = 1\ntools = { jest = { coverage_lines = "wrong" } }\n',
            line: 2,
            correction: ['"wrong"', '90'],
        },
        {
            name: 'a repeated scope table',
            text: 'version = 1\n[[scope]]\npath = "api"\n[[scope]]\npath = "web"\n[scope.tools.jest]\ncoverage_lines = "wrong"\n',
            line: 7,
            correction: ['"wrong"', '90'],
        },
        {
            name: 'an unknown nested key',
            text: 'version = 1\n[[scope]]\npath = "api"\nconfigurationz = []\n',
            line: 4,
            correction: ['configurationz', 'configurations'],
        },
        {
            name: 'a nested array of tables under a second scope',
            text: 'version = 1\n[[scope]]\npath = "api"\n[[scope.tools.eslint.overrides]]\npaths = ["src"]\nrules = {eqeqeq = "error"}\n[[scope]]\npath = "web"\n[[scope.tools.eslint.overrides]]\npaths = []\nrules = {eqeqeq = "error"}\n',
            line: 10,
            correction: ['paths = []', 'paths = ["src"]'],
        },
    ])('schema errors locate $name and accept its correction', ({ name, text, line, correction }) => {
        const found = problems(text);
        expect(found).toHaveLength(1);
        expect(found[0]).toStartWith(`gspot.toml:${String(line)}:`);
        if (name === 'a quoted key') expect(found[0]).toContain('expected boolean, received string');
        expect(problems(text.replace(correction[0]!, correction[1]!))).toEqual([]);
    });
    test.each(['\n', '\r\n'])(
        'syntax errors name their location without copying neighboring source with %j lines',
        (newline) => {
            const invalid = ['# private fixture marker', 'version = 1', 'configurations = ?', ''].join(newline);
            const found = problems(invalid);
            expect(found).toHaveLength(1);
            expect(found[0]).toMatch(/^gspot\.toml:3:\d+ is not valid TOML:/u);
            expect(found[0]).not.toContain('private fixture marker');
            expect(found[0]).not.toContain('\n');
            expect(problems(invalid.replace('configurations = ?', 'configurations = []'))).toEqual([]);
        },
    );
    test.each(['linked', 'linked/nested'])('scope %s cannot follow an external directory symlink', async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'project/.keep': '', 'outside/nested/sentinel': 'unchanged' });
        const root = join(sandbox.path, 'project');
        symlinkSync('../outside', join(root, 'linked'));
        const found = problems(`${minimal}[[scope]]\npath = "${path}"\n`, root);
        expect(found).toHaveLength(1);
        expect(found[0]).toContain('Unsafe lifecycle');
        expect(readFileSync(join(sandbox.path, 'outside/nested/sentinel'), 'utf8')).toBe('unchanged');
    });

    test('normalizes reasoned limits into value and reason', () => {
        const policy = parsePolicyText(
            `${minimal}[limits]\nfile_lines = 300\nfunction_lines = { value = 80, reason = "Route tables are one ordered list each." }\n[limits.python]\nfile_lines = 400\n`,
            'gspot.toml',
        );
        expect(policy.limits.root['file_lines']).toEqual({ value: 300 });
        expect(policy.limits.root['function_lines']).toEqual({
            value: 80,
            reason: 'Route tables are one ordered list each.',
        });
        expect(policy.limits.groups['python']?.['file_lines']).toEqual({ value: 400 });
    });

    test('normalizes per-language naming tables and categories', () => {
        const policy = parsePolicyText(
            `${minimal}[naming]\nbanned_terms = ["dispatcher"]\n[naming.python]\nmax_words = 4\n[naming.python.parameters]\nmax_words = { value = 3, reason = "Handler signatures read as one line." }\n`,
            'gspot.toml',
        );
        expect(policy.naming.banned_terms).toEqual(['dispatcher']);
        expect(policy.naming.languages['python']?.max_words).toEqual({ value: 4 });
        expect(policy.naming.languages['python']?.categories['parameters']?.max_words?.reason).toBe(
            'Handler signatures read as one line.',
        );
    });

    test('an unknown key names the keys that exist under that table', () => {
        const found = problems(`${minimal}[hooks]\ntool = "gspot"\ntol = "gspot"\n`);
        expect(found).toHaveLength(1);
        expect(found[0]).toContain('`tol` is not a setting gspot knows under [hooks]');
        expect(found[0]).toContain('`tool`');
    });

    test('an unknown top-level key is refused', () => {
        expect(problems(`${minimal}color = "red"\n`)[0]).toContain(
            '`color` is not a setting gspot knows under the top level',
        );
    });

    test('an ignore without a reason that says something is refused', () => {
        for (const reason of ['', 'N/A', 'TBD', '-', 'because']) {
            const found = problems(
                `${minimal}require_reasons = true\n[[ignore]]\ncheck = "bash/shellcheck"\nreason = "${reason}"\n`,
            );
            expect(found[0]).toContain('needs a reason that says something');
        }
    });

    test('a directory selector is accepted', () => {
        const found = problems(
            `${minimal}[[ignore]]\ncheck = "bash/shellcheck"\npaths = ["scripts"]\nreason = "One launcher script per environment."\n`,
        );
        expect(found).toEqual([]);
    });

    test('a rule slot set to off names the ignore line', () => {
        const found = problems(`${minimal}[tools.eslint]\nrules = { "unicorn/no-null" = "off" }\n`);
        expect(found[0]).toContain('gspot ignore');
        expect(found[0]).toContain('--rule unicorn/no-null');
    });

    test('an extra table needs a reason', () => {
        expect(
            problems(`${minimal}require_reasons = true\n[tools.markdownlint.extra]\nMD044 = false\nreason = ""\n`)[0],
        ).toContain('[tools.markdownlint.extra] needs a `reason`');
    });

    test('a version other than 1 is refused', () => {
        expect(problems('version = 2\n')[0]).toContain('version = 2');
    });

    test('invalid TOML is reported as such', () => {
        expect(problems('version = \n')[0]).toContain('is not valid TOML');
    });

    test('nested scopes are accepted and a missing scope is refused', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'api/a.txt': '', 'api/inner/b.txt': '' });
        const found = problems(
            `${minimal}[[scope]]\npath = "api"\n[[scope]]\npath = "api/inner"\n[[scope]]\npath = "missing"\n`,
            sandbox.path,
        );
        expect(found.some((problem) => problem.includes('`missing` names a directory that does not exist'))).toBe(true);
        expect(found).toHaveLength(1);
        expect(found[0]).toStartWith('gspot.toml:8:');
        mkdirSync(join(sandbox.path, 'missing'));
        expect(
            problems(
                `${minimal}[[scope]]\npath = "api"\n[[scope]]\npath = "api/inner"\n[[scope]]\npath = "missing"\n`,
                sandbox.path,
            ),
        ).toEqual([]);
    });

    test('a vendored declaration needs a reason when required', () => {
        expect(problems(`${minimal}require_reasons = true\n[[vendored]]\npaths = ["vendor/**"]\n`)[0]).toContain(
            'needs a reason',
        );
    });
});

describe('readPolicy', () => {
    test('reads gspot.toml from a root', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': minimal,
        });
        const files = readPolicy(sandbox.path);
        expect(files.policy.configurations).toEqual(['bash']);
    });

    test('a missing gspot.toml points at init', async () => {
        await using sandbox = await testdir();
        expect(() => readPolicy(sandbox.path)).toThrow('Run `gspot init`');
    });
});

describe('repository correction contracts', () => {
    const check = `${minimal}[[check]]
name = "sandbox/correction"
command = ["tool", "check"]
paths = ["source.txt"]
stage = "commit"
`;

    test('keeps advice separate from the correction command and its ordering', () => {
        const policy = parsePolicyText(
            `${check}help = "Review the tool output."
fix_command = ["tool", "correct"]
fix_order = "imports"
`,
            'gspot.toml',
        );
        expect(policy.checks[0]?.help).toBe('Review the tool output.');
        expect(policy.checks[0]?.fix_command).toEqual(['tool', 'correct']);
        expect(policy.checks[0]?.fix_order).toBe('imports');
    });

    test('refuses incomplete executable corrections', () => {
        expect(problems(`${check}fix_command = ["tool"]`)[0]).toContain('fix_order');
        expect(problems(`${check}fix_command = []\nfix_order = "format"`)).not.toEqual([]);
    });
});

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
        parsePolicyText(`version = 1\nconfigurations = ["javascript"]\n[[tools.eslint.overrides]]\n${entry}\n`, 'gspot.toml'),
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
        const found = problems(stringify({ version: 1, require_reasons: true, naming: { allowed: [{ name }] } }));
        const message = found.find((problem) => problem.includes('gspot set naming.allowed'))!;
        const command = message.slice(message.indexOf('gspot set naming.allowed')).replace(/`?\.?$/u, '');
        const executed = Bun.spawnSync(['sh', '-c', 'gspot() { printf "%s\\0" "$@"; }; ' + command], {
            stdout: 'pipe',
            stderr: 'pipe',
        });
        expect(executed.exitCode, executed.stderr.toString()).toBe(0);
        expect(executed.stdout.toString().split('\0').slice(0, 3)).toEqual([
            'set',
            'naming.allowed',
            JSON.stringify({ name }),
        ]);
    },
);
