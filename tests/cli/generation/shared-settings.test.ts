import { test, expect } from 'bun:test';
import { parse as parseToml } from 'smol-toml';
import { buildPolicy } from '#tests/harness/policy.ts';
import { emitFile } from '#tests/harness/generated.ts';
import { containingAll } from '#tests/harness/expectations.ts';
import { DEFAULT_TEST_PATTERNS } from '#cli/config/policy/settings.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

import type {
    KnipConfiguration,
    RuffConfiguration,
    StylelintConfiguration,
    TestedRuffConfiguration,
} from '#tests/types/generation/configuration-files.ts';
import {
    KNIP,
    RUFF,
    STYLELINT,
    TAILWIND_AT_RULES,
    TAILWIND_PROJECT_FILES,
} from '#tests/config/cli/generation/shared-settings.ts';

async function generatedDocument<Shape>(
    policy: string,
    path: string,
    files: Record<string, string> = {},
): Promise<Shape> {
    const sources: Record<string, string> = {};
    if (path === STYLELINT) sources['sample.css'] = 'body { color: red; }';
    if (path === RUFF) sources['sample.py'] = 'value = 1';
    const content = await emitFile(policy, path, { ...sources, ...files });
    return (path.endsWith('.toml') ? parseToml(content) : JSON.parse(content)) as Shape;
}

// What the configurations declare, read from their manifests so the test pins no copy of shipped lists.
const manifests = configurationManifests();
const pytest = manifests.get('pytest')!;
const testIgnores = pytest.set['tools.ruff.rules_off_in_tests'] as string[];
const entry = manifests.get('javascript')!.entry[0]!;
const python = buildPolicy(['python']);

test('knip takes its workspaces from the package workspaces, with the policy entries and the configuration entry files', async () => {
    const files = {
        'package.json': '{"private":true,"type":"module","workspaces":["api","web"]}\n',
        'api/package.json': '{"name":"api","private":true}\n',
        'api/serve.js': '',
        'web/package.json': '{"name":"web","private":true}\n',
        'lib/index.js': '',
    };
    const policy = buildPolicy(['javascript'], {
        tables: '[tools.knip]\nentry = ["cli.js"]\n[[scope]]\npath = "api"\nconfigurations = ["javascript"]\n[scope.tools.knip]\nentry = ["serve.js"]\n[[scope]]\npath = "lib"\nconfigurations = ["javascript"]\n',
    });
    const knip = await generatedDocument<KnipConfiguration>(policy, KNIP, files);
    expect(knip.entry).toStrictEqual(containingAll(['cli.js', entry]));
    expect(knip.entry).not.toContain('api/serve.js');
    expect(knip.workspaces['api']?.entry).toStrictEqual(containingAll(['serve.js', entry]));
    expect(knip.workspaces['api']?.entry).not.toContain('cli.js');
    // A package workspace outside every scope takes the root configurations; a scope that is no package stays out.
    expect(knip.workspaces['web']?.entry).toStrictEqual(containingAll([entry]));
    expect(Object.keys(knip.workspaces)).not.toContain('lib');
    const withoutEntries = await generatedDocument<Pick<KnipConfiguration, 'entry'>>(
        buildPolicy(['javascript']),
        KNIP,
        files,
    );
    expect(withoutEntries.entry).toStrictEqual(containingAll([entry]));
    expect(withoutEntries.entry).not.toContain('cli.js');
});

test('knip retains the Markdown configuration consumed by its native runner', async () => {
    const knip = await generatedDocument<KnipConfiguration>(buildPolicy(['javascript', 'markdown']), KNIP, {
        'src/main.js': 'export const enabled = true;\n',
        'README.md': '# Example\n',
    });
    expect(knip.entry).toContain('.markdownlint-cli2.mjs');
    expect(knip.workspaces['.']?.entry).toContain('.markdownlint-cli2.mjs');
});

test.each([
    ['no framework', buildPolicy(['css']), true, {}],
    ['Next.js without Tailwind exceptions', buildPolicy(['css', 'nextjs']), true, {}],
    [
        'declared Tailwind syntax',
        buildPolicy(['css']),
        [true, { ignoreAtRules: TAILWIND_AT_RULES }],
        TAILWIND_PROJECT_FILES,
    ],
    [
        'the at-rules the policy adds',
        buildPolicy(['css'], { tables: '[tools.stylelint]\nignore_at_rules = ["container"]\n' }),
        [true, { ignoreAtRules: ['container'] }],
        {},
    ],
])('Stylelint accepts %s', async (_name, policy, expected, files) => {
    const stylelint = await generatedDocument<StylelintConfiguration>(policy, STYLELINT, files);
    expect(stylelint.rules['at-rule-no-unknown']).toStrictEqual(expected);
});

test('Ruff selects the families the test runner and the framework declare, and ignores test rules only with a runner', async () => {
    const plain = await generatedDocument<RuffConfiguration>(python, RUFF);
    expect(plain.lint.select.filter((code) => /^(?:AIR|DJ|FAST|NPY|PT)/u.test(code))).toStrictEqual([]);
    expect(plain.lint['per-file-ignores']).toBeUndefined();
    const tested = await generatedDocument<TestedRuffConfiguration>(buildPolicy(['python', 'pytest']), RUFF);
    expect(tested.lint.select).toStrictEqual(containingAll(pytest.ruff_rules.recommended));
    expect(tested.lint['per-file-ignores']).toStrictEqual(
        Object.fromEntries(DEFAULT_TEST_PATTERNS.map((path) => [path, testIgnores])),
    );
    const served = await generatedDocument<RuffConfiguration>(buildPolicy(['python', 'fastapi']), RUFF);
    expect(served.lint.select).toContain('FAST003');
    expect(served.lint['per-file-ignores']).toBeUndefined();
});

test('a policy ignore joins the runner ignores of the same test path', async () => {
    const ignored = await generatedDocument<TestedRuffConfiguration>(
        buildPolicy(['python', 'pytest'], {
            tables: '[[ignore]]\ncheck = "python/ruff"\nrule = "D103"\npaths = ["**/conftest.py"]\nreason = "Fixtures document themselves through their names."\n',
        }),
        RUFF,
    );
    expect(ignored.lint['per-file-ignores']['**/conftest.py']).toStrictEqual([...testIgnores, 'D103']);
});
