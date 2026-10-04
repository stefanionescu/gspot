export const PROJECTS_POLICY = `level = "all"
configurations = ["typescript"]
[agent_rules]
enabled = false
`;

export const TSCONFIG_PROJECT =
    '{"compilerOptions":{"composite":true,"strict":true,"types":[],"target":"ES2020"},"include":["*.ts"]}';

export const AUTHORED_TSCONFIG = `{
    // The application owns its build and module settings.
    "compilerOptions": {
        "strict": false,
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "types": [],
        "incremental": true,
        "tsBuildInfoFile": %BUILD_INFO%
    },
    "include": ["src"],
}\n`;
