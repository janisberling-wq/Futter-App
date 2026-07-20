import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useFocusEffect } from 'expo-router';
import { getFarmCode, getAnimalGroups, getFeedingLogs } from '@/lib/supabase-service';

const TIME_RANGES = [
  { id: '7', label: '7 Tage' },
  { id: '30', label: '30 Tage' },
  { id: '90', label: '90 Tage' },
  { id: 'all', label: 'Alle' },
];

interface ComponentStat {
  name: string;
  totalActual: number;
  feedingCount: number;
  avgPerFeeding: number;
  perWeek: number;
  perMonth: number;
}

export default function VerbrauchScreen() {
  const colors = useColors();
  const [animalGroups, setAnimalGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState('30');
  const [stats, setStats] = useState<ComponentStat[]>([]);
  const [feedingCount, setFeedingCount] = useState(0);
  const [daysCovered, setDaysCovered] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const code = await getFarmCode();
      if (!code) return;

      const groups = await getAnimalGroups(code);
      setAnimalGroups(groups);

      const allLogs = await getFeedingLogs(code, selectedGroupId !== 'all' ? selectedGroupId : undefined);

      let filtered = allLogs;
      if (selectedTimeRange !== 'all') {
        const cutoff = Date.now() - parseInt(selectedTimeRange) * 24 * 60 * 60 * 1000;
        filtered = filtered.filter((log) => log.timestamp >= cutoff);
      }

      if (filtered.length === 0) {
        setStats([]); setFeedingCount(0); setDaysCovered(0); return;
      }

      const timestamps = filtered.map((l) => l.timestamp);
      const days = Math.max(1, Math.ceil((Math.max(...timestamps) - Math.min(...timestamps)) / (1000 * 60 * 60 * 24)) + 1);
      setDaysCovered(days);
      setFeedingCount(filtered.length);

      const componentTotals: Record<string, number> = {};
      const componentCounts: Record<string, number> = {};
      filtered.forEach((log) => {
        Object.entries(log.actualAmounts || {}).forEach(([key, value]: [string, any]) => {
          componentTotals[key] = (componentTotals[key] || 0) + value;
          componentCounts[key] = (componentCounts[key] || 0) + 1;
        });
      });

      const result: ComponentStat[] = Object.entries(componentTotals).map(([key, total]) => {
        const count = componentCounts[key] || 1;
        const avgPerDay = total / days;
        return { name: key, totalActual: total, feedingCount: count, avgPerFeeding: total / count, perWeek: avgPerDay * 7, perMonth: avgPerDay * 30 };
      }).sort((a, b) => b.totalActual - a.totalActual);

      setStats(result);
    } catch (error) {
      console.error('Error loading verbrauch:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [selectedGroupId, selectedTimeRange]));

  const totalPerWeek = stats.reduce((sum, s) => sum + s.perWeek, 0);
  const totalPerMonth = stats.reduce((sum, s) => sum + s.perMonth, 0);
  const totalActual = stats.reduce((sum, s) => sum + s.totalActual, 0);

  if (isLoading) {
    return (
      <ScreenContainer className="p-6">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted }}>Lade Verbrauch...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 gap-5">
          <View className="items-center gap-1">
            <Text className="text-3xl font-bold text-foreground">Verbrauch</Text>
            <Text className="text-sm text-muted text-center">Hochrechnung aus Protokolldaten</Text>
          </View>

          <View className="gap-2">
            <Text className="text-xs font-semibold text-muted uppercase">Tiergruppe</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {[{ id: 'all', name: 'Alle' }, ...animalGroups].map((group) => (
                  <Pressable key={group.id} onPress={() => setSelectedGroupId(group.id)}
                    style={({ pressed }) => [{ backgroundColor: selectedGroupId === group.id ? colors.primary : colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, opacity: pressed ? 0.8 : 1 }]}>
                    <Text className={selectedGroupId === group.id ? 'font-semibold text-background text-sm' : 'font-medium text-foreground text-sm'}>{group.name}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          <View className="gap-2">
            <Text className="text-xs font-semibold text-muted uppercase">Zeitraum</Text>
            <View className="flex-row gap-2">
              {TIME_RANGES.map((range) => (
                <Pressable key={range.id} onPress={() => setSelectedTimeRange(range.id)}
                  style={({ pressed }) => [{ flex: 1, backgroundColor: selectedTimeRange === range.id ? colors.primary : colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center', opacity: pressed ? 0.8 : 1 }]}>
                  <Text className={selectedTimeRange === range.id ? 'font-semibold text-background text-xs' : 'font-medium text-foreground text-xs'}>{range.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {stats.length === 0 ? (
            <View className="flex-1 items-center justify-center gap-3 py-12">
              <Text className="text-lg font-semibold text-foreground">Keine Daten</Text>
              <Text className="text-sm text-muted text-center">Für diesen Zeitraum sind keine Protokolldaten vorhanden.</Text>
            </View>
          ) : (
            <>
              <View className="gap-2">
                <Text className="text-xs font-semibold text-muted uppercase">Übersicht</Text>
                <View className="flex-row gap-3">
                  {[{ value: feedingCount.toString(), label: 'Fütterungen' }, { value: daysCovered.toString(), label: 'Tage Daten' }, { value: totalActual.toFixed(0), label: 'kg gesamt' }].map((s) => (
                    <View key={s.label} className="flex-1 p-3 bg-primary/10 rounded-lg border border-primary/20 items-center">
                      <Text className="text-xl font-bold text-primary">{s.value}</Text>
                      <Text className="text-xs text-muted text-center">{s.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1 p-4 bg-surface rounded-lg border border-border items-center gap-1">
                  <Text className="text-2xl font-bold text-foreground">{totalPerWeek.toFixed(0)} kg</Text>
                  <Text className="text-xs text-muted">Ø pro Woche</Text>
                </View>
                <View className="flex-1 p-4 bg-surface rounded-lg border border-border items-center gap-1">
                  <Text className="text-2xl font-bold text-foreground">{totalPerMonth.toFixed(0)} kg</Text>
                  <Text className="text-xs text-muted">Ø pro Monat</Text>
                </View>
              </View>

              <View className="gap-2">
                <Text className="text-xs font-semibold text-muted uppercase">Pro Komponente</Text>
                <View className="bg-surface rounded-lg border border-border overflow-hidden">
                  <View className="flex-row px-3 py-2" style={{ backgroundColor: colors.border }}>
                    <Text className="flex-1 text-xs font-bold text-foreground">Komponente</Text>
                    <Text className="w-20 text-xs font-bold text-foreground text-right">Ø/Woche</Text>
                    <Text className="w-20 text-xs font-bold text-foreground text-right">Ø/Monat</Text>
                  </View>
                  {stats.map((s) => (
                    <View key={s.name} style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                      <View className="flex-row px-3 py-2 items-center">
                        <Text className="flex-1 text-xs font-semibold text-foreground" numberOfLines={1}>{s.name}</Text>
                        <Text className="w-20 text-xs text-foreground text-right">{s.perWeek.toFixed(0)} kg</Text>
                        <Text className="w-20 text-xs text-foreground text-right">{s.perMonth.toFixed(0)} kg</Text>
                      </View>
                      <View className="flex-row px-3 pb-2">
                        <Text className="text-xs text-muted">Gesamt: {s.totalActual.toFixed(0)} kg  •  Ø/Fütterung: {s.avgPerFeeding.toFixed(1)} kg</Text>
                      </View>
                    </View>
                  ))}
                  <View className="flex-row px-3 py-2" style={{ borderTopWidth: 2, borderTopColor: colors.primary }}>
                    <Text className="flex-1 text-xs font-bold text-foreground">Gesamt</Text>
                    <Text className="w-20 text-xs font-bold text-foreground text-right">{totalPerWeek.toFixed(0)} kg</Text>
                    <Text className="w-20 text-xs font-bold text-foreground text-right">{totalPerMonth.toFixed(0)} kg</Text>
                  </View>
                </View>
              </View>

              <View className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <Text className="text-xs text-foreground font-medium">
                  💡 Basiert auf {feedingCount} Fütterungen über {daysCovered} Tage.
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
