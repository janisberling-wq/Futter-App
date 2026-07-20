import React, { useState, useCallback } from 'react';
import { ScrollView, Text, View, Pressable, Share, Alert, Dimensions, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useFocusEffect } from 'expo-router';
import Svg, { Rect, Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { getFarmCode, getAnimalGroups, getFeedingLogs, deleteFeedingLog } from '@/lib/supabase-service';

const TIME_RANGES = [
  { id: '7', label: '7 Tage' },
  { id: '30', label: '30 Tage' },
  { id: '90', label: '90 Tage' },
  { id: 'all', label: 'Alle' },
];

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatDateShort = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
};

export default function ProtocolScreen() {
  const colors = useColors();
  const [animalGroups, setAnimalGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('30');
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [farmCode, setFarmCode] = useState<string | null>(null);

  const getGroupName = (groupId: string) => animalGroups.find((g) => g.id === groupId)?.name || groupId;

  const loadData = async () => {
    try {
      setIsLoading(true);
      const code = await getFarmCode();
      setFarmCode(code);
      if (!code) return;
      const groups = await getAnimalGroups(code);
      setAnimalGroups(groups);
      const logs = await getFeedingLogs(code);
      setAllLogs(logs);
    } catch { Alert.alert('Fehler', 'Protokoll konnte nicht geladen werden'); }
    finally { setIsLoading(false); }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  React.useEffect(() => {
    let logs = allLogs;
    if (selectedGroupId !== 'all') logs = logs.filter((log) => log.animalGroupId === selectedGroupId);
    if (selectedTimeRange !== 'all') {
      const cutoff = Date.now() - parseInt(selectedTimeRange) * 24 * 60 * 60 * 1000;
      logs = logs.filter((log) => log.timestamp >= cutoff);
    }
    setFilteredLogs(logs);
  }, [allLogs, selectedGroupId, selectedTimeRange]);

  const handleDeleteLog = (log: any) => {
    Alert.alert('Fütterung löschen', `Fütterung vom ${formatDate(log.timestamp)} wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
        if (!farmCode) return;
        try {
          await deleteFeedingLog(farmCode, log.id);
          setAllLogs((prev) => prev.filter((l) => l.id !== log.id));
          if (expandedLogId === log.id) setExpandedLogId(null);
        } catch { Alert.alert('Fehler', 'Eintrag konnte nicht gelöscht werden'); }
      }},
    ]);
  };

  const stats = React.useMemo(() => {
    if (filteredLogs.length === 0) return null;
    const totalFeedings = filteredLogs.length;
    const totalAmount = filteredLogs.reduce((sum, log) => sum + (log.totalAmount || 0), 0);
    const avgAmount = totalAmount / totalFeedings;
    const componentKeys = new Set<string>();
    filteredLogs.forEach((log) => Object.keys(log.actualAmounts || {}).forEach((k) => componentKeys.add(k)));
    const componentStats: Record<string, { avgActual: number; avgPlanned: number; avgDeviation: number; total: number }> = {};
    componentKeys.forEach((key) => {
      const entries = filteredLogs.filter((log) => log.actualAmounts?.[key] !== undefined);
      if (entries.length === 0) return;
      const total = entries.reduce((sum, log) => sum + (log.actualAmounts[key] || 0), 0);
      const avgActual = total / entries.length;
      const avgPlanned = entries.reduce((sum, log) => sum + (log.plannedAmounts?.[key] || 0), 0) / entries.length;
      componentStats[key] = { avgActual, avgPlanned, avgDeviation: avgActual - avgPlanned, total };
    });
    return { totalFeedings, totalAmount, avgAmount, componentStats };
  }, [filteredLogs]);

  const barData = React.useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.componentStats).map(([key, s]) => ({ name: key, value: s.total })).sort((a, b) => b.value - a.value);
  }, [stats]);

  const lineData = React.useMemo(() => {
    return [...filteredLogs].sort((a, b) => a.timestamp - b.timestamp).map((log) => ({ timestamp: log.timestamp, value: log.totalAmount || 0 }));
  }, [filteredLogs]);

  const handleExportCSV = async () => {
    try {
      const allKeys = Array.from(new Set(filteredLogs.flatMap((log) => Object.keys(log.actualAmounts || {}))));
      let csv = 'Datum,Tiergruppe,Gesamtmenge (kg)';
      allKeys.forEach((k) => { csv += `,${k} Soll,${k} Ist,${k} Abw.`; });
      csv += '\n';
      for (const log of filteredLogs) {
        csv += `${formatDate(log.timestamp)},${getGroupName(log.animalGroupId)},${log.totalAmount.toFixed(2)}`;
        allKeys.forEach((k) => {
          csv += `,${(log.plannedAmounts?.[k] || 0).toFixed(2)},${(log.actualAmounts?.[k] || 0).toFixed(2)},${((log.actualAmounts?.[k] || 0) - (log.plannedAmounts?.[k] || 0)).toFixed(2)}`;
        });
        csv += '\n';
      }
      await Share.share({ message: csv, title: 'FutterRation_Protokoll.csv' });
    } catch { Alert.alert('Fehler', 'Export fehlgeschlagen'); }
  };

  const screenWidth = Dimensions.get('window').width - 48 - 32;

  if (isLoading) {
    return (
      <ScreenContainer className="p-6">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted }}>Lade Protokoll...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 gap-5">
          <View className="items-center gap-1">
            <Text className="text-3xl font-bold text-foreground">Protokoll</Text>
            <Text className="text-sm text-muted text-center">Betrieb: {farmCode}</Text>
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

          {filteredLogs.length === 0 ? (
            <View className="flex-1 items-center justify-center gap-3 py-12">
              <Text className="text-lg font-semibold text-foreground">Keine Einträge</Text>
              <Text className="text-sm text-muted text-center">Für diesen Zeitraum wurden keine Fütterungen gefunden.</Text>
            </View>
          ) : (
            <>
              {stats && (
                <View className="gap-3">
                  <Text className="text-xs font-semibold text-muted uppercase">Zusammenfassung</Text>
                  <View className="flex-row gap-3">
                    {[{ value: stats.totalFeedings.toString(), label: 'Fütterungen' }, { value: stats.totalAmount.toFixed(0), label: 'kg gesamt' }, { value: stats.avgAmount.toFixed(0), label: 'kg Ø/Fütterung' }].map((s) => (
                      <View key={s.label} className="flex-1 p-3 bg-primary/10 rounded-lg border border-primary/20 items-center">
                        <Text className="text-2xl font-bold text-primary">{s.value}</Text>
                        <Text className="text-xs text-muted text-center">{s.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {barData.length > 0 && (
                <View className="gap-2">
                  <Text className="text-xs font-semibold text-muted uppercase">Verbrauch pro Komponente</Text>
                  <View className="bg-surface rounded-lg border border-border p-4">
                    {(() => {
                      const maxVal = Math.max(...barData.map((d) => d.value), 1);
                      const barH = 26; const gap = 12; const labelW = 90;
                      const chartW = screenWidth - labelW - 45;
                      const chartH = barData.length * (barH + gap);
                      return (
                        <Svg width={screenWidth} height={chartH}>
                          {barData.map((d, i) => {
                            const y = i * (barH + gap);
                            const w = Math.max(2, (d.value / maxVal) * chartW);
                            return (
                              <React.Fragment key={d.name}>
                                <SvgText x={0} y={y + barH / 2 + 4} fontSize={11} fill={colors.foreground}>{d.name.length > 12 ? d.name.slice(0, 11) + '…' : d.name}</SvgText>
                                <Rect x={labelW} y={y} width={w} height={barH} rx={4} fill={colors.primary} />
                                <SvgText x={labelW + w + 5} y={y + barH / 2 + 4} fontSize={10} fill={colors.muted}>{d.value.toFixed(0)} kg</SvgText>
                              </React.Fragment>
                            );
                          })}
                        </Svg>
                      );
                    })()}
                  </View>
                </View>
              )}

              {lineData.length > 1 && (
                <View className="gap-2">
                  <Text className="text-xs font-semibold text-muted uppercase">Gesamtmenge über Zeit</Text>
                  <View className="bg-surface rounded-lg border border-border p-4">
                    {(() => {
                      const maxVal = Math.max(...lineData.map((d) => d.value), 1);
                      const minVal = Math.min(...lineData.map((d) => d.value), 0);
                      const range = maxVal - minVal || 1;
                      const chartH = 140; const padL = 35; const padB = 22;
                      const chartW = screenWidth - padL - 10;
                      const stepX = lineData.length > 1 ? chartW / (lineData.length - 1) : 0;
                      const points = lineData.map((d, i) => ({ x: padL + i * stepX, y: chartH - padB - ((d.value - minVal) / range) * (chartH - padB - 10), timestamp: d.timestamp }));
                      const polyPoints = points.map((p) => `${p.x},${p.y}`).join(' ');
                      return (
                        <Svg width={screenWidth} height={chartH}>
                          <SvgText x={0} y={14} fontSize={9} fill={colors.muted}>{maxVal.toFixed(0)}</SvgText>
                          <SvgText x={0} y={chartH - padB} fontSize={9} fill={colors.muted}>{minVal.toFixed(0)}</SvgText>
                          <Line x1={padL} y1={chartH - padB} x2={screenWidth - 10} y2={chartH - padB} stroke={colors.border} strokeWidth={1} />
                          <Polyline points={polyPoints} fill="none" stroke={colors.primary} strokeWidth={2} />
                          {points.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={3} fill={colors.primary} />)}
                          <SvgText x={padL} y={chartH - 6} fontSize={9} fill={colors.muted}>{formatDateShort(lineData[0].timestamp)}</SvgText>
                          <SvgText x={screenWidth - 10} y={chartH - 6} fontSize={9} fill={colors.muted} textAnchor="end">{formatDateShort(lineData[lineData.length - 1].timestamp)}</SvgText>
                        </Svg>
                      );
                    })()}
                  </View>
                </View>
              )}

              <Pressable onPress={handleExportCSV}
                style={({ pressed }) => [{ backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1, borderRadius: 8, padding: 12, opacity: pressed ? 0.8 : 1 }]}>
                <Text className="text-center font-semibold text-primary">📥 CSV exportieren ({filteredLogs.length} Einträge)</Text>
              </Pressable>

              <View className="gap-2">
                <Text className="text-xs font-semibold text-muted uppercase">Einträge ({filteredLogs.length})</Text>
                {filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const componentKeys = Object.keys(log.actualAmounts || {});
                  return (
                    <View key={log.id} className="bg-surface rounded-lg border border-border overflow-hidden" style={{ borderColor: colors.border }}>
                      <Pressable onPress={() => setExpandedLogId(isExpanded ? null : log.id)} style={({ pressed }) => [{ padding: 12, opacity: pressed ? 0.9 : 1 }]}>
                        <View className="flex-row justify-between items-start">
                          <View className="gap-1 flex-1">
                            <Text className="text-sm font-semibold text-foreground">{getGroupName(log.animalGroupId)}</Text>
                            <Text className="text-xs text-muted">{formatDate(log.timestamp)}</Text>
                          </View>
                          <View className="items-end gap-1">
                            <Text className="text-sm font-bold text-foreground">{log.totalAmount.toFixed(1)} kg</Text>
                            <Text className="text-xs text-muted">{isExpanded ? '▲ zuklappen' : '▼ Details'}</Text>
                          </View>
                        </View>
                      </Pressable>
                      {isExpanded && (
                        <View className="px-3 pb-3" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                          {componentKeys.length > 0 && (
                            <>
                              <View className="flex-row py-2">
                                <Text className="flex-1 text-xs font-bold text-muted">Komponente</Text>
                                <Text className="w-20 text-xs font-bold text-muted text-right">Soll</Text>
                                <Text className="w-20 text-xs font-bold text-muted text-right">Ist</Text>
                                <Text className="w-16 text-xs font-bold text-muted text-right">Abw.</Text>
                              </View>
                              {componentKeys.map((key) => {
                                const planned = log.plannedAmounts?.[key] || 0;
                                const actual = log.actualAmounts?.[key] || 0;
                                const dev = actual - planned;
                                const isPos = dev > 0.05; const isNeg = dev < -0.05;
                                return (
                                  <View key={key} className="flex-row py-1" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                                    <Text className="flex-1 text-xs text-foreground" numberOfLines={1}>{key}</Text>
                                    <Text className="w-20 text-xs text-muted text-right">{planned.toFixed(1)} kg</Text>
                                    <Text className="w-20 text-xs text-foreground text-right">{actual.toFixed(1)} kg</Text>
                                    <Text className="w-16 text-xs font-medium text-right" style={{ color: isPos ? '#f97316' : isNeg ? '#3b82f6' : colors.success }}>{isPos ? '+' : ''}{dev.toFixed(1)}</Text>
                                  </View>
                                );
                              })}
                            </>
                          )}
                          <Pressable onPress={() => handleDeleteLog(log)}
                            style={({ pressed }) => [{ marginTop: 12, backgroundColor: colors.surface, borderColor: '#ef4444', borderWidth: 1, borderRadius: 8, padding: 10, opacity: pressed ? 0.7 : 1 }]}>
                            <Text className="text-center text-xs font-semibold" style={{ color: '#ef4444' }}>🗑 Fütterung löschen</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
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
