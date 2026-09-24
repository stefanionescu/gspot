import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { parsePolicyText } from '#cli/policy/read-policy.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const guides = join(root, 'docs/src/content/docs/guides');

describe('documented examples', () => {
    test('complete README and guide policies load through the production policy reader', () => {
        const paths = [
            join(root, 'README.md'),
            ...[...new Bun.Glob('*.md').scanSync({ cwd: guides })].map((path) => join(guides, path)),
        ];
        let selected = 0;
        for (const path of paths) {
            const content = readFileSync(path, 'utf8');
            for (const match of content.matchAll(/```toml\n([\s\S]*?)```/gu)) {
                const source = match[1]!;
                if (!/^version = 1$/mu.test(source)) continue;
                selected += 1;
                expect(parsePolicyText(source, path).version).toBe(1);
            }
        }
        expect(selected).toBeGreaterThan(0);
    });
});

test.each(['', ' '.repeat(3), { file: '' }])(
    'planted cases reject an empty diagnostic expectation before writing: %j',
    async (expected) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nconfigurations = []\n',
            'source.txt': 'original',
        });
        await expect(
            runPlanted(
                sandbox.path,
                {
                    check: 'example/check',
                    files: { 'source.txt': 'changed' },
                    expected,
                },
                {},
            ),
        ).rejects.toThrow('empty diagnostic expectation');
        expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('original');
    },
);

test('the documented custom check reports its defect and accepts its correction', async () => {
    const source = readFileSync(join(guides, 'custom-checks.md'), 'utf8');
    const script = [...source.matchAll(/```typescript\n([\s\S]*?)```/gu)][0]?.[1];
    const policy = [...source.matchAll(/```toml\n([\s\S]*?)```/gu)][0]?.[1];
    const examples = [...source.matchAll(/```text\n([\s\S]*?)```/gu)].map((match) => match[1]!);
    expect(script?.trim()).toBeTruthy();
    expect(policy?.trim()).toBeTruthy();
    expect(examples).toHaveLength(2);
    for (const example of examples) expect(example.trim()).not.toBe('');
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policy!,
        'scripts/check-notes.ts': script!,
        'notes/deploy.txt': examples[0]!,
    });
    const applied = await run(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const args = ['check', '--only', 'project/notes', '--no-cache', '--json'];
    const failed = await run(sandbox.path, args);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(JSON.parse(failed.stdout).checks[0].findings).toMatchObject([
        { check: 'project/notes', file: 'notes/deploy.txt', line: 1, message: examples[0]!.trim() },
    ]);
    await Bun.write(join(sandbox.path, 'notes/deploy.txt'), examples[1]!);
    const corrected = await run(sandbox.path, args);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(JSON.parse(corrected.stdout).checks[0]).toMatchObject({ status: 'ok', findings: [] });
});
