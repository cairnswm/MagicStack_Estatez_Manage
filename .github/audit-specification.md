# Audit System Technical Specification

## Overview

The Audit System provides a consistent mechanism for recording data changes and operational events across all modules within the application. It is designed to support security investigations, regulatory compliance, troubleshooting and historical reporting while remaining independent of the business logic of each module.

The audit system consists of two independent concepts.

The first records changes made to business data. These records describe what changed, who changed it, when it changed and the individual fields that were modified.

The second records operational events that occur within the system but are not direct modifications to business data. Examples include successful logins, failed authentication attempts, QR code validation failures, synchronization failures and other runtime events.

The audit system is a shared service used by every module within the application.

## Design Principles

The audit system should be transparent to business logic. APIs should not contain duplicated audit code and individual developers should not need to remember how to perform auditing.

Audit records must never modify or replace business data.

Audit failures must never cause successful business transactions to be rolled back unless explicitly configured for high security operations.

Audit records are append-only. Existing audit records are never updated or deleted except through database archival processes.

Every audit record must include sufficient information to identify the affected entity, the authenticated user that performed the action and the time at which the action occurred.

## Data Change Auditing

Data change auditing records changes made to important business entities.

Typical audited entities include:

* Estates
* Units
* People
* Vehicles
* Guests
* QR Codes
* Gates
* Configuration
* Security Settings

For each change the system records:

* Entity
* Record identifier
* Operation
* Authenticated user
* Timestamp
* Optional reason
* Individual field changes

Field level auditing stores both the previous value and the new value for every modified field.

Only changed fields are recorded.

For example, changing a person's mobile number should generate a single field audit entry rather than recording the complete person record.

## Operational Event Auditing

Operational events record actions performed by users or the system.

Examples include:

* User login
* User logout
* Failed login
* Invalid API key
* Failed permission check
* QR code scanned
* Invalid QR code
* Expired QR code
* Offline synchronization
* Device registration
* System startup
* Background job execution

These events are informational and do not represent modifications to business data.

## Audit Levels

Every event should be assigned an appropriate severity.

INFO is used for normal system operation.

WARNING is used for unusual but recoverable situations.

ERROR is used when an operation fails unexpectedly.

SECURITY is used for authentication failures, permission violations and suspected tampering.

CRITICAL is reserved for events requiring immediate administrative attention.

## API Integration

Every API endpoint should participate in the audit framework automatically.

The business logic should not directly insert audit records.

Instead every request passes through a common auditing component.

The request lifecycle becomes:

Request received.

Authentication performed.

Authorisation performed.

Business operation executed.

Database transaction committed.

Audit records generated.

Response returned.

This ensures every API behaves consistently.

## Create Operations

Before the record is inserted no audit information exists.

After a successful insert an audit record is generated containing:

Operation = CREATE.

Record identifier.

Authenticated user.

Timestamp.

Every field that was initially populated.

## Update Operations

Before updating a record the current database values are loaded.

After the update the previous and current values are compared.

Only fields whose values changed are recorded.

If no business fields changed then no audit record is created.

This prevents unnecessary audit entries caused by repeated updates containing identical values.

## Delete Operations

Physical deletes should generally be avoided.

Most entities should instead contain an Active flag.

When an entity is deactivated the audit system records this as a normal UPDATE.

If a physical delete is required the audit system records:

Operation = DELETE.

All previous values.

Authenticated user.

Timestamp.

## Bulk Operations

Bulk operations should create one audit record for every affected entity.

For example importing twenty vehicles should generate twenty independent CREATE audit records.

This allows complete historical reconstruction of every entity.

## Background Processes

Scheduled jobs also participate in auditing.

Examples include:

QR code expiry.

Guest expiry.

Offline synchronization.

Database cleanup.

Each job executes using a dedicated system user.

The audit records therefore identify whether a human user or an automated process performed the action.

## Authentication Information

The audit framework obtains authentication information from the validated JWT.

Typical values include:

User identifier.

Tenant identifier.

Estate identifier where applicable.

Application identifier.

The audit framework should never trust values supplied directly in the request body.

## Audit Service

The application should expose a reusable Audit Service.

The service provides methods similar to:

```typescript
auditCreate(entity, recordId, entityData)

auditUpdate(entity, recordId, before, after)

auditDelete(entity, recordId, before)

auditEvent(eventType, severity, description)
```

Business services call these methods rather than writing directly to database tables.

## Automatic Field Comparison

The Audit Service should compare objects automatically.

The service examines every property and generates field audit records only for values that changed.

The comparison engine should ignore:

created_at

modified_at

Any calculated fields

Any transient response fields

This keeps audit records concise and meaningful.

## Database Transactions

Business changes and audit records should participate in the same database transaction.

If the business transaction is rolled back then the corresponding audit records are also rolled back.

This guarantees that every successful business operation has a matching audit history.

## Viewing Audit History

Every major entity should expose an Audit History API.

Examples include:

GET /estate/{id}/audit

GET /unit/{id}/audit

GET /person/{id}/audit

GET /vehicle/{id}/audit

GET /qr-code/{id}/audit

The response should contain:

Timestamp.

Authenticated user.

Operation.

Reason.

Changed fields.

Previous values.

New values.

## Reporting

The audit system should support reporting across all modules.

Reports include:

Complete history for a single entity.

All changes performed by a user.

Changes performed within a date range.

Security events.

Failed authentication attempts.

Configuration changes.

Administrative activity.

## Future Expansion

The audit system should remain independent of every business module.

Future modules should automatically use the same audit framework without modification to the existing audit tables.

This ensures a consistent auditing model across the entire SaaS platform regardless of how many additional modules are introduced.
