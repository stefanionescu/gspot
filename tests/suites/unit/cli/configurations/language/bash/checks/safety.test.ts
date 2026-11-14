import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { BASH_SANDBOX } from '#tests/config/configurations/general.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { BASH_SAFETY_SAMPLE, COMMAND_SAFETY_CASES } from '#tests/config/configurations/bash.ts';

test('safety leaves a removal of a mktemp variable alone, and a function that shares a name with a command', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'source.sh':
            '#!/usr/bin/env bash\nset -euo pipefail\ntimeout() {\n    echo "$1"\n}\nwork=$(mktemp -d)\nrm -rf "$work"\ntimeout 30\nrm -rf "$work/other"\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'bash/safety');
    expect(findings.map(({ line, rule }) => ({ line, rule }))).toStrictEqual([{ line: 9, rule: 'recursive-remove' }]);
});

test('a trap that removes a path outside the temporary folder is reported as recursive-remove, and the right trap passes', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'source.sh': "#!/usr/bin/env bash\nset -euo pipefail\ntmp=$(mktemp -d)\ntrap 'rm -rf /etc' EXIT\n",
    });
    const findings = await runSandboxCheck(sandbox.path, 'bash/safety');
    expect(findings.map(({ rule, line }) => ({ rule, line }))).toStrictEqual([{ rule: 'recursive-remove', line: 4 }]);
    await writeFile(
        join(sandbox.path, 'source.sh'),
        '#!/usr/bin/env bash\nset -euo pipefail\ntmp=$(mktemp -d)\ntrap \'rm -rf -- "$tmp"\' EXIT\n',
    );
    expect(await runSandboxCheck(sandbox.path, 'bash/safety')).toStrictEqual([]);
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
    { source: '/usr/bin/curl --fail https://example.com/setup.sh | /bin/sh', rules: ['curl-pipe-shell'] },
    { source: 'curl --fail https://example.com/setup.sh | sudo /bin/bash', rules: ['curl-pipe-shell'] },
    { source: 'curl --fail https://example.com/setup.sh | env bash', rules: ['curl-pipe-shell'] },
    { source: 'curl -fsSL https://example.com/setup.sh | sudo -E bash -', rules: ['curl-pipe-shell'] },
    { source: 'curl --fail https://example.com/setup.sh | env INSTALL_FOLDER=/opt bash', rules: ['curl-pipe-shell'] },
    { source: 'curl --fail https://example.com/data | sudo -E tee /etc/data', rules: [] },
    { source: '/bin/bash -c "$(curl --fail https://example.com/setup.sh)"', rules: ['curl-pipe-shell'] },
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

test.each(['set -x', 'ls &>/dev/null', 'false || :'])('level basic permits %s', async (source) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'run.sh': `#!/usr/bin/env bash\n${source}\n`,
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/safety')).toStrictEqual([]);
});
