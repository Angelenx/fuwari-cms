import { describe, expect, it } from "vitest";
import { parseSqliteDate, sqliteDateToIso } from "../../src/utils/date-utils";

describe("sqlite date parsing", () => {
	it("parses ISO and space-separated UTC timestamps", () => {
		expect(parseSqliteDate("2020-06-01T08:00:00.000Z").toISOString()).toBe(
			"2020-06-01T08:00:00.000Z",
		);
		expect(parseSqliteDate("2020-06-01 08:00:00").toISOString()).toBe(
			"2020-06-01T08:00:00.000Z",
		);
		expect(sqliteDateToIso("2020-06-01 08:00:00")).toBe(
			"2020-06-01T08:00:00.000Z",
		);
		expect(sqliteDateToIso(null)).toBeNull();
	});
});
