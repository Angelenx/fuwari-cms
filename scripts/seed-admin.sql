-- Local demo admin only. Never apply remotely.
-- username: admin
-- password: local-dev-only
INSERT OR IGNORE INTO users (username, password_hash) VALUES (
	'admin',
	'pbkdf2$sha256$100000$8rbgnCaXYTl_-p3AF-H-Dw$FICnPquEMuviyRM6giLft37v_El1CLlFO_O6hvMIm2Q'
);
