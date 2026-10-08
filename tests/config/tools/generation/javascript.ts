export const JAVASCRIPT_AUTHORED_FILES = {
    'jsconfig.json': '{"extends":"./base.json"}\n',
    'base.json':
        '{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","baseUrl":".","paths":{"@shape/*":["source/*"]},"types":["domain"],"incremental":true,"tsBuildInfoFile":"authored/cache.tsbuildinfo"},"include":["source/**/*.js"],"exclude":["excluded"]}',
    'excluded/source.js': 'UnknownDependency();\n',
};
