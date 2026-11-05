import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import type { RunReport } from '#cli/types/engine/run.ts';
import {
    DUPLICATED_METADATA,
    DUPLICATED_PYTHON_LOGIC,
    SHARED_IMPORTS,
    SHARED_PYTHON_IMPORTS,
} from '#tests/config/integration/general.ts';
import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { initSandbox } from '#tests/setup/sandboxes/create.ts';
import { commitAll } from '#tests/setup/system/git.ts';

const COUNT_STEPS = Array.from(
    { length: 30 },
    (_, index) => `    printf 'step %s of %s\\n' "${String(index)}" "$total"\n    total=$((total + ${String(index)}))`,
).join('\n');

async function runJscpdCheck(root: string, code: number): Promise<RunReport> {
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'structure/jscpd', '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(code);
    return result.report;
}

test('structure/jscpd reports a copied Bash function on the second file and ignores identical JSON files', async () => {
    const firstScript = `#!/usr/bin/env bash\nset -euo pipefail\n\ncount_first() {\n    local total=0\n${COUNT_STEPS}\n    printf '%s\\n' "$total"\n}\n\ncount_first\n`;
    await using sandbox = await testdir({
        'scripts/first.sh': firstScript,
        'metadata/first.json': DUPLICATED_METADATA,
        'metadata/second.json': DUPLICATED_METADATA,
    });

    commitAll(sandbox.path);
    await initSandbox({ root: sandbox.path, run: spawnGspot }, { configurations: ['bash'], level: 'all' });
    await runJscpdCheck(sandbox.path, 0);
    await writeFile(join(sandbox.path, 'scripts/second.sh'), firstScript.replaceAll('count_first', 'count_second'));
    const report = await runJscpdCheck(sandbox.path, 1);
    expect(report.checks).toMatchObject([
        {
            check: 'structure/jscpd',
            status: 'failed',
            findings: [
                {
                    check: 'structure/jscpd',
                    file: 'scripts/second.sh',
                    line: 4,
                    rule: 'clone',
                    message: expect.stringContaining('scripts/first.sh:4') as string,
                },
            ],
        },
    ]);
    await writeFile(join(sandbox.path, 'scripts/second.sh'), '#!/usr/bin/env bash\nprintf "Independent task\\n"\n');
    const corrected = await runJscpdCheck(sandbox.path, 0);
    expect(corrected.checks).toMatchObject([{ check: 'structure/jscpd', status: 'passed', findings: [] }]);
});

test('structure/jscpd skips an import list that two TypeScript files share and reports a copied function', async () => {
    await using sandbox = await testdir({
        'first.ts': `${SHARED_IMPORTS}\n\nexport const first = value0 + value1;\n`,
        'second.ts': `${SHARED_IMPORTS}\n\nexport const second = value2 * value3;\n`,
    });
    commitAll(sandbox.path);
    await initSandbox({ root: sandbox.path, run: spawnGspot }, { configurations: ['typescript'], level: 'all' });
    const report = await runJscpdCheck(sandbox.path, 0);
    expect(report.checks).toMatchObject([{ check: 'structure/jscpd', status: 'passed', findings: [] }]);
    const logic = Array.from(
        { length: 20 },
        (_, index) => `    total += values[${String(index)}] * ${String(index + 2)};`,
    ).join('\n');
    for (const name of ['first', 'second'])
        await writeFile(
            join(sandbox.path, `${name}.ts`),
            `${SHARED_IMPORTS}\n\nexport function ${name}(values: number[]): number {\n    let total = 0;\n${logic}\n    return total;\n}\n`,
        );
    const copied = await runJscpdCheck(sandbox.path, 1);
    expect(copied.checks).toMatchObject([
        { check: 'structure/jscpd', status: 'failed', findings: [{ rule: 'clone' }] },
    ]);
});

test('structure/jscpd skips shared Python imports and reports duplicated executable statements', async () => {
    await using sandbox = await testdir({
        'first.py': `${SHARED_PYTHON_IMPORTS}\nprint("first")\n`,
        'second.py': `${SHARED_PYTHON_IMPORTS}\nprint("second")\n`,
    });
    commitAll(sandbox.path);
    await initSandbox({ root: sandbox.path, run: spawnGspot }, { configurations: ['python'], level: 'all' });
    const imports = await runJscpdCheck(sandbox.path, 0);
    expect(imports.checks).toMatchObject([{ check: 'structure/jscpd', status: 'passed', findings: [] }]);
    for (const name of ['first', 'second']) {
        await writeFile(
            join(sandbox.path, `${name}.py`),
            `${SHARED_PYTHON_IMPORTS}\ndef ${name}(values):\n    total = 0\n${DUPLICATED_PYTHON_LOGIC}\n    return total\n`,
        );
    }
    const copied = await runJscpdCheck(sandbox.path, 1);
    expect(copied.checks).toMatchObject([
        { check: 'structure/jscpd', status: 'failed', findings: [{ rule: 'clone' }] },
    ]);
});
