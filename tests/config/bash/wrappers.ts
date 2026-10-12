export const SINGLE_CALL_CASES = [
    {
        check: 'bash/wrappers',
        files: {
            'scripts/build.sh': '#!/usr/bin/env bash\nexec bash scripts/target.sh\n',
        },
        expected: { file: 'scripts/build.sh', rule: 'forwarding-wrapper', line: 2 },
    },
] as const;

export const INCLUDE_GUARD_CASES = [
    {
        check: 'bash/include-guards',
        files: {
            'scripts/settings.sh': `#!/usr/bin/env bash
#
# Holds the settings.
# Runtime: Bash 4.0+, macOS and Linux.

readonly PORT=8080
`,
        },
        settings: '[architecture]\nroles = { environment_readers = ["scripts/settings.sh"] }\n',
        expected: { file: 'scripts/settings.sh', rule: 'guard-first', line: 6 },
        corrected: {
            files: {
                'scripts/settings.sh': `#!/usr/bin/env bash
[[ -n \${SETTINGS_READY:-} ]] && return 0
readonly SETTINGS_READY=1
readonly PORT=8080
`,
            },
        },
    },
] as const;
