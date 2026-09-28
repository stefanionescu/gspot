import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readAsset } from '#cli/platform/assets.ts';
import { ruleExamples } from '#cli/agents/examples.ts';
import { runProcess } from '#tests/support/cli/command.ts';
import { FASTAPI_GUIDE_TESTS } from '#tests/config/integration/tools/generation.ts';

test.each(FASTAPI_GUIDE_TESTS)(
    '$guide examples preserve their HTTP validation and response contracts',
    async (scenario) => {
        await using sandbox = await testdir();
        const path = `framework/fastapi/${scenario.guide}.md`;
        const examples = ruleExamples({ path, text: readAsset(`packages/cli/guides/${path}`) }).filter(
            (example) => example.language === 'python',
        );
        expect(examples).toHaveLength(2);
        await createFileTree(sandbox.path, {
            'pyproject.toml': `[project]\nname = "guide-examples"\nversion = "1.0.0"\nrequires-python = ">=3.12"\ndependencies = ${JSON.stringify(scenario.dependencies)}\n`,
            ...Object.fromEntries(examples.map((example, index) => [`example_${String(index)}.py`, example.body])),
            'verify.py': scenario.program,
        });
        const locked = await runProcess(['uv', 'lock'], { cwd: sandbox.path });
        expect(locked.code, locked.stdout + locked.stderr).toBe(0);
        const responses = await runProcess(['uv', 'run', '--locked', 'python', 'verify.py'], { cwd: sandbox.path });
        expect(responses.code, responses.stdout + responses.stderr).toBe(0);
        expect(JSON.parse(responses.stdout)).toStrictEqual(scenario.responses);
    },
    60_000,
);
