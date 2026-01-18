/** @typedef {import("/types/NetscriptDefinitions").NS} NS */

import { throwError } from './lib.helper.js';

/**
 * HACK Operation für einen Server.
 * @param {NS} ns The Netscript API
 */
export async function main(ns) {
	// args[0] - target (Server-Name)
	if (ns.args[0] === undefined || ns.args[0] === null) {
		throwError('Zielserver fehlt', 'VALIDATION_ERROR');
	}
	if (typeof ns.args[0] !== 'string') {
		throwError('Zielserver muss ein String sein', 'VALIDATION_ERROR');
	}
	const target = String(ns.args[0]);

	// args[1] - operationTime
	const operationTime = ns.args[1] !== undefined && ns.args[1] !== null ? Number(ns.args[1]) : undefined;
	if (operationTime !== undefined && operationTime <= 0) {
		throwError('operationTime muss größer als 0 sein', 'VALIDATION_ERROR');
	}

	// args[2] - endTime
	const endTime = ns.args[2] !== undefined && ns.args[2] !== null ? Number(ns.args[2]) : undefined;
	if (endTime !== undefined && endTime <= 0) {
		throwError('endTime muss größer als 0 sein', 'VALIDATION_ERROR');
	}

	// Wenn Zeiten angegeben, berechne Verzögerung
	if (operationTime !== undefined && endTime !== undefined) {
		const now = performance.now();
		const delay = Math.max(0, endTime - now - operationTime);
		await ns.hack(target, { additionalMsec: delay });
	} else {
		// Sonst direkt hack ausführen
		await ns.hack(target);
	}
}
