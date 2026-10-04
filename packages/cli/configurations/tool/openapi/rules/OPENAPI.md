---
title: OpenAPI
---

# OpenAPI

## Public contracts

When the project publishes OpenAPI, its document describes the runtime API.

- Keep required fields, types, accepted media types, status codes, and security requirements
  consistent between the document and the implementation.
- Preserve the chosen schema library and the command that writes the OpenAPI document.
- Keep request and response examples valid against their schemas.
- Document error responses and nullable or optional values precisely.

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

When you write contract tests:

- Validate representative success and error responses against the published schemas.
- Exercise invalid body, query, and route values through HTTP and assert their declared errors.
- Verify authentication and authorization requirements for protected operations.
- Test the public response. Assert its status and content type.
- Keep generated schemas and their inputs synchronized through the existing generator.

An assertion that checks only selected response fields does not prove that the whole response
satisfies its schema. Use the project's schema validator for that claim.
