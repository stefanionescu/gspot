import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { runToolCommand } from '#cli/tools/command.ts';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { packageEnvironment } from '#cli/tools/packages/environment.ts';

test('native registry settings authenticate from an isolated project and preserve authored configuration', async () => {
    await using repository = await testdir();
    await using isolated = await testdir();
    const token = 'synthetic-registry-credential';
    let rejected = 0;
    let authenticated = 0;
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch(request) {
            if (request.headers.get('authorization') !== `Bearer ${token}`) {
                rejected++;
                return Response.json({ error: 'Authentication required' }, { status: 401 });
            }
            authenticated++;
            return Response.json({
                name: 'private-check-tool',
                'dist-tags': { latest: '1.0.0' },
                versions: { '1.0.0': { name: 'private-check-tool', version: '1.0.0' } },
            });
        },
    });
    try {
        const registry = `http://127.0.0.1:${server.port}/`;
        await createFileTree(repository.path, {
            'package.json': '{"private":true}\n',
            '.npmrc': `registry=${registry}\n`,
        });
        await createFileTree(isolated.path, { 'package.json': '{"private":true}\n' });
        const command = [
            'npm',
            'view',
            'private-check-tool',
            'version',
            '--json',
            '--cache',
            join(isolated.path, 'cache'),
        ];
        const missing = await runToolCommand(undefined, command, {
            cwd: isolated.path,
            env: await packageEnvironment(repository.path),
        });
        expect(missing.code).not.toBe(0);
        expect(rejected).toBeGreaterThan(0);
        const source = `registry=${registry}\n//127.0.0.1:${server.port}/:_authToken=${token}\n`;
        writeFileSync(join(repository.path, '.npmrc'), source, { mode: 0o600 });
        const mode = statSync(join(repository.path, '.npmrc')).mode;
        const corrected = await runToolCommand(undefined, command, {
            cwd: isolated.path,
            env: await packageEnvironment(repository.path),
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(JSON.parse(corrected.stdout)).toBe('1.0.0');
        expect(authenticated).toBeGreaterThan(0);
        expect(corrected.stdout + corrected.stderr).not.toContain(token);
        expect(readFileSync(join(repository.path, '.npmrc'), 'utf8')).toBe(source);
        expect(statSync(join(repository.path, '.npmrc')).mode).toBe(mode);
    } finally {
        server.stop(true);
    }
});
