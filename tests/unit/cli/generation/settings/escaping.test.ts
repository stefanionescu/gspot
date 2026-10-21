import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { openSession } from '#cli/session.ts';
import { parse as parseJsonc } from 'jsonc-parser';
import { mkdir, writeFile } from 'node:fs/promises';
import { generate } from '#cli/generation/generate.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { formatSettingsText } from '#cli/settings/write/text.ts';
import { LYCHEE_MDX_EXPRESSION } from '#cli/config/generation/settings.ts';
import { stringify, LocalDate, parse as parseToml } from '@decimalturn/toml-patch';

import {
    ODD_KEY,
    ODD_VALUE,
    REGISTRIES,
    XCODE_SCHEME,
    XCODE_PROJECT,
    ODD_VALUE_FILES,
    ODD_VALUE_SETTINGS,
} from '#tests/data/generation/settings.ts';

test('odd JSON keys and YAML values stay literal in tool files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': stringify(ODD_VALUE_SETTINGS),
        ...ODD_VALUE_FILES,
    });

    const session = await openSession(sandbox.path);
    const output = generate(session);
    const markdownRules = output.files.find(
        ({ path }) => path === '.gspot/configurations/language/markdown/markdownlint.jsonc',
    )!;
    expect(parseJsonc(markdownRules.content)).toMatchObject({ MD044: { names: [ODD_KEY, ODD_VALUE] } });
    const markdownCli = output.files.find(
        (entry) => entry.path === '.gspot/configurations/language/markdown/markdownlint-cli2.mjs',
    )!;
    const markdownPath = join(sandbox.path, markdownCli.path);
    await mkdir(dirname(markdownPath), { recursive: true });
    await writeFile(markdownPath, markdownCli.content);
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
        extends: join(sandbox.path, '.gspot/configurations/language/markdown/markdownlint.jsonc'),
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
    expect(yaml.get('.gspot/configurations/general/files/yamllint.yml')).toMatchObject({
        rules: { truthy: { 'allowed-values': ['yes', 'no'] }, indentation: { spaces: 'consistent' } },
    });
});
test('TOML tool files keep keys and values with quotes, backslashes, newlines, and accented letters, and option keys', async () => {
    const text = String.raw`café "quoted" \value # comment`;
    const path = 'docs/"draft"/**';
    const reason = 'Reviewed upstream.\n[extend]\nuseDefault = false';
    const option = 'custom."option"';
    await using sandbox = await testdir({
        'gspot.toml': formatSettingsText('', {
            configurations: ['secrets', 'dependencies', 'files', 'docs', 'python', 'markdown'],
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
    expect(parsed.get('.gspot/configurations/general/files/taplo.toml')).toMatchObject({
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
