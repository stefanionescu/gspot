import { TYPE } from '@formatjs/icu-messageformat-parser';

// drizzle generated config

export const DRIZZLE_RULES = ['drizzle/enforce-delete-with-where', 'drizzle/enforce-update-with-where'] as const;

// testing-library generated config

export const TESTING_LIBRARY_DEFAULT_PRESET = 'dom';

export const TESTING_LIBRARY_PRESETS: readonly string[] = ['angular', 'dom', 'marko', 'react', 'svelte', 'vue'];

export const TESTING_LIBRARY_SCOPE = '@testing-library/';

export const TESTING_LIBRARY_SETTINGS = {
    'testing-library/utils-module': 'off',
    'testing-library/custom-renders': 'off',
    'testing-library/custom-queries': 'off',
} as const;

// translations checks

export const ARGUMENT_FORMATS = {
    [TYPE.argument]: '',
    [TYPE.number]: ', number',
    [TYPE.date]: ', date',
    [TYPE.time]: ', time',
} as const;

export const EMPTY_MESSAGE = 'The message is empty.';

export const PLURAL_FORMAT = ', plural';

export const TRANSLATION_RULES = {
    extraKey: 'extra-key',
    baseLocale: 'base-locale',
    message: 'message',
    missingKey: 'missing-key',
    messageArguments: 'message-arguments',
} as const;

// zustand generated config

export const CREATE_STORE_MESSAGE =
    'Create stores only in the files of `zustand.store_files`, inside a factory that a provider owns.';

export const ZUSTAND_STORE_IMPORTS = [
    { name: 'zustand', importNames: ['create', 'createStore'] },
    { name: 'zustand/vanilla', importNames: ['createStore'] },
] as const;
