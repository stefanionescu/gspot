export const UV_INSTALLER = { name: 'uv', version: '0.12.13' };

export const MISE_BACKENDS: { installer: string; prefix: string }[] = [
    { installer: 'mise', prefix: '' },
    { installer: 'npm', prefix: 'npm:' },
    { installer: 'pypi', prefix: 'pipx:' },
    { installer: 'github', prefix: 'github:' },
    { installer: 'cargo', prefix: 'cargo:' },
];
