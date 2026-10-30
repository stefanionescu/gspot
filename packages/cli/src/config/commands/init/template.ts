export const LEFT_OUT_NOTES = {
    ci: 'CI stays off; run gspot set ci.enabled true',
    paths: 'names paths of that repository',
    code: 'runs code',
    repository: 'describes that repository',
    check: 'ignores a command check',
} as const;

export const LOCAL_RECORDS = { scope: 'path', import_rule: 'name', command_check: 'id' } as const;

export const FROM_CONFLICT_MESSAGE = 'takes the configurations of its file. Leave out';

export const FROM_OPTION = '--from <file>';
