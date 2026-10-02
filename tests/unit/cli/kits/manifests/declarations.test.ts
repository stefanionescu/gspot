import { test, expect } from 'bun:test';
import { parseManifest } from '#cli/kits/manifests.ts';

test('a template pointer rejects a conflicting emission mode', () => {
    const source = `[kit]\nname = "example"\nkind = "general"\ntitle = "Example"\ndescription = "A configuration for the tests, long enough."\n[[configs]]\ntemplate = "config.tmpl"\ntarget = ".gspot/config.toml"\n[configs.pointer]\npath = "config.toml"\ntemplate = "editor.tmpl"\n`;
    expect(() => parseManifest(`${source}copy = true\n`, 'configurations/example')).toThrow(
        'A template pointer cannot also specify body, merge, or copy.',
    );
    expect(() => parseManifest(source, 'configurations/example')).not.toThrow();
});

const SELECTOR_MANIFEST =
    '[kit]\nname = "example"\nkind = "language"\ntitle = "Example"\ndescription = "Configuration replacement for the example language."\n[[tools]]\nname = "example"\nversion = "1.0.0"\n[[tools.replace]]\nfile = "package.json"\n';

test('shared replace selectors cannot authorize retiring the containing file', () => {
    for (const selection of [
        'key = "eslintConfig"',
        'table = "tool.ruff"',
        'key = "eslintConfig"\ntable = "tool.ruff"\nshared = true',
    ])
        expect(() => parseManifest(SELECTOR_MANIFEST + selection, 'configurations/example')).toThrow();
    expect(() =>
        parseManifest(`${SELECTOR_MANIFEST}key = "eslintConfig"\nshared = true\n`, 'configurations/example'),
    ).not.toThrow();
});

const SECURITY_MANIFEST =
    '[kit]\nname = "security"\nkind = "general"\ntitle = "Security"\ndescription = "Pinned query packs used by security analysis."\n[[tools]]\nname = "codeql"\nversion = "2.24.3"\n';

test('query-pack metadata refuses a version range and accepts an exact release', () => {
    expect(() =>
        parseManifest(`${SECURITY_MANIFEST}query_packs = {python = "^1.2.3"}\n`, 'kits/general/security'),
    ).toThrow();
    expect(() =>
        parseManifest(`${SECURITY_MANIFEST}query_packs = {python = "1.7.8"}\n`, 'kits/general/security'),
    ).not.toThrow();
});

const TOOL_MANIFEST =
    '[kit]\nname = "example"\nkind = "tool"\ntitle = "Example"\ndescription = "A configuration for the tests, long enough."\n[[tools]]\nname = "example"\nversion = "1.0.0"\n';

test('a tool names its rule page with the rule placeholder and its crash pattern as a regular expression', () => {
    const manifest = parseManifest(
        `${TOOL_MANIFEST}rule_page = "https://example.test/rules/{rule}"\ncrash_pattern = '^Fatal:'\n`,
        'configurations/example',
    );
    expect(manifest.tools[0]).toMatchObject({
        rule_page: 'https://example.test/rules/{rule}',
        crash_pattern: '^Fatal:',
    });
    expect(() =>
        parseManifest(
            `${TOOL_MANIFEST}rule_page = "https://example.test/rules"\ncrash_pattern = '^Fatal:'\n`,
            'configurations/example',
        ),
    ).toThrow('{rule}');
    expect(() =>
        parseManifest(
            `${TOOL_MANIFEST}rule_page = "https://example.test/rules/{rule}"\ncrash_pattern = '(Fatal'\n`,
            'configurations/example',
        ),
    ).toThrow('regular expression');
});

const SUPPRESSION_MANIFEST =
    '[kit]\nname = "example"\nkind = "language"\ntitle = "Example"\ndescription = "A configuration for directive placement."\n[[tools]]\nname = "example"\n[tools.suppression]\nmarker = "# file-disable"\nreason = "reason: (?<reason>.+)"\n';

test('tool suppression metadata validates an inline pattern without requiring it', () => {
    expect(() => parseManifest(`${SUPPRESSION_MANIFEST}inline_marker = "("\n`, 'configurations/example')).toThrow(
        'regular expression',
    );
    const manifest = parseManifest(
        `${SUPPRESSION_MANIFEST}inline_marker = "# line-disable"\n`,
        'configurations/example',
    );
    expect(manifest.tools[0]?.suppression).toStrictEqual({
        marker: '# file-disable',
        inline_marker: '# line-disable',
        reason: 'reason: (?<reason>.+)',
    });
    expect(parseManifest(SUPPRESSION_MANIFEST, 'configurations/example').tools[0]?.suppression).toStrictEqual({
        marker: '# file-disable',
        reason: 'reason: (?<reason>.+)',
    });
});
