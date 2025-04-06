/** @ts-check */
/** @typedef {import("/types/NetscriptDefinitions").NS} NS */


/**
 * Default values for settings
 * Publicly accessible version of Settings defaults
 */
export const Defaults = {
	/** Reserved RAM on the home server in GB */
	reservedHomeRam: 8,
	/** Default target server for the hack cycle */
	target: 'n00dles',
	/** Default key for BotNet in localStorage */
	botnetKey: 'botnet',
	/** Default key for Scheduled Threads in localStorage */
	schedKey: 'scheduledThreads',
	/** Default key for the network map in localStorage */
	mapKey: 'network_map',
	/** Default key for the delay during module transitions */
	spawnDelay: 0,
	/** Time between operations in the HWGW cycle */
	operationSpacing: 100,
	/** Time between HWGW cycles */
	cycleSpacing: 100,
	/** Debug status across script boundaries */
	wasDebug: false,
	/** Prefix for all localStorage keys */
	storagePrefix: 'egoBB_'
};

Object.freeze(Defaults);  // Make defaults immutable

/**
 * Module states as enum
 * Central definition of all possible states
 */
export const ModuleStates = {
	/** Preparation phase - Server is being brought to optimal values */
	PREP: 'prep',
	/** HWGW phase - Server is optimal, hack cycle is running */
	HWGW: 'hwgw'
};

Object.freeze(ModuleStates);  // Make states immutable

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

Object.freeze(portHackerSet);  // Make hackers immutable

/** Die Standard-Operatoren die auf jeden Bot deployed werden */
export const operatorScripts = ['bin.hack.js', 'bin.grow.js', 'bin.weaken.js'];

Object.freeze(operatorScripts);


/**
 * Central settings and configuration
 * Manages persistent settings in localStorage with defaults
 */
export class Settings {
	/**
	 * Reserved RAM on the home server
	 * @returns {number} RAM in GB
	 */
	static get reservedHomeRam() {
		const value = loadFromStorage(Defaults.storagePrefix + 'reservedHomeRam');
		if (value == null) {
			return Defaults.reservedHomeRam;
		}
		return value;
	}

	/**
	 * Current hack target
	 * @returns {string} Hostname of the current target
	 */
	static get target() {
		const value = loadFromStorage(Defaults.storagePrefix + 'target');
		if (value == null) {
			return Defaults.target;
		}
		return value;
	}

	/**
	 * Sets the current hack target
	 * @param {string} hostname - Hostname of the target server
	 */
	static set target(hostname) {
		this.setItem('target', hostname);
	}

	/**
	 * Key to identify Botnet in localStorage
	 * @returns {string} Key
	 */
	static get botnetKey() {
		const value = loadFromStorage(Defaults.storagePrefix + 'botnetKey');
		if (value == null) {
			return Defaults.botnetKey;
		}
		return value;
	}

	/**
	 * Key to identify Scheduled Threads in localStorage
	 * @returns {string} Key
	 */
	static get schedKey() {
		const value = loadFromStorage(Defaults.storagePrefix + 'schedKey');
		if (value == null) {
			return Defaults.schedKey;
		}
		return value;
	}

	/**
	 * Key to identify the network map in localStorage
	 * @returns {string} Key
	 */
	static get mapKey() {
		const value = loadFromStorage(Defaults.storagePrefix + 'mapKey');
		if (value == null) {
			return Defaults.mapKey;
		}
		return value;
	}

	/**
	 * Delay during module transitions
	 * @returns {number} Delay in ms
	 */
	static get spawnDelay() {
		const value = loadFromStorage(Defaults.storagePrefix + 'spawnDelay');
		if (value == null) {
			return Defaults.spawnDelay;
		}
		return value;
	}

	/**
	 * Time between operations in the HWGW cycle
	 * @returns {number} Time in ms
	 */
	static get operationSpacing() {
		const value = loadFromStorage(Defaults.storagePrefix + 'operationSpacing');
		if (value == null) {
			return Defaults.operationSpacing;
		}
		return value;
	}

	/**
	 * Time between HWGW cycles
	 * @returns {number} Time in ms
	 */
	static get cycleSpacing() {
		const value = loadFromStorage(Defaults.storagePrefix + 'cycleSpacing');
		if (value == null) {
			return Defaults.cycleSpacing;
		}
		return value;
	}

	/**
	 * Debug status across script boundaries
	 * @returns {boolean} Debug status
	 */
	static get wasDebug() {
		const value = loadFromStorage(Defaults.storagePrefix + 'wasDebug');
		if (value == null) {
			return Defaults.wasDebug;
		}
		return value;
	}

	/**
	 * Defines getter/setter for a key
	 * @param {string} key Settings key
	 * @param {any} value initial value
	 */
	static setItem(key, value) {
		saveToStorage(Defaults.storagePrefix + key, value);
		if (!this.hasOwnProperty(key)) {
			Object.defineProperty(this, key, {
				get() {
					return loadFromStorage(Defaults.storagePrefix + key);
				},
				set(value) {
					saveToStorage(Defaults.storagePrefix + key, value);
				}
			});
		}
	}

	/**
	 * Loads a value from settings
	 * @param {string} key Settings key
	 * @returns {any} Loaded value
	 */
	static loadItem(key) {
		return loadFromStorage(Defaults.storagePrefix + key);
	}

	/**
	 * Resets values to default
	 * @param {string} [key] Optional: Specific key
	 */
	static reset(key) {
		if (key) {
			localStorage.removeItem(Defaults.storagePrefix + key);
		} else {
			Object.keys(Defaults).forEach(k =>
				localStorage.removeItem(Defaults.storagePrefix + k)
			);
		}
	}
}

/**
 * Loads data from localStorage
 * @param {string} key - Key for localStorage
 * @returns {any} Loaded data or null
 */
export function loadFromStorage(key) {
	const raw = localStorage.getItem(key);
	if (!raw) return null;

	try {
		const wrapper = JSON.parse(raw);
		// Check if it's a wrapper object
		if (wrapper.hasOwnProperty('type') && wrapper.hasOwnProperty('data')) {
			return restoreFromStorage(wrapper.data, wrapper.type);
		}
		// If not, return the value directly
		return wrapper;
	} catch (error) {
		return raw;  // If not JSON, return raw data
	}
}

/**
 * Saves data in localStorage with type preservation
 * @param {string} key - Key for localStorage
 * @param {any} value - Value to store
 */
export function saveToStorage(key, value) {
	// Remove null or undefined directly
	if (value === null || value === undefined) {
		localStorage.removeItem(key);
		return;
	}

	// Wrapper object with type and data
	const wrapper = {
		type: value.constructor.name,
		data: value instanceof Map ? Array.from(value.entries()) :
			value instanceof Set ? Array.from(value) :
				value
	};
	localStorage.setItem(key, JSON.stringify(wrapper));
}

/**
 * Restores data from storage
 * @param {any} data - The data to convert
 * @param {string} type - The original data type
 * @returns {any} Converted data
 */
function restoreFromStorage(data, type) {
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
 * The RunInfo class keeps track of when a function was last executed and
 * at what interval it should be executed.
 */
export class RunInfo {
	/** @type {number} */
	static #DEFAULT_INTERVAL = 1000;

	/**
	 * Get the default interval for operations
	 * @returns {number} Default interval in milliseconds
	 */
	static get DEFAULT_INTERVAL() {
		return this.#DEFAULT_INTERVAL;
	}

	#defaultFunctionMap = new Map([
		['spider', {
			lastRun: Date.now() - 5 * 60 * 1000,  // 5 minutes ago
			interval: 100                          // Every 100ms
		}],
		['hacknet', {
			lastRun: Date.now() - 5 * 60 * 1000,  // 5 minutes ago
			interval: 5 * 60 * 1000               // Every 5 minutes
		}]
	]);
	#functionMap;

	constructor() {
		this.#functionMap = loadFromStorage(Defaults.storagePrefix + 'runInfo') || this.#defaultFunctionMap;
	}

	/**
	 * Returns the name of the operation that should be executed next
	 * @returns {string|null} Name of the next operation or null if none is due
	 */
	getNextOperation() {
		let nextOp = null;
		let earliestTime = Infinity;

		for (const [funcName, info] of this.#functionMap) {
			const nextRunTime = info.lastRun + info.interval;
			if (nextRunTime < earliestTime) {
				earliestTime = nextRunTime;
				nextOp = funcName;
			}
		}

		// Only return if the time has actually expired
		if (earliestTime <= Date.now()) {
			return nextOp;
		}
		return null;
	}

	/**
	 * Updates the timestamp of the last execution
	 * Creates a new operation mode if the name doesn't exist yet
	 * @param {string} functionName - Name of the function/operation mode
	 * @param {number} [interval] - Optional interval in milliseconds (default: DEFAULT_INTERVAL)
	 * @throws {Error} If a negative interval is passed
	 */
	updateLastRun(functionName, interval) {
		if (interval !== undefined && interval <= 0) {
			throw new Error(`Interval must be positive, was: ${interval}`);
		}

		const info = this.#functionMap.get(functionName) || { interval: RunInfo.#DEFAULT_INTERVAL };
		info.lastRun = Date.now();
		if (interval !== undefined) {
			info.interval = interval;
		}
		this.#functionMap.set(functionName, info);
		this.save();
	}

	/**
	 * Returns the information for a function
	 * @param {string} functionName - Name of the function
	 * @returns {{lastRun: number, interval: number}|null} Info object or null
	 */
	getInfo(functionName) {
		return this.#functionMap.get(functionName) || null;
	}

	/**
	 * Saves the current state in storage
	 */
	save() {
		saveToStorage(Defaults.storagePrefix + 'runInfo', this.#functionMap);
	}
}
