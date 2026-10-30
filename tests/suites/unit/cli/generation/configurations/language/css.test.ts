import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import type { Config } from 'stylelint';
import type stylelintModule from 'stylelint';
import { openSession } from '#cli/planning/session.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { type StylelintConfigFile } from '#tests/types/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { toolModules } from '#tests/setup/sandboxes/node-modules.ts';
import { getManifestTarget, getConfigFilePath } from '#tests/setup/cli/generated-files.ts';

import {
    STYLELINT_SCOPE_FILES,
    COMPONENT_SYNTAX_OVERRIDES,
} from '#tests/config/generation/configurations/language/css.ts';

const { default: stylelint } = (await import(Bun.resolveSync('stylelint', toolModules))) as {
    default: typeof stylelintModule;
};

test.each(['vue', 'astro'])('a CSS-only scope checks properties inside a %s component style', async (extension) => {
    const path = `Card.${extension}`;
    const code = '<style>p { nonexistent-property: red; }</style>\n';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['css']),
        [path]: code,
    });
    const session = await openSession(sandbox.path);
    const generated = generateFiles(session).files.find(
        ({ path: file }) => file === getConfigFilePath(session, 'stylelint', ''),
    )!;
    const config = JSON.parse(generated.content) as Config;
    const syntax = config.overrides?.find(({ files }) => files.includes(`**/*.${extension}`))?.customSyntax;
    expect(syntax).toBe('postcss-html');
    const result = await stylelint.lint({
        code,
        codeFilename: join(sandbox.path, path),
        config,
        configBasedir: toolModules,
    });
    expect(result.results.flatMap(({ warnings }) => warnings.map(({ rule }) => rule))).toStrictEqual([
        'property-no-unknown',
    ]);
});

test('every CSS scope selects Vue, Svelte and Astro syntax only for matching extensions', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['css'], {
            level: 'all',
            tables: `[[scope]]\npath = "vue"\nconfigurations = ["css", "vue"]\n[[scope]]\npath = "svelte"\n\nconfigurations = ["css", "svelte"]\n[[scope]]\npath = "mixed"\n\nconfigurations = ["css", "vue", "svelte"]\n`,
        }),
        ...STYLELINT_SCOPE_FILES,
    });

    const session = await openSession(sandbox.path);
    const outputs = generateFiles(session).files;
    const documents = Object.fromEntries(
        ['', 'vue', 'svelte', 'mixed'].map((scope) => {
            const output = outputs.find((file) => file.path === getConfigFilePath(session, 'stylelint', scope))!;
            return [scope, JSON.parse(output.content) as StylelintConfigFile];
        }),
    );
    const overrides = Object.fromEntries(
        Object.entries(documents).map(([scope, document]) => [
            scope,
            document.overrides?.map(({ files, customSyntax }) => ({ files, customSyntax })),
        ]),
    );
    for (const scope of ['', 'vue', 'svelte', 'mixed'])
        expect(overrides[scope]).toStrictEqual(COMPONENT_SYNTAX_OVERRIDES);
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
    const generated = generateFiles(session);
    expect(generated.files.filter(({ path }) => path.endsWith('/stylelint.json'))).toHaveLength(1);
    for (const scope of ['', 'child']) {
        const target = getConfigFilePath(session, 'stylelint', scope);
        const file = generated.files.find(({ path }) => path === target)!;
        const config = JSON.parse(file.content) as Config;
        expect(config.rules!['color-hex-length']).toBe('long');
        expect(config.rules!['number-max-precision']).toBe(0);
        const result = await stylelint.lint({
            code: 'a { color: #fff; width: 1.23456px; }',
            config,
            configBasedir: toolModules,
        });
        const warnings = result.results.flatMap((result) => result.warnings);
        expect(
            warnings.filter(({ rule }) => rule === 'color-hex-length').map(({ severity }) => severity),
        ).toStrictEqual(['error']);
        expect(warnings.filter(({ rule }) => rule === 'number-max-precision')).toHaveLength(1);
    }
});

test('level basic refuses Stylelint options for a rule of level all', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['css'], {
            level: 'basic',
            tables: '[tools.stylelint.rules]\ncolor-hex-length = "long"\nnumber-max-precision = 0\n',
        }),
        'source.css': 'a { color: #fff; }',
    });
    const session = await openSession(sandbox.path);
    expect(() => generateFiles(session)).toThrow(
        'number-max-precision runs only at level all. gspot sets options only for the rules that run at level basic.',
    );
});

test('a scope with CSS Modules files accepts composes, :global, and @value in them only', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['css'], { level: 'all' }),
        'button.module.css': '.base {\n    color: red;\n}\n',
    });

    const output = generateFiles(await openSession(sandbox.path)).files.find(
        (file) => file.path === getManifestTarget('css', 'stylelint.json'),
    )!;
    const config = JSON.parse(output.content) as Config;
    const code =
        '@value primary: red;\n\n.button {\n    composes: base from "./base.module.css";\n}\n\n:global(.dark) .button {\n    color: blue;\n}\n';
    const rules = new Set(['property-no-unknown', 'selector-pseudo-class-no-unknown', 'at-rule-no-unknown']);
    async function listReportedRules(codeFilename: string): Promise<string[]> {
        const result = await stylelint.lint({ code, codeFilename, config, configBasedir: toolModules });
        return result.results
            .flatMap(({ warnings }) => warnings.map(({ rule }) => rule))
            .filter((rule) => rules.has(rule));
    }
    expect(await listReportedRules(`${sandbox.path}/button.module.css`)).toStrictEqual([]);
    const defaultFindings = await listReportedRules(`${sandbox.path}/plain.css`);
    expect(defaultFindings.toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'at-rule-no-unknown',
        'property-no-unknown',
        'selector-pseudo-class-no-unknown',
    ]);
});
