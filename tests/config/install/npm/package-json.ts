export const ACCEPTED_TOOL_REQUIREMENTS = [
    { name: 'an exact Next manifest pin', dependency: '@next/eslint-plugin-next', version: '16.3.6' },
    { name: 'a non-Next exact pin', dependency: 'eslint', version: '9.39.5' },
] as const;

export const REFUSED_TOOL_REQUIREMENTS = [
    { name: 'a Next major range', dependency: '@next/eslint-plugin-next', version: '^15' },
    { name: 'a Next minor range', dependency: '@next/eslint-plugin-next', version: '^16.3.6' },
    { name: 'a non-Next range', dependency: 'eslint', version: '^9' },
] as const;
