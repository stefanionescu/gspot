import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import stylelint, { type Config } from 'stylelint';
import { generate } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { testModules } from '#tests/setup/sandboxes/node-modules.ts';
import { type StylelintConfigFile } from '#tests/types/config-files.ts';
import { findFileTarget, findConfigFilePath } from '#tests/setup/cli/config-files.ts';
import { STYLELINT_SCOPE_FILES, STYLELINT_SCOPE_TABLES } from '#tests/config/generation/configurations/language/css.ts';

test('Vue and Svelte stylesheet rules stay inside their scopes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['css'], { level: 'all', tables: STYLELINT_SCOPE_TABLES }),
        ...STYLELINT_SCOPE_FILES,
    });

    const session = await openSession(sandbox.path);
    const outputs = generate(session).files;
    const documents = Object.fromEntries(
        ['', 'vue', 'svelte', 'mixed'].map((scope) => {
            const output = outputs.find((file) => file.path === findConfigFilePath(session, 'stylelint', scope))!;
            return [scope, JSON.parse(output.content) as StylelintConfigFile];
        }),
    );
    const overrides = Object.fromEntries(
        Object.entries(documents).map(([scope, document]) => [
            scope,
            document.overrides?.map(({ files, customSyntax }) => ({ files, customSyntax })),
        ]),
    );
    expect(documents['']!.overrides).toBeUndefined();
    expect(overrides['vue']).toStrictEqual([{ files: ['**/*.vue'], customSyntax: 'postcss-html' }]);
    expect(overrides['svelte']).toStrictEqual([{ files: ['**/*.svelte'], customSyntax: 'postcss-html' }]);
    expect(overrides['mixed']).toStrictEqual([
        { files: ['**/*.vue'], customSyntax: 'postcss-html' },
        { files: ['**/*.svelte'], customSyntax: 'postcss-html' },
    ]);
});

test("your Stylelint rule options reach each scope's file", async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['css'], {
            level: 'all',
            tables: '[tools.stylelint.rules]\ncolor-hex-length = "long"\nnumber-max-precision = 0\n',
            scopes: [{ path: 'child' }],
        }),
        'source.css': 'a { color: #fff; width: 1.23456px; }',
        'child/source.css': 'a { color: #fff; width: 1.23456px; }',
    });

    const session = await openSession(sandbox.path);
    const generated = generate(session);
    expect(generated.files.filter(({ path }) => path.endsWith('/stylelint.json'))).toHaveLength(1);
    for (const scope of ['', 'child']) {
        const target = findConfigFilePath(session, 'stylelint', scope);
        const file = generated.files.find(({ path }) => path === target)!;
        const config = JSON.parse(file.content) as Config;
        expect(config.rules!['color-hex-length']).toBe('long');
        expect(config.rules!['number-max-precision']).toBe(0);
        const result = await stylelint.lint({
            code: 'a { color: #fff; width: 1.23456px; }',
            config,
            configBasedir: testModules,
        });
        const warnings = result.results.flatMap((result) => result.warnings);
        expect(
            warnings.filter(({ rule }) => rule === 'color-hex-length').map(({ severity }) => severity),
        ).toStrictEqual(['error']);
        expect(warnings.filter(({ rule }) => rule === 'number-max-precision')).toHaveLength(1);
    }
});

test('recommended refuses Stylelint options for a rule it does not run and for an unknown rule', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['css'], {
            level: 'recommended',
            tables: '[tools.stylelint.rules]\ncolor-hex-length = "long"\nnumber-max-precision = 0\nunknown-rule = true\n',
        }),
        'source.css': 'a { color: #fff; }',
    });
    const session = await openSession(sandbox.path);
    expect(() => generate(session)).toThrow(
        'number-max-precision runs only at level all. gspot sets options only for the rules that run at level recommended.\nunknown-rule belongs to no plugin that gspot loads.',
    );
});

test('a scope with CSS Modules files accepts composes, :global, and @value in them only', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['css'], { level: 'all' }),
        'button.module.css': '.base {\n    color: red;\n}\n',
    });

    const output = generate(await openSession(sandbox.path)).files.find(
        (file) => file.path === findFileTarget('css', 'stylelint.json'),
    )!;
    const config = JSON.parse(output.content) as Config;
    const code =
        '@value primary: red;\n\n.button {\n    composes: base from "./base.module.css";\n}\n\n:global(.dark) .button {\n    color: blue;\n}\n';
    const rules = new Set(['property-no-unknown', 'selector-pseudo-class-no-unknown', 'at-rule-no-unknown']);
    async function lintRules(codeFilename: string): Promise<string[]> {
        const result = await stylelint.lint({ code, codeFilename, config, configBasedir: testModules });
        return result.results
            .flatMap(({ warnings }) => warnings.map(({ rule }) => rule))
            .filter((rule) => rules.has(rule));
    }
    expect(await lintRules(`${sandbox.path}/button.module.css`)).toStrictEqual([]);
    const defaultFindings = await lintRules(`${sandbox.path}/plain.css`);
    expect(defaultFindings.toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'at-rule-no-unknown',
        'property-no-unknown',
        'selector-pseudo-class-no-unknown',
    ]);
});
