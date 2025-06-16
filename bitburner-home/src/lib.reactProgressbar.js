/** @typedef {import("/types/NetscriptDefinitions").NS} NS */

const React = globalThis["React"];
if (!React || !React.useState || !React.useEffect || !React.createElement) {
	throw new Error("React oder notwendige Hooks (useState, useEffect, createElement) nicht gefunden.");
}
const { useState, useEffect, createElement } = React;

// ProgressBar Konfigurationen
const progressBarConfigs = {
	gradient: {
		container: {
			backgroundColor: '#111'
		},
		progress: {
			background: 'linear-gradient(90deg, #ff0000, #00ff00)'
		},
		text: {}
	},
	rounded: {
		container: {
			backgroundColor: '#111',
			borderRadius: '10px',
			overflow: 'hidden'
		},
		progress: {
			backgroundColor: '#4CAF50',
			borderRadius: '10px'
		},
		text: {}
	},
	thin: {
		container: {
			position: 'absolute',
			top: '50%',
			left: 0,
			width: '100%',
			height: '2px',
			backgroundColor: '#111',
			transform: 'translateY(-50%)'
		},
		progress: {
			position: 'absolute',
			top: '50%',
			left: 0,
			height: '2px',
			backgroundColor: '#4CAF50',
			transform: 'translateY(-50%)'
		},
		text: {}
	}
};

/**
 * Container-Komponente für die ProgressBar-Ausgabe
 */
function ProgressContainer({ children, width = '300px' }) {
	return createElement('div', {
		style: {
			width,
			position: 'relative',
			height: '20px'
		}
	}, children);
}

/**
 * HTML5 Progress Bar
 */
function HTML5ProgressBar({ progress, label }) {
	return createElement('div', { style: { width: '100%', height: '100%', position: 'relative' } },
		createElement('progress', {
			value: progress,
			max: 1,
			style: {
				width: '100%',
				height: '100%',
				backgroundColor: '#111',
				color: '#4CAF50'
			}
		}),
		createElement('div', {
			style: {
				position: 'absolute',
				top: 0,
				left: 0,
				width: '100%',
				height: '100%',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				color: 'white',
				fontFamily: 'monospace',
				fontSize: '12px',
				pointerEvents: 'none'
			}
		}, `${label}: ${Math.round(progress * 100)}%`)
	);
}

/**
 * Generische ProgressBar-Komponente
 */
function GenericProgressBar({ progress, label, config }) {
	return createElement('div', { style: { width: '100%', height: '100%', position: 'relative' } },
		createElement('div', {
			style: {
				position: 'absolute',
				top: 0,
				left: 0,
				width: '100%',
				height: '100%',
				...config.container
			}
		}),
		createElement('div', {
			style: {
				position: 'absolute',
				top: 0,
				left: 0,
				width: `${progress * 100}%`,
				height: '100%',
				...config.progress
			}
		}),
		createElement('div', {
			style: {
				position: 'absolute',
				top: 0,
				left: 0,
				width: '100%',
				height: '100%',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				color: 'white',
				fontFamily: 'monospace',
				fontSize: '12px',
				pointerEvents: 'none',
				...config.text
			}
		}, `${label}: ${Math.round(progress * 100)}%`)
	);
}

/**
 * React-Komponente für einen Fortschrittsbalken
 * @param {Object} props
 * @param {number} props.targetTime - Zeitstempel, zu dem der Balken voll sein soll
 * @param {number} props.duration - Gesamtdauer in Millisekunden
 * @param {string} [props.label='Warte'] - Beschriftung des Balkens
 * @param {string} [props.variant='html5'] - Variante des Balkens ('html5', 'gradient', 'rounded', 'thin', 'custom')
 * @param {string} [props.width='300px'] - Breite des Balkens
 * @param {Object} [props.customConfig] - Benutzerdefinierte Konfiguration für die 'custom' Variante
 */
function reactProgressbar({ targetTime, duration, label = 'Warte', variant = 'html5', width = '300px', customConfig = null }) {
	// Berechne den initialen Fortschritt direkt
	const initialProgress = Math.min(1, 1 - (targetTime - performance.now()) / duration);
	const [progress, setProgress] = useState(initialProgress);

	useEffect(() => {
		const updateInterval = 50; // Häufigere Updates für flüssigere Animation

		const updateProgress = () => {
			const now = performance.now();
			const remaining = Math.max(0, targetTime - now);
			const newProgress = Math.min(1, 1 - remaining / duration);

			setProgress(newProgress);

			if (remaining > 0) {
				setTimeout(updateProgress, updateInterval);
			} else {
				setProgress(1);
			}
		};

		updateProgress();

		return () => {
			// Cleanup
		};
	}, [targetTime, duration]);

	const config = variant === 'custom' ? customConfig : progressBarConfigs[variant];
	const ProgressBarComponent = variant === 'html5' ? HTML5ProgressBar :
		(props) => createElement(GenericProgressBar, { ...props, config });

	return createElement(ProgressContainer, { width },
		createElement(ProgressBarComponent, { progress, label })
	);
}

/**
 * Erstellt eine ProgressBar-Komponente für ns.printRaw.
 * Die Komponente wird sofort gerendert.
 * Wenn wait=true, wartet die Funktion die angegebene Zeit.
 *
 * @param {NS} ns - Netscript API
 * @param {number} milliseconds - Wartezeit in Millisekunden
 * @param {string} [label='Warte'] - Beschriftung des Balkens
 * @param {string} [variant='rounded'] - Variante des Balkens ('html5', 'gradient', 'rounded', 'thin', 'custom')
 * @param {string} [width='400px'] - Breite des Balkens
 * @param {boolean} [wait=false] - Ob die Funktion warten soll
 * @param {Object} [customConfig] - Benutzerdefinierte Konfiguration für die 'custom' Variante
 */
export async function logProgressbar(ns, milliseconds, label = 'Warte', variant = 'rounded', width = '400px', wait = false, customConfig = null) {
	const targetTime = performance.now() + milliseconds;
	const component = createElement(reactProgressbar, {
		targetTime,
		duration: milliseconds,
		label,
		variant,
		width,
		customConfig
	});

	ns.printRaw(component);
	if (wait) {
		await ns.sleep(milliseconds);
	}
}

/**
 * Erstellt eine ProgressBar-Komponente für ns.tprintRaw.
 * Die Komponente wird sofort gerendert.
 * Wenn wait=true, wartet die Funktion die angegebene Zeit.
 *
 * @param {NS} ns - Netscript API
 * @param {number} milliseconds - Wartezeit in Millisekunden
 * @param {string} [label='Warte'] - Beschriftung des Balkens
 * @param {string} [variant='html5'] - Variante des Balkens ('html5', 'gradient', 'rounded', 'thin', 'custom')
 * @param {string} [width='300px'] - Breite des Balkens
 * @param {boolean} [wait=false] - Ob die Funktion warten soll
 * @param {Object} [customConfig] - Benutzerdefinierte Konfiguration für die 'custom' Variante
 */
export async function tProgressbar(ns, milliseconds, label = 'Warte', variant = 'rounded', width = '400px', wait = false, customConfig = null) {
	const targetTime = performance.now() + milliseconds;
	const component = createElement(reactProgressbar, {
		targetTime,
		duration: milliseconds,
		label,
		variant,
		width,
		customConfig
	});

	ns.tprintRaw(component);
	if (wait) {
		await ns.sleep(milliseconds);
	}
}

/** @param {NS} ns */
export async function main(ns) {
	ns.tprint("####### Progressbar Demo wird gestartet... \n\n");

	await ns.sleep(1000);

	// HTML5 Variante
	ns.tprintRaw("HTML5 Demo 2s - wartet nicht");
	await tProgressbar(ns, 2000, 'HTML5 Demo', 'html5', '200px');
	ns.tprintRaw("HTML5 Demo abgeschlossen!\n\n");

	// Gradient Variante
	ns.tprintRaw("Gradient Demo 3s - wartet nicht");
	await tProgressbar(ns, 3000, 'Gradient Demo', 'gradient', '300px');
	ns.tprintRaw("Gradient Demo abgeschlossen!\n\n");

	// Rounded Variante
	ns.tprintRaw("Rounded Demo 4,5s - wartet");
	await tProgressbar(ns, 4500, 'Rounded Demo', 'rounded', '450px', true);
	ns.tprintRaw("Rounded Demo abgeschlossen!\n\n");

	await ns.sleep(1000);

	// Thin Variante
	ns.tprintRaw("Thin Demo 2s - wartet");
	await tProgressbar(ns, 2000, 'Thin Demo', 'thin', '400px', true);
	ns.tprintRaw("Thin Demo abgeschlossen!\n\n");

	await ns.sleep(1000);

	// Custom Variante
	const customConfig = {
		container: {
			backgroundColor: '#2c3e50',
			borderRadius: '5px',
			border: '1px solid #34495e'
		},
		progress: {
			backgroundColor: '#e74c3c',
			borderRadius: '5px'
		},
		text: {
			color: '#ecf0f1',
			fontWeight: 'bold'
		}
	};
	ns.tprintRaw("Custom Demo 2s - wartet");
	await tProgressbar(ns, 2000, 'Custom Demo', 'custom', '400px', true, customConfig);
	ns.tprintRaw("Custom Demo abgeschlossen!\n\n");

	ns.tprint("####### Demo abgeschlossen!");
}
