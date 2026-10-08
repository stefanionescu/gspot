import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { sharePythonTools } from '#tests/harness/python-installation.ts';
import { SEMGREP_COMMAND } from '#tests/config/tools/generation/semgrep.ts';

test.skipIf(!hasToolBuild('semgrep'))(
    'malformed Bash source is a positioned finding and its correction passes',
    async () => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['bash', 'security']),
            'scripts/café build.sh': 'if then\n',
        });
        commitAll(sandbox.path);
        const environment = await sharePythonTools(sandbox.path);
        const malformed = await spawnGspot(sandbox.path, SEMGREP_COMMAND, environment);
        expect(malformed.code, malformed.stdout + malformed.stderr).toBe(1);
        expect((JSON.parse(malformed.stdout) as RunReport).checks).toMatchObject([
            {
                check: 'security/semgrep',
                status: 'failed',
                findings: [{ file: 'scripts/café build.sh', line: 1, column: 1, rule: 'parse-error' }],
            },
        ]);
        await Bun.write(join(sandbox.path, 'scripts/café build.sh'), 'printf "%s\\n" ready\n');
        const corrected = await spawnGspot(sandbox.path, SEMGREP_COMMAND, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'security/semgrep', status: 'passed', findings: [] },
        ]);
    },
);
