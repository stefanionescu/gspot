import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { hasPolicy, readPolicy } from '#cli/policy/read.ts';
import { setKey, preparePolicy } from '#cli/policy/edit.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { readTree, pathExists } from '#tests/harness/preservation.ts';
import { emitPolicy, parseTomlText, writePolicyFile } from '#cli/policy/file.ts';
import { link, stat, chmod, symlink, readFile, writeFile } from 'node:fs/promises';
import { AUTHORED_POLICY, POLICY_FILE_CASES, EMPTY_PROJECT_POLICY } from '#tests/config/cli/policy/file.ts';

test.each(POLICY_FILE_CASES)(
    '$name keeps canonical values and comments through repeated writes',
    ({ source, target, expected }) => {
        const authored = parseTomlText(target, 'target.toml', 'policy');
        const output = emitPolicy(source, authored);
        const written = parseTomlText(output, 'gspot.toml', 'policy');
        expect(output).toBe(expected);
        expect(emitPolicy(output, written)).toBe(expected);
    },
);

const refusesBytes = async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    const invalid = Buffer.concat([Buffer.from(AUTHORED_POLICY), Buffer.from([0xff])]);
    await writeFile(path, invalid);
    expect(() => {
        const plan = preparePolicy(sandbox.path, (raw) => {
            setKey(raw, 'level', 'all');
        });
        using log = openOwnership(sandbox.path);
        writePolicyFile({
            files: log.files,
            text: plan.text,
            original: plan.original,
            publish: (next, expected) => {
                log.files.write('gspot.toml', next, expected);
            },
        });
    }).toThrow('valid UTF-8');
    expect(await readFile(path)).toStrictEqual(invalid);
};

const refusesMode = async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, AUTHORED_POLICY);
    await chmod(path, 0o644);
    const plan = preparePolicy(sandbox.path, (raw) => {
        setKey(raw, 'level', 'all');
    });
    await chmod(path, 0o444);
    using log = openOwnership(sandbox.path);
    const before = await readTree(sandbox.path);
    expect(() => {
        writePolicyFile({
            files: log.files,
            text: plan.text,
            original: plan.original,
            publish: (next, expected) => {
                log.files.write('gspot.toml', next, expected);
            },
        });
    }).toThrow('The gspot.toml file changed while gspot was running. Run the command again.');
    expect(await readFile(path, 'utf8')).toBe(AUTHORED_POLICY);
    const attributes = await stat(path);
    expect(attributes.mode & 0o222).toBe(0);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    await chmod(path, 0o644);
};

describe('writePolicyFile', () => {
    test('policy edits retain invalid UTF-8 bytes', refusesBytes);
    test('policy edits refuse a mode change after read', refusesMode);
});

test('a prepared policy edit refuses stale bytes and accepts a fresh plan', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, AUTHORED_POLICY);
    const plan = preparePolicy(sandbox.path, (raw) => {
        setKey(raw, 'level', 'all');
    });
    await writeFile(path, `${AUTHORED_POLICY}\n# Concurrent edit.\n`);
    {
        using log = openOwnership(sandbox.path);
        const before = await readTree(sandbox.path);
        expect(() => {
            writePolicyFile({
                files: log.files,
                text: plan.text,
                original: plan.original,
                publish: (next, expected) => {
                    log.files.write('gspot.toml', next, expected);
                },
            });
        }).toThrow('The gspot.toml file changed while gspot was running. Run the command again.');
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    }
    expect(await readFile(path, 'utf8')).toBe(`${AUTHORED_POLICY}\n# Concurrent edit.\n`);
    const corrected = preparePolicy(sandbox.path, (raw) => {
        setKey(raw, 'level', 'all');
    });
    {
        const plan = corrected;
        using log = openOwnership(sandbox.path);
        writePolicyFile({
            files: log.files,
            text: plan.text,
            original: plan.original,
            publish: (next, expected) => {
                log.files.write('gspot.toml', next, expected);
            },
        });
        expect(plan.policy.level).toBe('all');
    }
    expect(await readFile(path, 'utf8')).toBe(corrected.text);
});

test('policy inspection accepts linked authored text inside the root while edits preserve its target', async () => {
    await using sandbox = await testdir();
    const policy = buildPolicy(['markdown']);
    await createFileTree(sandbox.path, { 'settings/policy.toml': policy });
    await symlink('settings/policy.toml', join(sandbox.path, 'gspot.toml'));
    expect(hasPolicy(sandbox.path)).toBe(true);
    expect(readPolicy(sandbox.path).text).toBe(policy);
    expect(() =>
        preparePolicy(sandbox.path, (raw) => {
            setKey(raw, 'level', 'all');
        }),
    ).toThrow('private regular file');
    expect(await readFile(join(sandbox.path, 'settings/policy.toml'), 'utf8')).toBe(policy);
});

test('policy inspection accepts hardlinked authored text while edits preserve both names', async () => {
    await using sandbox = await testdir();
    const policy = buildPolicy(['markdown']);
    await createFileTree(sandbox.path, { 'settings/policy.toml': policy });
    const original = join(sandbox.path, 'settings/policy.toml');
    const path = join(sandbox.path, 'gspot.toml');
    await link(original, path);
    const attributes = await stat(path);
    expect(attributes.nlink).toBe(2);
    expect(hasPolicy(sandbox.path)).toBe(true);
    expect(readPolicy(sandbox.path).text).toBe(policy);
    let evaluated = false;
    expect(() =>
        preparePolicy(sandbox.path, () => {
            evaluated = true;
        }),
    ).toThrow('private regular file');
    expect(evaluated).toBe(false);
    expect(await readFile(original, 'utf8')).toBe(policy);
    expect(await readFile(path, 'utf8')).toBe(policy);
    expect(await pathExists(join(sandbox.path, '.gspot'))).toBe(false);
});

test('canonical writes retain an explicitly empty project path', () => {
    const authored = parseTomlText(EMPTY_PROJECT_POLICY, 'gspot.toml', 'policy');
    const output = emitPolicy(EMPTY_PROJECT_POLICY, authored);
    const written = parseTomlText(output, 'gspot.toml', 'policy');
    expect(written['swift']).toStrictEqual({ xcode_project: '' });
    expect(emitPolicy(output, written)).toBe(output);
});
