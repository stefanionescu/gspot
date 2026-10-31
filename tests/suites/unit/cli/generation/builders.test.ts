import { testdir } from 'testdirs';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { parse as parseYaml } from 'yaml';
import { parse as parseJsonc } from 'jsonc-parser';
import { openSession } from '#cli/planning/session.ts';
import { buildAssetPath } from '#cli/system/assets.ts';
import { buildSettingsText } from '#cli/settings/text.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { CONFIG_BUILDERS } from '#cli/generation/builders.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { stringify, parse as parseToml } from '@decimalturn/toml-patch';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { SEMGREP_RULE_PACK_FILE } from '#cli/config/generation/generation.ts';
import { SPECIAL_CHARACTER_FILES, SPECIAL_CHARACTER_SETTINGS } from '#tests/config/generation/configs.ts';

test('keys and values with quotes, backslashes, newlines, and accented letters stay literal in JSON and YAML config files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': stringify(SPECIAL_CHARACTER_SETTINGS),
        ...SPECIAL_CHARACTER_FILES,
    });

    const session = await openSession(sandbox.path);
    const output = buildGeneratedFiles(session);
    const markdownRules = output.files.find(
        ({ path }) => path === getManifestTarget('markdown', 'markdownlint.jsonc'),
    )!;
    expect(parseJsonc(markdownRules.content)).toMatchObject({
        MD044: { names: ['custom"key\\name\ncafé', 'yes: # quoted "value"'] },
    });
    const yaml = new Map(
        output.files
            .filter((file) => /\.ya?ml$/u.test(file.path))
            .map((file) => [file.path, parseYaml(file.content) as unknown]),
    );
    expect(yaml.get(getManifestTarget('swift', 'periphery.yml'))).toMatchObject({
        project: 'ios/App # café.xcodeproj',
        schemes: ['null'],
    });
    expect(yaml.get(getManifestTarget('docker', 'hadolint.yml'))).toMatchObject({
        trustedRegistries: ['null', 'registry.example.com:5000'] as const,
    });
    expect(yaml.get(getManifestTarget('data-files', 'yamllint.yml'))).toMatchObject({
        rules: { truthy: { 'allowed-values': ['yes', 'no'] } },
    });
});

test('TOML config files keep keys and values with quotes, backslashes, newlines, and accented letters, and option keys', async () => {
    const text = String.raw`café "quoted" \value # comment`;
    const path = 'docs/"draft"/**';
    const reason = 'Reviewed upstream.\n[extend]\nuseDefault = false';
    const option = 'custom."option"';
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText('', '', {
            configurations: ['secrets', 'dependencies', 'data-files', 'docs', 'python', 'markdown'],
            format: { indent_style: 'tab' },
            tools: {
                markdownlint: { rules: { MD044: { [option]: text } } },
            },
            docs: { allowed_urls: { value: [text], reason } },
            ignore: [
                { check: 'python/ruff', rule: 'F401', paths: [path], reason },
                { check: 'dependencies/osv-scanner', rule: text, reason },
                { check: 'dependencies/osv-scanner', rule: 'GHSA-path-specific', paths: [path], reason },
            ],
        }),
        'sample.py': 'value = 1',
        'sample.md': '# Sample',
        'package.json': '{"private":true}',
        'package-lock.json': '{"lockfileVersion":3,"packages":{}}',
    });

    const session = await openSession(sandbox.path);
    const output = buildGeneratedFiles(session);
    const parsed = new Map(
        output.files.filter((file) => file.path.endsWith('.toml')).map((file) => [file.path, parseToml(file.content)]),
    );
    expect(parsed.get(getManifestTarget('dependencies', 'osv-scanner.toml'))).toMatchObject({
        IgnoredVulns: [{ id: text, reason }],
    });
    expect(parsed.get(getManifestTarget('data-files', 'taplo.toml'))).toMatchObject({
        formatting: { indent_string: '\t' },
    });
    const markdown = output.files.find(({ path }) => path === getManifestTarget('markdown', 'markdownlint.jsonc'));
    expect(parseJsonc(markdown!.content)).toMatchObject({ MD044: { [option]: text } });
    expect(parsed.get(getManifestTarget('docs', 'lychee.toml'))).toMatchObject({
        exclude: [text, '%7B[^/]*%7D'],
    });
    expect(parsed.get(getManifestTarget('python', 'ruff.toml'))).toMatchObject({
        lint: { 'per-file-ignores': { [`../../../../${path}`]: ['F401'] } },
    });
});

test('each shipped config file has exactly one producer', () => {
    const missing: string[] = [];
    const records = readConfigurations()
        .values()
        .flatMap((configuration) => configuration.configs.map((file) => ({ configuration, file })));
    for (const { configuration, file } of records) {
        const key = `${configuration.name}/${file.file}`;
        const hasBuilder = file.source !== undefined && CONFIG_BUILDERS[key] !== undefined;
        const hasSemgrep = file.source !== undefined && file.file === SEMGREP_RULE_PACK_FILE;
        const hasLinkFile = file.source === undefined;
        const hasShipped =
            !hasBuilder &&
            !hasSemgrep &&
            file.source !== undefined &&
            existsSync(buildAssetPath(`${configuration.folder}/${file.source}`));
        if ([hasBuilder, hasSemgrep, hasLinkFile, hasShipped].filter(Boolean).length !== 1) missing.push(key);
    }
    expect(missing).toStrictEqual([]);
});
