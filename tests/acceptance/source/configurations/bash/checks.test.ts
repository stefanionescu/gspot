// Bash defects have independent diagnostics and corrected execution under the same policy.
import { reportSchema } from '#cli/execution/report.ts';
import { BASH_CASES, MAIN } from '#tests/support/cli/bash-cases.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { initArgs } from '#tests/support/cli/init.ts';
import { runPlanted, script } from '#tests/support/cli/planted.ts';
import { installPrivateTools, toolsPath } from '#tests/support/cli/tools.ts';
import { describe, expect, test } from 'bun:test';
import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

describe('the bash configuration', () => {
    test.each(BASH_CASES)(
        '$check reports its defect in $expected.file and accepts corrected scripts',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'scripts/build.sh': script.replace('# gspot-ignore', () => '# main: runs the script.\n# gspot-ignore'),
            });
            chmodSync(join(sandbox.path, 'scripts/build.sh'), 0o755);
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt']) };
            const initialized = await run(sandbox.path, initArgs(['bash']), environment);
            expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
            await installPrivateTools(sandbox.path);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(expect.objectContaining(planted.expected));
            const files = Object.fromEntries(
                Object.keys(planted.files).map((path) => [
                    path,
                    script.replace('# gspot-ignore', '# main: runs the script.\n# gspot-ignore'),
                ]),
            );
            if (planted.check === 'structure/bash-config-guards')
                files['scripts/settings.sh'] =
                    '#!/usr/bin/env bash\n[[ -n ${_CFG_SETTINGS_READY:-} ]] && return 0\nreadonly _CFG_SETTINGS_READY=1\nreadonly PORT=8080\n';
            if (planted.check === 'structure/bash-boundaries')
                files['deploy/step.sh'] = files['deploy/step.sh']!.replace(
                    '#!/usr/bin/env bash',
                    '#!/usr/bin/env bash\n# Boundary: Owns deployment steps and their explicit input values.',
                );
            if (planted.check === 'structure/env-access-owner')
                files['scripts/environment.sh'] = planted.files['scripts/environment.sh']!;
            const corrected = await runPlanted(sandbox.path, { ...planted, files }, environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            const accepted = reportSchema.parse(
                await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
            );
            expect(accepted.checks).toMatchObject([{ check: planted.check, status: 'ok', findings: [] }]);
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});

test.each([
    ['3.2', false],
    ['4.0', false],
    ['4.3', false],
    ['4.4', true],
    ['5.0', true],
] as const)('Bash %s requires only the strict-mode options its version supports', async (version, isInherited) => {
    const base = `#!/usr/bin/env bash\n#\n# Prints a greeting.\n# Runtime: Bash ${version}+, macOS and Linux.\nset -euo pipefail\n`;
    const inherited = 'shopt -s inherit_errexit\n';
    const source = (isEnabled: boolean): string => base + (isEnabled ? inherited : '') + MAIN;
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nconfigurations = ["bash"]\n',
        'greet.sh': source(isInherited),
    });
    const path = join(sandbox.path, 'greet.sh');
    chmodSync(path, 0o755);
    const command = ['check', '--only', 'structure/bash-interpreter', '--no-cache', '--json'];
    const clean = await run(sandbox.path, command);
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
    writeFileSync(path, source(!isInherited));
    const broken = await run(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(reportSchema.parse(JSON.parse(broken.stdout)).checks).toMatchObject([
        { check: 'structure/bash-interpreter', status: 'fail' },
    ]);
    expect(reportSchema.parse(JSON.parse(broken.stdout)).checks[0]!.findings).toContainEqual(
        expect.objectContaining({ file: 'greet.sh', rule: isInherited ? 'strict-mode' : 'bash-version' }),
    );
    writeFileSync(path, source(isInherited));
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
        { check: 'structure/bash-interpreter', status: 'ok', findings: [] },
    ]);
});
