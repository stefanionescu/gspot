export const NEXT_INSTALLATIONS = [
    {
        name: 'an uninstalled Next uses the shipped manifest pin',
        rootVersion: undefined,
        childVersion: undefined,
        expected: 'manifest',
    },
    {
        name: 'a hoisted installed Next supplies its major to root and child',
        rootVersion: '15.5.9',
        childVersion: undefined,
        expected: '^15',
    },
    {
        name: 'different installed versions within one major share that major',
        rootVersion: '16.3.6',
        childVersion: '16.3.5',
        expected: '^16',
    },
    {
        name: 'different selected installed majors refuse one shared plugin pin',
        rootVersion: '16.3.6',
        childVersion: '15.5.9',
        expected: 'conflict',
    },
];

export const TOOL_REQUIREMENTS = [
    {
        name: 'a Next major requirement is accepted',
        dependency: '@next/eslint-plugin-next',
        version: '^15',
        accepted: true,
    },
    {
        name: 'an exact Next manifest pin is accepted',
        dependency: '@next/eslint-plugin-next',
        version: '16.3.6',
        accepted: true,
    },
    {
        name: 'a Next minor range is refused',
        dependency: '@next/eslint-plugin-next',
        version: '^16.3.6',
        accepted: false,
    },
    { name: 'a non-Next range is refused', dependency: 'eslint', version: '^9', accepted: false },
    { name: 'a non-Next exact pin is accepted', dependency: 'eslint', version: '9.39.5', accepted: true },
];
