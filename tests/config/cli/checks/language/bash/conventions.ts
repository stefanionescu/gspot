export const SCRIPT =
    '#!/usr/bin/env bash\nset -euo pipefail\n\n# main: deploys the release.\nmain() {\n    echo "$1"\n}\n\nrun_step() {\n    echo "$1"\n}\n\nssh "$1" <<REMOTE\n    cd /srv\n    ./restart\nREMOTE\n\nmain "$@"\n';

export const ONLY = ['bash/ssh-blocks', 'bash/unused-functions', 'bash/contract'];
