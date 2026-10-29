import { CLEAN_BASH_SCRIPT } from '#tests/config/bash.ts';

export const FILE_FOLDER_CLASH_CASES = [
    {
        check: 'structure/file-folder-clashes',
        corrected: {
            files: {
                'jobs/turned.sh': CLEAN_BASH_SCRIPT,
                'jobs/turn/first.sh': CLEAN_BASH_SCRIPT,
                'jobs/turn/second.sh': CLEAN_BASH_SCRIPT,
            },
        },
        files: {
            'jobs/turn.sh': CLEAN_BASH_SCRIPT,
            'jobs/turn/first.sh': CLEAN_BASH_SCRIPT,
            'jobs/turn/second.sh': CLEAN_BASH_SCRIPT,
        },
        expected: {
            file: 'jobs/turn.sh',
            rule: 'file-folder-clash',
            line: 1,
        },
    },
] as const;
