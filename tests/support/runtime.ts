import { setEnvironmentVariable } from '#cli/platform/environment.ts';
import workspacePackage from '#workspace-package' with { type: 'json' };

if (Bun.version !== workspacePackage.engines.bun)
    throw new Error(
        `Tests require Bun ${workspacePackage.engines.bun}; found ${Bun.version}. Run mise run test from the repository root.`,
    );

// Tests start outside hook context; hook scenarios set their own context explicitly.
setEnvironmentVariable('GSPOT_HOOK', undefined);
