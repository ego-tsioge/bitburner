/** @typedef {import("/types/customNS").NS} NS */

import { throwError } from './lib.helper.js';

/**
 * @fileoverview Konfigurationen für unsere Bitburner Scripte
 *
 * Diese Datei soll *Konfiguration* und *Persistierung von Serverdaten* übernehmen.
 *
 * - Liste der Port-Opener
 * - Liste derOperator-Skripte
 * - Default-Settings
 */

/** die bekannten Port-Opener im Spiel
 * @type {string[]} */
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
 * Zentrale Config-Defaults - Single Source of Truth
 * Der Typ wird automatisch aus dem Default-Wert abgeleitet
 */
export const configDefaults = {
	reservedHomeRam: 24,      // RAM in GB
	target: 'n00dles',        // Hostname
	operationSpacing: 50,     // ms zwischen Operationen im Batch
	cycleSpacing: 200,        // ms zwischen Batch-Zyklen
};

/**
 * Manages settings in localStorage with some defaults
 */
export class Settings {

	/** Prefix for all localStorage keys */
	static storagePrefix = 'egoBB_';
	/** Default key for BotNet in localStorage */
	static botnetKey = 'botnet';
	/** Default key for Network Map in localStorage */
	static staticNetworkKey = 'stat_net';
	static dynamicNetworkKey = 'dyn_net';

	// ------- getter section -------
	/** @returns {number} Reserved RAM on home server in GB */
	static get reservedHomeRam() {
		return loadFromStorage('reservedHomeRam') ?? configDefaults.reservedHomeRam;
	}

	/** @returns {string} Hostname of the current target */
	static get target() {
		return loadFromStorage('target') ?? configDefaults.target;
	}

	/** @returns {number} Time between operations inside Batching-cycle in ms */
	static get operationSpacing() {
		return loadFromStorage('operationSpacing') ?? configDefaults.operationSpacing;
	}

	/** @returns {number} Reaction time between Batching-cycles in ms */
	static get cycleSpacing() {
		return loadFromStorage('cycleSpacing') ?? configDefaults.cycleSpacing;
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
	if (typeof key !== 'string') {
		throwError('key muss ein String sein', 'VALIDATION_ERROR');
	}

	const raw = localStorage.getItem(Settings.storagePrefix + key);
	if (raw === null) return null;

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
 * a) Die Funktion verlässt sich auf JSON.stringify, welches bestimmte Datentypen nicht
 *    serialisieren kann oder sie verändert:
 *    - undefined wird in Objekten weggelassen, in Arrays zu null.
 *    - Zirkuläre Referenzen (Objekte, die direkt oder indirekt auf sich selbst verweisen)
 *      werfen einen Fehler.
 * b) Map und Set werden nur auf der obersten ebene geprüft, nicht in verschachtelten Objekten.
 * Ich gehe davon aus das wir diese Schwächen in unseren Code nicht berücksichtigen müssen.
 * @param {string} key - Key for localStorage
 * @param {any} value - Value to store
 */
export function saveToStorage(key, value) {
	if (typeof key !== 'string') {
		throwError('key muss ein String sein', 'VALIDATION_ERROR');
	}

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

/**
 * Gibt einen Wert rekursiv formatiert aus
 * @param {NS} ns
 * @param {any} value
 * @param {number} indent - Einrückungstiefe
 */
function printValue(ns, value, indent = 0) {
	const pad = '  '.repeat(indent);

	if (value === null || value === undefined) {
		ns.tprint(`${pad}${value}`);
	} else if (Array.isArray(value)) {
		if (value.length === 0) {
			ns.tprint(`${pad}[]`);
		} else {
			ns.tprint(`${pad}[`);
			value.forEach(v => printValue(ns, v, indent + 1));
			ns.tprint(`${pad}]`);
		}
	} else if (value instanceof Map) {
		if (value.size === 0) {
			ns.tprint(`${pad}Map {}`);
		} else {
			ns.tprint(`${pad}Map {`);
			value.forEach((v, k) => {
				ns.tprint(`${pad}  ${k}:`);
				printValue(ns, v, indent + 2);
			});
			ns.tprint(`${pad}}`);
		}
	} else if (value instanceof Set) {
		ns.tprint(`${pad}Set [${[...value].join(', ')}]`);
	} else if (typeof value === 'object') {
		const entries = Object.entries(value);
		if (entries.length === 0) {
			ns.tprint(`${pad}{}`);
		} else {
			ns.tprint(`${pad}{`);
			for (const [k, v] of entries) {
				ns.tprint(`${pad}  ${k}:`);
				printValue(ns, v, indent + 2);
			}
			ns.tprint(`${pad}}`);
		}
	} else {
		ns.tprint(`${pad}${value}`);
	}
}

/**
 * Gibt eine kompakte Zusammenfassung eines Werts zurück
 * @param {any} value
 * @returns {string}
 */
function summarizeValue(value) {
	const json = JSON.stringify(value);

	if (json.length > 80) {
		const type = Array.isArray(value) ? `Array[${value.length}]`
			: value instanceof Map ? `Map[${value.size}]`
				: value instanceof Set ? `Set[${value.size}]`
					: typeof value === 'object' ? `Object[${Object.keys(value).length}]`
						: typeof value;
		return `${type} (${json.length} chars)`;
	}
	return json;
}

/** @param {NS} ns */
export async function main(ns) {
	const args = ns.args;
	const action = args[0];
	const key = args.length > 1 ? String(args[1]) : undefined;
	const value = args.length > 2 ? args[2] : undefined;

	switch (action) {
		case 'get':
			const stored = loadFromStorage(key);
			ns.tprint(`${key}:`);
			printValue(ns, stored, 1);
			return;
		case 'set':
			// Typ aus Default ableiten und konvertieren
			const parsed = parseValueByDefault(key, value);
			saveToStorage(key, parsed);
			ns.tprint(`${key} → ${JSON.stringify(parsed)}`);
			return;
		case 'reset':
			const resetAll = args[1] === 'all';
			for (const k of Object.keys(localStorage)) {
				if (!k.startsWith(Settings.storagePrefix)) continue;

				const shortKey = k.replace(Settings.storagePrefix, '');
				// Nur configDefaults ODER alles (bei reset all)
				if (resetAll || configDefaults.hasOwnProperty(shortKey)) {
					localStorage.removeItem(k);
				}
			}
			ns.tprint(resetAll ? 'Alles gelöscht' : 'Config zurückgesetzt');
			return;
		case 'list':
			const listAll = args[1] === 'all';
			for (const k of Object.keys(localStorage)) {
				if (listAll) {
					ns.tprint(`${k} = ${summarizeValue(localStorage.getItem(k))}`);
				} else if (k.startsWith(Settings.storagePrefix)) {
					ns.tprint("\n--------------------------------");
					const shortKey = k.replace(Settings.storagePrefix, '');
					const val = loadFromStorage(shortKey);
					ns.tprint(`${shortKey} = ${summarizeValue(val)}`);
				}
			}
			return;
		default:
			ns.tprint('Usage:');
			ns.tprint('  run lib.config.js get <key>');
			ns.tprint('  run lib.config.js set <key> <value>');
			ns.tprint('  run lib.config.js list');
			ns.tprint('  run lib.config.js reset');
			return;
	}
}

/**
 * Parst einen Wert basierend auf dem Typ des Defaults
 * @param {string} key - Config-Key
 * @param {any} value - Roher Wert (String aus Terminal)
 * @returns {any} Konvertierter Wert
 */
function parseValueByDefault(key, value) {
	const defaultValue = configDefaults[key];

	// Unbekannter Key → als String speichern
	if (defaultValue === undefined) {
		return value;
	}

	const targetType = typeof defaultValue;

	switch (targetType) {
		case 'number':
			return Number(value);
		case 'boolean':
			return value === 'true' || value === true;
		case 'string':
		default:
			return String(value);
	}
}

/**
 * Autocomplete für lib.config.js
 * @param {import("/types/NetscriptDefinitions").AutocompleteData} data
 * @param {string[]} args - Bisherige Argumente
 * @returns {string[]} Vorschläge
 */
export function autocomplete(data, args) {
	const actions = ['get', 'set', 'list', 'reset'];
	const action = args[0]; // erstes Argument, undefined wenn Array leer
	const key = args[1]; // zweites Argument, undefined wenn Array kürzer als 2
	const value = args[2]; // drittes Argument, undefined wenn Array kürzer als 3

	// Erstes Argument (action) wird getippt
	if (args.length <= 1 && !actions.includes(action)) {
		return actions;
	}

	// Zweites Argument wird getippt (key)
	const keys = Object.keys(configDefaults);

	// für get und set
	if (args.length <= 2 && ['get', 'set'].includes(action) && !keys.includes(key)) {
		return keys;
	}
	// für reset und list
	if (args.length <= 2 && ['reset', 'list'].includes(action)) {
		if (args[1] !== 'all') return ['all'];
	}

	// Drittes Argument wird getippt (value, nur bei set)
	const valueSuggestions = {
		target: data.servers,
		reservedHomeRam: ['8', '16', '24', '32', '64', '128'],
		operationSpacing: ['20', '40', '50', '100'],
		cycleSpacing: ['100', '200', '300', '500'],
	};

	if (args.length <= 3 && action === 'set' && keys.includes(key)) {
		const suggestions = valueSuggestions[key];
		if (suggestions && !suggestions.includes(String(value))) {
			return suggestions;
		}
	}

	return [];
}
