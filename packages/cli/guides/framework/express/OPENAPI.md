---
layer: framework
kit: express
title: OpenAPI
---

# OpenAPI

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

## Public contracts

When the project publishes OpenAPI, its document describes the runtime API.
Express does not supply schema validation or OpenAPI generation itself.

- Keep required fields, types, accepted media types, status codes, and security requirements
  consistent between the document and the implementation.
- Validate route parameters, query parameters, and request bodies before using their values.
  Coercion follows the declared contract; it does not make arbitrary input valid.
- Preserve the chosen schema library and generation owner. Do not add Zod or an OpenAPI adapter
  solely because the application uses Express.
- Keep request and response examples valid against their schemas.
- Document error responses and nullable or optional values precisely.
- Do not publish internal fields or secret examples.

This OpenAPI 3.1 fragment describes a query limit. Its bounds and default must also hold
when the server handles the request:

```yaml
parameters:
  - name: limit
    in: query
    required: false
    schema:
      type: integer
      minimum: 1
      maximum: 100
      default: 50
```

## Contract tests

- Validate representative success and error responses against the published schemas.
- Exercise invalid body, query, and route values through HTTP and assert their declared errors.
- Verify authentication and authorization requirements for protected operations.
- Test the public response. Assert its status and content type.
- Keep generated schemas and their inputs synchronized through the existing generator.

An assertion that checks only selected response fields does not prove that the whole response
satisfies its schema. Use the project's schema validator for that own.

## Contract organization

<!-- level: all -->

- Keep endpoint-specific schemas with their endpoint owner.
- Share a schema only when multiple endpoints have the same public contract.
- Keep one source for each public contract. Avoid independently maintained copies in test data.
- Use API-facing names instead of leaking provider or database names unless that is the declared
  public interface.
