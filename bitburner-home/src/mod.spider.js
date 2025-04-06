/** @ts-check */
/** @typedef {import("/types/NetscriptDefinitions").NS} NS */
/** @typedef {import("/types/egoDataTypes.js").ServerData} ServerData */

import { portHackerSet, saveToStorage, Settings, operatorScripts } from './lib.config.js';
import { Handler } from './lib.handler.js';

/**
 * Main: Haupteinstiegspunkt für die Datei - startet nur den wrapper vom Handler
 *
 * @param {NS} ns */
export async function main(ns) {
	const handler = new Handler(ns, { level: 'info' });
	await handler.perform(executeSpider);
}

/**
 * Spider-Modul: Scannt das Netzwerk nach verfügbaren Servern und legt diese Daten
 * im LocalStorrage ab.
 * @param {NS} ns - Netscript API
 * @param {Handler} logger - Handler für Logging und Fehlerbehandlung
 */
export function executeSpider(ns, logger) {
	// Verfügbare portHacker ermitteln
	const portHacker = portHackerSet.filter(crack => ns.fileExists(crack));
	logger.info(`Verfügbare Port-Hacker: ${portHacker.join(', ')}`);

	// Basis-Datenstrukturen für Netzwerk-Scanning
	const toVisitStack = ['home'];	// der haufen der abgearbeitet werden soll
	const botNet = new Map();		// unsere Arbeitstiere (Bots)
	const networkMap = new Map();	// unsere netzwerkkarte, merkt zu jedem server seine zugehörigen verbindungen

	// Hauptschleife: Scanne alle erreichbaren Server
	while (toVisitStack.length > 0) {				// solange noch was auf dem Haufen liegt
		const hostname = toVisitStack.pop();		// nehme den nächsten Server vom Haufen

		if (!networkMap.has(hostname)) {						// wenn wir den Server noch nicht besucht haben
			logger.debug(() => `Scanning server: ${hostname}`);

			const serverData = peekIntoServer(ns, logger, hostname); 	// Sammle die Serverdaten ein

			if (make2Bot(ns, logger, serverData, portHacker)) {			// prüfe ob 'hostname' schon ein bot ist oder dazu gemacht werden kann
				logger.debug(() => `Root-Zugriff vorhanden: ${hostname}`);
				botNet.set(hostname, serverData);						// merke den Server als bot in BotNet
				deployHackScripts(ns, logger, hostname);				// kopiere die neuesten operatoren (bin.*.js) dahin
				logger.debug(() => `Skripte auf ${hostname} deployed`);
			} else {
				logger.debug(() => `Kein Root-Zugriff möglich auf ${hostname} (Level: ${serverData.neededLevel}, Ports: ${serverData.requiredPorts})`);
			}

			networkMap.set(hostname, ns.scan(hostname));				// merke die Verbindungen dieses Servers in networkMap
			logger.debug(() => `Gefundene Verbindungen von ${hostname}: ${networkMap.get(hostname).join(', ')}`);
			toVisitStack.push(...networkMap.get(hostname));				// lege die gleichen verbindungen auf den Haufen
		} // end if (server noch nicht besucht)
	} // end Hauptschleife

	logger.info(`Scan abgeschlossen. BotNet-Größe: ${botNet.size} Server`);
	saveToStorage(Settings.botnetKey, botNet);
	saveToStorage(Settings.mapKey, networkMap);
} // end executeSpider (hauptmodul)

/**
 * Sammelt die Daten für den server 'hostname'
 *
 * @param {NS} ns - Netscript API
 * @param {Handler} logger - Handler für Logging und Fehlerbehandlung
 * @param {String} hostname - Name des Servers
 * @return {ServerData} Die gesammelten Server-Daten
 * @throws {Error} Wenn der Server nicht existiert (von ns.getServer)
 */
function peekIntoServer(ns, logger, hostname) {
	const data = ns.getServer(hostname);

	const isHome = data.hostname === 'home';
	const scriptRam = ns.getScriptRam(ns.getScriptName());
	const usedRam = Math.max(0, isHome ? data.usedRam - scriptRam : data.ramUsed);
	const trueMax = data.maxRam;
	const maxRam = Math.max(0, isHome ? trueMax - Settings.reservedHomeRam : trueMax);
	const freeRam = Math.max(0, maxRam - usedRam);

	/** @type ServerData  */
	const result = {
		id: data.hostname,
		isHome: isHome,
		neededLevel: data.requiredHackingSkill,
		hasRootAccess: data.hasAdminRights,
		backdoor: data.backdoorInstalled,
		purchased: data.purchasedByPlayer,
		slots: {
			max: Math.floor(maxRam / 1.75),
			free: Math.floor(freeRam / 1.75)
		},
		ram: {
			trueMax: trueMax,
			used: usedRam,
			max: maxRam,
			free: freeRam
		},
		requiredPorts: data.numOpenPortsRequired,
		security: {
			level: data.securityLevel,
			min: data.minSecurityLevel
		},
		money: {
			available: data.moneyAvailable,
			max: data.maxMoney,
			growth: data.serverGrowth
		},
		time: {
			hack: data.hackTime,
			grow: data.growTime,
			weaken: data.weakenTime
		},
		gainPerHack: ns.hackAnalyze(hostname)
	}

	logger.debug(() => `Server ${hostname}: Level=${result.neededLevel}, Ports=${result.requiredPorts}, RAM=${result.ram.max}GB`);
	return result;
} // end peekIntoServer

/**
 * Versucht den Server als Bot (arbeitsserver) zu requirieren.
 * Wenn der Server bereits ein Bot ist, wird auch true zurückgegeben.
 *
 * @param {NS} ns - Netscript API
 * @param {Handler} logger - Handler für Logging und Fehlerbehandlung
 * @param {ServerData} server - Daten des Servers
 * @param {String[]} portHacker - Liste der verfügbaren Port-Hacker
 * @return {boolean} True: wenn der Server ein Bot ist (auch wenns ganz frisch ist)
 */
function make2Bot(ns, logger, server, portHacker) {
	if (server.hasRootAccess) {
		logger.debug(`Server ${server.id} bereits im BotNet, early 'return true'`);
		return true;
	}

	// wenn wir genug cracks für den Server haben, ...
	if (server.requiredPorts <= portHacker.length) {
		// ... prüfe noch das Hacking-Level ...
		if (ns.getHackingLevel() >= server.neededLevel) {
			// ... und öffne alle verfügbaren Ports
			for (const crack of portHacker) {
				logger.debug(`Nutze ${crack} auf ${server.id}`);
				ns[crack.toLowerCase().slice(0, -4)](server.id);
			}
			logger.debug(`NUKE (nach Cracks) auf ${server.id}`);
			ns.nuke(server.id);
			return true;
		}
	}

	// Direkter NUKE bei Servern ohne Port-Anforderungen (das hat den Vorteil, dass man
	// Server aquirieren kann die ein höheres Hacking-Level haben - als Bot ganz nützlich)
	if (server.requiredPorts === 0) {
		logger.debug(`Direkter NUKE (ohne Cracks) auf ${server.id}`);
		ns.nuke(server.id);
		return true;
	}

	return false;  // Kein Zugriff möglich (zu wenig Ports oder Level-Beschränkung)
} // end make2bot

/**
 * kopiert unsere oparatoren bin.*.js auf den Server 'hostname'
 * @param {NS} ns
 * @param {Handler} logger
 * @param {String} hostname
 * @returns {boolean} true wenn alle Skripte erfolgreich kopiert wurden
 */
function deployHackScripts(ns, logger, hostname) {
	logger.debug(`Deploye Skripte auf ${hostname}: ${operatorScripts.join(', ')}`);

	let result = true;
	for (const script of operatorScripts) {
		const lineResult = ns.scp(script, hostname, 'home');
		if (!lineResult) {
			logger.warn(`${script} konnte nicht auf ${hostname} kopiert werden`)
		}
		result = result && lineResult;
	}
	return result;
} // end deployHackScripts
