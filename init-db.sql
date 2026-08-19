-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- 1. Users Table (Email, Phone, Password, Profile Info, Real PIN, Fake PIN)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_code VARCHAR(10) UNIQUE, -- e.g. RAK-8492 (generated during profile setup)
    email VARCHAR(100) UNIQUE NOT NULL,
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) DEFAULT '',
    age INT DEFAULT 0,
    address TEXT DEFAULT '',
    pin_hash VARCHAR(100) DEFAULT '1234',
    fake_pin_hash VARCHAR(100) DEFAULT '9999',
    profile_completed BOOLEAN DEFAULT FALSE,
    kyc_status VARCHAR(20) DEFAULT 'VERIFIED',
    battery_level INT DEFAULT 100,
    is_tracking_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Trustee Connections (Request & Pairing System)
CREATE TABLE IF NOT EXISTS trustee_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'ACCEPTED', -- PENDING, ACCEPTED, REJECTED
    is_sharing_enabled BOOLEAN DEFAULT TRUE, -- Session toggle for live GPS
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_connection UNIQUE (requester_id, receiver_id)
);

-- 3. Location History Table (Hypertable for TimescaleDB)
CREATE TABLE IF NOT EXISTS location_history (
    time TIMESTAMPTZ NOT NULL,
    user_id UUID NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy_meters FLOAT DEFAULT 5.0,
    battery_level INT DEFAULT 100,
    speed_mps FLOAT DEFAULT 0.0,
    is_sos BOOLEAN DEFAULT FALSE
);

-- Convert to TimescaleDB Hypertable
SELECT create_hypertable('location_history', 'time', if_not_exists => TRUE);

-- Create Spatial & Time Indexes
CREATE INDEX IF NOT EXISTS idx_location_history_coords ON location_history (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_location_history_user_time ON location_history (user_id, time DESC);

-- 4. SOS Emergency Events Table
CREATE TABLE IF NOT EXISTS sos_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    trigger_type VARCHAR(30) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    initial_latitude DOUBLE PRECISION NOT NULL,
    initial_longitude DOUBLE PRECISION NOT NULL,
    battery_level INT,
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

-- SEED DATA
INSERT INTO users (id, user_code, email, phone_number, password_hash, full_name, age, address, pin_hash, fake_pin_hash, profile_completed, kyc_status)
VALUES 
('a0000000-0000-0000-0000-000000000001', 'RAK-1001', 'priya@womensafety.in', '+919876543210', 'Password@123', 'Priya Sharma', 23, 'Bandra West, Mumbai', '1234', '9999', TRUE, 'VERIFIED'),
('a0000000-0000-0000-0000-000000000002', 'RAK-1002', 'rahul@womensafety.in', '+919876543212', 'Password@123', 'Rahul Sharma (Brother)', 26, 'Andheri East, Mumbai', '1234', '9999', TRUE, 'VERIFIED'),
('a0000000-0000-0000-0000-000000000003', 'RAK-1003', 'sunita@womensafety.in', '+919876543211', 'Password@123', 'Sunita Sharma (Mother)', 52, 'Bandra West, Mumbai', '1234', '9999', TRUE, 'VERIFIED')
ON CONFLICT (phone_number) DO NOTHING;

-- Seed Connections
INSERT INTO trustee_connections (id, requester_id, receiver_id, status, is_sharing_enabled)
VALUES 
('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'ACCEPTED', TRUE),
('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'ACCEPTED', FALSE)
ON CONFLICT (requester_id, receiver_id) DO NOTHING;
