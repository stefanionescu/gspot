# `nestjs`

Kind: framework. Requires: typescript. Recommends: vitest, security, dependencies.

## Detects and claims

|        |                                                 |
| ------ | ----------------------------------------------- |
| Detect | `@nestjs/core` in dependencies, `nest-cli.json` |
| Claims | `nest-cli.json`                                 |

## What the framework needs from the other presets

NestJS injects by the types of constructor parameters. That takes decorators with emitted
metadata and parameter properties, and the strict base of the typescript preset refuses both.
A scope that selects nestjs gets `experimentalDecorators` and `emitDecoratorMetadata` in
`.gspot/tsconfig.base.json` in place of `verbatimModuleSyntax` and `erasableSyntaxOnly`.
`integrity/tsconfig-options` requires the first pair and drops the second pair in that scope.
`@typescript-eslint/consistent-type-imports` stays on: it leaves a file with decorators alone when
both decorator options are on.

The Nest generator names a file for its feature and its kind: `cats.controller.ts` beside
`cats.service.ts`. `structure/prefix-collisions` and `gspot/no-prefix-collisions` leave those names
alone in a Nest scope, for the sixteen kinds the generator writes and for `.spec` files.

The acceptance bar is a planted module, controller, and service written the Nest way. They pass
every commit check with no baseline.

## Generated configuration

- `@typescript-eslint/no-extraneous-class` with `allowWithDecorator`, because a module is a
  decorated class with no members. `class-methods-use-this` is off, because the framework calls a
  handler as a method.
- `no-restricted-syntax`, over every code file: no `forwardRef`, and no `@Res()` without
  `passthrough`.
- `no-restricted-syntax`, over `*.controller.ts`: no constructor parameter typed as a repository,
  a data source, an entity manager, or a Prisma client, and no `@InjectRepository`,
  `@InjectModel`, or `@InjectDataSource`.

## Checks

`typescript/eslint` with the rules above, and `integrity/tsconfig-options` with the decorator
options. No separate check.

## Settings

None.

## Rule files

`framework/nestjs/NESTJS.md`.
