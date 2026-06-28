# Estate Management System User Specification

## Overview

The Estate Management System is the master data system for managing residential estates. It maintains all information relating to estates, units, residents, employees and vehicles, providing a single source of truth for all estate-related information. The system is designed as a standalone SaaS platform that integrates with other services, including the Access Control System, rather than managing physical access itself.

The system is responsible for storing and maintaining information while exposing secure APIs that allow other systems to consume the data they require. It does not record gate entries, exits or occupancy within the estate.

## Estates

The system supports multiple estates within a single installation. Each estate contains its own units, people, vehicles and employees while remaining logically isolated from every other estate.

Each estate stores its name, contact information, operational settings and any configuration required by integrated systems. The estate also defines the access policies that external systems should enforce, such as whether unknown vehicles are permitted or whether guests require approval.

## Units

Each estate contains one or more units. A unit represents a residential property within the estate and acts as the central point for assigning owners, residents, tenants, employees and vehicles.

Units store identifying information such as unit number, address, status and any additional metadata required by the estate.

A unit may have multiple associated people and multiple associated vehicles.

## People

The system stores a single person record regardless of the person's relationship to the estate.

A person may represent an owner, tenant, resident, estate employee, unit employee or any future role that may be introduced.

The person's relationship to the estate is determined through associations rather than separate tables, allowing a single individual to fulfil multiple roles simultaneously.

Each person stores personal details, contact information, status and any information required for communication and estate administration.

## Unit Relationships

People may be associated with one or more units.

Each relationship defines the person's role within that unit, such as owner, tenant or resident.

The system allows multiple owners for a unit, multiple residents living within a unit and historical tracking of previous relationships where required.

## Estate Employees

Estate employees are managed independently from residential units.

These include security personnel, maintenance staff, office staff, gardeners and any other individuals employed directly by the estate.

Employment details, employment status and contact information are maintained within the system.

## Unit Employees

Unit employees represent people employed by individual residents.

Examples include domestic workers, gardeners, pool services, child carers and contractors who regularly require access to one or more units.

A unit employee may be assigned to multiple units simultaneously.

The system records which units each employee is authorised to access.

## Vehicles

Vehicles are registered against people rather than units, allowing a person to own multiple vehicles while also supporting shared vehicles between residents if required.

Vehicle information includes registration number, description, status and any additional information required by integrated systems.

Owners may manage their own registered vehicles through the resident portal.

## Guest Management

Residents may create temporary guests within the Estate Management System.

Each guest belongs to a unit and has a configurable validity period.

The Estate Management System is responsible for creating, updating and cancelling guests while the Access Control System is responsible for issuing credentials and recording access events.

## Resident Portal

Residents are able to maintain their own information within the permissions granted by the estate.

Residents can update contact details, manage vehicles, manage unit employees and create temporary guests.

Administrative approval requirements remain configurable by each estate.

## Administration

Estate administrators manage all master data within the system.

They create estates, manage units, assign owners, maintain employee records, resolve data issues and configure estate policies.

The system provides complete audit logging for all administrative changes.

## Integration

The Estate Management System acts as the authoritative source of information for all integrated services.

Whenever people, vehicles, guests or units change, those changes are made available through secure APIs or event notifications.

External systems should treat the Estate Management System as the owner of all estate data and should not maintain independent copies beyond the local caching required for offline operation.
