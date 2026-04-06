/** @typedef {import("/types/customNS").NS} NS */

/**
 * @fileoverview Hilfsfunktionen für Bitburner Scripts
 *
 * Diese Datei stellt verschiedene Hilfsfunktionen und -klassen für Bitburner Scripts bereit:
 *
 * 1. Fortschrittsanzeige - waitWithProgress(ns, milliseconds, label, barWidth, keepBar)
 *    - Zeigt einen animierten Fortschrittsbalken im Log-Fenster
 *
 * 2. Notfall-Server-Management - killAll(ns) TODO:entfernen (Ramverbrauch durch crawler)
 *    - Beendet alle Skripte auf allen erreichbaren Servern
 *    - Prüft Root-Zugriff vor der Ausführung
 *    - Zeigt Statusmeldungen für jeden Server
 *
 * 3. Server-Discovery - crawler(ns) TODO: entfernen (ramverbrauch durch ns.scan())
 *    - Findet alle erreichbaren Server im Netzwerk
 *
 * 4. Terminal-Integration
 *    - runTerminalCMD(command) - Führt Terminal-Befehle programmatisch aus
 *    - getLastTerminalResponse(command) - Extrahiert die Antwort auf den letzten Befehl
 *    - waitForTerminalResponse(ns, command, options) - Wartet auf stabile Antwort
 *    - execTerminalCMD(ns, command, options) - Führt Befehl aus und gibt Antwort zurück
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
import { waitWithProgress, RingBuffer, execTerminalCMD } from './lib.helper.js';

// Fortschrittsbalken
await waitWithProgress(ns, 5000, 'Lade...');

// Terminal-Befehl ausführen und Antwort lesen
const response = await execTerminalCMD(ns, 'analyze');

// Ring Buffer
const buffer = new RingBuffer(10);
```
 */

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

const SUFFIXES = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];

/**
 * Formatiert eine nicht-negative Zahl in einen String fester Breite (6 Zeichen)
 * mit spezieller Präfix-Logik für große Zahlen. Negative Zahlen oder ungültige
 * Eingaben ergeben "  N/A ".
 * Beispiele:
 *   123       => "   123"
 *   12345     => "12k345"
 *   123456    => "123k45"
 *   1234567   => "1m2345"
 *   -123      => "  N/A "
 *   null      => "  N/A "
 * @param {number | null | undefined} num - Die zu formatierende Zahl.
 * @returns {string} Der formatierte 6-Zeichen-String.
 */
export function formatNumberFixedWidth(num) {
	const targetWidth = 6;
	const naString = "N/A".padStart(targetWidth); // "  N/A "

	// Ungültige oder negative Eingaben => N/A
	if (num === null || num === undefined || isNaN(num) || num < 0) {
		return naString;
	}

	// Fall 1: Kleine Zahlen (< 10000)
	if (num < 10000) {
		return String(num).padStart(targetWidth, ' ');
	}

	// Fall 2: Große Zahlen (>= 10000)
	let suffixIndex = 0;
	let tempNum = num;

	// Finde den passenden Suffix-Index basierend auf der Größenordnung
	suffixIndex = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(num) / 3));

	const divisor = Math.pow(1000, suffixIndex);
	//const suffix = '\x1b[31m' + SUFFIXES[suffixIndex] + '\x1b[0m'; // farbe?
	const suffix = SUFFIXES[suffixIndex];

	const intPart = Math.floor(num / divisor);
	const remainder = num % divisor;
	const intPartStr = String(intPart);
	const intPartLen = intPartStr.length;

	// Verbleibende Zeichen für Nachkommastellen (nach Suffix)
	const fractionDigitsNeeded = targetWidth - intPartLen - 1; // 1 für den Suffix

	// Fallback, falls der Integer-Teil + Suffix schon zu lang sind
	if (fractionDigitsNeeded < 0) {
		let fallbackStr = intPartStr + suffix;
		if (fallbackStr.length > targetWidth) {
			// Extremfall: z.B. 123456k -> zu lang -> Fehler anzeigen
			return '#'.padStart(targetWidth, '#');
		}
	}

	// Berechne den "Nachkomma"-Teil basierend auf dem Anteil am Divisor
	let fractionPart = 0;
	let fractionStr = '';
	if (fractionDigitsNeeded > 0) {
		// Berechne den Anteil des Rests am Divisor und skaliere ihn
		const scaledFraction = (remainder / divisor) * Math.pow(10, fractionDigitsNeeded);
		fractionPart = Math.floor(scaledFraction);
		// Fülle den Nachkomma-Teil mit führenden Nullen auf die benötigte Länge auf
		fractionStr = String(fractionPart).padStart(fractionDigitsNeeded, '0');
	}

	const finalStr = intPartStr + suffix + fractionStr;

	return finalStr;
}

/**
 * Formatiert eine nicht-negative Zahl lesbar mit Suffix (k, M, …) und
 * optionaler Nachkommastelle. Gleiche API wie formatNumberFixedWidth,
 * gleiche feste Breite (6 Zeichen) für Tabellen.
 * Beispiele:
 *   123       => "   123"
 *   12345     => " 12.3k"
 *   1234567   => "  1.2M"
 *   -123      => "  N/A "
 * @param {number | null | undefined} num - Die zu formatierende Zahl.
 * @returns {string} Der formatierte 6-Zeichen-String.
 */
export function formatNumberShort(num) {
	const targetWidth = 6;
	const naString = 'N/A'.padStart(targetWidth);

	if (num === null || num === undefined || isNaN(num) || num < 0) {
		return naString;
	}

	if (num < 1000) {
		return String(Math.round(num)).padStart(targetWidth, ' ');
	}

	const suffixIndex = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(num) / 3));
	const divisor = Math.pow(1000, suffixIndex);
	const suffix = SUFFIXES[suffixIndex];
	const scaled = num / divisor;

	let s;
	if (scaled >= 100) {
		s = String(Math.round(scaled)) + suffix;
	} else if (scaled >= 10) {
		s = scaled.toFixed(1) + suffix;
	} else {
		s = scaled.toFixed(2) + suffix;
	}

	return s.padStart(targetWidth, ' ');
}



// ======= ERROR Helper ==============

/**
 * Wirft einen Error mit gegebenem Code
 * @param {string} message - Fehlermeldung
 * @param {string} errorCode - Error-Code zur Kategorisierung (z.B. 'VALIDATION_ERROR', 'NOT_FOUND_ERROR')
 * @throws {Error & {code: string}} Error mit code-Property
 */
export function throwError(message, errorCode) {
	const error = new Error(message);
	// @ts-ignore - code Property für Error-Categorisierung
	error.code = errorCode;
	throw error;
}
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
	if (typeof milliseconds !== 'number' || milliseconds <= 0) {
		throwError('milliseconds muss größer als 0 sein', 'VALIDATION_ERROR');
	}
	if (typeof label !== 'string') {
		throwError('label muss ein String sein', 'VALIDATION_ERROR');
	}
	if (typeof barWidth !== 'number' || !Number.isInteger(barWidth) || barWidth <= 7) {
		throwError('barWidth muss größer gleich 7 sein', 'VALIDATION_ERROR');
	}
	if (typeof keepBar !== 'boolean') {
		throwError('keepBar muss ein boolean sein', 'VALIDATION_ERROR');
	}
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
// export async function killAll(ns) {

// 	ns.tprint("INFO: Starte Netzwerksuche nach allen Servern...");
// 	const servers = crawler(ns);

// 	ns.tprint(`INFO: ${servers.length} Server gefunden. Starte killall...`);

// 	// Gehe durch alle gefundenen Server
// 	for (const server of servers) {
// 		// Prüfen, ob wir Root-Zugriff haben (killall funktioniert nur dann)
// 		if (ns.hasRootAccess(server)) {
// 			// Führe killall auf dem Server aus
// 			const scriptsKilled = ns.killall(server, true);

// 			if (scriptsKilled) {
// 				ns.tprint(`SUCCESS: Skripte auf ${server} beendet.`);
// 			} else {
// 				// Optional: Meldung, wenn keine Skripte liefen (außer auf 'home')
// 				if (server !== 'home') {
// 					ns.print(`INFO: Keine laufenden Skripte auf ${server} gefunden.`);
// 				}
// 			}
// 		}
// 		// Ein Päuschen fürs Spiel
// 		await ns.sleep(10);
// 	}

// 	ns.tprint("INFO: killAllSimple abgeschlossen.");
// }

// ======= run terminal commands ==============

/**
 * Führt Terminal-Befehle aus
 * @param {string} command - Auszuführender Befehl
 * @returns {void}
 */
export function runTerminalCMD(command) {
	if (typeof command !== 'string') {
		throwError('command muss ein String sein', 'VALIDATION_ERROR');
	}
	const doc = globalThis['document'];
	const terminalInput = doc.getElementById('terminal-input');
	// doc.getElementById('terminal-input') gibt null zurück, wenn das Element
	// nicht gefunden wird, sonst das Element.
	if (terminalInput === null) return;

	// @ts-ignore - wg INPUT-Typ
	terminalInput.value = command;
	const handler = Object.keys(terminalInput)[1];
	terminalInput[handler].onChange({ target: terminalInput });
	terminalInput[handler].onKeyDown({
		key: 'Enter',
		preventDefault: () => null,
	});
}

// ======= read terminal output ==============

/**
 * Liest den Inhalt des Bitburner-Terminals als Array von Zeilen.
 * @returns {string[] | null} Zeilen-Array oder null wenn Terminal-Element nicht vorhanden
 */
export function getTerminalLines() {
	const doc = globalThis['document'];
	const terminal = doc.getElementById('terminal');
	if (terminal === null) return null;
	return terminal.innerText.split('\n');
}

/**
 * Extrahiert die Antwort auf den letzten Aufruf eines Befehls im Terminal.
 * Sucht rückwärts nach der Prompt-Zeile "> command" und sammelt alle
 * Ausgabezeilen bis zum nächsten Prompt.
 *
 * @param {string} command - Der Befehl, dessen Antwort gesucht wird
 * @returns {string | null} Antwort-Text oder null wenn Terminal/Befehl nicht gefunden
 */
export function getLastTerminalResponse(command) {
	if (typeof command !== 'string') {
		throwError('command muss ein String sein', 'VALIDATION_ERROR');
	}
	const lines = getTerminalLines();
	if (lines === null) return null;

	const reversed = [...lines].reverse();
	const commandIndex = reversed.findIndex(line => line.includes(`> ${command}`));
	if (commandIndex === -1) return null;

	const response = [];
	for (let i = commandIndex - 1; i >= 0; i--) {
		if (reversed[i].includes('>')) break;
		response.unshift(reversed[i]);
	}
	return response.join('\n');
}

/**
 * Wartet bis die Terminal-Antwort auf einen Befehl stabil ist, d.h. sich
 * über mehrere Polls hinweg nicht mehr ändert. Nützlich für Befehle deren
 * Ausgabe asynchron im DOM erscheint (hack, grow, weaken, analyze, …).
 *
 * @param {NS} ns - Netscript API (für ns.sleep)
 * @param {string} command - Der Befehl, auf dessen Antwort gewartet wird
 * @param {object} [options]
 * @param {number} [options.stableThreshold=5] - Anzahl identischer Polls bis "stabil"
 * @param {number} [options.pollInterval=100] - Millisekunden zwischen Polls
 * @param {number} [options.timeout=30000] - Max. Wartezeit in ms (0 = kein Limit)
 * @returns {Promise<string | null>} Stabile Antwort oder null bei Timeout / fehlendem Terminal
 */
export async function waitForTerminalResponse(ns, command, options = {}) {
	const {
		stableThreshold = 5,
		pollInterval = 100,
		timeout = 30000,
	} = options;

	let lastResponse = '';
	let stableCount = 0;
	const startTime = performance.now();

	while (stableCount < stableThreshold) {
		if (timeout > 0 && (performance.now() - startTime) > timeout) {
			return null;
		}
		const current = getLastTerminalResponse(command);
		if (current !== null && current === lastResponse) {
			stableCount++;
		} else {
			stableCount = 0;
			lastResponse = current ?? '';
		}
		await ns.sleep(pollInterval);
	}
	return lastResponse;
}

/**
 * Führt einen Terminal-Befehl aus und wartet auf dessen stabile Antwort.
 * Kombiniert {@link runTerminalCMD} mit {@link waitForTerminalResponse},
 * aber mit Schutz gegen Stale-Responses: Vor dem Befehl wird die aktuelle
 * Zeilenzahl gemerkt. Erst wenn neue Zeilen erscheinen UND die Antwort
 * nicht-leer und stabil ist, wird sie zurückgegeben.
 *
 * @param {NS} ns - Netscript API (für ns.sleep)
 * @param {string} command - Auszuführender Terminal-Befehl
 * @param {object} [options]
 * @param {number} [options.stableThreshold=5] - Anzahl identischer Polls bis "stabil"
 * @param {number} [options.pollInterval=100] - Millisekunden zwischen Polls
 * @param {number} [options.timeout=30000] - Max. Wartezeit in ms (0 = kein Limit)
 * @returns {Promise<string | null>} Antwort-Text oder null bei Timeout / fehlendem Terminal
 */
export async function execTerminalCMD(ns, command, options = {}) {
	const linesBefore = getTerminalLines()?.length ?? 0;
	runTerminalCMD(command);

	const {
		stableThreshold = 5,
		pollInterval = 100,
		timeout = 30000,
	} = options;

	let lastResponse = '';
	let stableCount = 0;
	let newContentDetected = false;
	const startTime = performance.now();

	while (stableCount < stableThreshold) {
		if (timeout > 0 && (performance.now() - startTime) > timeout) {
			return null;
		}

		if (!newContentDetected) {
			const currentLines = getTerminalLines()?.length ?? 0;
			if (currentLines > linesBefore) {
				newContentDetected = true;
			} else {
				await ns.sleep(pollInterval);
				continue;
			}
		}

		const current = getLastTerminalResponse(command);
		if (current !== null && current.length > 0 && current === lastResponse) {
			stableCount++;
		} else {
			stableCount = 0;
			lastResponse = current ?? '';
		}
		await ns.sleep(pollInterval);
	}
	return lastResponse;
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
 * @property {number} currentIndex - (aka nextWriteIndex) Zeigt auf die nächste schreibposition
 * @property {number} count - Die aktuelle Anzahl gespeicherter Elemente
 */

export class RingBuffer {
	/**
	 * Erstellt einen neuen Ring Buffer mit fester Größe
	 * @param {number} size - Größe des Buffers
	 */
	constructor(size) {
		if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0) {
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
	enqueue(element) {
		this.buffer[this.currentIndex] = element;
		this.currentIndex = (this.currentIndex + 1) % this.size;
		if (this.count < this.size) this.count++;
		return element;
	}

	/**
	 * Gibt das älteste Element zurück (wie "front()" in Standard-Queues).
	 * @returns {T | null} Das älteste Element oder null wenn leer
	 */
	peek() {
		if (this.count === 0) return null;
		return this.buffer[(this.currentIndex - this.count + this.size) % this.size];
	}

	/**
	 * Dreht den Index um `steps` Schritte weiter
	 * @param {number} [steps=1] - Wie viele Schritte weiter (Standard: 1)
	 * @returns {T | null} Das "neue" älteste Element, nach der Drehung
	 */
	rotate(steps = 1) {
		if (this.count === 0) return null;
		if (this.count < this.size) {
			throw new Error(`Rotation nicht möglich, Buffer ist nicht voll (${this.count} < ${this.size})`);
		}
		if (typeof steps !== 'number' || !Number.isInteger(steps)) {
			throw new Error(`steps soll positiv und ganzzahlig sein (statt [${steps}] typeof [${typeof steps}])`);
		}

		const raw = this.currentIndex + steps
		this.currentIndex = ((raw % this.size) + this.size) % this.size;	// vermeidet negativen wert

		return this.buffer[(this.currentIndex - this.count + this.size) % this.size];
	}

	/**
	 * Gibt das `steps`-te Element vor dem ältesten zurück.
	 * @param {number} [steps=1] - Wie viele Schritte zurück (Standard: 1)
	 * @returns {T | null} Das vorherige Element oder null wenn nicht verfügbar
	 */
	peekBack(steps = 1) {
		if (typeof steps !== 'number' || !Number.isInteger(steps)) {
			throw new Error(`steps soll positiv und ganzzahlig sein (statt [${steps}] typeof [${typeof steps}])`);
		}
		if (steps < 1 || steps > this.count) {
			throw new Error(`steps soll positiv und ganzzahlig sein (statt ${steps} )`);
		}
		const raw = this.currentIndex - this.count - steps;
		const index = ((raw % this.size) + this.size) % this.size;	// vermeidet negativen wert
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

// ======= DOM-Klick-Helfer (UI-Automatisierung) ==============

/**
 * Findet ein DOM-Element anhand seines sichtbaren Text-Inhalts.
 * @param {string} text - Gesuchter Text
 * @param {string} [tag='button'] - HTML-Tag
 * @param {boolean} [exact=false] - Exakter Match statt contains
 * @returns {HTMLElement | null}
 */
export function findByText(text, tag = 'button', exact = false) {
	const doc = globalThis['document'];
	const elements = doc.querySelectorAll(tag);
	for (const el of elements) {
		const content = el.textContent?.trim() ?? '';
		if (exact ? content === text : content.includes(text)) {
			return /** @type {HTMLElement} */ (el);
		}
	}
	return null;
}

/**
 * Klickt ein Element an (React-Handler oder native .click()).
 * @param {HTMLElement} element
 * @returns {boolean}
 */
export function clickElement(element) {
	if (!element) return false;
	try {
		const reactKey = Object.keys(element).find(k => k.startsWith('__reactProps') || k.startsWith('__reactEvents'));
		if (reactKey && element[reactKey]?.onClick) {
			element[reactKey].onClick({ isTrusted: true });
		} else {
			element.click();
		}
		return true;
	} catch {
		return false;
	}
}

/**
 * Navigiert zu einem Sidebar-Tab (z.B. "City", "Terminal").
 * @param {string} tabName
 * @returns {boolean}
 */
export function navigateTo(tabName) {
	const label = findByText(tabName, 'p', true);
	if (!label) return false;
	const listItem = label.closest('[role="button"]');
	if (listItem) return clickElement(/** @type {HTMLElement} */ (listItem));
	return clickElement(label);
}

/**
 * Navigiert zu City → Alpha Enterprises (das "T" in der ASCII-Karte).
 * @param {NS} ns - für ns.sleep
 * @param {number} [delayMs=500]
 * @returns {Promise<boolean>}
 */
export async function goToAlphaEnterprises(ns, delayMs = 500) {
	const doc = globalThis['document'];
	navigateTo('City');
	await ns.sleep(delayMs);
	const marker = doc.querySelector('span[aria-label="Alpha Enterprises"]');
	if (!marker) return false;
	clickElement(/** @type {HTMLElement} */ (marker));
	await ns.sleep(delayMs);
	return true;
}

/**
 * Kauft den TOR-Router via UI-Klick.
 * City → Alpha Enterprises → "Purchase TOR router"
 * @param {NS} ns
 * @param {number} [delayMs=500]
 * @returns {Promise<boolean>}
 */
export async function buyTorRouter(ns, delayMs = 500) {
	if (!await goToAlphaEnterprises(ns, delayMs)) return false;
	const btn = /** @type {HTMLButtonElement | null} */ (findByText('Purchase TOR router', 'button'));
	if (!btn || btn.disabled) return false;
	return clickElement(btn);
}

/**
 * Kauft ein Home-RAM-Upgrade via UI-Klick.
 * City → Alpha Enterprises → "Upgrade 'home' RAM"
 * @param {NS} ns
 * @param {number} [delayMs=500]
 * @returns {Promise<boolean>}
 */
export async function clickRamUpgrade(ns, delayMs = 500) {
	if (!await goToAlphaEnterprises(ns, delayMs)) return false;
	const btn = /** @type {HTMLButtonElement | null} */ (findByText("Upgrade 'home' RAM", 'button'));
	if (!btn || btn.disabled) return false;
	return clickElement(btn);
}

/**
 * Navigiert zurück zum Terminal.
 * @param {NS} ns
 * @param {number} [delayMs=500]
 */
export async function goToTerminal(ns, delayMs = 500) {
	navigateTo('Terminal');
	await ns.sleep(delayMs);
}

