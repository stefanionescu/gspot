/** Authored source names do not prove build output; both stylesheets remain lint inputs. */
export const FILES = {
    'build/site.css': 'a {\n    color: #ff0000;\n    width: 1.5px;\n    -webkit-text-size-adjust: 100%;\n}\n',
    'app/site.css': '#example {\n    color: #f00;\n    width: 1.5px;\n    -webkit-backdrop-filter: blur(2px);\n}\n',
};

/** Active rule options inherit across scopes. Inactive native options cannot add checks. */
export const TABLES = `run_with = "mise"
[agent_rules]
enabled = false
[tools.stylelint.rules]
color-hex-length = "short"
number-max-precision = 0
selector-max-id = 0
[[scope]]
path = "app"
configurations = []
[scope.tools.stylelint.rules]
color-hex-length = "long"
`;

/** Standard properties and scoped color options correct all selected-level findings. */
export const CORRECTED = {
    'build/site.css': 'a {\n    color: #f00;\n    width: 1px;\n    text-size-adjust: 100%;\n}\n',
    'app/site.css': '#example {\n    color: #ff0000;\n    width: 1px;\n    backdrop-filter: blur(2px);\n}\n',
};
