export const MODE_REPLACEMENTS = [
    { original: 0o444, replacement: 0o644, content: 'replacement', posix: false },
    { original: 0o640, replacement: 0o444, content: 'replacement\n', posix: true },
] as const;

export const OUTSIDE_LINKS = [
    {
        path: 'escape/sentinel',
        refusal: 'A parent of escape/sentinel is a link or is not a directory. Choose a directory without links.',
    },
    {
        path: 'linked',
        refusal: 'linked is not a regular file with one link. Use a regular file without extra hard links.',
    },
    {
        path: 'hardlinked',
        refusal: 'hardlinked is not a regular file with one link. Use a regular file without extra hard links.',
    },
] as const;
