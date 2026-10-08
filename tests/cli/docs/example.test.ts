import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import example from '#docs/src/config/example.json';
import { codeFences } from '#cli/parsers/markdown.ts';
import { workspaceRoot } from '#automation/workspace.ts';

test('the TypeScript quickstart retains every recorded source block in order', async () => {
    const guide = await readFile(join(workspaceRoot, 'docs/src/content/docs/guides/quickstart/typescript.md'), 'utf8');
    const blocks = codeFences(guide).filter(
        (block) => block.meta?.startsWith('title="') === true && block.language !== 'bash',
    );
    const files = [...example.project, ...example.agent.files, ...example.fix.files];
    expect(blocks).toHaveLength(files.length);
    for (const [index, file] of files.entries()) {
        const block = blocks[index]!;
        expect(block.meta).toBe(`title="${file.path}"`);
        expect(block.language).toBe(file.language);
        if (file.language === 'json')
            expect(JSON.stringify(JSON.parse(block.body))).toBe(JSON.stringify(JSON.parse(file.content)));
        else expect(block.body).toBe(file.content.trimEnd());
    }
});
