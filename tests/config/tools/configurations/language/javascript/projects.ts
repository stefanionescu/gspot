export const JAVASCRIPT_AUTHORED_FILES = {
    'jsconfig.json': '{"extends":"./base.json"}\n',
    'base.json':
        '{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","baseUrl":".","paths":{"@shape/*":["source/*"]},"types":["domain"],"incremental":true,"tsBuildInfoFile":"authored/cache.tsbuildinfo"},"include":["source/**/*.js"],"exclude":["excluded"]}',
    'excluded/source.js': 'UnknownDependency();\n',
};

export const JAVASCRIPT_CONFIG_CASES = [
    { name: 'without an authored jsconfig', authored: false },
    { name: 'with an authored jsconfig', authored: true },
];

export const JAVASCRIPT_CONFIG_PATHS = [
    '.gspot/config/app/child/jsconfig.json',
    '.gspot/config/app/jsconfig.json',
    '.gspot/config/jsconfig.json',
    '.gspot/config/sibling/jsconfig.json',
];
