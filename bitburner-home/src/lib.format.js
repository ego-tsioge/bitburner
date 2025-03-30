/** @ts-check */
/** @typedef {import("/types/NetscriptDefinitions").NS} NS */

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
}

// ========== TABLE FORMATTING FUNCTIONS ==========

export class Table {
	/** @type {number} */
	#tableWidth = 0;
	/** @type {Array<string>} */
	#headers;
	/** @type {number|null} */
	#columnCount;
	/** @type {Object} */
	#options;
	/** @type {Array<Function>} */
	#columnFormats;
	/** @type {Array<{column: number, test: Function, format: Function}>} */
	#conditionalFormats;
	/** @type {Array<Array<any>>} */
	#rows;

	/**
	 * Constructor for a table
	 * @param {Array<string>} [headers] - The column headers (optional)
	 * @param {Object} [options={}] - Additional options
	 */
	constructor(headers = [], options = {}) {
		// Store column headers
		this.#headers = headers;

		// Derive column count from headers if present
		this.#columnCount = headers.length > 0 ? headers.length : null;

		// Options with default values
		this.#options = {
			// Standard formatting
			borderColor: Ansi.formatter(Ansi.fg(Ansi.std.WHITE)),  // Default: White
			headerColor: Ansi.formatter(Ansi.bold, Ansi.fg(Ansi.std.CYAN)),  // Default: Bold & Cyan

			// Border options
			borderStyle: 'normal', // 'normal', 'simple', 'double', 'basic'
			showColumnSeparator: true, // Show column separators or not

			padding: 1, // Padding between cells

			// Define additional options here
			...options
		};

		// Initialize arrays
		this.#columnFormats = [];
		this.#conditionalFormats = [];
		this.#rows = [];
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

	/**
	 * Defines formatting rules for a column
	 * @param {number} columnIndex - Index of the column (0-based)
	 * @param {Array<string>|Function} format - ANSI format codes for this column OR a formatter function
	 * @returns {Table} The table instance for method chaining
	 */
	setColumnFormat(columnIndex, format) {
		this.#columnFormats[columnIndex] = this.#createFormatter(format);
		return this;
	}

	/**
	 * Adds a conditional formatting rule
	 * @param {number} columnIndex - Column index for the condition (0-based)
	 * @param {Function} condition - Function that checks the value and returns true/false
	 * @param {Array<string>|Function} format - ANSI format codes OR a formatter function
	 * @returns {Table} The table instance for method chaining
	 */
	addConditionalFormat(columnIndex, condition, format) {
		this.#conditionalFormats.push({
			column: columnIndex,
			test: condition,
			format: this.#createFormatter(format)
		});
		return this;
	}

	/**
	 * Adds a row to the table
	 * @param {Array<*>} rowData - Array with cell data
	 * @returns {Table} The table instance for method chaining
	 * @throws {Error} If the number of cells doesn't match the expected column count
	 */
	addRow(rowData) {
		// If columnCount is not yet defined, derive it from this row
		if (this.#columnCount === null) {
			this.#columnCount = rowData.length;
		}

		// Check if the number of cells matches the expected column count
		if (rowData.length !== this.#columnCount) {
			throw new Error(`Error: Row with ${rowData.length} columns cannot be added, expected ${this.#columnCount}`);
		}

		this.#rows.push(rowData);
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
	 * Removes all ANSI formatting codes from all table data
	 * @returns {Table} The table instance for method chaining
	 */
	sanitizeData() {
		this.#headers = this.#headers.map(header => Ansi.stripFormatting(header));
		this.#rows = this.#rows.map(row =>
			row.map(cell => Ansi.stripFormatting(cell))
		);
		return this;
	}

	/**
	 * Returns the calculated width of the table
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

	// Private methods below

	/**
	 * Calculates the optimal width for each column
	 * @private
	 * @returns {Array<number>} An array with the width of each column
	 */
	#calculateColumnWidths() {
		const columnWidths = this.#headers.map(header =>
			Ansi.stripFormatting(String(header)).length
		);

		if (columnWidths.length === 0) {
			return Array(this.#columnCount).fill(5);
		}

		for (const row of this.#rows) {
			for (let i = 0; i < row.length; i++) {
				const cellWidth = Ansi.stripFormatting(String(row[i])).length;
				if (i >= columnWidths.length) {
					columnWidths[i] = cellWidth;
				} else {
					columnWidths[i] = Math.max(columnWidths[i], cellWidth);
				}
			}
		}

		return columnWidths;
	}

	/**
	 * Formats a cell based on column and conditional formatting
	 * @private
	 * @param {*} value - The cell value
	 * @param {number} columnIndex - The column index
	 * @returns {Function} The formatter for the cell
	 */
	#getCellFormatter(value, columnIndex) {
		for (const rule of this.#conditionalFormats) {
			if (rule.column === columnIndex && rule.test(value)) {
				return rule.format;
			}
		}

		return this.#columnFormats[columnIndex] || ((text) => text);
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

		/** Array for the output lines which already contains the top line */
		const lines = [borderColorFn(topBorder)];

		// Render headers (if available)
		if (this.#headers.length > 0) {
			/**
			 * variable to collect the title row.
			 * Like every row, the title row begins with the left border character
			 */
			let headerRow = borderColorFn(borderChars.borderVertical);

			// for each column
			for (let i = 0; i < this.#headers.length; i++) {
				const headerValue = this.#headers[i];
				// each cell starts with padding
				let headerCell = padString
				headerCell += String(headerValue).padEnd(columnWidths[i]);

				// Right padding is only needed for:
				// - last cell OR
				// - when column separators are used
				const isLastColumn = i === this.#headers.length - 1;
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
			lines.push(headerRow);

			// Add separator line
			lines.push(borderColorFn(midBorder));
		}

		/** memory aid for whether there is conditional formatting for the column */
		const formatterRecall = new Array(this.#columnCount);

		// Render data row(s)
		for (const row of this.#rows) {
			// for data rows too, each row starts with the left border character
			let dataRow = borderColorFn(borderChars.borderVertical);

			// Render data cell(s)
			for (let i = 0; i < row.length; i++) {
				// each cell starts with padding
				let cellString = padString;

				const rawValue = row[i];
				cellString += String(rawValue).padEnd(columnWidths[i]);

				/** the formatter to be applied to the current value */
				let cellFormatter;

				// Find the appropriate formatter:
				// a) if we have remembered a formatter for this column,
				//    then we use it again
				// b) if we have remembered 'true' for this column, one
				//    must be chosen according to the value (conditional formatting)
				// c) in all other cases (i.e. the first time) we need to find out
				//    whether there is conditional formatting for this column --> store true
				//    or whether the same formatting is always needed --> store the appropriate formatter
				if (typeof formatterRecall[i] === 'function') { // a)
					cellFormatter = formatterRecall[i];
				} else if (formatterRecall[i] === true) { // b)
					cellFormatter = this.#getCellFormatter(rawValue, i);
				} else { // c)
					formatterRecall[i] = this.#conditionalFormats.some(rule => rule.column === i)
					cellFormatter = this.#getCellFormatter(rawValue, i);
					if (formatterRecall[i] === false) {
						formatterRecall[i] = cellFormatter;
					}
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
			dataRow += borderColorFn(borderChars.borderVertical);
			lines.push(dataRow);
		} // end for (render data row)

		// Add bottom border
		lines.push(borderColorFn(bottomBorder));

		// Join all lines to a string
		return lines.join('\n');
	}
}


