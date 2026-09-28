import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runEslint } from '#cli/native/eslint.ts';
import { runFormat } from '#cli/native/format.ts';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/support/expectations.ts';
import { existsSync, symlinkSync, readFileSync } from 'node:fs';

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
        expect(
            await rejection(
                tool === 'eslint' ? runEslint({ root, paths: [], flat: true }) : runFormat({ root, from: filename }),
            ),
        ).toContain('private regular file');
        expect(existsSync(join(directory.path, 'outside/executed'))).toBe(false);
        expect(readFileSync(join(directory.path, 'outside', filename), 'utf8')).toBe(content);
    },
);
