export const GIT_CONFIG_ARGUMENTS = [
    '-c',
    'user.email=t@t',
    '-c',
    'user.name=t',
    '-c',
    'maintenance.auto=false',
    '-c',
    'gc.auto=0',
    '-c',
    'core.autocrlf=false',
] as const;

export const GIT_ISOLATION_ENVIRONMENT = { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '' } as const;
