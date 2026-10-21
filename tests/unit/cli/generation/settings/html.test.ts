import { testdir } from 'testdirs';
import { parse } from 'jsonc-parser';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { generate } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';

test.each([...LEVELS])(
    'the source html-validate file is written once at the root, identical built files share the root output, and no-inline-style follows the level (%s)',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['html', 'site'], {
                level,
                scopes: [{ path: 'app', configurations: ['html', 'site'] }],
            }),
            'index.html': '<!doctype html><title>Root</title>',
            'app/index.html': '<!doctype html><title>App</title>',
        });

        const output = generate(await openSession(sandbox.path));
        const source = output.files.filter(({ path }) => path.endsWith('/html/html-validate.json'));
        expect(source.map(({ path }) => path)).toEqual(['.gspot/configurations/language/html/html-validate.json']);
        for (const file of source) {
            expect(parse(file.content)).toMatchObject({
                rules: {
                    'no-inline-style': level === 'all' ? 'error' : 'off',
                },
            });
        }
        const built = output.files.filter(({ path }) => path.endsWith('/site/html-validate.json'));
        expect(built.map(({ path }) => path)).toEqual(['.gspot/configurations/framework/site/html-validate.json']);
    },
);

test.each(['html/html-validate', 'site/html-validate'])(
    'an ignore for %s turns valid-id off only in its own html-validate file',
    async (check) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['html', 'site'], {
                level: 'all',
                tables: `[[ignore]]\ncheck = "${check}"\nrule = "valid-id"\nreason = "The external validator checks identifier syntax."\n`,
            }),
            'index.html': '<!doctype html><title>Root</title>',
        });

        const output = generate(await openSession(sandbox.path));
        for (const [name, selected] of [
            ['html', 'html/html-validate'],
            ['site', 'site/html-validate'],
        ] as const) {
            const file = output.files.find(({ path }) => path.endsWith(`/${name}/html-validate.json`))!;
            if (selected !== check && name === 'html') expect(parse(file.content)).not.toHaveProperty('rules.valid-id');
            else
                expect(parse(file.content)).toMatchObject({
                    rules: { 'valid-id': selected === check ? 'off' : ['error', { relaxed: true }] },
                });
        }
    },
);
