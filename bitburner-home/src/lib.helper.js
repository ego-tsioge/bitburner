/**
 * @fileoverview Hilfsfunktionen für Bitburner Scripts
 *
 * Diese Datei stellt verschiedene Hilfsfunktionen und -klassen für Bitburner Scripts bereit:
 *
 * 1. Fortschrittsanzeige - waitWithProgress(ns, milliseconds, label, barWidth, keepBar)
 *    - Zeigt einen animierten Fortschrittsbalken im Log-Fenster
 *
 * 2. Notfall-Server-Management - killAll(ns)
 *    - Beendet alle Skripte auf allen erreichbaren Servern
 *    - Prüft Root-Zugriff vor der Ausführung
 *    - Zeigt Statusmeldungen für jeden Server
 *
 * 3. Server-Discovery - crawler(ns)
 *    - Findet alle erreichbaren Server im Netzwerk
 *
 * 4. Terminal-Integration - runTerminalCMD(command)
 *    - Führt Terminal-Befehle programmatisch aus
 *    - Simuliert Benutzereingaben
 *    - Unterstützt Alias-Ausführung
 *
 * 5. Alias-Konfiguration - init(ns)
 *    - Konfiguriert vordefinierte Terminal-Aliase
 *    - cls: Terminal bereinigen
 *    - reset: Alle Skripte beenden
 *    - init: Alias-Konfiguration neu laden
 *    - mon: Monitoring starten
 *
 * 6. Datenstrukturen - class RingBuffer<T>
 *    - Zyklischer Puffer mit fester Größe
 *    - add(element): Fügt Element hinzu, überschreibt bei Bedarf
 *    - current(): Gibt aktuelles Element zurück
 *    - previous(steps): Gibt vorheriges Element zurück
 *    - isEmpty(): Prüft ob Buffer leer ist
 *    - clear(): Leert den Buffer
 *
 * Verwendung:
```js
import { waitWithProgress, crawler, RingBuffer } from './lib.helper.js';

// Fortschrittsbalken
await waitWithProgress(ns, 5000, 'Lade...');

// Server finden
const servers = crawler(ns);

// Ring Buffer
const buffer = new RingBuffer(10);
```
 */

/** @ts-check */
/** @typedef {import("/types/NetscriptDefinitions").NS} NS */

// ======= globals ==============
/** @type {[string, string | number | boolean | string[]][]} */
const options = [
	['killall', false],
	['reset', false],
	['init', false]
]

const ALIASES = {
	cls: 'clear',
	reset: 'run src/lib.helper.js --reset', // Kill all scripts
	init: 'run src/lib.helper.js --init', // Init (nochmal, zB nach änderungen)
	mon: 'run util/simpleMon.js'
};

// ======= PROGRESS BAR FUNCTIONS ==============

/**
 * Wartet die angegebene Zeit und zeigt einen Fortschrittsbalken im Log-Fenster.
 * Löscht& schreibt vorherige Log-Einträge in jedem Update-Schritt, für die Optik des Balkens.
 * @param {NS} ns - Netscript API
 * @param {number} milliseconds - Wartezeit in Millisekunden
 * @param {string} [label='Warte'] - Beschriftung des Balkens
 * @param {number} [barWidth=40] - Breite des Fortschrittsbalkens in Zeichen
 * @returns {Promise<void>}
 */
export async function waitWithProgress(ns, milliseconds, label = 'Warte ...', barWidth = 40, keepBar = false) {
	const endTime = performance.now() + milliseconds;	// allererste aktion, zielzeit berechnen
	// --- Konfiguration (Standardwerte) ---
	const completeChar = '█';
	const incompleteChar = '░';
	const greenFg = '\u001b[38;5;2m'; // ANSI Code für grüne Vordergrundfarbe (Standard Green)
	const whiteFg = '\u001b[38;5;7m'; // ANSI Code für weiße Vordergrundfarbe (Standard White)
	const resetCode = '\u001b[0m';      // ANSI Reset Code
	const barColorFn = (text) => `${greenFg}${text}${resetCode}`;
	const textColorFn = (text) => `${whiteFg}${text}${resetCode}`;
	const updateInterval = 200; // Aktualisierung alle 200ms
	// --- innere funktionen ---------------
	/**
	 * hilfsfunktion: Rendert den Fortschrittsbalken
	 * (löscht auch das log und malt es mit dem neuen balken wieder hin)
	 *
	 * @param {number} progress - Fortschritt (0-1)
	 * @param {number} remainingSeconds - Verbleibende Sekunden
	 * @param {string[]} logHistory - Log History
	 */
	const render = (progress, remainingSeconds, logHistory) => {
		const filledWidth = Math.floor(progress * barWidth);
		const emptyWidth = barWidth - filledWidth;

		const filledBar = completeChar.repeat(filledWidth);
		const emptyBar = incompleteChar.repeat(emptyWidth);
		const bar = barColorFn(filledBar) + textColorFn(emptyBar);

		let barText = `${textColorFn(label)}: [${bar}] ${remainingSeconds}s`;
		ns.clearLog();						// Log löschen
		ns.print(logHistory.join('\n'));	// Log History hinschreiben
		ns.print(barText);					// Balken zum Log hinzufügen
	};
	// -------------------------------------

	const log = ns.getScriptLogs().slice(-20); // nur die letzten 20 Einträge behalten

	while (performance.now() < endTime) {
		const remaining = Math.max(0, endTime - performance.now());
		const progress = Math.min(1, 1 - remaining / milliseconds); // Fortschritt auf max 1 begrenzen
		const remainingSeconds = Math.ceil(remaining / 1000);

		render(progress, remainingSeconds, log);

		const waitTime = Math.max(0, endTime - performance.now()) % updateInterval;
		await ns.sleep(waitTime);
	}

	// Am Ende entweder (vollen) Balken behalten oder nur History zeigen
	if (keepBar) {
		render(1, 0, log);
	} else {
		ns.clearLog();
		ns.print(log.join('\n'));
	}
}

// ======= killAll ==============

/**
 * Einfaches Skript, das auf jedem erreichbaren Server ns.killall() ausführt.
 * WARNUNG: Dies versucht auch, Skripte auf 'home' zu beenden!
 * @param {NS} ns Netscript API
 */
export async function killAll(ns) {

	ns.tprint("INFO: Starte Netzwerksuche nach allen Servern...");
	const servers = crawler(ns);

	ns.tprint(`INFO: ${servers.length} Server gefunden. Starte killall...`);

	// Gehe durch alle gefundenen Server
	for (const server of servers) {
		// Prüfen, ob wir Root-Zugriff haben (killall funktioniert nur dann)
		if (ns.hasRootAccess(server)) {
			// Führe killall auf dem Server aus
			const scriptsKilled = ns.killall(server, true);

			if (scriptsKilled) {
				ns.tprint(`SUCCESS: Skripte auf ${server} beendet.`);
			} else {
				// Optional: Meldung, wenn keine Skripte liefen (außer auf 'home')
				if (server !== 'home') {
					ns.print(`INFO: Keine laufenden Skripte auf ${server} gefunden.`);
				}
			}
		}
		// Ein Päuschen fürs Spiel
		await ns.sleep(10);
	}

	ns.tprint("INFO: killAllSimple abgeschlossen.");
}

// ======= Crawler ==============

/**
 * Crawler-Skript, das alle Server in der Netzwerk-Hierarchie auflistet.
 * @param {NS} ns - Netscript API
 * @returns {string[]} - Liste aller Server
 */
export function crawler(ns) {
	const visited = new Set();	// merkzettel, wo wir schon waren (bei set kann man nicht ausversehen 2gleiche entitäten reinlegen)
	const heap = ['home'];		// der haufen der abgearbeitet werden soll, inkl. startpunkt

	while (heap.length > 0) {	// solange noch was auf dem haufen liegt ...
		const hostname = heap.pop();	// ... nehmen wir eines davon runter

		if (!visited.has(hostname)) {	// wenn wir es noch nicht kennen ...
			visited.add(hostname);		// ... wird es gespeichert

			const neighbors = ns.scan(hostname);	// dann fragen wir noch welche nachbarn es kennt
			heap.push(...neighbors);				// und legen diese auf den haufen (damit wir keinen vergessen)
		}
	} // end while (haufen abgearbeitet)
	return Array.from(visited);
}

// ======= run terminal commands ==============

/**
 * Führt Terminal-Befehle aus
 * @param {string} command - Auszuführender Befehl
 * @returns {void}
 */
export function runTerminalCMD(command) {
	const doc = globalThis['document'];
	const terminalInput = doc.getElementById('terminal-input');
	if (!terminalInput) return;

	// @ts-ignore - wg INPUT-Typ
	terminalInput.value = command;
	const handler = Object.keys(terminalInput)[1];
	terminalInput[handler].onChange({ target: terminalInput });
	terminalInput[handler].onKeyDown({
		key: 'Enter',
		preventDefault: () => null,
	});
}

// ======= init ==============

/**
 * @param {NS} ns
 */
export function init(ns) {
	// Setze Aliase
	ns.tprint('************* Setze Aliase...');
	try {
		for (const [alias, command] of Object.entries(ALIASES)) {
			runTerminalCMD(`alias ${alias}="${command}"`);
		}
		ns.tprint('✓ Aliase gesetzt');
	} catch (error) {
		ns.tprint('✗ Fehler beim Setzen eines Aliases');
	}

}

// ======= Ringbuffer ==============

/**
 * Ein Ring Buffer ist eine Datenstruktur mit fester Größe, die wie ein Kreis funktioniert.
 * Wenn der Buffer voll ist und ein neues Element hinzugefügt wird, wird das älteste Element überschrieben.
 * Dies ist nützlich für:
 * - Speichern der letzten N Ereignisse/Werte
 * - Implementierung von Sliding Windows
 * - Zyklische Datenverarbeitung
 *
 * @template T
 * @class RingBuffer
 * @property {number} size - Die maximale Anzahl von Elementen die gespeichert werden können
 * @property {Array<T | null>} buffer - Der interne Array-Speicher für die Elemente
 * @property {number} currentIndex - Der aktuelle Index für das nächste Element
 * @property {number} count - Die aktuelle Anzahl gespeicherter Elemente
 */

export class RingBuffer {
	/**
	 * Erstellt einen neuen Ring Buffer mit fester Größe
	 * @param {number} size - Größe des Buffers
	 */
	constructor(size) {
		if (!size || size <= 0 || !Number.isInteger(size)) {
			throw new Error(`RingBuffer benötigt eine positive, ganzzahlige Größe (statt ${size} )`);
		}
		this.size = size;
		/** @type {Array<T | null>} */
		this.buffer = new Array(size).fill(null);
		this.currentIndex = 0; // Aktueller Index (wo das nächste Element eingefügt wird)
		this.count = 0; // Anzahl der gespeicherten Elemente
	}

	/**
	 * Fügt ein neues Element hinzu und überschreibt das älteste bei Bedarf
	 * @param {T} element - Das hinzuzufügende Element
	 * @returns {T} Das hinzugefügte Element
	 */
	add(element) {
		this.buffer[this.currentIndex] = element;
		this.currentIndex = (this.currentIndex + 1) % this.size;
		if (this.count < this.size) {
			this.count++;
		}
		return element;
	}

	/**
	 * Gibt das aktuelle Element zurück (das zuletzt hinzugefügte)
	 * @returns {T | null} Das aktuelle Element oder null wenn leer
	 */
	current() {
		if (this.count === 0) {
			return null;
		}
		const lastIndex = (this.currentIndex - 1 + this.size) % this.size;
		return this.buffer[lastIndex];
	}

	/**
	 * Gibt das Element vor dem aktuellen zurück
	 * @param {number} [steps=1] - Wie viele Schritte zurück (Standard: 1)
	 * @returns {T | null} Das vorherige Element oder null wenn nicht verfügbar
	 */
	previous(steps = 1) {
		if (steps < 1 || steps > this.count) {
			return null;
		}
		const index = (this.currentIndex - steps + this.size) % this.size;
		return this.buffer[index];
	}

	/**
	 * Prüft ob der Buffer leer ist
	 * @returns {boolean} true wenn leer, sonst false
	 */
	isEmpty() {
		return this.count === 0;
	}

	/**
	 * Leert den Buffer
	 */
	clear() {
		this.buffer.fill(null);
		this.currentIndex = 0;
		this.count = 0;
	}
}

// ======= optimizeServer ==============
/**
 * Optimiert einen Server für Hacking (min Security, max Geld)
 * @param {NS} ns: Netscript API
 * @param {string} target Der zu optimierende Server
 * @param {boolean} forceRun Wenn true --> Spezialmodus: es wird für die restliche (freie) ramkapazität grows/weakens gestartet und danach
 * NICHT gewartet. das soll beim testen (also in bestimmten anwendungsfällen) schonmal etwas den server optimieren - während noch gewartet
 * wird dass der test? fertig wird
 * @returns {Promise<void>}
 */
export async function optimizeServer(ns, target, forceRun = false) {
	ns.disableLog('ALL');
	// Nur die kritischsten Checks
	if (!ns.serverExists(target)) {
		throw new Error(`Server '${target}' existiert nicht`);
	}

	let minSec = ns.getServerMinSecurityLevel(target);
	let actualSec = ns.getServerSecurityLevel(target);
	let maxMoney = ns.getServerMaxMoney(target);
	let actualMoney = ns.getServerMoneyAvailable(target);
	let secDiff = actualSec - minSec;
	let moneyDiff = maxMoney - actualMoney;

	/** @type {Array<{pid: number, threads: number}>} merke die gestarteten weaken-threads */
	let pidWeaken = []
	/** @type {Array<{pid: number, threads: number}>} merke die gestarteten grow-threads */
	let pidGrow = []
	/** @type {{value: number, name: string}} merke die eta für weaken */
	let etaWeaken = { value: 0, name: "Weaken" }
	/** @type {{value: number, name: string}} merke die eta für grow */
	let etaGrow = { value: 0, name: "Grow" }
	/** @type {number} ein gimmick - um im Log zu sehen, wann weaken übersprungen wird */
	let growBatchNumber = 0;

	/** @type {number} RAM pro Thread /Slot */
	const SCRIPT_RAM_COST = 1.75;
	/** @type {number} Multiplier für Weaken-Dauer */
	const WEAKEN_TIME_MULTIPLIER = 4;
	/** @type {number} Multiplier für Grow-Dauer */
	const GROW_TIME_MULTIPLIER = 3.2;
	/** @type {number} Sicherheitspuffer für Job-Completion-Checks; doppelt bei Grow damit es vor Weaken endet bei Timing-Kollisionen */
	const TIMING_BUFFER_MS = 20;

	while (actualSec > minSec || actualMoney < maxMoney || forceRun) {
		const botnet = crawler(ns).filter(server => ns.hasRootAccess(server))
			.sort((a, b) => ns.getServerMaxRam(b) - ns.getServerMaxRam(a));

		// zähle die verfügbaren slots durch
		let freeSlots = botnet.reduce((acc, server) => acc + Math.floor((ns.getServerMaxRam(server) - ns.getServerUsedRam(server)) / SCRIPT_RAM_COST), 0);
		let maxSlots = freeSlots;

		// schreibe die aktuelle hackzeit auf
		let hackTime = ns.getHackTime(target);

		// prüfe, was noch läuft
		let runGrows = pidGrow.reduce((acc, batch) => acc + (ns.getRunningScript(batch.pid) ? batch.threads : 0), 0);
		let runWeaken = pidWeaken.reduce((acc, batch) => acc + (ns.getRunningScript(batch.pid) ? batch.threads : 0), 0);

		// erweitere maxThreads um die benutzten Slots und berechne die ETA
		if (runWeaken > 0) {
			maxSlots += runWeaken;
		} else {
			// berechne die ETA für weaken, gebe 40ms puffer um zu vermeiden das grow noch läuft wenn wir später nachsehen
			etaWeaken.value = performance.now() + hackTime * WEAKEN_TIME_MULTIPLIER + TIMING_BUFFER_MS * 2;
			// Runde auf nächste 100ms auf; braucht aber mindestens 20ms extra Puffer, damit die Threads noch starten können
			etaWeaken.value = Math.ceil((etaWeaken.value + TIMING_BUFFER_MS) / 100) * 100;
			pidWeaken = [];
		}
		if (runGrows > 0) {
			maxSlots += runGrows;
		} else {
			// berechne die ETA für grow, gebe 80ms puffer (2*40) um zu vermeiden das grow nach weaken fertig wird
			etaGrow.value = performance.now() + hackTime * GROW_TIME_MULTIPLIER + TIMING_BUFFER_MS * 3;
			// Runde auf nächste 100ms auf; braucht aber mindestens 20ms extra Puffer, damit die Threads noch starten können
			etaGrow.value = Math.ceil((etaGrow.value + TIMING_BUFFER_MS) / 100) * 100;
			pidGrow = [];
		}

		// berechne grow- und weaken-threads
		let weakThreads = Math.ceil(maxSlots / 10);
		let growThreads = maxSlots - weakThreads;

		// status abfragen
		maxMoney = ns.getServerMaxMoney(target);
		actualMoney = ns.getServerMoneyAvailable(target);

		// starte die grows
		if (runGrows === 0 && moneyDiff > 0) {	// wenn keine grows mehr laufen und das geld noch nicht voll ist, ...
			growBatchNumber++;	// ein gimmick um zu sehen wann weaken übersprungen wird
			let remainingThreads = growThreads;
			for (const bot of botnet) {		// vorwärts iterieren, damit grow weniger fragmantiert wird
				if (remainingThreads <= 0) break;
				remainingThreads = executeOnBot(ns, bot, remainingThreads, 'src/bin.grow.js', target, hackTime * GROW_TIME_MULTIPLIER, etaGrow.value - TIMING_BUFFER_MS * 3, pidGrow);
			}
			ns.print(`${growBatchNumber}: starte ${growThreads} grows, r: ${remainingThreads}; ETA in ${(getWaitTime(etaGrow.value) / 1000).toFixed(2)}s Sec:${secDiff.toFixed(2)} $:${moneyDiff.toFixed(2)}`);
		}

		// starte die weakens
		if (runWeaken === 0) {	// wenn keine weakens laufen, ...
			let remainingThreads = weakThreads;
			for (let i = botnet.length - 1; i >= 0; i--) {	// rückwärts iterieren, weil weaken lücken füllen soll
				if (remainingThreads <= 0) break;
				remainingThreads = executeOnBot(ns, botnet[i], remainingThreads, 'src/bin.weaken.js', target, hackTime * WEAKEN_TIME_MULTIPLIER, etaWeaken.value - TIMING_BUFFER_MS * 2, pidWeaken);
			}
			ns.print(`${growBatchNumber}: starte ${weakThreads} weaken, r: ${remainingThreads}; ETA in ${(getWaitTime(etaWeaken.value) / 1000).toFixed(2)}s Sec:${secDiff.toFixed(2)} $:${moneyDiff.toFixed(2)}`);
		}

		if (forceRun) {
			// erzwungenen lauf hier beenden, sonst endlosschleife
			break;
		}
		// normaler lauf

		// warte auf nächstes ETA
		let nextEta = etaWeaken.value < etaGrow.value ? etaWeaken : etaGrow;	// wähle das nächste eta
		if (nextEta.value < performance.now()) {			// wenn das eta bereits abgelaufen ist, ...
			nextEta = etaWeaken.value > etaGrow.value ? etaWeaken : etaGrow;	// wähle das andere eta
		}
		let waitTime = getWaitTime(nextEta.value);	// berechne die wartezeit
		if (waitTime > 0) {
			await waitWithProgress(ns, waitTime, `Warte auf ${nextEta.name}`);
		} else {
			await waitWithProgress(ns, 3000, 'fehler: ETAs abgelaufen ...');
		}

		// werte aktualisieren für nächste iteration
		maxMoney = ns.getServerMaxMoney(target);
		actualMoney = ns.getServerMoneyAvailable(target);
		moneyDiff = maxMoney - actualMoney;
		if (moneyDiff === 0) {
			// geld ist fertig, warte auf die letzten weakens
			await waitWithProgress(ns, etaWeaken.value - performance.now(), 'Warte auf letztes Weaken');
		}

		minSec = ns.getServerMinSecurityLevel(target);
		actualSec = ns.getServerSecurityLevel(target);
		secDiff = actualSec - minSec;
	} // end while (server nicht optimal)

	if (!forceRun) {	// aufräumarbeiten nur machen wenn kein forceRun
		// wenn wir hier ankomen ist zwar schon der server optimal, aber es können
		// noch operatoren laufen, die wir abwarten müssen
		let waitTime = Math.max(etaWeaken.value, etaGrow.value) - performance.now();
		if (waitTime > 0) {
			await waitWithProgress(ns, waitTime, 'Warte auf letztes ETA');
		}
	}

	function getWaitTime(eta) {
		let waitTime = eta - performance.now();
		return Math.max(waitTime, 0);	// vermeide negative wartezeiten
	}

	/**
	 * Hilfsfunktion um threads zu starten (duplizierter code bei weaken und grow)
	 * @param {NS} ns - Netscript API
	 * @param {string} bot - Servername
	 * @param {number} threads - Threads, die gestartet werden müssen
	 * @param {string} scriptPath - Pfad zum Skript
	 * @param {string} target - Zielserver
	 * @param {number} duration - dauer der operation (grow/weaken)
	 * @param {number} eta - ETA für den Hack
	 * @param {Array<{pid: number, threads: number}>} pidArray - Array, in das die PIDs der gestarteten Threads gespeichert werden
	 * @returns {number} - verbleibende Threads, die gestartet werden müssen
	 */
	function executeOnBot(ns, bot, threads, scriptPath, target, duration, eta, pidArray) {
		const slots = Math.floor((ns.getServerMaxRam(bot) - ns.getServerUsedRam(bot)) / SCRIPT_RAM_COST);
		if (slots <= 0) return threads; // keine slots verfügbar

		const threadsForServer = Math.min(threads, slots);
		const pid = ns.exec(scriptPath, bot, threadsForServer, target, duration, eta);
		if (pid > 0) {
			pidArray.push({ pid: pid, threads: threadsForServer });
			return threads - threadsForServer; // verbleibende threads
		}
		return threads; // exec fehlgeschlagen
	}

} // end function optimizeServer

// ======= main-part ==============
/**
* @param {NS} ns
*/
export async function main(ns) {
	const flags = ns.flags(options);
	if (flags.reset || flags.killall) {
		await killAll(ns);
		ns.exit()
	}

	if (flags.init) {
		init(ns);
		ns.exit()
	}

	// setting
	ns.disableLog('ALL');
	ns.clearLog();
	ns.ui.openTail();

	ns.killall();

	const server = crawler(ns);
	const PIDs = [];

	const serverArray = [...server];
	const targetArray = serverArray.filter(serverName => ns.hasRootAccess(serverName) && ns.getServerMaxMoney(serverName) > 0 && serverName !== 'home');
	targetArray.sort((a, b) => ns.getServerRequiredHackingLevel(a) - ns.getServerRequiredHackingLevel(b));
	const totalRam = serverArray.reduce((sum, server) => sum + ns.getServerMaxRam(server), 0);

	ns.print(`${targetArray.length} ziele gefunden ${ns.formatRam(totalRam)} RAM verfügbar \nstarte 7spam-Atack `);

	const minute = 60 * 1000
	let s = 0; let inc = false;
	while (s < targetArray.length) {
		// halte alte prozesse am leben
		for (let i = 0; i < s; i++) {
			// prüfe ob der prozess noch läuft
			if (!ns.isRunning(PIDs[i])) {
				PIDs[i] = ns.run('util/7spam-Atack.js', 1, targetArray[i])
			}
		}
		const usedRam = Math.min(totalRam, (serverArray.reduce((sum, server) => sum + ns.getServerUsedRam(server), 0) + 1024));

		let ratio = usedRam / totalRam;
		if (ratio > 0.90) {
			// warte auf zustandsänderung
			await waitWithProgress(ns, minute / 3, `server sin etwas voll (${(ratio * 100).toFixed(2)}%), warten wir mal\n`);
		} else {
			// befüllung nicht zu hoch, starte 7spam

			const ziel = targetArray[s];
			ns.print(`ziel: ${ziel} s: ${s}`)
			try {
				PIDs[s] = ns.run('util/7spam-Atack.js', 1, ziel)
			} catch (e) {
				ns.print(`scheißfehler: pid ${PIDs[s]} ziel: ${ziel} s: ${s}`)
				ns.print(e)
			}

			let log = ns.getScriptLogs().slice(-20);

			ns.clearLog();
			if (PIDs[s]) {
				inc = true;
				ns.print(log.join('\n') + (s % 5 == 0 ? s % 10 == 0 ? ';' : ',' : '.'));
			} else {
				ns.print(log.join('\n'))
			}
			if ((ratio) > 0.42 || s > 42) {
				await waitWithProgress(ns, minute * Math.ceil(s / 13), `warte zwischen starts (${(ratio * 100).toFixed(2)}%)`)
			}
		}
		if (inc) { s++; inc = false; }
	}

}


