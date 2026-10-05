/** Native defects include POSIX shell, a shebangless Bash script, Bats, and a scoped script. */
export const DIALECT_SOURCES = {
    'posix.sh': '#!/bin/sh\nif [[ -n "$1" ]]; then\n    printf "%s\\n" "$1"\nfi\n',
    'dash.sh': '#!/bin/dash\nif [[ -n "$1" ]]; then\n    printf "%s\\n" "$1"\nfi\n',
    'fallback.sh': 'if [[ -n "$1" ]]; then\n    printf "%s\\n" "$1"\nfi\n',
    'unchecked.sh': '#!/bin/bash\ndir="${1:-.}"\ncd "${dir}"\nprintf "%s\\n" ready\n',
    'sample.bats': '@test "example" {\n    true\n}\n',
    'app/posix.sh': '#!/bin/sh\nif [[ -n "$1" ]]; then\n    printf "%s\\n" "$1"\nfi\n',
};

export const DIALECT_CORRECTIONS = {
    ...DIALECT_SOURCES,
    'posix.sh': '#!/bin/sh\nif [ -n "$1" ]; then\n    printf "%s\\n" "$1"\nfi\n',
    'dash.sh': '#!/bin/dash\nif [ -n "$1" ]; then\n    printf "%s\\n" "$1"\nfi\n',
    'unchecked.sh': '#!/bin/bash\ndir="${1:-.}"\ncd "${dir}" && printf "%s\\n" ready\n',
    'app/posix.sh': '#!/bin/sh\nif [ -n "$1" ]; then\n    printf "%s\\n" "$1"\nfi\n',
};
