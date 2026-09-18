import { describe, expect, test } from 'bun:test';
import { frontMatterFindings, layerOfPath, parseFrontMatter } from '#cli/rules/front-matter.ts';

const PRESETS = new Set(['naming', 'rules', 'none']);

describe('front matter', () => {
    test('parses the fields between the fences', () => {
        expect(parseFrontMatter('---\nlayer: code\npreset: naming\ntitle: Naming\n---\n\n# Naming\n')).toEqual({
            layer: 'code',
            preset: 'naming',
            title: 'Naming',
            fields: { layer: 'code', preset: 'naming', title: 'Naming' },
        });
        expect(parseFrontMatter('# No matter\n')).toBeUndefined();
    });

    test('the layer follows the path', () => {
        expect(layerOfPath('general/code/NAMING.md')).toBe('code');
        expect(layerOfPath('templates/docs/README.md')).toBe('template');
        expect(layerOfPath('framework/express/API.md')).toBe('framework');
    });

    test('findings name what disagrees', () => {
        const text = '---\nlayer: code\npreset: unknown\ntitle: Other\n---\n\n# Naming\n';
        const messages = frontMatterFindings('language/typescript/TS.md', text, PRESETS).map(
            (finding) => finding.message,
        );
        expect(messages).toEqual([
            "layer 'code' does not match the path ('language')",
            "unknown preset 'unknown'",
            "title 'Other' does not equal the H1 'Naming'",
        ]);
        expect(frontMatterFindings('a.md', 'plain\n', PRESETS)[0]?.message).toBe('missing front matter');
    });
});
