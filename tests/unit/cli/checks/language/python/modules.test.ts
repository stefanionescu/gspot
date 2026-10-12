import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { checkFindings } from '#tests/setup/check-input.ts';

import {
    CLEAN_PYTHON_MODULE,
    PYTHON_MODULE_CASES,
    PYTHON_MODULE_HEADER,
    PYTHON_MODULE_REPOSITORY,
} from '#tests/config/python/modules.ts';

test('a module-level instance is a singleton until an ignore names its file', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['python'], { level: 'all' }),
        'example/shared.py': `${PYTHON_MODULE_HEADER}class Store:\n    """Holds things."""\n\n\nstore = Store()\n`,
    });
    const unallowed = await checkFindings(sandbox.path, 'python/singletons');
    expect(unallowed.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'example/shared.py', line: 8, rule: 'singleton' },
    ]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        settingsText(['python'], {
            level: 'all',
            tables: '[[ignore]]\ncheck = "python/singletons"\npaths = ["example/shared.py"]\nreason = "The framework requires one application object."\n',
        }),
    );
    const ignored = await checkReport(sandbox.path, ['check', '--only', 'python/singletons', '--json']);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    expect(ignored.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});
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
