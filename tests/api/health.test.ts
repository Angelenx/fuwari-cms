import { describe, expect, it } from "vitest";
import { api } from "../../src/api/app";

describe("GET /api/health", () => {
	it("returns ok", async () => {
		const res = await api.request("/health");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});

	it("answers unknown /api routes with JSON 404", async () => {
		const res = await api.request("/nope");
		expect(res.status).toBe(404);
		expect(res.headers.get("content-type")).toContain("application/json");
	});
});
