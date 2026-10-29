export const SCRIPT_LAYOUT_CASES = [
    {
        check: 'bash/script-layout',
        files: {
            'scripts/headless.sh': `#!/usr/bin/env bash
main() {
    echo hi
}

main "$@"
`,
        },
        expected: { file: 'scripts/headless.sh', rule: 'strict-mode', line: 2 },
        executable: ['scripts/headless.sh'],
    },
] as const;

export const ENVIRONMENT_READER_SCOPE_TABLES = `[[scope]]
path = "tools"
configurations = ["bash"]
[scope.structure]
environment_readers = { value = ["tools/env.sh"], reason = "This script reads the process environment." }
`;

export const LAYOUT_RULE_CASES = [
    { rule: 'shebang', source: 'VALUE=1\n', corrected: '#!/usr/bin/env bash\nVALUE=1\n', executable: false },
    {
        rule: 'main-function',
        source: '#!/usr/bin/env bash\nset -euo pipefail\nrun() { true; }\nmain "$@"\n',
        corrected: '#!/usr/bin/env bash\nset -euo pipefail\nmain() { true; }\nmain "$@"\n',
        executable: true,
    },
    {
        rule: 'main-call',
        source: '#!/usr/bin/env bash\nset -euo pipefail\nmain() { true; }\nmain\n',
        corrected: '#!/usr/bin/env bash\nset -euo pipefail\nmain() { true; }\nmain "$@"\n',
        executable: true,
    },
    {
        rule: 'library-options',
        source: '#!/usr/bin/env bash\nset -euo pipefail\n',
        corrected: '#!/usr/bin/env bash\nVALUE=1\n',
        executable: false,
    },
    {
        rule: 'library-main',
        source: '#!/usr/bin/env bash\nmain() { true; }\n',
        corrected: '#!/usr/bin/env bash\nrun() { true; }\n',
        executable: false,
    },
    {
        rule: 'library-exit',
        source: '#!/usr/bin/env bash\nexit 0\n',
        corrected: '#!/usr/bin/env bash\nVALUE=1\n',
        executable: false,
    },
    {
        rule: 'executable-bit',
        source: '#!/usr/bin/env bash\nset -euo pipefail\nmain() { true; }\nmain "$@"\n',
        corrected: '#!/usr/bin/env bash\nset -euo pipefail\nmain() { true; }\nmain "$@"\n',
        executable: false,
    },
] as const;
