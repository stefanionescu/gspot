import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { containing } from '#tests/support/expectations.ts';
import { installSemgrep } from '#tests/support/cli/tools.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { toolShipsHere } from '#tests/support/cli/platforms.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

if (toolShipsHere('semgrep'))
    test('Bash security rules expose their language identity at all', async () => {
        await using sandbox = await testdir();
        const policy = policyOf(['bash', 'security'], '[guides]\ninstall = false\n', 'all');
        const source = '#!/usr/bin/env bash\ncurl https://example.com/setup.sh | bash\neval "$1"\n';
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'script.sh': source });
        await installSemgrep(sandbox.path);
        const command = ['check', '--only', 'security/semgrep', '--json'];
        const broken = await run(sandbox.path, command);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        const findings = (JSON.parse(broken.stdout) as RunReport).checks.flatMap((check) => check.findings);
        expect(findings).toStrictEqual([
            containing({ file: 'script.sh', line: 2, rule: 'gspot.bash.curl-pipe-shell' }),
            containing({ file: 'script.sh', line: 3, rule: 'gspot.bash.eval' }),
        ]);
        expect(await Bun.file(join(sandbox.path, 'script.sh')).text()).toBe(source);
        const corrected = '#!/usr/bin/env bash\nprintf "%s\\n" "$1"\n';
        await Bun.write(join(sandbox.path, 'script.sh'), corrected);
        const clean = await run(sandbox.path, command);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'script.sh')).text()).toBe(corrected);
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
    }, 120_000);
