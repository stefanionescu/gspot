import {
    TEXT_ATTRIBUTE,
    FILTER_ATTRIBUTE,
    VENDORED_ATTRIBUTE,
    GENERATED_ATTRIBUTE,
} from '#cli/config/repository/files/classify.ts';

export const GIT_CHECK_ATTRIBUTES_ARGUMENTS = [
    'check-attr',
    '--stdin',
    '-z',
    GENERATED_ATTRIBUTE,
    VENDORED_ATTRIBUTE,
    TEXT_ATTRIBUTE,
    FILTER_ATTRIBUTE,
] as const;

export const FILE_PREFIX_BYTES = 4096;

export const ROOT_SCOPE = { path: '', origin: 'root' } as const;
