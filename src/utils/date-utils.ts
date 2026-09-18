export function formatDateToYYYYMMDD(date: Date): string {
	return date.toISOString().substring(0, 10);
}

/** SQLite `datetime('now')` is UTC without an offset; ISO strings parse as-is. */
export function parseSqliteDate(value: string): Date {
	if (value.includes("T") || /(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
		return new Date(value);
	}
	return new Date(`${value.replace(" ", "T")}Z`);
}

/** Normalize a D1 timestamp so the admin datetime-local picker can parse it. */
export function sqliteDateToIso(
	value: string | null | undefined,
): string | null {
	if (!value) {
		return null;
	}
	const parsed = parseSqliteDate(value);
	if (Number.isNaN(parsed.getTime())) {
		return null;
	}
	return parsed.toISOString();
}
