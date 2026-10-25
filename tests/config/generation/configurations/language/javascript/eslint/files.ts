export const NESTED_ESLINT_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'app/package.json':
        '{"name":"nested-app","version":"0.0.0-test","type":"module","devDependencies":{"zod":"0.0.0-test"}}\n',
    'app/spec/read.js':
        'import { z } from "zod";\nexport function read(value) { return z.string().parse(value); }\nconsole.log("test");\n',
    'app/scripts/build.js': 'console.log("script");\nprocess.exit(0);\n',
    'app/.mise/tasks/build.js': 'console.log("task");\nprocess.exit(0);\n',
    'app/source.js': 'console.log("source");\nprocess.exit(0);\n',
} as const;

export const NESTED_ESLINT_PATHS = [
    'app/spec/read.js',
    'app/scripts/build.js',
    'app/.mise/tasks/build.js',
    'app/source.js',
] as const;

export const NESTED_ESLINT_RULES = [
    'jsdoc/require-jsdoc',
    'jsdoc/require-param',
    'n/no-unpublished-import',
    'n/no-process-exit',
    'unicorn/no-process-exit',
    'no-console',
] as const;

export const WILDCARD_ESLINT_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'app/read.js': 'console.log("test");\n',
    'app/build.js': 'console.log("script");\n',
    'sibling/read.js': 'console.log("source");\n',
    'sibling/build.js': 'console.log("source");\n',
} as const;
