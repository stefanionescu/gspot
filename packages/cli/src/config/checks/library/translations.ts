import { TYPE } from '@formatjs/icu-messageformat-parser';

export const MESSAGE_FILE_SUFFIX = '.json';

export const ARGUMENT_FORMATS = {
    [TYPE.argument]: '',
    [TYPE.number]: ', number',
    [TYPE.date]: ', date',
    [TYPE.time]: ', time',
} as const;

export const EMPTY_MESSAGE = 'The message is empty.';

export const PLURAL_FORMAT = ', plural';

export const RULES = {
    extraKey: 'extra-key',
    baseLocale: 'base-locale',
    message: 'message',
    missingKey: 'missing-key',
    messageArguments: 'message-arguments',
} as const;
