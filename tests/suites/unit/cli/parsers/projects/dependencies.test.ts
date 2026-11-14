import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { SWIFT_DEPENDENCY_CALLS } from '#tests/config/parsers/formats.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readPackageJson, DEPENDENCY_FILE_PARSERS } from '#cli/parsers/projects/dependencies.ts';

const PACKAGE_FIELDS = {
    name: 'example-package',
    dependencies: { next: '16.0.0' },
    'simple-git-hooks': null,
    customSettings: { enabled: true },
} as const;

test('Swift dependencies include package calls and exclude comments, strings, local paths, and binary targets', async () => {
    const parsed = await DEPENDENCY_FILE_PARSERS.get('Package.swift')!('Package.swift', SWIFT_DEPENDENCY_CALLS);
    expect(parsed.dependencies).toStrictEqual({ live: 'https://example.com/live.git' });
    expect(parsed.installed).toStrictEqual(parsed.dependencies);
});

test('Python dependency groups with includes keep every dependency', async () => {
    const text = '[dependency-groups]\ntest = ["pytest>=8"]\ndev = [{include-group = "test"}, "ruff>=1"]\n';
    const parsed = await DEPENDENCY_FILE_PARSERS.get('pyproject.toml')!('pyproject.toml', text);
    expect(parsed.dependencies).toStrictEqual({ pytest: 'pytest>=8', ruff: 'ruff>=1' });
});

test('a pytest table counts as a pytest dependency', async () => {
    const text = '[tool.pytest.ini_options]\ntestpaths = ["tests"]\n';
    const parsed = await DEPENDENCY_FILE_PARSERS.get('pyproject.toml')!('pyproject.toml', text);
    expect(parsed.dependencies).toStrictEqual({ pytest: 'tool.pytest' });
});

test('optional runtime dependencies remain installed beside development tools', async () => {
    const text = '{"devDependencies":{"eslint":"9.0.0"},"optionalDependencies":{"react":"19.0.0"}}';
    const parsed = await DEPENDENCY_FILE_PARSERS.get('package.json')!('package.json', text);
    expect(parsed.installed).toStrictEqual({ eslint: '9.0.0', react: '19.0.0' });
});

test('package.json reads keep your own fields and tell a missing file from invalid data', async () => {
    await using sandbox = await createGitSandbox({});
    expect(readPackageJson(sandbox.path, 'package.json')).toBeUndefined();
    const source = JSON.stringify(PACKAGE_FIELDS);
    await createFileTree(sandbox.path, { 'package.json': source });
    expect(readPackageJson(sandbox.path, 'package.json')).toStrictEqual(PACKAGE_FIELDS);
    await writeFile(join(sandbox.path, 'package.json'), '{');
    expect(() => readPackageJson(sandbox.path, 'package.json')).toThrow(
        matchFields<GspotError>({ name: 'GspotError', code: 'parse' }),
    );
    await writeFile(join(sandbox.path, 'package.json'), '{"dependencies":{"next":16}}');
    expect(() => readPackageJson(sandbox.path, 'package.json')).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'parse',
            message: expect.stringContaining('dependencies.next') as string,
        }),
    );
});
