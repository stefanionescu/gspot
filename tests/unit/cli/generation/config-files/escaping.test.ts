import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { parse as parseYaml } from 'yaml';
import { openSession } from '#cli/session.ts';
import { parse as parseJsonc } from 'jsonc-parser';
import { generate } from '#cli/generation/generate.ts';
import { buildSettingsText } from '#cli/settings/text/build.ts';
import { LocalDate, stringify, parse as parseToml } from '@decimalturn/toml-patch';
import { LYCHEE_MDX_EXPRESSION } from '#cli/config/generation/config-files/builders/lychee.ts';

import {
    REGISTRIES,
    XCODE_SCHEME,
    XCODE_PROJECT,
    SPECIAL_CHARACTER_KEY,
    SPECIAL_CHARACTER_FILES,
    SPECIAL_CHARACTER_VALUE,
    SPECIAL_CHARACTER_SETTINGS,
} from '#tests/data/generation/config-files/escaping.ts';

test('keys and values with quotes, backslashes, newlines, and accented letters stay literal in JSON and YAML config files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': stringify(SPECIAL_CHARACTER_SETTINGS),
        ...SPECIAL_CHARACTER_FILES,
    });

    const session = await openSession(sandbox.path);
    const output = generate(session);
    const markdownRules = output.files.find(
        ({ path }) => path === '.gspot/configurations/language/markdown/markdownlint.jsonc',
    )!;
    expect(parseJsonc(markdownRules.content)).toMatchObject({
        MD044: { names: [SPECIAL_CHARACTER_KEY, SPECIAL_CHARACTER_VALUE] },
    });
    const yaml = new Map(
        output.files
            .filter((file) => /\.ya?ml$/u.test(file.path))
            .map((file) => [file.path, parseYaml(file.content) as unknown]),
    );
    expect(yaml.get('.gspot/configurations/language/swift/periphery.yml')).toMatchObject({
        project: XCODE_PROJECT,
        schemes: [XCODE_SCHEME],
    });
    expect(yaml.get('.gspot/configurations/infrastructure/docker/hadolint.yml')).toMatchObject({
        trustedRegistries: REGISTRIES,
    });
    expect(yaml.get('.gspot/configurations/general/data-files/yamllint.yml')).toMatchObject({
        rules: { truthy: { 'allowed-values': ['yes', 'no'] }, indentation: { spaces: 'consistent' } },
    });
});
test('TOML config files keep keys and values with quotes, backslashes, newlines, and accented letters, and option keys', async () => {
    const text = String.raw`café "quoted" \value # comment`;
    const path = 'docs/"draft"/**';
    const reason = 'Reviewed upstream.\n[extend]\nuseDefault = false';
    const option = 'custom."option"';
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText('', {
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
        }),
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
    expect(parsed.get('.gspot/configurations/general/dependencies/osv-scanner.toml')).toMatchObject({
        IgnoredVulns: [{ id: text, reason, ignoreUntil: new Date('2099-09-20T00:00:00.000Z') }],
    });
    expect(parsed.get('.gspot/configurations/general/data-files/taplo.toml')).toMatchObject({
        formatting: { indent_string: '\t' },
    });
    const markdown = output.files.find(
        ({ path }) => path === '.gspot/configurations/language/markdown/markdownlint.jsonc',
    );
    expect(parseJsonc(markdown!.content)).toMatchObject({ MD044: { [option]: text } });
    expect(parsed.get('.gspot/configurations/general/docs/lychee.toml')).toMatchObject({
        exclude: [text, LYCHEE_MDX_EXPRESSION],
    });
    expect(parsed.get('.gspot/configurations/language/python/ruff.toml')).toMatchObject({
        lint: { 'per-file-ignores': { [`../../../../${path}`]: ['F401'] } },
    });
});
