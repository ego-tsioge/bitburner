/** @typedef {import("/types/NetscriptDefinitions").NS} NS */

/**
 * Bootstrapper für den n00dleHacker.
 * Lädt n00dleHacker.js und alle Abhängigkeiten aus GitHub und startet ihn.
 *
 * Verwendung im frischen Bitburner:
 *   1. Dieses Script manuell anlegen (oder per wget holen)
 *   2. run n00dle-init.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
	const user = 'ego-tsioge';
	const repo = 'bitburner';
	const branch = 'main';
	const baseUrl = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/bitburner-home/`;

	const files = [
		{ remote: 'n00dleHacker.js', local: 'n00dleHacker.js' },
		{ remote: 'src/lib.helper.js', local: 'src/lib.helper.js' },
		{ remote: 'src/lib.config.js', local: 'src/lib.config.js' },
		{ remote: 'src/mod.crawler.js', local: 'src/mod.crawler.js' },
		{ remote: 'src/bin.hack.js', local: 'src/bin.hack.js' },
		{ remote: 'src/bin.grow.js', local: 'src/bin.grow.js' },
		{ remote: 'src/bin.weaken.js', local: 'src/bin.weaken.js' },
	];

	ns.tprint('═══════════════════════════════════════');
	ns.tprint(' n00dleHacker Bootstrap');
	ns.tprint('═══════════════════════════════════════');

	let ok = 0;
	let fail = 0;
	for (const f of files) {
		const url = baseUrl + f.remote;
		const success = await ns.wget(url, f.local);
		if (success) {
			ns.tprint(`  ✓ ${f.local}`);
			ok++;
		} else {
			ns.tprint(`  ✗ ${f.local} – Download fehlgeschlagen`);
			fail++;
		}
	}

	ns.tprint(`\n${ok}/${files.length} Dateien geladen.`);

	if (fail > 0) {
		ns.tprint('✗ Nicht alle Dateien geladen – Abbruch.');
		return;
	}

	ns.tprint('\n✓ Starte n00dleHacker.js ...');
	ns.spawn('n00dleHacker.js');
}
