import { parse } from 'jsonc-parser';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { generate } from '#cli/generation/generate.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';

test.each([...LEVELS])(
    'the source html-validate file is written once at the root, identical built files share the root output, and no-inline-style follows the level (%s)',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['html', 'site'], {
                level,
                tables: '[[scope]]\npath = "app"\n\nconfigurations = ["html", "site"]\n',
            }),
            'index.html': '<!doctype html><title>Root</title>',
            'app/index.html': '<!doctype html><title>App</title>',
        });
        const output = generate(await openSession(sandbox.path));
        const source = output.files.filter(({ path }) => path.endsWith('html-validate-source.json'));
        expect(source.map(({ path }) => path)).toEqual(['.gspot/config/html-validate-source.json']);
        for (const file of source) {
            expect(parse(file.content)).toMatchObject({
                rules: {
                    'no-inline-style': level === 'all' ? 'error' : 'off',
                },
            });
        }
        const built = output.files.filter(({ path }) => path.endsWith('html-validate-built.json'));
        expect(built.map(({ path }) => path)).toEqual(['.gspot/config/html-validate-built.json']);
    },
);

test.each(['html/html-validate', 'site/html-validate'])(
    'an ignore for %s turns valid-id off only in its own html-validate file',
    async (check) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['html', 'site'], {
                level: 'all',
                tables: `[[ignore]]\ncheck = "${check}"\nrule = "valid-id"\nreason = "The external validator checks identifier syntax."\n`,
            }),
            'index.html': '<!doctype html><title>Root</title>',
        });
        const output = generate(await openSession(sandbox.path));
        for (const [name, selected] of [
            ['source', 'html/html-validate'],
            ['built', 'site/html-validate'],
        ] as const) {
            const file = output.files.find(({ path }) => path.endsWith(`html-validate-${name}.json`))!;
            if (selected !== check && name === 'source')
                expect(parse(file.content)).not.toHaveProperty('rules.valid-id');
            else
                expect(parse(file.content)).toMatchObject({
                    rules: { 'valid-id': selected === check ? 'off' : ['error', { relaxed: true }] },
                });
        }
    },
);
