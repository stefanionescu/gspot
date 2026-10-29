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
