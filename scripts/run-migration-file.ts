import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import execa from 'execa';

export type Mode = 'local' | 'remote';

const HISTORY_TABLE_SQL =
	'CREATE TABLE IF NOT EXISTS d1_migrations (' +
	'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
	'name TEXT NOT NULL, ' +
	"applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))" +
	');';

function getLocalSqliteFile(): string {
	const localDbDir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
	if (!existsSync(localDbDir)) {
		throw new Error(`Local D1 state not found at ${localDbDir}. Run wrangler dev once and retry.`);
	}

	const sqliteFiles = readdirSync(localDbDir).filter((file) => file.endsWith('.sqlite'));
	if (sqliteFiles.length === 0) {
		throw new Error(`No .sqlite files found under ${localDbDir}.`);
	}

	return path.join(localDbDir, sqliteFiles[0]);
}

export function fetchAppliedMigrations(mode: Mode, dbName: string): string[] {
	const historyQuery = `${HISTORY_TABLE_SQL} SELECT name FROM d1_migrations ORDER BY id;`;

	if (mode === 'remote') {
		const res = execa.sync('wrangler', ['d1', 'execute', dbName, '--remote', '--command', historyQuery, '--json'], {
			preferLocal: true,
		});

		const rows = JSON.parse(res.stdout || '[]');
		if (!Array.isArray(rows)) return [];
		return rows.map((row: any) => row?.name).filter((name: any): name is string => typeof name === 'string');
	}

	// Local path
	const sqliteFile = getLocalSqliteFile();

	// Ensure history table exists before selecting
	execa.sync('sqlite3', [sqliteFile, HISTORY_TABLE_SQL], {
		stdio: 'inherit',
	});

	const res = execa.sync('sqlite3', ['-json', sqliteFile, 'SELECT name FROM d1_migrations ORDER BY id;'], {
		stdio: 'pipe',
	});

	const rows = JSON.parse(res.stdout || '[]');
	if (!Array.isArray(rows)) return [];
	return rows.map((row: any) => row?.name).filter((name: any): name is string => typeof name === 'string');
}

export function applyMigrationFile(mode: Mode, filePath: string, dbName: string) {
	const migrationName = path.basename(filePath);
	const escapedName = migrationName.replace(/'/g, "''");
	const historyInsertSql = `${HISTORY_TABLE_SQL} INSERT INTO d1_migrations (name, applied_at) VALUES ('${escapedName}', strftime('%Y-%m-%d %H:%M:%S','now'));`;

	if (mode === 'remote') {
		// Apply migration file to remote D1
		execa.sync('wrangler', ['d1', 'execute', dbName, '--remote', '--file', filePath], {
			stdio: 'inherit',
			preferLocal: true,
		});

		// Record migration history remotely
		execa.sync('wrangler', ['d1', 'execute', dbName, '--remote', '--command', historyInsertSql], {
			stdio: 'inherit',
			preferLocal: true,
		});
		return;
	}

	const sqliteFile = getLocalSqliteFile();

	const dotReadArg = `.read ${filePath}`;

	execa.sync('sqlite3', [sqliteFile, dotReadArg], {
		stdio: 'inherit',
	});

	execa.sync('sqlite3', [sqliteFile, historyInsertSql], {
		stdio: 'inherit',
	});
}
