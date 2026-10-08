import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/harness/expectations.ts';
import { registryEnvironment } from '#cli/tools/npm/registry.ts';

test.each([
    { source: 'registry=not-a-valid-url\n', message: 'Invalid registry URL in package manager configuration.' },
    { source: 'maxsockets=not-a-number\n', message: 'Invalid package manager configuration.' },
])(
    'invalid native settings retain their validation diagnostic for $source',
    async ({ source, message: diagnostic }) => {
        await using repository = await testdir();
        await createFileTree(repository.path, { '.npmrc': source, 'package.json': '{"private":true}\n' });
        expect(await rejection(registryEnvironment(repository.path))).toBe(diagnostic);
        expect(await readFile(join(repository.path, '.npmrc'), 'utf8')).toBe(source);
    },
);
