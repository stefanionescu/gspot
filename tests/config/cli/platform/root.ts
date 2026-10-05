export const UNSAFE_DESTINATIONS = [
    { path: 'escape/sentinel', refusal: 'Unsafe lifecycle parent: escape/sentinel' },
    { path: 'linked', refusal: 'Lifecycle destination is not a private regular file: linked' },
    { path: 'hardlinked', refusal: 'Lifecycle destination is not a private regular file: hardlinked' },
];

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
