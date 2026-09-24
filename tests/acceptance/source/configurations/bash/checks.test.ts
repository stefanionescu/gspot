import { reportSchema } from '#cli/output/schema.ts';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { chmodSync, writeFileSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { runPlanted, script } from '#tests/support/cli/planted.ts';
// Bash defects have independent diagnostics and corrected execution under the same policy.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { installPrivateTools, toolsPath } from '#tests/support/cli/tools.ts';

const HEAD =
    '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\n';
const MAIN = '# main: runs the script.\nmain() {\n    echo "hello $1"\n}\n\nmain "$@"\n';
const LONG_BODY = Array.from({ length: 70 }, (_, index) => `    echo "line ${String(index)}"`).join('\n');
const LONG_FILE = Array.from({ length: 320 }, (_, index) => `readonly VALUE_${String(index)}=${String(index)}`).join(
    '\n',
);
const BRANCHES = Array.from(
    { length: 12 },
    (_, index) => `    if [[ "$1" == "${String(index)}" ]]; then echo ${String(index)}; fi`,
).join('\n');
const NESTED =
    '    if [[ -n "$1" ]]; then\n        for item in "$@"; do\n            while true; do\n                if [[ -n "${item}" ]]; then\n                    case "${item}" in\n                        a) echo a ;;\n                    esac\n                fi\n                break\n            done\n        done\n    fi';
const ASSIGNMENTS = Array.from({ length: 14 }, (_, index) => `    total="\${total}${String(index)}"`).join('\n');

function file(body: string): string {
    return `${HEAD}${body}`;
}

const CASES: FindingCase[] = [
    {
        check: 'bash/syntax',
        files: { 'scripts/broken.sh': file('main() {\n    if then\n}\n\nmain "$@"\n') },
        expected: { file: 'scripts/broken.sh', line: 9 },
    },
    {
        check: 'bash/shellcheck',
        files: { 'scripts/unquoted.sh': file('# main: runs the script.\nmain() {\n    echo $1\n}\n\nmain "$@"\n') },
        expected: { file: 'scripts/unquoted.sh', rule: 'SC2086', line: 10 },
    },
    {
        check: 'bash/shfmt',
        files: {
            'scripts/indent.sh': file('# main: runs the script.\nmain() {\n  echo "two spaces"\n}\n\nmain "$@"\n'),
        },
        expected: { file: 'scripts/indent.sh' },
    },
    {
        check: 'structure/bash-interpreter',
        files: { 'scripts/headless.sh': '#!/usr/bin/env bash\nmain() {\n    echo hi\n}\n\nmain "$@"\n' },
        expected: { file: 'scripts/headless.sh', rule: 'runtime-header', line: 4 },
        executable: ['scripts/headless.sh'],
    },
    {
        check: 'structure/doc-comment',
        files: {
            'scripts/silent.sh': file(
                `_quiet() {\n    echo one\n    echo "$1"\n    echo three\n}\n\n${MAIN.replace('echo "hello $1"', () => '_quiet "$1"\n    _quiet "$1"')}`,
            ),
        },
        expected: { file: 'scripts/silent.sh', rule: 'missing', line: 8 },
    },
    {
        check: 'structure/duplicate-functions',
        files: {
            'scripts/twice.sh': file(
                `# _first: prints three lines.\n_first() {\n    echo one\n    echo two\n    echo "$1"\n}\n\n# _second: prints three lines again.\n_second() {\n    echo one\n    echo two\n    echo "$1"\n}\n\n${MAIN}`,
            ),
        },
        expected: { file: 'scripts/twice.sh', rule: 'same-body', line: 9 },
    },
    {
        check: 'structure/unused-functions',
        files: {
            'scripts/orphan.sh': file(
                `# _orphan: nobody calls this.\n_orphan() {\n    echo a\n    echo b\n    echo "$1"\n}\n\n${MAIN}`,
            ),
        },
        expected: { file: 'scripts/orphan.sh', rule: 'never-called', line: 9 },
    },
    {
        check: 'structure/dead-parameters',
        files: {
            'scripts/deaf.sh': file(
                `# _deaf: reads nothing.\n_deaf() {\n    echo a\n    echo b\n    echo c\n}\n\n# main: runs the script.\nmain() {\n    _deaf "$1" two\n    _deaf "$1" four\n}\n\nmain "$@"\n`,
            ),
        },
        expected: { file: 'scripts/deaf.sh', rule: 'unread-arguments', line: 9 },
    },
    {
        check: 'structure/private-prefix',
        files: {
            'scripts/local.sh': file(
                `# build_it: only this file calls it.\nbuild_it() {\n    echo a\n    echo b\n    echo "$1"\n}\n\n# main: runs the script.\nmain() {\n    build_it "$1"\n    build_it "$1"\n}\n\nmain "$@"\n`,
            ),
        },
        expected: { file: 'scripts/local.sh', rule: 'file-local', line: 9 },
    },
    {
        check: 'structure/private-before-public',
        files: {
            'scripts/lib.sh': file(
                `# shared_step: other files call this one.\nshared_step() {\n    echo a\n    echo b\n    echo "$1"\n}\n\n# _late: a private function below a public one.\n_late() {\n    echo a\n    echo c\n    echo "$1"\n}\n\n# main: runs the script.\nmain() {\n    _late "$1"\n    _late "$1"\n    shared_step "$1"\n}\n\nmain "$@"\n`,
            ),
            'scripts/user.sh': file(`# main: runs the script.\nmain() {\n    shared_step "$1"\n}\n\nmain "$@"\n`),
        },
        expected: { file: 'scripts/lib.sh', rule: 'private-below-public', line: 16 },
    },
    {
        check: 'structure/trivial-function',
        files: {
            'scripts/tiny.sh': file(
                `# _tiny: one line, one caller.\n_tiny() {\n    echo "$1"\n}\n\n# main: runs the script.\nmain() {\n    _tiny "$1"\n}\n\nmain "$@"\n`,
            ),
        },
        expected: { file: 'scripts/tiny.sh', rule: 'trivial-function', line: 9 },
    },
    {
        check: 'structure/trivial-function',
        files: {
            'scripts/forward.sh': file(
                `# _forward: hands everything on.\n_forward() {\n    printf "$@"\n}\n\n# main: runs the script.\nmain() {\n    _forward "$1"\n    _forward "$1"\n}\n\nmain "$@"\n`,
            ),
        },
        expected: { file: 'scripts/forward.sh', rule: 'trivial-function', line: 9 },
    },
    {
        check: 'structure/file-length',
        files: { 'scripts/long.sh': file(`${LONG_FILE}\n\n${MAIN}`) },
        expected: { file: 'scripts/long.sh', rule: 'file-lines', line: 1 },
    },
    {
        check: 'structure/function-length',
        files: {
            'scripts/tall.sh': file(
                `# main: runs the script.\nmain() {\n    echo "$1"\n${LONG_BODY}\n}\n\nmain "$@"\n`,
            ),
        },
        expected: { file: 'scripts/tall.sh', rule: 'function-lines', line: 9 },
    },
    {
        check: 'structure/bash-script-policy',
        files: {
            'scripts/node.sh': file(
                `# main: runs the script.\nmain() {\n    node -e 'console.log(1)' "$1"\n}\n\nmain "$@"\n`,
            ),
        },
        expected: { file: 'scripts/node.sh', rule: 'inline-node', line: 10 },
    },
    {
        check: 'structure/bash-embeds',
        files: {
            'scripts/python.sh': file(
                `# main: runs the script.\nmain() {\n    python3 - <<'PY'\nprint(1)\nPY\n}\n\nmain "$@"\n`,
            ),
        },
        expected: { file: 'scripts/python.sh', rule: 'runtime-embed', line: 10 },
    },
    {
        check: 'structure/bash-ssh-blocks',
        files: {
            'scripts/remote.sh': file(
                `# main: runs the script.\nmain() {\n    ssh "$1" <<'REMOTE'\nuptime\nREMOTE\n}\n\nmain "$@"\n`,
            ),
        },
        expected: { file: 'scripts/remote.sh', rule: 'undocumented-heredoc', line: 10 },
    },
    {
        check: 'structure/bash-config-defaults',
        files: {
            'scripts/defaults.sh': file(
                `# main: runs the script.\nmain() {\n    local port="\${PORT:-8080}"\n    echo "\${port} $1"\n}\n\nmain "$@"\n`,
            ),
        },
        expected: { file: 'scripts/defaults.sh', rule: 'default-outside-owner', line: 10 },
    },
    {
        check: 'structure/bash-config-guards',
        files: {
            'scripts/settings.sh':
                '#!/usr/bin/env bash\n#\n# Holds the settings.\n# Runtime: Bash 4.0+, macOS and Linux.\n\nreadonly PORT=8080\n',
        },
        policy: '[tools.bash]\nconfig_owners = ["scripts/settings.sh"]\n',
        expected: { file: 'scripts/settings.sh', rule: 'guard-first', line: 6 },
    },
    {
        check: 'structure/bash-boundaries',
        files: { 'deploy/step.sh': file(MAIN) },
        policy: '[tools.bash]\narchitecture_roots = ["deploy"]\n',
        expected: { file: 'deploy/step.sh', rule: 'boundary-header', line: 1 },
        executable: ['deploy/step.sh'],
    },
    {
        check: 'structure/env-access-owner',
        files: {
            'scripts/environment.sh':
                '#!/usr/bin/env bash\n#\n# Owns the environment.\n# Runtime: Bash 4.0+, macOS and Linux.\n\nreadonly DEPLOY_TARGET="${1:-}"\n',
            'scripts/reader.sh': file(
                `# main: runs the script.\nmain() {\n    echo "\${DEPLOY_TARGET} $1"\n}\n\nmain "$@"\n`,
            ),
        },
        policy: '[architecture]\nroles = { env = "scripts/environment.sh" }\n',
        expected: { file: 'scripts/reader.sh', rule: 'read-outside-owner', line: 10 },
    },
    {
        check: 'structure/bash-branches',
        files: { 'scripts/branchy.sh': file(`# main: runs the script.\nmain() {\n${BRANCHES}\n}\n\nmain "$@"\n`) },
        expected: { file: 'scripts/branchy.sh', rule: 'function-branches', line: 9 },
    },
    {
        check: 'structure/bash-nesting',
        files: { 'scripts/deep.sh': file(`# main: runs the script.\nmain() {\n${NESTED}\n}\n\nmain "$@"\n`) },
        expected: { file: 'scripts/deep.sh', rule: 'function-nesting', line: 9 },
    },
    {
        check: 'structure/bash-mutable-assignments',
        files: {
            'scripts/mutable.sh': file(
                `# main: runs the script.\nmain() {\n    local total="$1"\n${ASSIGNMENTS}\n    echo "\${total}"\n}\n\nmain "$@"\n`,
            ),
        },
        expected: { file: 'scripts/mutable.sh', rule: 'mutable-assignments', line: 9 },
    },
    {
        check: 'structure/bash-safety',
        files: {
            'scripts/unsafe.sh': file(
                `# main: runs the script.\nmain() {\n    cd "$1"\n    rm -rf "\${HOME}/x" || true\n}\n\nmain "$@"\n`,
            ),
        },
        expected: { file: 'scripts/unsafe.sh', rule: 'blanket-success', line: 11 },
    },
];

describe('the bash configuration', () => {
    test.each(CASES)(
        '$check reports its defect in $expected.file and accepts corrected scripts',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'scripts/build.sh': script.replace('# gspot-ignore', () => '# main: runs the script.\n# gspot-ignore'),
            });
            chmodSync(join(sandbox.path, 'scripts/build.sh'), 0o755);
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt']) };
            const initialized = await run(
                sandbox.path,
                [
                    'init',
                    '--yes',
                    '--configurations',
                    'bash',
                    '--no-runner',
                    '--no-ci',
                    '--no-hooks',
                    '--no-rules',
                    '--no-install',
                ],
                environment,
            );
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
