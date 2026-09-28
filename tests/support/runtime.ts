import workspacePackage from '#workspace-package' with { type: 'json' };

if (Bun.version !== workspacePackage.engines.bun)
    throw new Error(
        `Tests require Bun ${workspacePackage.engines.bun}; found ${Bun.version}. Run mise run test from the repository root.`,
    );
