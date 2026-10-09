/** Each native filename prefix belongs to an existing selected configuration. */
export const PREFIX_OWNER_CASES = [
    { configuration: 'typescript', prefix: 'tsconfig', siblingPaths: ['sibling/tsconfig-one.py'] },
    { configuration: 'javascript', prefix: 'jsconfig', siblingPaths: ['sibling/jsconfig-one.py'] },
    { configuration: 'javascript', prefix: 'eslint', siblingPaths: ['sibling/eslint-one.py'] },
    { configuration: 'javascript', prefix: 'vite', siblingPaths: ['sibling/vite-one.py'] },
    { configuration: 'javascript', prefix: 'playwright', siblingPaths: ['sibling/playwright-one.py'] },
    { configuration: 'vitest', prefix: 'vitest', siblingPaths: ['sibling/vitest-one.py'] },
    { configuration: 'docker', prefix: 'docker', siblingPaths: ['sibling/docker-one.py'] },
    { configuration: 'dependencies', prefix: 'package', siblingPaths: [] },
    { configuration: 'dependencies', prefix: 'pnpm', siblingPaths: [] },
];

/** NestJS declaration suffixes retain their feature folder ownership. */
export const NESTJS_KIND_CASES = [
    'controller',
    'service',
    'module',
    'guard',
    'pipe',
    'filter',
    'interceptor',
    'middleware',
    'decorator',
    'gateway',
    'resolver',
    'repository',
    'entity',
    'dto',
    'strategy',
    'provider',
];
