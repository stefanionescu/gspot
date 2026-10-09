export const HEAD =
    '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\n';

export const BASH_CASES_MAIN = '# main: runs the script.\nmain() {\n    echo "hello $1"\n}\n\nmain "$@"\n';

/** A clean bash script every sandbox starts from. Its main holds enough statements not to be trivial. */
export const CLEAN_BASH_SCRIPT = `${HEAD}# main: runs the script.\nmain() {\n    local name="$1"\n    local greeting="hello \${name}"\n    echo "\${greeting}"\n}\n\nmain "$@"\n`;
