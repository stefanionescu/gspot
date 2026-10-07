import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { registryEnvironment } from '#cli/tools/npm/registry.ts';
import { PACKAGE_FAILURES } from '#tests/config/cli/tools/npm/install.ts';
import { installPackageLock, preparePackageLock } from '#cli/tools/npm/install.ts';

test.each([
    { source: 'registry=not-a-valid-url\n', message: 'Invalid registry URL in package manager configuration.' },
    { source: 'maxsockets=not-a-number\n', message: 'Invalid package manager configuration.' },
])(
    'invalid native settings retain their validation diagnostic for $source',
    async ({ source, message: diagnostic }) => {
        await using repository = await testdir();
        await createFileTree(repository.path, { '.npmrc': source, 'package.json': '{"private":true}\n' });
        expect(await rejection(registryEnvironment(repository.path))).toBe(diagnostic);
        expect(readFileSync(join(repository.path, '.npmrc'), 'utf8')).toBe(source);
    },
);

test.each(PACKAGE_FAILURES)(
    'a package failure preserves files and redacts $refusal with frozen=$frozen',
    async ({ frozen, refusal }) => {
        await using repository = await testdir();
        await using isolated = await testdir();
        const token = 'synthetic-registry-failure-token';
        const password = 'synthetic-registry-password/with spaces';
        const registry = `https://alex:${encodeURIComponent(password)}@registry.example.com/`;
        const source = `registry=${registry}\n//registry.example.com/:_authToken=${token}\n`;
        await createFileTree(repository.path, { '.npmrc': source, 'package.json': '{"private":true}\n' });
        await createFileTree(isolated.path, { 'package.json': '{"private":true}\n', 'bun.lock': 'original lock\n' });
        const run = processes.run;
        const installer = spyOn(processes, 'run').mockImplementation((command, options) => {
            if (command[0] !== 'bun') return run(command, options);
            const version = command[1] === '--version';
            return Promise.resolve({
                code: version ? 0 : 1,
                missing: false,
                duration: 0,
                stdout: version
                    ? '1.4.2\n'
                    : `Downloading https://api.github.com/repos/example/tool/releases\nDownloading ${registry}private-check-tool\n${password}\n${token}`,
                stderr: version ? '' : `${refusal} from ${registry}private-check-tool`,
            });
        });
        try {
            const failure = (frozen ? installPackageLock : preparePackageLock)(repository.path, isolated.path, {
                name: 'bun',
                version: '1.4.2',
            });
            const diagnosticError = await failure.catch((error: unknown) => error);
            expect(diagnosticError).toMatchObject({ name: 'GspotError', code: 'installation' });
            const diagnostic = diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError);
            expect(diagnostic).toContain(
                `bun ${frozen ? 'immutable installation' : 'lock resolution'} failed (exit 1)`,
            );
            expect(diagnostic).toContain(refusal);
            expect(diagnostic).not.toContain('GITHUB_TOKEN');
            expect(diagnostic).toContain('Run: gspot apply, then gspot install');
            for (const credential of [token, password, encodeURIComponent(password)])
                expect(diagnostic).not.toContain(credential);
            expect(readFileSync(join(repository.path, '.npmrc'), 'utf8')).toBe(source);
            expect(readFileSync(join(isolated.path, 'bun.lock'), 'utf8')).toBe('original lock\n');
        } finally {
            installer.mockRestore();
        }
    },
);

test.each([false, true])(
    'a successful native %s operation refuses credentials in its prepared lock',
    async (frozen) => {
        await using repository = await testdir();
        await using isolated = await testdir();
        const token = 'synthetic-generated-lock-token';
        const source = `registry=https://registry.example.com/\n//registry.example.com/:_authToken=${token}\n`;
        await createFileTree(repository.path, { '.npmrc': source, 'package.json': '{"private":true}\n' });
        await createFileTree(isolated.path, { 'package.json': '{"private":true}\n', 'bun.lock': token });
        const run = processes.run;
        using boundary = spyOn(processes, 'run').mockImplementation((command, options) => {
            if (command[0] !== 'bun') return run(command, options);
            return Promise.resolve({
                code: 0,
                missing: false,
                duration: 0,
                stdout: command[1] === '--version' ? '1.4.2\n' : '',
                stderr: '',
            });
        });
        const diagnostic = await rejection(
            (frozen ? installPackageLock : preparePackageLock)(repository.path, isolated.path, {
                name: 'bun',
                version: '1.4.2',
            }),
        );
        expect(diagnostic).toBe(
            'The package manager included registry credentials in its lock. Existing files were preserved.',
        );
        expect(diagnostic).not.toContain(token);
        expect(readFileSync(join(repository.path, '.npmrc'), 'utf8')).toBe(source);
        expect(readFileSync(join(isolated.path, 'bun.lock'), 'utf8')).toBe(token);
        expect(boundary).toHaveBeenCalled();
    },
);
