import { parse } from 'yaml';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { chmod, readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { PIPELINE } from '#tests/config/samples/ci.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { environmentVariables } from '#cli/platform/public.ts';
import { githubFile, gitlabFile } from '#cli/generation/documents/public.ts';
import type { GithubWorkflow, GitlabPipeline } from '#tests/types/cli/generation/ci.ts';

import {
    SETUP_CASES,
    NPM_PROGRAM,
    MISE_PROGRAM,
    GSPOT_PROGRAM,
    SETUP_PROGRAM,
    SETUP_ARGUMENTS,
    DOCTOR_EXIT_CODES,
} from '#tests/config/tools/generation/ci.ts';

test.each(DOCTOR_EXIT_CODES)(
    'the generated mise job runs doctor before checking and preserves doctor exit %s',
    async (doctorExit) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'bin/mise': MISE_PROGRAM, 'bin/gspot': GSPOT_PROGRAM });
        for (const name of ['mise', 'gspot']) await chmod(join(sandbox.path, 'bin', name), 0o755);
        const commands = join(sandbox.path, 'commands.log');
        const workflow = parse(githubFile({ ...PIPELINE, manualChecks: [] }).content) as GithubWorkflow;
        const script = workflow.jobs['check-linux']!.steps.flatMap((step) =>
            step.run === undefined ? [] : [step.run],
        );
        const result = await runTestCommand(['bash', '-e', '-c', script.join('\n')], {
            cwd: sandbox.path,
            env: {
                PATH: `${join(sandbox.path, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
                GSPOT_COMMAND_LOG: commands,
                GSPOT_DOCTOR_EXIT: String(doctorExit),
            },
        });
        expect(result.code, result.stdout + result.stderr).toBe(doctorExit);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe('');
        expect(await readFile(commands, 'utf8')).toBe(
            doctorExit === 0 ? 'install\ndoctor\ncheck\n' : 'install\ndoctor\n',
        );
    },
);

test.each(SETUP_CASES)(
    'the %s job with mise %s preserves setup exit %s and literal arguments before gspot',
    async (provider, isMise, setupExit) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'bin/mise': MISE_PROGRAM,
            'bin/npm': NPM_PROGRAM,
            'bin/gspot': GSPOT_PROGRAM,
            'bin/project setup': SETUP_PROGRAM,
        });
        for (const name of ['mise', 'npm', 'gspot', 'project setup'])
            await chmod(join(sandbox.path, 'bin', name), 0o755);
        const commands = join(sandbox.path, 'commands.log');
        const argumentsPath = join(sandbox.path, 'arguments.log');
        const pipeline = {
            ...PIPELINE,
            isMise,
            manualChecks: [],
            setup: [join(sandbox.path, 'bin', 'project setup'), ...SETUP_ARGUMENTS],
        };
        const script =
            provider === 'github'
                ? (parse(githubFile(pipeline).content) as GithubWorkflow).jobs['check-linux']!.steps.flatMap((step) =>
                      step.run === undefined ? [] : [step.run],
                  )
                : (parse(gitlabFile(pipeline).content) as GitlabPipeline).gspot.script;
        const result = await runTestCommand(['bash', '-e', '-c', script.join('\n')], {
            cwd: sandbox.path,
            env: {
                PATH: `${join(sandbox.path, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
                GSPOT_COMMAND_LOG: commands,
                GSPOT_DOCTOR_EXIT: '0',
                GSPOT_SETUP_ARGUMENTS: argumentsPath,
                GSPOT_SETUP_EXIT: String(setupExit),
            },
        });
        expect(result.code, result.stdout + result.stderr).toBe(setupExit);
        expect(result.stdout).toBe('setup out\n');
        expect(result.stderr).toBe('setup err\n');
        expect(await readFile(commands, 'utf8')).toBe(setupExit === 0 ? 'setup\ninstall\ndoctor\ncheck\n' : 'setup\n');
        expect(await readFile(argumentsPath, 'utf8')).toBe(`${SETUP_ARGUMENTS.join('\n')}\n`);
        expect(await Bun.file(join(sandbox.path, 'unexpected')).exists()).toBe(false);
    },
);
