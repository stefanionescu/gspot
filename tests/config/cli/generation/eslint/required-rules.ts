/** Both supported levels exercise each required rule's declared applicability. */
export const CHECK_LEVELS = ['recommended', 'all'] as const;

/** Minimal project declarations let every generated parser resolve its source. */
export const PROJECT_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json': '{"compilerOptions":{"strict":true,"jsx":"react-jsx"},"include":["**/*"]}\n',
};
