import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, TextInput, Pressable, Alert, Switch, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFarmCode, getRations, getInventory, saveInventoryItem } from '@/lib/supabase-service';
import { runMigration, isMigrationDone } from '@/lib/migration';
import { FARM_CODE_KEY } from '@/lib/supabase-service';

interface BestandEntry {
  id: string;
  name: string;
  tracked: boolean;
  currentStock: number;
  warningEnabled: boolean;
  warningThreshold: number;
}

const parseAmount = (value: string): number => {
  const num = parseFloat(value.replace(',', '.'));
  return isNaN(num) ? 0 : Math.max(0, num);
};
const formatAmount = (value: number): string => value.toFixed(0);

export default function BestandScreen() {
  const colors = useColors();
  const [entries, setEntries] = useState<BestandEntry[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [thresholdValues, setThresholdValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState('');
  const [farmCode, setFarmCode] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const code = await getFarmCode();
      setFarmCode(code);
      if (!code) return;

      const rations = await getRations(code);
      const nameMap: Record<string, string> = {};
      const allComponentIds = new Set<string>();
      Object.values(rations).forEach((ration: any) => {
        if (ration.componentDefs) {
          ration.componentDefs.forEach((comp: any) => {
            nameMap[comp.id] = comp.name;
            allComponentIds.add(comp.id);
          });
        }
      });

      const existing = await getInventory(code);
      const merged: BestandEntry[] = Array.from(allComponentIds).map((id) => {
        if (existing[id]) return { ...existing[id], name: nameMap[id] || existing[id].name };
        return { id, name: nameMap[id] || id, tracked: false, currentStock: 0, warningEnabled: false, warningThreshold: 100 };
      });

      merged.sort((a, b) => { if (a.tracked !== b.tracked) return a.tracked ? -1 : 1; return a.name.localeCompare(b.name); });
      setEntries(merged);

      const ev: Record<string, string> = {};
      const tv: Record<string, string> = {};
      merged.forEach((e) => { ev[e.id] = e.currentStock.toString(); tv[e.id] = e.warningThreshold.toString(); });
      setEditValues(ev);
      setThresholdValues(tv);
    } catch (error) { console.error('Error loading bestand:', error); }
    finally { setIsLoading(false); }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const handleSave = async () => {
    if (!farmCode) return;
    setIsSaving(true);
    try {
      for (const entry of entries) {
        await saveInventoryItem(farmCode, {
          ...entry,
          currentStock: parseAmount(editValues[entry.id] || '0'),
          warningThreshold: parseAmount(thresholdValues[entry.id] || '100'),
        });
      }
      Alert.alert('Erfolg', 'Bestand gespeichert');
    } catch { Alert.alert('Fehler', 'Bestand konnte nicht gespeichert werden'); }
    finally { setIsSaving(false); }
  };

  const handleMigration = async () => {
    if (!farmCode) return;
    Alert.alert(
      'Alte Daten migrieren',
      'Hiermit werden alle lokalen Protokolle, Bestände und Rationen aus der alten App-Version nach Supabase übertragen. Fortfahren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Migrieren', onPress: async () => {
          setIsMigrating(true);
          try {
            // Migration-Flag zurücksetzen damit sie erneut läuft
            await AsyncStorage.removeItem('app:migration_done');
            const { logs, inventory } = await runMigration(farmCode, setMigrationProgress);
            Alert.alert('✅ Migration abgeschlossen', `${logs} Protokolleinträge und ${inventory} Bestandseinträge wurden übertragen.`);
            await loadData();
          } catch (e: any) {
            Alert.alert('Fehler', `Migration fehlgeschlagen: ${e?.message}`);
          } finally {
            setIsMigrating(false);
            setMigrationProgress('');
          }
        }},
      ]
    );
  };

  const handleSwitchFarm = () => {
    Alert.alert(
      'Betrieb wechseln',
      'Möchtest du den Betrieb wechseln? Du wirst zum Setup-Screen weitergeleitet.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Wechseln', style: 'destructive', onPress: async () => {
          await AsyncStorage.removeItem(FARM_CODE_KEY);
          // App neu starten durch State-Reset
          Alert.alert('Betrieb gewechselt', 'Bitte starte die App neu um den Setup-Screen zu sehen.');
        }},
      ]
    );
  };

  const toggleTracked = (id: string) => setEntries((prev) => prev.map((e) => e.id === id ? { ...e, tracked: !e.tracked } : e));
  const toggleWarning = (id: string) => setEntries((prev) => prev.map((e) => e.id === id ? { ...e, warningEnabled: !e.warningEnabled } : e));

  const trackedEntries = entries.filter((e) => e.tracked);
  const untrackedEntries = entries.filter((e) => !e.tracked);
  const warnings = trackedEntries.filter((e) => e.warningEnabled && parseAmount(editValues[e.id] || '0') <= e.warningThreshold);

  if (isLoading) {
    return (
      <ScreenContainer className="p-6">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted }}>Lade Bestand...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 gap-5">
          <View className="items-center gap-1">
            <Text className="text-3xl font-bold text-foreground">Bestand</Text>
            <Text className="text-sm text-muted text-center">Vorräte verwalten und Warnungen setzen</Text>
          </View>

          {warnings.length > 0 && (
            <View className="p-4 rounded-lg border gap-2" style={{ backgroundColor: '#fff3cd', borderColor: '#f59e0b' }}>
              <Text className="text-sm font-bold" style={{ color: '#92400e' }}>⚠️ Niedriger Bestand</Text>
              {warnings.map((e) => (
                <Text key={e.id} className="text-xs" style={{ color: '#92400e' }}>
                  {e.name}: noch {formatAmount(parseAmount(editValues[e.id] || '0'))} kg (Warnschwelle: {formatAmount(e.warningThreshold)} kg)
                </Text>
              ))}
            </View>
          )}

          {trackedEntries.length > 0 && (
            <View className="gap-4">
              <Text className="text-xs font-semibold text-muted uppercase">Verfolgte Komponenten</Text>
              {trackedEntries.map((entry) => {
                const stock = parseAmount(editValues[entry.id] || '0');
                const isLow = entry.warningEnabled && stock <= entry.warningThreshold;
                return (
                  <View key={entry.id} className="p-4 rounded-lg border gap-3" style={{ borderColor: isLow ? '#f59e0b' : colors.border, backgroundColor: colors.surface }}>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-sm font-bold text-foreground">{entry.name}</Text>
                      <View className="flex-row items-center gap-2">
                        {isLow && <Text style={{ color: '#f59e0b', fontSize: 12, fontWeight: '600' }}>⚠️</Text>}
                        <Switch value={entry.tracked} onValueChange={() => toggleTracked(entry.id)} trackColor={{ false: colors.border, true: colors.primary }} />
                      </View>
                    </View>
                    <View className="gap-1">
                      <Text className="text-xs text-muted">Aktueller Bestand</Text>
                      <View className="flex-row items-center gap-2 px-3 py-2 bg-background rounded-lg border" style={{ borderColor: colors.border }}>
                        <TextInput className="flex-1 text-foreground text-base font-semibold" placeholder="0" placeholderTextColor={colors.muted} keyboardType="decimal-pad" value={editValues[entry.id] || ''} onChangeText={(v) => setEditValues((prev) => ({ ...prev, [entry.id]: v }))} />
                        <Text className="text-sm text-muted">kg</Text>
                      </View>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-xs text-muted">Warnung aktivieren</Text>
                      <Switch value={entry.warningEnabled} onValueChange={() => toggleWarning(entry.id)} trackColor={{ false: colors.border, true: colors.primary }} />
                    </View>
                    {entry.warningEnabled && (
                      <View className="gap-1">
                        <Text className="text-xs text-muted">Warnschwelle</Text>
                        <View className="flex-row items-center gap-2 px-3 py-2 bg-background rounded-lg border" style={{ borderColor: colors.primary }}>
                          <TextInput className="flex-1 text-foreground text-base" placeholder="100" placeholderTextColor={colors.muted} keyboardType="decimal-pad" value={thresholdValues[entry.id] || ''} onChangeText={(v) => setThresholdValues((prev) => ({ ...prev, [entry.id]: v }))} />
                          <Text className="text-sm text-muted">kg</Text>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {untrackedEntries.length > 0 && (
            <View className="gap-2">
              <Text className="text-xs font-semibold text-muted uppercase">Nicht verfolgt</Text>
              <Text className="text-xs text-muted">Aktiviere den Schalter um eine Komponente zu verfolgen.</Text>
              {untrackedEntries.map((entry) => (
                <View key={entry.id} className="flex-row justify-between items-center p-3 rounded-lg border" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
                  <Text className="text-sm font-medium text-foreground">{entry.name}</Text>
                  <Switch value={entry.tracked} onValueChange={() => toggleTracked(entry.id)} trackColor={{ false: colors.border, true: colors.primary }} />
                </View>
              ))}
            </View>
          )}

          <Pressable onPress={handleSave} disabled={isSaving}
            style={({ pressed }) => [{ backgroundColor: colors.primary, borderRadius: 8, padding: 16, opacity: pressed || isSaving ? 0.8 : 1 }]}>
            <Text className="text-center font-semibold text-background text-base">{isSaving ? 'Speichert...' : 'Bestand speichern'}</Text>
          </Pressable>

          <View className="p-4 bg-primary/10 rounded-lg border border-primary/20">
            <Text className="text-xs text-foreground font-medium">💡 Nur verfolgte Komponenten werden nach jeder Fütterung automatisch abgezogen.</Text>
          </View>

          {/* Einstellungen */}
          <View className="gap-3 mt-4">
            <Text className="text-xs font-semibold text-muted uppercase">Einstellungen</Text>

            {isMigrating ? (
              <View className="p-4 bg-surface rounded-lg border border-border gap-2 items-center">
                <ActivityIndicator color={colors.primary} />
                <Text className="text-xs text-muted text-center">{migrationProgress || 'Migriere...'}</Text>
              </View>
            ) : (
              <Pressable onPress={handleMigration}
                style={({ pressed }) => [{ backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1, borderRadius: 8, padding: 14, opacity: pressed ? 0.8 : 1 }]}>
                <Text className="text-center font-semibold text-primary">🔄 Alte Daten migrieren</Text>
                <Text className="text-center text-xs text-muted mt-1">Protokolle und Bestand aus alter Version übertragen</Text>
              </Pressable>
            )}

            <Pressable onPress={handleSwitchFarm}
              style={({ pressed }) => [{ backgroundColor: colors.surface, borderColor: '#ef4444', borderWidth: 1, borderRadius: 8, padding: 14, opacity: pressed ? 0.8 : 1 }]}>
              <Text className="text-center font-semibold" style={{ color: '#ef4444' }}>🔑 Betrieb wechseln</Text>
              <Text className="text-center text-xs text-muted mt-1">Zu einem anderen Betrieb wechseln</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
