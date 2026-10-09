/** Native EditorConfig findings that formatters do not replace. */
export const EDITORCONFIG_VIOLATIONS = [
    { file: 'line-endings.txt', broken: 'content\r\n', corrected: 'content\n' },
    { file: 'final-newline.txt', broken: 'content', corrected: 'content\n' },
    { file: 'trailing-whitespace.txt', broken: 'content \n', corrected: 'content\n' },
];
