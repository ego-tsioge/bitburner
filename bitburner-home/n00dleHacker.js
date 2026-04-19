/** @typedef {import("/types/customNS").NS} NS */
import { execTerminalCMD, runTerminalCMD, getTerminalLines, getLastTerminalResponse, RingBuffer, findByText, clickElement, buyTorRouter, clickRamUpgrade, goToAlphaEnterprises, goToTerminal } from '/src/lib.helper.js';
import { crawler, getServerData, makeBot } from '/src/mod.crawler.js';
import { operatorScripts } from '/src/lib.config.js';

/**
 * Hack-Shotgun + Terminal-Optimizer Prototyp.
 *
 * Strategie:
 * - Hack-Shotgun: feuert bin.hack.js mit allen Bots gleichzeitig aud das target
 * - Kompensation: grow/weaken via Terminal (~15x schneller als Script) --> skaliert am
 *   Anfang sehr gut auf n00dles, lohnt sich aber wohl nur die ersten 10min
 *
 * - INFO: kam in testläufen bei runde 500 auf ein plateu von 40k/s (pro Runde).
 *         SBH13 verspricht ab runde 9 schon ähnliche leistung, da kommt dieses script
 *         erst auf 14k/s.
 *
 * TODO: n00dleHacker
 *
 * @param {NS} ns
 */
export async function main(ns) {
	ns.ui.openTail();
	ns.ui.resizeTail(700, 600);
	ns.disableLog('ALL');
	ns.clearLog();

	const target = ns.args[0] ? String(ns.args[0]) : 'n00dles';

	// ═══════ Phase 1: Netzwerk & Botnet ═══════
	ns.print('═══════════════════════════════════════════');
	ns.print(' Phase 1: Netzwerk erkunden & Botnet');
	ns.print('═══════════════════════════════════════════');

	const servers = crawler(ns);
	const botnet = [];

	for (const hostname of servers) {
		const data = getServerData(ns, hostname);
		if (!data.security.root) makeBot(ns, data);
		if (data.security.root && data.ram.max > 0 && hostname !== 'home') {
			ns.scp(operatorScripts, hostname, 'home');
			botnet.push(hostname);
		}
	}

	if (!ns.hasRootAccess(target)) ns.nuke(target);
	if (!ns.hasRootAccess(target)) {
		ns.print(`❌ Kein Root auf ${target} – Abbruch.`);
		return;
	}

	const totalSlots = botnet.reduce((sum, h) => {
		const s = ns.getServer(h);
		return sum + Math.floor((s.maxRam - s.ramUsed) / 1.70);
	}, 0);

	ns.print(`\n🤖 Botnet: ${botnet.length} Bots, ~${totalSlots} Hack-Slots`);
	for (const h of botnet) {
		const s = ns.getServer(h);
		ns.print(`   ${h}: ${Math.floor((s.maxRam - s.ramUsed) / 1.70)} Slots`);
	}

	// ═══════ Phase 1b: Initiale Upgrades (TOR + Cracker + RAM) ═══════
	/** @type {{ hasTor: boolean, programs: {name:string, price:number, owned:boolean}[], ramCost: number, allCrackersBought: boolean }} */
	const upgradeCache = { hasTor: false, programs: [], ramCost: 0, allCrackersBought: false };
	await tryUpgrades(ns, target, botnet, upgradeCache);

	// ═══════ Phase 2: Terminal verbinden ═══════
	ns.print('\n═══════════════════════════════════════════');
	ns.print(` Phase 2: Terminal → ${target}`);
	ns.print('═══════════════════════════════════════════');

	runTerminalCMD('connect ' + target);
	await ns.sleep(500);
	ns.print(`🔗 Verbunden mit ${target}`);

	// ═══════ Phase 3: Main Loop ═══════
	ns.print('\n═══════════════════════════════════════════');
	ns.print(' Phase 3: Hack-Shotgun + Terminal-Optimizer');
	ns.print('═══════════════════════════════════════════');

	const weakenTimes = new RingBuffer(3);
	const growTimes = new RingBuffer(3);

	// Initiales Grow – Server nicht leer in die erste Runde schicken
	ns.print('\n🌱 Initiales Grow ...');
	const initT0 = performance.now();
	const initGrow = await execTerminalCMD(ns, 'grow', { timeout: 120000 });
	if (initGrow) {
		const initDur = performance.now() - initT0;
		const g = parseGrowResponse(initGrow);
		if (g) ns.print(`   +${g.growthPercent.toFixed(1)}%  Sec: ${g.secFrom} → ${g.secTo}  (${fmtTime(initDur)})`);
	}

	let round = 0;
	let totalMoney = 0;
	const scriptStart = performance.now();

	while (true) {
		round++;
		const roundStart = performance.now();
		const moneyBefore = ns.getPlayer().money;
		ns.print(`\n──── Runde ${round} ────`);

		// Schritt 1: minSec → kürzeste Flugzeit
		const secState = await terminalWeakenToMin(ns, weakenTimes, target, botnet);
		if (!secState) { ns.print('❌ Weaken fehlgeschlagen'); return; }

		// Schritt 2: Shotgun bei minSec abfeuern (hackTime frisch, da Skill steigen kann)
		const hackTimeApi = ns.getHackTime(target);
		const shot = fireHackShotgun(ns, target, botnet);
		const hackFiredAt = performance.now();
		const hackEndTime = hackFiredAt + hackTimeApi;
		ns.tprint(`🔫 SHOTGUN Runde ${round}: ${shot.threads} Threads, ${shot.pids.length} Bots`);
		ns.print(`\n🔫 Shotgun: ${shot.threads} Threads, ${shot.pids.length} Bots`);
		ns.print(`   Flugzeit: ~${fmtTime(hackTimeApi)}`);

		// Schritt 3: Flugzeit nutzen – growMax + minSec
		//   Polling: Terminal-Output UND PIDs in derselben Schleife
		let terminalOps = 0;
		let moneyMaxed = false;
		let hacksLanded = false;
		let hackLandingTime = 0;

		while (!hacksLanded) {
			const remaining = hackEndTime - performance.now();

			// Entscheiden was als nächstes im Terminal passiert
			let cmd = '';
			if (secState.current > secState.min) {
				cmd = 'weaken';
			} else if (!moneyMaxed) {
				cmd = 'grow';
			} else {
				// Server optimal → Timed Weaken: soll ~1s NACH Einschlag landen
				// avgWeaken enthält Polling-Overhead (~500ms), den rausrechnen
				const avgWeaken = avgTime(weakenTimes);
				const pollingOverhead = 5 * 100; // stableThreshold * pollInterval
				const actualWeakenTime = avgWeaken - pollingOverhead;
				const startIn = remaining - actualWeakenTime + 1000;
				if (startIn > 0) {
					ns.print(`   🎯 Timed Weaken in ${fmtTime(startIn)} (cmd ~${fmtTime(actualWeakenTime)}, Ziel: +1s nach Einschlag)`);
					// Warten mit PID-Polling
					const waitUntil = performance.now() + startIn;
					while (performance.now() < waitUntil) {
						if (checkPidsLanded(ns, shot.pids)) {
							hacksLanded = true;
							hackLandingTime = performance.now();
							break;
						}
						await ns.sleep(200);
					}
					if (hacksLanded) break;
				}
				cmd = 'weaken';
				ns.print('   🎯 Timed Weaken gestartet');
			}

			// Terminal-Befehl absetzen + nicht-blockierend pollen
			const result = await terminalCmdWithPidWatch(ns, cmd, shot.pids);
			terminalOps++;

			if (result.hacksLanded) {
				hacksLanded = true;
				hackLandingTime = result.landingTime;
			}

			// Terminal-Ergebnis auswerten
			if (result.response) {
				const dur = result.duration;
				if (cmd === 'weaken') {
					weakenTimes.enqueue(dur);
					const w = parseWeakenResponse(result.response);
					if (w) {
						secState.current = w.to;
						const label = moneyMaxed ? '🎯' : '⚔️ ';
						ns.print(`   ${label} Sec: ${w.from} → ${w.to}  (${fmtTime(dur)} ø${fmtTime(avgTime(weakenTimes))})`);
					}
				} else {
					growTimes.enqueue(dur);
					const g = parseGrowResponse(result.response);
					if (g) {
						secState.current = g.secTo;
						ns.print(`   🌱 +${g.growthPercent.toFixed(1)}%  Sec: ${g.secFrom} → ${g.secTo}  (${fmtTime(dur)} ø${fmtTime(avgTime(growTimes))})`);
						if (g.growthPercent < 100) {
							moneyMaxed = true;
							ns.print(`   💰 Geld ~voll (letzter Grow nur +${g.growthPercent.toFixed(1)}%)`);
						}
					}
				}
			}
		}

		// Schritt 4: Hacks gelandet – Auswertung
		const moneyAfter = ns.getPlayer().money;
		const roundMoney = moneyAfter - moneyBefore;
		totalMoney += roundMoney;
		const roundDuration = (performance.now() - roundStart) / 1000;
		const totalDuration = (performance.now() - scriptStart) / 1000;
		const moneyPerSec = roundMoney / roundDuration;

		const actualFlight = hackLandingTime - hackFiredAt;
		const flightDiff = Math.abs(actualFlight - hackTimeApi);

		ns.print(`\n💰 Runde ${round} abgeschlossen (${roundDuration.toFixed(0)}s)`);
		ns.print(`   $${ns.formatNumber(roundMoney)} diese Runde  ($${ns.formatNumber(moneyPerSec)}/s)`);
		ns.print(`   $${ns.formatNumber(totalMoney)} gesamt  ($${ns.formatNumber(totalMoney / totalDuration)}/s über ${totalDuration.toFixed(0)}s)`);
		if (flightDiff > 1000) {
			ns.print(`   Flugzeit-Δ: ${fmtTime(flightDiff)} (erwartet ${fmtTime(hackTimeApi)}, tatsächlich ${fmtTime(actualFlight)})`);
		}

		// Schritt 5: Upgrade-Check (TOR + Cracker + RAM + Botnet)
		const slotsBefore = countSlots(ns, botnet);
		await tryUpgrades(ns, target, botnet, upgradeCache);
		const slotsAfter = countSlots(ns, botnet);
		if (slotsAfter > slotsBefore) {
			ns.print(`\n🤖 Botnet: ${botnet.length} Bots, ${slotsBefore} → ${slotsAfter} Slots`);
		}
	}
}

// ═══════════════════════════════════════════
//  Terminal-Optimizer
// ═══════════════════════════════════════════

/**
 * Weaken bis Security am Minimum.
 * Entscheidet automatisch: Script-Batch (ns.exec, parallel) vs. Terminal (seriell).
 * Script-Batch wird gewählt wenn genug Threads da sind und es schneller geht.
 *
 * @param {NS} ns
 * @param {RingBuffer} weakenBuf - RingBuffer für Terminal-Weaken-Zeiten
 * @param {string} target
 * @param {string[]} botnet
 * @returns {Promise<{ current: number, min: number } | null>}
 */
async function terminalWeakenToMin(ns, weakenBuf, target, botnet) {
	// Erster Terminal-Weaken: State lesen
	const t0 = performance.now();
	const response = await execTerminalCMD(ns, 'weaken', { timeout: 120000 });
	if (!response) return null;
	const dur = performance.now() - t0;
	weakenBuf.enqueue(dur);
	const first = parseWeakenResponse(response);
	if (!first) return null;

	if (first.to <= first.min) {
		ns.print(`   ⚔️  Sec: ${first.from} → ${first.to} (min: ${first.min})  (${fmtTime(dur)})`);
		ns.print('   ✅ Security am Minimum');
		return { current: first.to, min: first.min };
	}

	const weakensNeeded = Math.ceil((first.to - first.min) / 0.05);
	const terminalTime = weakensNeeded * avgTime(weakenBuf);
	const scriptWeakenTime = ns.getWeakenTime(target);

	// Verfügbare Threads auf Bots zählen
	let availableThreads = 0;
	for (const h of botnet) {
		const s = ns.getServer(h);
		availableThreads += Math.floor((s.maxRam - s.ramUsed) / 1.75);
	}

	// (a) Script-Batch wenn schneller und genug Threads
	if (scriptWeakenTime < terminalTime && availableThreads >= weakensNeeded) {
		ns.print(`   ⚔️  Sec: ${first.from} → ${first.to} (min: ${first.min}) – ${weakensNeeded} Weakens nötig`);
		ns.print(`   ⚡ Batch-Weaken: ${weakensNeeded} Threads (${fmtTime(scriptWeakenTime)} statt ~${fmtTime(terminalTime)} terminal)`);

		// Weaken-Threads auf Bots verteilen
		const pids = [];
		let threadsLeft = weakensNeeded;
		for (const h of botnet) {
			if (threadsLeft <= 0) break;
			const s = ns.getServer(h);
			const free = Math.floor((s.maxRam - s.ramUsed) / 1.75);
			const t = Math.min(free, threadsLeft);
			if (t <= 0) continue;
			const pid = ns.exec('src/bin.weaken.js', h, t, target);
			if (pid > 0) { pids.push(pid); threadsLeft -= t; }
		}

		// Restliche Threads: Grow + Weaken im Verhältnis 12.5:1
		let remainingThreads = availableThreads - (weakensNeeded - threadsLeft);
		if (remainingThreads > 13) {
			const growThreads = Math.floor(remainingThreads * (12.5 / 13.5));
			const extraWeakenThreads = remainingThreads - growThreads;
			ns.print(`   ⚡ +${growThreads} Grow, +${extraWeakenThreads} Extra-Weaken Threads`);

			for (const h of botnet) {
				if (growThreads <= 0 && extraWeakenThreads <= 0) break;
				const s = ns.getServer(h);
				const free = Math.floor((s.maxRam - s.ramUsed) / 1.75);
				if (free <= 0) continue;
				// Grow
				const gt = Math.min(free, growThreads);
				if (gt > 0) {
					const pid = ns.exec('src/bin.grow.js', h, gt, target);
					if (pid > 0) pids.push(pid);
				}
				// Extra Weaken für rest vom Bot
				const wt = Math.min(free - gt, extraWeakenThreads);
				if (wt > 0) {
					const pid = ns.exec('src/bin.weaken.js', h, wt, target);
					if (pid > 0) pids.push(pid);
				}
			}
		}

		// Wartezeit nutzen: Terminal weaken/hack nebenbei (einzeilige Anzeige)
		const batchLog = ns.getScriptLogs();
		let termOps = 0;
		let termWeakens = 0;
		let termHacks = 0;
		let lastSec = first.to;
		const cmds = ['weaken', 'hack', 'weaken'];
		while (pids.some(pid => ns.isRunning(pid))) {
			const cmd = cmds[termOps % cmds.length];
			const r = await execTerminalCMD(ns, cmd, { timeout: 30000 });
			termOps++;
			if (r) {
				const w = parseWeakenResponse(r);
				if (w) { termWeakens++; lastSec = w.to; }
				if (cmd === 'hack') termHacks++;
			}
			ns.clearLog();
			ns.print(batchLog.join('\n'));
			ns.print(`   ⚡ Terminal nebenher: ${termWeakens}x weaken, ${termHacks}x hack – Sec: ${lastSec.toFixed(3)}`);
		}

		const finalSec = ns.getServerSecurityLevel(target);
		const minSec = ns.getServerMinSecurityLevel(target);
		ns.clearLog();
		ns.print(batchLog.join('\n'));
		ns.print(`   ⚡ Terminal nebenher: ${termWeakens}x weaken, ${termHacks}x hack`);
		ns.print(`   ✅ Batch fertig – Sec: ${finalSec.toFixed(3)} (min: ${minSec})`);
		return { current: finalSec, min: minSec };
	}

	// (b) Terminal-Weakens mit einzeiliger Fortschrittsanzeige
	ns.print(`   ⚔️  ${weakensNeeded} Terminal-Weakens nötig (~${fmtTime(terminalTime)})`);
	const logHistory = ns.getScriptLogs();
	let current = first.to;
	let min = first.min;
	let done = 0;

	while (current > min) {
		done++;
		ns.clearLog();
		ns.print(logHistory.join('\n'));
		ns.print(`   ⚔️  weaken ${done}/${weakensNeeded}  Sec: ${current.toFixed(3)} → ${min} ...`);

		const wt0 = performance.now();
		const wr = await execTerminalCMD(ns, 'weaken', { timeout: 120000 });
		if (!wr) return null;
		const wDur = performance.now() - wt0;
		weakenBuf.enqueue(wDur);
		const w = parseWeakenResponse(wr);
		if (!w) return null;
		current = w.to;
		min = w.min;

		ns.clearLog();
		ns.print(logHistory.join('\n'));
		ns.print(`   ⚔️  weaken ${done}/${weakensNeeded}  Sec: ${w.from} → ${current.toFixed(3)}  (${fmtTime(wDur)} ø${fmtTime(avgTime(weakenBuf))})`);
	}

	return { current, min };
}

// ═══════════════════════════════════════════
//  Nicht-blockierendes Terminal + PID-Polling
// ═══════════════════════════════════════════

/**
 * Führt einen Terminal-Befehl aus und pollt gleichzeitig:
 * - Terminal-Output (auf stabile Antwort warten)
 * - Hack-PIDs (Landung erkennen)
 *
 * @param {NS} ns
 * @param {string} cmd - Terminal-Befehl (z.B. 'weaken', 'grow')
 * @param {number[]} pids - Hack-PIDs zum Überwachen
 * @param {number} [pollInterval=100]
 * @param {number} [stableThreshold=5]
 * @returns {Promise<{ response: string|null, duration: number, hacksLanded: boolean, landingTime: number }>}
 */
async function terminalCmdWithPidWatch(ns, cmd, pids, pollInterval = 100, stableThreshold = 5) {
	const linesBefore = getTerminalLines()?.length ?? 0;
	runTerminalCMD(cmd);
	const t0 = performance.now();

	let lastResponse = '';
	let stableCount = 0;
	let newContentDetected = false;
	let hacksLanded = false;
	let landingTime = 0;

	const timeout = 120000;

	while (stableCount < stableThreshold) {
		await ns.sleep(pollInterval);

		if (!hacksLanded && checkPidsLanded(ns, pids)) {
			hacksLanded = true;
			landingTime = performance.now();
		}

		// Timeout: wenn Hacks gelandet + 5s Gnadenfrist, oder absolut nach 120s
		const elapsed = performance.now() - t0;
		if (hacksLanded && elapsed > (landingTime - t0) + 5000) break;
		if (elapsed > timeout) break;

		if (!newContentDetected) {
			const currentLines = getTerminalLines()?.length ?? 0;
			if (currentLines > linesBefore) {
				newContentDetected = true;
			} else {
				continue;
			}
		}

		const current = getLastTerminalResponse(cmd);
		if (current !== null && current.length > 0 && current === lastResponse) {
			stableCount++;
		} else {
			stableCount = 0;
			lastResponse = current ?? '';
		}
	}

	if (!hacksLanded && checkPidsLanded(ns, pids)) {
		hacksLanded = true;
		landingTime = performance.now();
	}

	return {
		response: lastResponse || null,
		duration: performance.now() - t0,
		hacksLanded,
		landingTime,
	};
}

/**
 * Prüft ob alle Hack-PIDs beendet sind.
 * @param {NS} ns
 * @param {number[]} pids
 * @returns {boolean}
 */
function checkPidsLanded(ns, pids) {
	return pids.length > 0 && pids.every(pid => !ns.isRunning(pid));
}

// ═══════════════════════════════════════════
//  Timing-Helfer
// ═══════════════════════════════════════════

/** Durchschnitt der Werte im RingBuffer (Fallback 15s wenn leer) */
function avgTime(buf) {
	if (buf.isEmpty()) return 15000;
	let sum = 0;
	for (const value of buf) {
		sum += value;
	}
	return sum / buf.count;
}

/** Millisekunden → "12.3s" */
function fmtTime(ms) {
	return (ms / 1000).toFixed(1) + 's';
}

/** Zählt freie Hack-Slots über alle Bots */
function countSlots(ns, botnet) {
	return botnet.reduce((sum, h) => {
		const s = ns.getServer(h);
		return sum + Math.floor(s.maxRam / 1.70);
	}, 0);
}

// ═══════════════════════════════════════════
//  Upgrade-System (TOR + Cracker + RAM)
// ═══════════════════════════════════════════

/**
 * Einheitlicher Upgrade-Check mit Cache.
 * Navigiert nur zu Alpha Enterprises / Terminal wenn nötig.
 * Merkt sich Preise und was schon gekauft wurde.
 *
 * @param {NS} ns
 * @param {string} target
 * @param {string[]} botnet
 * @param {{ hasTor: boolean, programs: {name:string, price:number, owned:boolean}[], ramCost: number, allCrackersBought: boolean }} cache
 */
async function tryUpgrades(ns, target, botnet, cache) {
	const money = ns.getPlayer().money;

	// Alle Cracker gekauft? Dann nur noch RAM checken
	if (cache.allCrackersBought) {
		await tryRamUpgradeFromCache(ns, cache, money);
		return;
	}

	// ── TOR prüfen/kaufen ──
	if (!cache.hasTor) {
		if (money < 200000) {
			ns.print(`   🌐 Kein TOR (braucht $200k, hast $${ns.formatNumber(money)})`);
			return;
		}
		// Prüfe via DOM ob TOR schon da
		await goToAlphaEnterprises(ns);
		const torBtn = findByText('Purchase TOR router', 'button');
		const alreadyOwned = torBtn && (torBtn.disabled || torBtn.textContent?.includes('Purchased'));

		if (alreadyOwned) {
			cache.hasTor = true;
		} else {
			ns.print('   🛒 Kaufe TOR-Router ...');
			if (torBtn && clickElement(torBtn)) {
				cache.hasTor = true;
				ns.print('   ✅ TOR-Router gekauft!');
				ns.tprint('✅ TOR-Router automatisch gekauft!');
			} else {
				await goToTerminal(ns);
				return;
			}
		}

		// RAM-Preis gleich mitlesen (wir sind schon auf der Seite)
		readRamPrice(cache);
		await goToTerminal(ns);
	}

	// ── Cracker-Preise einmalig laden ──
	if (cache.programs.length === 0) {
		const listing = await execTerminalCMD(ns, 'buy -l', { timeout: 10000 });
		if (listing && listing.includes('.exe')) {
			cache.programs = parseDarkwebListing(listing)
				.filter(p => p.isPortCracker)
				.map(p => ({ name: p.name, price: p.price, owned: p.owned }));
		}
	}

	// ── Bezahlbare Cracker kaufen ──
	const unbought = cache.programs.filter(p => !p.owned);
	if (unbought.length === 0) {
		cache.allCrackersBought = true;
		await tryRamUpgradeFromCache(ns, cache, money);
		return;
	}

	const affordable = unbought.filter(p => p.price <= money);
	if (affordable.length > 0) {
		ns.print('\n🌐 Darkweb:');
		for (const prog of affordable) {
			await execTerminalCMD(ns, `buy ${prog.name}`, { timeout: 10000 });
			prog.owned = true;
			ns.print(`   🛒 ${prog.name} gekauft`);
		}

		// Re-Crawl nach Kauf
		const servers = crawler(ns);
		for (const hostname of servers) {
			if (botnet.includes(hostname)) continue;
			const data = getServerData(ns, hostname);
			if (!data.security.root) makeBot(ns, data);
			if (data.security.root && data.ram.max > 0 && hostname !== 'home') {
				ns.scp(operatorScripts, hostname, 'home');
				botnet.push(hostname);
				ns.print(`   🤖 Neuer Bot: ${hostname}`);
			}
		}
	}

	// ── RAM-Upgrade ──
	await tryRamUpgradeFromCache(ns, cache, money);
}

/**
 * Liest den RAM-Upgrade-Preis vom Button-Text (wenn auf Alpha Enterprises Seite).
 * Format: "Upgrade 'home' RAM (32.00GB -> 64.00GB) - $10.083m"
 */
function readRamPrice(cache) {
	const btn = /** @type {HTMLButtonElement | null} */ (findByText("Upgrade 'home' RAM", 'button'));
	if (!btn) { cache.ramCost = Infinity; return; }
	if (btn.disabled) { cache.ramCost = Infinity; return; }

	const text = btn.textContent ?? '';
	const m = text.match(/\$([\d.]+)([kmb]?)/i);
	if (!m) { cache.ramCost = Infinity; return; }
	let price = parseFloat(m[1]);
	if (m[2] === 'k') price *= 1000;
	else if (m[2] === 'm') price *= 1000000;
	else if (m[2] === 'b') price *= 1000000000;
	cache.ramCost = price;
}

/**
 * RAM-Upgrade wenn Cache-Preis bezahlbar ist.
 * Navigiert nur wenn wir uns den Kauf leisten können.
 * @param {NS} ns
 * @param {{ ramCost: number }} cache
 * @param {number} money
 */
async function tryRamUpgradeFromCache(ns, cache, money) {
	if (cache.ramCost === 0 || money < cache.ramCost) return;

	const ramBefore = ns.getServerMaxRam('home');
	ns.print(`\n💾 RAM-Upgrade ($${ns.formatNumber(cache.ramCost)}) ...`);
	const success = await clickRamUpgrade(ns);

	if (success) {
		// Preis für nächstes Upgrade lesen (wir sind auf der Seite)
		readRamPrice(cache);
		await goToTerminal(ns);
		const ramAfter = ns.getServerMaxRam('home');
		ns.print(`   ✅ Home-RAM: ${ramBefore}GB → ${ramAfter}GB (nächstes: $${ns.formatNumber(cache.ramCost)})`);
		ns.tprint(`✅ Home-RAM: ${ramBefore}GB → ${ramAfter}GB`);
	} else {
		await goToTerminal(ns);
	}
}

/**
 * Parst die Ausgabe von `buy -l`.
 * Jede Zeile hat Format: "ProgramName.exe - $PREIS - Beschreibung"
 * oder: "ProgramName.exe - [OWNED] - Beschreibung"
 * Port-Cracker erkannt an "Opens up ... Ports" in der Beschreibung.
 *
 * @param {string} listing
 * @returns {{ name: string, price: number, owned: boolean, isPortCracker: boolean }[]}
 */
function parseDarkwebListing(listing) {
	const programs = [];
	for (const line of listing.split('\n')) {
		const m = line.match(/^(\S+\.exe)\s+-\s+(.+?)\s+-\s+(.+)/);
		if (!m) continue;
		const name = m[1];
		const priceStr = m[2].trim();
		const desc = m[3].trim();
		const isPortCracker = desc.includes('Opens up') && desc.includes('Ports');
		if (priceStr === '[OWNED]') {
			programs.push({ name, price: Infinity, owned: true, isPortCracker });
		} else {
			const cleaned = priceStr.replace(/[$,]/g, '');
			let price = parseFloat(cleaned);
			if (priceStr.endsWith('k')) price *= 1000;
			else if (priceStr.endsWith('m')) price *= 1000000;
			else if (priceStr.endsWith('b')) price *= 1000000000;
			programs.push({ name, price, owned: false, isPortCracker });
		}
	}
	return programs;
}

// ═══════════════════════════════════════════
//  Hack-Shotgun
// ═══════════════════════════════════════════

/**
 * Feuert bin.hack.js auf allen Bots mit maximalem Thread-Count.
 * Gibt Threads und PIDs zurück (ein PID pro Bot reicht zum Tracken,
 * da alle Threads auf einem Bot gleichzeitig starten/landen).
 *
 * @param {NS} ns
 * @param {string} target
 * @param {string[]} botnet
 * @returns {{ threads: number, pids: number[] }}
 */
function fireHackShotgun(ns, target, botnet) {
	let threads = 0;
	const pids = [];
	for (const hostname of botnet) {
		const server = ns.getServer(hostname);
		const freeRam = server.maxRam - server.ramUsed;
		const t = Math.floor(freeRam / 1.70);
		if (t <= 0) continue;

		const pid = ns.exec('src/bin.hack.js', hostname, t, target);
		if (pid > 0) {
			threads += t;
			pids.push(pid);
		}
	}
	return { threads, pids };
}

// ═══════════════════════════════════════════
//  Terminal Output Parser
// ═══════════════════════════════════════════

/**
 * Parst die Terminal-Antwort eines weaken-Befehls.
 * Erwartetes Format:
 *   Security decreased on '...' by X from Y to Z (min: M) and Gained E hacking exp.
 *
 * @param {string} response
 * @returns {{ decrease: number, from: number, to: number, min: number } | null}
 */
function parseWeakenResponse(response) {
	const m = response.match(
		/Security decreased.*?by ([\d.]+) from ([\d.]+) to ([\d.]+).*?min: ([\d.]+)/
	);
	if (!m) return null;
	return {
		decrease: parseFloat(m[1]),
		from: parseFloat(m[2]),
		to: parseFloat(m[3]),
		min: parseFloat(m[4]),
	};
}

/**
 * Parst die Terminal-Antwort eines grow-Befehls.
 * Erwartetes Format:
 *   ... grown by X% ...
 *   Security increased ... from Y to Z ...
 *
 * @param {string} response
 * @returns {{ growthPercent: number, secFrom: number, secTo: number } | null}
 */
function parseGrowResponse(response) {
	const gm = response.match(/grown by ([\d,.]+)%/);
	if (!gm) return null;
	const sm = response.match(/Security increased.*?from ([\d.]+) to ([\d.]+)/);
	return {
		growthPercent: parseFloat(gm[1].replace(/,/g, '')),
		secFrom: sm ? parseFloat(sm[1]) : 0,
		secTo: sm ? parseFloat(sm[2]) : 0,
	};
}
