import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { initArgs } from '#tests/support/cli/init.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/cli.ts';
import { PRETTIER_CARRY_SOURCE } from '#tests/config/acceptance/source/cli/cli.ts';

test.each([false, true])(
    'executable formatter logs preserve JSON; throws=%s',
    async (fails) => {
        await using repository = await testdir();
        const configuration =
            'console.log("formatter stdout"); console.error("formatter stderr");\n' +
            (fails ? 'throw new Error("authored formatter failure");\n' : 'export default { semi: false };\n');
        await createFileTree(repository.path, {
            'prettier.config.mjs': configuration,
            'source.js': PRETTIER_CARRY_SOURCE,
        });
        const result = await run(repository.path, [...initArgs(['formatting']), '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(fails ? 2 : 0);
        expect(() => {
            JSON.parse(result.stdout);
        }).not.toThrow();
        expect(result.stdout).not.toContain('formatter stdout');
        // A failing formatter leaves everything as it was and says why; a working one is carried and removed.
        const config = join(repository.path, 'prettier.config.mjs');
        const generated = join(repository.path, '.gspot/config/prettier.json');
        expect({
            policy: existsSync(join(repository.path, 'gspot.toml')),
            authored: existsSync(config) ? readFileSync(config, 'utf8') : undefined,
            reported: (result.stdout + result.stderr).includes('authored formatter failure'),
            semi: existsSync(generated)
                ? (JSON.parse(readFileSync(generated, 'utf8')) as { semi: boolean }).semi
                : undefined,
        }).toStrictEqual(
            fails
                ? { policy: false, authored: configuration, reported: true, semi: undefined }
                : { policy: true, authored: undefined, reported: false, semi: false },
        );
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'init refuses publication when executable formatting changes a reviewed nested configuration',
    async () => {
        await using repository = await testdir();
        const authored =
            'import { writeFileSync } from "node:fs"; writeFileSync(new URL("./src/.prettierrc.json", import.meta.url), "{\\"semi\\":true}\\n"); export default { semi: false };\n';
        await createFileTree(repository.path, {
            'prettier.config.mjs': authored,
            'src/.prettierrc.json': '{"semi":false}\n',
            'source.js': PRETTIER_CARRY_SOURCE,
            'src/source.js': PRETTIER_CARRY_SOURCE,
        });
        const result = await run(repository.path, [...initArgs(['formatting']), '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(result.stdout + result.stderr).toContain(
            'Configuration changed after takeover was planned: src/.prettierrc.json',
        );
        expect(existsSync(join(repository.path, 'gspot.toml'))).toBe(false);
        expect(readFileSync(join(repository.path, 'src/.prettierrc.json'), 'utf8')).toBe('{"semi":true}\n');
        expect(readFileSync(join(repository.path, 'prettier.config.mjs'), 'utf8')).toBe(authored);
    },
    PLANTED_TIMEOUT_MS,
);
