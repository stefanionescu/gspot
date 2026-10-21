import { TYPE } from '@formatjs/icu-messageformat-parser';

export const MESSAGE_FILE_SUFFIX = '.json';

/** How a message names the format of an argument, by the type of its parsed element: none, number, date, or time. */
export const ARGUMENT_FORMATS = {
    [TYPE.argument]: '',
    [TYPE.number]: ', number',
    [TYPE.date]: ', date',
    [TYPE.time]: ', time',
} as const;
