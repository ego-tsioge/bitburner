/** @typedef {import("/types/NetscriptDefinitions").NS} NS */

/**
 * WEAKEN Operation für einen Server.
 * @param {NS} ns The Netscript API
 */
export async function main(ns) {
	// --- Start: Validation Check ---
	if (ns.args.includes("--validation")) {
		// Optional: Eine kurze Meldung ausgeben, dass die Validierung erkannt wurde.
		// ns.tprint(`Validation check for ${ns.getScriptName()}... OK.`);
		return; // Beendet das Skript sofort, wenn das Flag vorhanden ist.
	}
	// --- Ende: Validation Check ---
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
