import { test, expect } from 'bun:test';
import { parseManifest } from '#cli/kits/manifests.ts';

test('the folder gives a kit its name and kind, and the [kit] table cannot repeat them', () => {
    const header = '[kit]\ntitle = "Example"\ndescription = "A configuration for the tests, long enough."\n';
    const { kit } = parseManifest(header, 'kits/tool/example');
    expect([kit.name, kit.kind]).toStrictEqual(['example', 'tool']);
    expect(() => parseManifest(`${header}name = "example"\n`, 'kits/tool/example')).toThrow('its folder already gives');
});

test('a template pointer rejects a conflicting emission mode', () => {
    const source = `[kit]\ntitle = "Example"\ndescription = "A configuration for the tests, long enough."\n[[config]]\ntemplate = "config.tmpl"\ntarget = ".gspot/config.toml"\n[config.pointer]\npath = "config.toml"\ntemplate = "editor.tmpl"\n`;
    expect(() => parseManifest(`${source}copy = true\n`, 'kits/general/example')).toThrow(
        'A template pointer cannot also specify body, merge, or copy.',
    );
    expect(() => parseManifest(source, 'kits/general/example')).not.toThrow();
});

const SELECTOR_MANIFEST =
    '[kit]\ntitle = "Example"\ndescription = "Configuration replacement for the example language."\n[[tool]]\nname = "example"\nversion = "1.0.0"\n[[tool.replace]]\nfile = "package.json"\n';

test('shared replace selectors cannot authorize retiring the containing file', () => {
    for (const selection of [
        'key = "eslintConfig"',
        'table = "tool.ruff"',
        'key = "eslintConfig"\ntable = "tool.ruff"\nshared = true',
    ])
        expect(() => parseManifest(SELECTOR_MANIFEST + selection, 'kits/language/example')).toThrow();
    expect(() =>
        parseManifest(`${SELECTOR_MANIFEST}key = "eslintConfig"\nshared = true\n`, 'kits/language/example'),
    ).not.toThrow();
});

const SECURITY_MANIFEST =
    '[kit]\ntitle = "Security"\ndescription = "Pinned query packs used by security analysis."\n[[tool]]\nname = "codeql"\nversion = "2.24.3"\n';

test('query-pack metadata refuses a version range and accepts an exact release', () => {
    expect(() =>
        parseManifest(`${SECURITY_MANIFEST}query_packs = {python = "^1.2.3"}\n`, 'kits/general/security'),
    ).toThrow();
    expect(() =>
        parseManifest(`${SECURITY_MANIFEST}query_packs = {python = "1.7.8"}\n`, 'kits/general/security'),
    ).not.toThrow();
});

const TOOL_MANIFEST =
    '[kit]\ntitle = "Example"\ndescription = "A configuration for the tests, long enough."\n[[tool]]\nname = "example"\nversion = "1.0.0"\n';

test('a tool names its rule page with the rule placeholder and its crash pattern as a regular expression', () => {
    const manifest = parseManifest(
        `${TOOL_MANIFEST}rule_url = "https://example.test/rules/{rule}"\ncrash_pattern = '^Fatal:'\n`,
        'kits/tool/example',
    );
    expect(manifest.tools[0]).toMatchObject({
        rule_url: 'https://example.test/rules/{rule}',
        crash_pattern: '^Fatal:',
    });
    expect(() =>
        parseManifest(
            `${TOOL_MANIFEST}rule_url = "https://example.test/rules"\ncrash_pattern = '^Fatal:'\n`,
            'kits/tool/example',
        ),
    ).toThrow('{rule}');
    expect(() =>
        parseManifest(
            `${TOOL_MANIFEST}rule_url = "https://example.test/rules/{rule}"\ncrash_pattern = '(Fatal'\n`,
            'kits/tool/example',
        ),
    ).toThrow('regular expression');
});

const SUPPRESSION_MANIFEST =
    '[kit]\ntitle = "Example"\ndescription = "A configuration for directive placement."\n[[tool]]\nname = "example"\n[tool.suppression]\nmarker = "# file-disable"\nreason = "reason: (?<reason>.+)"\n';

test('tool suppression metadata validates an inline pattern without requiring it', () => {
    expect(() => parseManifest(`${SUPPRESSION_MANIFEST}inline_marker = "("\n`, 'kits/language/example')).toThrow(
        'regular expression',
    );
    const manifest = parseManifest(
        `${SUPPRESSION_MANIFEST}inline_marker = "# line-disable"\n`,
        'kits/language/example',
    );
    expect(manifest.tools[0]?.suppression).toStrictEqual({
        marker: '# file-disable',
        inline_marker: '# line-disable',
        reason: 'reason: (?<reason>.+)',
    });
    expect(parseManifest(SUPPRESSION_MANIFEST, 'kits/language/example').tools[0]?.suppression).toStrictEqual({
        marker: '# file-disable',
        reason: 'reason: (?<reason>.+)',
    });
});
