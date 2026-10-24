export const MODE_REPLACEMENTS = [
    { original: 0o444, replacement: 0o644, content: 'replacement', posix: false },
    { original: 0o640, replacement: 0o444, content: 'replacement\n', posix: true },
] as const;

export const OUTSIDE_LINKS = [
    {
        path: 'escape/sentinel',
        refusal: 'A parent of escape/sentinel is a link or is not a folder. Choose a folder without links.',
    },
    {
        path: 'linked',
        refusal: 'linked is not a regular file. Use a regular file.',
    },
] as const;
