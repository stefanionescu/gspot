import { BASH_HEADER } from '#tests/config/checks/samples.ts';

export const CLEAN_BASH_SCRIPT = `${BASH_HEADER}# main: runs the script.
main() {
    local name="world"
    local greeting="hello \${name}"
    echo "\${greeting}"
}

main "$@"
`;

export const BASH_SANDBOX = {
    cleanSource: CLEAN_BASH_SCRIPT,
    configurations: ['bash', 'javascript'],
    files: {
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'scripts/b.sh': CLEAN_BASH_SCRIPT,
        'scripts/build.sh': CLEAN_BASH_SCRIPT,
        'package.json': '{"private":true}\n',
    },
} as const;
