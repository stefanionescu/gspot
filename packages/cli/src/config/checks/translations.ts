import { TYPE } from '@formatjs/icu-messageformat-parser';

export const MESSAGE_FILE_SUFFIX = '.json';

export const ARGUMENT_FORMATS = {
    [TYPE.argument]: '',
    [TYPE.number]: ', number',
    [TYPE.date]: ', date',
    [TYPE.time]: ', time',
} as const;
