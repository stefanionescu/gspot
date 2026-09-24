import { describe, expect, test } from 'bun:test';
import { frontMatterFindings, layerOfPath, parseFrontMatter } from '#cli/agents/metadata.ts';

describe('front matter', () => {
    test('parses the fields between the fences', () => {
        expect(
            parseFrontMatter('---\nlayer: code\nconfiguration: naming\ntitle: Naming\n---\n\n# Naming\n'),
        ).toStrictEqual({
            layer: 'code',
            configuration: 'naming',
            title: 'Naming',
            fields: { layer: 'code', configuration: 'naming', title: 'Naming' },
        });
        expect(parseFrontMatter('# No matter\n')).toBeUndefined();
    });

    test('the layer follows the path', () => {
        expect(layerOfPath('general/code/NAMING.md')).toBe('code');
        expect(layerOfPath('templates/docs/README.md')).toBe('template');
        expect(layerOfPath('framework/express/API.md')).toBe('framework');
    });

    test('findings name what disagrees', () => {
        const text = '---\nlayer: code\nconfiguration: Not An Id\ntitle: Other\n---\n\n# Naming\n';
        const messages = frontMatterFindings('language/typescript/TS.md', text).map((finding) => finding.message);
        expect(messages).toStrictEqual([
            "layer 'code' does not match the path ('language')",
            "configuration 'Not An Id' is not a configuration id or none",
            "title 'Other' does not equal the H1 'Naming'",
        ]);
        expect(frontMatterFindings('a.md', 'plain\n')[0]?.message).toBe('missing front matter');
    });
});
