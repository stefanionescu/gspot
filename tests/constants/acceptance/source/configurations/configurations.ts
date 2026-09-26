// The literal values acceptance/source/configurations/configurations reads: names, patterns, limits, and tables.
import type { PlantedCase } from '#tests/types/support/cli.ts';

export const VITEST_SOURCE =
    '// Arithmetic the planted tests call.\n\n/**\n * Adds positive values.\n * @param values the values to total\n * @returns the positive total\n */\nexport function positiveTotal(values: number[]): number {\n    let total = 0;\n    for (const value of values) {\n        if (value > 0) total += value;\n    }\n    return total;\n}\n';
export const SUPABASE_CONFIG =
    'project_id = "planted"\n\n[storage.buckets.avatars]\npublic = false\n\n[functions.greet]\nverify_jwt = true\n';

export const EXPRESS_PACKAGE =
    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "express": "5.1.0"\n    }\n}\n';
export const VITEST_PACKAGE =
    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "devDependencies": {\n        "vitest": "4.1.11"\n    }\n}\n';
export const EXPRESS_POLICY =
    '[tools.openapi]\ndocument = "openapi.yaml"\nproduced_by = "bun write-document.js"\n\n[tools.express]\nroute_files = ["src/routes/*.js"]\n';
export const VITE_POLICY = `version = 1
level = "all"
configurations = ["javascript"]
[rules]
install = false
[tools.knip]
entry = []
[[scope]]
path = "api"
configurations = ["javascript"]
[scope.tools.knip]
entry = []
`;
export const MIGRATION = `-- The avatars bucket and who reads it.
CREATE POLICY avatars_read ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
`;
export const GREET = 'Deno.serve(() => new Response("hello"));\n';
export const SECURITY_CLEAN = 'export function double(value: number): number {\n    return value * 2;\n}\n';
export const SQL_CLEAN =
    '-- The accounts of the application.\nCREATE TABLE user_accounts (\n    id UUID PRIMARY KEY,\n    display_name TEXT NOT NULL\n);\n';
export const DOCKER_CLEAN =
    'FROM node:22.11.0-bookworm-slim\nWORKDIR /app\nCOPY package.json ./\nUSER node\nHEALTHCHECK CMD ["node", "--version"]\nCMD ["node", "index.js"]\n';
export const LIBRARIES_CLEAN =
    '// A value the planted files build on.\n\n/** The answer. */\nexport const answer = 42;\n';
export const EVALUATED =
    'export function run(code: string): unknown {\n    // eslint-disable-next-line no-eval -- planted\n    return eval(code);\n}\n';
export const OWN_RULE =
    'rules:\n    - id: planted-no-double\n      pattern: double(...)\n      message: The planted rule of the repository fires here.\n      languages: [typescript]\n      severity: ERROR\n';
export const OWN_STYLES = new Set(['gspot', 'config']);
export const README = `# Planted

A planted repository that holds documents and nothing else.

## Requirements

- git

## Setup

\`\`\`bash
git clone https://example.com/planted.git
\`\`\`

## Usage

Open the guide and read it from the top.
`;
export const GUIDE = '# The Guide\n\nThe worker retries the request three times. Each retry waits one second.\n';
export const LICENSE = 'MIT License\n\nCopyright (c) 2026 Alex Garcia\n';
export const REPORTED_ELSEWHERE = ['markdown/prettier', 'prose/messages', 'prose/doc-tags'];
export const DOCUMENT = `openapi: 3.1.0
info:
    title: Planted
    version: 1.0.0
    description: The planted service.
    contact:
        name: Owner
        url: https://example.test
servers:
    - url: https://example.test
tags:
    - name: health
paths:
    /health:
        get:
            operationId: readHealth
            description: Says the service is up.
            tags:
                - health
            responses:
                '204':
                    description: The service is up.
`;
export const HEALTH = 'export function health(_request, response) {\n    response.sendStatus(204);\n}\n';
export const ROOT = '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true\n}\n';
export const XCTEST_TESTS = 'AppTests/HomeTests.swift';
export const FASTAPI_TESTS =
    '"""Tests of the arithmetic."""\n\nfrom planted.math import double, triple\n\n\ndef test_multiplication() -> None:\n    """Both functions multiply."""\n    assert double(2) == 4\n    assert triple(2) == 6\n';
export const MATH =
    '"""Arithmetic."""\n\n\ndef double(value: int) -> int:\n    """Double a number."""\n    return value * 2\n\n\ndef triple(value: int) -> int:\n    """Triple a number."""\n    return value * 3\n';
export const WRANGLER =
    '{\n    // The worker of the planted site.\n    "name": "planted",\n    "compatibility_date": "2026-01-15"\n}\n';
export const KILOBYTE = 1024;
export const OVER_LIMIT_KB = 1100;
export const SHEET = '.card {\n    color: #333;\n}\n\n.card-title {\n    font-weight: 700;\n}\n';
export const CODE =
    "import styles from './card.module.css';\n\nexport const names = [styles.card, styles.cardTitle];\n";
// A script for psql: a meta-command and two kinds of variable, which the server never sees.
export const PSQL =
    "\\set team 'core'\nSELECT id FROM user_accounts WHERE display_name = :'team' AND id = :account_id;\n";
export const TEMPLATES = '[tools.html]\ntemplate_files = ["pages/**/*.html"]\n';
export const CARELESS = 'FROM node:latest\nCOPY . .\nCMD ["node", "index.js"]\n';
export const IGNORES = '.git\nnode_modules\n.env*\n';
export const VUE_CLEAN =
    '<script setup lang="ts">\ndefineProps<{ name: string }>();\n</script>\n\n<template>\n    <p>{{ name }}</p>\n</template>\n';
export const SVELTE_CLEAN =
    '<script lang="ts">\n    const { name }: { name: string } = $props();\n</script>\n\n<p>{name}</p>\n';
export const FOLDER = 'supabase/migrations';
export const FIRST = `${FOLDER}/20240101000000_create_teams.sql`;
export const TEAMS = `-- The teams of the application.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY members_read ON public.teams FOR SELECT USING (true);
COMMIT;
`;
export const FROZEN_POLICY = '[tools.squawk]\nfrozen_through = "20240101000000"\n';
export const WORKFLOW_HEAD =
    'name: planted\non: [push]\npermissions:\n    contents: read\njobs:\n    build:\n        runs-on: ubuntu-24.04\n        steps:\n';
export const START = "import { start } from './start.js';\nstart();\n";
export const INVALID: PlantedCase[] = [
    {
        check: 'integrity/manifest-policy',
        files: { 'package.json': '{' },
        expected: 'Cannot read package manifest package.json',
    },
    {
        check: 'integrity/manifest-policy',
        files: { 'package.json': '{"dependencies":{"example":false}}' },
        expected: 'Cannot read package manifest package.json',
    },
];
export const NESTJS_DEPENDENCIES = {
    '@nestjs/common': '11.2.3',
    '@nestjs/core': '11.2.3',
    'reflect-metadata': '0.2.2',
    rxjs: '7.8.2',
};
export const NESTJS_TSCONFIG =
    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true,\n        "experimentalDecorators": true,\n        "emitDecoratorMetadata": true\n    },\n    "include": ["src"]\n}\n';
export const GREETER =
    "// The greetings the service knows.\nimport { Injectable } from '@nestjs/common';\n\n/** Builds greetings. */\n@Injectable()\nexport class GreetingService {\n    /**\n     * Greets one person.\n     * @param name the person\n     * @returns the greeting\n     */\n    greet(name: string): string {\n        if (name.trim() === '') {\n            throw new Error('A greeting requires a name.');\n        }\n        return `hello ${name.trim()}`;\n    }\n}\n";
export const CONTROLLER =
    "// The routes that greet.\n// eslint-disable-next-line gspot/no-trivial-files -- reason: Nest requires the controller class that binds these routes.\nimport { Controller, Get, Param } from '@nestjs/common';\nimport { GreetingService } from './greeting.service.js';\n\n/** Answers greeting requests. */\n@Controller('greetings')\nexport class GreetingController {\n    /**\n     * Takes the service that builds greetings.\n     * @param greetings the service\n     */\n    // eslint-disable-next-line gspot/no-trivial-functions -- reason: Nest injects this constructor dependency.\n    constructor(private readonly greetings: GreetingService) {}\n\n    /**\n     * Greets the person the route names.\n     * @param name the person\n     * @returns the greeting\n     */\n    @Get(':name')\n    // eslint-disable-next-line gspot/no-trivial-functions -- reason: Nest invokes this decorated route method.\n    greet(@Param('name') name: string): string {\n        return this.greetings.greet(name);\n    }\n}\n";
export const NESTJS_MODULE =
    "// The greeting feature.\n// eslint-disable-next-line gspot/no-trivial-files -- reason: Nest requires this module class to register its providers and controllers.\nimport { Module } from '@nestjs/common';\nimport { GreetingService } from './greeting.service.js';\nimport { GreetingController } from './greeting.controller.js';\n\n/** Wires the greeting feature together. */\n@Module({ controllers: [GreetingController], providers: [GreetingService] })\nexport class GreetingModule {}\n";
export const REPOSITORY =
    "// Where greetings are kept.\nimport { Injectable } from '@nestjs/common';\n\n/** Keeps greetings. */\n@Injectable()\nexport class GreetingRepository {\n    /**\n     * Counts the greetings kept.\n     * @returns the count\n     */\n    count(): number {\n        return 0;\n    }\n}\n";
export const XCODE_PROJECT = `// !$*UTF8*$!
{
    rootObject = P1;
    objects = {
        P1 = {isa = PBXProject; mainGroup = G1; targets = (T1,); };
        G1 = {isa = PBXGroup; children = (G2,); sourceTree = "<group>"; };
        G2 = {isa = PBXGroup; path = App; children = (A1,); sourceTree = "<group>"; };
        B1 = {isa = PBXBuildFile; fileRef = A1; };
        S1 = {isa = PBXSourcesBuildPhase; files = (B1,); };
        A1 = {isa = PBXFileReference; path = Home.swift; sourceTree = "<group>"; };
        T1 = {
            isa = PBXNativeTarget;
            name = AppTests;
            buildPhases = (S1,);
            productType = "com.apple.product-type.bundle.unit-test";
        };
    };
}
`;
export const PLAN = '{\n    "testTargets": [{ "target": { "name": "AppTests" } }]\n}\n';
export const HOME = 'import SwiftUI\n\nlet logo = Image("Logo")\n';
export const IMAGES =
    '{\n    "images": [{ "filename": "logo.png", "idiom": "universal" }],\n    "info": { "author": "xcode", "version": 1 }\n}\n';
export const UNTESTED = `${VITEST_SOURCE}\n/**\n * Triples a number.\n * @param value the number\n * @returns three times the number\n */\nexport function triple(value: number): number {\n    return value * 3;\n}\n`;
export const TEST =
    "import { expect, test } from 'vitest';\nimport { positiveTotal } from './public.js';\n\ntest('adds only positive values', () => {\n    expect(positiveTotal([2, 3])).toBe(5);\n    expect(positiveTotal([-2, 3])).toBe(3);\n    expect(positiveTotal([])).toBe(0);\n});\n";
export const BUILD =
    "// Copies the pages, the stylesheet, the sitemap and the assets into dist.\nimport { cpSync, mkdirSync, rmSync } from 'node:fs';\n\nrmSync('dist', { recursive: true, force: true });\nmkdirSync('dist', { recursive: true });\nfor (const name of ['index.html', 'about.html', 'site.css', 'sitemap.xml']) cpSync(name, `dist/${name}`);\ncpSync('assets', 'dist/assets', { recursive: true });\n";
export const STATIC_SITE_HEADERS =
    '/*\n    X-Content-Type-Options: nosniff\n    Referrer-Policy: strict-origin-when-cross-origin\n    X-Frame-Options: DENY\n';
export const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8H0z"/></svg>';
