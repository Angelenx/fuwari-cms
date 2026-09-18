-- Default UI language for visitors without a locale cookie.

ALTER TABLE site_settings ADD COLUMN lang TEXT;
