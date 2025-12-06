#!/usr/bin/env node


const url = 'http://localhost:5173/snapshot';

(async () => {
	try {
		const res = await fetch(url);
		if (!res.ok) {
			throw new Error(`HTTP ${res.status} ${res.statusText}`);
		}
		const text = await res.text();
		console.log(text);
	} catch (err) {
		console.error('Snapshot fetch failed:', err.message || err);
		process.exit(1);
	}
})();

