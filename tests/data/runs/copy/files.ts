export const WORKSPACE_SOURCE_FILES = {
    'package.json': '{"private":true,"workspaces":["apps/*","packages/*"],"dependencies":{"unused":"workspace:*"}}',
    'bun.lock': '{}',
    '.gitignore': 'node_modules/\ndist/\n',
    'apps/web/package.json': '{"name":"web","dependencies":{"core":"workspace:*"}}',
    'apps/web/main.js': 'import {value} from "core"; console.log(value);',
    'packages/core/package.json':
        '{"name":"core","type":"module","main":"value.js","dependencies":{"utility":"workspace:*"}}',
    'packages/core/value.js': 'import {suffix} from "utility"; export const value = "staged" + suffix;',
    'packages/utility/package.json':
        '{"name":"utility","type":"module","main":"value.js","dependencies":{"core":"workspace:*"}}',
    'packages/utility/value.js': 'export const suffix = " dependency";',
    'packages/unused/package.json': '{"name":"unused","type":"module"}',
    'packages/unused/private.txt': 'Unselected workspace bytes',
    'packages/unused/private.js': 'export const unused = 1;',
    'tsconfig.json':
        '{"compilerOptions":{"allowJs":true,"moduleResolution":"Bundler","module":"ESNext","paths":{"#alias/*":["packages/aliased/*"]}}}',
    'apps/web/tsconfig.json': '{"extends":"../../tsconfig.json","include":["*.js"]}',
    'apps/web/alias.js': 'import {aliasValue} from "#alias/value"; export const value = aliasValue;',
    'packages/aliased/package.json': '{"name":"aliased","type":"module"}',
    'packages/aliased/value.js': 'export const aliasValue = "alias source";',
} as const;

/** A tests workspace that imports Vue. */
export const TEST_WORKSPACE_FILES = {
    'package.json': '{"private":true,"workspaces":["tests"]}',
    'tests/package.json': '{"name":"tests"}',
    'tests/app.js': 'import "vue";',
    'node_modules/.bun/vue@3/node_modules/vue/package.json': '{"name":"vue"}',
    '.gspot/package.json': '{"private":true}',
    '.gspot/node_modules/prettier/package.json': '{"name":"prettier"}',
} as const;
