import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { existsSync, symlinkSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { evaluateEslint } from '#cli/evaluation/eslint.ts';
import { rejection } from '#tests/support/expectations.ts';

const modules = join(import.meta.dir, '../../../../../node_modules');

test.each([
    ['eslint.config.mjs', 'import plugin from "./plugin.cjs"; export default [{plugins: {custom: plugin}}];'],
    ['eslint.config.cjs', 'const plugin = require("./plugin.cjs"); module.exports = [{plugins: {custom: plugin}}];'],
    [
        'eslint.config.mjs',
        'const {default: plugin} = await import("./plugin.cjs"); export default [{plugins: {custom: plugin}}];',
    ],
])('ESLint adoption rejects an external module from %s before executing it', async (filename, configuration) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/package.json': '{"type":"module"}',
        [`project/${filename}`]: configuration,
        'outside/plugin.cjs':
            'require("node:fs").writeFileSync(require("node:path").join(__dirname, "executed"), "escaped"); module.exports = {rules: {}};',
    });
    symlinkSync(modules, join(directory.path, 'project/node_modules'));
    symlinkSync('../outside/plugin.cjs', join(directory.path, 'project/plugin.cjs'));
    expect(
        (await rejection(evaluateEslint({ root: join(directory.path, 'project'), paths: [], flat: true }))).message,
    ).toContain('outside the repository');
    expect(existsSync(join(directory.path, 'outside/executed'))).toBe(false);
});
