import { PYTHON_LOCKFILES } from '#cli/config/checks/general/licenses.ts';
import { JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';

export const LOCKED_PACKAGE_CASES = [
    {
        file: 'package-lock.json',
        lockfiles: JAVASCRIPT_LOCKFILES,
        text: '{"lockfileVersion":3,"packages":{"":{"name":"app"},"node_modules/zod":{"version":"4.0.0"},"node_modules/@img/sharp-libvips-linux-x64":{"version":"1.2.0","optional":true},"node_modules/a/node_modules/b":{"version":"2.0.0"}}}',
        expected: ['@img/sharp-libvips-linux-x64@1.2.0', 'b@2.0.0', 'zod@4.0.0'],
    },
    {
        file: 'bun.lock',
        lockfiles: JAVASCRIPT_LOCKFILES,
        text: '{\n  "lockfileVersion": 1,\n  "workspaces": { "": { "name": "app" } },\n  "packages": {\n    "zod": ["zod@4.0.0", "", {}, "sha512-a"],\n    "@scope/tool": ["@scope/tool@1.2.3", "", {}, "sha512-b"],\n  },\n}\n',
        expected: ['@scope/tool@1.2.3', 'zod@4.0.0'],
    },
    {
        file: 'pnpm-lock.yaml',
        lockfiles: JAVASCRIPT_LOCKFILES,
        text: "lockfileVersion: '9.0'\npackages:\n  zod@4.0.0:\n    resolution: {integrity: sha512-a}\n  react-dom@19.0.0(react@19.0.0):\n    resolution: {integrity: sha512-b}\n",
        expected: ['react-dom@19.0.0', 'zod@4.0.0'],
    },
    {
        file: 'yarn.lock',
        lockfiles: JAVASCRIPT_LOCKFILES,
        text: '__metadata:\n  version: 8\n\n"zod@npm:^4.0.0":\n  version: 4.0.0\n\n"@scope/tool@npm:^1.0.0, @scope/tool@npm:^1.2.0":\n  version: 1.2.3\n',
        expected: ['@scope/tool@1.2.3', 'zod@4.0.0'],
    },
    {
        file: 'uv.lock',
        lockfiles: PYTHON_LOCKFILES,
        text: 'version = 1\n[[package]]\nname = "Typing_Extensions"\nversion = "4.12.2"\n[[package]]\nname = "app"\nversion = "0.1.0"\n',
        expected: ['app@0.1.0', 'typing-extensions@4.12.2'],
    },
    {
        file: 'uv.lock',
        lockfiles: PYTHON_LOCKFILES,
        text: 'version = 1\n[[package]]\nname = "App"\nversion = "1.0"\n[package.metadata]\nrequires-dist = [{ name = "unpinned" }]\n',
        expected: ['app@1.0'],
    },
] as const;
