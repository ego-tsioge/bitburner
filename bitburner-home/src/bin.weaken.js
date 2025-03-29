/** @typedef {import("/types/NetscriptDefinitions").NS} NS */

/**
 * WEAKEN Operation für einen Server.
 * @param {NS} ns The Netscript API
 */
export async function main(ns) {
	const [target, operationTime, endTime] = ns.args;
	if (!target) throw new Error('Zielserver fehlt');

	// Wenn Zeiten angegeben, berechne Verzögerung
	if (operationTime && endTime) {
		const now = Date.now();
		const delay = Math.floor(Math.max(0, endTime - now - operationTime));
		await ns.weaken(target, { additionalMsec: delay });
	} else {
		// Sonst direkt schwächen
		await ns.weaken(target);
	}
}
