import { parseManifest } from '#cli/configurations/manifests.ts';
import { expect, test } from 'bun:test';

test.each(['copy = true', 'body = "include target"', 'merge = { extends = "target" }'])(
    'a template pointer rejects the conflicting emission mode %s',
    (mode) => {
        const source = `[configuration]\nname = "example"\nkind = "policy"\ntitle = "Example"\ndescription = "A configuration for the tests, long enough."\n[[configs]]\ntemplate = "config.tmpl"\ntarget = ".gspot/config.toml"\n[configs.pointer]\npath = "config.toml"\ntemplate = "editor.tmpl"\n`;
        expect(() => parseManifest(`${source}${mode}\n`, 'configurations/example')).toThrow(
            'A template pointer cannot also specify body, merge, or copy.',
        );
        expect(() => parseManifest(source, 'configurations/example')).not.toThrow();
    },
);

test('takeover declarations reject unknown readers and accept every declared reader', () => {
    const definition = (reader: string) => `
[configuration]
name = "example"
kind = "language"
title = "Example"
description = "Configuration adoption for the example language."
[[tools]]
name = "example"
version = "1.0.0"
[[tools.takeover]]
file = ".example"
carries = "${reader}"
`;
    expect(() => parseManifest(definition('executable-script'), 'configurations/example')).toThrow();
    for (const reader of ['ignore-paths', 'rules-table', 'words', 'advisories', 'licenses', 'eslint-config'])
        expect(() => parseManifest(definition(reader), 'configurations/example')).not.toThrow();
});

test('shared takeover selectors cannot authorize retiring the containing file', () => {
    const definition = (selection: string) => `
[configuration]
name = "example"
kind = "language"
title = "Example"
description = "Configuration adoption for the example language."
[[tools]]
name = "example"
version = "1.0.0"
[[tools.takeover]]
file = "package.json"
carries = "eslint-config"
${selection}
`;
    for (const selection of [
        'key = "eslintConfig"',
        'table = "tool.ruff"',
        'key = "eslintConfig"\ntable = "tool.ruff"\nshared = true',
    ])
        expect(() => parseManifest(definition(selection), 'configurations/example')).toThrow();
    expect(() =>
        parseManifest(definition('key = "eslintConfig"\nshared = true'), 'configurations/example'),
    ).not.toThrow();
});

test.each(['latest', '^1.2.3', '../pack'])(
    'query-pack metadata refuses an unpinned version %s and accepts an exact release',
    (version) => {
        const source = (pin: string) => `
[configuration]
name = "security"
kind = "policy"
title = "Security"
description = "Pinned query packs used by security analysis."
[[tools]]
name = "codeql"
version = "2.24.3"
query_packs = {python = "${pin}"}
`;
        expect(() => parseManifest(source(version), 'packages/cli/configurations/policy/security')).toThrow();
        expect(() => parseManifest(source('1.7.8'), 'packages/cli/configurations/policy/security')).not.toThrow();
    },
);

test('a setting names the architecture role of its folder, and only a known role', () => {
    const definition = (role: string) =>
        `entry_files = ["src/main.js"]\n[configuration]\nname = "example"\nkind = "tool"\ntitle = "Example"\ndescription = "A configuration for the tests, long enough."\n[[settings]]\nname = "tools.example.support_directory"\nkind = "string"\ndirection = "neutral"\nrole = "${role}"\ndefault = "tests/support"\nsummary = "The folder that holds test support code."\n`;
    const manifest = parseManifest(definition('harness'), 'configurations/example');
    expect(manifest.settings[0]).toMatchObject({ name: 'tools.example.support_directory', role: 'harness' });
    expect(manifest.entry_files).toStrictEqual(['src/main.js']);
    expect(() => parseManifest(definition('helpers'), 'configurations/example')).toThrow('role');
});

test('a tool names its rule page with the rule placeholder and its crash pattern as a regular expression', () => {
    const definition = (page: string, crash: string) =>
        `[configuration]\nname = "example"\nkind = "tool"\ntitle = "Example"\ndescription = "A configuration for the tests, long enough."\n[[tools]]\nname = "example"\nversion = "1.0.0"\nrule_page = "${page}"\ncrash_pattern = '${crash}'\n`;
    const manifest = parseManifest(
        definition('https://example.test/rules/{rule}', '^Fatal:'),
        'configurations/example',
    );
    expect(manifest.tools[0]).toMatchObject({
        rule_page: 'https://example.test/rules/{rule}',
        crash_pattern: '^Fatal:',
    });
    expect(() => parseManifest(definition('https://example.test/rules', '^Fatal:'), 'configurations/example')).toThrow(
        '{rule}',
    );
    expect(() =>
        parseManifest(definition('https://example.test/rules/{rule}', '(Fatal'), 'configurations/example'),
    ).toThrow('regular expression');
});
