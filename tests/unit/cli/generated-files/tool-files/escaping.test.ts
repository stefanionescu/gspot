import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { openSession } from '#cli/session.ts';
import { parse as parseJsonc } from 'jsonc-parser';
import { testdir, createFileTree } from 'testdirs';
import { generate } from '#cli/generation/generate.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { formatSettingsText } from '#cli/settings/write/text.ts';
import { stringify, LocalDate, parse as parseToml } from '@decimalturn/toml-patch';

import {
    ODD_KEY,
    ODD_VALUE,
    REGISTRIES,
    XCODE_SCHEME,
    XCODE_PROJECT,
    ODD_VALUE_FILES,
    ODD_VALUE_SETTINGS,
} from '#tests/data/generated-files/tool-files.ts';

test('odd JSON keys and YAML values stay literal in tool files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify(ODD_VALUE_SETTINGS),
        ...ODD_VALUE_FILES,
    });
    const session = await openSession(sandbox.path);
    const output = generate(session);
    for (const path of ['.gspot/config/prettier.json', '.gspot/config/knip.json']) {
        const file = output.files.find((entry) => entry.path === path);
        expect(file).toBeDefined();
        const parsed: unknown = parseJsonc(file!.content);
        expect(parsed).toMatchObject({ [ODD_KEY]: ODD_VALUE });
    }
    const markdownRules = output.files.find(({ path }) => path === '.gspot/config/markdownlint.jsonc')!;
    expect(parseJsonc(markdownRules.content)).toMatchObject({ MD044: { names: [ODD_KEY, ODD_VALUE] } });
    const markdownCli = output.files.find((entry) => entry.path === '.gspot/config/markdownlint-cli2.mjs')!;
    const markdownPath = join(sandbox.path, markdownCli.path);
    await Bun.write(markdownPath, markdownCli.content);
    const toolResult = await runCommand(
        [
            process.execPath,
            '-e',
            'const {default: configuration} = await import(process.argv[1]); process.stdout.write(JSON.stringify(configuration.config));',
            pathToFileURL(markdownPath).href,
        ],
        { cwd: sandbox.path },
    );
    expect(toolResult.code, toolResult.stderr).toBe(0);
    expect(JSON.parse(toolResult.stdout)).toStrictEqual({
        extends: join(sandbox.path, '.gspot/config/markdownlint.jsonc'),
    });
    const yaml = new Map(
        output.files
            .filter((file) => /\.ya?ml$/u.test(file.path))
            .map((file) => [file.path, parseYaml(file.content) as unknown]),
    );
    expect(yaml.get('.gspot/config/periphery.yml')).toMatchObject({ project: XCODE_PROJECT, schemes: [XCODE_SCHEME] });
    expect(yaml.get('.gspot/config/hadolint.yml')).toMatchObject({ trustedRegistries: REGISTRIES });
    expect(yaml.get('.gspot/config/yamllint.yml')).toMatchObject({
        rules: { truthy: { 'allowed-values': ['yes', 'no'] }, indentation: { spaces: 'consistent' } },
    });
});
test('TOML tool files keep odd strings and option keys', async () => {
    const text = String.raw`café "quoted" \value # comment`;
    const path = 'docs/"draft"/**';
    const reason = 'Reviewed upstream.\n[extend]\nuseDefault = false';
    const option = 'custom."option"';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': formatSettingsText('', {
            configurations: ['secrets', 'dependencies', 'files', 'docs', 'python'],
            format: { indent_style: 'tab' },
            tools: {
                taplo: { extra: { value: { [option]: text, column_width: 88 }, reason } },
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
    expect(parsed.get('.gspot/config/osv-scanner.toml')).toMatchObject({
        IgnoredVulns: [{ id: text, reason, ignoreUntil: new Date('2099-09-20T00:00:00.000Z') }],
    });
    expect(parsed.get('.gspot/config/taplo.toml')).toMatchObject({
        formatting: { [option]: text, column_width: 88, indent_string: '\t' },
    });
    expect(parsed.get('.gspot/config/lychee.toml')).toMatchObject({ exclude: [text] });
    expect(parsed.get('.gspot/config/ruff.toml')).toMatchObject({
        lint: { 'per-file-ignores': { [`../../${path}`]: ['F401'] } },
    });
});
