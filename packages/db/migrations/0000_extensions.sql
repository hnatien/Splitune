-- citext backs users.email; it is a trusted extension, so the database owner can create it.
CREATE EXTENSION IF NOT EXISTS citext;
