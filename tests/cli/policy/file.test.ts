import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { valueAt } from '#cli/platform/contracts.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { hasPolicy, readPolicy } from '#cli/policy/public.ts';
import { localDateSchema } from '#cli/policy/schema/contracts.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import type { PreparedPolicy } from '#cli/types/policy/settings.ts';
import { readTree, pathExists } from '#tests/harness/preservation.ts';
import { setKey, editPolicy, preparePolicy } from '#cli/policy/document/contracts.ts';
import { link, open, stat, chmod, symlink, readFile, writeFile } from 'node:fs/promises';

import {
    AUTHORED_POLICY,
    POLICY_FILE_CASES,
    NATIVE_EDIT_POLICY,
    EMPTY_PROJECT_POLICY,
} from '#tests/config/cli/policy/file.ts';
import {
    emitPolicy,
    parseTomlText,
    readPolicyFile,
    parsePolicyEdit,
    writePolicyFile,
} from '#cli/policy/document/public.ts';

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

/** Prepare an edit with the captured file required by the native publication boundary. */
function proposeEdit(root: string): PreparedPolicy {
    const input = preparePolicy(root);
    return {
        ...editPolicy(root, input, (raw) => {
            setKey(raw, 'level', 'all');
        }),
        original: input.original,
    };
}

const refusesBytes = async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    const invalid = Buffer.concat([Buffer.from(AUTHORED_POLICY), Buffer.from([0xff])]);
    await writeFile(path, invalid);
    expect(() => {
        const plan = proposeEdit(sandbox.path);
        using log = openOwnership(sandbox.path);
        writePolicyFile({
            text: plan.text,
            original: plan.original,
            publish: (next, expected) => {
                log.files.write('gspot.toml', next, expected);
            },
        });
    }).toThrow('valid UTF-8');
    expect(() => readPolicyFile(sandbox.path)).toThrow('gspot.toml must contain valid UTF-8 text.');
    expect(await readFile(path)).toStrictEqual(invalid);
};

const refusesMode = async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, AUTHORED_POLICY);
    await chmod(path, 0o644);
    const plan = proposeEdit(sandbox.path);
    await chmod(path, 0o444);
    using log = openOwnership(sandbox.path);
    const before = await readTree(sandbox.path);
    expect(() => {
        writePolicyFile({
            text: plan.text,
            original: plan.original,
            publish: (next, expected) => {
                log.files.write('gspot.toml', next, expected);
            },
        });
    }).toThrow('Lifecycle destination changed during the operation: gspot.toml');
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
    const plan = proposeEdit(sandbox.path);
    await writeFile(path, `${AUTHORED_POLICY}\n# Concurrent edit.\n`);
    {
        using log = openOwnership(sandbox.path);
        const before = await readTree(sandbox.path);
        expect(() => {
            writePolicyFile({
                text: plan.text,
                original: plan.original,
                publish: (next, expected) => {
                    log.files.write('gspot.toml', next, expected);
                },
            });
        }).toThrow('Lifecycle destination changed during the operation: gspot.toml');
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    }
    expect(await readFile(path, 'utf8')).toBe(`${AUTHORED_POLICY}\n# Concurrent edit.\n`);
    const corrected = proposeEdit(sandbox.path);
    {
        using log = openOwnership(sandbox.path);
        writePolicyFile({
            text: corrected.text,
            original: corrected.original,
            publish: (next, expected) => {
                log.files.write('gspot.toml', next, expected);
            },
        });
        expect(corrected.policy.level).toBe('all');
    }
    expect(await readFile(path, 'utf8')).toBe(corrected.text);
});

test('policy reads and edits reject a missing file without creating one', async () => {
    await using sandbox = await testdir();
    expect(() => readPolicyFile(sandbox.path)).toThrow('There is no gspot.toml here. Run `gspot init` to create one.');
    expect(() => preparePolicy(sandbox.path)).toThrow('There is no gspot.toml here. Run `gspot init` to create one.');
    expect(await readTree(sandbox.path)).toStrictEqual({});
});

test('an unchanged policy does not publish or change its native identity', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await writeFile(path, AUTHORED_POLICY);
    const input = preparePolicy(sandbox.path);
    const before = await stat(path);
    using log = openOwnership(sandbox.path);
    writePolicyFile({
        text: input.text,
        original: input.original,
        publish: (next, expected) => {
            log.files.write('gspot.toml', next, expected);
        },
    });
    const after = await stat(path);
    expect(await readFile(path, 'utf8')).toBe(AUTHORED_POLICY);
    expect(after.ino).toBe(before.ino);
    expect(after.mtimeMs).toBe(before.mtimeMs);
    expect(after.mode).toBe(before.mode);
});

test('policy inspection accepts linked authored text inside the root while edits preserve its target', async () => {
    await using sandbox = await testdir();
    const policy = buildPolicy(['markdown']);
    await createFileTree(sandbox.path, { 'settings/policy.toml': policy });
    await symlink('settings/policy.toml', join(sandbox.path, 'gspot.toml'));
    expect(hasPolicy(sandbox.path)).toBe(true);
    expect(readPolicy(sandbox.path).text).toBe(policy);
    expect(() =>
        editPolicy(sandbox.path, preparePolicy(sandbox.path), (raw) => {
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
    await using file = await open(path, 'r');
    await using authored = await open(original, 'r');
    const attributes = await file.stat();
    expect(attributes.nlink).toBe(2);
    expect(hasPolicy(sandbox.path)).toBe(true);
    expect(readPolicy(sandbox.path).text).toBe(policy);
    let evaluated = false;
    expect(() =>
        editPolicy(sandbox.path, preparePolicy(sandbox.path), () => {
            evaluated = true;
        }),
    ).toThrow('private regular file');
    expect(evaluated).toBe(false);
    expect(await file.readFile('utf8')).toBe(policy);
    expect(await authored.readFile('utf8')).toBe(policy);
    expect(await pathExists(join(sandbox.path, '.gspot'))).toBe(false);
});

test('canonical writes retain an explicitly empty project path', () => {
    const authored = parseTomlText(EMPTY_PROJECT_POLICY, 'gspot.toml', 'policy');
    const output = emitPolicy(EMPTY_PROJECT_POLICY, authored);
    const written = parseTomlText(output, 'gspot.toml', 'policy');
    expect(written['swift']).toStrictEqual({ xcode_project: '' });
    expect(emitPolicy(output, written)).toBe(output);
});

test('an in-place native expiry mutation changes the captured policy and retains its comment', () => {
    const input = parsePolicyEdit(NATIVE_EDIT_POLICY);
    const until = localDateSchema.parse(valueAt(input.table, ['ignore', 0, 'until']));
    const original = input.values;
    const proposed = editPolicy('.', input, () => {
        until.setUTCDate(21);
    });
    expect(proposed.changed).toBe(true);
    expect(proposed.text).toContain('# Keep the authored expiry.');
    expect(proposed.text).toContain('until = 2099-05-21');
    expect(proposed.policy.ignore[0]?.until?.toISOString()).toBe('2099-05-21');
    expect(input.values).toBe(original);
});

test('reordering native table keys leaves the captured text unchanged', () => {
    const input = parsePolicyEdit(NATIVE_EDIT_POLICY);
    const proposed = editPolicy('.', input, (raw) => {
        const configurations = raw['configurations'];
        Reflect.deleteProperty(raw, 'configurations');
        raw['configurations'] = configurations;
    });
    expect(proposed.changed).toBe(false);
    expect(proposed.text).toBe(NATIVE_EDIT_POLICY);
    expect(proposed.policy.ignore[0]?.until?.toISOString()).toBe('2099-05-20');
});
