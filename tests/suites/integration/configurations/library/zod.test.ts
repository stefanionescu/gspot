import { test, expect } from 'bun:test';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';

const installedSandbox = shareInstalledSandbox({
    configurations: ['javascript', 'zod'],
    level: 'basic',
    dependencies: { zod: '*' },
    files: { 'schema.js': 'import { z } from "zod";\nexport const countSchema = z.number().int();\n' },
});

test('basic Zod checks report deprecated chained integer schemas', async () => {
    const { root } = installedSandbox();
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'javascript/eslint', '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(listFindingRows(result.report).filter(({ file }) => file === 'schema.js')).toStrictEqual([
        { file: 'schema.js', line: 2, rule: 'zod/no-number-schema-with-int' },
    ]);
});
