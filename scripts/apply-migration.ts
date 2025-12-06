#!/usr/bin/env node
import execa from 'execa';
import path from 'path';

const dbName = 'proto-remote-migration';

const filePath = process.argv[2];
if (!filePath) {
	console.error('Usage: pnpm db:migration:apply:workaround <path-to-sql>');
	process.exit(1);
}

const resolvedFile = path.resolve(filePath);
const migrationName = path.basename(resolvedFile);

// Apply migration file
try {
	execa.sync('wrangler', ['d1', 'execute', dbName, "--remote", '--file', resolvedFile], {
		stdio: 'inherit',
		preferLocal: true,
	});
} catch (err: any) {
	console.error('[apply] failed', err?.shortMessage || err?.message || err);
	process.exit(err?.exitCode ?? 1);
}

// Record migration history
const escapedName = migrationName.replace(/'/g, "''");
const historySql =
	'CREATE TABLE IF NOT EXISTS d1_migrations (' +
	'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
	'name TEXT NOT NULL, ' +
	"applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))" +
	'); ' +
	`INSERT INTO d1_migrations (name, applied_at) VALUES ('${escapedName}', strftime('%Y-%m-%d %H:%M:%S','now'));`;

try {
	execa.sync('wrangler', ['d1', 'execute', dbName, "--remote", '--command', historySql], {
		stdio: 'inherit',
		preferLocal: true,
	});
} catch (err: any) {
	console.error('[history] failed', err?.shortMessage || err?.message || err);
	process.exit(err?.exitCode ?? 1);
}

console.log(`Applied ${migrationName} and recorded in d1_migrations.`);
