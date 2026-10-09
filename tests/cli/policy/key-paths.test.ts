import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { symlink } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { parseTomlText } from '#cli/policy/document/public.ts';
import { buildPolicy, policyFindings } from '#tests/harness/policy.ts';
import { readPolicyTable, parseStrictPolicy } from '#cli/policy/public.ts';
import { SCHEMA_KEY_PATH_CASES, SEMANTIC_KEY_PATH_CASES } from '#tests/config/cli/policy/key-paths.ts';

test.each(SEMANTIC_KEY_PATH_CASES)(
    'parseStrictPolicy > semantic errors name the key path of $name and pass after the fix',
    ({ text, where, before, after }) => {
        const found = policyFindings(text);
        expect(found).toHaveLength(1);
        expect(found[0]).toStartWith(`gspot.toml: ${where}:`);
        const corrected = before === '' ? text + after : text.replace(before, after);
        expect(policyFindings(corrected)).toStrictEqual([]);
    },
);
test.each([
    ...SCHEMA_KEY_PATH_CASES,
    ...[
        {
            correction: ['paths = []', 'paths = ["src"]'] as const,
            where: ['tools.eslint.overrides.0.paths:'],
            source: 'paths = []\nrules = {eqeqeq = ["always"]}',
        },
        {
            correction: ['eqeqeq = 0', 'eqeqeq = ["always"]'] as const,
            where: ['tools.eslint.overrides.0.rules.eqeqeq:'],
            source: 'paths = ["src"]\nrules = {eqeqeq = 0}',
        },
        {
            correction: ['eqeqeq = true', 'eqeqeq = ["always"]'] as const,
            where: ['tools.eslint.overrides.0.rules.eqeqeq:'],
            source: 'paths = ["src"]\nrules = {eqeqeq = true}',
        },
        {
            correction: ['rulez', 'rules'] as const,
            where: [
                'tools.eslint.overrides.0.rules:',
                '`rulez` is not a setting gspot knows under [tools.eslint.overrides.0]',
            ],
            source: 'paths = ["src"]\nrulez = {eqeqeq = ["always"]}',
        },
    ].map(({ source, correction, where }) => ({
        name: where.join(', '),
        text: buildPolicy(['javascript'], { tables: `[[tools.eslint.overrides]]\n${source}\n` }),
        where,
        correction,
        messages: [],
    })),
])(
    'parseStrictPolicy > schema errors name the key path of $name and pass after the fix',
    ({ text, where, correction, messages }) => {
        const found = policyFindings(text);
        expect(found).toHaveLength(where.length);
        for (const [index, path] of where.entries()) {
            expect(found[index]).toStartWith(`gspot.toml: ${path}`);
        }
        for (const message of messages) expect(found[0]).toContain(message);
        expect(policyFindings(text.replace(correction[0], correction[1]))).toStrictEqual([]);
    },
);
test.each(['\n', '\r\n'])(
    'parseStrictPolicy > syntax errors name their location without copying neighboring source with %j lines',
    (newline) => {
        const invalid = ['# private fixture marker', 'configurations = ?', ''].join(newline);
        const found = policyFindings(invalid);
        expect(found).toHaveLength(1);
        expect(found[0]).toMatch(/^gspot\.toml:2:\d+ is not valid TOML:/u);
        expect(found[0]).not.toContain('private fixture marker');
        expect(found[0]).not.toContain('\n');
        expect(policyFindings(invalid.replace('configurations = ?', 'configurations = []'))).toStrictEqual([]);
    },
);
test.each(['linked', 'linked/nested'])(
    'parseStrictPolicy > scope %s cannot follow an external directory symlink',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'project/.keep': '', 'outside/nested/sentinel': 'unchanged' });
        const root = join(sandbox.path, 'project');
        await symlink('../outside', join(root, 'linked'));
        const found = policyFindings(`${buildPolicy(['bash'])}[scope."${path}"]\n`, root);
        expect(found).toHaveLength(1);
        expect(found[0]).toContain('Unsafe lifecycle');
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
        expect(() => readPolicyTable(parseTomlText(source, 'gspot.toml', 'policy'))).toThrow('gspot ignore');
        const corrected = parseStrictPolicy(source.replace('eqeqeq = 0, ', ''));
        expect(nested ? corrected.scopeTables['app']?.tools?.['eslint'] : corrected.tools['eslint']).toStrictEqual({
            overrides: [{ paths: [nested ? 'app/src/**' : 'src/**'], rules: { 'no-var': [] } }],
        });
    },
);
