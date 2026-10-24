import { PYTHON_LOCKFILES } from '#cli/config/checks/general/licenses.ts';
import { JAVASCRIPT_LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';

export const LOCKED_VERSIONS_MANIFEST = '{"dependencies":{"react":"^18.3.0","react-dom":"18.3.1"}}';

export const LOCKED_VERSION_CASES = [
    {
        name: 'npm root',
        file: 'package-lock.json',
        folder: '',
        text: '{"packages":{"":{"dependencies":{"react":"^18.3.0","react-dom":"18.3.1"}},"node_modules/react":{"version":"18.3.1"},"node_modules/react-dom":{"version":"18.3.1"},"node_modules/old-chart/node_modules/react":{"version":"17.0.2"}}}',
    },
    {
        name: 'npm workspace',
        file: 'package-lock.json',
        folder: 'app',
        text: '{"packages":{"":{"dependencies":{"react":"17.0.2"}},"app":{"dependencies":{"react":"^18.3.0","react-dom":"18.3.1"}},"node_modules/react":{"version":"17.0.2"},"app/node_modules/react":{"version":"18.3.1"},"node_modules/react-dom":{"version":"18.3.1"}}}',
    },
    {
        name: 'Bun root',
        file: 'bun.lock',
        folder: '',
        text: '{"workspaces":{"":{"dependencies":{"react":"^18.3.0","react-dom":"18.3.1"}}},"packages":{"react":["react@18.3.1"],"react-dom":["react-dom@18.3.1"],"old-chart/react":["react@17.0.2"]}}',
    },
    {
        name: 'Bun workspace',
        file: 'bun.lock',
        folder: 'app',
        text: '{"workspaces":{"":{"dependencies":{"react":"17.0.2"}},"app":{"name":"web","dependencies":{"react":"^18.3.0","react-dom":"18.3.1"}}},"packages":{"react":["react@17.0.2"],"web/react":["react@18.3.1"],"react-dom":["react-dom@18.3.1"]}}',
    },
    {
        name: 'pnpm workspace',
        file: 'pnpm-lock.yaml',
        folder: 'app',
        text: 'importers:\n  .:\n    dependencies:\n      react: {specifier: 17.0.2, version: 17.0.2}\n  app:\n    dependencies:\n      react: {specifier: ^18.3.0, version: 18.3.1}\n    devDependencies:\n      react-dom: {specifier: 18.3.1, version: 18.3.1(react@18.3.1)}\npackages:\n  react@17.0.2: {}\n  react@18.3.1: {}\n  react-dom@18.3.1: {}\n',
    },
    {
        name: 'Yarn classic',
        file: 'yarn.lock',
        folder: '',
        text: '# yarn lockfile v1\n\n"react@^18.0.0", "react@^18.3.0":\n  version "18.3.1"\n"react@17.0.2":\n  version "17.0.2"\n"react-dom@18.3.1":\n  version "18.3.1"\n',
    },
    {
        name: 'Yarn Berry workspace',
        file: 'yarn.lock',
        folder: 'app',
        text: '__metadata:\n  version: 8\n"react@npm:^18.0.0, react@npm:^18.3.0":\n  version: 18.3.1\n"react@npm:17.0.2":\n  version: 17.0.2\n"react-dom@npm:18.3.1":\n  version: 18.3.1\n',
    },
] as const;

export const LOCKED_PACKAGE_CASES = [
    {
        name: 'npm transitive packages',
        file: 'package-lock.json',
        lockfiles: JAVASCRIPT_LOCKFILES,
        text: '{"lockfileVersion":3,"packages":{"":{"name":"app"},"node_modules/zod":{"version":"4.0.0"},"node_modules/@img/sharp-libvips-linux-x64":{"version":"1.2.0","optional":true},"node_modules/a/node_modules/b":{"version":"2.0.0"}}}',
        expected: ['@img/sharp-libvips-linux-x64@1.2.0', 'b@2.0.0', 'zod@4.0.0'],
    },
    {
        name: 'Bun transitive packages',
        file: 'bun.lock',
        lockfiles: JAVASCRIPT_LOCKFILES,
        text: '{\n  "lockfileVersion": 1,\n  "workspaces": { "": { "name": "app" } },\n  "packages": {\n    "zod": ["zod@4.0.0", "", {}, "sha512-a"],\n    "@scope/tool": ["@scope/tool@1.2.3", "", {}, "sha512-b"],\n  },\n}\n',
        expected: ['@scope/tool@1.2.3', 'zod@4.0.0'],
    },
    {
        name: 'pnpm peer package versions',
        file: 'pnpm-lock.yaml',
        lockfiles: JAVASCRIPT_LOCKFILES,
        text: "lockfileVersion: '9.0'\npackages:\n  zod@4.0.0:\n    resolution: {integrity: sha512-a}\n  react-dom@19.0.0(react@19.0.0):\n    resolution: {integrity: sha512-b}\n",
        expected: ['react-dom@19.0.0', 'zod@4.0.0'],
    },
    {
        name: 'Yarn Berry scoped packages',
        file: 'yarn.lock',
        lockfiles: JAVASCRIPT_LOCKFILES,
        text: '__metadata:\n  version: 8\n\n"zod@npm:^4.0.0":\n  version: 4.0.0\n\n"@scope/tool@npm:^1.0.0, @scope/tool@npm:^1.2.0":\n  version: 1.2.3\n',
        expected: ['@scope/tool@1.2.3', 'zod@4.0.0'],
    },
    {
        name: 'uv normalized names',
        file: 'uv.lock',
        lockfiles: PYTHON_LOCKFILES,
        text: 'version = 1\n[[package]]\nname = "Typing_Extensions"\nversion = "4.12.2"\n[[package]]\nname = "app"\nversion = "0.1.0"\n',
        expected: ['app@0.1.0', 'typing-extensions@4.12.2'],
    },
    {
        name: 'uv package without dependency versions',
        file: 'uv.lock',
        lockfiles: PYTHON_LOCKFILES,
        text: 'version = 1\n[[package]]\nname = "App"\nversion = "1.0"\n[package.metadata]\nrequires-dist = [{ name = "unpinned" }]\n',
        expected: ['app@1.0'],
    },
] as const;
