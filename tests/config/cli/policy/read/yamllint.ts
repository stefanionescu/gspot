/** Native YAML settings cannot enable rules or bypass reasoned exclusions. */
export const REJECTED_YAML_OPTIONS = [
    'truthy = true',
    'truthy = false',
    'truthy = "enable"',
    'truthy = "disable"',
    'truthy = { level = "warning" }',
    'truthy = { ignore = "**" }',
    'truthy = { ignore-from-file = "omitted.txt" }',
    'indentation = { spaces = 2 }',
];
