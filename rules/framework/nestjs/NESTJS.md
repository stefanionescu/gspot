---
layer: framework
preset: nestjs
title: NestJS
---

# NestJS

These rules cover NestJS modules, controllers, providers, validation, configuration, and tests.

## Modules

- One module holds one feature: its controllers, its providers, and nothing of another feature.
- A module exports the providers other modules may use, and nothing else. Do not export a repository.
- Two modules never import each other. Move what both need into a third module.
- Do not use `forwardRef`. It hides a cycle that the module layout must remove.
- Mark a module `@Global()` only for what every feature needs: configuration, logging, and the like.
- Register a provider in one module. A provider listed in two modules is two instances.

## Controllers

- A controller turns a request into one call on a service and turns the result into a response.
- A controller holds no business rule, no query, and no call to another service over the network.
- A controller never injects a repository, a data source, or a database client.
- Return the value from a handler. Do not take the response object with `@Res()`, because that turns off interceptors, serialization, and the return value.
- Give every route its status code, and every route that changes state a guard.
- Version the routes of a public interface from the first release.

## Providers

- A service depends on interfaces it can name, injected through the constructor as `private readonly`.
- Do not build a dependency with `new` inside a provider. Inject it, so a test can replace it.
- Keep the default singleton scope. A request-scoped provider makes everything that injects it request-scoped.
- Throw an exception from the framework set, or one of your own with a filter. Never return an error object with a 200 status.
- A provider that opens a connection or a timer implements `OnModuleDestroy` and closes it.

## Validation and data

- Every body, query, and parameter arrives through a data transfer object with validation decorators.
- Turn on the global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, and `transform`.
- A data transfer object is not an entity. Map between the two in the service.
- Never return an entity that holds a password hash, a token, or an internal flag. Return a response object.
- Parse an id with `ParseUUIDPipe` or `ParseIntPipe` at the parameter, not inside the handler.

## Configuration and security

- Read the environment once, through a validated configuration module. Providers inject that, never `process.env`.
- The application fails to start when a required variable is absent or malformed.
- Guards decide who may call a route, and they run before pipes. Do not check permissions inside a handler.
- Set a rate limit, security headers, and a body size limit at the application, before the first route ships.
- Turn off stack traces and detailed validation messages in production responses.

## Tests

- Unit test a service with its dependencies replaced through `Test.createTestingModule` and `overrideProvider`.
- Test a controller through HTTP with the real pipes, guards, and filters, so the test sees what a client sees.
- Do not mock the class under test, and do not assert on private methods.
- Close the application in `afterAll`, so a test run leaves no open handle.
