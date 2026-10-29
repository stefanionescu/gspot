export const IMPORT_STYLE_CASES = [
    {
        name: 'a tsconfig that imports .ts files by name',
        files: {
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"allowImportingTsExtensions":true,"noEmit":true}}',
            'src/entry.ts': 'export const value = 1;\n',
        },
        expected: 'ts',
    },
    {
        name: 'an esbuild bundle',
        files: {
            'package.json': '{"private":true,"type":"module","devDependencies":{"esbuild":"0.25.0"}}',
            'src/entry.ts': 'export const value = 1;\n',
        },
        expected: 'extensionless',
    },
    {
        name: 'a Node.js package',
        files: {
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext"}}',
            'src/entry.ts': 'export const value = 1;\n',
        },
        expected: undefined,
    },
] as const;

export const WORKSPACE_SITE_FILES = {
    'package.json': '{"name":"root","private":true,"workspaces":["apps/*"]}',
    'source.ts': 'export const root = true;\n',
    'apps/site/package.json': '{"name":"site","private":true}',
    'apps/site/source.py': 'VALUE = 1\n',
} as const;
