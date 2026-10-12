import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { ALIAS_IMPORT, RESPONSE_MESSAGES } from '#tests/config/eslint/selectors.ts';
import { createEslint, lintFindings, readEslintConfiguration } from '#tests/setup/generate.ts';

test.each([...LEVELS])(
    'Express selectors and security rules apply in the Express scope at their level (%s)',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `level = "${level}"\nconfigurations = ["javascript"]\n[tools.eslint]\nimport_extension = "js"\n[[scope]]\npath = "api"\nconfigurations = ["express"]\n`,
            'package.json': '{"private":true,"type":"module","imports":{"#owner":"./owner.js"}}',
            'owner.js': 'export const value = 1;',
            'source.js': ALIAS_IMPORT + RESPONSE_MESSAGES,
            'api/source.js': ALIAS_IMPORT + RESPONSE_MESSAGES,
            'api/child/source.js': ALIAS_IMPORT + RESPONSE_MESSAGES,
        });
        const eslint = await createEslint(sandbox.path);
        const root = await readEslintConfiguration(eslint, 'source.js');
        const express = await readEslintConfiguration(eslint, 'api/source.js');
        expect(root.rules['security/detect-buffer-noassert']).toBeUndefined();
        expect(root.rules['security/detect-no-csrf-before-method-override']).toBeUndefined();
        expect(express.rules['security/detect-no-csrf-before-method-override']![0]).toBe(2);
        expect(root.rules['no-param-reassign']![0]).toBe(level === 'all' ? 2 : 0);
        expect(root.rules['security/detect-child-process']![0]).toBe(level === 'all' ? 2 : 0);
        expect(root.rules['security/detect-possible-timing-attacks']![0]).toBe(level === 'all' ? 2 : 0);
        const files = ['source.js', 'api/source.js', 'api/child/source.js'];
        const expected = files
            .flatMap((file) => {
                const elevated = file === 'source.js' ? [1, 3] : [1, 2, 3];
                const lines = level === 'all' ? elevated : [1];
                return lines.map((line) => ({ file, rule: 'no-restricted-syntax', line }));
            })
            .toSorted((left, right) => left.file.localeCompare(right.file) || left.line - right.line);
        expect(await lintFindings(eslint, sandbox.path, files, ['no-restricted-syntax'])).toStrictEqual(expected);
    },
);
