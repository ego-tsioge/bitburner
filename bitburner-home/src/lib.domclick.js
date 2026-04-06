/** @typedef {import("/types/customNS").NS} NS */

/**
 * @fileoverview DOM-Hacking: Simuliert UI-Klicks in der Bitburner React-App.
 *
 * Funktionen zum programmatischen Navigieren und Kaufen über die Spiel-UI,
 * ohne Singularity API. Nutzt document.querySelector + React Event-Handler.
 *
 * ACHTUNG: Diese Selektoren können bei Bitburner-Updates brechen.
 * Die Selektoren basieren auf Text-Inhalten, nicht auf CSS-Klassen.
 */

const doc = globalThis['document'];

/** @type {NS | null} */
let _ns = null;
async function sleep(ms) { _ns ? await _ns.sleep(ms) : await new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════
//  Generische DOM-Helfer
// ═══════════════════════════════════════════

/**
 * Findet ein Element anhand seines sichtbaren Text-Inhalts.
 * Sucht in allen Elementen des angegebenen Tags.
 *
 * @param {string} text - Gesuchter Text (exakt oder enthaltend)
 * @param {string} [tag='button'] - HTML-Tag zum Suchen
 * @param {boolean} [exact=false] - Exakter Match statt contains
 * @returns {HTMLElement | null}
 */
export function findByText(text, tag = 'button', exact = false) {
	const elements = doc.querySelectorAll(tag);
	for (const el of elements) {
		const content = el.textContent?.trim() ?? '';
		if (exact ? content === text : content.includes(text)) {
			return el;
		}
	}
	return null;
}

/**
 * Klickt ein Element an. Versucht zuerst den React-Handler,
 * fällt zurück auf native .click().
 *
 * @param {HTMLElement} element
 * @returns {boolean} true wenn Element gefunden und geklickt
 */
export function clickElement(element) {
	if (!element) return false;
	try {
		const reactKey = Object.keys(element).find(k => k.startsWith('__reactProps') || k.startsWith('__reactEvents'));
		if (reactKey && element[reactKey]?.onClick) {
			element[reactKey].onClick({ isTrusted: true });
		} else {
			element.click();
		}
		return true;
	} catch {
		return false;
	}
}

/**
 * Findet ein Element per Text und klickt es an.
 *
 * @param {string} text - Button-/Link-Text
 * @param {string} [tag='button'] - HTML-Tag
 * @returns {boolean} true wenn gefunden und geklickt
 */
export function clickByText(text, tag = 'button') {
	return clickElement(findByText(text, tag));
}

// ═══════════════════════════════════════════
//  Navigation
// ═══════════════════════════════════════════

/**
 * Navigiert zu einem Hauptmenü-Tab (z.B. "City", "Terminal", "Stats").
 * Die Sidebar hat MUI ListItems mit einem <p> das den Tab-Namen enthält.
 * Wir finden das <p> und klicken das umgebende ListItem (role="button").
 *
 * @param {string} tabName - Name des Tabs
 * @returns {boolean}
 */
export function navigateTo(tabName) {
	const label = findByText(tabName, 'p', true);
	if (!label) return false;
	const listItem = label.closest('[role="button"]');
	if (listItem) return clickElement(listItem);
	return clickElement(label);
}

// ═══════════════════════════════════════════
//  Kaufaktionen
// ═══════════════════════════════════════════

/**
 * Prüft ob der TOR-Router schon gekauft ist.
 * Sucht den Button und prüft auf "Purchased" / disabled.
 * Navigiert vorher zur City-Seite.
 *
 * @param {number} [delayMs=500] - Wartezeit für DOM-Rendering
 * @returns {Promise<boolean>} true wenn TOR bereits gekauft
 */
/**
 * Navigiert zu City → Alpha Enterprises (das "T" in der ASCII-Karte).
 * @param {number} [delayMs=500]
 * @returns {Promise<boolean>}
 */
async function goToAlphaEnterprises(delayMs = 500) {
	navigateTo('City');
	await sleep(delayMs);
	const marker = doc.querySelector('span[aria-label="Alpha Enterprises"]');
	if (!marker) return false;
	return clickElement(marker), await sleep(delayMs), true;
}

/**
 * Prüft ob der TOR-Router schon gekauft ist.
 * @param {number} [delayMs=500]
 * @returns {Promise<boolean>} true wenn TOR bereits gekauft
 */
export async function hasTor(delayMs = 500) {
	if (!await goToAlphaEnterprises(delayMs)) return false;
	const btn = findByText('Purchase TOR router', 'button');
	if (!btn) return false;
	return btn.disabled || btn.textContent?.includes('Purchased') || false;
}

/**
 * Kauft den TOR-Router.
 * City → Alpha Enterprises → "Purchase TOR router"
 *
 * @param {number} [delayMs=500]
 * @returns {Promise<boolean>} true wenn Kauf-Button gefunden und geklickt
 */
export async function buyTorRouter(delayMs = 500) {
	if (!await goToAlphaEnterprises(delayMs)) return false;
	const btn = findByText('Purchase TOR router', 'button');
	if (!btn || btn.disabled) return false;
	return clickElement(btn);
}

/**
 * Kauft ein Home-RAM-Upgrade.
 * City → Alpha Enterprises → "Upgrade 'home' RAM"
 *
 * @param {number} [delayMs=500]
 * @returns {Promise<boolean>} true wenn Upgrade-Button gefunden und geklickt
 */
export async function clickRamUpgrade(delayMs = 500) {
	if (!await goToAlphaEnterprises(delayMs)) return false;
	const btn = findByText("Upgrade 'home' RAM", 'button');
	if (!btn || btn.disabled) return false;
	return clickElement(btn);
}

/**
 * Navigiert zurück zum Terminal nach UI-Aktionen.
 * @param {number} [delayMs=500]
 */
export async function goToTerminal(delayMs = 500) {
	navigateTo('Terminal');
	await sleep(delayMs);
}

// ═══════════════════════════════════════════
//  Debug-Helfer
// ═══════════════════════════════════════════

/**
 * Listet alle sichtbaren Buttons/Links mit Text auf.
 * Nützlich zum Finden der richtigen Selektoren.
 *
 * @param {NS} ns - Für ns.tprint Ausgabe
 * @param {string} [tag='button'] - HTML-Tag zum Suchen
 */
export function debugListElements(ns, tag = 'button') {
	const elements = doc.querySelectorAll(tag);
	ns.tprint(`\n═══ ${elements.length} <${tag}> Elemente gefunden ═══`);
	for (const el of elements) {
		const text = el.textContent?.trim().substring(0, 80) ?? '(leer)';
		const classes = el.className?.substring(0, 40) ?? '';
		ns.tprint(`  "${text}" [${classes}]`);
	}
}

/** @param {NS} ns */
export async function main(ns) {
	_ns = ns;
	const action = ns.args[0] ?? 'debug';

	switch (action) {
		case 'tor':
			ns.tprint('Versuche TOR zu kaufen ...');
			ns.tprint(await buyTorRouter() ? '✅ TOR gekauft!' : '❌ TOR nicht kaufbar');
			await goToTerminal();
			break;
		case 'ram':
			ns.tprint('Versuche RAM-Upgrade ...');
			ns.tprint(await clickRamUpgrade() ? '✅ RAM upgraded!' : '❌ RAM nicht kaufbar');
			await goToTerminal();
			break;
		case 'check':
			ns.tprint('Prüfe TOR-Status ...');
			ns.tprint(await hasTor() ? '✅ TOR vorhanden' : '❌ Kein TOR');
			await goToTerminal();
			break;
		case 'debug':
		default:
			ns.tprint('DOM-Click Debug (Buttons auf aktueller Seite):');
			debugListElements(ns, 'button');
			ns.tprint('\nUsage: run src/lib.domclick.js [tor|ram|check|debug]');
			break;
	}
}
