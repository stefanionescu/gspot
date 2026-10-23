export const JEST_IN_APP_TABLES = `[[scope]]
path = "app"
configurations = [ "jest" ]
`;

export const VITEST_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tests/unit/example.test.js': '',
} as const;

export const TESTING_LIBRARY_CASES = [
    ['react', '@testing-library/react'],
    ['vue', '@testing-library/vue'],
    ['svelte', '@testing-library/svelte'],
] as const;
