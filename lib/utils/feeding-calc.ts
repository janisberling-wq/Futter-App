/**
 * Utility-Funktionen für Fütterungsberechnungen
 */

import { FEEDING_COMPONENTS } from '../types/feeding';

/**
 * Berechnet die Gesamtsumme einer Grundration
 */
export function calculateTotalRation(components: Record<string, number>): number {
  return Object.values(components).reduce((sum, val) => sum + val, 0);
}

/**
 * Berechnet die Sollmengen für alle Komponenten basierend auf der Gesamtmenge
 */
export function calculatePlannedAmounts(
  baseRation: Record<string, number>,
  totalAmount: number
): Record<string, number> {
  const totalBase = calculateTotalRation(baseRation);
  if (totalBase === 0) return {};

  const planned: Record<string, number> = {};
  for (const [componentId, baseAmount] of Object.entries(baseRation)) {
    planned[componentId] = (baseAmount / totalBase) * totalAmount;
  }
  return planned;
}

/**
 * Passt die Sollmengen proportional an basierend auf der tatsächlich verfütterten Menge
 * einer Komponente
 */
export function adjustPlannedAmounts(
  currentPlanned: Record<string, number>,
  componentId: string,
  actualAmount: number,
  remainingComponentIds: string[]
): Record<string, number> {
  const plannedAmount = currentPlanned[componentId];
  if (!plannedAmount || plannedAmount === 0) {
    return currentPlanned;
  }

  // Berechne den Anpassungsfaktor
  const adjustmentFactor = actualAmount / plannedAmount;

  // Passe alle restlichen Komponenten an
  const adjusted = { ...currentPlanned };
  for (const compId of remainingComponentIds) {
    if (compId !== componentId) {
      adjusted[compId] = (adjusted[compId] || 0) * adjustmentFactor;
    }
  }
  adjusted[componentId] = actualAmount;

  return adjusted;
}

/**
 * Formatiert eine Zahl auf 2 Dezimalstellen
 */
export function formatAmount(value: number): string {
  return value.toFixed(2);
}

/**
 * Parst einen String zu einer Zahl (für Input-Felder)
 */
export function parseAmount(value: string): number {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : Math.max(0, parsed);
}

/**
 * Validiert, ob eine Eingabe gültig ist
 */
export function isValidAmount(value: string): boolean {
  const parsed = parseFloat(value);
  return !isNaN(parsed) && parsed >= 0;
}

/**
 * Berechnet die Abweichung zwischen Soll- und Ist-Menge in Prozent
 */
export function calculateDeviation(
  planned: number,
  actual: number
): number {
  if (planned === 0) return 0;
  return ((actual - planned) / planned) * 100;
}

/**
 * Formatiert die Abweichung als String mit Vorzeichen
 */
export function formatDeviation(planned: number, actual: number): string {
  const deviation = calculateDeviation(planned, actual);
  const sign = deviation > 0 ? '+' : '';
  return `${sign}${deviation.toFixed(1)}%`;
}

/**
 * Gibt die Komponenten in der richtigen Reihenfolge zurück
 */
export function getComponentsInOrder(
  componentIds: string[]
): Array<{ id: string; name: string }> {
  const componentMap = new Map(FEEDING_COMPONENTS.map((c) => [c.id, c]));
  return componentIds
    .map((id) => componentMap.get(id))
    .filter((c) => c !== undefined) as Array<{ id: string; name: string }>;
}

/**
 * Generiert eine eindeutige ID
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
