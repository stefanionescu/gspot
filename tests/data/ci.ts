export const MISE_PROGRAM = `#!/bin/sh
[ "$1" = exec ] || exit 2
shift
while [ "$#" -gt 0 ] && [ "$1" != -- ]; do shift; done
[ "$1" = -- ] || exit 2
shift
exec "$@"
`;

export const GSPOT_PROGRAM = String.raw`#!/bin/sh
printf '%s\n' "$*" >> "$GSPOT_COMMAND_LOG"
case "$1" in
    install | check) exit 0 ;;
    *) exit 2 ;;
esac
`;

export const SETUP_CASES = [
    ['github', 0],
    ['github', 29],
    ['gitlab', 0],
    ['gitlab', 29],
] as const;

export const SETUP_ARGUMENTS = [
    '',
    'two words',
    "a'b",
    '$(touch unexpected)',
    'x; touch unexpected',
    'line\nbreak',
] as const;

export const SETUP_PROGRAM = String.raw`#!/bin/sh
printf '%s\n' "$@" > "$GSPOT_SETUP_ARGUMENTS"
printf 'setup\n' >> "$GSPOT_COMMAND_LOG"
printf 'setup out\n'
printf 'setup err\n' >&2
exit "$GSPOT_SETUP_EXIT"
`;

export const LINUX_PIPELINE = {
    version: '1.2.3',
    packageManager: { name: 'npm', version: '11.10.1' },
    operatingSystems: ['linux'],
    hasSwift: false,
    manualChecks: ['docs/lychee-external'],
} as const;

export const GITLAB_PIPELINE = `stages: [test]
application:
  script: echo authored-job
`;

export const GITHUB_PIPELINE = `on: push
jobs:
  application:
    runs-on: ubuntu-24.04
    steps:
      - run: echo authored-job
`;

export const CI_SETTINGS = `configurations = []
[rules]
enabled = false
[ci]
enabled = true
provider = "%PROVIDER%"
[[command_check]]
name = "project/syntax"
stage = "commit"
paths = ["*.sh"]
command = %SYNTAX_COMMAND%
output = { format = "lines" }
[[command_check]]
name = "project/audit"
stage = "manual"
paths = ["*.sh"]
command = %AUDIT_COMMAND%
`;
