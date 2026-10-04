export const LINT = ['check', '--only', 'javascript/eslint', '--json'];

export const LOOSE =
    "// A test file.\n\nimport { z } from 'zod';\n\n/** Accepts anything. */\nexport const loose = z.object({ value: z.any() });\n";

export const BASH_IN_API = `configurations = []
[agent_rules]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
`;
