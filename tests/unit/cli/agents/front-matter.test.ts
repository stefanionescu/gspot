import { test, expect, describe } from 'bun:test';
import { layerOfPath, parseFrontMatter, frontMatterFindings } from '#cli/agents/metadata.ts';

describe('front matter', () => {
    test('parses the fields between the fences', () => {
        expect(parseFrontMatter('---\nlayer: code\nkit: naming\ntitle: Naming\n---\n\n# Naming\n')).toStrictEqual({
            layer: 'code',
            kit: 'naming',
            title: 'Naming',
            fields: { layer: 'code', kit: 'naming', title: 'Naming' },
        });
        expect(parseFrontMatter('# No matter\n')).toBeUndefined();
    });

    test('the layer follows the path', () => {
        expect(layerOfPath('general/code/NAMING.md')).toBe('code');
        expect(layerOfPath('templates/docs/README.md')).toBe('template');
        expect(layerOfPath('framework/express/API.md')).toBe('framework');
    });

    test('findings name what disagrees', () => {
        const text = '---\nlayer: code\nkit: Not An Id\ntitle: Other\n---\n\n# Naming\n';
        const messages = frontMatterFindings('language/typescript/TS.md', text).map((finding) => finding.message);
        expect(messages).toStrictEqual([
            "layer 'code' does not match the path ('language')",
            "kit 'Not An Id' is not a kit id or none",
            "title 'Other' does not equal the H1 'Naming'",
        ]);
        expect(frontMatterFindings('a.md', 'plain\n')[0]?.message).toBe('missing front matter');
    });
});
