# `nestjs`

Kind: framework. Requires: typescript. Recommends: vitest, security, dependencies. Recommends: jest, security, dependencies.

## Detects and claims

|        |                                                 |
| ------ | ----------------------------------------------- |
| Detect | `@nestjs/core` in dependencies, `nest-cli.json` |
| Claims | `nest-cli.json`                                 |

## What the framework needs from the other presets

NestJS injects by the types of constructor parameters. That takes decorators with emitted
metadata and parameter properties, and the strict base of the typescript preset refuses both.
A scope that selects nestjs gets a `tsconfig` file of this preset, which extends the shared base
and sets `experimentalDecorators` and `emitDecoratorMetadata` (D-139). The shared base names no
framework.
`integrity/tsconfig-options` requires the first pair and drops the second pair in that scope.
`@typescript-eslint/consistent-type-imports` stays on: it leaves a file with decorators alone when
both decorator options are on.

The Nest generator names a file for its feature and its kind: `cats.controller.ts` beside
`cats.service.ts`. `[[naming.rules]]` of this preset say so for the sixteen kinds the generator
writes and for `.spec` files, and `structure/prefix-collisions` reads those rules (D-112).

The acceptance bar is a planted module, controller, and service written the Nest way. They pass
every commit check with no baseline.

## Tools

As a library: @darraghor/eslint-plugin-nestjs-typed 7.5.5, which runs on the pinned ESLint 9.

## Generated configuration

Every shared rule of the javascript and typescript presets reads the files of this framework
too, with the same limits (D-137). A rule this preset turns off stands in its manifest with a
reason (D-138), and the page lists each one.

- the `flatRecommended` set of the nestjs-typed plugin. It finds a provider that no module
  provides, a route parameter that matches no decorator, and a DTO field with no validation
  decorator. It also holds the Swagger decorators to the types;
- the fragment exports its selectors (D-139). Over every code file: no `forwardRef`, and no
  `@Res()` without `passthrough`. Over `*.controller.ts`: no constructor parameter typed as a
  repository, a data source, an entity manager, or a Prisma client, and no `@InjectRepository`,
  `@InjectModel`, or `@InjectDataSource`.

## Turned off

| Rule                                                                   | Why                                           |
| ---------------------------------------------------------------------- | --------------------------------------------- |
| `@typescript-eslint/no-extraneous-class`, for a class with a decorator | a module is a decorated class with no members |
| `class-methods-use-this`                                               | Nest calls a handler as a method              |

## Checks

`typescript/eslint` with the rules above, and `integrity/tsconfig-options` with the decorator
options. No separate check.

## Settings

`tools.nestjs.swagger`, a boolean that `init` proposes from the `@nestjs/swagger` dependency.
Where it is false, the config adds the `flatNoSwagger` set of the plugin, which turns the
Swagger rules off.

## Rule files

`framework/nestjs/NESTJS.md`.
