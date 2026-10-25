export const PYTHON_INDEX_CREDENTIALS = { user: 'gspot', password: 'synthetic-uv-password' } as const;

export const UV_RELEASE_CUTOFF_LINE = /^exclude-newer = .*$/mu;

export const PYTHON_PROJECTS = ['uv.toml', 'pyproject.toml'] as const;

export const ZIP_FILE_OPTIONS = {
    regular: { os: 3, attrs: 0o10_0644 * 0x1_00_00 },
    executable: { os: 3, attrs: 0o10_0755 * 0x1_00_00 },
} as const;
