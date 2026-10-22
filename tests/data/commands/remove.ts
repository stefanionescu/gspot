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
