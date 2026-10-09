import type { Pipeline } from '#cli/types/generation/ci.ts';

export const PIPELINE: Pipeline = {
    version: '1.2.3',
    platforms: ['linux'],
    hasSwift: false,
    isMise: true,
    manualChecks: ['security/codeql'],
};

export const DOCTOR_EXIT_CODES = [0, 37];

export const MISE_PROGRAM = `#!/bin/sh
[ "$1" = exec ] && [ "$2" = -- ] || exit 2
shift 2
exec "$@"
`;

export const GSPOT_PROGRAM = String.raw`#!/bin/sh
printf '%s\n' "$*" >> "$GSPOT_COMMAND_LOG"
case "$1" in
    install | check) exit 0 ;;
    doctor) exit "$GSPOT_DOCTOR_EXIT" ;;
    *) exit 2 ;;
esac
`;
