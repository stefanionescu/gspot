export const SAFETY_SOURCES = [
    { source: 'tmp=$(mktemp)\ntrap \'tmp=/etc; rm -rf "$tmp"\' EXIT\n', unsafeLines: [4] },
    { source: 'tmp=$(mktemp)\ntrap \'rm -rf "$tmp"\' EXIT; rm -rf /etc\n', unsafeLines: [4] },
    { source: "tmp=$(mktemp)\ntrap 'rm -rf \"$tmp\"' EXIT; trap 'rm -rf /etc' HUP\n", unsafeLines: [4] },
    { source: 'tmp=$(mktemp -d)\ntrap \'rm -rf -- "$tmp"\' EXIT\n', unsafeLines: [] },
    { source: 'tmp=$(mktemp -d)\ntrap \'rm -rf "$tmp" /etc\' EXIT\n', unsafeLines: [4] },
    { source: 'tmp=$(mktemp -d)\ntrap \'rm -rf "$tmp"; rm -rf /etc\' EXIT\n', unsafeLines: [4] },
    { source: 'tmp=$(mktemp -d)\ntmp=/etc\ntrap \'rm -rf "$tmp"\' EXIT\n', unsafeLines: [5] },
    { source: 'rm -rf /etc\n', unsafeLines: [3] },
];

export const SUCCESS_SOURCE = '#!/usr/bin/env bash\nset -euo pipefail\ncommand_that_may_fail || true\n';

export const NAMED_PATHS_SOURCE =
    '#!/usr/bin/env bash\nset -euo pipefail\nsource snapshot_config.sh\nprintf "%s\\n" "${HOME}/.cache" /root/.cache /dev/shm/* /tmp/example*\n';

export const WRONG_CLEANUP_SOURCE =
    "#!/usr/bin/env bash\nset -euo pipefail\ntmp=$(mktemp -d)\ntrap 'rm -rf /etc' EXIT\n";

export const RIGHT_CLEANUP_SOURCE =
    '#!/usr/bin/env bash\nset -euo pipefail\ntmp=$(mktemp -d)\ntrap \'rm -rf -- "$tmp"\' EXIT\n';
