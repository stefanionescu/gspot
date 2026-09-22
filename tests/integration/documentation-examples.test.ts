import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { parsePolicyText } from '#cli/policy/read-policy.ts';
import { run } from '#tests/harness/planted.ts';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';
import example from '../../docs/src/components/bash-syntax.json';

const root = fileURLToPath(new URL('../..', import.meta.url));
const guides = join(root, 'docs/src/content/docs/guides');

describe('documented examples', () => {
    test('complete README and guide policies load through the production policy reader', () => {
        const paths = [
            join(root, 'README.md'),
            ...[...new Bun.Glob('*.md').scanSync({ cwd: guides })].map((path) => join(guides, path)),
        ];
        for (const path of paths) {
            const content = readFileSync(path, 'utf8');
            for (const match of content.matchAll(/```toml\n([\s\S]*?)```/gu)) {
                const source = match[1]!;
                if (!/^version = 1$/mu.test(source)) continue;
                expect(parsePolicyText(source, path).version).toBe(1);
            }
        }
    });

    test('the published syntax example produces the captured finding and accepts its correction', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\npresets = ["bash"]\n',
            '.gspot/version': `${GSPOT_VERSION}\n`,
            'greet.sh': example.broken,
        });
        const args = ['check', '--only', 'bash/syntax', '--no-cache'];
        const failed = await run(sandbox.path, args);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        for (const line of example.failed.split('\n').filter((line) => /^\s+(?:greet.sh|help:)/u.test(line))) {
            expect(failed.stdout).toContain(line);
        }
        await Bun.write(join(sandbox.path, 'greet.sh'), example.corrected);
        const corrected = await run(sandbox.path, args);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.stdout).toContain('passed: 1 check');
        expect(corrected.stdout).not.toContain('failed:');
    });
});
