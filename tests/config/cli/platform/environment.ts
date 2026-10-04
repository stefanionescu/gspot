export const MISE_DIRECTORY_CASES = [
    {
        name: 'an explicit mise directory overrides XDG',
        mise: 'chosen-mise',
        xdg: 'chosen-xdg',
        expected: ['chosen-mise'],
    },
    {
        name: 'an explicit mise directory works without XDG',
        mise: 'chosen-mise',
        xdg: undefined,
        expected: ['chosen-mise'],
    },
    { name: 'XDG selects its mise subdirectory', mise: undefined, xdg: 'chosen-xdg', expected: ['chosen-xdg', 'mise'] },
    {
        name: 'an empty mise override falls through to XDG',
        mise: '',
        xdg: 'chosen-xdg',
        expected: ['chosen-xdg', 'mise'],
    },
    {
        name: 'absent overrides select the home-directory default',
        mise: undefined,
        xdg: undefined,
        expected: ['.local', 'share', 'mise'],
    },
    {
        name: 'empty overrides select the home-directory default',
        mise: '',
        xdg: '',
        expected: ['.local', 'share', 'mise'],
    },
] as const;
