import { CLEAN_BASH_SCRIPT } from '#tests/config/bash/tools.ts';

export const BASH_REPOSITORY = {
    configurations: ['bash', 'javascript'],
    files: {
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        'scripts/b.sh': CLEAN_BASH_SCRIPT,
        'scripts/build.sh': CLEAN_BASH_SCRIPT,
        'package.json': '{"private":true}\n',
    },
} as const;
