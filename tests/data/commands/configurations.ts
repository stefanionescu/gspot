export const INHERITED_CONFIGURATION_SETTINGS = `configurations = ["markdown", "bash"]
[rules]
enabled = false
[[scope]]
path = "api"
`;

export const EXCLUDED_CONFIGURATION_SETTINGS = `configurations = ["typescript"]
[rules]
enabled = false
[[scope]]
path = "api"
removed_configurations = { value = ["typescript"], reason = "The API scope uses Bash without the inherited TypeScript tools." }
`;

export const PARENT_CONFIGURATION_SETTINGS = `configurations = ["markdown"]
[rules]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
[[scope]]
path = "api/child"
configurations = ["python"]
`;

export const PARENT_REQUIREMENT_SETTINGS = `configurations = ["markdown"]
[rules]
enabled = false
[[scope]]
path = "api"
configurations = ["typescript"]
[[scope]]
path = "api/child"
configurations = ["bash"]
`;
