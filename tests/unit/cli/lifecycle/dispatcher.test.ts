// Every manager's dispatcher, for every stage, is a script the shell parses and that reports through one variable family.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { run } from '#cli/platform/spawn.ts';
import { testdir, createFileTree } from 'testdirs';
import { gitOutput } from '#tests/support/cli/git.ts';
import { parsePolicyText } from '#cli/policy/read.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import type { HookName } from '#cli/types/generation.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import type { HookTool } from '#cli/types/lifecycle/hooks.ts';
import { HOOK_FILES } from '#cli/config/repository/repository.ts';
import { nativeHook } from '#cli/lifecycle/hooks/native-hooks.ts';
import { lefthookCommand } from '#cli/generation/hooks/lefthook.ts';

// What each manager generates for a hook, in the shape the dispatcher recognizes.
function generated(tool: HookTool, name: string): Record<string, string> {
    if (tool === 'husky')
        return { '.husky/_/h': 'sh "$1"\n', [`.husky/_/${name}`]: '#!/usr/bin/env sh\n. "$(dirname "$0")/h"\n' };
    if (tool === 'lefthook')
        return {
            [`.git/hooks/${name}`]: `#!/bin/sh\ncall_lefthook()\n{\n  lefthook "$@"\n}\n\ncall_lefthook run "${name}" "$@"\n`,
        };
    if (tool === 'simple-git-hooks')
        return {
            [`.git/hooks/${name}`]: `#!/bin/sh\nif [ "$SKIP_SIMPLE_GIT_HOOKS" = "1" ]; then\n    exit 0\nfi\nbash '.gspot/integrations/simple-git-hooks/${name}' "$@"\n`,
        };
    return { [`.git/hooks/${name}`]: '#!/usr/bin/env bash\nexec pre-commit hook-impl "$@"\n' };
}

const TOOLS: HookTool[] = ['husky', 'lefthook', 'pre-commit', 'simple-git-hooks'];
// The line each stage adds: the saved push input, the message path, or nothing beyond the shared exports.
const STAGE_LINES: Record<HookName, string> = {
    'pre-push': 'cat > "$GSPOT_HOOK_INPUT" || exit 2',
    'commit-msg': 'export GSPOT_HOOK_MESSAGE="$gspot_message"',
    'pre-commit': 'export GSPOT_HOOK_RESULT="$gspot_work/result" GSPOT_HOOK_ROOT="$PWD"',
};

test.each(TOOLS.flatMap((tool) => HOOK_FILES.map((name) => [tool, name] as const)))(
    'the %s dispatcher for %s parses and reports through the hook variables',
    async (tool, name) => {
        await using work = await testdir();
        gitOutput(work.path, ['init', '-q']);
        await createFileTree(work.path, generated(tool, name));
        const files = openRoot(work.path);
        try {
            const policy = parsePolicyText(policyOf([], `[hooks]\ntool = "${tool}"\n`), 'gspot.toml');
            const hook = nativeHook(
                {
                    hookTool: tool,
                    policy,
                    root: work.path,
                    executable: '/usr/bin/true',
                    installedConfig: '.pre-commit-config.yaml',
                    work: join(work.path, 'scratch'),
                    files,
                },
                name,
            );
            const script = join(work.path, `${tool}-${name}.sh`);
            writeFileSync(script, hook.installed);
            const parsed = await run(['sh', '-n', script], { cwd: work.path });
            expect(parsed.code, parsed.stderr).toBe(0);
            expect(hook.installed).toContain('export GSPOT_HOOK_RESULT="$gspot_work/result" GSPOT_HOOK_ROOT="$PWD"');
            expect(hook.installed).not.toMatch(/GSPOT_(?:HUSKY|LEFTHOOK|PRE_COMMIT|SIMPLE)_/u);
            expect(hook.installed).toContain(STAGE_LINES[name]);
        } finally {
            files.close();
        }
    },
);

// Lefthook on Windows wraps the command in a double-quoted sh command line it does not escape.
test.each(HOOK_FILES.flatMap((name) => [undefined, 'mise', 'bun'].map((runner) => [name, runner] as const)))(
    'the Lefthook command for %s under the %s runner holds no double quote',
    (name, runner) => {
        const command = lefthookCommand(name, runner);
        expect(command).not.toContain('"');
        expect(command).toContain('gspot check');
    },
);
