import { PLANTED_TIMEOUT_MS, runProcess } from '#tests/support/cli/command.ts';
import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

test(
    'a configuration edited at confirmation is preserved before init publishes policy',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.prettierrc.json': '{"semi":false}\n',
            'source.js': 'const greeting = "hello";\n',
        });
        const command = join(import.meta.dir, '../../../../../packages/cli/src/commands/init/command.ts');
        const child = String.raw`
            import { mock } from 'bun:test';
            import { writeFileSync } from 'node:fs';
            Object.defineProperty(process.stdin, 'isTTY', { value: true });
            Object.defineProperty(process.stdout, 'isTTY', { value: true });
            delete process.env.CI;
            mock.module(${JSON.stringify(Bun.resolveSync('@clack/prompts', command))}, () => ({
                confirm: async () => { writeFileSync('.prettierrc.json', '{"semi":true}\n'); return true; },
                select: async () => { throw new Error('Unexpected selection'); },
                multiselect: async () => { throw new Error('Unexpected selection'); },
            }));
            const { initCommand } = await import(${JSON.stringify(command)});
            try {
                await initCommand({ cwd: process.cwd(), configurations: ['formatting'], yes: false, json: false, isDryRun: false, install: false, allowDirty: true, hooks: 'none', ci: 'none', runner: 'none', rules: 'no', format: 'keep' });
            } catch (error) { console.error(error.message); process.exitCode = 2; }
        `;
        const result = await runProcess([process.execPath, '--eval', child], { cwd: sandbox.path });
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(result.stderr).toContain('changed after takeover was planned');
        expect(readFileSync(join(sandbox.path, '.prettierrc.json'), 'utf8')).toBe('{"semi":true}\n');
        expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
        expect(existsSync(join(sandbox.path, '.gspot/version'))).toBe(false);
        expect(readFileSync(join(sandbox.path, 'source.js'), 'utf8')).toBe('const greeting = "hello";\n');
    },
    PLANTED_TIMEOUT_MS,
);
