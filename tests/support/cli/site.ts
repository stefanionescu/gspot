import { createFileTree } from 'testdirs';
import type { EngineInput } from '#cli/types/checks.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';

/** Select source files for an isolated site build owned by the test resource stack. */
export async function siteInput(root: string, paths: string[], resources: DisposableStack): Promise<EngineInput> {
    await createFileTree(root, {
        'gspot.toml': policyOf(['static-site'], '[tools.site]\nbuild = "bun build.js"\n', 'all'),
    });
    const session = await openSession(root);
    session.resources = resources;
    session.repository.files = session.repository.files.filter((file) => paths.includes(file.path));
    const selection = session.scopes[0]!;
    const spec = selection.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'static-site/build-reproducible')!;
    return engineInput(session, {
        scope: session.scopes.find((entry) => entry.scope.path === '')!,
        spec: spec,
        files: session.repository.files,
    });
}
