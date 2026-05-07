# Feature Specification: Place Extraction API Infrastructure

**Feature Branch**: `002-extract-place-api`
**Created**: 2026-03-25
**Status**: Draft
**Input**: "Add ValidationPipe globally to main.ts, create global exception filter, replace extract-place stub with real places domain module and service"

---

## Clarifications

### Session 2026-03-25

- Q: Should `raw_input` have security validation beyond required fields? → A: Validate only for maximum input size (e.g., 10KB); pattern validation is out of scope. FastAPI handles content-level security checks.
- Q: Should the API use a standardized response format? → A: Use project's existing API contract format (flat JSON with place object, confidence, status per docs/api-contract.md).
- Q: Should the API implement rate limiting? → A: No rate limiting at API level; rely on infrastructure/CDN for throttling at deployment layer.

---

## User Scenarios & Testing

### User Story 1 - Submit Raw Place Data for Extraction (Priority: P1)

Users submit raw place information (text, URL, or mixed content) and receive a structured extraction result with metadata and confidence score. This is the core workflow for ingesting user-provided place data into the system.

**Why this priority**: This is the entry point for the recommendation engine. Without place data, the system cannot function. This is the MVP (Minimum Viable Product) slice.

**Independent Test**: Can be fully tested by submitting a place reference via the API and verifying a structured response with place metadata and confidence score is returned. Delivers complete value independently.

**Acceptance Scenarios**:

1. **Given** user submits a valid place URL (e.g., TikTok link), **When** request is processed, **Then** user receives extracted place name, address, and confidence score in response
2. **Given** user submits plain text place description, **When** request is processed, **Then** user receives extracted place details matching the description
3. **Given** user submits mixed input (text + URL), **When** request is processed, **Then** system combines both sources and extracts place information

---

### User Story 2 - Prevent Invalid Requests from Reaching Business Logic (Priority: P2)

The system validates all incoming requests before processing and rejects requests missing required fields, providing API clients with clear feedback about validation failures.

**Why this priority**: Prevents invalid data from reaching the extraction service and provides developers with immediate, actionable error responses. Reduces wasted processing.

**Independent Test**: Can be fully tested by sending requests with missing or malformed required fields and verifying the system returns validation error responses with clear messages about what's wrong.

**Acceptance Scenarios**:

1. **Given** API request missing the required `raw_input` field, **When** request is received, **Then** system responds with 400 Bad Request indicating the missing field
2. **Given** API request with unknown/extraneous fields, **When** request is received, **Then** system strips unknown fields and processes valid ones normally

---

### User Story 3 - Handle Service Failures Gracefully (Priority: P2)

When external services are unavailable or requests timeout, the system returns meaningful error responses that indicate the service is temporarily unavailable and suggest retry, rather than crashing or returning confusing errors.

**Why this priority**: Improves system resilience and helps API clients distinguish between client errors (they sent bad data) and server errors (try again later). Essential for production reliability.

**Independent Test**: Can be fully tested by triggering various failure conditions (timeouts, service unavailable, bad gateway responses) and verifying appropriate error responses are returned with consistent messaging.

**Acceptance Scenarios**:

1. **Given** extraction service returns an error indicating the request was invalid, **When** response is processed, **Then** system returns 400 Bad Request to the API client
2. **Given** extraction service is temporarily unavailable or request times out, **When** no response is received, **Then** system returns 503 Service Unavailable with message suggesting retry
3. **Given** extraction service returns an unexpected error status, **When** response is processed, **Then** system returns 503 Service Unavailable rather than propagating the raw error

---

### Edge Cases

- What happens when a place extraction request arrives while the external service is unreachable? System returns 503 service unavailable error without crashing
- What happens when request validation detects both missing fields and unknown fields? System reports missing fields error first, validation fails before unknown fields are stripped
- What happens when the extraction service responds with a non-standard HTTP status code? System treats as server error (5xx → 503) and suggests retry
- How does the system handle network timeouts? System returns 503 service unavailable error instead of letting the request hang

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST accept place extraction requests via POST endpoint at `/places/extract`
- **FR-002**: System MUST validate all incoming requests to ensure required fields are present and properly formatted, rejecting invalid requests with 400 Bad Request status and descriptive error message
- **FR-002a**: System MUST enforce a maximum input size limit of 10KB on the `raw_input` field to prevent denial-of-service attacks; larger inputs are rejected with 400 Bad Request
- **FR-003**: System MUST remove unknown/extraneous fields from requests after validation without failing the request
- **FR-004**: System MUST forward validated requests to the extraction service and return the response to the client
- **FR-005**: System MUST map extraction service errors to appropriate HTTP responses: 400 from service → 400 to client, 422 from service → 422 "couldn't understand your request" to client, 500 from service → 503 "service temporarily unavailable, please retry" to client
- **FR-006**: System MUST handle timeouts and service unavailability (no response received) by returning 503 "service temporarily unavailable, please retry" to the client
- **FR-007**: System MUST handle unexpected errors and exceptions by returning 500 Internal Server Error without leaking internal error details to the client
- **FR-008**: System MUST validate requests using a standardized validation mechanism that is applied globally to all API endpoints
- **FR-009**: System MUST use a centralized error handling mechanism to consistently map exceptions to HTTP responses across all endpoints

### Key Entities

- **Place Extraction Request**: User-submitted raw place information requiring parsing and validation
  - `raw_input` (required, max 10KB): String containing place text, URL, or combined format
- **Place Extraction Response**: Structured result from extraction service, following the format defined in docs/api-contract.md
  - `place_id`: Unique identifier for saved place (or null if not yet saved)
  - `place`: Object containing extracted place details
    - `place_name`: Extracted place name
    - `address`: Extracted place address
    - `cuisine`: Place cuisine type (nullable)
    - `price_range`: Place price range (nullable)
  - `confidence`: Confidence score (0-1)
  - `status`: Resolution status (resolved/unresolved)
  - `requires_confirmation`: Boolean indicating if user confirmation is needed
  - `source_url`: Original URL if provided in input (nullable)

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: All valid place extraction requests receive a response within 10 seconds (99th percentile under 20 seconds)
- **SC-002**: 100% of requests with validation errors are rejected before reaching the extraction service
- **SC-003**: 100% of extraction service errors are mapped to appropriate client error responses (no unhandled exceptions leak to client)
- **SC-004**: System maintains 99.9% uptime for request handling (validation and error handling work even when extraction service is unavailable)
- **SC-005**: Validation errors provide clear, actionable messages that help API clients understand what needs to be fixed
- **SC-006**: All API requests (successful and failed) follow consistent error response format

---

## Constraints & Assumptions

### Constraints

- Request validation MUST occur before any business logic execution
- Error handling MUST be centralized and apply globally to all endpoints
- No business logic (place extraction, database writes, complex processing) occurs in the places controller or service
- The service layer makes exactly one call to the extraction client and returns the response unchanged
- Extraction service errors must propagate unchanged to the exception filter for mapping

### Assumptions

- Extraction service is the only external dependency called by the places module
- Extraction service returns standard HTTP status codes (200, 400, 422, 500, etc.)
- Network timeout occurs when no response is received within 10 seconds
- Validation framework can standardize validation across all endpoints globally
- Centralized exception filter can intercept all exceptions from all handlers
- Place data persistence is handled entirely by the extraction service (kebi), not by this module
- Rate limiting is handled at the infrastructure/CDN layer (reverse proxy, API gateway), not implemented in the NestJS application code
- Pattern-level security validation (XSS, injection detection) is the responsibility of the FastAPI extraction service, not the NestJS gateway

---

## Out of Scope

- Persistence of place data (handled by extraction service)
- Complex validation rules beyond required field checks
- Authentication and authorization (handled by middleware)
- Logging and observability beyond error mapping
- Retry logic for failed requests (client responsibility)
