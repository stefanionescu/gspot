export const NODE_EMBEDS = ['node -e "console.log(1)"\n', 'node -p "1 + 1"\n', "node <<'JS'\nconsole.log(1)\nJS\n"];

export const SIMPLE_EXECUTABLE =
    '#!/usr/bin/env bash\nset -euo pipefail\nVALUE=1\nDIRECTORY=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)\nprintf "%s\\n" "$VALUE $DIRECTORY"\n';

export const GENERATED_LAUNCHERS = {
    gradlew: '#!/bin/sh\nbroken (\n',
    'android/gradlew.bat': '@echo off\r\n',
    mvnw: '#!/bin/sh\nbroken (\n',
    'server/mvnw.cmd': '@echo off\r\n',
};
