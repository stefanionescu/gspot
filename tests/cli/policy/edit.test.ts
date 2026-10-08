import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { symlink, readFile } from 'node:fs/promises';
import { writePolicyFile } from '#cli/policy/file.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import type { Mutation } from '#cli/types/policy/settings.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { AUTHORED_POLICY } from '#tests/config/cli/policy/file.ts';
import { setKey, addToList, deleteKey, getScopeTable, preparePolicy, proposePolicy } from '#cli/policy/edit.ts';

test('policy edits keep a trailing array comma and write inline tables without one', () => {
    const original = '# Authored selection.\nconfigurations = ["security",]\n';
    const entry = {
        check: 'security/codeql',
        rule: 'js/file-system-race',
        paths: ['fixture.js'],
        reason: 'A deliberate fixture owns its temporary files.',
    };
    const mutate: Mutation = (raw) => {
        setKey(raw, 'ignore', [entry]);
    };
    const proposed = proposePolicy('.', original, mutate);
    expect(proposed.text).toContain('# Authored selection.');
    expect(proposed.text).not.toMatch(/,\s*\}/u);
    expect(proposed.policy.ignore).toStrictEqual([entry]);
    const repeated = proposePolicy('.', proposed.text, mutate);
    expect(repeated.changed).toBe(false);
    expect(repeated.text).toBe(proposed.text);
});

test('preparePolicy rejects an external symlink before evaluating its mutation', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'project/.keep': '', 'outside.toml': AUTHORED_POLICY });
    const root = join(sandbox.path, 'project');
    await symlink('../outside.toml', join(root, 'gspot.toml'));
    let evaluated = false;
    expect(() =>
        preparePolicy(root, () => {
            evaluated = true;
        }),
    ).toThrow('private regular file');
    expect(evaluated).toBe(false);
    expect(await readFile(join(sandbox.path, 'outside.toml'), 'utf8')).toBe(AUTHORED_POLICY);
    expect(await pathExists(join(root, '.gspot'))).toBe(false);
});

test('writePolicyFile > sets a nested key, then deletes it and the empty table', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': AUTHORED_POLICY });
    {
        const plan = preparePolicy(sandbox.path, (raw) => {
            setKey(raw, 'limits.bash.file_lines', 100);
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
    }
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toContain('[limits.bash]');
    {
        const plan = preparePolicy(sandbox.path, (raw) => {
            deleteKey(raw, 'limits.bash.file_lines');
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
    }
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).not.toContain('file_lines');
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).not.toContain('[limits');
});

test('writePolicyFile > deduplicates scalar list values and record entries with reordered keys', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': AUTHORED_POLICY });
    {
        const plan = preparePolicy(sandbox.path, (raw) => {
            addToList(raw, 'naming.banned', ['dispatcher', 'orchestrator']);
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
    }
    {
        const plan = preparePolicy(sandbox.path, (raw) => {
            addToList(raw, 'naming.banned', ['dispatcher']);
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
    }
    const written = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect(written.match(/dispatcher/g)).toHaveLength(1);
    {
        const plan = preparePolicy(sandbox.path, (raw) => {
            addToList(raw, 'format.overrides', [
                { paths: ['legacy/**'], indent_style: 'tab' },
                { indent_style: 'tab', paths: ['legacy/**'] },
            ]);
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
    }
    const formatted = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect(formatted.match(/legacy\/\*\*/g)).toHaveLength(1);
});

test.each([
    ['a sub-table', '[scope."api"]\n[scope."api".limits]\nfile_lines = 100\n'],
    ['an inline table', '[scope."api"]\nlimits = { file_lines = 100 }\n'],
])('writePolicyFile > a scope setting written into %s loads with the ones already there', async (_form, scope) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': `${AUTHORED_POLICY}\n${scope}`, 'api/run.sh': '' });
    const result = preparePolicy(sandbox.path, (raw) => {
        setKey(getScopeTable(raw, 'api'), 'limits.function_lines', 20);
    });
    {
        const plan = result;
        using log = openOwnership(sandbox.path);
        writePolicyFile({
            files: log.files,
            text: plan.text,
            original: plan.original,
            publish: (next, expected) => {
                log.files.write('gspot.toml', next, expected);
            },
        });
    }
    expect(result.policy.scopeTables['api']?.limits?.root).toStrictEqual({
        file_lines: 100,
        function_lines: 20,
    });
    expect(preparePolicy(sandbox.path, () => {}).policy.scopeTables['api']?.limits?.root).toMatchObject({
        function_lines: 20,
    });
});
