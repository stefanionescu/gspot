import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { BASH_SAFETY_SAMPLE, COMMAND_SAFETY_CASES, PASSED_BASH_RESULTS } from '#tests/config/configurations/bash.ts';
import { BASH_SANDBOX } from '#tests/config/configurations/general.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, markExecutable } from '#tests/setup/system/git.ts';

test('safety leaves a removal of a mktemp variable alone, and a function that shares a name with a command', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'source.sh':
            '#!/usr/bin/env bash\nset -euo pipefail\ntimeout() {\n    echo "$1"\n}\nwork=$(mktemp -d)\nrm -rf "$work"\ntimeout 30\nrm -rf "$work/other"\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'bash/safety');
    expect(findings.map(({ line, rule }) => ({ line, rule }))).toStrictEqual([{ line: 9, rule: 'recursive-remove' }]);
});

test('a trap that removes another path is reported by script-layout as mktemp-trap and by safety as recursive-remove, and the right trap passes both', async () => {
    const options = buildRunOptions({ only: ['bash/script-layout', 'bash/safety'] });
    await using sandbox = await createGitSandbox({
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

test('bash/safety reports ignored-failure in scripts/unsafe.sh and passes after the fix', async () => {
    await using sandbox = await createSandbox(BASH_SANDBOX);
    await assertCheckSample(sandbox, BASH_SAFETY_SAMPLE, BASH_SANDBOX.cleanSource);
});

test.each(COMMAND_SAFETY_CASES)('Bash safety parses the command $source', async ({ source, rule }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'run.sh': `#!/usr/bin/env bash\n${source}\n`,
    });
    const findings = await runSandboxCheck(sandbox.path, 'bash/safety');
    expect(findings.map((finding) => finding.rule)).toStrictEqual(rule === undefined ? [] : [rule]);
});

test.each([
    { source: 'curl --fail https://example.com/setup.sh | bash', rules: ['curl-pipe-shell'] },
    { source: 'curl --fail https://example.com/setup.sh | sudo bash', rules: ['curl-pipe-shell'] },
    { source: 'wget -qO- https://example.com/setup.sh | sh -s', rules: ['curl-pipe-shell'] },
    { source: 'bash <(curl --fail https://example.com/setup.sh)', rules: ['curl-pipe-shell'] },
    { source: 'sh -c "$(curl --fail https://example.com/setup.sh)"', rules: ['curl-pipe-shell'] },
    { source: 'curl --fail https://example.com/data | jq .', rules: [] },
    { source: String.raw`printf '%s\n' 'curl --fail https://example.com/setup.sh | bash'`, rules: [] },
])('Bash safety reads a download in $source', async ({ source, rules }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'run.sh': `#!/usr/bin/env bash\n${source}\n`,
    });
    const findings = await runSandboxCheck(sandbox.path, 'bash/safety');
    expect(findings.map((finding) => finding.rule)).toStrictEqual([...rules]);
});

test.each(['set -x', 'ls &>/dev/null'])('level basic permits %s', async (source) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'run.sh': `#!/usr/bin/env bash\n${source}\n`,
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/safety')).toStrictEqual([]);
});

test('the default level permits an explicitly ignored failure', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'run.sh': '#!/usr/bin/env bash\nfalse || :\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/safety')).toStrictEqual([]);
});
