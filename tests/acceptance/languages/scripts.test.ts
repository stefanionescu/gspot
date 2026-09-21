// Planted repository for the bash preset: every check of the preset fires on its planted defect and passes without it.
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import { chmodSync, writeFileSync } from 'node:fs';
import type { PlantedCase } from '#tests/types/acceptance.ts';
import { commitAll, PLANTED_TIMEOUT_MS, run, runPlanted, script, toolsPath } from '#tests/harness/planted.ts';

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

const CASES: PlantedCase[] = [
    {
        check: 'bash/syntax',
        files: { 'scripts/broken.sh': file('main() {\n    if then\n}\n\nmain "$@"\n') },
        expected: 'syntax error',
    },
    {
        check: 'bash/shellcheck',
        files: { 'scripts/unquoted.sh': file('# main: runs the script.\nmain() {\n    echo $1\n}\n\nmain "$@"\n') },
        expected: 'SC2086',
    },
    {
        check: 'bash/shfmt',
        files: {
            'scripts/indent.sh': file('# main: runs the script.\nmain() {\n  echo "two spaces"\n}\n\nmain "$@"\n'),
        },
        expected: 'not formatted the way shfmt formats it',
    },
    {
        check: 'structure/bash-interpreter',
        files: { 'scripts/headless.sh': '#!/usr/bin/env bash\nmain() {\n    echo hi\n}\n\nmain "$@"\n' },
        expected: 'runtime-header',
        executable: ['scripts/headless.sh'],
    },
    {
        check: 'structure/doc-comment',
        files: {
            'scripts/silent.sh': file(
                `_quiet() {\n    echo one\n    echo "$1"\n    echo three\n}\n\n${MAIN.replace('echo "hello $1"', () => '_quiet "$1"\n    _quiet "$1"')}`,
            ),
        },
        expected: '_quiet has no comment above it',
    },
    {
        check: 'structure/duplicate-functions',
        files: {
            'scripts/twice.sh': file(
                `# _first: prints three lines.\n_first() {\n    echo one\n    echo two\n    echo "$1"\n}\n\n# _second: prints three lines again.\n_second() {\n    echo one\n    echo two\n    echo "$1"\n}\n\n${MAIN}`,
            ),
        },
        expected: 'These functions have the same body',
    },
    {
        check: 'structure/unused-functions',
        files: {
            'scripts/orphan.sh': file(
                `# _orphan: nobody calls this.\n_orphan() {\n    echo a\n    echo b\n    echo "$1"\n}\n\n${MAIN}`,
            ),
        },
        expected: '_orphan is called from no script',
    },
    {
        check: 'structure/dead-parameters',
        files: {
            'scripts/deaf.sh': file(
                `# _deaf: reads nothing.\n_deaf() {\n    echo a\n    echo b\n    echo c\n}\n\n# main: runs the script.\nmain() {\n    _deaf "$1" two\n    _deaf "$1" four\n}\n\nmain "$@"\n`,
            ),
        },
        expected: '_deaf is called with up to 2 argument(s) but reads no positional parameter',
    },
    {
        check: 'structure/private-prefix',
        files: {
            'scripts/local.sh': file(
                `# build_it: only this file calls it.\nbuild_it() {\n    echo a\n    echo b\n    echo "$1"\n}\n\n# main: runs the script.\nmain() {\n    build_it "$1"\n    build_it "$1"\n}\n\nmain "$@"\n`,
            ),
        },
        expected: 'build_it is called from no other file',
    },
    {
        check: 'structure/private-before-public',
        files: {
            'scripts/lib.sh': file(
                `# shared_step: other files call this one.\nshared_step() {\n    echo a\n    echo b\n    echo "$1"\n}\n\n# _late: a private function below a public one.\n_late() {\n    echo a\n    echo c\n    echo "$1"\n}\n\n# main: runs the script.\nmain() {\n    _late "$1"\n    _late "$1"\n    shared_step "$1"\n}\n\nmain "$@"\n`,
            ),
            'scripts/user.sh': file(`# main: runs the script.\nmain() {\n    shared_step "$1"\n}\n\nmain "$@"\n`),
        },
        expected: '_late',
    },
    {
        check: 'structure/trivial-function',
        files: {
            'scripts/tiny.sh': file(
                `# _tiny: one line, one caller.\n_tiny() {\n    echo "$1"\n}\n\n# main: runs the script.\nmain() {\n    _tiny "$1"\n}\n\nmain "$@"\n`,
            ),
        },
        expected: '_tiny is used once',
    },
    {
        check: 'structure/call-through',
        files: {
            'scripts/forward.sh': file(
                `# _forward: hands everything on.\n_forward() {\n    printf "$@"\n}\n\n# main: runs the script.\nmain() {\n    _forward "$1"\n    _forward "$1"\n}\n\nmain "$@"\n`,
            ),
        },
        expected: 'passes its arguments straight through to printf',
    },
    {
        check: 'structure/file-length',
        files: { 'scripts/long.sh': file(`${LONG_FILE}\n\n${MAIN}`) },
        expected: 'code lines is over the ceiling',
    },
    {
        check: 'structure/function-length',
        files: {
            'scripts/tall.sh': file(
                `# main: runs the script.\nmain() {\n    echo "$1"\n${LONG_BODY}\n}\n\nmain "$@"\n`,
            ),
        },
        expected: 'main has 71 code lines',
    },
    {
        check: 'structure/bash-script-policy',
        files: {
            'scripts/node.sh': file(
                `# main: runs the script.\nmain() {\n    node -e 'console.log(1)' "$1"\n}\n\nmain "$@"\n`,
            ),
        },
        expected: 'An inline Node snippet belongs in a .js file',
    },
    {
        check: 'structure/bash-embeds',
        files: {
            'scripts/python.sh': file(
                `# main: runs the script.\nmain() {\n    python3 - <<'PY'\nprint(1)\nPY\n}\n\nmain "$@"\n`,
            ),
        },
        expected: 'inline Python heredoc',
    },
    {
        check: 'structure/bash-ssh-blocks',
        files: {
            'scripts/remote.sh': file(
                `# main: runs the script.\nmain() {\n    ssh "$1" <<'REMOTE'\nuptime\nREMOTE\n}\n\nmain "$@"\n`,
            ),
        },
        expected: 'An ssh heredoc carries a',
    },
    {
        check: 'structure/bash-config-defaults',
        files: {
            'scripts/defaults.sh': file(
                `# main: runs the script.\nmain() {\n    local port="\${PORT:-8080}"\n    echo "\${port} $1"\n}\n\nmain "$@"\n`,
            ),
        },
        expected: 'sets a default outside the configuration owners',
    },
    {
        check: 'structure/bash-config-guards',
        files: {
            'scripts/settings.sh':
                '#!/usr/bin/env bash\n#\n# Holds the settings.\n# Runtime: Bash 4.0+, macOS and Linux.\n\nreadonly PORT=8080\n',
        },
        policy: '[tools.bash]\nconfig_owners = ["scripts/settings.sh"]\n',
        expected: 'A configuration owner opens with',
    },
    {
        check: 'structure/bash-boundaries',
        files: { 'deploy/step.sh': file(MAIN) },
        policy: '[tools.bash]\narchitecture_roots = ["deploy"]\n',
        expected: 'A script under an architecture root opens with',
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
        expected: 'DEPLOY_TARGET is read here but declared by the environment owner',
    },
    {
        check: 'structure/bash-branches',
        files: { 'scripts/branchy.sh': file(`# main: runs the script.\nmain() {\n${BRANCHES}\n}\n\nmain "$@"\n`) },
        expected: 'branches, over the ceiling',
    },
    {
        check: 'structure/bash-nesting',
        files: { 'scripts/deep.sh': file(`# main: runs the script.\nmain() {\n${NESTED}\n}\n\nmain "$@"\n`) },
        expected: 'levels of nesting, over the ceiling',
    },
    {
        check: 'structure/bash-mutable-assignments',
        files: {
            'scripts/mutable.sh': file(
                `# main: runs the script.\nmain() {\n    local total="$1"\n${ASSIGNMENTS}\n    echo "\${total}"\n}\n\nmain "$@"\n`,
            ),
        },
        expected: 'assignments, over the ceiling',
    },
    {
        check: 'structure/bash-safety',
        files: {
            'scripts/unsafe.sh': file(
                `# main: runs the script.\nmain() {\n    cd "$1"\n    rm -rf "\${HOME}/x" || true\n}\n\nmain "$@"\n`,
            ),
        },
        expected: 'a command failure is discarded with || true',
    },
];

describe('the bash preset', () => {
    test(
        'every check passes on a clean script and fires on its planted defect',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'scripts/build.sh': script.replace('main() {', () => '# main: runs the script.\nmain() {'),
            });
            chmodSync(join(sandbox.path, 'scripts/build.sh'), 0o755);
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt']) };
            await run(
                sandbox.path,
                [
                    'init',
                    '--yes',
                    '--presets',
                    'bash',
                    '--no-runner',
                    '--no-ci',
                    '--no-hooks',
                    '--no-rules',
                    '--no-install',
                ],
                environment,
            );
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            for (const planted of CASES) {
                const clean = await run(sandbox.path, ['check', '--only', planted.check, '--no-cache'], environment);
                expect(clean.code, `${planted.check} on the clean repository: ${clean.stdout}`).toBe(0);
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
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
        'gspot.toml': 'version = 1\nlevel = "all"\npresets = ["bash"]\n',
        'greet.sh': source(isInherited),
    });
    const path = join(sandbox.path, 'greet.sh');
    chmodSync(path, 0o755);
    const command = ['check', '--only', 'structure/bash-interpreter', '--no-cache'];
    const clean = await run(sandbox.path, command);
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
    writeFileSync(path, source(!isInherited));
    const broken = await run(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(broken.stdout).toContain(isInherited ? 'strict-mode' : 'bash-version');
});
