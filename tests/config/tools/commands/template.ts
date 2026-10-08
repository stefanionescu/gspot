// Templates carry root customizations and omit only the source repository's scopes.
export const TEMPLATE_CUSTOMIZATIONS = `
[check."sandbox/pass"]
command = ["bun", "-e", "process.exit(0)"]
paths = ["scripts/**"]
stage = "manual"

[scope.app]
configurations = ["bash"]
`;

export const TEMPLATE_IGNORES = [
    { rule: 'SC2086', reason: 'A path entry that stays here.', paths: ['--paths', 'scripts/**'] },
    { rule: 'SC2034', reason: 'The shell exports these variables to another process.', paths: [] },
];
