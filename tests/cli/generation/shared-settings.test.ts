import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { valueAt } from '#cli/platform/contracts.ts';
import { openSession } from '#cli/commands/public.ts';
import { emitFile } from '#tests/harness/generated.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { readAsset } from '#cli/platform/root/public.ts';
import { stringify, parse as parseToml } from 'smol-toml';
import { emitPolicy } from '#cli/policy/document/public.ts';
import { containingAll } from '#tests/harness/expectations.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { eta, etaInputs } from '#cli/generation/compilation/public.ts';

import type {
    KnipConfiguration,
    RuffConfiguration,
    StylelintConfiguration,
    TestedRuffConfiguration,
} from '#tests/types/cli/generation/configuration-files.ts';
import {
    KNIP,
    RUFF,
    STYLELINT,
    SITE_BUILD_COMMANDS,
    TAILWIND_PROJECT_FILES,
    SITE_PACKAGE_INSTALLERS,
    PATH_IGNORE_CONFIGURATIONS,
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
        tables: '[tools.knip]\nentry = ["cli.js"]\n[scope."api"]\nconfigurations = ["javascript"]\n[scope."api".tools.knip]\nentry = ["serve.js"]\n[scope."lib"]\nconfigurations = ["javascript"]\n',
    });
    const knip = await generatedDocument<KnipConfiguration>(policy, KNIP, files);
    expect(knip.workspaces['.']!.entry).toStrictEqual(containingAll(['cli.js', entry]));
    expect(knip.workspaces['.']!.entry).not.toContain('api/serve.js');
    expect(knip.workspaces['api']?.entry).toStrictEqual(containingAll(['serve.js', entry]));
    expect(knip.workspaces['api']?.entry).not.toContain('cli.js');
    // A package workspace outside every scope takes the root configurations; a scope that is no package stays out.
    expect(knip.workspaces['web']?.entry).toStrictEqual(containingAll([entry]));
    expect(Object.keys(knip.workspaces)).not.toContain('lib');
    const withoutEntries = await generatedDocument<KnipConfiguration>(buildPolicy(['javascript']), KNIP, files);
    expect(withoutEntries.workspaces['.']!.entry).toStrictEqual(containingAll([entry]));
    expect(withoutEntries.workspaces['.']!.entry).not.toContain('cli.js');
});

test('knip ignores the Markdown pointer consumed by its native runner', async () => {
    const knip = await generatedDocument<KnipConfiguration>(buildPolicy(['javascript', 'markdown']), KNIP, {
        'src/main.js': 'export const enabled = true;\n',
        'README.md': '# Example\n',
    });
    expect(knip.ignore).toContain('.markdownlint-cli2.mjs');
    expect(knip.workspaces['.']!.entry).not.toContain('.markdownlint-cli2.mjs');
    expect(knip).not.toHaveProperty('entry');
});

test.each([
    ['no framework', buildPolicy(['css']), true, {}],
    ['Next.js without Tailwind exceptions', buildPolicy(['css', 'nextjs']), true, {}],
    ['declared Tailwind syntax', buildPolicy(['css']), undefined, TAILWIND_PROJECT_FILES],
    [
        'the at-rules the policy adds',
        buildPolicy(['css'], {
            tables: '[tools.stylelint.rules]\nat-rule-no-unknown = [true, { ignoreAtRules = ["container"] }]\n',
        }),
        [true, { ignoreAtRules: ['container'] }],
        {},
    ],
])('Stylelint accepts %s', async (_name, policy, expected, files) => {
    const stylelint = await generatedDocument<StylelintConfiguration>(policy, STYLELINT, files);
    let rule: unknown = expected;
    if (rule === undefined) {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { ...files, 'gspot.toml': policy });
        const session = await openSession(sandbox.path);
        const selection = session.scopes[0]!;
        eta.renderString(readAsset('configurations/language/css/stylelint.json.eta'), {
            ...etaInputs(session, selection, selection.selected),
            recordRules: (document: StylelintConfiguration) => {
                rule = document.rules['at-rule-no-unknown'];
            },
        });
    }
    expect(stylelint.rules['at-rule-no-unknown']).toStrictEqual(rule);
});

test('Ruff selects declared runner and framework families without implicit rule ignores', async () => {
    const plain = await generatedDocument<RuffConfiguration>(python, RUFF);
    expect(plain.lint.select.filter((code) => /^(?:AIR|DJ|FAST|NPY|PT)/u.test(code))).toStrictEqual([]);
    expect(plain.lint['per-file-ignores']).toBeUndefined();
    const tested = await generatedDocument<TestedRuffConfiguration>(buildPolicy(['python', 'pytest']), RUFF);
    expect(tested.lint.select).toStrictEqual(containingAll(pytest.ruff_rules.recommended));
    expect(tested.lint['per-file-ignores']).toBeUndefined();
    const served = await generatedDocument<RuffConfiguration>(buildPolicy(['python', 'fastapi']), RUFF);
    expect(served.lint.select).toContain('FAST003');
    expect(served.lint['per-file-ignores']).toBeUndefined();
});

test('policy ignores for the same test path share the native rule list', async () => {
    const ignored = await generatedDocument<TestedRuffConfiguration>(
        buildPolicy(['python', 'pytest'], {
            tables: '[[ignore]]\ncheck = "python/ruff"\nrule = "S101"\npaths = ["**/test_*.py"]\nreason = "The fixture assertions are deliberate checks."\n[[ignore]]\ncheck = "python/ruff"\nrule = "D103"\npaths = ["**/test_*.py"]\nreason = "Fixtures document themselves through their names."\n',
        }),
        RUFF,
    );
    expect(ignored.lint['per-file-ignores']['../../**/test_*.py']).toStrictEqual(['S101', 'D103']);
});

test.each(PATH_IGNORE_CONFIGURATIONS)(
    '$check native exclusions preserve per-check and per-rule ownership',
    async ({ configuration, check, path, nativePath }) => {
        const policy = stringify({
            level: 'all',
            configurations: [...new Set([configuration, 'javascript'])],
            ignore: [
                { check, paths: ['selected/**'], reason: 'This generated sample has its own source owner.' },
                {
                    check,
                    rule: 'example-rule',
                    paths: ['rule-only/**'],
                    reason: 'Only this one finding rule is accepted.',
                },
                {
                    check: 'docs/stale-paths',
                    paths: ['other/**'],
                    reason: 'Only documentation paths are accepted here.',
                },
            ],
        });
        const content = await emitFile(policy, path, { 'source.js': 'export const port = 8080;\n' });
        const native = path.endsWith('.toml') ? parseToml(content) : (JSON.parse(content) as unknown);
        const patterns = valueAt(native, nativePath);
        expect(patterns).toContain('selected/**');
        expect(patterns).not.toContain('rule-only/**');
        expect(patterns).not.toContain('other/**');
    },
);

test.each(['', 'api'])('Semgrep editor discovery in scope "%s" uses only local check path ignores', async (scope) => {
    const policy = stringify({
        configurations: ['javascript'],
        scope: { api: { configurations: ['javascript'] } },
        ignore: [
            {
                check: 'security/semgrep',
                paths: ['api/local/**'],
                reason: 'These local sources have their own security owner.',
            },
            {
                check: 'security/semgrep',
                rule: 'example-rule',
                paths: ['api/rule-only/**'],
                reason: 'This one rule has a reviewed false positive.',
            },
            {
                check: 'security/semgrep-registry',
                paths: ['api/registry-only/**'],
                reason: 'Only registry findings are accepted here.',
            },
        ],
    });
    const content = await emitFile(policy, scope === '' ? '.semgrepignore' : `${scope}/.semgrepignore`, {
        'source.js': 'export {};\n',
        'api/source.js': 'export {};\n',
    });
    expect(content.split('\n')).toContain(scope === '' ? 'api/local/**' : '/local/**');
    expect(content).not.toContain('rule-only');
    expect(content).not.toContain('registry-only');
});

test.each(
    SITE_PACKAGE_INSTALLERS.flatMap(([name, files, installer]) =>
        ['', 'app'].map((scope) => ({ name, files, installer, scope })),
    ),
)('site build uses $name in "$scope" and retains explicit authored argv', async ({ files, installer, scope }) => {
    await using sandbox = await testdir();
    const policy =
        scope === '' ? buildPolicy(['site']) : buildPolicy([], { tables: '[scope.app]\nconfigurations = ["site"]\n' });
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        [join(scope, 'index.html')]: '<!doctype html><title>Site</title>',
        ...Object.fromEntries(Object.entries(files).map(([path, text]) => [join(scope, path), text])),
    });
    const session = await openSession(sandbox.path);
    const selected = session.scopes.find((entry) => entry.scope.path === scope)!;
    expect(selected.view.options('site').build_command).toStrictEqual([installer, 'run', 'build']);
    for (const argv of SITE_BUILD_COMMANDS) {
        const authored =
            policy + (scope === '' ? '[site]\n' : '[scope.app.site]\n') + stringify({ build_command: argv });
        await writeFile(join(sandbox.path, 'gspot.toml'), authored);
        const manual = await openSession(sandbox.path);
        expect(
            manual.scopes.find((entry) => entry.scope.path === scope)!.view.options('site').build_command,
        ).toStrictEqual(argv);
        expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(authored);
        const canonical = emitPolicy(authored, parseToml(authored));
        expect(emitPolicy(canonical, parseToml(canonical))).toBe(canonical);
        await writeFile(join(sandbox.path, 'gspot.toml'), canonical);
        const reopened = await openSession(sandbox.path);
        expect(
            reopened.scopes.find((entry) => entry.scope.path === scope)!.view.options('site').build_command,
        ).toStrictEqual(argv);
    }
    for (const [path, text] of Object.entries(files))
        expect(await readFile(join(sandbox.path, scope, path), 'utf8')).toBe(text);
});
