-- ==========================================
-- ReWear Database Schema (PostgreSQL 15+)
-- Designed for High Scalability, Security, and 3NF Normalization
-- ==========================================

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Clean Up Old Schema (For Clean Installs)
DROP TABLE IF EXISTS admin_logs CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS exchange_requests CASCADE;
DROP TABLE IF EXISTS purchase_requests CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS wishlists CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS seller_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- Drop Custom Types if they exist
DROP TYPE IF EXISTS transaction_type_enum CASCADE;
DROP TYPE IF EXISTS product_status_enum CASCADE;
DROP TYPE IF EXISTS request_status_enum CASCADE;
DROP TYPE IF EXISTS report_target_enum CASCADE;
DROP TYPE IF EXISTS report_status_enum CASCADE;

-- ==========================================
-- Custom ENUM Types
-- ==========================================
CREATE TYPE transaction_type_enum AS ENUM ('BUY', 'SELL', 'EXCHANGE');
CREATE TYPE product_status_enum AS ENUM ('AVAILABLE', 'PENDING', 'SOLD', 'ARCHIVED');
CREATE TYPE request_status_enum AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED');
CREATE TYPE report_target_enum AS ENUM ('USER', 'PRODUCT', 'MESSAGE');
CREATE TYPE report_status_enum AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- ==========================================
-- 1. Roles Table (RBAC System)
-- ==========================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Roles
INSERT INTO roles (name, description) VALUES 
('ROLE_USER', 'Standard marketplace buyer and seller'),
('ROLE_MODERATOR', 'System moderator responsible for reports'),
('ROLE_ADMIN', 'Super administrator with full capabilities');

-- ==========================================
-- 2. Users Table
-- ==========================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 3. Seller Profiles Table (Separated for 3NF & Sparse Data)
-- ==========================================
CREATE TABLE seller_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    avatar_url VARCHAR(512),
    phone_number VARCHAR(20),
    preferred_meeting_info TEXT,
    average_rating NUMERIC(3, 2) DEFAULT 5.00 CHECK (average_rating >= 0.00 AND average_rating <= 5.00),
    total_reviews INT DEFAULT 0 CHECK (total_reviews >= 0),
    is_verified BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 4. User Sessions Table (Stateful Tokens & Session Logs)
-- ==========================================
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(512) UNIQUE NOT NULL,
    jti VARCHAR(255) UNIQUE NOT NULL, -- JWT Unique Identifier for revocation check
    client_ip VARCHAR(45), -- Supports IPv4 and IPv6
    user_agent VARCHAR(512),
    is_revoked BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 5. Categories Table
-- ==========================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    parent_category_id UUID REFERENCES categories(id) ON DELETE SET NULL, -- Self-referencing subcategories
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 6. Products Table
-- ==========================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0.00),
    condition VARCHAR(50) NOT NULL, -- e.g., "New", "Gently Used", "Heavily Worn"
    transaction_type transaction_type_enum DEFAULT 'SELL',
    status product_status_enum DEFAULT 'AVAILABLE',
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom GEOMETRY(Point, 4326) NOT NULL, -- PostGIS Coordinate Point
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 7. Product Images Table
-- ==========================================
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url VARCHAR(512) NOT NULL,
    public_id VARCHAR(255) NOT NULL, -- Cloudinary identifier
    sort_order INT DEFAULT 0 CHECK (sort_order >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 8. Wishlists Table (Many-to-Many Bridge)
-- ==========================================
CREATE TABLE wishlists (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, product_id)
);

-- ==========================================
-- 9. Conversations Table
-- ==========================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_buyer_seller_product UNIQUE (product_id, buyer_id, seller_id),
    CONSTRAINT buyer_seller_diff CHECK (buyer_id <> seller_id)
);

-- ==========================================
-- 10. Messages Table
-- ==========================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sender_recipient_diff CHECK (sender_id <> recipient_id)
);

-- ==========================================
-- 11. Purchase Requests Table (Buy Offers)
-- ==========================================
CREATE TABLE purchase_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    proposed_price NUMERIC(10, 2) NOT NULL CHECK (proposed_price >= 0.00),
    status request_status_enum DEFAULT 'PENDING',
    additional_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 12. Exchange Requests Table (Swap Offers)
-- ==========================================
CREATE TABLE exchange_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    offered_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status request_status_enum DEFAULT 'PENDING',
    additional_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT offered_target_diff CHECK (target_product_id <> offered_product_id)
);

-- ==========================================
-- 13. Reviews Table
-- ==========================================
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT reviewer_reviewee_diff CHECK (reviewer_id <> reviewee_id)
);

-- ==========================================
-- 14. Notifications Table
-- ==========================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- e.g., 'CHAT_MESSAGE', 'PURCHASE_REQUEST', 'EXCHANGE_REQUEST', 'REVIEW_RECEIVED'
    reference_id UUID,          -- Polymorphic ID referencing the target item (e.g. conversation_id, request_id)
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 15. Reports Table (Content Moderation)
-- ==========================================
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type report_target_enum NOT NULL,
    target_id UUID NOT NULL, -- Points to User, Product, or Message depending on target_type
    reason VARCHAR(100) NOT NULL, -- e.g., "SPAM", "PROHIBITED_ITEMS", "HARASSMENT"
    description TEXT,
    status report_status_enum DEFAULT 'PENDING',
    moderator_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 16. Admin Logs Table
-- ==========================================
CREATE TABLE admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL, -- e.g., "BAN_USER", "DELETE_PRODUCT", "RESOLVE_REPORT"
    target_type VARCHAR(50),
    target_id UUID,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Performance Indexes Configuration
-- ==========================================

-- PostGIS Spatial Index for Proximity Queries
CREATE INDEX idx_products_geom ON products USING GIST(geom);

-- Foreign Key Lookups Optimization
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_seller_profiles_rating ON seller_profiles(average_rating DESC);
CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_jti ON user_sessions(jti);
CREATE INDEX idx_products_seller ON products(seller_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_product_images_product ON product_images(product_id);
CREATE INDEX idx_wishlists_product ON wishlists(product_id);
CREATE INDEX idx_conversations_participants ON conversations(buyer_id, seller_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_purchase_requests_product ON purchase_requests(product_id);
CREATE INDEX idx_purchase_requests_buyer ON purchase_requests(buyer_id);
CREATE INDEX idx_exchange_requests_target ON exchange_requests(target_product_id);
CREATE INDEX idx_exchange_requests_buyer ON exchange_requests(buyer_id);
CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_reports_status ON reports(status);

-- ==========================================
-- Automatic Update Timestamps Triggers
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_modtime BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_seller_profiles_modtime BEFORE UPDATE ON seller_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_modtime BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_modtime BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_requests_modtime BEFORE UPDATE ON purchase_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_exchange_requests_modtime BEFORE UPDATE ON exchange_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_modtime BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
