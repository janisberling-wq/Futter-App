import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, Pressable, Share, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANIMAL_GROUPS = [
  { id: 'milchkuehe', name: 'Milchkühe' },
  { id: 'fresser', name: 'Fresser' },
  { id: 'bullen', name: 'Bullen' },
];

const TIME_RANGES = [
  { id: '7', label: '7 Tage' },
  { id: '30', label: '30 Tage' },
  { id: '90', label: '90 Tage' },
  { id: 'all', label: 'Alle' },
];

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getGroupName = (groupId: string) =>
  ANIMAL_GROUPS.find((g) => g.id === groupId)?.name || groupId;

export default function ProtocolScreen() {
  const colors = useColors();
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('30');
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadAllLogs = async () => {
    try {
      const groups = ['milchkuehe', 'fresser', 'bullen'];
      let combined: any[] = [];
      for (const groupId of groups) {
        const data = await AsyncStorage.getItem(`logs_${groupId}`);
        if (data) {
          const logs = JSON.parse(data);
          combined = [...combined, ...logs];
        }
      }
      combined.sort((a, b) => b.timestamp - a.timestamp);
      setAllLogs(combined);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  useEffect(() => {
    loadAllLogs();
  }, []);

  useEffect(() => {
    let logs = allLogs;
    if (selectedGroupId !== 'all') {
      logs = logs.filter((log) => log.animalGroupId === selectedGroupId);
    }
    if (selectedTimeRange !== 'all') {
      const days = parseInt(selectedTimeRange);
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      logs = logs.filter((log) => log.timestamp >= cutoff);
    }
    setFilteredLogs(logs);
  }, [allLogs, selectedGroupId, selectedTimeRange]);

  const stats = React.useMemo(() => {
    if (filteredLogs.length === 0) return null;
    const totalFeedings = filteredLogs.length;
    const totalAmount = filteredLogs.reduce((sum, log) => sum + (log.totalAmount || 0), 0);
    const avgAmount = totalAmount / totalFeedings;

    const componentKeys = new Set<string>();
    filteredLogs.forEach((log) => {
      Object.keys(log.actualAmounts || {}).forEach((k) => componentKeys.add(k));
    });

    const componentStats: Record<string, { name: string; avgActual: number; avgPlanned: number; avgDeviation: number; count: number }> = {};
    componentKeys.forEach((key) => {
      const entries = filteredLogs.filter(
        (log) => log.actualAmounts?.[key] !== undefined && log.plannedAmounts?.[key] !== undefined
      );
      if (entries.length === 0) return;
      const avgActual = entries.reduce((sum, log) => sum + (log.actualAmounts[key] || 0), 0) / entries.length;
      const avgPlanned = entries.reduce((sum, log) => sum + (log.plannedAmounts[key] || 0), 0) / entries.length;
      componentStats[key] = { name: key, avgActual, avgPlanned, avgDeviation: avgActual - avgPlanned, count: entries.length };
    });

    return { totalFeedings, totalAmount, avgAmount, componentStats };
  }, [filteredLogs]);

  const handleExportCSV = async () => {
    try {
      let csv = 'Datum,Tiergruppe,Gesamtmenge (kg)';
      const allKeys = new Set<string>();
      filteredLogs.forEach((log) => Object.keys(log.actualAmounts || {}).forEach((k) => allKeys.add(k)));
      const keys = Array.from(allKeys);
      keys.forEach((k) => { csv += `,${k} Soll (kg),${k} Ist (kg),${k} Abw. (kg)`; });
      csv += '\n';
      for (const log of filteredLogs) {
        csv += `${formatDate(log.timestamp)},${getGroupName(log.animalGroupId)},${log.totalAmount.toFixed(2)}`;
        keys.forEach((k) => {
          const planned = (log.plannedAmounts?.[k] || 0).toFixed(2);
          const actual = (log.actualAmounts?.[k] || 0).toFixed(2);
          const dev = ((log.actualAmounts?.[k] || 0) - (log.plannedAmounts?.[k] || 0)).toFixed(2);
          csv += `,${planned},${actual},${dev}`;
        });
        csv += '\n';
      }
      await Share.share({ message: csv, title: 'FutterRation_Protokoll.csv' });
    } catch (error) {
      Alert.alert('Fehler', 'Export fehlgeschlagen');
    }
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 gap-5">
          <View className="items-center gap-1">
            <Text className="text-3xl font-bold text-foreground">Protokoll</Text>
            <Text className="text-sm text-muted text-center">Übersicht aller Fütterungen</Text>
          </View>

          {/* Group Filter */}
          <View className="gap-2">
            <Text className="text-xs font-semibold text-muted uppercase">Tiergruppe</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {[{ id: 'all', name: 'Alle' }, ...ANIMAL_GROUPS].map((group) => (
                  <Pressable
                    key={group.id}
                    onPress={() => setSelectedGroupId(group.id)}
                    style={({ pressed }) => [{
                      backgroundColor: selectedGroupId === group.id ? colors.primary : colors.surface,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: 8,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      opacity: pressed ? 0.8 : 1,
                    }]}
                  >
                    <Text className={selectedGroupId === group.id ? 'font-semibold text-background text-sm' : 'font-medium text-foreground text-sm'}>
                      {group.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Time Range Filter */}
          <View className="gap-2">
            <Text className="text-xs font-semibold text-muted uppercase">Zeitraum</Text>
            <View className="flex-row gap-2">
              {TIME_RANGES.map((range) => (
                <Pressable
                  key={range.id}
                  onPress={() => setSelectedTimeRange(range.id)}
                  style={({ pressed }) => [{
                    flex: 1,
                    backgroundColor: selectedTimeRange === range.id ? colors.primary : colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingVertical: 8,
                    alignItems: 'center',
                    opacity: pressed ? 0.8 : 1,
                  }]}
                >
                  <Text className={selectedTimeRange === range.id ? 'font-semibold text-background text-xs' : 'font-medium text-foreground text-xs'}>
                    {range.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {filteredLogs.length === 0 ? (
            <View className="flex-1 items-center justify-center gap-3 py-12">
              <Text className="text-lg font-semibold text-foreground">Keine Einträge</Text>
              <Text className="text-sm text-muted text-center">
                Für diesen Zeitraum wurden keine Fütterungen gefunden.
              </Text>
            </View>
          ) : (
            <>
              {/* Summary Stats */}
              {stats && (
                <View className="gap-3">
                  <Text className="text-xs font-semibold text-muted uppercase">Zusammenfassung</Text>
                  <View className="flex-row gap-3">
                    <View className="flex-1 p-3 bg-primary/10 rounded-lg border border-primary/20 items-center">
                      <Text className="text-2xl font-bold text-primary">{stats.totalFeedings}</Text>
                      <Text className="text-xs text-muted text-center">Fütterungen</Text>
                    </View>
                    <View className="flex-1 p-3 bg-primary/10 rounded-lg border border-primary/20 items-center">
                      <Text className="text-2xl font-bold text-primary">{stats.totalAmount.toFixed(0)}</Text>
                      <Text className="text-xs text-muted text-center">kg gesamt</Text>
                    </View>
                    <View className="flex-1 p-3 bg-primary/10 rounded-lg border border-primary/20 items-center">
                      <Text className="text-2xl font-bold text-primary">{stats.avgAmount.toFixed(0)}</Text>
                      <Text className="text-xs text-muted text-center">kg Ø/Fütterung</Text>
                    </View>
                  </View>

                  {Object.keys(stats.componentStats).length > 0 && (
                    <View className="gap-2">
                      <Text className="text-xs font-semibold text-muted uppercase">Ø pro Komponente</Text>
                      <View className="bg-surface rounded-lg border border-border overflow-hidden">
                        <View className="flex-row px-3 py-2" style={{ backgroundColor: colors.border }}>
                          <Text className="flex-1 text-xs font-bold text-foreground">Komponente</Text>
                          <Text className="w-20 text-xs font-bold text-foreground text-right">Ø Soll</Text>
                          <Text className="w-20 text-xs font-bold text-foreground text-right">Ø Ist</Text>
                          <Text className="w-20 text-xs font-bold text-foreground text-right">Ø Abw.</Text>
                        </View>
                        {Object.entries(stats.componentStats).map(([key, s]) => {
                          const isPositive = s.avgDeviation > 0.05;
                          const isNegative = s.avgDeviation < -0.05;
                          return (
                            <View key={key} className="flex-row px-3 py-2" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                              <Text className="flex-1 text-xs text-foreground" numberOfLines={1}>{s.name}</Text>
                              <Text className="w-20 text-xs text-muted text-right">{s.avgPlanned.toFixed(1)} kg</Text>
                              <Text className="w-20 text-xs text-foreground text-right">{s.avgActual.toFixed(1)} kg</Text>
                              <Text className="w-20 text-xs font-semibold text-right" style={{ color: isPositive ? '#f97316' : isNegative ? '#3b82f6' : colors.success }}>
                                {isPositive ? '+' : ''}{s.avgDeviation.toFixed(1)} kg
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Export */}
              <Pressable
                onPress={handleExportCSV}
                style={({ pressed }) => [{
                  backgroundColor: colors.surface,
                  borderColor: colors.primary,
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 12,
                  opacity: pressed ? 0.8 : 1,
                }]}
              >
                <Text className="text-center font-semibold text-primary">
                  📥 CSV exportieren ({filteredLogs.length} Einträge)
                </Text>
              </Pressable>

              {/* Log Entries */}
              <View className="gap-2">
                <Text className="text-xs font-semibold text-muted uppercase">Einträge ({filteredLogs.length})</Text>
                {filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const componentKeys = Object.keys(log.actualAmounts || {});
                  return (
                    <Pressable
                      key={log.id}
                      onPress={() => setExpandedLogId(isExpanded ? null : log.id)}
                      style={({ pressed }) => [{
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: 8,
                        padding: 12,
                        opacity: pressed ? 0.9 : 1,
                      }]}
                    >
                      <View className="flex-row justify-between items-start">
                        <View className="gap-1">
                          <Text className="text-sm font-semibold text-foreground">{getGroupName(log.animalGroupId)}</Text>
                          <Text className="text-xs text-muted">{formatDate(log.timestamp)}</Text>
                        </View>
                        <View className="items-end gap-1">
                          <Text className="text-sm font-bold text-foreground">{log.totalAmount.toFixed(1)} kg</Text>
                          <Text className="text-xs text-muted">{isExpanded ? '▲ zuklappen' : '▼ Details'}</Text>
                        </View>
                      </View>

                      {isExpanded && componentKeys.length > 0 && (
                        <View className="mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                          <View className="flex-row mb-1">
                            <Text className="flex-1 text-xs font-bold text-muted">Komponente</Text>
                            <Text className="w-20 text-xs font-bold text-muted text-right">Soll</Text>
                            <Text className="w-20 text-xs font-bold text-muted text-right">Ist</Text>
                            <Text className="w-16 text-xs font-bold text-muted text-right">Abw.</Text>
                          </View>
                          {componentKeys.map((key) => {
                            const planned = log.plannedAmounts?.[key] || 0;
                            const actual = log.actualAmounts?.[key] || 0;
                            const dev = actual - planned;
                            const isPos = dev > 0.05;
                            const isNeg = dev < -0.05;
                            return (
                              <View key={key} className="flex-row py-1" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                                <Text className="flex-1 text-xs text-foreground" numberOfLines={1}>{key}</Text>
                                <Text className="w-20 text-xs text-muted text-right">{planned.toFixed(1)} kg</Text>
                                <Text className="w-20 text-xs text-foreground text-right">{actual.toFixed(1)} kg</Text>
                                <Text className="w-16 text-xs font-medium text-right" style={{ color: isPos ? '#f97316' : isNeg ? '#3b82f6' : colors.success }}>
                                  {isPos ? '+' : ''}{dev.toFixed(1)}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}