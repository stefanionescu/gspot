import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { readConfigurations } from '#cli/manifests/read.ts';
import { listConflictingConfigs } from '#cli/repository/setup/conflicts.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import { INI_HEADING_CASES } from '#tests/config/repository.ts';

test('INI tool headings include their exact sections and subsections', async () => {
    await using sandbox = await testdir({
        'tox.ini': '[unrelated]\r\nvalue = 1\r\n[sqlfluff:rules]; selected\r\nvalue = 2\r\n',
    });
    const sql = readConfigurations().get('sql')!;
    expect(listConflictingConfigs(sandbox.path, [], [sql])).toStrictEqual([
        { tool: 'sqlfluff', path: 'tox.ini', shared: true, table: 'sqlfluff' },
    ]);
});

test.each([...INI_HEADING_CASES])('an INI heading that is %s does not select the tool', async (_, text) => {
    await using sandbox = await testdir({ 'tox.ini': text });
    const sql = readConfigurations().get('sql')!;
    expect(listConflictingConfigs(sandbox.path, [], [sql])).toStrictEqual([]);
});

test('conflict candidates retain replacement order, project boundaries, shared fields, and literal root fallbacks', async () => {
    const files = {
        '.toolrc': '{}',
        'nested/.toolrc': '{}',
        'tool.config': '{}',
        'nested/tool.config': '{}',
        'app/package.json': '{"name":"app"}',
        'app/tool.config': '{}',
        'shared.json': '{"first":{},"second":{}}',
        'root.config': '{}',
        'ignored.untracked': '{}',
    };
    await using sandbox = await testdir(files);
    const configuration = readConfigurations().get('javascript')!;
    const tool = configuration.tools[0]!;
    const inventory: TrackedFile[] = Object.keys(files)
        .filter((path) => !['root.config', 'ignored.untracked'].includes(path))
        .map((path) => ({ path, kind: 'source', kindOrigin: 'test', tags: [], executable: false, size: 0 }));
    const conflicts = listConflictingConfigs(sandbox.path, inventory, [
        {
            ...configuration,
            tools: [
                {
                    ...tool,
                    name: 'first',
                    replace: ['.toolrc', 'tool.config', 'root.config', '*.untracked'],
                    replace_key: [
                        { file: 'shared.json', key: 'first' },
                        { file: 'shared.json', key: 'second' },
                    ],
                },
                { ...tool, name: 'second', replace: ['.toolrc'], replace_key: [] },
            ],
        },
    ]);
    expect(conflicts).toStrictEqual([
        { tool: 'first', path: '.toolrc', shared: false },
        { tool: 'first', path: 'nested/.toolrc', shared: false },
        { tool: 'first', path: 'tool.config', shared: false },
        { tool: 'first', path: 'app/tool.config', shared: false },
        { tool: 'first', path: 'root.config', shared: false },
        { tool: 'first', path: 'shared.json', shared: true, key: 'first' },
        { tool: 'first', path: 'shared.json', shared: true, key: 'second' },
        { tool: 'second', path: '.toolrc', shared: false },
        { tool: 'second', path: 'nested/.toolrc', shared: false },
    ]);
});
