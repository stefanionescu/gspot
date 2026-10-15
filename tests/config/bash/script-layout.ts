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

export const SCOPE_READER_FILES = { 'tools/env.sh': '#!/usr/bin/env bash\nload_environment\n' } as const;

export const SCOPE_READER_SETTINGS = `[[scope]]
path = "tools"
configurations = ["bash"]
[scope.architecture.roles]
environment_readers = ["tools/env.sh"]
`;
