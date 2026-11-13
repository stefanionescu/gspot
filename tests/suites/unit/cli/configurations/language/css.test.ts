import { expect, test } from 'bun:test';
import type { Config } from 'stylelint';
import type stylelintModule from 'stylelint';

import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { getTool, readConfigurations } from '#cli/manifests/read.ts';
import { compareText } from '#cli/system/text/order.ts';
import { buildGeneratedFile, getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { toolModules } from '#tests/setup/sandboxes/node-modules.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const { default: stylelint } = (await import(Bun.resolveSync('stylelint', toolModules))) as {
    default: typeof stylelintModule;
};

test('level basic turns off each Stylelint rule that only level all runs', async () => {
    const config = JSON.parse(
        await buildGeneratedFile(buildSandboxSettings(['css']), getManifestTarget('css', 'stylelint.json'), {
            'site.css': '',
        }),
    ) as { rules: Record<string, unknown> };
    const levelOff = getTool(readConfigurations().values(), 'stylelint').off?.basic ?? [];
    expect(levelOff.map((rule) => [rule, config.rules[rule]])).toStrictEqual(levelOff.map((rule) => [rule, null]));
});

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
