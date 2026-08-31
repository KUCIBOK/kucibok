-- Migration 019: Fix artworks with NULL status
-- Ensure all artworks have a valid status (pending, approved, rejected, archived)

-- 1️⃣ Set NULL statuses to 'pending' (default safe status)
UPDATE artworks
SET status = 'pending'
WHERE status IS NULL;

-- 2️⃣ Add a CHECK constraint to prevent NULL status in the future
ALTER TABLE artworks
ADD CONSTRAINT artworks_status_not_null CHECK (status IS NOT NULL);

-- 3️⃣ Add a CHECK constraint to ensure valid status values
ALTER TABLE artworks
ADD CONSTRAINT artworks_status_valid CHECK (status IN ('pending', 'approved', 'rejected', 'archived'));
