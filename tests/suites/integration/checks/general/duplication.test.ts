import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { commitAll } from '#tests/setup/system/git.ts';
import type { RunReport } from '#cli/types/runs/run.ts';
import { initSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    SHARED_IMPORTS,
    buildCountScript,
    DUPLICATED_METADATA,
} from '#tests/config/integration/checks/general/duplication.ts';

async function runJscpdCheck(root: string, code: number): Promise<RunReport> {
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'duplication/jscpd', '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(code);
    return result.report;
}

test('duplication/jscpd reports a copied Bash function on the second file and ignores identical JSON files', async () => {
    await using sandbox = await testdir({
        'scripts/first.sh': buildCountScript('count_first'),
        'metadata/first.json': DUPLICATED_METADATA,
        'metadata/second.json': DUPLICATED_METADATA,
    });

    commitAll(sandbox.path);
    await initSandbox(
        { root: sandbox.path, environment: {}, run: spawnGspot },
        { configurations: ['bash'], level: 'all' },
    );
    await runJscpdCheck(sandbox.path, 0);
    await writeFile(join(sandbox.path, 'scripts/second.sh'), buildCountScript('count_second'));
    const report = await runJscpdCheck(sandbox.path, 1);
    expect(report.checks).toMatchObject([
        {
            check: 'duplication/jscpd',
            status: 'failed',
            findings: [
                {
                    check: 'duplication/jscpd',
                    file: 'scripts/second.sh',
                    line: 4,
                    rule: 'clone',
                    message: '64 lines repeat scripts/first.sh:4.',
                },
            ],
        },
    ]);
    await writeFile(join(sandbox.path, 'scripts/second.sh'), '#!/usr/bin/env bash\nprintf "Independent task\\n"\n');
    const corrected = await runJscpdCheck(sandbox.path, 0);
    expect(corrected.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'passed', findings: [] }]);
});

test('duplication/jscpd skips an import list that two files share', async () => {
    await using sandbox = await testdir({
        'first.ts': `${SHARED_IMPORTS}\n\nexport const first = value0 + value1;\n`,
        'second.ts': `${SHARED_IMPORTS}\n\nexport const second = value2 * value3;\n`,
    });
    commitAll(sandbox.path);
    await initSandbox(
        { root: sandbox.path, environment: {}, run: spawnGspot },
        { configurations: ['typescript'], level: 'all' },
    );
    const report = await runJscpdCheck(sandbox.path, 0);
    expect(report.checks).toMatchObject([{ check: 'duplication/jscpd', status: 'passed', findings: [] }]);
});
