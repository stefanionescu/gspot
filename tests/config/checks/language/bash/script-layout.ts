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
