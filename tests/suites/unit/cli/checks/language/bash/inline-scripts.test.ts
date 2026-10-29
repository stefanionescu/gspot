import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { BASH_SANDBOX } from '#tests/config/setup/sandboxes.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { INLINE_SCRIPT_CASES } from '#tests/config/checks/language/bash/inline-scripts.ts';

test('a heredoc that writes a data file is not reported', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'source.sh': '#!/usr/bin/env bash\ncat > settings.json <<EOF\n{ "name": "example" }\nEOF\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'bash/inline-scripts')).toStrictEqual([]);
});

test.each([...INLINE_SCRIPT_CASES])(
    'bash/inline-scripts reports $expected.rule in $expected.file and passes after the fix',
    async (row) => {
        const sample = { check: 'bash/inline-scripts', ...row };
        await using sandbox = await createSandbox(BASH_SANDBOX);
        await assertCheckSample(sandbox, sample, BASH_SANDBOX.cleanSource);
    },
);

test('long Node flags and interpreter variable commands report their lines', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
        'source.sh': 'node --eval "1"\nnode --print "1"\n"$runtime" -c "1"\n"${runtime}" -e "1"\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'bash/inline-scripts');
    expect(findings.map(({ line }) => line)).toStrictEqual([1, 2, 3, 4]);
    expect(findings.every(({ rule }) => rule === 'runtime-embed')).toBe(true);
});
