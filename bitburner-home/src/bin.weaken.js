/** @typedef {import("/types/customNS").NS} NS */

/**
 * WEAKEN Operation für einen Server.
 * @param {NS} ns The Netscript API
 */
export async function main(ns) {
	// args[0] - target (Server-Name)
	if (ns.args[0] === undefined || ns.args[0] === null) {
		throw new Error('Zielserver fehlt');
	}
	if (typeof ns.args[0] !== 'string') {
		throw new Error('Zielserver muss ein String sein');
	}
	const target = String(ns.args[0]);

	// args[1] - operationTime
	const operationTime = ns.args[1] !== undefined && ns.args[1] !== null ? Number(ns.args[1]) : undefined;
	if (operationTime !== undefined && operationTime <= 0) {
		throw new Error('operationTime muss größer als 0 sein');
	}

	// args[2] - endTime
	const endTime = ns.args[2] !== undefined && ns.args[2] !== null ? Number(ns.args[2]) : undefined;
	if (endTime !== undefined && endTime <= 0) {
		throw new Error('endTime muss größer als 0 sein');
	}

	// Wenn Zeiten angegeben, berechne Verzögerung
	if (operationTime !== undefined && endTime !== undefined) {
		const now = performance.now();
		const delay = Math.max(0, endTime - now - operationTime);
		await ns.weaken(target, { additionalMsec: delay });
	} else {
		// Sonst direkt weaken ausführen
		await ns.weaken(target);
	}
}
