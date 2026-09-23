import { environmentVariables } from '#cli/platform/environment.ts';
import { run } from '#cli/platform/spawn.ts';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';
import { git } from '#tests/support/cli/git.ts';
import { expect, test } from 'bun:test';
import { chmodSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileTree, testdir } from 'testdirs';

const entry = fileURLToPath(new URL('../../../docs/scripts/verify-release.ts', import.meta.url));

test('site release validation accepts a published tag and docs correction but refuses product changes and draft releases', async () => {
    await using sandbox = await testdir();
    await using binaries = await testdir();
    const release = {
        draft: false,
        prerelease: false,
        tag_name: `v${GSPOT_VERSION}`,
        published_at: '2026-09-21T00:00:00Z',
    };
    const response = join(binaries.path, 'release.json');
    await createFileTree(binaries.path, {
        'release.json': JSON.stringify(release),
        gh: `#!${process.execPath}\nprocess.stdout.write(await Bun.file(${JSON.stringify(response)}).text());\n`,
        'gh.ts': `process.stdout.write(await Bun.file(${JSON.stringify(response)}).text());\n`,
        'gh.cmd': `@echo off\r\n"${process.execPath}" "%~dp0gh.ts" %*\r\n`,
    });
    chmodSync(join(binaries.path, 'gh'), 0o755);
    await createFileTree(sandbox.path, { 'product.ts': 'export const version = 1;\n', 'docs/guide.md': '# Example\n' });
    expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
    const commit = () => {
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        expect(
            git(sandbox.path, [
                '-c',
                'user.name=Example',
                '-c',
                'user.email=example@example.com',
                'commit',
                '-qm',
                'Fixture',
            ]).code,
        ).toBe(0);
        return git(sandbox.path, ['rev-parse', 'HEAD']).stdout.trim();
    };
    const base = commit();
    expect(git(sandbox.path, ['tag', `v${GSPOT_VERSION}`]).code).toBe(0);
    const execute = (source: string) =>
        run([process.execPath, entry], {
            cwd: sandbox.path,
            env: {
                PATH: `${binaries.path}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
                GITHUB_REPOSITORY: 'example/project',
                DOCS_RELEASE_TAG: `v${GSPOT_VERSION}`,
                DOCS_SOURCE_REF: source,
            },
            timeoutMs: 30_000,
        });
    const valid = await execute(base);
    expect(valid.code, valid.stderr).toBe(0);
    writeFileSync(join(sandbox.path, 'docs/guide.md'), '# Corrected example\n');
    const correction = commit();
    const corrected = await execute(correction);
    expect(corrected.code).toBe(0);
    const wrongSource = await execute(base);
    expect(wrongSource.code).not.toBe(0);
    writeFileSync(response, JSON.stringify({ ...release, draft: true }));
    const draft = await execute(correction);
    expect(draft.code).not.toBe(0);
    writeFileSync(response, JSON.stringify(release));
    writeFileSync(join(sandbox.path, 'product.ts'), 'export const version = 2;\n');
    const changed = commit();
    const refused = await execute(changed);
    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('Documentation correction changes product inputs: product.ts');
    writeFileSync(join(sandbox.path, 'product.ts'), 'export const version = 1;\n');
    expect(git(sandbox.path, ['mv', 'product.ts', 'docs/product.ts']).code).toBe(0);
    const renamed = await execute(commit());
    expect(renamed.code).not.toBe(0);
    expect(renamed.stderr).toContain('Documentation correction changes product inputs: product.ts');
});
