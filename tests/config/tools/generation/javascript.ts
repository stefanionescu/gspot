export const JAVASCRIPT_AUTHORED_FILES = {
    'jsconfig.json': '{"extends":"./base.json"}\n',
    'base.json':
        '{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","baseUrl":".","paths":{"@shape/*":["source/*"]},"types":["domain"],"incremental":true,"tsBuildInfoFile":"authored/cache.tsbuildinfo"},"include":["source/**/*.js"],"exclude":["excluded"]}',
    'excluded/source.js': 'UnknownDependency();\n',
};

export const IMPORT_FIX_SCRIPT = `import { ESLint } from 'eslint';
const eslint = new ESLint({ overrideConfigFile: '.gspot/config/eslint.config.mjs', fix: true });
const results = await eslint.lintFiles(['source.js', 'redundant.js']);
await ESLint.outputFixes(results);
process.stdout.write(JSON.stringify(results.flatMap(({ messages }) => messages.filter(({ ruleId }) =>
    ruleId === 'import-x/no-useless-path-segments'
))));
`;

export const SCRIPT_LINT_SOURCE = String.raw`import { ESLint } from 'eslint';
const eslint = new ESLint({ overrideConfigFile: '.gspot/config/eslint.config.mjs' });
const results = await eslint.lintFiles(['scripts/run.js', 'scripts/run.ts', 'build.config.ts', 'src/source.ts']);
process.stdout.write(JSON.stringify(results.map(({ filePath, messages }) => ({
    file: filePath.slice(process.cwd().length + 1).replaceAll('\\', '/'),
    findings: messages.filter(({ ruleId }) => ['no-unused-vars', '@typescript-eslint/no-unused-vars',
        'sonarjs/no-unused-vars', 'n/no-process-exit', 'unicorn/no-process-exit', 'no-console'].includes(ruleId))
        .map(({ ruleId, line, severity }) => ({ ruleId, line, severity }))
        .toSorted((left, right) => left.ruleId.localeCompare(right.ruleId)),
}))));
`;
