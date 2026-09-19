-- Admin-only: render Markdown in the browser instead of the Worker.
-- NULL / missing means off (Worker write-time render).

ALTER TABLE site_settings ADD COLUMN client_markdown INTEGER;
