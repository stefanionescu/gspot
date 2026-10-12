import { BASH_HEADER } from '#tests/config/bash/tools.ts';

export const SSH_BLOCK_CASES = [
    {
        check: 'bash/ssh-blocks',
        files: {
            'scripts/remote.sh': `${BASH_HEADER}# main: runs the script.
main() {
    ssh "$1" <<'REMOTE'
uptime
REMOTE
}

main "$@"
`,
        },
        expected: { file: 'scripts/remote.sh', rule: 'undocumented-block', line: 10 },
        corrected: {
            files: {
                'scripts/remote.sh': `${BASH_HEADER}# main: runs the script.
main() {
    # restart_remote: restarts the remote service.
    ssh "$1" <<'REMOTE'
uptime
REMOTE
}

main "$@"
`,
            },
        },
    },
] as const;
