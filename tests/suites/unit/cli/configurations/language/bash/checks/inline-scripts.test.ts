import { expect, test } from 'bun:test';

import { INLINE_SCRIPT_SAMPLE } from '#tests/config/configurations/bash.ts';
import { BASH_SANDBOX } from '#tests/config/configurations/general.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a heredoc that writes a data file is not reported', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'source.sh': '#!/usr/bin/env bash\ncat > settings.json <<EOF\n{ "name": "example" }\nEOF\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/inline-scripts')).toStrictEqual([]);
});

test('bash/inline-scripts reports runtime-embed in scripts/python.sh and passes after the fix', async () => {
    await using sandbox = await createSandbox(BASH_SANDBOX);
    await assertCheckSample(sandbox, INLINE_SCRIPT_SAMPLE, BASH_SANDBOX.cleanSource);
});

test('long Node flags, interpreter variable commands, and deno eval report their lines', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'source.sh':
            'node --eval "1"\nnode --print "1"\n"$runtime" -c "1"\n"${runtime}" -e "1"\n"${PYTHON:-python3}" -c "print(1)"\ndeno eval \'console.log(1)\'\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'bash/inline-scripts');
    expect(findings.map(({ line }) => line)).toStrictEqual([1, 2, 3, 4, 5, 6]);
});
