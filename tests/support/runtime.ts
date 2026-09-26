import { engines } from '../../package.json';

if (Bun.version !== engines.bun)
    throw new Error(
        `Tests require Bun ${engines.bun}; found ${Bun.version}. Run mise run test from the repository root.`,
    );
