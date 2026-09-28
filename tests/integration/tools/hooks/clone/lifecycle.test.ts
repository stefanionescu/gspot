import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { testdir, createFileTree } from 'testdirs';
import { installHookClone, prepareHookClone } from '#tests/support/cli/hooks/clone.ts';
import { readHookStatus, installHookTool } from '#tests/support/cli/hooks/projects.ts';
import { chmodSync, existsSync, unlinkSync, readFileSync, writeFileSync } from 'node:fs';

test('edited cloned integrations refuse install and apply until restored', async () => {
    await using repository = await testdir();
    await using clone = await testdir();
    const project = await prepareHookClone(repository.path, clone.path, 'simple-git-hooks');
    const { main, clonePath } = project;
    const path = join(clonePath, '.gspot/integrations/simple-git-hooks/pre-commit');
    const original = readFileSync(path);
    writeFileSync(path, '#!/bin/sh\nexit 0\n');
    const refused = await run([process.execPath, main, 'install'], { cwd: clonePath, timeoutMs: 60_000 });
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('integration is missing or edited');
    expect(existsSync(join(clonePath, '.git/hooks/pre-commit'))).toBe(false);
    const refusedApply = await run([process.execPath, main, 'apply'], { cwd: clonePath, timeoutMs: 60_000 });
    expect(refusedApply.code, refusedApply.stdout + refusedApply.stderr).toBe(2);
    expect(readFileSync(path, 'utf8')).toBe('#!/bin/sh\nexit 0\n');
    const retained = await run(['git', 'status', '--porcelain'], { cwd: clonePath });
    expect(retained.stdout).toBe(' M .gspot/integrations/simple-git-hooks/pre-commit\n');
    writeFileSync(path, original);
    const installed = await installHookClone(project);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(await readHookStatus(clonePath)).toMatchObject({ ready: true });
}, 90_000);

test('cloned runner switches refuse edited originals and restore clean dispatch after correction', async () => {
    await using repository = await testdir();
    await using clone = await testdir();
    const project = await prepareHookClone(repository.path, clone.path, 'simple-git-hooks');
    const { main, options, clonePath } = project;
    expect(await installHookClone(project)).toMatchObject({ code: 0 });
    expect(await run([process.execPath, main, 'apply'], options)).toMatchObject({ code: 0 });
    await using launcher = await testdir();
    await createFileTree(launcher.path, {
        gspot: `#!${process.execPath}\nawait Bun.write('runner-observed', JSON.stringify(process.argv.slice(2)));\n`,
    });
    chmodSync(join(launcher.path, 'gspot'), 0o755);
    const policy = readFileSync(join(clonePath, 'gspot.toml'));
    const originalPath = join(clonePath, '.gspot/integrations/simple-git-hooks/pre-commit.gspot-original');
    const original = readFileSync(originalPath);
    writeFileSync(join(clonePath, 'gspot.toml'), policy.toString('utf8') + '\n[runner]\ntool = "bun"\n');
    writeFileSync(originalPath, '#!/bin/sh\nexit 0\n');
    const edited = await run([process.execPath, main, 'apply'], options);
    expect({ status: edited.code, original: readFileSync(originalPath, 'utf8') }).toStrictEqual({
        status: 2,
        original: '#!/bin/sh\nexit 0\n',
    });
    writeFileSync(originalPath, original);
    expect({
        applied: await run([process.execPath, main, 'apply'], options),
        readiness: await readHookStatus(clonePath),
    }).toMatchObject({ applied: { code: 0 }, readiness: { ready: false } });
    await installHookTool(clonePath);
    expect(await readHookStatus(clonePath)).toMatchObject({ ready: true });
    const dispatched = await run(['bash', '.gspot/integrations/simple-git-hooks/pre-commit'], {
        ...options,
        env: { PATH: `${launcher.path}${delimiter}${options.env['PATH']}` },
    });
    expect({
        status: dispatched.code,
        args: JSON.parse(readFileSync(join(clonePath, 'runner-observed'), 'utf8')) as unknown,
        original: readFileSync(originalPath),
    }).toStrictEqual({ status: 0, args: ['check', '--staged'], original });
    unlinkSync(join(clonePath, 'runner-observed'));
    writeFileSync(join(clonePath, 'gspot.toml'), policy);
    expect({
        applied: await run([process.execPath, main, 'apply'], options),
        readiness: await readHookStatus(clonePath),
    }).toMatchObject({ applied: { code: 0 }, readiness: { ready: false } });
    await installHookTool(clonePath);
    expect(await readHookStatus(clonePath)).toMatchObject({ ready: true });
    expect(await run(['git', 'status', '--porcelain'], options)).toMatchObject({ code: 0, stdout: '' });
}, 90_000);
