/** Each file with its parse error message, and a direct alias it supports. */
export const ALIAS_FILES = [
    {
        path: 'package.json',
        message: 'package.json is not valid JSON.',
        valid: '{"imports":{"#app/*":"./src/*"}}',
    },
    {
        path: 'tsconfig.json',
        message: 'Cannot read TypeScript configuration {PATH}',
        valid: '{"compilerOptions":{"paths":{"#app/*":["./src/*"]}}}',
    },
] as const;

/** Root and child alias declarations that conflict. The tests check which declaration wins. */
export const ALIAS_PROJECT = {
    'package.json': '{"imports":{"#app/*":"./src/*","#root/*":"./root/*","#shared/*":"./package/*"}}',
    'tsconfig.json': '{"compilerOptions":{"paths":{"@root/*":["./typed/*"],"#shared/*":["./compiler/*"]}}}',
    'web/package.json': '{"imports":{"#app/*":"./src/*","#shared/*":"./package/*"}}',
    'web/tsconfig.json': '{"compilerOptions":{"paths":{"@web/*":["./typed/*"],"#shared/*":["./compiler/*"]}}}',
} as const;
