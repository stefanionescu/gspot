import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import { listConflictingConfigFiles } from '#cli/repository/conflicts.ts';

import {
    CONFLICT_FILES,
    INI_HEADING_CASES,
    ORDERED_CONFLICTS,
    CONFLICT_REPLACEMENTS,
} from '#tests/config/repository/repository.ts';

test('INI tool headings include their exact sections and subsections', async () => {
    await using sandbox = await testdir({
        'tox.ini': '[unrelated]\r\nvalue = 1\r\n[sqlfluff:rules]; selected\r\nvalue = 2\r\n',
    });
    const sql = readConfigurations().get('sql')!;
    expect(listConflictingConfigFiles(sandbox.path, [], [sql])).toStrictEqual([
        { tool: 'sqlfluff', path: 'tox.ini', shared: true, table: 'sqlfluff' },
    ]);
});

test.each([...INI_HEADING_CASES])('an INI heading that is %s does not select the tool', async (_, text) => {
    await using sandbox = await testdir({ 'tox.ini': text });
    const sql = readConfigurations().get('sql')!;
    expect(listConflictingConfigFiles(sandbox.path, [], [sql])).toStrictEqual([]);
});

test('conflict candidates retain replacement order, project boundaries, shared fields, and literal root fallbacks', async () => {
    await using sandbox = await testdir(CONFLICT_FILES);
    const configuration = readConfigurations().get('javascript')!;
    const tool = configuration.tools[0]!;
    const inventory: TrackedFile[] = Object.keys(CONFLICT_FILES)
        .filter((path) => !['root.config', 'ignored.untracked'].includes(path))
        .map((path) => ({ path, kind: 'source', kindOrigin: 'test', tags: [], executable: false, size: 0 }));
    const conflicts = listConflictingConfigFiles(sandbox.path, inventory, [
        {
            ...configuration,
            tools: [
                {
                    ...tool,
                    name: 'first',
                    replace: [...CONFLICT_REPLACEMENTS],
                    replace_key: [
                        { file: 'shared.json', key: 'first' },
                        { file: 'shared.json', key: 'second' },
                    ],
                },
                { ...tool, name: 'second', replace: ['.toolrc'], replace_key: [] },
            ],
        },
    ]);
    expect(conflicts).toStrictEqual(ORDERED_CONFLICTS);
});
