import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { BASH_SANDBOX } from '#tests/config/setup/sandboxes.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { commitAll, markExecutable } from '#tests/setup/system/git.ts';
import { CONTINUED_TRAP_SOURCE } from '#tests/config/parsers/code/bash.ts';
import { PASSED_BASH_RESULTS } from '#tests/config/checks/language/bash/runs.ts';
import { BASH_SAFETY_CASES, COMMAND_SAFETY_CASES } from '#tests/config/checks/language/bash/safety.ts';

test('a recursive removal outside a mktemp cleanup trap is reported', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'source.sh': '#!/usr/bin/env bash\nset -euo pipefail\nrm -rf /etc\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'bash/safety');
    expect(findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'source.sh', line: 3, rule: 'recursive-remove' },
    ]);
});

test('a trap that removes another path is reported by script-layout as mktemp-trap and by safety as recursive-remove, and the right trap passes both', async () => {
    const options = buildRunOptions({ only: ['bash/script-layout', 'bash/safety'] });
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'source.sh': `#!/usr/bin/env bash
set -euo pipefail
tmp=$(mktemp -d)
trap 'rm -rf /etc' EXIT
`,
    });
    commitAll(sandbox.path);
    await markExecutable(sandbox.path, 'source.sh');

    const wrong = await runChecks(await openSession(sandbox.path), options);

    expect(
        wrong.report.checks.flatMap(({ findings }) => findings.map(({ rule, line }) => ({ rule, line }))),
    ).toStrictEqual([
        { rule: 'mktemp-trap', line: 3 },
        { rule: 'recursive-remove', line: 4 },
    ]);
    await writeFile(
        join(sandbox.path, 'source.sh'),
        `#!/usr/bin/env bash
set -euo pipefail
tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT
`,
    );
    const corrected = await runChecks(await openSession(sandbox.path), options);

    expect(corrected.report.checks).toMatchObject([...PASSED_BASH_RESULTS]);
});

test.each([...BASH_SAFETY_CASES])(
    '$check reports $expected.rule in $expected.file and passes after the fix',
    async (sample) => {
        await using sandbox = await createSandbox(BASH_SANDBOX);
        await assertCheckSample(sandbox, sample, BASH_SANDBOX.cleanSource);
    },
);

test.each(COMMAND_SAFETY_CASES)('Bash safety parses the command $source', async ({ source, rule }) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'run.sh': `#!/usr/bin/env bash\n${source}\n`,
    });
    const findings = await runSandboxCheck(sandbox.path, 'bash/safety');
    expect(findings.map((finding) => finding.rule)).toStrictEqual(rule === undefined ? [] : [rule]);
});

test('the default level permits an explicitly ignored failure', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'run.sh': '#!/usr/bin/env bash\nfalse || :\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/safety')).toStrictEqual([]);
});

test('a continued trap safely removes its temporary directory on the original source row', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'run.sh': `#!/usr/bin/env bash\n${CONTINUED_TRAP_SOURCE}`,
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/safety')).toStrictEqual([]);
});
