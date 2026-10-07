// A .gspot folder that links outside the repository is refused before gspot writes into it.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { readdirSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

test('a linked .gspot folder is refused without changing outside bytes', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], {
            tables: `[[check]]\nname = "project/storage"\npaths = ["source.txt"]\nstage = "commit"\ncommand = ${JSON.stringify([process.execPath, '-e', 'console.log("Exact finding"); process.exitCode=1'])}\n[check.output]\nformat = "lines"\n`,
        }),
        'source.txt': 'input\n',
    });
    writeFileSync(join(outside.path, 'sentinel'), 'authored outside\n');
    symlinkSync(outside.path, join(sandbox.path, '.gspot'));
    const result = await runGspot(sandbox.path, ['check', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect((JSON.parse(result.stdout) as CommandFailureJson).message).toContain('Unsafe lifecycle parent');
    expect(readFileSync(join(outside.path, 'sentinel'), 'utf8')).toBe('authored outside\n');
    expect(readdirSync(outside.path)).toStrictEqual(['sentinel']);
});
