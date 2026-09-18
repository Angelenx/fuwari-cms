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
		},
	);
});
