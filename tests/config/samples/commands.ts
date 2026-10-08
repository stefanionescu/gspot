export const PROJECT_TRIGGERS = [
    ['delete', 'staged'],
    ['rename', 'changed'],
] as const;

export const PROJECT_OPTIONS = { stage: 'commit' as const, skips: [], only: ['sandbox/project'] };

export const NESTED_POLICY = `configurations = []
[scope."api"]
configurations = []
[scope."web"]
configurations = []
`;
