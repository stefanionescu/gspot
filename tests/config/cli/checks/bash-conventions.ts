export const SCRIPT =
    '#!/usr/bin/env bash\nset -euo pipefail\n\n# main: deploys the release.\nmain() {\n    echo "$1"\n}\n\nrun_step() {\n    echo "$1"\n}\n\nrun_remote "$1" "\n    cd /srv\n    ./restart\n"\n\nmain "$@"\n';

export const ONLY = ['bash/ssh-blocks', 'bash/unused-functions', 'bash/contract'];

// The rules the three conventions decide; the script is not executable, which the interpreter check also reports.
export const RULES = new Set(['never-called', 'unnamed-block', 'header', 'runtime-header']);
