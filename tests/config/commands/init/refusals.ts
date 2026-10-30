const UNCOMMITTED_FORMAT_FILES = [
    { path: '.prettierrc', original: '{"printWidth": 100}\n', changed: '{"printWidth": 90}\n' },
] as const;

export const UNCOMMITTED_FORMAT_CASES = ['unborn Git', 'untracked', 'staged changes', 'unstaged changes'].flatMap(
    (state) => UNCOMMITTED_FORMAT_FILES.map((file) => ({ ...file, state })),
);
