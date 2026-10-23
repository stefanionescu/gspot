export const ALIAS_FILES = [
    {
        path: 'package.json',
        message: 'package.json is not valid JSON:',
    },
    {
        path: 'tsconfig.json',
        message: "Cannot read the compiler settings in tsconfig.json: '}' expected.",
    },
] as const;

/** Root and child aliases that conflict. The tests check which one wins. */
export const ALIAS_PROJECT = {
    'package.json': '{"imports":{"#app/*":"./src/*","#root/*":"./root/*","#shared/*":"./package/*"}}',
    'tsconfig.json': '{"compilerOptions":{"paths":{"@root/*":["./typed/*"],"#shared/*":["./compiler/*"]}}}',
    'web/package.json': '{"imports":{"#app/*":"./src/*","#shared/*":"./package/*"}}',
    'web/tsconfig.json': '{"compilerOptions":{"paths":{"@web/*":["./typed/*"],"#shared/*":["./compiler/*"]}}}',
} as const;

/** The root and child aliases. */
export const SCOPE_ALIASES = {
    '#app/*': 'src/*',
    '#root/*': 'root/*',
    '@root/*': 'typed/*',
    '#shared/*': 'compiler/*',
} as const;
