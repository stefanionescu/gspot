import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';

test('generated JavaScript policy reports ambiguous star exports through the replacement rule', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], {
            tables: '[agent_rules]\nenabled = false\n[structure]\nreexports = "index-only"\n',
            level: 'all',
        }),
        'package.json': '{"name":"javascript-exports","private":true,"type":"module"}',
        'src/first.js': 'export const shared = 1;\n',
        'src/second.js': 'export const shared = 2;\n',
        'src/index.js': 'export * from "./first.js";\nexport * from "./second.js";\n',
    });
    const eslint = await createEslint(sandbox.path);
    const [broken] = await eslint.lintFiles(['src/index.js']);
    expect(broken?.fatalErrorCount).toBe(0);
    expect(
        broken!.messages
            .filter(({ ruleId }) => ruleId === 'import-x/export')
            .map(({ ruleId, messageId: diagnosticId, line }) => ({ ruleId, messageId: diagnosticId, line })),
    ).toStrictEqual([
        { ruleId: 'import-x/export', messageId: 'multiNamed', line: 1 },
        { ruleId: 'import-x/export', messageId: 'multiNamed', line: 2 },
    ]);
    writeFileSync(
        join(sandbox.path, 'src/index.js'),
        'export * from "./first.js";\nexport { shared as second } from "./second.js";\n',
    );
    const [corrected] = await eslint.lintFiles(['src/index.js']);
    expect(corrected?.fatalErrorCount).toBe(0);
    expect(corrected!.messages.filter(({ ruleId }) => ruleId === 'import-x/export')).toStrictEqual([]);
});
