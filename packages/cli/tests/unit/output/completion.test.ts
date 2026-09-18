import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

const gspot = join(new URL('../../../src/main.ts', import.meta.url).pathname);

describe('completion', () => {
    test('the bash and zsh scripts name every command', () => {
        for (const shell of ['bash', 'zsh']) {
            const result = Bun.spawnSync(['bun', gspot, 'completion', shell], { stdout: 'pipe', stderr: 'pipe' });
            expect(result.exitCode).toBe(0);
            const script = result.stdout.toString();
            expect(script.length).toBeGreaterThan(100);
            expect(script).toContain('gspot');
        }
        const complete = Bun.spawnSync(['bun', gspot, 'complete', '--', ''], {
            stdout: 'pipe',
            stderr: 'pipe',
        }).stdout.toString();
        for (const command of [
            'init',
            'check',
            'apply',
            'ignore',
            'add',
            'remove',
            'allow',
            'set',
            'declare',
            'why',
            'explain',
            'doctor',
            'upgrade',
            'uninstall',
            'completion',
        ])
            expect(complete).toContain(command);
    });
});
