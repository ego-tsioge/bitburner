/** @typedef {import("/types/customNS").NS} NS */
/** @typedef {import("/types/servermodels").ServerData} ServerData */

/**
 * @fileoverview Crawler-Modul mit Methoden zur
 * - Netzwerkerkundung
 * - Botnet-erstellung
 * - Server-Datenabfrage und -persistierung
 *
 * This script requires 4.20GB of RAM to run for 1 thread(s)
  2.00GB | getServer (fn)
  1.60GB | baseCost (misc)
  0.20GB | scan (fn)
  0.10GB | fileExists (fn)
  0.05GB | brutessh (fn)
  0.05GB | ftpcrack (fn)
  0.05GB | relaysmtp (fn)
  0.05GB | httpworm (fn)
  0.05GB | sqlinject (fn)
  0.05GB | nuke (fn)
 */

import { Settings, saveToStorage } from '/src/lib.config.js';

/**
 * @param {NS} ns - Netscript API
 */
export async function main(ns) {

	const startTimestamp = performance.now();
	const options = ns.flags([
		['port', 0],
		['deployScripts', false],
	]);
	const listeningPort = Number(options.port);
	const servers = crawler(ns);

	// ─── servermap anlegen ───
	const serverMap = new Map();
	for (const server of servers) {
		const data = getServerData(ns, server);
		serverMap.set(server, data);


		// versuche bot zu requirieren
		if (!data.security.root) {
			const botResult = makeBot(ns, data);
		}
	}

	// ─── botnet erstellen ───
	const botnet = [];
	const binScripts = ["src/bin.hack.js", "src/bin.grow.js", "src/bin.weaken.js"];
	for (const [hostname, data] of serverMap.entries()) {
		if (data.security.root === true && data.ram.max > 0) {
			// wenn wir rootRechte haben und der server ram hat, dann im botnet aufnehmen
			botnet.push(hostname);
			// wenn gewünscht auch scripte auffrischen
			if (options.deployScripts) {
				ns.scp(binScripts, hostname, 'home');
			}
		}
	}

	// ─── daten schreiben ───
	saveToStorage(Settings.staticNetworkKey, serverMap);
	saveToStorage(Settings.botnetKey, botnet);


	// ─── ende ───
	if (listeningPort !== 0) {
		const timeDiff = performance.now() - startTimestamp;
		ns.writePort(listeningPort, timeDiff);

	}

}








// ======= Crawler ==============

/**
 * Crawler-Skript, das alle Server in der Netzwerk-Hierarchie als Array zurückgibt.
 * @param {NS} ns - Netscript API
 * @returns {string[]} - Liste aller Server
 */
export function crawler(ns) {
	const visited = new Set();	// merkzettel, wo wir schon waren (bei set kann man nicht ausversehen 2gleiche entitäten reinlegen)
	const heap = ['home'];		// der haufen der abgearbeitet werden soll, inkl. startpunkt

	while (heap.length > 0) {	// solange noch was auf dem haufen liegt ...
		const hostname = heap.pop();	// ... nehmen wir eines davon runter

		// hostnamen die wir schon kennen werden durch diesen if block ignoriert aka nicht noch einmal besucht
		if (!visited.has(hostname)) {	// wenn wir es noch nicht kennen ...
			visited.add(hostname);		// ... wird es gemerkt

			const neighbors = ns.scan(hostname);	// zusätzlich fragen wir noch welche nachbarn es kennt
			heap.push(...neighbors);				// und legen diese auf den haufen (damit wir keinen vergessen)
		}
	} // end while (haufen abgearbeitet)
	return Array.from(visited);
}

/**
 * Server-Daten aus ns.getServer abfragen und als einheitliches ServerData zurückgeben.
 * @param {NS} ns - Netscript API
 * @param {string} server - Servername
 * @returns {ServerData} - Alle Daten von ns.getServer(server), gruppiert
 */
export function getServerData(ns, server) {
	const d = ns.getServer(server);

	/** @type {ServerData} */
	const result = {
		hostname: d.hostname,
		isHome: d.hostname === 'home',
		ip: d.ip,
		cores: d.cpuCores,
		organization: d.organizationName ?? '',
		isPurchased: d.purchasedByPlayer,
		isConnectedTo: d.isConnectedTo,

		ports: {
			required: d.numOpenPortsRequired ?? 0,
			ssh: d.sshPortOpen,
			ftp: d.ftpPortOpen,
			smtp: d.smtpPortOpen,
			http: d.httpPortOpen,
			sql: d.sqlPortOpen,
			count: d.openPortCount ?? 0,
		},
		security: {
			hackSkillRequired: d.requiredHackingSkill ?? 0,
			base: d.baseDifficulty ?? 0,
			min: d.minDifficulty ?? 0,
			current: d.hackDifficulty ?? 0,
			backdoor: !!d.backdoorInstalled,
			root: d.hasAdminRights,
		},
		money: {
			max: d.moneyMax ?? 0,
			growth: d.serverGrowth ?? 0,
			available: d.moneyAvailable ?? 0,
		},
		ram: {
			max: d.maxRam,
			trueMax: d.maxRam,
			used: d.ramUsed,
			free: d.maxRam - d.ramUsed,
		},
		slots: {
			max: Math.floor(d.maxRam / 1.75),
			free: Math.floor((d.maxRam - d.ramUsed) / 1.75),
		},
	};

	return result;
}

// ======= Botnet ==============
/**
 * Botnet: Liste aller Server mit Root-Zugriff.
 * @param {NS} ns - Netscript API
 * @param {ServerData} server - Daten über einen Server
 * @returns {boolean} - true, wenn der Bot erfolgreich erstellt wurde, false sonst
 */
export function makeBot(ns, server) {
	if (server.security.root) {
		return true;
	}
	const cracker = {
		'ssh': { 'filename': 'BruteSSH.exe', 'function': ns.brutessh },
		'ftp': { 'filename': 'FTPCrack.exe', 'function': ns.ftpcrack },
		'smtp': { 'filename': 'relaySMTP.exe', 'function': ns.relaysmtp },
		'http': { 'filename': 'HTTPWorm.exe', 'function': ns.httpworm },
		'sql': { 'filename': 'SQLInject.exe', 'function': ns.sqlinject }
	};

	let portCount = 0;
	for (const key of Object.keys(cracker)) {
		const filename = cracker[key].filename;
		const portOpener = cracker[key].function;
		if (ns.fileExists(filename, 'home')) {
			if (portOpener(server.hostname)) {
				portCount++;
				server.ports[key] = true;
			}
		}
	}
	if (portCount >= server.ports.required) {
		if (ns.nuke(server.hostname)) {
			server.security.root = true;
			return true;
		}
	}
	return false;
}
