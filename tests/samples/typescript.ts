// The package manifests of planted TypeScript repositories.

export const CONFIGURATION_ARRIVAL_PACKAGE =
    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "zod": "4.6.2"\n    }\n}\n';

export const TYPESCRIPT_PACKAGE = `{
    "name": "planted",
    "version": "1.0.0",
    "private": true,
    "description": "A planted TypeScript repository.",
    "type": "module",
    "imports": {
        "#types/*": "./types/*"
    },
    "packageManager": "bun@${Bun.version}",
    "engines": {
        "node": ">=22.0.0"
    }
}
`;
