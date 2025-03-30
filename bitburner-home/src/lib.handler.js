/** @ts-check */
/** @typedef {import("/types/NetscriptDefinitions").NS} NS */

import { Settings } from './lib.config.js';
import { Ansi } from './lib.format.js';

/**
 * Wrapper mit Logging und Error Handling
 * Sorgt auch dafür das das nächste modul gestartet wird, als fallback wird basis.js genommen
 */
export class Handler {
	/** @type {NS} */
	#ns;
	/** @type {string} */
	#name;
	/** @type {'debug'|'info'|'warn'|'error'} */
	#level;
	/** @type {string|undefined} */
	#nextModule;
	/** @type {{
		startTime: number,
		endTime: number,
		duration: number,
		ramUsage: number
	}} */
	#metrics;
	/** @type {boolean} */
	#testMode;

	/**
	 * Creates a new handler
	 * @param {NS} ns - Netscript API
	 * @param {Object} options - Configuration options
	 * @param {'debug'|'info'} [options.level='info'] - Log level
	 * @param {string} [options.nextModule] - Next module to execute
	 * @param {boolean} [options.testMode=false] - If true, don't chain to next module
	 */
	constructor(ns, options = {}) {
		this.#ns = ns;
		this.#name = ns.getScriptName()
			.replace(/^.*\//, '')     // Remove path
			.replace(/^mod\./, '')    // Remove "mod." prefix
			.replace(/\.js$/, '');    // Remove ".js" suffix

		this.#level = options.level || 'info';
		this.#nextModule = options.nextModule || 'basis.js';
		this.#testMode = options.testMode || false;

		// Initialize performance metrics
		this.#metrics = {
			startTime: 0,
			endTime: 0,
			duration: 0,
			ramUsage: ns.getScriptRam(ns.getScriptName())
		};

		// Activate debug mode if needed
		if (this.#level === 'debug') {
			Settings.setItem('wasDebug', true);
			ns.ui.openTail();
			ns.ui.resizeTail(1600, 600);
			ns.ui.moveTail(50, 50);
			this.debug('Debug mode activated');  // Zusätzliche Info im Log
		}
	}

	/**
	 * Executes a module function and tracks performance
	 * @param {(ns: NS, ctrl: Handler) => Promise<void>} moduleFunction - Module function to execute
	 * @returns {Promise<void>}
	 */
	async perform(moduleFunction) {
		try {
			this.ns.disableLog('ALL');
			// Capture metrics at start
			this.#metrics.startTime = performance.now();

			// Output start info
			this.info(`=== ${this.name} starting ===`);

			// Execute module
			await moduleFunction(this.ns, this);

			// Capture metrics at end
			this.#metrics.endTime = performance.now();
			this.#metrics.duration = this.#metrics.endTime - this.#metrics.startTime;

			// Output performance info
			this.info(`=== ${this.name} finished after ${this.#metrics.duration.toFixed(0)}ms ===`);
			if (this.#metrics.duration > 75) {
				this.info(`Script ran unusually long! RAM Usage: ${this.#metrics.ramUsage}GB`);
			}

			// Do we have a next module?
			if (this.#testMode) {
				this.debug('Test mode active - skipping next module');
				return;
			}

			// Check if the script exists
			if (!this.ns.fileExists(this.nextModule(), 'home')) {
				this.error(`Next script not found: ${this.nextModule()}`);
				return;
			}

			// RAM check before spawn
			const scriptRam = this.ns.getScriptRam(this.nextModule());
			const availableRam = Settings.reservedHomeRam;

			if (scriptRam > availableRam) {
				this.error(`Not enough RAM for ${this.nextModule()}! Required: ${scriptRam}GB, Available: ${availableRam}GB`);
			}

			// Output debug info to terminal if active
			if (Settings.wasDebug) {
				this.ns.tprint(`[${this.name}] Running next script: ${this.nextModule()}`);
			}
			this.info(`Running next script: ${this.nextModule()}`);

			await this.ns.spawn(this.nextModule(), { threads: 1, spawnDelay: Settings.spawnDelay });

		} catch (error) {
			this.#handleError(error);
		}
	}

	/**
	 * Handles errors that occurred
	 * @param {Error} error - Error that occurred
	 * @private
	 */
	#handleError(error) {
		const formatStack = (stack) => {
			if (!stack) return '';
			return '\n' + stack.split('\n')
				.map(line => line.trim())
				.filter(line => line.length > 0)
				.map(line => `    ${line}`)
				.join('\n');
		};

		const errorData = {
			type: error.name,
			message: error.message,
			stack: formatStack(error.stack),
			timestamp: new Date().toISOString()
		};

		// Use direct ANSI codes instead of formatter functions
		const errorHeader = `\n${Ansi.code(Ansi.fg(Ansi.std.RED))}ERROR in ${this.name}${Ansi.resetSeq()}`;
		const errorMessage = `${Ansi.code(Ansi.fg(Ansi.std.BRIGHT_RED))}${error.message}${Ansi.resetSeq()}`;
		const stackTrace = `${Ansi.code(Ansi.fg(Ansi.std.WHITE))}${errorData.stack}${Ansi.resetSeq()}`;

		// Format error message for terminal and log
		const terminalMsg = [
			errorHeader,
			errorMessage,
			stackTrace
		].join('\n');

		// Output to terminal and log
		this.ns.tprint(terminalMsg);
		this.#log('error', terminalMsg, errorData);
	}

	/**
	 * Sends a log message
	 * @param {'debug'|'info'|'warn'|'error'} level - Log level
	 * @param {string} message - Message
	 * @param {Object} [data] - Additional data
	 * @private
	 */
	#log(level, message, data = {}) {
		const timestamp = new Date().toISOString();
		const prefix = `[${timestamp}] [${this.name}] [${level}]`;

		// Level-specific formatting using direct ANSI codes
		let formattedPrefix;
		switch (level) {
			case 'error':
				formattedPrefix = `${Ansi.code(Ansi.fg(Ansi.std.RED))}${prefix}${Ansi.resetSeq()}`;
				break;
			case 'warn':
				formattedPrefix = `${Ansi.code(Ansi.fg(Ansi.std.YELLOW))}${prefix}${Ansi.resetSeq()}`;
				break;
			case 'debug':
				formattedPrefix = `${Ansi.code(Ansi.fg(Ansi.std.CYAN))}${prefix}${Ansi.resetSeq()}`;
				break;
			case 'info':
				formattedPrefix = `${Ansi.code(Ansi.fg(Ansi.std.WHITE))}${prefix}${Ansi.resetSeq()}`;
				break;
			default:
				throw new Error(`Invalid log level: ${level}`);
		}

		// Create formatted message
		const logMessage = `${formattedPrefix} ${message}`;

		// Level-specific output
		switch (level) {
			case 'error':
				this.ns.tprint(logMessage);
				break;
			case 'warn':
				this.ns.print(logMessage);
				this.ns.toast(message, 'warning');
				break;
			default: // debug and info
				this.ns.print(logMessage);
		}

		// Format and output additional data (only when not error)
		if (data && Object.keys(data).length > 0 && level !== 'error') {
			const dataString = JSON.stringify(data, null, 2)
				.split('\n')
				.map(line => `    ${line}`)
				.join('\n');
			this.ns.print(`${Ansi.code(Ansi.fg(Ansi.std.WHITE))}${dataString}${Ansi.resetSeq()}`);
		}
	}

	/**
	 * Get or set the next module to execute
	 * @param {string} [moduleName] - Optional module name to set
	 * @returns {string|undefined} - Current next module if called as getter
	 */
	nextModule(moduleName) {
		if (moduleName !== undefined) {
			this.debug(() => `Setting next module to: ${moduleName}`);
			this.#nextModule = moduleName;
		}
		return this.#nextModule;
	}

	/**
	 * Getter for Netscript API
	 * @returns {NS} Netscript API
	 */
	get ns() {
		return this.#ns;
	}

	/**
	 * Getter for the module name
	 * @returns {string} Name of the module
	 */
	get name() {
		return this.#name;
	}

	// Convenience methods for logging

	/**
	 * Debug-level logging with optional callback (lazy evaluation)
	 * @param {string | (() => string)} msgOrCallback - Message or callback
	 *
	 * @example:
	 * //direct evaluation
	 * this.debug(`easy output: ${data}`);
	 * //lazy evaluation
	 * this.debug(() => `Complex output: ${expensiveFunction()}`);
	 */
	debug(msgOrCallback) {
		if (this.#level === 'debug') {
			const msg = typeof msgOrCallback === 'function' ?
				msgOrCallback() : msgOrCallback;
			this.#log('debug', msg);
		}
	}

	/**
	 * Logs an info message
	 * @param {string} msg - Message to log
	 */
	info(msg) { this.#log('info', msg); }

	/**
	 * Logs a warning message
	 * @param {string} msg - Message to log
	 */
	warn(msg) { this.#log('warn', msg); }

	/**
	 * Throws an error with the given message
	 * @param {string} msg - Error message
	 * @throws {Error} Always throws an error with the provided message
	 */
	error(msg) { throw new Error(msg); }
}
