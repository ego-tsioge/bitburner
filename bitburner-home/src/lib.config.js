/** @ts-check */
/** @typedef {import("/types/NetscriptDefinitions").NS} NS */

/**
 * Set of port crackers available in the game
 * @type {string[]}
 */
export const portHackerSet = [
	'BruteSSH.exe',
	'FTPCrack.exe',
	'relaySMTP.exe',
	'HTTPWorm.exe',
	'SQLInject.exe'
];

/** Our standard operators that will be deployed on every bot */
export const operatorScripts = ['src/bin.hack.js', 'src/bin.grow.js', 'src/bin.weaken.js'];

/**
 * Manages settings in localStorage with some defaults
 */
export class Settings {

	/** Prefix for all localStorage keys */
	static storagePrefix = 'egoBB_';
	/** Default key for BotNet in localStorage */
	static botnetKey = 'botnet';

	// ------- getter section -------
	/**
	 * Reserved RAM on the home server
	 * Default: 16GB
	 * @returns {number} RAM in GB
	 */
	static get reservedHomeRam() {
		const value = loadFromStorage('reservedHomeRam');
		if (value == null) { return 16; } // Default: 16GB
		return value;
	}

	/**
	 * Current hack target
	 * @returns {string} Hostname of the current target
	 */
	static get target() {
		const value = loadFromStorage('target');
		if (value == null) { return 'n00dles'; } // Default: n00dles
		return value;
	}

	/**
	 * Time between operations *inside* Batching-cycle
	 * @returns {number} Time in ms
	 */
	static get operationSpacing() {
		const value = loadFromStorage('operationSpacing');
		if (value == null) { return 40 }	// default: 40
		return value;
	}

	/**
	 * reaction time between Batching-cycles
	 * @returns {number} Time in ms
	 */
	static get cycleSpacing() {
		const value = loadFromStorage('cycleSpacing');
		if (value == null) { return 200 }	// default: 200
		return value;
	}

	// ------- end of getter section -------

}

/**
 * Loads data from localStorage with type preservation
 *
 * Die Funktion versucht die Daten in folgender Reihenfolge zu laden:
 * 1. Wrapper-Objekt (mit type und data Properties) -> wird in den originalen Typ konvertiert
 * 2. Normales JSON -> wird direkt zurückgegeben
 * 3. Rohe Daten (wenn JSON-Parsing fehlschlägt) -> werden unverändert zurückgegeben
 *
 * @param {string} key - Key for localStorage
 * @returns {any} Loaded data (or null if key doesn't exist)
 */
export function loadFromStorage(key) {
	const raw = localStorage.getItem(Settings.storagePrefix + key);
	if (!raw) return null;

	try {
		const wrapper = JSON.parse(raw);
		// Check if it's a wrapper object
		if (wrapper.hasOwnProperty('type') && wrapper.hasOwnProperty('data')) {
			return convertToType(wrapper.type, wrapper.data);
		}
		// If not, return the value directly
		return wrapper;
	} catch (error) {
		return raw;  // If not JSON, return raw data
	}
}

/**
 * Saves data in localStorage with type preservation
 *
 * Schwächen:
 * - Die Funktion verlässt sich auf JSON.stringify, welches bestimmte Datentypen
 *   nicht serialisieren kann oder sie verändert:
 *   - undefined wird in Objekten weggelassen, in Arrays zu null.
 *   - Zirkuläre Referenzen (Objekte, die direkt oder indirekt auf sich selbst verweisen) werfen einen Fehler.
 * - Map und Set werden nur auf der obersten ebene geprüft, nicht in verschachtelten Objekten.
 * @param {string} key - Key for localStorage
 * @param {any} value - Value to store
 */
export function saveToStorage(key, value) {
	// Remove null or undefined directly
	if (value === null || value === undefined) {
		localStorage.removeItem(Settings.storagePrefix + key);
		return;
	}

	// Wrapper object with type and data
	const wrapper = {
		type: value.constructor.name,
		data: value instanceof Map ? Array.from(value.entries()) :
			value instanceof Set ? Array.from(value) :
				value
	};
	localStorage.setItem(Settings.storagePrefix + key, JSON.stringify(wrapper));
}

/**
 * Restores data from storage
 * @param {any} data - The data to convert
 * @param {string} type - The original data type
 * @returns {any} Converted data
 */
function convertToType(type, data) {
	switch (type) {
		case 'Number':
		case 'String':
		case 'Boolean':
			return data;
		case 'Date':
			return new Date(data);
		case 'Array':
			return Array.from(data);
		case 'Set':
			return new Set(data);
		case 'Map':
			return new Map(data);
		default:
			return data;
	}
}
