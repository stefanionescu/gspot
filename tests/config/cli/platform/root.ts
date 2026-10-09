export const ROOT_REPLACEMENTS = [
    { original: 0o444, replacement: 0o644, content: 'replacement', posix: false },
    { original: 0o640, replacement: 0o444, content: 'replacement\n', posix: true },
];

export const UNSAFE_DESTINATIONS = [
    { path: 'escape/sentinel', refusal: 'Unsafe lifecycle parent: escape/sentinel' },
    { path: 'linked', refusal: 'Lifecycle destination is not a private regular file: linked' },
    { path: 'hardlinked', refusal: 'Lifecycle destination is not a private regular file: hardlinked' },
];

export const NATIVE_PATH_REFUSALS = ['../outside', '/outside', 'folder/../outside', 'nul\0suffix'];

export const LINK_TARGET_REFUSALS = [
    { target: '../outside/sentinel', refusal: 'Unsafe lifecycle path: "../outside/sentinel"' },
    { target: '/etc/passwd', refusal: 'Unsafe lifecycle link target: tool' },
    { target: 'escape/sentinel', refusal: 'Unsafe lifecycle parent: escape/sentinel' },
    { target: 'escaped-file', refusal: 'Lifecycle destination is not a private regular file: escaped-file' },
    { target: 'escape/../target', refusal: 'Lifecycle link target must use a normalized relative path: tool' },
    {
        target: '.gspot/state/ownership.json',
        refusal: 'Lifecycle metadata is not a generated target: .gspot/state/ownership.json',
    },
    { target: 'missing', refusal: 'Lifecycle link target is missing: tool' },
    { target: 'target\u0000outside', refusal: 'Unsafe lifecycle link target: tool' },
    { target: String.raw`C:\outside`, refusal: 'Unsafe lifecycle link target: tool' },
];

/** These legal POSIX names expose the pinned Bun runtime's verified macOS canonicalization prerequisite. */
export const POSIX_CANONICAL_ROOT = String.raw`project\files`;
export const POSIX_CANONICAL_SOURCE = String.raw`source\name`;
