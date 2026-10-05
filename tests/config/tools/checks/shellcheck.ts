/** Native cases include dialect defects and temporary cleanup in root and nested scopes. */
export const DIALECT_SOURCES = {
    'posix.sh': '#!/bin/sh\nif [[ -n "$1" ]]; then\n    printf "%s\\n" "$1"\nfi\n',
    'dash.sh': '#!/bin/dash\nif [[ -n "$1" ]]; then\n    printf "%s\\n" "$1"\nfi\n',
    'fallback.sh': 'if [[ -n "$1" ]]; then\n    printf "%s\\n" "$1"\nfi\n',
    'unchecked.sh': '#!/bin/bash\ndir="${1:-.}"\ncd "${dir}"\nprintf "%s\\n" ready\n',
    'sample.bats': '@test "example" {\n    true\n}\n',
    'temporary.sh': '#!/bin/bash\nset -euo pipefail\ntmp=$(mktemp -d)\ntrap \'rm -rf -- "$tmp"\' EXIT\n',
    'app/posix.sh': '#!/bin/sh\nif [[ -n "$1" ]]; then\n    printf "%s\\n" "$1"\nfi\n',
    'app/temporary.sh': '#!/bin/bash\nset -euo pipefail\ntmp=$(mktemp -d)\ntrap \'rm -rf -- "$tmp"\' EXIT\n',
};

export const DIALECT_CORRECTIONS = {
    ...DIALECT_SOURCES,
    'posix.sh': '#!/bin/sh\nif [ -n "$1" ]; then\n    printf "%s\\n" "$1"\nfi\n',
    'dash.sh': '#!/bin/dash\nif [ -n "$1" ]; then\n    printf "%s\\n" "$1"\nfi\n',
    'unchecked.sh': '#!/bin/bash\ndir="${1:-.}"\ncd "${dir}" && printf "%s\\n" ready\n',
    'app/posix.sh': '#!/bin/sh\nif [ -n "$1" ]; then\n    printf "%s\\n" "$1"\nfi\n',
};
