import { describe, it, expect } from 'vitest';
import {
  calculateTotalRation,
  calculatePlannedAmounts,
  adjustPlannedAmounts,
  calculateDeviation,
  formatDeviation,
  parseAmount,
  isValidAmount,
} from '../lib/utils/feeding-calc';

// Note: These tests use relative imports because vitest doesn't resolve @ aliases in test files
// The functions are tested directly from the source file

describe('Feeding Calculations', () => {
  describe('calculateTotalRation', () => {
    it('should sum all components correctly', () => {
      const components = {
        maissilage: 15,
        grassilage: 10,
        stroh: 2,
        ausgleichsfutter: 3,
        kraftfutter: 8,
        wasser: 50,
      };
      expect(calculateTotalRation(components)).toBe(88);
    });

    it('should handle empty object', () => {
      expect(calculateTotalRation({})).toBe(0);
    });

    it('should handle zero values', () => {
      const components = { a: 0, b: 0, c: 0 };
      expect(calculateTotalRation(components)).toBe(0);
    });
  });

  describe('calculatePlannedAmounts', () => {
    it('should calculate proportional amounts correctly', () => {
      const baseRation = {
        maissilage: 15,
        grassilage: 10,
        stroh: 2,
      };
      const totalAmount = 270; // 27 * 10
      const result = calculatePlannedAmounts(baseRation, totalAmount);

      expect(result.maissilage).toBeCloseTo(150, 0); // 15/27 * 270
      expect(result.grassilage).toBeCloseTo(100, 0); // 10/27 * 270
      expect(result.stroh).toBeCloseTo(20, 0); // 2/27 * 270
    });

    it('should handle zero total amount', () => {
      const baseRation = { a: 10, b: 20 };
      const result = calculatePlannedAmounts(baseRation, 0);
      expect(result.a).toBe(0);
      expect(result.b).toBe(0);
    });

    it('should handle zero base ration', () => {
      const baseRation = { a: 0, b: 0 };
      const result = calculatePlannedAmounts(baseRation, 100);
      expect(Object.keys(result).length).toBe(0);
    });
  });

  describe('adjustPlannedAmounts', () => {
    it('should adjust remaining components proportionally', () => {
      const currentPlanned = {
        maissilage: 75,
        grassilage: 50,
        stroh: 10,
      };
      const adjusted = adjustPlannedAmounts(
        currentPlanned,
        'maissilage',
        80,
        ['grassilage', 'stroh']
      );

      // Adjustment factor: 80 / 75 = 1.0667
      expect(adjusted.maissilage).toBe(80);
      expect(adjusted.grassilage).toBeCloseTo(53.33, 1);
      expect(adjusted.stroh).toBeCloseTo(10.67, 1);
    });

    it('should handle zero planned amount', () => {
      const currentPlanned = { a: 0, b: 50 };
      const adjusted = adjustPlannedAmounts(currentPlanned, 'a', 10, ['b']);
      // When planned amount is 0, the adjustment factor is undefined, so component is not updated
      expect(adjusted.a).toBe(0);
      expect(adjusted.b).toBe(50); // No change
    });
  });

  describe('calculateDeviation', () => {
    it('should calculate positive deviation correctly', () => {
      const deviation = calculateDeviation(100, 110);
      expect(deviation).toBe(10);
    });

    it('should calculate negative deviation correctly', () => {
      const deviation = calculateDeviation(100, 90);
      expect(deviation).toBe(-10);
    });

    it('should return 0 for equal values', () => {
      const deviation = calculateDeviation(100, 100);
      expect(deviation).toBe(0);
    });

    it('should handle zero planned amount', () => {
      const deviation = calculateDeviation(0, 100);
      expect(deviation).toBe(0);
    });
  });

  describe('formatDeviation', () => {
    it('should format positive deviation with plus sign', () => {
      expect(formatDeviation(100, 110)).toBe('+10.0%');
    });

    it('should format negative deviation with minus sign', () => {
      expect(formatDeviation(100, 90)).toBe('-10.0%');
    });

    it('should format zero deviation', () => {
      expect(formatDeviation(100, 100)).toBe('0.0%');
    });
  });

  describe('parseAmount', () => {
    it('should parse valid decimal string', () => {
      expect(parseAmount('123.45')).toBe(123.45);
    });

    it('should parse integer string', () => {
      expect(parseAmount('100')).toBe(100);
    });

    it('should return 0 for invalid input', () => {
      expect(parseAmount('abc')).toBe(0);
    });

    it('should return 0 for negative values', () => {
      expect(parseAmount('-50')).toBe(0);
    });

    it('should handle empty string', () => {
      expect(parseAmount('')).toBe(0);
    });
  });

  describe('isValidAmount', () => {
    it('should accept valid decimal', () => {
      expect(isValidAmount('123.45')).toBe(true);
    });

    it('should accept zero', () => {
      expect(isValidAmount('0')).toBe(true);
    });

    it('should reject negative values', () => {
      expect(isValidAmount('-50')).toBe(false);
    });

    it('should reject non-numeric input', () => {
      expect(isValidAmount('abc')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidAmount('')).toBe(false);
    });
  });
});
