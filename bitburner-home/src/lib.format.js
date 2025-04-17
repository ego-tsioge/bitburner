/** @ts-check */
/** @typedef {import("/types/NetscriptDefinitions").NS} NS */

/**
 * @typedef {Object} ColumnDescription
 * @property {string} title - The column title
 * @property {number} width - The column width
 * @property {'left'|'right'|'center'|'center-on'} align - The column alignment
 * @property {string} [centerChar] - Optional character for center-on alignment
 * @property {Function} [format] - Optional formatting function
 * @property {Array<{test: Function, format: Function}>} [conditions] - Optional conditional formatting rules
 * @property {boolean} strict - Whether strict formatting is enforced
 */

/**
 * @typedef {Object} TableOptions
 * @property {Function} [borderColor] - ANSI formatter for border color
 * @property {Function} [headerColor] - ANSI formatter for header color
 * @property {'normal'|'simple'|'double'|'basic'} [borderStyle] - Style of the table borders
 * @property {boolean} [showColumnSeparator] - Whether to show column separators
 * @property {number} [padding] - Padding between cells
 */

// ========== color formating functions ==========

/**
 * ANSI Formatter for Bitburner Terminal Output
 *
 * Based on tests showing that combined ANSI sequences
 * (e.g. \u001b[3;31m) work correctly in Bitburner, while separate
 * sequences (e.g. \u001b[3m\u001b[31m) override each other.
 *
 * ===== BITBURNER ANSI COMPATIBILITY SUMMARY =====
 * Based on comprehensive testing with ansi-complete-test.js
 *
 * SUPPORTED CODES:
 * - Basic Formatting:
 *   ✓ 0 (Reset)
 *   ✓ 3 (Italic)
 *   ✓ 4 (Underline)
 *   ⚠️ 1 (Bold) - Works in browser version, but not in Steam version
 *   ✗ 2 (Dim) - Not supported
 *   ✗ 5 (Blink) - Not supported
 *   ✗ 7 (Reverse/Invert) - Not supported
 *   ✗ 8 (Hidden) - Not supported
 *   ✗ 9 (Strikethrough) - Not supported
 *
 * - Standard Colors:
 *   ✓ 30-37 (Foreground colors)
 *   ✓ 40-47 (Background colors)
 *   ✓ 38;5;n (Extended foreground - 256 colors)
 *   ✓ 48;5;n (Extended background - 256 colors)
 *   ✗ 90-97 (Bright foreground colors) - Not supported
 *   ✗ 100-107 (Bright background colors) - Not supported
 *
 * IMPORTANT NOTES:
 * 1. ONLY COMBINED ANSI sequences work correctly (e.g. \u001b[3;31m)
 *    Separate sequences (\u001b[3m\u001b[31m) override each other
 * 2. Font variants (10-19) are not supported
 * 3. Double underline (21) is not supported
 * 4. Toggle-off codes (22-29) have inconsistent behavior
 *
 * COLOR REFERENCE:
 * - Standard colors (0-15):
 *   BLACK(0), RED(1), GREEN(2), YELLOW(3), BLUE(4), MAGENTA(5), CYAN(6), WHITE(7),
 *   DARK_GRAY(8), BRIGHT_RED(9), BRIGHT_GREEN(10), BRIGHT_YELLOW(11),
 *   BRIGHT_BLUE(12), BRIGHT_MAGENTA(13), BRIGHT_CYAN(14), BRIGHT_WHITE(15)
 *
 * - RGB cube (16-231):
 *   Calculated with Ansi.rgb(r, g, b) where r,g,b are 0-5
 *   Index = 16 + (36×r) + (6×g) + b
 *
 * - Grayscale (232-255):
 *   Calculated with Ansi.gray(level) where level is 0-23
 *   Index = 232 + level
 *
 */
export class Ansi {
	/**
	 * Creates an ANSI escape code with the specified codes
	 * @param {...string} codes - ANSI codes, will be separated by semicolons
	 * @returns {string} ANSI escape sequence
	 */
	static code(...codes) {
		return `\u001b[${codes.join(';')}m`;
	}

	/**
	 * Resets all ANSI formatting
	 * @returns {string} ANSI reset code
	 */
	static resetSeq() {
		return this.code(this.reset);
	}

	static reset = 0;
	static bold = 1;
	static italic = 3;
	static underline = 4;

	/**
	 * Creates a formatter function that applies the specified ANSI codes to text
	 * @param {...string} codes - ANSI codes for formatting
	 * @returns {Function} A function that formats text with the specified codes
	 *
	 * @example
	 * // Create a formatter for red text
	 * const redText = Ansi.formatter(Ansi.fg(Ansi.std.RED));
	 * console.log(redText("This is red"));
	 *
	 * // Create a formatter for bold, underlined text on yellow background
	 * const highlightText = Ansi.formatter(
	 *   Ansi.bold,
	 *   Ansi.underline,
	 *   Ansi.bg(Ansi.std.YELLOW)
	 * );
	 * console.log(highlightText("Important warning"));
	 */
	static formatter(...codes) {
		const startSequence = this.code(...codes);
		const endSequence = this.resetSeq();

		// Return a function that formats text with the stored codes
		return function (text) {
			return `${startSequence}${text}${endSequence}`;
		};
	}

	// Extend Format with standard colors as constants

	/**
	 * Creates an ANSI escape code for 256-color foreground
	 * @param {number} code - Color code (0-255)
	 *   Ansi.std; // 0-15
	 *   Ansi.rgb(r, g, b); // 16-231
	 *   Ansi.gray(level); // 232-255
	 * @returns {string} ANSI escape code for 256-color foreground
	 */
	static fg(code) {
		return `38;5;${code}`;
	}

	/**
	 * Creates an ANSI escape code for 256-color background
	 * @param {number} code - Color code (0-255)
	 *   Ansi.std; // 0-15
	 *   Ansi.rgb(r, g, b); // 16-231
	 *   Ansi.gray(level); // 232-255
	 * @returns {string} ANSI escape code for 256-color background
	 */
	static bg(code) {
		return `48;5;${code}`;
	}

	/** Range 0-15: Standard colors */
	static std = Object.freeze({
		BLACK: 0,         // Black
		RED: 1,           // Red
		GREEN: 2,         // Green
		YELLOW: 3,        // Yellow
		BLUE: 4,          // Blue
		MAGENTA: 5,       // Magenta
		CYAN: 6,          // Cyan
		WHITE: 7,         // White (light gray)

		DARK_GRAY: 8,     // Dark gray (bright black)
		BRIGHT_RED: 9,    // Bright red
		BRIGHT_GREEN: 10, // Bright green
		BRIGHT_YELLOW: 11, // Bright yellow
		BRIGHT_BLUE: 12,  // Bright blue
		BRIGHT_MAGENTA: 13, // Bright magenta
		BRIGHT_CYAN: 14,  // Bright cyan
		BRIGHT_WHITE: 15, // Bright white (pure white)
	});

	/**
	 * Creates an ANSI escape code for RGB colors
	 *   RGB cube (16-231):
	 *   Calculated with Ansi.rgb(r, g, b) where r,g,b are 0-5
	 *   Index = 16 + (36×r) + (6×g) + b
	 * @returns {string} ANSI escape code for 24-bit RGB color
	 */
	static rgb(r, g, b) {
		if (r < 0 || r > 5) throw new Error('r must be between 0 and 5');
		if (g < 0 || g > 5) throw new Error('g must be between 0 and 5');
		if (b < 0 || b > 5) throw new Error('b must be between 0 and 5');
		return `${16 + (r * 36 + g * 6 + b)}`;
	}

	/** Some grayscale levels from range 232-255 */
	static GRAY = Object.freeze({

		DARKEST: 232,  // Very dark gray
		DARKER: 236,   // Darker gray
		DARK: 240,     // Dark gray
		MEDIUM: 244,   // Medium gray
		LIGHT: 248,    // Light gray
		LIGHTER: 252,  // Lighter gray
		LIGHTEST: 255, // Almost white
	});

	/**
	 * Removes all ANSI formatting codes from a text
	 * @param {string} text - Text that may contain ANSI codes
	 * @returns {string} Text without ANSI formatting codes
	 */
	static stripFormatting(text) {
		if (typeof text !== 'string') {
			return String(text);
		}
		// Regular expression that removes all ANSI escape sequences (starting with \u001b[ and ending with m)
		return text.replace(/\u001b\[(?:\d+;)*\d+m/g, '');
	}

	/**
	 * Formatiert eine Zahl in ein kompaktes Format
	 * - Zahlen < 1000: normale Darstellung
	 * - Zahlen >= 1000: 4-stellig mit Suffix (k, m, g, t, p)
	 * @param {number} num - Die zu formatierende Zahl
	 * @returns {string} Formatierte Zahl
	 *
	 * @example
	 * Ansi.formatNumber(42)      // "42"
	 * Ansi.formatNumber(1234)    // "1k23"
	 * Ansi.formatNumber(12345)   // "12k3"
	 * Ansi.formatNumber(123456)  // "123k"
	 * Ansi.formatNumber(1234567) // "1m23"
	 */
	static formatNumber(num) {
		if (num < 1000) {
			return num.toString();
		}

		const suffixes = ['k', 'm', 'g', 't', 'p'];
		let value = num;
		let suffixIndex = -1;

		// Finde das passende Suffix
		while (value >= 1000 && suffixIndex < suffixes.length - 1) {
			value /= 1000;
			suffixIndex++;
		}

		// Runde auf 3 signifikante Stellen
		if (value >= 100) {
			return Math.floor(value) + suffixes[suffixIndex];
		} else if (value >= 10) {
			return value.toFixed(1) + suffixes[suffixIndex];
		} else {
			return value.toFixed(2) + suffixes[suffixIndex];
		}
	}
}

// ========== TABLE FORMATTING FUNCTIONS ==========
export class Table {
	/**
	 * Enables or disables debug output for the table
	 * @private
	 * @type {boolean}
	 */
	#debugMode = false;
	#ns; // only used if debugMode is enabled
	/** @type {number} */
	#tableWidth = 0;
	/** @type {Array<ColumnDescription>} */
	#columns;
	/** @type {Array<Array<any>>} */
	#rows;
	/** @type {TableOptions} */
	#options;
	/** @enum {string} */
	static Align = {
		LEFT: 'left',
		RIGHT: 'right',
		CENTER: 'center',
		CENTER_ON: 'center-on'
	};

	/**
	 * helper: Creates a simple column description for the table
	 * @private
	 * @param {string} title - title of the column
	 * @returns {ColumnDescription} The column description with default values
	 */
	#createColumnDescription(title) {
		return {
			title,
			width: 0,
			align: Table.Align.LEFT,
			format: undefined,
			conditions: [],
			centerChar: undefined
		};
	}

	/**
	 * Constructor for the table
	 * @param {Array<string>} [headers] - The column headers (optional)
	 * @param {Partial<TableOptions>} [options={}] - Additional options (can be a subset of TableOptions)
	 */
	constructor(headers = [], options = {}) {
		// Initialize columns array using the helper function
		this.#columns = headers.map(title => this.#createColumnDescription(title));

		// Options with default values
		this.#options = {
			// Standard formatting
			borderColor: Ansi.formatter(Ansi.fg(Ansi.std.WHITE)),  // Default: White
			headerColor: Ansi.formatter(Ansi.bold, Ansi.fg(Ansi.std.WHITE)),  // Default: Bold & White

			// Border options
			borderStyle: 'normal', // 'normal', 'simple', 'double', 'basic'
			showColumnSeparator: true, // Show column separators or not

			padding: 1, // Padding between cells

			// Define additional options here
			...options
		};

		// Initialize rows array
		this.#rows = [];
	}

	/**
	 * Adds a row to the table
	 * @param {Array<*>} rowData - Array with cell data
	 * @returns {Table} The table instance for method chaining
	 * @throws {Error} If the number of cells doesn't match the expected column count
	 */
	addRow(rowData) {
		// If columnCount is not yet defined, derive it from this (first) row
		if (this.#columns.length === 0) {
			this.#columns = new Array(rowData.length);
			for (let i = 0; i < this.#columns.length; i++) {
				this.#columns[i] = this.#createColumnDescription('');
			}
		}

		// Check if the number of cells matches the expected column count
		if (rowData.length !== this.#columns.length) {
			throw new Error(`Error: Row with ${rowData.length} columns cannot be added, expected ${this.#columns.length}`);
		}

		this.#rows.push(rowData);
		return this;
	}

	/**
	 * Removes all ANSI formatting codes from table data
	 * @returns {Table} The table instance for method chaining
	 */
	sanitizeData() {
		this.#columns = this.#columns.map(column => ({
			...column,
			title: Ansi.stripFormatting(column.title)
		}));
		this.#rows = this.#rows.map(row =>
			row.map(cell => Ansi.stripFormatting(cell))
		);
		return this;
	}

	/**
	 * Returns the calculated width of the table - normaly undefined if not yet calculated while rendering
	 * @returns {number|undefined} The width of the table in characters
	 */
	getTableWidth() {
		return this.#tableWidth === 0 ? undefined : this.#tableWidth;
	}

	/**
	 * Returns the rendered table as a string
	 * @returns {string} The rendered table
	 */
	toString() {
		return this.render();
	}

	/**
	 * Renders the table as a formatted string
	 * @returns {string} The rendered table as a string
	 */
	render() {
		// ------- get Settings ---------

		// Query column widths
		const columnWidths = this.#calculateColumnWidths();

		// Query border characters
		const borderChars = this.#getBorderChars();

		// Query separator setting
		const colSep = this.#options.showColumnSeparator;

		// Padding, at least 1
		const padding = Math.max(this.#options.padding, 1);

		// Local references for frequently used formatters
		const borderColorFn = this.#options.borderColor;
		const headerColorFn = this.#options.headerColor;
		const padString = ' '.repeat(padding);

		// ------- create top-, middle- and bottom border lines ---------

		// Create horizontal lines
		let topBorder, midBorder, bottomBorder;
		// start with left border character
		topBorder = borderChars.borderTopLeft;
		midBorder = borderChars.borderLeftMid;
		bottomBorder = borderChars.borderBottomLeft;

		/** width of the table */
		let tableWidth = 1; // one left border character

		// Create horizontal lines with the correct crossing points
		for (let i = 0; i < columnWidths.length; i++) {
			// each cell starts with padding
			let colWidth = padding
			// then comes the cell itself
			colWidth += columnWidths[i];

			// Right padding is only needed for:
			// - last cell OR
			// - when column separators are used
			const isLastColumn = i === columnWidths.length - 1;
			if (isLastColumn || colSep) {
				colWidth += padding;
			}

			// extend horizontal lines by column width
			let snippet = borderChars.borderHorizontal.repeat(colWidth);
			topBorder += snippet;
			midBorder += borderChars.rowSep.repeat(colWidth);
			bottomBorder += snippet;
			// update table width for column
			tableWidth += colWidth;

			// Add crossing points (except after the last column)
			if (!isLastColumn && colSep) {
				topBorder += borderChars.borderTopMid;
				midBorder += borderChars.midSep;
				bottomBorder += borderChars.borderBottomMid;
				// update table width for separator
				tableWidth += 1;
			}
		} // end for (create horizontal frame)

		// Close the horizontal lines
		topBorder += borderChars.borderTopRight;
		midBorder += borderChars.borderRightMid;
		bottomBorder += borderChars.borderBottomRight;
		// update table width for right border character
		tableWidth += 1;


		// Store the calculated width in the object
		this.#tableWidth = tableWidth;

		/** Array for the output lines, which starts with the top line */
		const lines = [borderColorFn(topBorder)];

		// Render headers (if available)
		if (this.#columns.some(column => column.title && column.title.length > 0)) {
			/**
			 * variable to collect the title row.
			 * Like every row, the title row begins with the left border character
			 */
			let headerRow = borderColorFn(borderChars.borderVertical);

			// for each column
			for (let i = 0; i < this.#columns.length; i++) {
				const headerValue = this.#columns[i].title;
				// each cell starts with padding
				let headerCell = padString;
				// then comes the cell itself + some spaces to fill the column
				headerCell += String(headerValue).padEnd(columnWidths[i]);

				// Right padding is only needed for:
				// - last cell OR
				// - when column separators are used
				const isLastColumn = i === this.#columns.length - 1;
				if (isLastColumn || colSep) {
					headerCell += padString;
				}

				headerRow += headerColorFn(headerCell); // add formatted cell

				// Add separator (except for the last column)
				if (!isLastColumn && colSep) {
					headerRow += borderColorFn(borderChars.colSep); // add formatted separator
				}
			}

			// finally add the right border character
			headerRow += borderColorFn(borderChars.borderVertical);
			// add the formatted title row to the output lines
			lines.push(headerRow);

			// add the separator line to the output lines
			lines.push(borderColorFn(midBorder));
		}

		// Render data row(s)
		for (const row of this.#rows) {
			// for data rows too, each row starts with the left border character
			let dataRow = borderColorFn(borderChars.borderVertical);

			// Render data cell(s)
			for (let i = 0; i < row.length; i++) {
				// each cell starts with padding
				let cellString = padString;

				const rawValue = row[i];
				cellString += this.#alignCell(String(rawValue), i, columnWidths[i]);

				/** the formatter to be applied to the current value */
				let cellFormatter = (text) => text;	// default: no formatter

				if (this.#columns[i].conditions.length > 0) {	// conditional formatting
					for (const rule of this.#columns[i].conditions) {
						if (rule.test(rawValue)) {
							cellFormatter = rule.format;
							break;
						}
					}
				} else if (this.#columns[i].format) {	// simple formatting
					cellFormatter = this.#columns[i].format;
				}

				// Right padding is only needed for:
				// - last cell OR
				// - when column separators are used
				const isLastColumn = i === row.length - 1;
				if (isLastColumn || colSep) {
					cellString += padString;
				}

				dataRow += cellFormatter(cellString);

				// Add separator (except for the last column)
				if (!isLastColumn && colSep) {
					dataRow += borderColorFn(borderChars.colSep);
				}
			} // end for (render data cell)

			// finally add the right border character
			dataRow += borderColorFn(borderChars.borderVertical);
			// add the formatted data row to the output lines
			lines.push(dataRow);
		} // end for (render data row)

		// Add bottom border
		lines.push(borderColorFn(bottomBorder));

		// Join all lines to a string
		return lines.join('\n');
	} // end render

	/**
	 * Enables or disables debug output for the table
	 * @param {boolean} enabled - Whether debug output should be enabled
	 * @returns {Table} The table instance for method chaining
	 */
	setDebug(enabled, ns = undefined) {
		this.#debugMode = enabled;
		if (enabled) {
			ns.ui.openTail();
		}
		this.#ns = ns;
		return this;
	}

	/**
	 * returns a column, which is iterable and writable
	 *
	 * @example
	 * for (const cell of table.column('Name')) {
	 *     if (cell.value === 'old') {
	 *         cell.value = 'new';
	 *     }
	 *     print(cell.value);
	 * }
	 *
	 * @param {number|string} columnSelector - Index or name of the column
	 * @returns {Object} An object implementing the iterator protocol and allowing write access
	 * @throws {Error} If the column does not exist
	 */
	column(columnSelector) {
		const columnIndex = this.#getColumnIndex(columnSelector);
		const self = this;  // Reference to Table instance for closure

		return {
			// Implement iterator protocol
			[Symbol.iterator]() {
				return {
					rows: self.#rows,
					colIdx: columnIndex,
					currentRow: 0,

					next() {
						if (this.currentRow >= this.rows.length) {
							return { done: true };
						}

						const rowIdx = this.currentRow++;
						const rows = this.rows;  // Closure reference
						const colIdx = this.colIdx;  // Closure reference

						return {
							value: {
								get value() {
									return rows[rowIdx][colIdx];
								},
								set value(newValue) {
									rows[rowIdx][colIdx] = newValue;
								},
								get index() {
									return rowIdx;
								}
							},
							done: false
						};
					}
				};
			}
		};
	}

	/**
	 * Macht mehrere Spalten gleichzeitig iterierbar und beschreibbar
	 * @param {...(number|string)} columnSelectors - Indizes oder Namen der Spalten
	 * @returns {Object} Ein Objekt das das Iterator-Protokoll implementiert und Schreibzugriff erlaubt
	 * @throws {Error} Wenn eine der Spalten nicht existiert
	 */
	columns(...columnSelectors) {
		const columnIndices = columnSelectors.map(selector =>
			this.#getColumnIndex(selector)
		);

		const self = this;  // Referenz auf Table-Instanz für Closure

		return {
			[Symbol.iterator]() {
				return {
					rows: self.#rows,
					colIndices: columnIndices,
					currentRow: 0,

					next() {
						if (this.currentRow >= this.rows.length) {
							return { done: true };
						}

						const rowIndex = this.currentRow++;
						const rows = this.rows;  // Closure-Referenz

						// Für jede Spalte ein Cell-Objekt erstellen
						const cells = this.colIndices.map(colIdx => ({
							get value() {
								return rows[rowIndex][colIdx];
							},
							set value(newValue) {
								rows[rowIndex][colIdx] = newValue;
							},
							get index() {
								return rowIndex;
							}
						}));

						return {
							value: cells,
							done: false
						};
					}
				};
			}
		};
	}

	/**
	 * Sortiert die Tabelle nach einer bestimmten Spalte
	 * @param {number|string} columnSelector - Index oder Name der Spalte
	 * @param {Object} [options] - Sortieroptionen
	 * @param {boolean} [options.descending=false] - Absteigend sortieren
	 * @param {Function} [options.compareFn] - Eigene Vergleichsfunktion
	 * @returns {Table} Die Table-Instanz für Method-Chaining
	 * @throws {Error} Wenn die Spalte nicht existiert
	 *
	 * @example
	 * // Aufsteigend nach Spaltenindex sortieren
	 * table.sortBy(0);
	 *
	 * // Absteigend nach Spaltennamen sortieren
	 * table.sortBy("Name", { descending: true });
	 *
	 * // Mit eigener Vergleichsfunktion sortieren
	 * table.sortBy("Datum", {
	 *     compareFn: (a, b) => new Date(a) - new Date(b)
	 * });
	 */
	sortBy(columnSelector, options = {}) {
		const columnIndex = this.#getColumnIndex(columnSelector);
		const { descending = false, compareFn } = options;

		// Standard-Vergleichsfunktion wenn keine angegeben wurde
		const defaultCompare = (a, b) => {
			// Gleichheit prüfen
			if (a === b) return 0;

			// Null/Undefined ans Ende sortieren (optional, kann angepasst werden)
			if (a === null || a === undefined) return 1; // a nach hinten
			if (b === null || b === undefined) return -1; // b nach hinten

			// Prüfen, ob beide Werte Zahlen sind
			const aIsNumber = typeof a === 'number' && !isNaN(a);
			const bIsNumber = typeof b === 'number' && !isNaN(b);

			if (aIsNumber && bIsNumber) {
				// Beide sind Zahlen -> numerischer Vergleich
				return a - b;
			} else {
				// Mindestens einer ist keine Zahl -> String-Vergleich
				return String(a).localeCompare(String(b));
			}
		};

		// Die tatsächlich zu verwendende Vergleichsfunktion
		const compare = compareFn || defaultCompare;

		// Sortiere die Zeilen
		this.#rows.sort((rowA, rowB) => {
			const result = compare(rowA[columnIndex], rowB[columnIndex]);
			return descending ? -result : result;
		});

		return this;
	}

	/**
	 * Defines formatting rules for a column
	 * @param {number|string} columnSelector - Index or name of the column
	 * @param {Array<string>|Function} format - ANSI format codes OR a formatter function
	 * @param {boolean} [strict=false] - If true, no conditional formatting is allowed
	 * @returns {Table} The table instance for method chaining
	 */
	setFormat(columnSelector, format, strict = false) {
		const columnIndex = this.#getColumnIndex(columnSelector);
		this.#columns[columnIndex].format = this.#createFormatter(format);
		return this;
	}

	/**
	 * Adds a conditional formatting rule
	 * @param {number|string} columnSelector - Column index or name
	 * @param {Function} condition - Function that checks the value and returns true/false
	 * @param {Array<string>|Function} format - ANSI format codes OR a formatter function
	 * @returns {Table} The table instance for method chaining
	 */
	addConditionalFormat(columnSelector, condition, format) {
		const columnIndex = this.#getColumnIndex(columnSelector);

		this.#columns[columnIndex].conditions.push({
			test: condition,
			format: this.#createFormatter(format)
		});
		return this;
	}

	/**
	 * Sets the formatting for the table borders
	 * @param {Array<string>|Function} format - ANSI format codes OR a formatter function
	 * @returns {Table} The table instance for method chaining
	 */
	setBorderColor(format) {
		this.#options.borderColor = this.#createFormatter(format);
		return this;
	}

	/**
	 * Sets the formatting for the table headers
	 * @param {Array<string>|Function} format - ANSI format codes OR a formatter function
	 * @returns {Table} The table instance for method chaining
	 */
	setHeaderColor(format) {
		this.#options.headerColor = this.#createFormatter(format);
		return this;
	}

	/**
	 * Setzt die Ausrichtung für eine Spalte
	 * @param {number|string} columnSelector - Index oder Name der Spalte
	 * @param {'left'|'right'|'center'|'center-on'} align - Art der Ausrichtung
	 * @param {string} [centerChar] - Optional: Zeichen für center-on Ausrichtung
	 * @returns {Table} Die Table-Instanz für Method-Chaining
	 * @throws {Error} Wenn die Spalte nicht existiert oder ungültige Ausrichtung
	 */
	setColumnAlignment(columnSelector, align, centerChar) {
		if (!['left', 'right', 'center', 'center-on'].includes(align)) {
			throw new Error(`Ungültige Ausrichtung: ${align}`);
		}

		if (align === 'center-on' && !centerChar) {
			throw new Error('center-on Ausrichtung benötigt ein centerChar');
		}

		const columnIndex = this.#getColumnIndex(columnSelector);
		this.#columns[columnIndex].align = align;
		if (centerChar) {
			this.#columns[columnIndex].centerChar = centerChar;
		}
		return this;
	}


	// ------- private functions below ---------

	/**
	 * Debug logging with optional callback (lazy evaluation)
	 * @param {string | (() => string)} msgOrCallback - Message or callback
	 *
	 * @example:
	 * //direct evaluation
	 * this.#debug(`easy output: ${data}`);
	 * //lazy evaluation
	 * this.#debug(() => `Complex output: ${expensiveFunction()}`);
	 */
	#debug(msgOrCallback) {
		if (this.#debugMode) {
			let msg = typeof msgOrCallback === 'function' ? msgOrCallback() : msgOrCallback;
			msg = `${Ansi.code(Ansi.fg(Ansi.std.BRIGHT_CYAN))}${msg}${Ansi.resetSeq()}`;
			this.#ns.print(msg);
		}
	}

	/**
	 * Calculates the optimal width for each column
	 * @private
	 * @returns {Array<number>} An array with the width of each column
	 */
	#calculateColumnWidths() {
		// first get widths of headers
		const columnWidths = this.#columns.map(column => String(column.title).length);

		// then collect widths of all rows (col-wise)
		for (let colIdx = 0; colIdx < columnWidths.length; colIdx++) {
			const column = this.#columns[colIdx];

			// Process all rows
			for (let rowIdx = 0; rowIdx < this.#rows.length; rowIdx++) {
				const cell = Ansi.stripFormatting(this.#rows[rowIdx][colIdx]);

				if (column.align === Table.Align.CENTER_ON && column.centerChar) {
					// for center-on, width must be calculated differently because it depends on
					// character position; and we need to store more information

					if (column.maxLeft === undefined && column.maxRight === undefined) {
						column.maxLeft = 0;
						column.maxRight = 0;
					}
					this.#debug(() => `at start column ${colIdx} :: maxLeft: ${column.maxLeft}, maxRight: ${column.maxRight}`);


					const charIndex = this.#findUniqueChar(cell, column.centerChar);

					if (charIndex !== -1) {
						// Left is the length up to the character
						column.maxLeft = Math.max(column.maxLeft, charIndex);
						// Right is the length after the character
						const rightLen = cell.length - charIndex - 1;
						column.maxRight = Math.max(column.maxRight, rightLen);

						// new width is maxLeft + character + maxRight
						columnWidths[colIdx] = Math.max(columnWidths[colIdx], column.maxLeft + 1 + column.maxRight);
					} else {
						// Fallback: If no separator found, store total length
						columnWidths[colIdx] = Math.max(columnWidths[colIdx], cell.length);
						this.#debug(() => `fallback used`);
					}
					this.#debug(() => `after row ${rowIdx} :: maxLeft: ${column.maxLeft}, maxRight: ${column.maxRight}`);

				} else {
					// simple case, store maxLength from the column
					columnWidths[colIdx] = Math.max(columnWidths[colIdx], cell.length);

				} // end if (center-on)
			} // end for (rowIdx)
		} // end for (colIdx)

		return columnWidths;
	}

	/**
	 * Searches for a character in a string and checks for unique occurrence
	 * @private
	 * @param {string} text - The text to search
	 * @param {string} char - The character to search for
	 * @returns {number} Position of the character or -1 if not unique
	 */
	#findUniqueChar(text, char) {
		// find first position
		const firstPos = text.indexOf(char);

		// early return if not found
		if (firstPos === -1) {
			return -1;
		}

		// check if there are further occurrences
		const nextPos = text.indexOf(char, firstPos + 1);

		// early return if there are further occurrences
		if (nextPos !== -1) {
			return -1;
		}

		// return the position
		return firstPos;
	}

	/**
	 * Returns the appropriate border characters
	 * @private
	 * @returns {Object} Object with border characters
	 */
	#getBorderChars() {
		switch (this.#options.borderStyle) {
			case 'basic':
				return {
					borderTopLeft: '+', borderTopRight: '+',
					borderBottomLeft: '+', borderBottomRight: '+',
					borderHorizontal: '-', borderVertical: '|',
					borderTopMid: '+', borderBottomMid: '+',
					borderLeftMid: '+', borderRightMid: '+',
					colSep: '|', midSep: '+', rowSep: '-'
				};
			case 'double':
				return {
					borderTopLeft: '╔', borderTopRight: '╗',
					borderBottomLeft: '╚', borderBottomRight: '╝',
					borderHorizontal: '═', borderVertical: '║',
					borderTopMid: '╦', borderBottomMid: '╩',
					borderLeftMid: '╠', borderRightMid: '╣',
					colSep: '║', midSep: '╬', rowSep: '═'
				};
			case 'simple':
				return {
					borderTopLeft: '┌', borderTopRight: '┐',
					borderBottomLeft: '└', borderBottomRight: '┘',
					borderHorizontal: '─', borderVertical: '│',
					borderTopMid: '┬', borderBottomMid: '┴',
					borderLeftMid: '├', borderRightMid: '┤',
					colSep: '│', midSep: '┼', rowSep: '─'
				};
			default:
			case 'normal':
				return {
					borderTopLeft: '╔', borderTopRight: '╗',
					borderBottomLeft: '╚', borderBottomRight: '╝',
					borderHorizontal: '═', borderVertical: '║',
					borderTopMid: '╤', borderBottomMid: '╧',
					borderLeftMid: '╟', borderRightMid: '╢',
					colSep: '│', midSep: '┼', rowSep: '─'
				};
		}
	}

	/**
	 * Aligns a cell according to its settings
	 * @private
	 * @param {string} text - The text to align
	 * @param {number} columnIndex - The index of the column
	 * @param {number} width - The available width
	 * @returns {string} The aligned text
	 */
	#alignCell(text, columnIndex, width) {
		const textraw = Ansi.stripFormatting(text);
		const column = this.#columns[columnIndex];
		const textwidth = textraw.length;
		const padding = ' '.repeat(Math.max(0, width - textwidth));

		this.#debug(() => `column.align: ${column.align} width: ${width} text: ${text} `);

		switch (column.align) {
			case Table.Align.LEFT:
				return text + padding;
			case Table.Align.RIGHT:
				return padding + text;
			case Table.Align.CENTER:
				return this.#centerPlain(text, width);
			case Table.Align.CENTER_ON:
				this.#debug(() => `center-on start: ${text} char: ${column.centerChar} width: ${width}`);
				if (!column.centerChar) {	// no center character set -> use plain center
					return this.#centerPlain(text, width);
				}
				const charIndex = this.#findUniqueChar(text, column.centerChar);

				if (charIndex === -1) {	// no separator found -> use plain center
					return this.#centerPlain(text, width);
				}

				// calculate lengths of the parts
				const leftLen = charIndex;
				const rightLen = text.length - charIndex - 1;
				this.#debug(() => `center-on: leftLen: ${leftLen} column.maxLeft: ${column.maxLeft} | rightLen: ${rightLen} column.maxRight: ${column.maxRight}`);
				const leftPadding = ' '.repeat(column.maxLeft - leftLen);
				const rightPadding = ' '.repeat(column.maxRight - rightLen);

				return this.#centerPlain(leftPadding + text + rightPadding, width); // muss sein, wenn der titel größer ist als der text
			default:
				return text.padEnd(width);
		}
	}

	/**
	 * Centers a text within the available width
	 * @private
	 * @param {string} text - The text to be centered
	 * @param {number} width - The available width
	 * @returns {string} The centered text
	 */
	#centerPlain(text, width) {
		this.#debug(() => `centerPlain: text: ${text} width: ${width}`);
		if (text.length >= width) return text;

		const padding = width - text.length;
		const leftPadding = Math.floor(padding / 2);
		const rightPadding = padding - leftPadding;

		return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
	}

	/**
	 * Determines the index of a column based on number or name (Helper for table.column & table.columns)
	 * @private
	 * @param {number|string} columnSelector - Index or name of the column
	 * @returns {number} The index of the column
	 * @throws {Error} If the column does not exist
	 */
	#getColumnIndex(columnSelector) {
		let columnIndex;

		if (typeof columnSelector === 'number') {
			columnIndex = columnSelector;
			// check if the column exists
			if (columnIndex >= this.#columns.length) {
				throw new Error(`Column ${columnIndex} does not exist`);
			}
		} else {
			// Bei String-Selektor: Prüfen ob überhaupt Header definiert sind
			if (this.#columns.every(col => col.title === '')) {
				throw new Error('Column selection by name not possible - table has no headers');
			}
			// search for the header
			columnIndex = this.#columns.findIndex(
				column => column.title === columnSelector
			);
			if (columnIndex === -1) {
				throw new Error(`Column "${columnSelector}" not found`);
			}
		}

		return columnIndex;
	}

	/**
	 * Creates a formatter function from various input types
	 * @private
	 * @param {Array<string>|Function} format - ANSI format codes OR a formatter function
	 * @returns {Function} A formatter function
	 */
	#createFormatter(format) {
		return typeof format === 'function'
			? format
			: Array.isArray(format)
				? Ansi.formatter(...format)
				: (text) => text;
	}

}

// ========== PROGRESS BAR FUNCTIONS ==========

/**
 * Eine Klasse zur Darstellung eines Fortschrittsbalkens im Log-Fenster
 */
class ProgressBar {
	/** @type {NS} */
	#ns;
	/** @type {number} */
	#width;
	/** @type {string} */
	#completeChar;
	/** @type {string} */
	#incompleteChar;
	/** @type {Function} */
	#barColorFn;
	/** @type {Function} */
	#textColorFn;
	/** @type {string} */
	#label;
	/** @type {Array<string>} */
	#logHistory;

	/**
	 * Erstellt einen neuen Fortschrittsbalken
	 * @param {NS} ns - Netscript API
	 * @param {Object} options - Optionen für den Fortschrittsbalken
	 * @param {number} [options.width=50] - Breite des Balkens in Zeichen
	 * @param {string} [options.completeChar='█'] - Zeichen für den gefüllten Teil
	 * @param {string} [options.incompleteChar='░'] - Zeichen für den ungefüllten Teil
	 * @param {Function} [options.barColor] - Farbe für den Balken (Ansi.formatter)
	 * @param {Function} [options.textColor] - Farbe für den Text (Ansi.formatter)
	 * @param {string} [options.label='Progress'] - Beschriftung des Balkens
	 */
	constructor(ns, options = {}) {
		this.#ns = ns;
		this.#width = options.width || 50;
		this.#completeChar = options.completeChar || '█';
		this.#incompleteChar = options.incompleteChar || '░';
		this.#barColorFn = options.barColor || Ansi.formatter(Ansi.fg(Ansi.std.GREEN));
		this.#textColorFn = options.textColor || Ansi.formatter(Ansi.fg(Ansi.std.WHITE));
		this.#label = options.label || 'Progress';
		this.#logHistory = ns.getScriptLogs(); // TODO: merker für die letzten logqausgaben ns.getScriptLogs
		ns.disableLog('ALL');
	}

	/**
	 * Zeigt den Fortschrittsbalken mit dem aktuellen Fortschritt an
	 * @param {number} progress - Fortschritt zwischen 0 und 1
	 * @param {number} remainingSeconds - Verbleibende Sekunden
	 */
	#render(progress, remainingSeconds) {
		// Anzahl der gefüllten Zeichen berechnen
		const filledWidth = Math.floor(progress * this.#width);
		const emptyWidth = this.#width - filledWidth;

		// Fortschrittsbalken erstellen
		const filledBar = this.#completeChar.repeat(filledWidth);
		const emptyBar = this.#incompleteChar.repeat(emptyWidth);
		const bar = this.#barColorFn(filledBar) + this.#textColorFn(emptyBar);

		// altes log löschen und mit neuem Balken nochmal ausgeben
		this.#ns.clearLog();
		this.#ns.print(this.#logHistory.join(''));
		// Balken zum Log hinzufügen
		this.#ns.print(`WAIT: ${this.#textColorFn(this.#label)}: [${bar}] ${remainingSeconds}s`);
	}

	/**
	 * Wartet die angegebene Zeit und zeigt einen Fortschrittsbalken
	 * @param {number} milliseconds - Wartezeit in Millisekunden
	 * @param {number} [updateInterval=200] - Aktualisierungsintervall in ms
	 */
	async wait(milliseconds, updateInterval = 200) {
		const startTime = Date.now();
		const endTime = startTime + milliseconds;

		while (Date.now() < endTime) {
			const elapsed = Date.now() - startTime;
			const progress = elapsed / milliseconds;
			const remaining = Math.max(0, milliseconds - elapsed);
			const remainingSeconds = Math.ceil(remaining / 1000);

			this.#render(progress, remainingSeconds);
			await this.#ns.sleep(updateInterval);
		}

		// Abschlussbalken anzeigen
		this.#render(1, 0);
	}
}

/**
 * Wartet die angegebene Zeit und zeigt einen Fortschrittsbalken im Log-Fenster
 * @param {NS} ns - Netscript API
 * @param {number} milliseconds - Wartezeit in Millisekunden
 * @param {string} [label='Warte'] - Beschriftung des Balkens
 * @returns {Promise<void>}
 */
export async function waitWithProgress(ns, milliseconds, label = 'Warte') {
	const bar = new ProgressBar(ns, {
		label,
		width: 40,
		completeChar: '█',
		incompleteChar: '░',
		barColor: Ansi.formatter(Ansi.fg(Ansi.std.GREEN)),
		textColor: Ansi.formatter(Ansi.fg(Ansi.std.WHITE))
	});
	ns.ui.openTail();
	await bar.wait(milliseconds);
}

/**
 * Formatiert Millisekunden in einen String (z.B. "1d 03:22:10" oder "15:01:45").
 * @param {number} ms - Zeit in Millisekunden
 * @returns {string} Formatierter Zeitstring
 */
export function tFormatCustom(ms) {
	if (ms === null || ms === undefined || isNaN(ms)) {
		return 'N/A';
	}
	if (ms < 0) return `-${formatTimeCustom(-ms)}`;
	if (ms === 0) return '0s'; // Oder "0:00:00"?

	let remainingTime = Math.floor(ms / 1000);

	const seconds = remainingTime % 60;
	remainingTime -= seconds;
	remainingTime /= 60;

	const minutes = remainingTime % 60;
	remainingTime -= minutes;
	remainingTime /= 60;

	const hours = remainingTime % 24;
	remainingTime -= hours;
	remainingTime /= 24;

	const days = remainingTime;

	const hoursStr = String(hours).padStart(2, '0');
	const minutesStr = String(minutes).padStart(2, '0');
	const secondsStr = String(seconds).padStart(2, '0');

	let result = "";
	if (days > 0) {
		result += `${days}d `;
	}
	result += `${hoursStr}:${minutesStr}:${secondsStr}`;

	// Optional: Millisekunden hinzufügen, wenn gewünscht und die Zeit klein ist
	// if (ms < 60000 && ms !== 0) { // z.B. unter 1 Minute
	//     const millisStr = String(ms % 1000).padStart(3, '0');
	//     result += `.${millisStr}`;
	// }

	return result;
}

/**
 * Formatiert eine nicht-negative Zahl in einen String fester Breite (6 Zeichen)
 * mit spezieller Präfix-Logik für große Zahlen. Negative Zahlen oder ungültige
 * Eingaben ergeben "  N/A ".
 * Beispiele:
 *   123       => "   123"
 *   12345     => "12k345"
 *   123456    => "123k45"
 *   1234567   => "1m2345"
 *   -123      => "  N/A "
 *   null      => "  N/A "
 * @param {number | null | undefined} num - Die zu formatierende Zahl.
 * @returns {string} Der formatierte 6-Zeichen-String.
 */
export function formatNumberFixedWidth(num) {
	const targetWidth = 6;
	const naString = "N/A".padStart(targetWidth); // "  N/A "

	// Ungültige oder negative Eingaben => N/A
	if (num === null || num === undefined || isNaN(num) || num < 0) {
		return naString;
	}

	// Fall 1: Kleine Zahlen (< 10000)
	if (num < 10000) {
		return String(num).padStart(targetWidth, ' ');
	}

	// Fall 2: Große Zahlen (>= 10000)
	const suffixes = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
	let suffixIndex = 0;
	let tempNum = num;

	// Finde den passenden Suffix-Index basierend auf der Größenordnung
	while (tempNum >= 1000 && suffixIndex < suffixes.length - 1) {
		const nextDivisor = Math.pow(1000, suffixIndex + 1);
		if (num >= nextDivisor) {
			suffixIndex++;
			tempNum /= 1000; // Für die nächste Iterationsprüfung
		} else {
			break;
		}
	}

	// Sollte nicht passieren wegen < 10000 Check, aber sicher ist sicher
	if (suffixIndex === 0) {
		return String(num).padStart(targetWidth);
	}

	const divisor = Math.pow(1000, suffixIndex);
	const suffix = '\x1b[31m' + suffixes[suffixIndex] + '\x1b[0m';

	const intPart = Math.floor(num / divisor);
	const remainder = num % divisor;
	const intPartStr = String(intPart);
	const intPartLen = intPartStr.length;

	// Verbleibende Zeichen für Nachkommastellen (nach Suffix)
	const fractionDigitsNeeded = targetWidth - intPartLen - 1; // 1 für den Suffix

	// Fallback, falls der Integer-Teil + Suffix schon zu lang sind
	if (fractionDigitsNeeded < 0) {
		let fallbackStr = intPartStr + suffix;
		if (fallbackStr.length > targetWidth) {
			// Extremfall: z.B. 123456k -> zu lang -> Fehler anzeigen
			return '#'.padStart(targetWidth, '#');
		}
		// Auffüllen, falls es doch kürzer war
		return fallbackStr.padStart(targetWidth);
	}

	// Berechne den "Nachkomma"-Teil basierend auf dem Anteil am Divisor
	let fractionPart = 0;
	if (fractionDigitsNeeded > 0) {
		// Berechne den Anteil des Rests am Divisor und skaliere ihn
		const scaledFraction = (remainder / divisor) * Math.pow(10, fractionDigitsNeeded);
		fractionPart = Math.floor(scaledFraction);
	}
	// Fülle den Nachkomma-Teil mit führenden Nullen auf die benötigte Länge auf
	const fractionStr = String(fractionPart).padStart(fractionDigitsNeeded, '0');

	const finalStr = intPartStr + suffix + fractionStr;

	// Finales Auffüllen (sollte bei korrekter Logik genau passen oder kürzer sein)
	return finalStr.padStart(targetWidth, ' ');
}

