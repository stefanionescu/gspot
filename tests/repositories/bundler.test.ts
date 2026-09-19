// Planted repository for the ruby preset: an eval of a string, a layout RuboCop corrects, and a gem with an advisory.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { chmodSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'ruby',
    '--without',
    'naming,spelling',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const RUNS = 0o755;
// The gems of this machine are built for the Ruby of Homebrew, so that Ruby comes first where it exists.
const RUBY_BIN = '/opt/homebrew/opt/ruby/bin';
const ruby = (tools: string): string => (existsSync(RUBY_BIN) ? `${RUBY_BIN}:${tools}` : tools);
const CLEAN =
    '# frozen_string_literal: true\n\n# Arithmetic the planted tests call.\nmodule Planted\n  # Doubles a number.\n  def self.double(value)\n    value * 2\n  end\nend\n';
const EVALUATED = CLEAN.replace('    value * 2\n', () => '    eval(value)\n');
const SPACED = CLEAN.replace('def self.double(value)', () => 'def self.double( value )');
// What bundler-audit check --format json prints for one advisory, cut down to the keys the check reads.
const ADVISORY = JSON.stringify({
    version: '0.9.3',
    results: [
        {
            type: 'unpatched_gem',
            gem: { name: 'rack', version: '2.0.1' },
            advisory: {
                id: 'CVE-2020-8184',
                title: 'Percent-encoded cookies can be used to overwrite existing prefixed cookie names',
                patched_versions: ['~> 2.1.4', '>= 2.2.3'],
            },
        },
    ],
});
const SCANNER = `#!/bin/sh\ncat <<'REPORT'\n${ADVISORY}\nREPORT\nexit 1\n`;

const CASES: PlantedCase[] = [
    { id: 'ruby/rubocop', files: { 'lib/planted.rb': EVALUATED }, expected: 'Security/Eval' },
    { id: 'ruby/rubocop', files: { 'lib/planted.rb': SPACED }, expected: 'Layout/SpaceInsideParens' },
];

describe('the ruby preset', () => {
    test(
        'RuboCop fires on its planted defects, and the stub at the root inherits the generated configuration',
        async () => {
            await using fixture = await createFixture({ 'lib/planted.rb': CLEAN });
            commitAll(fixture.path);
            const environment = { PATH: ruby(toolsPath(['rubocop', 'typos', 'ec'])) };
            await install(fixture.path, INIT, environment);
            expect(await Bun.file(join(fixture.path, '.rubocop.yml')).text()).toContain(
                'inherit_from: ./.gspot/rubocop.yml',
            );
            for (const planted of CASES) {
                const clean = run(fixture.path, ['check', planted.id, '--no-cache'], environment);
                expect(clean.code, `${planted.id}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.id}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout + outcome.stderr, planted.id).toContain(planted.expected);
                expect(outcome.stdout, planted.id).toContain('lib/planted.rb');
            }
        },
        PLANTED_TIMEOUT_MS * 6,
    );

    test(
        'an advisory that names a gem in Gemfile.lock is a finding with the patched versions',
        async () => {
            await using fixture = await createFixture({
                'lib/planted.rb': CLEAN,
                Gemfile: "# frozen_string_literal: true\n\nsource 'https://rubygems.org'\n\ngem 'rack', '2.0.1'\n",
                'Gemfile.lock':
                    'GEM\n  remote: https://rubygems.org/\n  specs:\n    rack (2.0.1)\n\nPLATFORMS\n  ruby\n\nDEPENDENCIES\n  rack (= 2.0.1)\n',
            });
            // The real scanner needs the network, so a script prints what it prints.
            await using tools = await createFixture({});
            const bin = join(tools.path, 'bin');
            mkdirSync(bin);
            await Bun.write(join(bin, 'bundler-audit'), SCANNER);
            chmodSync(join(bin, 'bundler-audit'), RUNS);
            commitAll(fixture.path);
            const environment = { PATH: `${bin}:${ruby(toolsPath(['rubocop', 'typos', 'ec']))}` };
            await install(fixture.path, INIT, environment);
            // The scanner reports on every run, so init holds the finding; without its baseline it is a finding again.
            rmSync(join(fixture.path, '.gspot/baselines/ruby.bundler-audit.CVE-2020-8184.json'));
            const outcome = run(fixture.path, ['check', 'ruby/bundler-audit', '--no-cache'], environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            expect(outcome.stdout).toContain('rack 2.0.1: Percent-encoded cookies');
            expect(outcome.stdout).toContain('Patched in ~> 2.1.4, >= 2.2.3.');
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
