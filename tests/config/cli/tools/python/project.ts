import { PRIVATE_PYTHON_LOCK } from '#tests/config/samples/python/tools.ts';

const LOCK_STEPS = [['uv', 'lock', '--project', '.gspot']];

export const CONSTRAINT = { name: 'pyjwt', specifier: '>=2.14.0' };

export const PYTHON_LOCK_PLANS = [
    { state: 'missing', lock: undefined, floor: '>=3.11', refreshLocks: false, steps: LOCK_STEPS },
    { state: 'invalid', lock: '<<<<<<< interrupted lock\n', floor: '>=3.11', refreshLocks: false, steps: LOCK_STEPS },
    {
        state: 'stale',
        lock: PRIVATE_PYTHON_LOCK,
        floor: '>=3.12',
        refreshLocks: false,
        steps: LOCK_STEPS,
    },
    { state: 'current', lock: PRIVATE_PYTHON_LOCK, floor: '>=3.11', refreshLocks: false, steps: [] },
    { state: 'refreshed', lock: PRIVATE_PYTHON_LOCK, floor: '>=3.11', refreshLocks: true, steps: LOCK_STEPS },
];

export const PYTHON_ENVIRONMENT_STEPS = [
    ['uv', 'venv', '--relocatable', '.venv', '--project', '.gspot'],
    ['uv', 'sync', '--locked', '--no-install-project', '--project', '.gspot'],
];
