import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/lib/auth/password";

describe("PBKDF2 password hashes", () => {
	it(
		"verifies the matching password and rejects others",
		{ timeout: 30_000 },
		async () => {
			const a = await hashPassword("correct horse");
			const b = await hashPassword("correct horse");
			expect(a).not.toBe(b);
			expect(a.startsWith("pbkdf2$sha256$100000$")).toBe(true);

			expect(await verifyPassword("correct horse", a)).toBe(true);
			expect(await verifyPassword("wrong", a)).toBe(false);
			expect(await verifyPassword("correct horse", undefined)).toBe(false);

			// Lock scripts/seed-admin.sql to this hasher so local `pnpm db:seed:admin` stays loginable.
			const seedHash =
				"pbkdf2$sha256$100000$8rbgnCaXYTl_-p3AF-H-Dw$FICnPquEMuviyRM6giLft37v_El1CLlFO_O6hvMIm2Q";
			expect(await verifyPassword("local-dev-only", seedHash)).toBe(true);
		},
	);
});
