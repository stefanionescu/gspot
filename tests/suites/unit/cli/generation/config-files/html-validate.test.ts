import { testdir } from 'testdirs';
import { parse } from 'jsonc-parser';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { type ConfigData, StaticConfigLoader } from 'html-validate';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { HTML_VALIDATION_LEVELS } from '#tests/config/generation/config-files/html-validate.ts';

test.each([...HTML_VALIDATION_LEVELS])(
    'the root and child scopes share one source and one built html-validate file, and no-inline-style is on only at level all ($level)',
    async ({ level, override, severity }) => {
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
        expect(source.map(({ path }) => path)).toStrictEqual([findManifestTarget('html', 'html-validate.json')]);
        const sourceConfiguration = parse(source[0]!.content) as ConfigData;
        expect(sourceConfiguration.extends).toStrictEqual(['html-validate:recommended']);
        expect(sourceConfiguration.rules?.['no-inline-style']).toBe(override);
        const sourceRules = await new StaticConfigLoader(sourceConfiguration).getConfigFor('index.html');
        expect(sourceRules.getRules().get('no-inline-style')).toStrictEqual([severity, {}]);
        const built = output.files.filter(({ path }) => path.endsWith('/site/html-validate.json'));
        expect(built.map(({ path }) => path)).toStrictEqual([findManifestTarget('site', 'html-validate.json')]);
        const builtConfiguration = parse(built[0]!.content) as ConfigData;
        const builtRules = await new StaticConfigLoader(builtConfiguration).getConfigFor('built.html');
        expect(builtRules.getRules().get('no-inline-style')).toStrictEqual([0, {}]);
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
