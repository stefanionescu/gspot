/** Selectors that EditorConfig cannot express in a section. */
export const EDITORCONFIG_SELECTOR_ERRORS = [
    {
        pattern: 'src/*.+(ts|js)',
        message:
            'EditorConfig cannot represent selector "src/*.+(ts|js)". Keep this override in a `[[format.override]]` record with a selector that EditorConfig can read.',
    },
    {
        pattern: '!src/*.js',
        message:
            'EditorConfig cannot represent selector "!src/*.js". Keep this override in a `[[format.override]]` record with a selector that EditorConfig can read.',
    },
] as const;
