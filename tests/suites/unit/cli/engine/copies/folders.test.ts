import * as fs from 'node:fs';
import { existsSync, readFileSync } from 'node:fs';
import { symlink } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import { testdir } from 'testdirs';

import { createCopyFolder } from '#cli/engine/copies/folders.ts';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { isWindows } from '#tests/setup/system/platform.ts';

test('the ignore file of the copies stays until every check of a run ends', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'run.sh': '#!/usr/bin/env bash\n',
    });
    const ignoreFile = join(sandbox.path, '.gspot-copies/.gitignore');
    let isHeld = false;
    await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({
            only: ['bash/safety'],
            selectCheckCode: () => ({
                check: () => {
                    createCopyFolder(sandbox.path)[Symbol.dispose]();
                    isHeld = existsSync(ignoreFile);
                    return [];
                },
            }),
        }),
    );
    expect(isHeld).toBe(true);
    expect(existsSync(ignoreFile)).toBe(false);
});

test('a run with no check copy writes nothing to the repository', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'run.sh': '#!/usr/bin/env bash\n',
    });
    const session = await openSession(sandbox.path);
    using _refused = spyOn(fs, 'mkdirSync').mockImplementation(() => {
        throw Object.assign(new Error('Read-only file system'), { code: 'EROFS' });
    });
    const { report } = await runChecks(
        session,
        buildRunOptions({ only: ['bash/safety'], selectCheckCode: () => ({ check: () => [] }) }),
    );
    expect(report.exitCode).toBe(0);
});

test('copies stay ignored until the last copy removes their shared folder', async () => {
    await using sandbox = await testdir({ 'source.txt': 'authored\n' });
    commitAll(sandbox.path);
    const first = createCopyFolder(sandbox.path);
    const second = createCopyFolder(sandbox.path);
    const folder = join(sandbox.path, '.gspot-copies');
    expect(readFileSync(join(folder, '.gitignore'), 'utf8')).toBe('*\n');
    expect(runGitStep(sandbox.path, ['status', '--porcelain'])).toBe('');
    first[Symbol.dispose]();
    expect(existsSync(first.path)).toBe(false);
    expect(existsSync(second.path)).toBe(true);
    second[Symbol.dispose]();
    expect(existsSync(folder)).toBe(false);
    expect(readFileSync(join(sandbox.path, 'source.txt'), 'utf8')).toBe('authored\n');
});

test('a new copy removes exited owners and keeps live owners and unknown folders', async () => {
    const exited = 12_345;
    await using sandbox = await testdir({
        [`.gspot-copies/${String(exited)}-abandoned/source.txt`]: 'old copy',
        [`.gspot-copies/${String(process.pid)}-active/source.txt`]: 'active copy',
        '.gspot-copies/notes/source.txt': 'unowned',
        '.gspot-copies/999999999999999999999-invalid/source.txt': 'invalid owner',
    });
    using _processes = spyOn(process, 'kill').mockImplementation((pid) => {
        if (pid === exited) throw Object.assign(new Error('The process exited.'), { code: 'ESRCH' });
        return true;
    });
    using _copy = createCopyFolder(sandbox.path);
    const abandoned = join(sandbox.path, `.gspot-copies/${String(exited)}-abandoned`);
    const active = join(sandbox.path, `.gspot-copies/${String(process.pid)}-active/source.txt`);
    expect(existsSync(abandoned)).toBe(false);
    expect(existsSync(active)).toBe(true);
    expect(readFileSync(join(sandbox.path, '.gspot-copies/notes/source.txt'), 'utf8')).toBe('unowned');
});

test('a copy survives another check removing its parent during creation', async () => {
    await using sandbox = await testdir();
    const previous = createCopyFolder(sandbox.path);
    const create = fs.mkdtempSync;
    let isRemoved = false;
    using _creation = spyOn(fs, 'mkdtempSync').mockImplementation(
        new Proxy(create, {
            apply(target, receiver, args) {
                if (!isRemoved) {
                    isRemoved = true;
                    previous[Symbol.dispose]();
                }
                return Reflect.apply(target, receiver, args) as string | Buffer;
            },
        }),
    );
    const copy = createCopyFolder(sandbox.path);
    expect(existsSync(copy.path)).toBe(true);
    copy[Symbol.dispose]();
});

test('a failed copy setup removes its private folder', async () => {
    await using sandbox = await testdir();
    const rename = fs.renameSync;
    using _writes = spyOn(fs, 'renameSync').mockImplementation((source, destination) => {
        if (String(destination).includes('.gspot-copies'))
            throw Object.assign(new Error('The disk is full.'), { code: 'ENOSPC' });
        rename(source, destination);
    });
    expect(() => createCopyFolder(sandbox.path)).toThrow(matchFields<NodeJS.ErrnoException>({ code: 'ENOSPC' }));
    expect(existsSync(join(sandbox.path, '.gspot-copies'))).toBe(false);
});

test.skipIf(isWindows)('a linked copy folder cannot write outside the repository', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir({ 'source.txt': 'external\n' });
    await symlink(outside.path, join(sandbox.path, '.gspot-copies'), 'dir');
    expect(() => createCopyFolder(sandbox.path)).toThrow();
    expect(existsSync(join(outside.path, '.gitignore'))).toBe(false);
});
