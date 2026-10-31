import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import type { Config } from 'stylelint';
import type stylelintModule from 'stylelint';
import { compareText } from '#cli/system/text.ts';
import { openSession } from '#cli/planning/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { toolModules } from '#tests/setup/sandboxes/node-modules.ts';
import { getConfigPath, getManifestTarget } from '#tests/setup/cli/generated-files.ts';

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
    const generated = buildGeneratedFiles(session).files.find(
        ({ path: file }) => file === getConfigPath(session, 'stylelint', ''),
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
    const generated = buildGeneratedFiles(session);
    expect(generated.files.filter(({ path }) => path.endsWith('/stylelint.json'))).toHaveLength(1);
    for (const scope of ['', 'child']) {
        const target = getConfigPath(session, 'stylelint', scope);
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
    expect(() => buildGeneratedFiles(session)).toThrow(
        'number-max-precision runs only at level all. gspot sets options only for the rules that run at level basic.',
    );
});

test('a scope with CSS Modules files accepts composes, :global, and @value in them only', async () => {
    await using sandbox = await testdir({
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
