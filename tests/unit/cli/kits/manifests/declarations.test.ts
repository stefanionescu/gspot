import { test, expect } from 'bun:test';
import { parseManifest } from '#cli/kits/manifests.ts';

test('a template pointer rejects a conflicting emission mode', () => {
    const source = `[kit]\nname = "example"\nkind = "general"\ntitle = "Example"\ndescription = "A configuration for the tests, long enough."\n[[configs]]\ntemplate = "config.tmpl"\ntarget = ".gspot/config.toml"\n[configs.pointer]\npath = "config.toml"\ntemplate = "editor.tmpl"\n`;
    expect(() => parseManifest(`${source}copy = true\n`, 'configurations/example')).toThrow(
        'A template pointer cannot also specify body, merge, or copy.',
    );
    expect(() => parseManifest(source, 'configurations/example')).not.toThrow();
});

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Two cases parse the same manifest with a different selector.
const selectorDefinition = (selection: string) => `
[kit]
name = "example"
kind = "language"
title = "Example"
description = "Configuration replacement for the example language."
[[tools]]
name = "example"
version = "1.0.0"
[[tools.replace]]
file = "package.json"
${selection}
`;

test('shared replace selectors cannot authorize retiring the containing file', () => {
    for (const selection of [
        'key = "eslintConfig"',
        'table = "tool.ruff"',
        'key = "eslintConfig"\ntable = "tool.ruff"\nshared = true',
    ])
        expect(() => parseManifest(selectorDefinition(selection), 'configurations/example')).toThrow();
    expect(() =>
        parseManifest(selectorDefinition('key = "eslintConfig"\nshared = true'), 'configurations/example'),
    ).not.toThrow();
});

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Two cases parse the same security manifest with a different pin.
const pinnedSecurity = (pin: string) => `
[kit]
name = "security"
kind = "general"
title = "Security"
description = "Pinned query packs used by security analysis."
[[tools]]
name = "codeql"
version = "2.24.3"
query_packs = {python = "${pin}"}
`;

test('query-pack metadata refuses a version range and accepts an exact release', () => {
    expect(() => parseManifest(pinnedSecurity('^1.2.3'), 'kits/general/security')).toThrow();
    expect(() => parseManifest(pinnedSecurity('1.7.8'), 'kits/general/security')).not.toThrow();
});

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Three cases parse the same manifest with a different rule page and crash pattern.
const toolPageDefinition = (page: string, crash: string) =>
    `[kit]\nname = "example"\nkind = "tool"\ntitle = "Example"\ndescription = "A configuration for the tests, long enough."\n[[tools]]\nname = "example"\nversion = "1.0.0"\nrule_page = "${page}"\ncrash_pattern = '${crash}'\n`;

test('a tool names its rule page with the rule placeholder and its crash pattern as a regular expression', () => {
    const manifest = parseManifest(
        toolPageDefinition('https://example.test/rules/{rule}', '^Fatal:'),
        'configurations/example',
    );
    expect(manifest.tools[0]).toMatchObject({
        rule_page: 'https://example.test/rules/{rule}',
        crash_pattern: '^Fatal:',
    });
    expect(() =>
        parseManifest(toolPageDefinition('https://example.test/rules', '^Fatal:'), 'configurations/example'),
    ).toThrow('{rule}');
    expect(() =>
        parseManifest(toolPageDefinition('https://example.test/rules/{rule}', '(Fatal'), 'configurations/example'),
    ).toThrow('regular expression');
});

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Three cases parse the same manifest with a different suppression marker.
const suppressionDefinition = (inline: string) => `
[kit]
name = "example"
kind = "language"
title = "Example"
description = "A configuration for directive placement."
[[tools]]
name = "example"
[tools.suppression]
marker = "# file-disable"
reason = "reason: (?<reason>.+)"
${inline}
`;

test('tool suppression metadata validates an inline pattern without requiring it', () => {
    expect(() => parseManifest(suppressionDefinition('inline_marker = "("'), 'configurations/example')).toThrow(
        'regular expression',
    );
    const manifest = parseManifest(suppressionDefinition('inline_marker = "# line-disable"'), 'configurations/example');
    expect(manifest.tools[0]?.suppression).toStrictEqual({
        marker: '# file-disable',
        inline_marker: '# line-disable',
        reason: 'reason: (?<reason>.+)',
    });
    expect(parseManifest(suppressionDefinition(''), 'configurations/example').tools[0]?.suppression).toStrictEqual({
        marker: '# file-disable',
        reason: 'reason: (?<reason>.+)',
    });
});
