# Access Control API Specification

## 1. Overview

The Access Control API manages gate access, QR credentials, entry and exit events, guard devices, offline synchronization and the live “currently inside” view for an estate.

The Access Control System does not own estate master data. Estates, units, people, vehicles and guests are owned by the Estate Management System. The Access Control System consumes that data through internal APIs and keeps a local cache where required for performance and offline gate operation.

Authentication is handled by the existing Auth Service. This API expects every protected request to contain a valid JWT or an approved service API key.

The Access Control System owns the following data:

Gates.

Guard devices.

QR credential records.

Access events.

Currently inside records.

Sync logs.

Access settings.

Access-related audit events.

## 2. Common API Rules

All APIs are tenant-aware and estate-aware.

Every request must be authenticated.

Administrative APIs require estate administrator or access administrator permission.

Guard APIs require the authenticated user to have guard permissions or the guard device to be registered and trusted.

Service APIs require a trusted internal API key.

All create, update, deactivate and revoke actions must write audit records.

Entry and exit scans must always create access events.

The `access_currently_inside` table is treated as a live materialized table, updated from successful entry and exit events.

The Access Control System must continue operating during intermittent internet failures by allowing guard devices to validate signed QR codes and queue offline access events for later synchronization.

## 3. Common Headers

```ts
type ApiHeaders = {
  authorization?: string;
  "x-tenant-id": string;
  "x-hostname"?: string;
  "x-apikey"?: string;
  "x-device-id"?: string;
};
```

The `authorization` header contains the JWT bearer token for normal web users and guards.

The `x-apikey` header is used by trusted internal services.

The `x-device-id` header identifies the guard device making a scan or sync request.

## 4. Common Response Types

```ts
type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

type ApiErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type PagingRequest = {
  page?: number;
  pageSize?: number;
  search?: string;
  active?: boolean;
};

type PagingResponse<T> = {
  rows: T[];
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
};
```

## 5. Core Data Types

```ts
type AccessGate = {
  id: number;
  estateId: number;
  name: string;
  description?: string;
  gateType: "VEHICLE" | "PEDESTRIAN" | "MIXED";
  active: boolean;
  createdAt: string;
  modifiedAt: string;
};

type AccessGuardDevice = {
  id: number;
  gateId: number;
  deviceName: string;
  deviceIdentifier: string;
  lastSeenAt?: string;
  active: boolean;
  createdAt: string;
  modifiedAt: string;
};

type AccessQrType = {
  id: number;
  code: "OWNER" | "ESTATE_EMPLOYEE" | "UNIT_EMPLOYEE" | "GUEST";
  description: string;
  systemType: boolean;
  createdAt: string;
  modifiedAt: string;
};

type AccessQrCode = {
  id: number;
  estateId: number;
  qrTypeId: number;
  personId?: number;
  guestId?: number;
  codeIdentifier: string;
  tokenVersion: number;
  issuedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  active: boolean;
  createdAt: string;
  modifiedAt: string;
};

type AccessEvent = {
  id: number;
  estateId: number;
  gateId: number;
  guardDeviceId: number;
  qrCodeId?: number;
  qrTypeId?: number;
  personId?: number;
  guestId?: number;
  vehicleId?: number;
  direction: "ENTRY" | "EXIT";
  occupants: number;
  vehicleRegistration?: string;
  unregisteredVehicle: boolean;
  occurredAt: string;
  offlineScan: boolean;
  synchronizedAt?: string;
  createdAt: string;
  modifiedAt: string;
};

type AccessCurrentlyInside = {
  id: number;
  estateId: number;
  personId?: number;
  guestId?: number;
  vehicleId?: number;
  qrCodeId?: number;
  entryEventId: number;
  gateId: number;
  occupants: number;
  enteredAt: string;
  createdAt: string;
  modifiedAt: string;
};

type AccessSyncLog = {
  id: number;
  guardDeviceId: number;
  syncStartedAt: string;
  syncCompletedAt?: string;
  uploadEvents: number;
  downloadRecords: number;
  success: boolean;
  message?: string;
  createdAt: string;
  modifiedAt: string;
};

type AccessSetting = {
  id: number;
  estateId: number;
  settingKey: string;
  settingValue?: string;
  createdAt: string;
  modifiedAt: string;
};
```

## 6. Estate Cache Types

The Access Control System consumes these records from the Estate Management System. They may be cached locally for scans and offline operation, but they are not mastered by the Access Control System.

```ts
type CachedEstate = {
  id: number;
  name: string;
  code: string;
  timezone: string;
  active: boolean;
};

type CachedUnit = {
  id: number;
  estateId: number;
  unitNumber: string;
  displayName?: string;
  active: boolean;
};

type CachedPerson = {
  id: number;
  estateId: number;
  firstName: string;
  lastName: string;
  preferredName?: string;
  mobile?: string;
  active: boolean;
  units: Array<{
    id: number;
    unitNumber: string;
    relationshipType: string;
  }>;
  vehicles: CachedVehicle[];
};

type CachedVehicle = {
  id: number;
  estateId: number;
  registrationNumber: string;
  make?: string;
  model?: string;
  colour?: string;
  description?: string;
  active: boolean;
};

type CachedGuest = {
  id: number;
  estateId: number;
  unitId: number;
  hostPersonId: number;
  guestName: string;
  mobile?: string;
  email?: string;
  validFrom: string;
  validTo: string;
  active: boolean;
  unit: CachedUnit;
};
```

## 7. Compound Data Types

```ts
type QrCredentialDetail = AccessQrCode & {
  qrType: AccessQrType;
  person?: CachedPerson;
  guest?: CachedGuest;
};

type GuardScanPerson = {
  personId?: number;
  guestId?: number;
  displayName: string;
  qrType: string;
  units: Array<{
    unitId: number;
    unitNumber: string;
    relationshipType: string;
  }>;
  vehicles: CachedVehicle[];
};

type GuardScanResult = {
  valid: boolean;
  status:
    | "VALID"
    | "INVALID_SIGNATURE"
    | "EXPIRED"
    | "REVOKED"
    | "INACTIVE_PERSON"
    | "INACTIVE_GUEST"
    | "NOT_FOUND"
    | "WRONG_ESTATE";
  message?: string;
  qrCode?: AccessQrCode;
  person?: GuardScanPerson;
  offlineAllowed: boolean;
  requiresVehicleSelection: boolean;
  requiresOccupantCount: boolean;
};

type CurrentlyInsideDetail = AccessCurrentlyInside & {
  person?: CachedPerson;
  guest?: CachedGuest;
  vehicle?: CachedVehicle;
  gate: AccessGate;
};

type GateDashboard = {
  gate: AccessGate;
  deviceCount: number;
  lastEventAt?: string;
  todayEntryCount: number;
  todayExitCount: number;
  currentlyInsideCount: number;
};

type AccessDashboard = {
  estateId: number;
  generatedAt: string;
  counts: {
    currentlyInsidePeople: number;
    currentlyInsideVehicles: number;
    entriesToday: number;
    exitsToday: number;
    invalidScansToday: number;
    offlineEventsPending: number;
  };
  gates: GateDashboard[];
};
```

## 8. Standard CRUD Endpoints

The following access resources use the same CRUD pattern:

`gate`

`guard-device`

`qr-code`

`setting`

The standard routes are:

```text
GET    /api/access/{resource}
GET    /api/access/{resource}/{id}
POST   /api/access/{resource}
PUT    /api/access/{resource}/{id}
PATCH  /api/access/{resource}/{id}/deactivate
PATCH  /api/access/{resource}/{id}/activate
```

## 8.1 Standard List API

Method: `GET`

Route: `/api/access/{resource}`

Request:

```ts
type StandardListRequest = PagingRequest & {
  estateId?: number;
};
```

Response:

```ts
type StandardListResponse<T> = ApiResponse<PagingResponse<T>>;
```

The API returns a paged list of records for the requested resource.

All list APIs must filter by tenant and estate where applicable. Search should match useful display fields, such as gate name, device name, device identifier, QR code identifier or setting key.

Security requires an authenticated user with access administrator permission, except guard devices that may read limited device-related records during sync.

No audit record is required for read-only list operations.

## 8.2 Standard Detail API

Method: `GET`

Route: `/api/access/{resource}/{id}`

Request:

```ts
type StandardDetailRequest = {
  id: number;
};
```

Response:

```ts
type StandardDetailResponse<T> = ApiResponse<T>;
```

The API returns a single record by ID. The record must belong to the caller's permitted estate context.

Security requires access administrator permission.

No audit record is required for read-only detail operations.

## 8.3 Standard Create API

Method: `POST`

Route: `/api/access/{resource}`

Request:

```ts
type StandardCreateRequest<T> = Partial<T>;
```

Response:

```ts
type StandardCreateResponse<T> = ApiResponse<T>;
```

The API creates a new record after validating required fields and linked records.

The API must write an audit change record with action `CREATE`.

## 8.4 Standard Update API

Method: `PUT`

Route: `/api/access/{resource}/{id}`

Request:

```ts
type StandardUpdateRequest<T> = Partial<T>;
```

Response:

```ts
type StandardUpdateResponse<T> = ApiResponse<T>;
```

The API updates an existing record. The service must load the previous version, compare changes and write field-level audit changes.

The API must write an audit change record with action `UPDATE`.

## 8.5 Standard Deactivate API

Method: `PATCH`

Route: `/api/access/{resource}/{id}/deactivate`

Request:

```ts
type DeactivateRequest = {
  reason?: string;
};
```

Response:

```ts
type DeactivateResponse<T> = ApiResponse<T>;
```

The API marks the record inactive.

The API must write an audit record showing `active` changing from `true` to `false`.

## 8.6 Standard Activate API

Method: `PATCH`

Route: `/api/access/{resource}/{id}/activate`

Request:

```ts
type ActivateRequest = {
  reason?: string;
};
```

Response:

```ts
type ActivateResponse<T> = ApiResponse<T>;
```

The API reactivates an inactive record.

The API must validate that reactivation does not create invalid duplicates, such as duplicate active guard devices.

The API must audit the activation.

## 9. Dashboard APIs

## 9.1 Get Access Dashboard

Method: `GET`

Route: `/api/access/estates/{estateId}/dashboard`

Request:

```ts
type GetAccessDashboardRequest = {
  estateId: number;
};
```

Response:

```ts
type GetAccessDashboardResponse = ApiResponse<AccessDashboard>;
```

This API returns the main access control dashboard for an estate. It includes gate summaries, current occupancy counts, entry and exit counts for the current day, invalid scan counts and pending offline event counts.

Security requires access administrator permission or estate administrator permission.

The API reads from `access_gate`, `access_guard_device`, `access_event`, `access_currently_inside` and `access_sync_log`.

No audit record is required.

## 9.2 Get Gate Dashboard

Method: `GET`

Route: `/api/access/gates/{gateId}/dashboard`

Request:

```ts
type GetGateDashboardRequest = {
  gateId: number;
};
```

Response:

```ts
type GetGateDashboardResponse = ApiResponse<GateDashboard>;
```

This API returns operational information for a single gate, including device count, latest event time, today's entries, today's exits and current occupancy linked to that gate.

Security requires access administrator permission, estate administrator permission or guard permission for that gate.

No audit record is required.

## 10. QR Credential APIs

## 10.1 Issue QR Credential

Method: `POST`

Route: `/api/access/qr-codes/issue`

Request:

```ts
type IssueQrCredentialRequest = {
  estateId: number;
  qrType: "OWNER" | "ESTATE_EMPLOYEE" | "UNIT_EMPLOYEE" | "GUEST";
  personId?: number;
  guestId?: number;
  credentialMode: "STATIC" | "DYNAMIC";
  expiresAt?: string;
  reason?: string;
};
```

Response:

```ts
type IssueQrCredentialResponse = ApiResponse<{
  qrCode: AccessQrCode;
  qrPayload: string;
}>;
```

This API issues a QR credential for a person or guest.

For owner, estate employee and unit employee QR codes, `personId` is required.

For guest QR codes, `guestId` is required.

The API must validate the person or guest against the Estate Management System or the local estate cache before issuing the credential. The person or guest must be active and must belong to the same estate.

For static credentials, the API returns a signed token that can be printed or saved. Static credentials may have long expiry dates.

For dynamic credentials, the API creates the credential record but individual rotating QR payloads should be generated through the dynamic QR API.

Security requires access administrator permission for employee and owner credentials. Guest credentials may be issued by a resident when linked to the guest's unit and when estate settings allow guest self-service.

The API must audit credential creation.

## 10.2 Generate Dynamic QR Payload

Method: `POST`

Route: `/api/access/qr-codes/{qrCodeId}/dynamic-token`

Request:

```ts
type GenerateDynamicQrTokenRequest = {
  qrCodeId: number;
};
```

Response:

```ts
type GenerateDynamicQrTokenResponse = ApiResponse<{
  qrPayload: string;
  expiresAt: string;
}>;
```

This API generates a short-lived signed QR payload for an existing dynamic QR credential.

The token should include enough information to identify the credential and validate the estate, person or guest. It should expire quickly, usually within 30 to 60 seconds.

Security requires the authenticated user to own the credential or have administrator permission.

No audit change is required for every token generation, but suspicious or excessive generation may create an `audit_event`.

## 10.3 Get QR Credential Detail

Method: `GET`

Route: `/api/access/qr-codes/{qrCodeId}/detail`

Request:

```ts
type GetQrCredentialDetailRequest = {
  qrCodeId: number;
};
```

Response:

```ts
type GetQrCredentialDetailResponse = ApiResponse<QrCredentialDetail>;
```

This API returns the QR credential, its type and the linked cached person or guest data.

Security requires access administrator permission or ownership of the credential.

No audit record is required.

## 10.4 Revoke QR Credential

Method: `PATCH`

Route: `/api/access/qr-codes/{qrCodeId}/revoke`

Request:

```ts
type RevokeQrCredentialRequest = {
  reason?: string;
};
```

Response:

```ts
type RevokeQrCredentialResponse = ApiResponse<AccessQrCode>;
```

This API revokes a QR credential by setting `revokedAt` and `active` to false.

A revoked credential must no longer validate online. Guard devices should receive revoked credential identifiers during synchronization so that offline validation can also reject the credential after the next sync.

Security requires access administrator permission. A resident may revoke their own guest QR code if guest self-service is enabled.

The API must audit credential revocation.

## 10.5 Renew QR Credential

Method: `POST`

Route: `/api/access/qr-codes/{qrCodeId}/renew`

Request:

```ts
type RenewQrCredentialRequest = {
  expiresAt?: string;
  reason?: string;
};
```

Response:

```ts
type RenewQrCredentialResponse = ApiResponse<{
  oldQrCode: AccessQrCode;
  newQrCode: AccessQrCode;
  qrPayload: string;
}>;
```

This API renews an existing QR credential by revoking the old credential and issuing a new one.

The API must validate that the linked person or guest is still active and still authorised.

Security requires access administrator permission or credential ownership where permitted.

The API must audit both the revocation of the old credential and the creation of the new credential.

## 11. QR Validation and Scan APIs

## 11.1 Validate QR Payload

Method: `POST`

Route: `/api/access/scan/validate`

Request:

```ts
type ValidateQrPayloadRequest = {
  estateId: number;
  gateId: number;
  guardDeviceId: number;
  qrPayload: string;
  scannedAt: string;
};
```

Response:

```ts
type ValidateQrPayloadResponse = ApiResponse<GuardScanResult>;
```

This API validates a scanned QR payload without recording an entry or exit event.

The API must decode the token, verify the signature, check expiry, check estate, check credential status and then load cached person or guest details.

If the QR code is valid, the response returns the person or guest details and indicates whether vehicle selection and occupant count are required.

If the QR code is invalid, expired or revoked, the response returns a failed validation result. Invalid attempts should be written to `audit_event` with severity `WARNING` or `SECURITY` depending on the failure reason.

Security requires a valid guard device and guard permission.

This API does not update `access_currently_inside`.

## 11.2 Record Entry

Method: `POST`

Route: `/api/access/scan/entry`

Request:

```ts
type RecordEntryRequest = {
  estateId: number;
  gateId: number;
  guardDeviceId: number;
  qrPayload: string;
  qrCodeId?: number;
  personId?: number;
  guestId?: number;
  vehicleId?: number;
  vehicleRegistration?: string;
  unregisteredVehicle?: boolean;
  occupants: number;
  occurredAt: string;
  offlineScan?: boolean;
};
```

Response:

```ts
type RecordEntryResponse = ApiResponse<{
  event: AccessEvent;
  currentlyInside: AccessCurrentlyInside;
}>;
```

This API records a successful entry into the estate.

The API must validate the QR payload or use a previously validated QR code ID from the same scan workflow. It must confirm the credential is valid, the person or guest is active and the selected vehicle belongs to the person where applicable.

If an unregistered vehicle is used, the API must check the estate's unknown vehicle policy. The default policy is to allow the entry and mark `unregisteredVehicle` as true.

The API inserts a row into `access_event` with direction `ENTRY`.

The API then creates or updates the matching `access_currently_inside` record. If the same person or guest is already inside, the system should either update the existing record or create a warning event depending on estate settings. The default should be to update the latest entry event and keep a warning audit event.

Security requires guard permission and a valid guard device.

The API must write the access event. A separate audit change is not required for normal access events because `access_event` is itself the operational record. An `audit_event` should be written for unusual cases such as duplicate entry, unregistered vehicle, offline scan, expired credential attempt or revoked credential attempt.

## 11.3 Record Exit

Method: `POST`

Route: `/api/access/scan/exit`

Request:

```ts
type RecordExitRequest = {
  estateId: number;
  gateId: number;
  guardDeviceId: number;
  qrPayload: string;
  qrCodeId?: number;
  personId?: number;
  guestId?: number;
  vehicleId?: number;
  vehicleRegistration?: string;
  occupants?: number;
  occurredAt: string;
  offlineScan?: boolean;
};
```

Response:

```ts
type RecordExitResponse = ApiResponse<{
  event: AccessEvent;
  removedCurrentlyInside?: AccessCurrentlyInside;
}>;
```

This API records a successful exit from the estate.

The API must validate the credential where possible, insert an `access_event` row with direction `EXIT` and remove the matching row from `access_currently_inside`.

If no matching currently-inside record exists, the API should still record the exit event but create an `audit_event` warning that an exit occurred without a matching entry.

Security requires guard permission and a valid guard device.

Normal exits do not require a separate audit change because the access event is the operational record.

## 11.4 Record Invalid Scan

Method: `POST`

Route: `/api/access/scan/invalid`

Request:

```ts
type RecordInvalidScanRequest = {
  estateId: number;
  gateId: number;
  guardDeviceId: number;
  qrPayload?: string;
  failureReason:
    | "INVALID_SIGNATURE"
    | "EXPIRED"
    | "REVOKED"
    | "WRONG_ESTATE"
    | "UNKNOWN"
    | "MALFORMED";
  occurredAt: string;
  offlineScan?: boolean;
};
```

Response:

```ts
type RecordInvalidScanResponse = ApiResponse<{
  recorded: boolean;
}>;
```

This API records that a QR scan failed validation.

This is useful when a guard device validates a signed token offline and later uploads the invalid scan record.

The API writes an `audit_event` with severity `WARNING` or `SECURITY`.

No `access_event` row is created unless the estate chooses to store denied events inside `access_event` in a future version.

## 12. Currently Inside APIs

## 12.1 Get Currently Inside List

Method: `GET`

Route: `/api/access/estates/{estateId}/currently-inside`

Request:

```ts
type GetCurrentlyInsideRequest = PagingRequest & {
  estateId: number;
  personType?: "OWNER" | "ESTATE_EMPLOYEE" | "UNIT_EMPLOYEE" | "GUEST";
  gateId?: number;
};
```

Response:

```ts
type GetCurrentlyInsideResponse = ApiResponse<PagingResponse<CurrentlyInsideDetail>>;
```

This API returns the live list of people currently recorded as being inside the estate.

It is intended for security staff, administrators and emergency response.

The API should enrich `access_currently_inside` records with cached person, guest, vehicle and gate information.

Security requires access administrator permission, estate administrator permission or emergency viewer permission.

No audit record is required for normal viewing. Exporting this list may create an `audit_event`.

## 12.2 Get Emergency Occupancy List

Method: `GET`

Route: `/api/access/estates/{estateId}/emergency-list`

Request:

```ts
type GetEmergencyListRequest = {
  estateId: number;
};
```

Response:

```ts
type EmergencyOccupancyPerson = {
  displayName: string;
  personType: string;
  unitNumbers: string[];
  mobile?: string;
  vehicleRegistration?: string;
  occupants: number;
  gateName: string;
  enteredAt: string;
};

type GetEmergencyListResponse = ApiResponse<{
  estateId: number;
  generatedAt: string;
  people: EmergencyOccupancyPerson[];
}>;
```

This API returns a simplified emergency list of people believed to be inside the estate.

It is designed for wildfire, evacuation or security emergencies. The system must treat this as a best-effort list because manual register entries and missed exits may make it imperfect.

Security requires emergency viewer permission, access administrator permission or estate administrator permission.

The API should write an `audit_event` with severity `INFO` stating that the emergency list was viewed.

## 12.3 Manually Clear Currently Inside Record

Method: `PATCH`

Route: `/api/access/currently-inside/{currentlyInsideId}/clear`

Request:

```ts
type ClearCurrentlyInsideRequest = {
  reason: string;
};
```

Response:

```ts
type ClearCurrentlyInsideResponse = ApiResponse<AccessCurrentlyInside>;
```

This API allows an administrator or supervisor to clear an incorrect currently-inside record.

This is not a gate override. It is an administrative cleanup action for cases where someone forgot to scan out or an offline sync caused duplicate occupancy.

Security requires access administrator or supervisor permission.

The API must remove or deactivate the current occupancy record and write an audit event with the reason.

## 13. Gate APIs

## 13.1 Get Gates for Estate

Method: `GET`

Route: `/api/access/estates/{estateId}/gates`

Request:

```ts
type GetEstateGatesRequest = PagingRequest & {
  estateId: number;
};
```

Response:

```ts
type GetEstateGatesResponse = ApiResponse<PagingResponse<AccessGate>>;
```

This API returns all gates configured for an estate.

Security requires access administrator permission, estate administrator permission or guard permission.

No audit record is required.

## 13.2 Get Gate Detail

Method: `GET`

Route: `/api/access/gates/{gateId}/detail`

Request:

```ts
type GetGateDetailRequest = {
  gateId: number;
};
```

Response:

```ts
type GateDetail = AccessGate & {
  devices: AccessGuardDevice[];
  dashboard: GateDashboard;
};

type GetGateDetailResponse = ApiResponse<GateDetail>;
```

This API returns a gate, its assigned guard devices and a dashboard summary.

Security requires access administrator permission or estate administrator permission.

No audit record is required.

## 14. Guard Device APIs

## 14.1 Register Guard Device

Method: `POST`

Route: `/api/access/guard-devices/register`

Request:

```ts
type RegisterGuardDeviceRequest = {
  estateId: number;
  gateId: number;
  deviceName: string;
  deviceIdentifier: string;
};
```

Response:

```ts
type RegisterGuardDeviceResponse = ApiResponse<AccessGuardDevice>;
```

This API registers a guard device against a gate.

The service must ensure the gate belongs to the estate and that the device identifier is not already registered for another active device.

Security requires access administrator permission.

The API must audit device registration.

## 14.2 Device Heartbeat

Method: `POST`

Route: `/api/access/guard-devices/{guardDeviceId}/heartbeat`

Request:

```ts
type DeviceHeartbeatRequest = {
  guardDeviceId: number;
  deviceTime: string;
  appVersion?: string;
  batteryPercent?: number;
  online: boolean;
};
```

Response:

```ts
type DeviceHeartbeatResponse = ApiResponse<{
  serverTime: string;
  syncRecommended: boolean;
}>;
```

This API allows a guard device to indicate that it is online and active.

The API updates `last_seen_at` on `access_guard_device`.

Security requires the device to be registered and trusted.

No audit record is required for normal heartbeat events. Repeated failures or unknown device identifiers should create security audit events.

## 14.3 Assign Device to Gate

Method: `PATCH`

Route: `/api/access/guard-devices/{guardDeviceId}/assign-gate`

Request:

```ts
type AssignDeviceToGateRequest = {
  gateId: number;
  reason?: string;
};
```

Response:

```ts
type AssignDeviceToGateResponse = ApiResponse<AccessGuardDevice>;
```

This API moves a guard device to another gate.

The service must validate that the new gate belongs to the same estate.

Security requires access administrator permission.

The API must audit the gate assignment change.

## 15. Offline Sync APIs

## 15.1 Get Device Sync Package

Method: `GET`

Route: `/api/access/guard-devices/{guardDeviceId}/sync-package`

Request:

```ts
type GetDeviceSyncPackageRequest = {
  guardDeviceId: number;
  modifiedSince?: string;
};
```

Response:

```ts
type RevokedCredential = {
  qrCodeId: number;
  codeIdentifier: string;
  revokedAt: string;
};

type DeviceSyncPackage = {
  estate: CachedEstate;
  gates: AccessGate[];
  settings: AccessSetting[];
  people: CachedPerson[];
  guests: CachedGuest[];
  revokedCredentials: RevokedCredential[];
  qrTypes: AccessQrType[];
  generatedAt: string;
};

type GetDeviceSyncPackageResponse = ApiResponse<DeviceSyncPackage>;
```

This API returns the data a guard device needs for offline operation.

The sync package should include active estate people, active guests, vehicles, settings, QR types and revoked credentials.

If `modifiedSince` is provided, the API should return only changed records where possible. If the device has been offline too long or the server cannot safely provide a delta, it should return a full sync package.

Security requires a registered guard device.

The API writes an `access_sync_log` record or updates the sync log after completion.

## 15.2 Upload Offline Events

Method: `POST`

Route: `/api/access/guard-devices/{guardDeviceId}/offline-events`

Request:

```ts
type OfflineAccessEventUpload = {
  localEventId: string;
  estateId: number;
  gateId: number;
  qrCodeId?: number;
  qrTypeId?: number;
  personId?: number;
  guestId?: number;
  vehicleId?: number;
  direction: "ENTRY" | "EXIT";
  occupants: number;
  vehicleRegistration?: string;
  unregisteredVehicle?: boolean;
  occurredAt: string;
  qrPayload?: string;
};

type UploadOfflineEventsRequest = {
  guardDeviceId: number;
  events: OfflineAccessEventUpload[];
};
```

Response:

```ts
type OfflineEventUploadResult = {
  localEventId: string;
  accepted: boolean;
  serverEventId?: number;
  message?: string;
};

type UploadOfflineEventsResponse = ApiResponse<{
  results: OfflineEventUploadResult[];
  synchronizedAt: string;
}>;
```

This API uploads access events recorded while the device was offline.

The API must process each event idempotently using `localEventId`, guard device ID and occurred timestamp to avoid duplicate inserts.

For accepted entry events, the API must insert an `access_event` row and update `access_currently_inside`.

For accepted exit events, the API must insert an `access_event` row and remove the matching currently-inside record if found.

Events that cannot be fully verified should still be recorded if the signed QR payload was valid at the time of scan, but they should generate warning audit events.

Security requires a registered guard device.

The API must create or update `access_sync_log`.

## 15.3 Complete Sync

Method: `POST`

Route: `/api/access/guard-devices/{guardDeviceId}/sync-complete`

Request:

```ts
type CompleteSyncRequest = {
  guardDeviceId: number;
  syncStartedAt: string;
  uploadEvents: number;
  downloadRecords: number;
  success: boolean;
  message?: string;
};
```

Response:

```ts
type CompleteSyncResponse = ApiResponse<AccessSyncLog>;
```

This API records the completion of a sync process.

Security requires a registered guard device.

The API writes to `access_sync_log`.

Failed syncs should create an `audit_event` with severity `WARNING`.

## 16. Event History and Reporting APIs

## 16.1 Get Access Events

Method: `GET`

Route: `/api/access/estates/{estateId}/events`

Request:

```ts
type GetAccessEventsRequest = PagingRequest & {
  estateId: number;
  gateId?: number;
  personId?: number;
  guestId?: number;
  vehicleId?: number;
  direction?: "ENTRY" | "EXIT";
  fromDate?: string;
  toDate?: string;
  offlineScan?: boolean;
};
```

Response:

```ts
type AccessEventDetail = AccessEvent & {
  gate: AccessGate;
  person?: CachedPerson;
  guest?: CachedGuest;
  vehicle?: CachedVehicle;
};

type GetAccessEventsResponse = ApiResponse<PagingResponse<AccessEventDetail>>;
```

This API returns historical entry and exit events.

Security requires access administrator permission, estate administrator permission or approved reporting permission.

No audit record is required for normal viewing.

## 16.2 Get Person Access History

Method: `GET`

Route: `/api/access/people/{personId}/history`

Request:

```ts
type GetPersonAccessHistoryRequest = PagingRequest & {
  personId: number;
  fromDate?: string;
  toDate?: string;
};
```

Response:

```ts
type GetPersonAccessHistoryResponse = ApiResponse<PagingResponse<AccessEventDetail>>;
```

This API returns access history for one person.

Security requires access administrator permission or estate administrator permission. A resident may view their own history only if estate settings allow it.

No audit record is required unless resident history viewing is considered sensitive by estate policy.

## 16.3 Get Vehicle Access History

Method: `GET`

Route: `/api/access/vehicles/{vehicleId}/history`

Request:

```ts
type GetVehicleAccessHistoryRequest = PagingRequest & {
  vehicleId: number;
  fromDate?: string;
  toDate?: string;
};
```

Response:

```ts
type GetVehicleAccessHistoryResponse = ApiResponse<PagingResponse<AccessEventDetail>>;
```

This API returns access history for one vehicle.

Security requires access administrator or estate administrator permission.

No audit record is required.

## 16.4 Get Gate Access History

Method: `GET`

Route: `/api/access/gates/{gateId}/history`

Request:

```ts
type GetGateAccessHistoryRequest = PagingRequest & {
  gateId: number;
  fromDate?: string;
  toDate?: string;
};
```

Response:

```ts
type GetGateAccessHistoryResponse = ApiResponse<PagingResponse<AccessEventDetail>>;
```

This API returns access event history for one gate.

Security requires access administrator, estate administrator or gate supervisor permission.

No audit record is required.

## 17. Settings APIs

## 17.1 Get Access Settings

Method: `GET`

Route: `/api/access/estates/{estateId}/settings`

Request:

```ts
type GetAccessSettingsRequest = {
  estateId: number;
};
```

Response:

```ts
type GetAccessSettingsResponse = ApiResponse<AccessSetting[]>;
```

This API returns access settings for the estate.

Settings may include unknown vehicle policy, offline scan policy, duplicate entry policy, device sync frequency, emergency list visibility and QR token expiry rules.

Security requires access administrator or estate administrator permission.

No audit record is required.

## 17.2 Update Access Setting

Method: `PUT`

Route: `/api/access/estates/{estateId}/settings/{settingKey}`

Request:

```ts
type UpdateAccessSettingRequest = {
  settingValue: string;
  reason?: string;
};
```

Response:

```ts
type UpdateAccessSettingResponse = ApiResponse<AccessSetting>;
```

This API creates or updates a single access setting.

Security requires access administrator or estate administrator permission.

The API must audit all setting changes because configuration affects gate behaviour.

## 18. Resident QR APIs

## 18.1 Get My QR Credentials

Method: `GET`

Route: `/api/access/resident/me/qr-codes`

Request:

```ts
type GetMyQrCredentialsRequest = {};
```

Response:

```ts
type GetMyQrCredentialsResponse = ApiResponse<QrCredentialDetail[]>;
```

This API returns QR credentials linked to the authenticated resident.

The service must resolve the authenticated Auth user to the estate person record and only return credentials belonging to that person.

Security requires resident authentication.

No audit record is required.

## 18.2 Get My Dynamic QR Token

Method: `POST`

Route: `/api/access/resident/me/qr-codes/{qrCodeId}/dynamic-token`

Request:

```ts
type GetMyDynamicQrTokenRequest = {
  qrCodeId: number;
};
```

Response:

```ts
type GetMyDynamicQrTokenResponse = ApiResponse<{
  qrPayload: string;
  expiresAt: string;
}>;
```

This API generates a short-lived dynamic QR token for the authenticated resident.

The API must confirm the QR credential belongs to the resident and is active.

No audit record is required for normal usage, but excessive generation may create a security audit event.

## 18.3 Get Guest QR Payload

Method: `GET`

Route: `/api/access/resident/me/guests/{guestId}/qr-code`

Request:

```ts
type GetGuestQrPayloadRequest = {
  guestId: number;
};
```

Response:

```ts
type GetGuestQrPayloadResponse = ApiResponse<{
  qrCode: AccessQrCode;
  qrPayload: string;
}>;
```

This API returns or creates a QR payload for a guest created by the resident.

The service must confirm the guest belongs to a unit linked to the authenticated resident and that the guest is active.

If no active QR credential exists for the guest, the API may create one.

Security requires resident authentication.

Credential creation must be audited. Returning an existing credential does not require auditing.

## 19. Audit APIs

## 19.1 Get Access Entity Audit

Method: `GET`

Route: `/api/access/audit/{entityName}/{recordId}`

Request:

```ts
type GetAccessEntityAuditRequest = {
  entityName: string;
  recordId: number;
};
```

Response:

```ts
type AuditFieldChange = {
  fieldName: string;
  oldValue?: string;
  newValue?: string;
};

type AuditChangeSummary = {
  id: number;
  entityName: string;
  recordId: number;
  action: string;
  changedByUserId?: number;
  changedAt: string;
  reason?: string;
  fields: AuditFieldChange[];
};

type GetAccessEntityAuditResponse = ApiResponse<AuditChangeSummary[]>;
```

This API returns audit history for an access control entity such as gate, guard device, QR credential or setting.

Security requires access administrator or estate administrator permission.

No audit record is required.

## 19.2 Get Access Audit Events

Method: `GET`

Route: `/api/access/estates/{estateId}/audit-events`

Request:

```ts
type GetAccessAuditEventsRequest = PagingRequest & {
  estateId: number;
  eventType?: string;
  severity?: string;
  fromDate?: string;
  toDate?: string;
};
```

Response:

```ts
type AuditEvent = {
  id: number;
  estateId?: number;
  userId?: number;
  eventType: string;
  entityName?: string;
  recordId?: number;
  severity: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
};

type GetAccessAuditEventsResponse = ApiResponse<PagingResponse<AuditEvent>>;
```

This API returns operational audit events related to access control, such as invalid scans, expired QR attempts, offline sync failures, emergency list views and suspicious device activity.

Security requires access administrator or estate administrator permission.

No audit record is required.

## 20. Validation Rules

A gate must belong to an estate.

A guard device must belong to a gate.

A guard device identifier must be unique among active devices.

A QR credential must belong to either a person or a guest.

A QR credential may not belong to both a person and a guest.

Owner, estate employee and unit employee QR codes require a person ID.

Guest QR codes require a guest ID.

A QR credential may not be used after `expiresAt`.

A revoked QR credential must not validate.

A QR payload must have a valid signature.

A QR payload must match the estate where it is scanned.

Entry and exit events must always record a gate, device, direction and occurrence time.

Occupants must be at least 1 for vehicle entry.

Unknown vehicles are allowed by default but must be flagged.

The currently-inside table must be updated after every successful entry or exit.

Offline events must be uploaded idempotently.

## 21. Security Rules

Administrative access requires estate administrator or access administrator permission.

Guard scan APIs require guard permission and a registered active guard device.

Resident QR APIs may only return credentials belonging to the authenticated resident or their guests.

Service-to-service calls require a trusted API key.

The API may never trust `estateId`, `personId`, `guestId`, `gateId` or `guardDeviceId` without confirming that the caller is allowed to use that record.

Invalid QR signatures, wrong-estate QR codes and revoked QR attempts must be treated as security-relevant events.

Emergency list access must be permission controlled and audited.

## 22. Auditing Rules

Gate creation, updates, activation and deactivation are audited.

Guard device registration, reassignment, activation and deactivation are audited.

QR credential issue, renewal and revocation are audited.

Access settings changes are audited.

Normal entry and exit scans are stored in `access_event` and do not need duplicate audit change records.

Invalid scans, suspicious scans, duplicate entries, unmatched exits and offline sync errors are written to `audit_event`.

Emergency list views are written to `audit_event`.

Offline sync completion is stored in `access_sync_log`. Failed syncs should also create `audit_event` records.

## 23. Offline Operation Rules

Guard devices must maintain a local cache of required estate and access data.

The local cache should include:

Estate.

Gates.

Access settings.

Active people.

Active guests.

Vehicles.

QR types.

Revoked credential identifiers.

Guard devices must be able to validate signed QR payloads offline.

When offline, the device records scans locally.

When online again, the device uploads offline events through the offline events API.

The server must accept valid offline events and mark them with `offlineScan = true`.

The server must handle conflicts and duplicate uploads safely.

If offline data is stale, the device should warn the guard but still allow operation according to estate policy.

## 24. Implementation Notes

The Access Control API should use a service layer rather than placing business logic directly inside route handlers.

Each route should follow this flow:

Authenticate the request.

Resolve tenant and estate context.

Validate device context where applicable.

Check permission.

Validate request data.

Load required estate or access records.

Apply access rules.

Perform database changes in a transaction.

Write audit records or operational events where required.

Return the saved record or compound response.

The API should return consistent error codes for invalid credentials, expired credentials, permission failures, unknown devices, duplicate sync events and validation errors.

The Access Control System should not directly modify estate master data. Any change to people, units, vehicles or guests must be made through the Estate Management System.
