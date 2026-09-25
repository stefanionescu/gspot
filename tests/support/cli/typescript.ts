// The package manifest of a planted TypeScript repository: private, ESM, a #types import alias, and the running Bun as its package manager.
export const TYPESCRIPT_PACKAGE = `{
    "name": "planted",
    "version": "1.0.0",
    "private": true,
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
