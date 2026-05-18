/**
 * Utility-Funktionen für PDF-Export von Fütterungsdaten
 */

import { FeedingSession, AnimalGroupId, ANIMAL_GROUPS } from '../types/feeding';

interface PDFExportData {
  title: string;
  sessions: FeedingSession[];
  groupId?: AnimalGroupId;
}

/**
 * Generiert CSV-Daten aus Fütterungssessions
 */
export function generateCSVData(data: PDFExportData): string {
  const { title, sessions, groupId } = data;
  const groupName = groupId
    ? ANIMAL_GROUPS.find((g) => g.id === groupId)?.name || groupId
    : 'Alle Gruppen';

  const lines: string[] = [];

  // Header
  lines.push(`"${title}"`);
  lines.push(`"Tiergruppe: ${groupName}"`);
  lines.push(`"Exportdatum: ${new Date().toLocaleDateString('de-DE')}"`);
  lines.push('');

  // Spaltenüberschriften
  lines.push(
    '"Datum","Tiergruppe","Gesamtmenge (kg)","Maissilage (kg)","Grassilage (kg)","Stroh (kg)","Ausgleichsfutter (kg)","Kraftfutter (kg)","Wasser (kg)"'
  );

  // Datenzeilen
  sessions.forEach((session) => {
    const date = new Date(session.timestamp).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const groupName = ANIMAL_GROUPS.find((g) => g.id === session.animalGroupId)?.name || session.animalGroupId;

    const row = [
      `"${date}"`,
      `"${groupName}"`,
      `"${session.totalAmount.toFixed(2)}"`,
      `"${(session.actualAmounts.maissilage || 0).toFixed(2)}"`,
      `"${(session.actualAmounts.grassilage || 0).toFixed(2)}"`,
      `"${(session.actualAmounts.stroh || 0).toFixed(2)}"`,
      `"${(session.actualAmounts.ausgleichsfutter || 0).toFixed(2)}"`,
      `"${(session.actualAmounts.kraftfutter || 0).toFixed(2)}"`,
      `"${(session.actualAmounts.wasser || 0).toFixed(2)}"`,
    ].join(',');

    lines.push(row);
  });

  return lines.join('\n');
}

/**
 * Generiert HTML für PDF-Export
 */
export function generateHTMLForPDF(data: PDFExportData): string {
  const { title, sessions, groupId } = data;
  const groupName = groupId
    ? ANIMAL_GROUPS.find((g) => g.id === groupId)?.name || groupId
    : 'Alle Gruppen';

  const tableRows = sessions
    .map((session) => {
      const date = new Date(session.timestamp).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const gName = ANIMAL_GROUPS.find((g) => g.id === session.animalGroupId)?.name || session.animalGroupId;

      return `
        <tr>
          <td>${date}</td>
          <td>${gName}</td>
          <td>${session.totalAmount.toFixed(2)}</td>
          <td>${(session.actualAmounts.maissilage || 0).toFixed(2)}</td>
          <td>${(session.actualAmounts.grassilage || 0).toFixed(2)}</td>
          <td>${(session.actualAmounts.stroh || 0).toFixed(2)}</td>
          <td>${(session.actualAmounts.ausgleichsfutter || 0).toFixed(2)}</td>
          <td>${(session.actualAmounts.kraftfutter || 0).toFixed(2)}</td>
          <td>${(session.actualAmounts.wasser || 0).toFixed(2)}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          color: #333;
        }
        h1 {
          color: #2c5f2d;
          border-bottom: 2px solid #2c5f2d;
          padding-bottom: 10px;
        }
        .info {
          margin: 10px 0;
          font-size: 14px;
          color: #666;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th {
          background-color: #2c5f2d;
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: bold;
          border: 1px solid #1a3a1b;
        }
        td {
          padding: 10px 12px;
          border: 1px solid #ddd;
          text-align: right;
        }
        td:first-child,
        td:nth-child(2) {
          text-align: left;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        tr:hover {
          background-color: #f0f0f0;
        }
        .footer {
          margin-top: 30px;
          font-size: 12px;
          color: #999;
          text-align: center;
          border-top: 1px solid #ddd;
          padding-top: 10px;
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="info">
        <p><strong>Tiergruppe:</strong> ${groupName}</p>
        <p><strong>Exportdatum:</strong> ${new Date().toLocaleDateString('de-DE')} ${new Date().toLocaleTimeString('de-DE')}</p>
        <p><strong>Anzahl Einträge:</strong> ${sessions.length}</p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Datum</th>
            <th>Tiergruppe</th>
            <th>Gesamtmenge (kg)</th>
            <th>Maissilage (kg)</th>
            <th>Grassilage (kg)</th>
            <th>Stroh (kg)</th>
            <th>Ausgleichsfutter (kg)</th>
            <th>Kraftfutter (kg)</th>
            <th>Wasser (kg)</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      
      <div class="footer">
        <p>FutterRation App - Fütterungsprotokoll</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generiert einen Dateinamen für den Export
 */
export function generateExportFileName(groupId?: AnimalGroupId): string {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const groupName = groupId
    ? ANIMAL_GROUPS.find((g) => g.id === groupId)?.name || groupId
    : 'alle';

  return `FutterRation_${groupName}_${dateStr}.csv`;
}
