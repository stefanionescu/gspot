import type { InstalledScenario } from '#tests/types/harness/repository.ts';

export const CLEAN =
    '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\n# main: runs the script.\nmain() {\n    local name="$1"\n    local greeting="hello ${name}"\n    echo "${greeting}"\n}\n\nmain "$@"\n';

export const REPOSITORY: InstalledScenario = {
    configurations: ['bash'],

    tools: ['shellcheck', 'shfmt'],
    files: { 'scripts/build.sh': CLEAN },
};
