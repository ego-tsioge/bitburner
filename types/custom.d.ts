/**
 * Erweiterte Typdefinitionen für Bitburner
 * 
 * Diese Datei erweitert die offiziellen NetscriptDefinitions.d.ts
 * durch Module Augmentation und überschreibt bestimmte Methoden,
 * um präzisere Typisierung zu ermöglichen.
 */

// Module Augmentation für /types/NetscriptDefinitions
declare module '/types/NetscriptDefinitions' {
  /**
   * Parse command line flags - erweiterte Version mit präziserer Typisierung.
   * Das _ Property enthält immer ein Array von positionalen Argumenten.
   */
  export interface NS {
    flags(schema: [string, string | number | boolean | string[]][]): {
      _: (string | number | boolean)[];
      [key: string]: string | number | boolean | string[];
    };
  }
}

// Leerer Export macht diese Datei zu einem Modul
export {};
