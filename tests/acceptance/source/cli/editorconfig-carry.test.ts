import prettier from 'prettier';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
import { chmodSync, readFileSync, statSync, symlinkSync } from 'node:fs';

import {
    EDITORCONFIG,
    EDITORCONFIG_CARRY_FILES,
    PRETTIER_CARRY_SOURCE,
} from '#tests/constants/acceptance/source/cli/cli.ts';

test.each([false, true])(
    'nested EditorConfig adoption preserves formatting and restores original bytes, with Prettier config=%s',
    async (hasPrettier) => {
        await using repository = await testdir();
        const originals = {
            '.editorconfig': EDITORCONFIG,
            'src/.editorconfig': '[*.js]\nindent_size = 8\n',
            'src/package.json': '{"private":true,"prettier":{"semi":false}}\n',
            ...(hasPrettier ? { '.prettierrc.yaml': 'semi: false\n' } : {}),
        };
        await createFileTree(repository.path, {
            ...originals,
            ...Object.fromEntries(EDITORCONFIG_CARRY_FILES.map((file) => [file, PRETTIER_CARRY_SOURCE])),
        });
        for (const file of Object.keys(originals)) chmodSync(join(repository.path, file), 0o640);
        symlinkSync(join(import.meta.dir, '../../../../node_modules'), join(repository.path, 'node_modules'));
        const expected = new Map<string, string>();
        for (const file of [...EDITORCONFIG_CARRY_FILES, 'src/future.js']) {
            const filepath = join(repository.path, file);
            const options = await prettier.resolveConfig(filepath, { editorconfig: true, useCache: false });
            expected.set(file, await prettier.format(PRETTIER_CARRY_SOURCE, { ...options, filepath }));
        }
        expect(expected.get('src/[draft].js')).toContain('\n        console.log');
        expect(expected.get('tests/source.js')).toContain('\n    console.log');
        expect(expected.get('source.js')).toContain('\n  console.log');
        const initialized = await run(repository.path, [
            'init',
            '--yes',
            '--configurations',
            'formatting',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        const applied = await run(repository.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        for (const file of [...EDITORCONFIG_CARRY_FILES, 'src/future.js']) {
            const filepath = join(repository.path, file);
            const options = await prettier.resolveConfig(filepath, {
                config: join(repository.path, '.gspot/config/prettier.json'),
                editorconfig: true,
                useCache: false,
            });
            expect(await prettier.format(PRETTIER_CARRY_SOURCE, { ...options, filepath }), file).toBe(
                expected.get(file)!,
            );
        }
        const restored = await run(repository.path, ['uninstall', '--yes']);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
        for (const [file, text] of Object.entries(originals)) {
            expect(readFileSync(join(repository.path, file), 'utf8')).toBe(text);
            expect(statSync(join(repository.path, file)).mode & 0o777).toBe(0o640);
        }
        for (const file of EDITORCONFIG_CARRY_FILES)
            expect(readFileSync(join(repository.path, file), 'utf8')).toBe(PRETTIER_CARRY_SOURCE);
    },
    PLANTED_TIMEOUT_MS,
);
