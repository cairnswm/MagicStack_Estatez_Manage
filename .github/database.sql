CREATE TABLE estate_estate (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    timezone VARCHAR(100) NOT NULL DEFAULT 'Africa/Johannesburg',
    address_line_1 VARCHAR(255),
    address_line_2 VARCHAR(255),
    suburb VARCHAR(100),
    city VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY idx_estate_code (code)
);

CREATE TABLE estate_unit (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    estate_id BIGINT UNSIGNED NOT NULL,
    unit_number VARCHAR(50) NOT NULL,
    display_name VARCHAR(100),
    street_address VARCHAR(255),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY idx_estate_id (estate_id),
    UNIQUE KEY idx_estate_unit (estate_id, unit_number)
);

CREATE TABLE estate_person (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    estate_id BIGINT UNSIGNED NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    preferred_name VARCHAR(100),
    email VARCHAR(255),
    mobile VARCHAR(30),
    id_number VARCHAR(50),
    passport_number VARCHAR(50),
    notes TEXT,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY idx_estate_id (estate_id),
    KEY idx_email (email),
    KEY idx_mobile (mobile)
);

CREATE TABLE estate_person_type (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    estate_id BIGINT UNSIGNED,
    code VARCHAR(50) NOT NULL,
    description VARCHAR(100) NOT NULL,
    system_type TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY idx_estate_id (estate_id),
    UNIQUE KEY idx_person_type (estate_id, code)
);

CREATE TABLE estate_unit_person (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    unit_id BIGINT UNSIGNED NOT NULL,
    person_id BIGINT UNSIGNED NOT NULL,
    person_type_id BIGINT UNSIGNED NOT NULL,
    start_date DATE,
    end_date DATE,
    primary_contact TINYINT(1) NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY idx_unit_id (unit_id),
    KEY idx_person_id (person_id),
    KEY idx_person_type_id (person_type_id)
);

CREATE TABLE estate_vehicle (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    estate_id BIGINT UNSIGNED NOT NULL,
    registration_number VARCHAR(20) NOT NULL,
    make VARCHAR(100),
    model VARCHAR(100),
    colour VARCHAR(50),
    description VARCHAR(255),
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY idx_estate_id (estate_id),
    UNIQUE KEY idx_registration (estate_id, registration_number)
);

CREATE TABLE estate_person_vehicle (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    person_id BIGINT UNSIGNED NOT NULL,
    vehicle_id BIGINT UNSIGNED NOT NULL,
    primary_vehicle TINYINT(1) NOT NULL DEFAULT 0,
    start_date DATE,
    end_date DATE,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY idx_person_id (person_id),
    KEY idx_vehicle_id (vehicle_id)
);

CREATE TABLE estate_guest (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    estate_id BIGINT UNSIGNED NOT NULL,
    unit_id BIGINT UNSIGNED NOT NULL,
    host_person_id BIGINT UNSIGNED NOT NULL,
    guest_name VARCHAR(200) NOT NULL,
    mobile VARCHAR(30),
    email VARCHAR(255),
    valid_from DATETIME NOT NULL,
    valid_to DATETIME NOT NULL,
    notes TEXT,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY idx_estate_id (estate_id),
    KEY idx_unit_id (unit_id),
    KEY idx_host_person_id (host_person_id)
);

CREATE TABLE estate_setting (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    estate_id BIGINT UNSIGNED NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY idx_estate_id (estate_id),
    UNIQUE KEY idx_estate_setting (estate_id, setting_key)
);

CREATE TABLE audit_change (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id BIGINT UNSIGNED NOT NULL,
    action VARCHAR(20) NOT NULL,
    changed_by_user_id BIGINT UNSIGNED,
    change_reason VARCHAR(255),
    old_data JSON,
    new_data JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY idx_table_record (table_name, record_id),
    KEY idx_changed_by_user_id (changed_by_user_id)
);

CREATE TABLE audit_entity (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    entity_name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY idx_entity_name (entity_name)
);

CREATE TABLE audit_change (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    entity_id BIGINT UNSIGNED NOT NULL,
    record_id BIGINT UNSIGNED NOT NULL,
    action VARCHAR(20) NOT NULL,
    changed_by_user_id BIGINT UNSIGNED,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(255),

    KEY idx_entity_id (entity_id),
    KEY idx_record_id (record_id),
    KEY idx_changed_by_user_id (changed_by_user_id),
    KEY idx_changed_at (changed_at)
);

CREATE TABLE audit_change_field (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    change_id BIGINT UNSIGNED NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,

    KEY idx_change_id (change_id)
);

CREATE TABLE audit_event (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    estate_id BIGINT UNSIGNED,
    user_id BIGINT UNSIGNED,
    event_type VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100),
    record_id BIGINT UNSIGNED,
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
    description TEXT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY idx_estate_id (estate_id),
    KEY idx_user_id (user_id),
    KEY idx_event_type (event_type),
    KEY idx_record_id (record_id),
    KEY idx_created_at (created_at)
);
