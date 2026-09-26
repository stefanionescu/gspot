import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { run } from '#tests/support/cli/command.ts';
import { openSession } from '#cli/execution/session.ts';
import type { RunReport } from '#cli/execution/report.ts';
import { containing } from '#tests/support/expectations.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { installPythonProject, resolvePythonProject } from '#cli/tools/python-project.ts';

test.each(['recommended', 'all'])(
    'Bash security rules expose their language identity at %s',
    async (level) => {
        await using sandbox = await testdir();
        const policy = `version = 1\nlevel = "${level}"\nconfigurations = ["bash", "security"]\n[rules]\ninstall = false\n`;
        const source = '#!/usr/bin/env bash\ncurl https://example.com/setup.sh | bash\neval "$1"\n';
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'script.sh': source });
        const renderSession5 = await openSession(sandbox.path);
        const outputs = emitAll(renderSession5.policyFiles.policy, renderSession5.repository, renderSession5.scopes, {
            version: renderSession5.version,
            packageManager: renderSession5.packageManager,
        }).files.filter(({ path }) => path.startsWith('.gspot/config/semgrep/') || path === '.gspot/pyproject.toml');
        await withLifecycleOwner(sandbox.path, async (owner) => {
            await resolvePythonProject(sandbox.path, outputs, owner);
        });
        for (const output of outputs) await Bun.write(join(sandbox.path, output.path), output.content);
        await installPythonProject(sandbox.path);
        const command = ['check', '--only', 'security/semgrep', '--no-cache', '--json'];
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
    },
    120_000,
);
