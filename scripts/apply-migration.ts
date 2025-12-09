#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { applyMigrationFile, fetchAppliedMigrations, type Mode } from '../scripts/run-migration-file.ts';

// hardcoded, change to whatever you have your migrations in
const migrationsDir = './prisma/migrations';

const { values, positionals } = parseArgs({
	options: {
		local: { type: 'boolean', default: false },
		remote: { type: 'boolean', default: false },
		help: { type: 'boolean', default: false },
	},
	allowPositionals: true,
});

const usage = () => {
	console.error('Usage: pnpm db:migration:apply:workaround [--remote|--local] <db-name>');
	console.error('Defaults: mode is --local; db-name is required as a positional argument.');
};

async function confirmPending(mode: Mode, names: string[]): Promise<boolean> {
	console.log('\nPending migrations to apply:');
	names.forEach((n) => console.log(`  - ${n}`));

	if (mode === 'local') {
		console.log('');
		console.log('⚠️  LOCAL MODE WARNING');
		console.log('   - Stop wrangler/miniflare');
		console.log('   - Back up .wrangler/state/v3/d1/');
		console.log('');
	}

	const rl = createInterface({ input, output });
	const answer = (await rl.question('Proceed with applying these migrations? [Y/n]: ')).trim().toLowerCase();
	rl.close();

	if (answer === 'n' || answer === 'no') {
		return false;
	}

	// Default to yes on empty or any affirmative token.
	return answer === '' || answer === 'y' || answer === 'yes';
}

if (values.help) {
	usage();
	process.exit(0);
}

let mode: Mode = 'local';
if (values.remote && values.local) {
	console.error('Choose either --local or --remote, not both.');
	usage();
	process.exit(1);
}
if (values.remote) {
	mode = 'remote';
} else if (values.local) {
	mode = 'local';
}

const dbName = positionals[0];

if (!dbName) {
	console.error('No database name provided.');
	usage();
	process.exit(1);
}

let migrationFiles: string[] = [];
try {
	migrationFiles = readdirSync(migrationsDir)
		.filter((entry) => entry.endsWith('.sql'))
		.map((entry) => path.join(migrationsDir, entry))
		.filter((fullPath) => statSync(fullPath).isFile())
		.sort();
} catch (err: any) {
	console.error(`Failed to read migration directory at ${migrationsDir}:`, err?.message || err);
	process.exit(1);
}

if (migrationFiles.length === 0) {
	console.log(`No .sql migration files found under ${migrationsDir}. Nothing to apply.`);
	process.exit(0);
}

let appliedNames: string[] = [];
try {
	appliedNames = fetchAppliedMigrations(mode, dbName);
} catch (err: any) {
	console.error('Failed to fetch migration history:', err?.message || err);
	process.exit(1);
}

const pendingFiles = migrationFiles.filter((file) => !appliedNames.includes(path.basename(file)));

if (pendingFiles.length === 0) {
	console.log('All migrations are already applied. Nothing to do.');
	process.exit(0);
}

const pendingNames = pendingFiles.map((file) => path.basename(file));
const confirmed = await confirmPending(mode, pendingNames);
if (!confirmed) {
	console.log('Aborted. No migrations applied.');
	process.exit(0);
}

console.log(`Applying ${pendingNames.length} pending migration(s) in ${mode} mode...`);

for (let i = 0; i < pendingFiles.length; i += 1) {
	const file = pendingFiles[i];
	const name = pendingNames[i];
	console.log(`\n[apply] ${name}`);
	try {
		applyMigrationFile(mode, file, dbName);
		console.log(`[done] ${name}`);
	} catch (err: any) {
		console.error(`[failed] ${name}:`, err?.shortMessage || err?.message || err);
		process.exit(err?.exitCode ?? 1);
	}
}

console.log('Finished applying pending migrations.');
