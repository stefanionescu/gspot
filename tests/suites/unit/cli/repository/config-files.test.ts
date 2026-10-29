import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { listConflictingConfigFiles } from '#cli/repository/config-files.ts';
import { INI_HEADING_CASES } from '#tests/config/repository/config-files.ts';

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
