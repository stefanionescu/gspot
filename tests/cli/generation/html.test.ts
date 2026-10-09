import { test, expect } from 'bun:test';
import { parse as parseJsonc } from 'jsonc-parser';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { parseStrictPolicy } from '#cli/policy/public.ts';
import { BUILT_HTML_RULES, DISABLED_TOOL_RULES } from '#tests/config/cli/generation/html.ts';

test.each(['recommended', 'all'] as const)(
    'HTML source and built rules retain their native boundaries at %s',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['html', 'site'], {
                level,
                tables: '[scope.app]\nconfigurations = ["html", "site"]\n',
            }),
            'index.html': '<!doctype html><title>Root</title>',
            'app/index.html': '<!doctype html><title>App</title>',
        });
        const output = emitAll(await openSession(sandbox.path));
        const source = output.files.filter(({ path }) => path.endsWith('html-validate-source.json'));
        expect(source.map(({ path }) => path)).toEqual(['.gspot/config/html-validate-source.json']);
        for (const file of source) {
            expect(parseJsonc(file.content)).toMatchObject({
                extends: ['html-validate:recommended'],
                rules: {
                    'doctype-style': ['error', { style: 'lowercase' }],
                    'void-style': ['error', { style: 'selfclosing' }],
                    'no-raw-characters': 'error',
                    'no-inline-style': level === 'all' ? 'error' : 'off',
                },
            });
            expect(parseJsonc(file.content)).not.toHaveProperty('rules.valid-id');
        }
        const built = output.files.filter(({ path }) => path.endsWith('html-validate-built.json'));
        expect(built.map(({ path }) => path)).toEqual([
            '.gspot/config/app/html-validate-built.json',
            '.gspot/config/html-validate-built.json',
        ]);
        for (const file of built) expect(parseJsonc(file.content)).toMatchObject({ rules: BUILT_HTML_RULES });
    },
);

test.each(['html/validate', 'site/html-validate'])(
    'an ignore for %s stays with its native HTML check',
    async (check) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['html', 'site'], {
                level: 'all',
                tables: `[[ignore]]\ncheck = "${check}"\nrule = "valid-id"\nreason = "The external validator checks identifier syntax."\n`,
            }),
            'index.html': '<!doctype html><title>Root</title>',
        });
        const output = emitAll(await openSession(sandbox.path));
        for (const [name, selected] of [
            ['source', 'html/validate'],
            ['built', 'site/html-validate'],
        ] as const) {
            const file = output.files.find(({ path }) => path.endsWith(`html-validate-${name}.json`))!;
            if (selected !== check && name === 'source')
                expect(parseJsonc(file.content)).not.toHaveProperty('rules.valid-id');
            else
                expect(parseJsonc(file.content)).toMatchObject({
                    rules: { 'valid-id': selected === check ? 'off' : ['error', { relaxed: true }] },
                });
        }
    },
);

test.each(DISABLED_TOOL_RULES)(
    '$tool refuses disabled $rule coverage in root and child policy',
    ({ configuration, tool, rule, value }) => {
        for (const level of ['recommended', 'all'] as const)
            for (const scope of ['', 'scope.app.']) {
                const policy = buildPolicy([configuration], {
                    agentRules: true,
                    level,
                    tables: `[${scope}tools.${tool}.rules]\n"${rule}" = ${value}\n`,
                });
                expect(() => parseStrictPolicy(policy)).toThrow(`${scope}tools.${tool}.rules.${rule}`);
                expect(() => parseStrictPolicy(policy)).toThrow('gspot ignore');
            }
    },
);
