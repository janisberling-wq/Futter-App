import { describe, it, expect } from 'vitest';
import {
  generateCSVData,
  generateHTMLForPDF,
  generateExportFileName,
} from '../lib/utils/pdf-export';
import { FeedingSession } from '../lib/types/feeding';

describe('PDF Export Utilities', () => {
  const mockSession: FeedingSession = {
    id: 'session-1',
    animalGroupId: 'milchkuehe',
    timestamp: new Date('2026-05-18T10:30:00').getTime(),
    totalAmount: 100,
    plannedAmounts: {
      maissilage: 30,
      grassilage: 20,
      stroh: 5,
      ausgleichsfutter: 10,
      kraftfutter: 25,
      wasser: 10,
    },
    actualAmounts: {
      maissilage: 32,
      grassilage: 18,
      stroh: 5,
      ausgleichsfutter: 10,
      kraftfutter: 25,
      wasser: 10,
    },
    completed: true,
  };

  describe('generateCSVData', () => {
    it('should generate CSV with headers', () => {
      const csv = generateCSVData({
        title: 'Test Export',
        sessions: [mockSession],
      } as any);

      expect(csv).toContain('"Test Export"');
      expect(csv).toContain('Datum');
      expect(csv).toContain('Tiergruppe');
      expect(csv).toContain('Gesamtmenge (kg)');
    });

    it('should include all component columns', () => {
      const csv = generateCSVData({
        title: 'Test Export',
        sessions: [mockSession],
      } as any);

      expect(csv).toContain('Maissilage (kg)');
      expect(csv).toContain('Grassilage (kg)');
      expect(csv).toContain('Stroh (kg)');
      expect(csv).toContain('Ausgleichsfutter (kg)');
      expect(csv).toContain('Kraftfutter (kg)');
      expect(csv).toContain('Wasser (kg)');
    });

    it('should format numbers with 2 decimals', () => {
      const csv = generateCSVData({
        title: 'Test Export',
        sessions: [mockSession],
      } as any);

      expect(csv).toContain('100.00');
      expect(csv).toContain('32.00');
      expect(csv).toContain('18.00');
    });

    it('should handle multiple sessions', () => {
      const session2: FeedingSession = {
        ...mockSession,
        id: 'session-2',
        animalGroupId: 'fresser' as const,
      };

      const csv = generateCSVData({
        title: 'Test Export',
        sessions: [mockSession, session2],
      } as any);

      const lines = csv.split('\n');
      // Header + 2 data rows + empty lines
      expect(lines.length).toBeGreaterThan(5);
    });

    it('should handle empty sessions', () => {
      const csv = generateCSVData({
        title: 'Test Export',
        sessions: [],
      } as any);

      expect(csv).toContain('Datum');
      expect(csv).not.toContain('100.00');
    });

    it('should include group filter info', () => {
      const csv = generateCSVData({
        title: 'Test Export',
        sessions: [mockSession],
        groupId: 'milchkuehe',
      } as any);

      expect(csv).toContain('Milchkühe');
    });
  });

  describe('generateHTMLForPDF', () => {
    it('should generate valid HTML', () => {
      const html = generateHTMLForPDF({
        title: 'Test Export',
        sessions: [mockSession],
      } as any);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<table>');
      expect(html).toContain('</html>');
    });

    it('should include title', () => {
      const html = generateHTMLForPDF({
        title: 'My Test Report',
        sessions: [mockSession],
      } as any);

      expect(html).toContain('My Test Report');
    });

    it('should include table headers', () => {
      const html = generateHTMLForPDF({
        title: 'Test Export',
        sessions: [mockSession],
      } as any);

      expect(html).toContain('<th>Datum</th>');
      expect(html).toContain('<th>Tiergruppe</th>');
      expect(html).toContain('<th>Gesamtmenge (kg)</th>');
    });

    it('should include session data in table rows', () => {
      const html = generateHTMLForPDF({
        title: 'Test Export',
        sessions: [mockSession],
      } as any);

      expect(html).toContain('<td>100.00</td>');
      expect(html).toContain('<td>32.00</td>');
    });

    it('should include CSS styling', () => {
      const html = generateHTMLForPDF({
        title: 'Test Export',
        sessions: [mockSession],
      } as any);

      expect(html).toContain('<style>');
      expect(html).toContain('background-color');
      expect(html).toContain('border-collapse');
    });

    it('should include export date', () => {
      const html = generateHTMLForPDF({
        title: 'Test Export',
        sessions: [mockSession],
      } as any);

      expect(html).toContain('Exportdatum');
    });

    it('should include entry count', () => {
      const html = generateHTMLForPDF({
        title: 'Test Export',
        sessions: [mockSession, mockSession],
      } as any);

      expect(html).toMatch(/Anzahl Eintr.*2/);
      // Check that the count is in the info section
      expect(html).toContain('<strong>Anzahl Einträge:</strong>')
    });
  });

  describe('generateExportFileName', () => {
    it('should generate filename with date', () => {
      const fileName = generateExportFileName();

      expect(fileName).toContain('FutterRation_');
      expect(fileName).toContain('.csv');
      expect(fileName).toMatch(/\d{4}-\d{2}-\d{2}/); // YYYY-MM-DD format
    });

    it('should include group name in filename', () => {
      const fileName = generateExportFileName('milchkuehe');

      expect(fileName).toContain('Milchkühe');
      expect(fileName).toContain('.csv');
    });

    it('should use "alle" for undefined group', () => {
      const fileName = generateExportFileName();

      expect(fileName).toContain('alle');
      expect(fileName).toContain('.csv');
    });

    it('should have consistent format', () => {
      const fileName = generateExportFileName('fresser');

      expect(fileName).toMatch(/^FutterRation_.*_\d{4}-\d{2}-\d{2}\.csv$/);
    });
  });
});
