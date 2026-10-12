import { parse } from 'jsonc-parser';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { settingsText } from '#tests/setup/settings.ts';

test.each([...LEVELS])('%s turns on MD041 and MD025 only at level all and keeps your MD044 names', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['markdown'], {
            level,
            tables: `[tools.markdownlint.rules.MD044]
names = ["Widget"]
`,
        }),
        'source.md': '# Widget\n',
    });
    const session = await openSession(sandbox.path);
    const file = emitAll(session).files.find(({ path }) => path === '.gspot/config/markdownlint.jsonc')!;
    const config = parse(file.content) as Record<string, unknown>;
    expect(config['MD041']).toBe(level === 'all');
    expect(config['MD025']).toStrictEqual(level === 'all' ? { front_matter_title: '' } : false);
    expect(config['MD044']).toStrictEqual({ names: ['Widget'] });
});
