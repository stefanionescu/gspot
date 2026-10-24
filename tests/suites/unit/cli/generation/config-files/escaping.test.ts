import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { parse as parseYaml } from 'yaml';
import { openSession } from '#cli/session.ts';
import { parse as parseJsonc } from 'jsonc-parser';
import { generate } from '#cli/generation/generate.ts';
import { formatSchema } from '#cli/schemas/settings/fields.ts';
import { buildSettingsText } from '#cli/settings/text/build.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { LocalDate, stringify, parse as parseToml } from '@decimalturn/toml-patch';
import { SPECIAL_CHARACTER_FILES, SPECIAL_CHARACTER_SETTINGS } from '#tests/config/generation/config-files/escaping.ts';

test('keys and values with quotes, backslashes, newlines, and accented letters stay literal in JSON and YAML config files', async () => {
    const REGISTRIES = ['null', 'registry.example.com:5000'] as const;

    const XCODE_SCHEME = 'null';

    const XCODE_PROJECT = 'ios/App # café.xcodeproj';

    const SPECIAL_CHARACTER_VALUE = 'yes: # quoted "value"';

    const SPECIAL_CHARACTER_KEY = 'custom"key\\name\ncafé';

    await using sandbox = await testdir({
        'gspot.toml': stringify(SPECIAL_CHARACTER_SETTINGS),
        ...SPECIAL_CHARACTER_FILES,
    });

    const session = await openSession(sandbox.path);
    const output = generate(session);
    const markdownRules = output.files.find(
        ({ path }) => path === findManifestTarget('markdown', 'markdownlint.jsonc'),
    )!;
    expect(parseJsonc(markdownRules.content)).toMatchObject({
        MD044: { names: [SPECIAL_CHARACTER_KEY, SPECIAL_CHARACTER_VALUE] },
    });
    const yaml = new Map(
        output.files
            .filter((file) => /\.ya?ml$/u.test(file.path))
            .map((file) => [file.path, parseYaml(file.content) as unknown]),
    );
    expect(yaml.get(findManifestTarget('swift', 'periphery.yml'))).toMatchObject({
        project: XCODE_PROJECT,
        schemes: [XCODE_SCHEME],
    });
    expect(yaml.get(findManifestTarget('docker', 'hadolint.yml'))).toMatchObject({
        trustedRegistries: REGISTRIES,
    });
    expect(yaml.get(findManifestTarget('data-files', 'yamllint.yml'))).toMatchObject({
        rules: { truthy: { 'allowed-values': ['yes', 'no'] } },
    });
});

test('TOML config files keep keys and values with quotes, backslashes, newlines, and accented letters, and option keys', async () => {
    const text = String.raw`café "quoted" \value # comment`;
    const path = 'docs/"draft"/**';
    const reason = 'Reviewed upstream.\n[extend]\nuseDefault = false';
    const option = 'custom."option"';
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(
            '',
            {
                configurations: ['secrets', 'dependencies', 'data-files', 'docs', 'python', 'markdown'],
                format: { indent_style: 'tab' },
                tools: {
                    markdownlint: { rules: { MD044: { [option]: text } } },
                },
                docs: { allowed_urls: { value: [text], reason } },
                ignore: [
                    { check: 'python/ruff', rule: 'F401', paths: [path], reason },
                    { check: 'dependencies/osv-scanner', rule: text, reason, until: new LocalDate('2099-09-20') },
                    { check: 'dependencies/osv-scanner', rule: 'GHSA-path-specific', paths: [path], reason },
                ],
            },
            formatSchema.parse({ indent_style: 'tab' }),
        ),
        'sample.py': 'value = 1',
        'sample.md': '# Sample',
        'package.json': '{"private":true}',
        'package-lock.json': '{"lockfileVersion":3,"packages":{}}',
    });

    const session = await openSession(sandbox.path);
    const output = generate(session);
    const parsed = new Map(
        output.files.filter((file) => file.path.endsWith('.toml')).map((file) => [file.path, parseToml(file.content)]),
    );
    expect(parsed.get(findManifestTarget('dependencies', 'osv-scanner.toml'))).toMatchObject({
        IgnoredVulns: [{ id: text, reason, ignoreUntil: new Date('2099-09-20T00:00:00.000Z') }],
    });
    expect(parsed.get(findManifestTarget('data-files', 'taplo.toml'))).toMatchObject({
        formatting: { indent_string: '\t' },
    });
    const markdown = output.files.find(({ path }) => path === findManifestTarget('markdown', 'markdownlint.jsonc'));
    expect(parseJsonc(markdown!.content)).toMatchObject({ MD044: { [option]: text } });
    expect(parsed.get(findManifestTarget('docs', 'lychee.toml'))).toMatchObject({
        exclude: [text, '%7B[^/]*%7D'],
    });
    expect(parsed.get(findManifestTarget('python', 'ruff.toml'))).toMatchObject({
        lint: { 'per-file-ignores': { [`../../../../${path}`]: ['F401'] } },
    });
});
