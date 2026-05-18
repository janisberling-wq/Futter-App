# FutterRation App – Design Plan

## Übersicht
Die App verwaltet Futterrationen für Milchkühe, Fresser und Bullen. Benutzer hinterlegen Grundrationen, geben beim Füttern die Gesamtmenge ein und passen einzelne Komponenten an, wobei die restlichen Komponenten proportional angepasst werden.

---

## Bildschirme (Screen List)

### 1. **Home / Tiergruppen-Auswahl**
- Drei große Karten für die Tiergruppen: Milchkühe, Fresser, Bullen
- Jede Karte zeigt:
  - Tiergruppen-Name
  - Anzahl der Tiere (falls hinterlegt)
  - Button zum Öffnen der Fütterung oder Verwaltung
- Unten: Tab-Navigation zu "Füttern", "Konfiguration", "Protokoll"

### 2. **Konfiguration / Grundrationen**
- Auswahl der Tiergruppe (oben)
- Formular zur Eingabe der Grundration pro Tier (in kg Frischmasse):
  - Maissilage
  - Grassilage
  - Stroh
  - Ausgleichsfutter
  - Kraftfutter
  - Wasser
- Speichern-Button
- Anzeige der aktuellen Grundration

### 3. **Fütterungs-Modus**
- Auswahl der Tiergruppe (oben)
- **Eingabe der Gesamtmenge**: Benutzer gibt die gewünschte Gesamtmenge (in kg) ein
- **Berechnung der Sollmengen**: App berechnet die Sollmenge jeder Komponente basierend auf der Grundration
- **Komponenten-Liste** (scrollbar):
  - Jede Komponente zeigt:
    - Name der Komponente
    - Sollmenge (kg)
    - Eingabefeld für tatsächlich verfütterte Menge
    - Checkbox zum Abhaken
  - Nach Eingabe einer Ist-Menge werden die restlichen Komponenten proportional angepasst
- **Fortschrittsanzeige**: Wie viele Komponenten abgehakt sind
- **Speichern-Button**: Speichert die Fütterung im Protokoll

### 4. **Protokoll / Historie**
- Liste aller abgeschlossenen Fütterungen
- Jeder Eintrag zeigt:
  - Datum und Uhrzeit
  - Tiergruppe
  - Gesamtmenge
  - Kurzzusammenfassung der verfütterten Mengen
- Tap auf Eintrag: Detailansicht mit allen Komponenten

### 5. **Detailansicht (Protokoll)**
- Vollständige Übersicht einer abgeschlossenen Fütterung
- Vergleich: Sollmenge vs. Ist-Menge für jede Komponente
- Zurück-Button zur Protokoll-Liste

---

## Primärer Inhalt und Funktionalität

### **Tiergruppen**
- **Milchkühe**: Separate Grundration
- **Fresser**: Separate Grundration
- **Bullen**: Separate Grundration

### **Grundration (pro Tier in kg Frischmasse)**
Besteht aus 6 Komponenten:
1. Maissilage
2. Grassilage
3. Stroh
4. Ausgleichsfutter
5. Kraftfutter
6. Wasser

### **Fütterungslogik**
1. Benutzer wählt Tiergruppe
2. Benutzer gibt **Gesamtmenge** ein (z. B. 500 kg für alle Tiere)
3. App berechnet die Sollmenge jeder Komponente:
   - `Sollmenge_Komponente = Grundration_Komponente × (Gesamtmenge / Summe_Grundration)`
4. Benutzer gibt die **Ist-Menge** der ersten Komponente ein
5. App berechnet den **Anpassungsfaktor**:
   - `Faktor = Ist-Menge / Sollmenge`
6. App passt alle **noch ausstehenden Komponenten** an:
   - `Neue_Sollmenge = Alte_Sollmenge × Faktor`
7. Benutzer arbeitet sich Komponente für Komponente durch
8. Nach Abschluss wird die Fütterung gespeichert

### **Protokollierung**
- Jede abgeschlossene Fütterung wird mit Timestamp, Tiergruppe und allen Mengen gespeichert
- Benutzer kann die Historie anschauen und frühere Fütterungen vergleichen

---

## Hauptbenutzerflüsse

### **Flow 1: Grundration hinterlegen**
1. Benutzer öffnet "Konfiguration"
2. Wählt eine Tiergruppe
3. Gibt die Grundration pro Tier ein (6 Komponenten)
4. Speichert die Konfiguration
5. App zeigt Bestätigung

### **Flow 2: Tägliche Fütterung**
1. Benutzer öffnet "Füttern"
2. Wählt eine Tiergruppe
3. Gibt die gewünschte **Gesamtmenge** ein (z. B. 500 kg)
4. App zeigt die **Sollmengen** aller Komponenten
5. Benutzer gibt die **Ist-Menge** der ersten Komponente ein
6. App passt die restlichen Sollmengen proportional an
7. Benutzer arbeitet sich durch die restlichen Komponenten
8. Nach jeder Eingabe: Komponente abhaken
9. Speichern-Button speichert die Fütterung
10. App zeigt Bestätigung und kehrt zur Tiergruppen-Auswahl zurück

### **Flow 3: Fütterungshistorie anschauen**
1. Benutzer öffnet "Protokoll"
2. Sieht eine Liste aller bisherigen Fütterungen
3. Tap auf einen Eintrag zeigt Details (Sollmenge vs. Ist-Menge)
4. Zurück-Button kehrt zur Liste zurück

---

## Farbwahl

| Element | Farbe | Verwendung |
|---------|-------|-----------|
| **Primary** | `#2E7D32` (Grün) | Buttons, Highlights, Bestätigung |
| **Background** | `#FFFFFF` (Weiß) | Hintergrund |
| **Surface** | `#F5F5F5` (Hellgrau) | Karten, Input-Felder |
| **Foreground** | `#212121` (Dunkelgrau) | Text |
| **Muted** | `#757575` (Grau) | Sekundärer Text |
| **Border** | `#E0E0E0` (Hellgrau) | Trennlinien |
| **Success** | `#4CAF50` (Grün) | Erfolgreiche Aktionen |
| **Warning** | `#FFC107` (Gelb) | Warnungen |
| **Error** | `#F44336` (Rot) | Fehler |

Das Grün symbolisiert Landwirtschaft und Natur, passt perfekt zu einer Fütterungs-App.

---

## Designprinzipien

- **Einfachheit**: Klare, fokussierte Screens ohne Ablenkung
- **Effizienz**: Schnelle Eingabe und Verarbeitung beim Füttern
- **Feedback**: Benutzer sieht sofort, wie sich die Mengen anpassen
- **iOS-Stil**: Folgt Apple Human Interface Guidelines (HIG)
  - Großzügige Abstände
  - Klare Hierarchie
  - Intuitive Gesten (Tap, Scroll)
  - Haptic Feedback bei wichtigen Aktionen
- **One-Handed Usage**: Alle wichtigen Elemente sind mit einer Hand erreichbar

---

## Datenstruktur (Vorschau)

```typescript
// Tiergruppe
interface AnimalGroup {
  id: string; // "milchkuehe", "fresser", "bullen"
  name: string;
  baseRation: {
    maissilage: number;
    grassilage: number;
    stroh: number;
    ausgleichsfutter: number;
    kraftfutter: number;
    wasser: number;
  };
}

// Fütterungseintrag
interface FeedingLog {
  id: string;
  animalGroupId: string;
  timestamp: Date;
  totalAmount: number; // Gesamtmenge in kg
  components: {
    name: string;
    plannedAmount: number;
    actualAmount: number;
  }[];
}
```

---

## Nächste Schritte

1. ✅ Design-Plan erstellt
2. ⏳ Datenmodell implementieren (AsyncStorage)
3. ⏳ Navigation und Screens aufbauen
4. ⏳ Fütterungslogik implementieren
5. ⏳ Protokollierung integrieren
6. ⏳ App testen und finalisieren
