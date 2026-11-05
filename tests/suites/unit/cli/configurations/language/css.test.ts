import { join } from 'node:path';

import { expect, test } from 'bun:test';
import type { Config } from 'stylelint';
import type stylelintModule from 'stylelint';

import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { compareText } from '#cli/system/text.ts';
import { getConfigPath, getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { toolModules } from '#tests/setup/sandboxes/node-modules.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const { default: stylelint } = (await import(Bun.resolveSync('stylelint', toolModules))) as {
    default: typeof stylelintModule;
};

test('a Stylelint plugin record names its module and turns its rule on', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['css'], {
            tables: '[[tools.stylelint.plugins]]\npath = "tools/plugin.mjs"\nrules = { "acme/no-red" = true }\n',
        }),
        'tools/plugin.mjs': 'export default {};\n',
        'a.css': 'a { color: red; }\n',
    });
    const session = await openSession(sandbox.path);
    const target = getConfigPath(session, 'stylelint', '');
    const generated = buildGeneratedFiles(session).files.find(({ path }) => path === target)!;
    const config = JSON.parse(generated.content) as Config;
    expect(config.plugins).toStrictEqual(['../../../../tools/plugin.mjs']);
    expect(config.rules?.['acme/no-red']).toBe(true);
});

test.each(['vue'])('a CSS-only scope checks properties inside a %s component style', async (extension) => {
    const path = `Card.${extension}`;
    const code = '<style>p { nonexistent-property: red; }</style>\n';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['css']),
        [path]: code,
    });
    const session = await openSession(sandbox.path);
    const generated = buildGeneratedFiles(session).files.find(
        ({ path: file }) => file === getConfigPath(session, 'stylelint', ''),
    )!;
    const config = JSON.parse(generated.content) as Config;
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

test.each([
    [
        'basic',
        [
            'declaration-property-unit-allowed-list',
            'declaration-property-value-disallowed-list',
            'property-disallowed-list',
        ],
    ],
    [
        'all',
        [
            'declaration-property-unit-allowed-list',
            'declaration-property-value-disallowed-list',
            'property-disallowed-list',
            'selector-disallowed-list',
            'selector-max-id',
            'selector-max-specificity',
        ],
    ],
] as const)(
    'level %s reports physical properties, fixed font sizes, and ID and state selectors',
    async (level, expected) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['css'], { level }),
            'site.css': 'a {\n    color: red;\n}\n',
        });
        const output = buildGeneratedFiles(await openSession(sandbox.path)).files.find(
            (file) => file.path === getManifestTarget('css', 'stylelint.json'),
        )!;
        const result = await stylelint.lint({
            code: '.is-active {\n    float: left;\n}\n\n#page {\n    font-size: 14px;\n}\n\n.a .b .c .d {\n    margin-left: 1rem;\n}\n',
            codeFilename: `${sandbox.path}/site.css`,
            config: JSON.parse(output.content) as Config,
            configBasedir: toolModules,
        });
        const reported = new Set(result.results.flatMap(({ warnings }) => warnings.map(({ rule }) => rule)));
        expect(
            [...reported].filter((rule) => /disallowed|allowed|selector-max/u.test(rule)).toSorted(compareText),
        ).toStrictEqual([...expected]);
    },
);

test('a scope with CSS Modules files accepts composes, :global, and @value in them only', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['css'], { level: 'all' }),
        'button.module.css': '.base {\n    color: red;\n}\n',
    });

    const output = buildGeneratedFiles(await openSession(sandbox.path)).files.find(
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
    expect(defaultFindings.toSorted(compareText)).toStrictEqual([
        'at-rule-no-unknown',
        'property-no-unknown',
        'selector-pseudo-class-no-unknown',
    ]);
});
