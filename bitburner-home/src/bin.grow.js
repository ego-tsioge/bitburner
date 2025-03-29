/** @ts-check */
/** @typedef {import("/types/NetscriptDefinitions").NS} NS */

/**
 * GROW Operation für einen Server. test6
 * @param {NS} ns The Netscript API
 */
export async function main(ns) {
	const [target, operationTime, endTime] = ns.args;
	if (!target) throw new Error('Zielserver fehlt');

	// Wenn Zeiten angegeben, berechne Verzögerung
	if (operationTime && endTime) {
		const now = Date.now();
		const delay = Math.floor(Math.max(0, endTime - now - operationTime));
		await ns.grow(target, { additionalMsec: delay });
	} else {
		// Sonst direkt wachsen
		await ns.grow(target);
	}
}
