# NestJS

Read this rule when you change NestJS modules, controllers, providers, or their tests.

## Request handling

- Return the documented HTTP status. Do not report a failed operation as a successful response.
- Validate body, query, and route parameters before using them. Configure `ValidationPipe` transformation and
  unknown-field handling for the declared input contract.
- Do not expose password hashes, tokens, or internal fields in responses.

## Providers and lifecycle

- Register each provider in the module that owns it. Repeated registration can create distinct instances.
- Request-scoped dependencies propagate request scope to their consumers. Check lifetime and resource costs before
  choosing that scope.
- Close connections and timers through the application lifecycle, such as `OnModuleDestroy`.

## Guards

- Use guards for route authorization. Enforce extra permissions inside each protected operation when one request runs
  several, or the service has non-HTTP callers.
- Guards run before pipes. Do not assume guard inputs have passed data transfer object (DTO) transformation or
  validation.

## Feature organization

<!-- level: all -->

- Give each feature one module, and export only the providers that other modules consume.
- Inject dependencies through constructors instead of creating them inside consumers.
- Define the versioning contract before publishing a public API.
- Keep request DTOs distinct from persistence entities and map between them explicitly.

## Tests

- Use `Test.createTestingModule` and `overrideProvider` to isolate service dependencies.
- Exercise HTTP behavior with the real pipes, guards, and filters.
- Do not mock the class under test or assert on private methods.
- Close test applications in teardown.

See the NestJS [response handling](https://docs.nestjs.com/controllers) and
[authorization guidance](https://docs.nestjs.com/security/authorization).
