import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { hasPolicy, readPolicy } from '#cli/policy/read.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { AUTHORED_POLICY } from '#tests/config/cli/policy/write.ts';
import { setKey, addToList, deleteKey, getScopeTable } from '#cli/policy/edit.ts';
import { writePolicy, commitPolicy, preparePolicy } from '#cli/commands/policy-edit.ts';
import { statSync, chmodSync, existsSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

test('writePolicy > policy edits retain invalid UTF-8 bytes and refuse a mode change after read', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    const invalid = Buffer.concat([Buffer.from(AUTHORED_POLICY), Buffer.from([0xff])]);
    writeFileSync(path, invalid);
    expect(() => {
        const plan = preparePolicy(sandbox.path, (raw) => {
            setKey(raw, 'level', 'all');
        });
        using log = openOwnership(sandbox.path);
        return writePolicy(log, plan);
    }).toThrow('valid UTF-8');
    expect(readFileSync(path)).toStrictEqual(invalid);
    writeFileSync(path, AUTHORED_POLICY);
    chmodSync(path, 0o644);
    expect(() => {
        const plan = preparePolicy(sandbox.path, (raw) => {
            setKey(raw, 'level', 'all');
            chmodSync(path, 0o444);
        });
        using log = openOwnership(sandbox.path);
        return writePolicy(log, plan);
    }).toThrow('The gspot.toml file changed while gspot was running.');
    expect(readFileSync(path, 'utf8')).toBe(AUTHORED_POLICY);
    expect(statSync(path).mode & 0o222).toBe(0);
    chmodSync(path, 0o644);
});

test('preparePolicy rejects an external symlink before evaluating its mutation', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'project/.keep': '', 'outside.toml': AUTHORED_POLICY });
    const root = join(sandbox.path, 'project');
    symlinkSync('../outside.toml', join(root, 'gspot.toml'));
    let evaluated = false;
    expect(() =>
        preparePolicy(root, () => {
            evaluated = true;
        }),
    ).toThrow('private regular file');
    expect(evaluated).toBe(false);
    expect(readFileSync(join(sandbox.path, 'outside.toml'), 'utf8')).toBe(AUTHORED_POLICY);
    expect(existsSync(join(root, '.gspot'))).toBe(false);
});

test('writePolicy > sets a nested key, then deletes it and the empty table', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': AUTHORED_POLICY });
    {
        const plan = preparePolicy(sandbox.path, (raw) => {
            setKey(raw, 'limits.bash.file_lines', 100);
        });
        using log = openOwnership(sandbox.path);
        writePolicy(log, plan);
    }
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toContain('[limits.bash]');
    {
        const plan = preparePolicy(sandbox.path, (raw) => {
            deleteKey(raw, 'limits.bash.file_lines');
        });
        using log = openOwnership(sandbox.path);
        writePolicy(log, plan);
    }
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).not.toContain('file_lines');
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).not.toContain('[limits');
});

test('writePolicy > deduplicates list values and named entries with reordered keys', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': AUTHORED_POLICY });
    {
        const plan = preparePolicy(sandbox.path, (raw) => {
            addToList(raw, 'naming.banned', ['dispatcher', 'orchestrator']);
        });
        using log = openOwnership(sandbox.path);
        writePolicy(log, plan);
    }
    {
        const plan = preparePolicy(sandbox.path, (raw) => {
            addToList(raw, 'naming.banned', ['dispatcher']);
        });
        using log = openOwnership(sandbox.path);
        writePolicy(log, plan);
    }
    const written = readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect(written.match(/dispatcher/g)).toHaveLength(1);
    // A table entry is the same entry whatever order its keys come in.
    for (const entry of [
        { name: 'Ledger', reason: 'A domain term.' },
        { reason: 'A domain term.', name: 'Ledger' },
    ]) {
        const plan = preparePolicy(sandbox.path, (raw) => {
            addToList(raw, 'naming.allowed', [entry]);
        });
        using log = openOwnership(sandbox.path);
        writePolicy(log, plan);
    }
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8').match(/Ledger/g)).toHaveLength(1);
});

test.each([
    ['a sub-table', '[[scope]]\npath = "api"\n[scope.limits]\nfile_lines = 100\n'],
    ['an inline table', '[[scope]]\npath = "api"\nlimits = { file_lines = 100 }\n'],
])('writePolicy > a scope setting written into %s loads with the ones already there', async (_form, scope) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': `${AUTHORED_POLICY}\n${scope}`, 'api/run.sh': '' });
    const result = preparePolicy(sandbox.path, (raw) => {
        setKey(getScopeTable(raw, 'api'), 'limits.function_lines', 20);
    });
    {
        const plan = result;
        using log = openOwnership(sandbox.path);
        writePolicy(log, plan);
    }
    expect(result.policy.scopeTables['api']?.limits?.root).toStrictEqual({
        file_lines: { value: 100 },
        function_lines: { value: 20 },
    });
    expect(preparePolicy(sandbox.path, () => {}).policy.scopeTables['api']?.limits?.root).toMatchObject({
        function_lines: { value: 20 },
    });
});

test('a prepared policy edit refuses stale bytes and accepts a fresh plan', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    writeFileSync(path, AUTHORED_POLICY);
    const plan = preparePolicy(sandbox.path, (raw) => {
        setKey(raw, 'level', 'all');
    });
    writeFileSync(path, `${AUTHORED_POLICY}\n# Concurrent edit.\n`);
    expect(() => {
        using log = openOwnership(sandbox.path);
        return writePolicy(log, plan);
    }).toThrow('The gspot.toml file changed while gspot was running.');
    expect(readFileSync(path, 'utf8')).toBe(`${AUTHORED_POLICY}\n# Concurrent edit.\n`);
    const corrected = preparePolicy(sandbox.path, (raw) => {
        setKey(raw, 'level', 'all');
    });
    {
        const plan = corrected;
        using log = openOwnership(sandbox.path);
        expect(writePolicy(log, plan).policy.level).toBe('all');
    }
    expect(readFileSync(path, 'utf8')).toBe(corrected.text);
});

test('a policy command evaluates its mutation once before applying the prepared result', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    writeFileSync(path, buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }));
    let evaluations = 0;
    using log = openOwnership(sandbox.path);
    const result = await commitPolicy(
        sandbox.path,
        log,
        (raw) => {
            evaluations += 1;
            setKey(raw, 'require_reasons', evaluations === 1);
        },
        'Updated require_reasons.',
    );
    expect(result.exitCode).toBe(0);
    expect(evaluations).toBe(1);
    expect(readFileSync(path, 'utf8')).toContain('require_reasons = true');
});

test('policy inspection accepts linked authored text inside the root while edits preserve its target', async () => {
    await using sandbox = await testdir();
    const policy = buildPolicy(['markdown']);
    await createFileTree(sandbox.path, { 'settings/policy.toml': policy });
    symlinkSync('settings/policy.toml', join(sandbox.path, 'gspot.toml'));
    expect(hasPolicy(sandbox.path)).toBe(true);
    expect(readPolicy(sandbox.path).text).toBe(policy);
    expect(() =>
        preparePolicy(sandbox.path, (raw) => {
            setKey(raw, 'level', 'all');
        }),
    ).toThrow('private regular file');
    expect(readFileSync(join(sandbox.path, 'settings/policy.toml'), 'utf8')).toBe(policy);
});
