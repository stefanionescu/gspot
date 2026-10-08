/** Authored source names do not prove build output; both stylesheets remain lint inputs. */
export const FILES = {
    'build/site.css': 'a {\n    color: #ff0000;\n    width: 1.5px;\n    -webkit-text-size-adjust: 100%;\n}\n',
    'app/site.css': '#example {\n    color: #f00;\n    width: 1.5px;\n    -webkit-backdrop-filter: blur(2px);\n}\n',
};

/** Active rule options inherit across scopes. Inactive native options cannot add checks. */
export const TABLES = `runner = "mise"
[agent_rules]
enabled = false
[tools.stylelint.rules]
color-hex-length = "short"
number-max-precision = 0
selector-max-id = 0
[scope."app"]
configurations = []
[scope."app".tools.stylelint.rules]
color-hex-length = "long"
`;

/** Standard properties and scoped color options correct all selected-level findings. */
export const CORRECTED = {
    'build/site.css': 'a {\n    color: #f00;\n    width: 1px;\n    text-size-adjust: 100%;\n}\n',
    'app/site.css': '#example {\n    color: #ff0000;\n    width: 1px;\n    backdrop-filter: blur(2px);\n}\n',
};

/** Tailwind syntax follows the declaring package boundary. */
export const TAILWIND_FILES = {
    'package.json': '{"private":true,"dependencies":{"next":"16.3.5"}}\n',
    'build/site.css': '@tailwind utilities;\n\na {\n    color: theme("colors.brand");\n}\n',
    'app/package.json': '{"private":true,"devDependencies":{"tailwindcss":"4.1.13"}}\n',
    'app/site.css': '@tailwind utilities;\n\na {\n    color: theme("colors.brand");\n}\n',
    'other/package.json': '{"private":true}\n',
    'other/site.css': '@tailwind utilities;\n\na {\n    color: theme("colors.brand");\n}\n',
};

export const TAILWIND_TABLES = `runner = "mise"
[agent_rules]
enabled = false
[scope."app"]
configurations = ["css"]
[scope."other"]
configurations = ["css"]
`;

/** Selecting Next.js alone cannot grant Tailwind syntax. */
export const TAILWIND_CONFIGURATIONS = ['css', 'nextjs'];
