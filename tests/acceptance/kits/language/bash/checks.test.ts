// Bash defects have independent diagnostics and corrected execution under the same policy.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { chmodSync, writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { script, plantedCases } from '#tests/harness/planted/cases.ts';
import { BASH_CASES, BASH_CASES_MAIN as MAIN } from '#tests/samples/bash.ts';

const CLEAN = script.replace('main() {', () => '# main: runs the script.\nmain() {');
// What a check accepts beside the clean scripts: a guarded settings file, a boundary header, the environment owner.
const CORRECTIONS: Record<string, (planted: { files: Record<string, string> }) => Record<string, string>> = {
    'structure/guards': () => ({
        'scripts/settings.sh':
            '#!/usr/bin/env bash\n[[ -n ${SETTINGS_READY:-} ]] && return 0\nreadonly SETTINGS_READY=1\nreadonly PORT=8080\n',
    }),
    'structure/bash-boundaries': () => ({
        'deploy/step.sh': CLEAN.replace(
            '#!/usr/bin/env bash',
            '#!/usr/bin/env bash\n# Boundary: Owns deployment steps and their explicit input values.',
        ),
    }),
    'structure/env-access-owner': (planted) => ({ 'scripts/environment.sh': planted.files['scripts/environment.sh']! }),
};

plantedCases(
    'the bash configuration',
    {
        kits: ['bash'],
        modules: false,
        without: [],
        tools: ['shellcheck', 'shfmt'],
        files: { 'scripts/build.sh': CLEAN },
        before: (root) => {
            chmodSync(join(root, 'scripts/build.sh'), 0o755);
        },
        corrected: (planted) => ({
            files: {
                ...Object.fromEntries(Object.keys(planted.files).map((path) => [path, CLEAN])),
                ...CORRECTIONS[planted.check]?.(planted),
            },
        }),
    },
    BASH_CASES,
);

test.each([
    ['3.2', false],
    ['4.0', false],
    ['4.3', false],
    ['4.4', true],
    ['5.0', true],
] as const)('Bash %s requires only the strict-mode options its version supports', async (version, isInherited) => {
    const base = `#!/usr/bin/env bash\n#\n# Prints a greeting.\n# Runtime: Bash ${version}+, macOS and Linux.\nset -euo pipefail\n`;
    const inherited = 'shopt -s inherit_errexit\n';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['bash'], '[tools.bash]\nruntime_header = "macOS and Linux"\n', 'all'),
        'greet.sh': base + (isInherited ? inherited : '') + MAIN,
    });
    const path = join(sandbox.path, 'greet.sh');
    chmodSync(path, 0o755);
    const command = ['check', '--only', 'structure/bash-interpreter', '--json'];
    const clean = await spawnGspot(sandbox.path, command);
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
    writeFileSync(path, base + (isInherited ? '' : inherited) + MAIN);
    const broken = await spawnGspot(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect((JSON.parse(broken.stdout) as RunReport).checks).toMatchObject([
        { check: 'structure/bash-interpreter', status: 'fail' },
    ]);
    expect((JSON.parse(broken.stdout) as RunReport).checks[0]!.findings).toContainEqual(
        containing({ file: 'greet.sh', rule: isInherited ? 'strict-mode' : 'bash-version' }),
    );
    writeFileSync(path, base + (isInherited ? inherited : '') + MAIN);
    const corrected = await spawnGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'structure/bash-interpreter', status: 'ok', findings: [] },
    ]);
});
