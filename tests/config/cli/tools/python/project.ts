import { PRIVATE_PYTHON_LOCKFILE } from '#tests/config/samples/python/tools.ts';

const LOCKFILE_STEPS = [['uv', 'lock', '--project', '.gspot']];

export const CONSTRAINT = { name: 'pyjwt', specifier: '>=2.14.0' };

export const PYTHON_LOCKFILE_PLANS = [
    { state: 'missing', lockfile: undefined, floor: '>=3.11', refreshLockfiles: false, steps: LOCKFILE_STEPS },
    {
        state: 'invalid',
        lockfile: '<<<<<<< interrupted lockfile\n',
        floor: '>=3.11',
        refreshLockfiles: false,
        steps: LOCKFILE_STEPS,
    },
    {
        state: 'stale',
        lockfile: PRIVATE_PYTHON_LOCKFILE,
        floor: '>=3.12',
        refreshLockfiles: false,
        steps: LOCKFILE_STEPS,
    },
    { state: 'current', lockfile: PRIVATE_PYTHON_LOCKFILE, floor: '>=3.11', refreshLockfiles: false, steps: [] },
    {
        state: 'refreshed',
        lockfile: PRIVATE_PYTHON_LOCKFILE,
        floor: '>=3.11',
        refreshLockfiles: true,
        steps: LOCKFILE_STEPS,
    },
];

export const PYTHON_ENVIRONMENT_STEPS = [
    ['uv', 'venv', '--relocatable', '.venv', '--project', '.gspot'],
    ['uv', 'sync', '--locked', '--no-install-project', '--project', '.gspot'],
];
