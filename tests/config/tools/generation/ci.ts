export const DOCTOR_EXIT_CODES = [0, 37];

export const MISE_PROGRAM = `#!/bin/sh
case "$1" in trust | install) exit 0 ;; esac
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

export const SETUP_CASES = [
    ['github', true, 0],
    ['github', true, 29],
    ['github', false, 0],
    ['github', false, 29],
    ['gitlab', true, 0],
    ['gitlab', true, 29],
    ['gitlab', false, 0],
    ['gitlab', false, 29],
] as const;

export const SETUP_ARGUMENTS = ['', 'two words', "a'b", '$(touch unexpected)', 'x; touch unexpected', 'line\nbreak'];

export const SETUP_PROGRAM = String.raw`#!/bin/sh
printf '%s\n' "$@" > "$GSPOT_SETUP_ARGUMENTS"
printf 'setup\n' >> "$GSPOT_COMMAND_LOG"
printf 'setup out\n'
printf 'setup err\n' >&2
exit "$GSPOT_SETUP_EXIT"
`;

export const NPM_PROGRAM = `#!/bin/sh
[ "$*" = "install --global @gspothq/cli@1.2.3" ]
`;
