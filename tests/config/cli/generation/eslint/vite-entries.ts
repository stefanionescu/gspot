export const VITE_POLICY = `level = "all"
configurations = ["javascript"]
[agent_rules]
enabled = false
[tools.knip]
entry = []
[[scope]]
path = "api"
configurations = ["javascript"]
[scope.tools.knip]
entry = []
`;

export const START = "import { start } from './start.js';\nstart();\n";

export const STARTER =
    'export function start() { const target = document.querySelector("#app"); if (!target) throw new Error("Missing application target"); target.textContent = "Started"; }\n';

export const ENTRY_FILES = ['api/src/main.js', 'api/src/task.js', 'src/main.js', 'src/task.js'];
