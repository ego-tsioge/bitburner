/** @typedef {import("/types/NetscriptDefinitions").NS} NS */

/**
 * WEAKEN Operation für einen Server.
 * @param {NS} ns The Netscript API
 */
export async function main(ns) {
	const args = ns.args;
	/** @type {string} */
	const target = String(args[0]);
	/** @type {number|undefined} */
	const operationTime = args[1] ? Number(args[1]) : undefined;
	/** @type {number|undefined} */
	const endTime = args[2] ? Number(args[2]) : undefined;

	if (!target) throw new Error('Zielserver fehlt');

	// Wenn Zeiten angegeben, berechne Verzögerung
	if (operationTime && endTime) {
		const now = performance.now();
		const delay = Math.max(0, endTime - now - operationTime);
		await ns.weaken(target, { additionalMsec: delay });
	} else {
		// Sonst direkt weaken ausführen
		await ns.weaken(target);
	}
}
