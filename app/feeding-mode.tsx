import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getFarmCode, getAnimalGroups, getRations, getFeedingLogs,
  saveFeedingLog, saveFeedingOrder, getFeedingOrder, getInventory, updateInventoryStock
} from '@/lib/supabase-service';

interface FeedingComponent { id: string; name: string; }
interface AnimalGroup { id: string; name: string; }

const parseAmount = (value: string): number => parseFloat(value.replace(',', '.')) || 0;
const formatAmount = (value: number): string => value.toFixed(2);
const roundTo5 = (value: number): number => Math.round(value / 5) * 5;
const formatTarget = (value: number): string => roundTo5(value).toFixed(0);
const isValidNumber = (value: string): boolean => !isNaN(parseFloat(value.replace(',', '.')));
const calculateTotalRation = (components: Record<string, number>): number =>
  Object.values(components).reduce((a, b) => a + b, 0);
const generateId = (): string => Date.now().toString();

const calculatePlannedAmounts = (baseComponents: Record<string, number>, totalAmount: number): Record<string, number> => {
  const total = calculateTotalRation(baseComponents);
  if (total === 0) return {};
  return Object.fromEntries(Object.entries(baseComponents).map(([key, value]) => [key, (value / total) * totalAmount]));
};

// Nur Leitkomponenten bestimmen die Tieranzahl
const calcAverageAnimalCount = (
  completedIds: string[],
  actualAmounts: Record<string, number>,
  restPerComponent: Record<string, number>,
  baseRationPerAnimal: Record<string, number>,
  leadComponentIds: string[]
): number => {
  const leadCompleted = completedIds.filter(id => leadComponentIds.includes(id) && (baseRationPerAnimal[id] || 0) > 0);
  if (leadCompleted.length === 0) return 0;
  const counts = leadCompleted.map(id => {
    const fresh = actualAmounts[id] || 0;
    const rest = restPerComponent[id] || 0;
    return (fresh + rest) / baseRationPerAnimal[id];
  });
  return counts.reduce((a, b) => a + b, 0) / counts.length;
};

export default function FeedingModeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  const selectedGroupId = groupId || '';
  const [farmCode, setFarmCode] = useState<string | null>(null);
  const [allGroups, setAllGroups] = useState<AnimalGroup[]>([]);
  const [currentRation, setCurrentRation] = useState<any>(null);
  const [activeComponents, setActiveComponents] = useState<FeedingComponent[]>([]);
  const [orderedComponents, setOrderedComponents] = useState<FeedingComponent[]>([]);
  const [baseRationPerAnimal, setBaseRationPerAnimal] = useState<Record<string, number>>({});
  const [leadComponentIds, setLeadComponentIds] = useState<string[]>([]);
  const [lastSessionPerGroup, setLastSessionPerGroup] = useState<Record<string, any>>({});
  const [restGroupId, setRestGroupId] = useState<string>('none');
  const [isLoading, setIsLoading] = useState(true);

  const prevSession = restGroupId !== 'none' ? lastSessionPerGroup[restGroupId] : null;
  const selectedGroup = allGroups.find((g) => g.id === selectedGroupId);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const code = await getFarmCode();
        setFarmCode(code);
        if (!code) return;

        const groups = await getAnimalGroups(code);
        setAllGroups(groups);

        const rations = await getRations(code);
        const ration = rations[selectedGroupId] || null;
        setCurrentRation(ration);

        if (ration) {
          const defs = ration.componentDefs || [];
          const active = defs.filter((c: FeedingComponent) => (ration.components[c.id] || 0) > 0);
          const leads = ration.leadComponentIds || active.map((c: FeedingComponent) => c.id);
          setLeadComponentIds(leads);

          const savedOrderIds = await getFeedingOrder(code, selectedGroupId);
          if (savedOrderIds) {
            const ordered: FeedingComponent[] = [];
            for (const id of savedOrderIds) {
              const comp = active.find((c: FeedingComponent) => c.id === id);
              if (comp) ordered.push(comp);
            }
            for (const comp of active) {
              if (!ordered.find((c) => c.id === comp.id)) ordered.push(comp);
            }
            setOrderedComponents(ordered);
          } else {
            setOrderedComponents(active);
          }
          setActiveComponents(active);

          const perAnimal: Record<string, number> = {};
          for (const comp of active) perAnimal[comp.id] = ration.components[comp.id] || 0;
          setBaseRationPerAnimal(perAnimal);
        }

        // Letzte Fütterungen pro Gruppe
        const lastSessions: Record<string, any> = {};
        for (const group of groups) {
          const logs = await getFeedingLogs(code, group.id);
          if (logs.length > 0) lastSessions[group.id] = logs[0]; // already sorted desc
        }
        setLastSessionPerGroup(lastSessions);
      } catch (error: any) {
        Alert.alert('Fehler', `Fehler: ${error?.message || JSON.stringify(error)}`);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [selectedGroupId]);

  const [totalAmount, setTotalAmount] = useState('');
  const [restAmount, setRestAmount] = useState('');
  const [restPerComponent, setRestPerComponent] = useState<Record<string, number>>({});
  const [plannedAmounts, setPlannedAmounts] = useState<Record<string, number>>({});
  const [actualAmounts, setActualAmounts] = useState<Record<string, number>>({});
  const [scaleInputs, setScaleInputs] = useState<Record<string, string>>({});
  const [completedComponents, setCompletedComponents] = useState<string[]>([]);
  const [isStarted, setIsStarted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const moveComponent = async (index: number, direction: 'up' | 'down') => {
    const newOrder = [...orderedComponents];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newOrder.length) return;
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    setOrderedComponents(newOrder);
    try {
      if (farmCode) await saveFeedingOrder(farmCode, selectedGroupId, newOrder.map((c) => c.id));
    } catch { console.error('Failed to save order'); }
  };

  const handleStart = () => {
    if (!isValidNumber(totalAmount)) { Alert.alert('Fehler', 'Bitte gib eine gültige Gesamtmenge ein'); return; }
    if (!currentRation) { Alert.alert('Fehler', 'Grundration nicht gefunden'); return; }
    if (orderedComponents.length === 0) { Alert.alert('Fehler', 'Keine Komponenten mit Menge > 0 gefunden'); return; }

    const total = parseAmount(totalAmount);
    const activeRationComponents = Object.fromEntries(orderedComponents.map((c) => [c.id, currentRation.components[c.id] || 0]));
    const planned = calculatePlannedAmounts(activeRationComponents, total);

    const restKg = parseAmount(restAmount);
    let restComps: Record<string, number> = {};
    if (restKg > 0 && prevSession) {
      const prevActuals = prevSession.actualAmounts as Record<string, number>;
      const prevRestComps = (prevSession.restPerComponent || {}) as Record<string, number>;
      const prevTotalAmounts: Record<string, number> = {};
      for (const id of Object.keys(prevActuals)) {
        prevTotalAmounts[id] = (prevActuals[id] || 0) + (prevRestComps[id] || 0);
      }
      const prevGrandTotal = Object.values(prevTotalAmounts).reduce((a: number, b: number) => a + b, 0);
      if (prevGrandTotal > 0) {
        restComps = Object.fromEntries(Object.entries(prevTotalAmounts).map(([id, val]) => [id, restKg * (val / prevGrandTotal)]));
      }
    }
    setRestPerComponent(restComps);

    const adjustedPlanned: Record<string, number> = {};
    for (const [id, target] of Object.entries(planned)) {
      adjustedPlanned[id] = Math.max(0, target - (restComps[id] || 0));
    }
    setPlannedAmounts(adjustedPlanned);
    setActualAmounts({});
    setScaleInputs({});
    setCompletedComponents([]);
    setIsStarted(true);
  };

  const getCumulativeActual = (): number => completedComponents.reduce((sum, id) => sum + (actualAmounts[id] || 0), 0);

  const getCumulativeTarget = (componentId: string): number => {
    const restKg = parseAmount(restAmount);
    return restKg + getCumulativeActual() + roundTo5(plannedAmounts[componentId] || 0);
  };

  const handleComponentComplete = (componentId: string) => {
    const scaleValue = scaleInputs[componentId] || '';
    if (!isValidNumber(scaleValue)) { Alert.alert('Fehler', 'Bitte gib einen gültigen Waagenwert ein'); return; }

    const scaleReading = parseAmount(scaleValue);
    const restKg = parseAmount(restAmount);
    const previousCumulative = restKg + getCumulativeActual();
    const actualAmount = scaleReading - previousCumulative;

    if (actualAmount < 0) {
      Alert.alert('Fehler', `Der Waagenwert muss größer als ${formatAmount(previousCumulative)} kg sein`);
      return;
    }

    const remainingIds = orderedComponents.map((c) => c.id).filter((id) => !completedComponents.includes(id) && id !== componentId);
    const updatedActuals = { ...actualAmounts, [componentId]: actualAmount };
    const updatedCompleted = [...completedComponents, componentId];

    // Nur Leitkomponenten bestimmen die Tieranzahl
    const avgAnimals = calcAverageAnimalCount(updatedCompleted, updatedActuals, restPerComponent, baseRationPerAnimal, leadComponentIds);

    if (remainingIds.length > 0 && avgAnimals > 0) {
      const newAmounts = Object.fromEntries(
        remainingIds.map((id) => [id, Math.max(0, avgAnimals * (baseRationPerAnimal[id] || 0) - (restPerComponent[id] || 0))])
      );
      setPlannedAmounts((prev) => ({ ...prev, ...newAmounts }));
    }

    setActualAmounts((prev) => ({ ...prev, [componentId]: actualAmount }));
    setCompletedComponents((prev) => [...prev, componentId]);
  };

  const handleSave = async () => {
    if (completedComponents.length !== orderedComponents.length) { Alert.alert('Fehler', 'Bitte füttere alle Komponenten'); return; }
    if (!farmCode) return;
    setIsSaving(true);
    try {
      const restKg = parseAmount(restAmount);
      const freshTotal = getCumulativeActual();
      const session = {
        id: generateId(),
        animalGroupId: selectedGroupId,
        timestamp: Date.now(),
        totalAmount: freshTotal + restKg,
        freshAmount: freshTotal,
        restAmount: restKg,
        restPerComponent,
        plannedAmounts,
        actualAmounts,
        completed: true,
      };
      await saveFeedingLog(farmCode, session);

      // Bestand abziehen
      try {
        const inventory = await getInventory(farmCode);
        for (const [compId, amount] of Object.entries(actualAmounts)) {
          if (inventory[compId] && inventory[compId].tracked) {
            const newStock = Math.max(0, (inventory[compId].currentStock || 0) - (amount as number));
            await updateInventoryStock(farmCode, compId, newStock);
          }
        }
      } catch { console.error('Bestand update failed'); }

      Alert.alert('Erfolg', `Fütterung gespeichert!\nFrisch: ${formatAmount(freshTotal)} kg${restKg > 0 ? `\nRest: ${formatAmount(restKg)} kg\nGesamt: ${formatAmount(freshTotal + restKg)} kg` : ''}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch { Alert.alert('Fehler', 'Fütterung konnte nicht gespeichert werden'); }
    finally { setIsSaving(false); }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-6">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted }}>Lade Daten...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!isStarted) {
    const restKg = parseAmount(restAmount);
    return (
      <ScreenContainer className="p-6">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View className="flex-1 gap-6 justify-center">
            <View className="items-center gap-2 mb-4">
              <Text className="text-3xl font-bold text-foreground">Fütterung</Text>
              <Text className="text-base text-muted text-center">{selectedGroup?.name}</Text>
            </View>

            <View className="gap-3">
              <Text className="text-sm font-semibold text-foreground">Gewünschte Gesamtmenge (kg)</Text>
              <View className="flex-row items-center gap-2 px-4 py-3 bg-surface rounded-lg border border-border" style={{ borderColor: colors.border }}>
                <TextInput
                  className="flex-1 text-foreground text-lg font-semibold"
                  placeholder="z.B. 2000"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={totalAmount}
                  onChangeText={setTotalAmount}
                />
                <Text className="text-sm text-muted font-medium">kg</Text>
              </View>
            </View>

            {/* Rest */}
            <View className="gap-3">
              <Text className="text-sm font-semibold text-foreground">Rest aus vorheriger Fütterung</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => { setRestGroupId('none'); setRestAmount(''); }}
                    style={({ pressed }) => [{ backgroundColor: restGroupId === 'none' ? colors.primary : colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Text className={restGroupId === 'none' ? 'font-semibold text-background text-sm' : 'font-medium text-foreground text-sm'}>Kein Rest</Text>
                  </Pressable>
                  {allGroups.filter((g) => lastSessionPerGroup[g.id]).map((group) => (
                    <Pressable
                      key={group.id}
                      onPress={() => setRestGroupId(group.id)}
                      style={({ pressed }) => [{ backgroundColor: restGroupId === group.id ? colors.primary : colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, opacity: pressed ? 0.8 : 1 }]}
                    >
                      <Text className={restGroupId === group.id ? 'font-semibold text-background text-sm' : 'font-medium text-foreground text-sm'}>{group.name}</Text>
                      <Text className={`text-xs ${restGroupId === group.id ? 'text-background' : 'text-muted'}`}>
                        {(lastSessionPerGroup[group.id].totalAmount || 0).toFixed(0)} kg
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {restGroupId !== 'none' && (
                <View className="flex-row items-center gap-2 px-4 py-3 bg-surface rounded-lg border border-border" style={{ borderColor: colors.border }}>
                  <TextInput
                    className="flex-1 text-foreground text-lg font-semibold"
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    value={restAmount}
                    onChangeText={setRestAmount}
                  />
                  <Text className="text-sm text-muted font-medium">kg</Text>
                </View>
              )}
            </View>

            {/* Reihenfolge */}
            {orderedComponents.length > 0 && (
              <View className="gap-3">
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm font-semibold text-foreground">Ladereihenfolge</Text>
                  <Text className="text-xs text-muted">wird gespeichert</Text>
                </View>
                <View className="gap-2">
                  {orderedComponents.map((comp, index) => {
                    const isLead = leadComponentIds.includes(comp.id);
                    return (
                      <View key={comp.id} className="flex-row items-center gap-2 p-3 bg-surface rounded-lg border" style={{ borderColor: isLead ? colors.primary : colors.border }}>
                        <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: isLead ? colors.primary : colors.border }}>
                          <Text style={{ fontSize: 11, fontWeight: 'bold', color: isLead ? colors.background : colors.muted }}>{index + 1}</Text>
                        </View>
                        <Text className="flex-1 text-sm font-medium text-foreground">{comp.name}</Text>
                        <Text className="text-xs mr-1" style={{ color: isLead ? colors.primary : colors.muted }}>
                          {isLead ? '🎯' : '📊'}
                        </Text>
                        {currentRation && (
                          <Text className="text-xs text-muted mr-2">{formatAmount(currentRation.components[comp.id] || 0)} kg</Text>
                        )}
                        <View className="flex-row gap-1">
                          <Pressable onPress={() => moveComponent(index, 'up')} disabled={index === 0}
                            style={({ pressed }) => [{ backgroundColor: index === 0 ? colors.surface : colors.primary, borderRadius: 4, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 }]}>
                            <Text style={{ color: index === 0 ? colors.muted : colors.background, fontSize: 14, fontWeight: 'bold' }}>↑</Text>
                          </Pressable>
                          <Pressable onPress={() => moveComponent(index, 'down')} disabled={index === orderedComponents.length - 1}
                            style={({ pressed }) => [{ backgroundColor: index === orderedComponents.length - 1 ? colors.surface : colors.primary, borderRadius: 4, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 }]}>
                            <Text style={{ color: index === orderedComponents.length - 1 ? colors.muted : colors.background, fontSize: 14, fontWeight: 'bold' }}>↓</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <Pressable onPress={handleStart} style={({ pressed }) => [{ backgroundColor: colors.primary, borderRadius: 8, padding: 16, opacity: pressed ? 0.8 : 1 }]}>
              <Text className="text-center font-semibold text-background text-base">Fütterung starten</Text>
            </Pressable>
            <Pressable onPress={() => router.back()} style={({ pressed }) => [{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, opacity: pressed ? 0.8 : 1 }]}>
              <Text className="text-center font-medium text-foreground">Zurück</Text>
            </Pressable>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  const currentComponent = orderedComponents[completedComponents.length];
  const cumulativeTarget = currentComponent ? getCumulativeTarget(currentComponent.id) : 0;
  const isCurrentLead = currentComponent ? leadComponentIds.includes(currentComponent.id) : false;

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-4">
          <View className="gap-1 mb-2">
            <Text className="text-2xl font-bold text-foreground">Fütterung läuft</Text>
            <Text className="text-sm text-muted">{selectedGroup?.name} • Ziel: {totalAmount} kg{parseAmount(restAmount) > 0 ? ` (inkl. ${parseAmount(restAmount).toFixed(0)} kg Rest)` : ''}</Text>
          </View>

          {parseAmount(restAmount) > 0 && (
            <View className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <Text className="text-xs font-semibold text-foreground">
                ✓ {parseAmount(restAmount).toFixed(0)} kg Rest ({allGroups.find(g => g.id === restGroupId)?.name}) eingerechnet
              </Text>
            </View>
          )}

          <View className="gap-2 p-3 bg-primary/10 rounded-lg">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm font-semibold text-foreground">Fortschritt</Text>
              <Text className="text-sm font-semibold text-primary">{completedComponents.length} / {orderedComponents.length}</Text>
            </View>
            <View className="h-2 bg-surface rounded-full overflow-hidden" style={{ backgroundColor: colors.surface }}>
              <View className="h-full bg-primary" style={{ width: `${(completedComponents.length / orderedComponents.length) * 100}%` }} />
            </View>
          </View>

          {currentComponent && (
            <View className="p-4 rounded-lg border-2" style={{ borderColor: isCurrentLead ? colors.primary : colors.muted, backgroundColor: colors.surface }}>
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-xs font-semibold uppercase" style={{ color: isCurrentLead ? colors.primary : colors.muted }}>
                  {isCurrentLead ? '🎯 Leitkomponente – Jetzt laden' : '📊 Folgekomponente – Jetzt laden'}
                </Text>
              </View>
              <Text className="text-lg font-bold text-foreground mb-1">{currentComponent.name}</Text>

              <View className="gap-1 mb-3 p-3 bg-primary/10 rounded-lg">
                {parseAmount(restAmount) > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted">Rest</Text>
                    <Text className="text-xs text-muted">{parseAmount(restAmount).toFixed(0)} kg ✓</Text>
                  </View>
                )}
                {completedComponents.map((id) => {
                  const comp = orderedComponents.find((c) => c.id === id);
                  const isLead = leadComponentIds.includes(id);
                  return (
                    <View key={id} className="flex-row justify-between">
                      <Text className="text-xs text-muted">{isLead ? '🎯' : '📊'} {comp?.name}</Text>
                      <Text className="text-xs text-muted">{formatAmount(actualAmounts[id] || 0)} kg ✓</Text>
                    </View>
                  );
                })}
                <View className="flex-row justify-between mt-1 pt-1" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text className="text-sm font-semibold text-foreground">+ {currentComponent.name}</Text>
                  <Text className="text-sm font-semibold text-foreground">{formatTarget(plannedAmounts[currentComponent.id] || 0)} kg</Text>
                </View>
                <View className="flex-row justify-between mt-1">
                  <Text className="text-sm font-bold text-primary">Waage-Zielwert</Text>
                  <Text className="text-sm font-bold text-primary">{formatTarget(cumulativeTarget)} kg</Text>
                </View>
              </View>

              <View className="flex-row items-center gap-2 px-3 py-3 bg-background rounded-lg border" style={{ borderColor: isCurrentLead ? colors.primary : colors.muted }}>
                <TextInput
                  className="flex-1 text-foreground text-xl font-bold"
                  placeholder={formatTarget(cumulativeTarget)}
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={scaleInputs[currentComponent.id] || ''}
                  onChangeText={(value) => setScaleInputs((prev) => ({ ...prev, [currentComponent.id]: value }))}
                />
                <Text className="text-base text-muted font-medium">kg</Text>
              </View>
              <Text className="text-xs text-muted mt-1">
                {isCurrentLead ? 'Leitkomponente – beeinflusst Tieranzahl' : 'Folgekomponente – beeinflusst Tieranzahl nicht'}
              </Text>

              <Pressable onPress={() => handleComponentComplete(currentComponent.id)}
                style={({ pressed }) => [{ backgroundColor: isCurrentLead ? colors.primary : colors.muted, borderRadius: 8, padding: 14, marginTop: 12, opacity: pressed ? 0.8 : 1 }]}>
                <Text className="text-center font-semibold text-background text-base">Bestätigen</Text>
              </Pressable>
            </View>
          )}

          {completedComponents.length > 0 && (
            <View className="gap-2">
              <Text className="text-xs font-semibold text-muted uppercase">Abgeschlossen</Text>
              {completedComponents.map((id) => {
                const comp = orderedComponents.find((c) => c.id === id);
                const planned = plannedAmounts[id] || 0;
                const actual = actualAmounts[id] || 0;
                const diff = actual - roundTo5(planned);
                const isLead = leadComponentIds.includes(id);
                return (
                  <View key={id} className="p-3 rounded-lg border" style={{ borderColor: colors.success, backgroundColor: colors.surface }}>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-sm font-semibold text-foreground">{isLead ? '🎯' : '📊'} {comp?.name}</Text>
                      <Text className="text-xs font-semibold text-success">✓ Fertig</Text>
                    </View>
                    <View className="flex-row justify-between mt-1">
                      <Text className="text-xs text-muted">Ist: {formatAmount(actual)} kg</Text>
                      <Text className="text-xs text-muted">Soll: {formatTarget(planned)} kg</Text>
                      <Text className="text-xs font-medium" style={{ color: Math.abs(diff) < 2.5 ? colors.success : diff > 0 ? '#f97316' : '#3b82f6' }}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(0)} kg
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {completedComponents.length > 0 && completedComponents.length < orderedComponents.length && (
            <View className="gap-2">
              <Text className="text-xs font-semibold text-muted uppercase">Noch zu laden (aktualisiert)</Text>
              {orderedComponents.filter((c) => !completedComponents.includes(c.id) && c.id !== currentComponent?.id).map((comp) => {
                const isLead = leadComponentIds.includes(comp.id);
                return (
                  <View key={comp.id} className="p-3 rounded-lg border" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
                    <View className="flex-row justify-between">
                      <Text className="text-xs text-muted">{isLead ? '🎯' : '📊'} {comp.name}</Text>
                      <Text className="text-xs font-medium text-foreground">{formatTarget(plannedAmounts[comp.id] || 0)} kg</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {completedComponents.length === orderedComponents.length && (
            <View className="gap-3">
              <View className="p-4 bg-primary/10 rounded-lg border border-primary/20 gap-1">
                <Text className="text-sm font-bold text-foreground text-center">Frisch geladen: {formatAmount(getCumulativeActual())} kg</Text>
                {parseAmount(restAmount) > 0 && (
                  <Text className="text-xs text-muted text-center">Rest genutzt: {parseAmount(restAmount).toFixed(0)} kg</Text>
                )}
                <Text className="text-sm font-bold text-primary text-center">
                  Gesamt: {formatAmount(getCumulativeActual() + parseAmount(restAmount))} kg
                </Text>
              </View>
              <Pressable onPress={handleSave} disabled={isSaving}
                style={({ pressed }) => [{ backgroundColor: colors.success, borderRadius: 8, padding: 16, opacity: pressed || isSaving ? 0.8 : 1 }]}>
                <Text className="text-center font-semibold text-background text-base">
                  {isSaving ? 'Speichert...' : 'Fütterung abschließen'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
