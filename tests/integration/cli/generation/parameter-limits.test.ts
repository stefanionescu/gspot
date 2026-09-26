import { ESLint } from 'eslint';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { openSession } from '#cli/execution/session.ts';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';

const modules = join(import.meta.dir, '../../../../node_modules');

for (const language of ['javascript', 'typescript']) {
    test.each([7, 8])(`${language} counts declared parameters with maximum %i`, async (maximum) => {
        await using directory = await testdir();
        const extension = { javascript: 'js', typescript: 'ts' }[language]!;
        const source = [7, 8]
            .map((count) => {
                const names = Array.from({ length: count }, (_, index) => `value${index}`);
                const name = count === 7 ? 'seven' : 'eight';
                const parameters =
                    language === 'typescript' ? ['this: void', ...names.map((name) => `${name}: number`)] : names;
                return `export function ${name}(${parameters.join(', ')}) { return ${names.join(' + ')}; }`;
            })
            .join('\n');
        await createFileTree(directory.path, {
            'gspot.toml': `version = 1\nconfigurations = ["${language}"]\n${maximum === 7 ? '' : `[limits.${language}]\nfunction_parameters = ${maximum}\n`}`,
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
            [`example.${extension}`]: source,
        });
        symlinkSync(modules, join(directory.path, 'node_modules'));
        const renderSession1 = await openSession(directory.path);
        const files = emitAll(renderSession1.policyFiles.policy, renderSession1.repository, renderSession1.scopes, {
            version: renderSession1.version,
            packageManager: renderSession1.packageManager,
        }).files;
        const configName = '.gspot/config/eslint.config.mjs';
        const config = files.find(({ path }) => path === configName)!;
        mkdirSync(join(directory.path, '.gspot/config'), { recursive: true });
        writeFileSync(join(directory.path, configName), config.content);
        const results = await new ESLint({
            cwd: directory.path,
            overrideConfigFile: join(directory.path, configName),
        }).lintFiles([`example.${extension}`]);
        expect(
            results.flatMap(({ messages }) => messages).filter(({ ruleId }) => ruleId === 'max-params'),
        ).toMatchObject(maximum === 7 ? [{ ruleId: 'max-params', line: 2 }] : []);
    });
}
