import { join } from 'node:path';

import { existsSync, readFileSync, symlinkSync } from 'node:fs';

import { expect, test } from 'bun:test';

import { createFileTree, testdir } from 'testdirs';

import { evaluateEslint } from '#cli/evaluation/eslint.ts';

import { evaluateFormat } from '#cli/evaluation/format.ts';

const modules = join(import.meta.dir, '../../../../../node_modules');

test.each(['eslint', 'prettier'] as const)(
    '%s adoption refuses an external configuration before executing it',
    async (tool) => {
        await using directory = await testdir();
        const filename = tool === 'eslint' ? 'eslint.config.mjs' : 'prettier.config.mjs';
        const content = `import {writeFileSync} from 'node:fs'; writeFileSync(new URL('./executed', import.meta.url), 'escaped'); export default ${tool === 'eslint' ? '[]' : '{}'};`;
        await createFileTree(directory.path, {
            'project/package.json': '{"type":"module"}',
            [`outside/${filename}`]: content,
        });
        const root = join(directory.path, 'project');
        symlinkSync(modules, join(root, 'node_modules'));
        symlinkSync(`../outside/${filename}`, join(root, filename));
        await expect(
            tool === 'eslint'
                ? evaluateEslint({ root, paths: [], flat: true })
                : evaluateFormat({ root, from: filename }),
        ).rejects.toThrow('private regular file');
        expect(existsSync(join(directory.path, 'outside/executed'))).toBe(false);
        expect(readFileSync(join(directory.path, 'outside', filename), 'utf8')).toBe(content);
    },
);
