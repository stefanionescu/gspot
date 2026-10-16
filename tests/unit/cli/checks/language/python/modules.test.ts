import { test } from 'bun:test';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { CLEAN_PYTHON_MODULE, PYTHON_MODULE_CASES, PYTHON_MODULE_REPOSITORY } from '#tests/config/python/modules.ts';

for (const entry of PYTHON_MODULE_CASES) {
    test(entry.check + ' reports ' + entry.expected.rule + ' and passes after the fix', async () => {
        const plan = {
            ...PYTHON_MODULE_REPOSITORY,
            corrected: (row: { files: Readonly<Record<string, string>> }) => ({
                files: Object.fromEntries(Object.keys(row.files).map((path) => [path, CLEAN_PYTHON_MODULE])),
            }),
        };
        await using sandbox = await createSandbox(plan);
        await runCheckSample(sandbox, entry, plan);
    });
}
