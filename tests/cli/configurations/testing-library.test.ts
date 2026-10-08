import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readPackageManifests } from '#cli/repository/contracts.ts';
import { detectConfigurations } from '#cli/configurations/selection/contracts.ts';

test.each(['@testing-library/react', '@testing-library/dom', '@testing-library/custom-adapter'])(
    'Testing Library detects %s only in the project scope that declares it',
    async (dependency) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript']),
            'package.json': '{"private":true,"dependencies":{"react":"19.1.1"}}\n',
            'child/package.json': JSON.stringify({ private: true, dependencies: { [dependency]: '1.0.0' } }),
            'neighbor/package.json': '{"private":true,"dependencies":{"testing-library-like":"1.0.0"}}\n',
        });
        const session = await openSession(sandbox.path);
        const projects = readPackageManifests(sandbox.path, session.repository.files);
        const detected = (scope: string) =>
            detectConfigurations(sandbox.path, session.repository.files, session.manifests, projects, scope).find(
                (row) => row.configuration === 'testing-library',
            );
        expect(detected('child')).toMatchObject({ evidence: `${dependency} in child/package.json` });
        expect(detected('neighbor')).toBeUndefined();
        expect(
            session.scopes.flatMap(({ selected }) => selected.map(({ configuration }) => configuration.name)),
        ).not.toContain('testing-library');
    },
);
