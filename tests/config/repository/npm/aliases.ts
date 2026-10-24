export const ALIAS_FILES = [
    {
        path: 'package.json',
        message: 'package.json:1:38 is not valid JSON: PropertyNameExpected. Fix the file.',
    },
    {
        path: 'tsconfig.json',
        message: "Cannot read the compiler settings in tsconfig.json: '}' expected.",
    },
] as const;

export const ALIAS_PROJECT = {
    'package.json': '{"imports":{"#app/*":"./src/*","#root/*":"./root/*","#shared/*":"./package/*"}}',
    'tsconfig.json': '{"compilerOptions":{"paths":{"@root/*":["./typed/*"],"#shared/*":["./compiler/*"]}}}',
    'web/package.json': '{"imports":{"#app/*":"./src/*","#shared/*":"./package/*"}}',
    'web/tsconfig.json': '{"compilerOptions":{"paths":{"@web/*":["./typed/*"],"#shared/*":["./compiler/*"]}}}',
} as const;

export const SCOPE_ALIASES = {
    '#app/*': 'src/*',
    '#root/*': 'root/*',
    '@root/*': 'typed/*',
    '#shared/*': 'compiler/*',
} as const;
