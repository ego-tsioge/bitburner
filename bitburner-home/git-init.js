/** @typedef {import("/types/NetscriptDefinitions").NS} NS */
/* *****************************************************************************
 * @fileoverview Script zur Initialisierung in Bitburner aus GitHub Repo
 * Die funktionen sind nur auf fehlbedienung im script selbst ausgelegt und
 * sollten nicht ohne weiteres für andere scripts verwendet werden.
 *
 * Langfristig soll git-init.js komplett eigenständig arbeiten.
 * Dafür sollten am ende auch alle kommentare und ausgaben englisch sein.
 *
 */
// Globale Konfigurationen
const GITHUB_USER = 'ego-tsioge';
const GITHUB_REPO = 'bitburner';
// Filter für die Dateien die heruntergeladen werden sollen
const FILTER = {
	//baseDir: 'bitburner-home/', // Optional: Nur Dateien aus diesem Verzeichnis
	//extension: ['.js'], // Optional: Nur Dateien mit diesen Endungen
};

// ANSI Escape Codes
const emphasize = '\u001b[1;4m';
const reset = '\u001b[0m';

// Patterns für Bereinigungsfunktion removeTypeDefinitions
const REMOVE_PATTERNS = [
	/^$/,                // Leere Zeilen
	/^\/\/\//,           // Zeilen die mit /// beginnen
	/@typedef/,          // Zeilen die @typedef enthalten (globale Typdefinitionen)
];

// Aliase die Angelegt werden sollen
const ALIASES = {
	cls: 'clear',
	update: 'run git-init.js', // Update aus Default-Branch
	cleanup: 'run git-init.js --cleanup', // Cleanup und Update
	killAll: 'run basis.js --ram-override 2.3 --killall', // Kill all scripts
};

/**
 * Lädt alle .js Dateien aus dem bitburner-home Verzeichnis des Repos
 * und setzt Test-Aliase
 *
 * Optionen (via --flag):
 *   --cleanup: alle Dateien vor Update löschen
 *   --branch <name>: Spezifischer Branch (sonst Default-Branch)
 *   --keepTypes: Type-Definitionen nicht entfernen
 *
 * @param {NS} ns Netscript API

 */
export async function main(ns) {
	ns.disableLog('ALL');
	terminal('clear');

	ns.tprint(`${emphasize}starte Script zur Initialisierung aus GitHub${reset}`);

	// prüfe GitHub Konstanten
	const userExists = await checkGitHubUser(ns, GITHUB_USER);
	if (userExists === false) {
		ns.tprintRaw(`${GITHUB_USER} bei GitHub nicht gefunden ... abbruch`);
		return;
	}
	const repoExists = await getGitHubRepoInfo(ns, GITHUB_USER, GITHUB_REPO);
	if (repoExists === false) {
		ns.tprintRaw(`${GITHUB_REPO} bei GitHub nicht gefunden ... abbruch`);
		return;
	}

	try {
		// eventuelle Parameter auswerten
		const options = ns.flags([
			['cleanup', false],
			['branch', ''],
			['keepTypes', false], // bei FALSE wird removeTypeDefinitions auf den download angewendet
		]);

		// Cleanup wenn gewünscht
		// D.h.: alle Dateien außer dem aktuellen Script (und ein paar Ausnahmen) löschen
		if (options.cleanup === true) {
			ns.tprintRaw('\nCleanup aktiviert - lösche alle Dateien ... siehe log');

			// Stoppe alle Skripte
			ns.killall('home', true);

			const currentScript = ns.getScriptName();
			// Liste aller Dateien
			const files = ns.ls('home');
			// Filtere Ausnahmen
			const filteredFiles = files
				.filter(f => !f.endsWith(currentScript))  // Eigenes Script nicht überschreiben
				.filter(f => !f.endsWith('repo.json'))    // repo.json wird noch gebraucht
				.filter(f => !f.endsWith('.exe'))        // Keine .exe Dateien
				.filter(f => !f.endsWith('.lit'))        // Keine .lit Dateien
				.filter(f => !f.endsWith('.msg'))        // Keine .msg Dateien
			// löschen
			for (const file of filteredFiles) {
				ns.rm(file);
				if (ns.fileExists(file)) {
					ns.print(`⚠ Konnte ${file} nicht löschen (wahrscheinlich geschützt)`);
				} else {
					ns.print(`✓ Gelöscht: ${file}`);
				}
			}
		}

		ns.tprintRaw('\nLade Dateien aus GitHub...');
		// Branch bestimmen
		const branch = String(options.branch); // Type-Narrowing für branch.length
		let targetBranch;
		if (branch.length > 0) {
			targetBranch = branch;
		} else {
			const repoInfo = JSON.parse(ns.read('repo.json'));
			if (repoInfo.default_branch === undefined || repoInfo.default_branch === null || repoInfo.default_branch.length === 0) {
				throw new Error('repo.json enthält kein gültiges default_branch Feld');
			}
			targetBranch = repoInfo.default_branch;
			ns.tprintRaw(`Nutze Default-Branch: ${targetBranch}`);
		}

		// Dateien herunterladen; `options.keepTypes === true` für Type-Narrowing
		await downloadFiles(ns, GITHUB_USER, GITHUB_REPO, targetBranch, FILTER, options.keepTypes === true);

		// Prüfe und entferne n00dles script (das aus dem Tutorial)
		if (ns.fileExists('n00dles.js')) {
			ns.killall('home', true); // Stoppe alle Skripte
			ns.rm('n00dles.js');
			ns.tprintRaw('✓ alles gestoppt und n00dles.js gelöscht');
		}

		// Setze Aliase
		ns.tprintRaw('\nSetze Aliase...');
		try {
			for (const [alias, command] of Object.entries(ALIASES)) {
				terminal(`alias ${alias}="${command}"`);
			}
			ns.tprintRaw('✓ Aliase gesetzt');
		} catch (error) {
			ns.tprintRaw('✗ Fehler beim Setzen eines Aliases');
		}

	} catch (error) {
		const stackLine = error.stack?.split('\n')[1]?.trim();
		const location = (stackLine !== undefined && stackLine.length > 0) ? stackLine : 'unbekannt';
		ns.tprintRaw(`✗ Fehler in ${location}: ${error}`);
	} finally {
		// etwas aufräumen
		if (ns.fileExists('repo.json')) {
			ns.rm('repo.json');
		}

		// abschluß nachricht
		ns.tprintRaw('\nInitialisierung abgeschlossen!');

	}
}

/**
 * Entfernt Type-Definitionen aus dem Dateiinhalt die nur in der IDE
 * funktionieren und tendenziell den Bitburner-Editor stören.
 * @param {string} content - Dateiinhalt
 * @returns {string} Bereinigter Inhalt
 */
function removeTypeDefinitions(content) {
	if (content === undefined) {
		throw new Error('content is undefined');
	}
	if (typeof content !== 'string') {
		throw new Error('content must be a string');
	}
	const lines = content.split('\n');
	let startIndex = 0;

	// Finde erste Zeile die keine Type-Definition ist
	while (startIndex < lines.length && REMOVE_PATTERNS.some(pattern => pattern.test(lines[startIndex]))) {
		startIndex++;
	}

	// Gib alle Zeilen ab diesem Index zurück
	return lines.slice(startIndex).join('\n');
}

/**
 * Lädt Dateien aus dem Repository herunter
 * @param {NS} ns - Netscript API
 * @param {string} user - GitHub Username
 * @param {string} repo - Repository Name
 * @param {string} branch - Branch Name
 * @param {Object} [filter] - Optionale Filter-Konfiguration
 * @param {boolean} [keepTypes = true] - bei FALSE: Entfernt Type-Definitionen
 */
async function downloadFiles(ns, user, repo, branch, filter = {}, keepTypes = true) {
	// GitHub API URLs
	const apiUrl = `https://api.github.com/repos/${user}/${repo}/git/trees/${branch}?recursive=1`;
	const rawBaseUrl = `https://raw.githubusercontent.com/${user}/${repo}/${branch}/`;

	ns.tprintRaw(`Lade Dateiliste vom Repository (Branch: ${branch})...`);

	try {
		// Hole Dateiliste via GitHub Trees API Endpoint: https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1
		//  dazu lädt WGET alles, was es als antwort auf die URL bekommt, in files.json
		//  oder (im Fehlerfall) steht in response ein FALSE
		const response = await ns.wget(apiUrl, 'files.json');
		if (response === false) {
			throw new Error(`Branch '${branch}' nicht gefunden oder nicht zugreifbar`);
		}

		const files = JSON.parse(ns.read('files.json')).tree;
		const currentScript = ns.getScriptName();

		// Filtere Dateien nach Konfiguration
		const filteredFiles = files
			// nur Einträge aus files übernehmen, die laut .type ein blob (sprich dateien) sind,
			// denn ns.wget kann keine Verzeichnisse runterladen
			.filter((f) => f.type === 'blob')
			// von den Einträgen die der vorgänger-filter übriglässt, werden versteckte dateien
			// ausgefiltert --> denn bitburner mag diese Dateien nicht (bzw ns.wget failed dann)
			.filter((f) => !f.path.startsWith('.') && !f.path.includes('/.'))
			// nur wenn baseDir gesetzt ist: nimm nur Einträge mit, die mit baseDir beginnen
			.filter((f) => !filter.baseDir || f.path.startsWith(filter.baseDir))
			// wenn min 1 wert in extension steht: nehme alle Einträge vom vorgänger mit,
			// deren path mit einem der werte in extension endet
			.filter(
				(f) => !filter.extension || filter.extension.some((ext) => f.path.endsWith(ext))
			)
			// wenn path auf diesen dateinamen endet, filtere den eintrag aus damit das eigene
			// Script nicht überschrieben wird
			.filter((f) => !f.path.endsWith(currentScript))
			// mache aus dem vorherigen filterergebnis ein neues array mit transformierten elementen
			// das nur noch den pfad zum ablegen und die url für den download enthält
			.map((f) => ({
				path: filter.baseDir ? f.path.replace(filter.baseDir, '') : f.path,
				url: rawBaseUrl + f.path,
			}));

		// Lade jede Datei herunter
		for (const file of filteredFiles) {
			try {
				await ns.wget(file.url, file.path);
				if (keepTypes === false && file.path.endsWith('.js')) {
					const content = ns.read(file.path);
					const cleanedContent = removeTypeDefinitions(content);
					await ns.write(file.path, cleanedContent, 'w');
				}
				ns.tprintRaw(`✓ ${file.path} heruntergeladen`);
			} catch (error) {
				ns.tprintRaw(`✗ Fehler beim Download von ${file.path}: ${error}`);
			}
		}

	} finally {
		// Cleanup
		if (ns.fileExists('files.json')) {
			ns.rm('files.json');
		}
	}
}

/**
 * Führt Terminal-Befehle aus
 * @param {string} command - Auszuführender Befehl
 * @returns {void}
 * HINWEIS: Diese Funktion nutzt einen Community-Hack um auf React-Internals
 * von Bitburner zuzugreifen. Object.keys()[1] holt den React Event-Handler.
 * Bei Bitburner-Updates kann sich die Struktur ändern - dann bricht dieser Code.
 */
function terminal(command) {
	if (typeof command !== 'string') {
		throw new Error('command muss ein String sein');
	}
	const doc = globalThis['document'];
	const terminalInput = doc.getElementById('terminal-input');
	// doc.getElementById('terminal-input') gibt null zurück, wenn das Element
	// nicht gefunden wird, sonst das Element.
	if (terminalInput === null) return;

	// @ts-ignore - wg INPUT-Typ
	// HACK: Object.keys()[1] holt React Event-Handler - kann bei Bitburner-Updates brechen
	terminalInput.value = command;
	const handler = Object.keys(terminalInput)[1];
	terminalInput[handler].onChange({ target: terminalInput });
	terminalInput[handler].onKeyDown({
		key: 'Enter',
		preventDefault: () => null,
	});
}

/**
 * prüft ob ein bestimmter user bei github existiert
 * @param {NS} ns Netscript API
 * @param {string} user GitHub Username
 * @returns {Promise<boolean>} true wenn user existiert, false wenn nicht
 */
async function checkGitHubUser(ns, user) {
	// https://api.github.com/users/USERNAME
	const userUrl = `https://api.github.com/users/${user}`;
	const response = await ns.wget(userUrl, 'user.txt');
	ns.rm('user.txt');
	return response;
}

/**
 * prüft ob ein bestimmtes repo@user bei github existiert und gibt dafür ein boolean zurück.
 * Zusätzlich werden (bei TRUE) die repodaten in 'repo.json' geschrieben. Wenn 'repo.json' schon
 * existiert, wird diese Datei überschrieben. (siehe ns.wget)
 * @param {NS} ns Netscript API
 * @param {string} user GitHub Username
 * @param {string} repo GitHub Repository Name
 * @returns {Promise<boolean>} true wenn repo existiert, false wenn nicht
 */
async function getGitHubRepoInfo(ns, user, repo) {
	// https://api.github.com/repos/USERNAME/REPO
	const repoUrl = `https://api.github.com/repos/${user}/${repo}`;
	const response = await ns.wget(repoUrl, 'repo.json');
	return response;
}
