export const PROJECT_OPTIONS = { stage: 'commit' as const, skips: [], only: ['sandbox/project'] };

export const NESTED_POLICY = `configurations = []
[[scope]]
path = "api"
configurations = []
[[scope]]
path = "web"
configurations = []
`;
