import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { IGNORED_CHECK_FILES, NESTED_PYTHON_SETTINGS } from '#tests/config/generation/configs.ts';

test('a child project receives Python configuration only after its first Python file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], { scopes: [{ path: 'docs' }] }),
        'docs/README.md': '# Guide\n',
    });
    const root = getManifestTarget('python', 'ruff.toml');
    const before = buildGeneratedFiles(await openSession(sandbox.path)).files.map(({ path }) => path);
    expect(before).toContain(root);
    expect(before).not.toContain('docs/ruff.toml');
    expect(before.some((path) => path.includes('/scopes/docs/'))).toBe(false);
    await writeFile(join(sandbox.path, 'docs/example.py'), 'VALUE = 1\n');
    const after = buildGeneratedFiles(await openSession(sandbox.path)).files.map(({ path }) => path);
    expect(after).toContain('docs/ruff.toml');
    expect(after).toContain(
        getManifestTarget('python', 'basedpyright.json').replace(
            '/basedpyright.json',
            '/scopes/docs/basedpyright.json',
        ),
    );
});

test('a Ruff-only Python scope gets no type checker file or pointer file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], NESTED_PYTHON_SETTINGS),
        'linted/source.py': 'value = 1\n',
        'typed/source.py': 'value: int = 1\n',
    });

    const paths = buildGeneratedFiles(await openSession(sandbox.path)).files.map((file) => file.path);
    expect(paths.filter((path) => /ruff\.toml|pyright/u.test(path))).toStrictEqual([
        '.gspot/configurations/python/basedpyright.json',
        '.gspot/configurations/python/ruff.toml',
        'linted/ruff.toml',
        'typed/pyrightconfig.json',
        'typed/ruff.toml',
    ]);
});

test('a TypeScript-only scope gets the config files of its selected JavaScript checks', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'src/main.ts': 'export const value = 1;\n',
    });

    const session = await openSession(sandbox.path);
    const paths = buildGeneratedFiles(session).files.map((file) => file.path);
    const kept = [getManifestTarget('javascript', 'jsconfig.json'), getManifestTarget('javascript', 'knip.json')];
    expect(paths.filter((path) => kept.includes(path))).toStrictEqual(kept);
});

test.each([...IGNORED_CHECK_FILES])(
    '$name and drops the files of the ignored checks',
    async ({ settings, files, kept, dropped }) => {
        await using sandbox = await createGitSandbox({ 'gspot.toml': settings, ...files });

        const paths = buildGeneratedFiles(await openSession(sandbox.path)).files.map((file) => file.path);
        const listed = new Set<string>([...kept, ...dropped]);
        expect(paths.filter((path) => listed.has(path))).toStrictEqual([...kept]);
    },
);
