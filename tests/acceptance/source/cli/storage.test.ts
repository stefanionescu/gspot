// Runtime storage under .gspot: a linked folder is refused, and an edited cache result is replaced.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { mkdirSync, readdirSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

test.each([
    { target: 'directory', code: 2, diagnostic: 'Unsafe lifecycle parent', expectedFinding: undefined },
    { target: 'cache', code: 1, diagnostic: 'Could not write', expectedFinding: 'Exact finding' },
])(
    'runtime storage refuses a symbolic-link $target without changing outside bytes',
    async ({ target, code, diagnostic, expectedFinding }) => {
        await using sandbox = await testdir();
        await using outside = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(
                [],
                `[[check]]\nname = "project/storage"\npaths = ["source.txt"]\ninputs = ["source.txt"]\nstage = "commit"\ncommand = ${JSON.stringify([process.execPath, '-e', 'console.log("Exact finding"); process.exitCode=1'])}\n[check.output]\nformat = "lines"\n`,
            ),
            'source.txt': 'input\n',
        });
        writeFileSync(join(outside.path, 'sentinel'), 'authored outside\n');
        if (target === 'directory') symlinkSync(outside.path, join(sandbox.path, '.gspot'));
        else {
            mkdirSync(join(sandbox.path, '.gspot'), { recursive: true });
            symlinkSync(outside.path, join(sandbox.path, '.gspot/cache'));
        }
        const result = await run(sandbox.path, ['check', '--json', ...(target === 'cache' ? [] : ['--no-cache'])]);
        // A linked .gspot directory refuses the run; a linked cache is refused while the check still reports.
        const isDirectory = target === 'directory';
        expect(result.code, result.stdout + result.stderr).toBe(code);
        expect(result.stderr).toContain(diagnostic);
        const finding = isDirectory
            ? undefined
            : (JSON.parse(result.stdout) as RunReport).checks[0]?.findings[0]?.message;
        expect(finding).toBe(expectedFinding);
        expect(readFileSync(join(outside.path, 'sentinel'), 'utf8')).toBe('authored outside\n');
        expect(readdirSync(outside.path)).toStrictEqual(['sentinel']);
    },
);

test('a run replaces an edited cache result', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            [],
            `[guides]\ninstall = false\n[[check]]\nname = "project/storage"\npaths = ["source.txt"]\ninputs = ["source.txt"]\nstage = "commit"\ncommand = ${JSON.stringify([process.execPath, '-e', 'process.exitCode=0'])}\n`,
        ),
        'source.txt': 'input\n',
    });
    const command = ['check', '--json'];
    const initial = await run(sandbox.path, command);
    expect(initial.code, initial.stdout + initial.stderr).toBe(0);
    expect(initial.stderr).toBe('');
    const cached = await run(sandbox.path, command);
    expect(cached.code, cached.stdout + cached.stderr).toBe(0);
    expect((JSON.parse(cached.stdout) as RunReport).checks[0]?.status).toBe('cache');
    const cache = join(sandbox.path, '.gspot/cache', readdirSync(join(sandbox.path, '.gspot/cache'))[0]!);
    writeFileSync(cache, 'edited cache result\n');
    const repeated = await run(sandbox.path, command);
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
    expect((JSON.parse(repeated.stdout) as RunReport).checks[0]?.status).toBe('ok');
    expect(readFileSync(cache, 'utf8')).not.toBe('edited cache result\n');
});
