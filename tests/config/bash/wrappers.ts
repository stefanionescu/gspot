export const SINGLE_CALL_CASES = [
    {
        check: 'bash/wrappers',
        files: {
            'scripts/build.sh': '#!/usr/bin/env bash\nexec bash scripts/target.sh\n',
        },
        expected: { file: 'scripts/build.sh', rule: 'forwarding-wrapper', line: 2 },
    },
] as const;
