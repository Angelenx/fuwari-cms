-- Identity + about on the same singleton. Blank values still overlay src/config.ts.

ALTER TABLE site_settings ADD COLUMN title TEXT;
ALTER TABLE site_settings ADD COLUMN subtitle TEXT;
ALTER TABLE site_settings ADD COLUMN footer TEXT;
ALTER TABLE site_settings ADD COLUMN about_md TEXT;
ALTER TABLE site_settings ADD COLUMN about_html TEXT;
