import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { createFileTree, testdir } from 'testdirs';
import { existsSync, readFileSync, symlinkSync, unlinkSync } from 'node:fs';

test('the Bash port example accepts decimal values and rejects syntax and range errors', async () => {
    const source = readFileSync(
        new URL('../../../../packages/cli/rules/language/bash/LANGUAGE.md', import.meta.url),
        'utf8',
    );
    const snippet = [...source.matchAll(/```bash\n([\s\S]*?)```/gu)]
        .map((match) => match[1]!)
        .find((block) => block.includes('port must be numeric'));
    expect(snippet).toBeDefined();
    await using sandbox = await testdir();
    for (const [port, status] of [
        ['00080', 0],
        ['08', 0],
        ['65535', 0],
        ['0', 1],
        ['65536', 1],
        ['123456', 1],
        ['$(touch injected)', 1],
    ] as const) {
        const outcome = await run(
            ['bash', '-c', `validate() { local port="$1";\n${snippet!}\n}\nvalidate "$1"`, 'fixture', port],
            { cwd: sandbox.path },
        );
        expect(outcome.code, outcome.stderr).toBe(status);
    }
    expect(existsSync(join(sandbox.path, 'injected'))).toBe(false);
});

test('the Bash deletion example confines removal to an approved direct build directory', async () => {
    const source = readFileSync(
        new URL('../../../../packages/cli/rules/language/bash/SAFETY.md', import.meta.url),
        'utf8',
    );
    const snippet = [...source.matchAll(/```bash\n([\s\S]*?)```/gu)]
        .map((match) => match[1]!)
        .find((block) => block.includes('remove_build_dir()'));
    expect(snippet).toBeDefined();
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'owned/keep.txt': 'preserved', 'outside/keep.txt': 'outside' });
    const owner = join(sandbox.path, 'owned');
    symlinkSync('../outside', join(owner, 'build'));
    const script = `${snippet!}\nremove_build_dir "$1"`;
    for (const path of ['', '/', owner]) {
        const refused = await run(['bash', '-c', script, 'fixture', path], { cwd: sandbox.path });
        expect(refused.code).toBe(1);
    }
    unlinkSync(join(owner, 'build'));
    await createFileTree(owner, { 'build/output.txt': 'generated' });
    const removed = await run(['bash', '-c', script, 'fixture', owner], { cwd: sandbox.path });
    expect(removed.code, removed.stderr).toBe(0);
    expect(existsSync(join(owner, 'build'))).toBe(false);
    expect(readFileSync(join(owner, 'keep.txt'), 'utf8')).toBe('preserved');
    expect(readFileSync(join(sandbox.path, 'outside/keep.txt'), 'utf8')).toBe('outside');
});
