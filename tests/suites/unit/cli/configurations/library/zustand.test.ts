import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

const ZUSTAND_FILES = {
    'package.json': '{"name":"restricted-imports","private":true,"type":"module","dependencies":{"zustand":"5.0.8"}}',
    'src/widget.js': `import { create } from "zustand";
import { readFile } from "node:fs";
import { createStore } from "zustand/vanilla";
export const widget = create(() => ({ readFile, value: createStore(() => ({})) }));
`,
    'src/store.js': `import { create } from "zustand";
import { readFile } from "node:fs";
import { createStore } from "zustand/vanilla";
export const store = create(() => ({ readFile, value: createStore(() => ({})) }));
`,
} as const;

test('at basic, Zustand store files keep your import restrictions and other files get the Zustand restriction', async () => {
    await using sandbox = await testdir({
        ...ZUSTAND_FILES,
        'gspot.toml': buildSandboxSettings(['javascript', 'zustand'], {
            tables: `[javascript]
banned_imports = [{ name = "node:fs", message = "Use the storage service." }]
[zustand]
store_files = { value = ["**/store.js"], reason = "This test sets the allowed locations explicitly." }
`,
            level: 'basic',
        }),
    });

    const eslint = await buildEslint(sandbox.path);
    const files = ['src/widget.js', 'src/store.js'];
    expect(await listLintFindings(eslint, sandbox.path, files, ['no-restricted-imports'])).toStrictEqual([
        { file: 'src/store.js', rule: 'no-restricted-imports', line: 2 },
        { file: 'src/widget.js', rule: 'no-restricted-imports', line: 1 },
        { file: 'src/widget.js', rule: 'no-restricted-imports', line: 2 },
        { file: 'src/widget.js', rule: 'no-restricted-imports', line: 3 },
    ]);
    const results = await eslint.lintFiles(files);
    for (const result of results) {
        expect(
            result.messages.find(({ ruleId, line }) => ruleId === 'no-restricted-imports' && line === 2)?.message,
        ).toEndWith('Use the storage service.');
    }
});
