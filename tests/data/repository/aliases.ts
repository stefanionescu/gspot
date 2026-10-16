/** Each source names its malformed-input diagnostic and a supported direct alias. */
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

/** Conflicting root and child declarations prove scope ownership and compiler precedence. */
export const ALIAS_PROJECT = {
    'package.json': '{"imports":{"#app/*":"./src/*","#root/*":"./root/*","#shared/*":"./package/*"}}',
    'tsconfig.json': '{"compilerOptions":{"paths":{"@root/*":["./typed/*"],"#shared/*":["./compiler/*"]}}}',
    'web/package.json': '{"imports":{"#app/*":"./src/*","#shared/*":"./package/*"}}',
    'web/tsconfig.json': '{"compilerOptions":{"paths":{"@web/*":["./typed/*"],"#shared/*":["./compiler/*"]}}}',
} as const;
