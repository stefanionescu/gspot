import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { symlink, readFile } from 'node:fs/promises';
import { pathExists } from '#tests/harness/preservation.ts';
import type { Mutation } from '#cli/types/policy/settings.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { AUTHORED_POLICY } from '#tests/config/cli/policy/file.ts';
import { parsePolicyEdit, writePolicyFile } from '#cli/policy/document/public.ts';

import {
    setKey,
    addToList,
    deleteKey,
    editPolicy,
    getScopeTable,
    preparePolicy,
} from '#cli/policy/document/contracts.ts';

test('policy edits keep a trailing array comma and write inline tables without one', () => {
    const original = '# Authored selection.\nconfigurations = ["security",]\n';
    const entry = {
        check: 'security/codeql',
        rule: 'js/file-system-race',
        paths: ['fixture.js'],
        reason: 'The sandbox owns its temporary files.',
    };
    const mutate: Mutation = (raw) => {
        setKey(raw, 'ignore', [entry]);
    };
    const proposed = editPolicy('.', parsePolicyEdit(original), mutate);
    expect(proposed.text).toContain('# Authored selection.');
    expect(proposed.text).not.toMatch(/,\s*\}/u);
    expect(proposed.policy.ignore).toStrictEqual([entry]);
    const repeated = editPolicy('.', parsePolicyEdit(proposed.text), mutate);
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
        editPolicy(root, preparePolicy(root), () => {
            evaluated = true;
        }),
    ).toThrow('private regular file');
    expect(evaluated).toBe(false);
    expect(await readFile(join(sandbox.path, 'outside.toml'), 'utf8')).toBe(AUTHORED_POLICY);
    expect(await pathExists(join(root, '.gspot'))).toBe(false);
});

const changesKey = () => {
    const written = editPolicy('.', parsePolicyEdit(AUTHORED_POLICY), (raw) => {
        setKey(raw, 'limits.bash.file_lines', 100);
    }).text;
    expect(written).toContain('[limits.bash]');
    const removed = editPolicy('.', parsePolicyEdit(written), (raw) => {
        deleteKey(raw, 'limits.bash.file_lines');
    }).text;
    expect(removed).not.toContain('file_lines');
    expect(removed).not.toContain('[limits');
};

const deduplicatesEntries = () => {
    const added = editPolicy('.', parsePolicyEdit(AUTHORED_POLICY), (raw) => {
        addToList(raw, 'naming.banned', ['dispatcher', 'orchestrator']);
    }).text;
    const written = editPolicy('.', parsePolicyEdit(added), (raw) => {
        addToList(raw, 'naming.banned', ['dispatcher']);
    }).text;
    expect(written.match(/dispatcher/g)).toHaveLength(1);
    const formatted = editPolicy('.', parsePolicyEdit(written), (raw) => {
        addToList(raw, 'format.overrides', [
            { paths: ['legacy/**'], indent_style: 'tab' },
            { indent_style: 'tab', paths: ['legacy/**'] },
        ]);
    }).text;
    expect(formatted.match(/legacy\/\*\*/g)).toHaveLength(1);
};

describe('editPolicy', () => {
    test('sets a nested key, then deletes it and the empty table', changesKey);

    test('deduplicates scalar list values and record entries with reordered keys', deduplicatesEntries);
});

describe('writePolicyFile', () => {
    test.each([
        ['a sub-table', '[scope."api"]\n[scope."api".limits]\nfile_lines = 100\n'],
        ['an inline table', '[scope."api"]\nlimits = { file_lines = 100 }\n'],
    ])('a scope setting written into %s loads with the ones already there', async (_form, scope) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': `${AUTHORED_POLICY}\n${scope}`, 'api/run.sh': '' });
        const resultInput = preparePolicy(sandbox.path);
        const result = editPolicy(sandbox.path, resultInput, (raw) => {
            setKey(getScopeTable(raw, 'api'), 'limits.function_lines', 20);
        });
        {
            using log = openOwnership(sandbox.path);
            writePolicyFile({
                text: result.text,
                original: resultInput.original,
                publish: (next, expected) => {
                    log.files.write('gspot.toml', next, expected);
                },
            });
        }
        expect(result.policy.scopeTables['api']?.limits?.root).toStrictEqual({
            file_lines: 100,
            function_lines: 20,
        });
        expect(
            editPolicy(sandbox.path, preparePolicy(sandbox.path), () => {}).policy.scopeTables['api']?.limits?.root,
        ).toMatchObject({
            function_lines: 20,
        });
    });
});
