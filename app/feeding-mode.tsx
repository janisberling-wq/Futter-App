import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, TextInput, Pressable, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';

type AnimalGroupId = string;

interface FeedingComponent {
  id: string;
  name: string;
}

interface BaseRation {
  animalGroupId: string;
  components: Record<string, number>;
  componentDefs?: FeedingComponent[];
  lastUpdated: number;
}

interface FeedingSession {
  id: string;
  animalGroupId: AnimalGroupId;
  timestamp: number;
  totalAmount: number;
  freshAmount?: number;
  restAmount?: number;
  restPerComponent?: Record<string, number>;
  plannedAmounts: Record<string, number>;
  actualAmounts: Record<string, number>;
  completed: boolean;
}

const ANIMAL_GROUPS = [
  { id: 'milchkuehe', name: 'Milchkühe' },
  { id: 'fresser', name: 'Fresser' },
  { id: 'bullen', name: 'Bullen' },
];

const DEFAULT_FEEDING_COMPONENTS: FeedingComponent[] = [
  { id: 'maissilage', name: 'Maissilage' },
  { id: 'grassilage', name: 'Grassilage' },
  { id: 'stroh', name: 'Stroh' },
  { id: 'ausgleichsfutter', name: 'Ausgleichsfutter' },
  { id: 'kraftfutter', name: 'Kraftfutter' },
  { id: 'wasser', name: 'Wasser' },
];

const GROUPS_KEY = 'app:animal_groups';

const parseAmount = (value: string): number => parseFloat(value.replace(',', '.')) || 0;
const formatAmount = (value: number): string => value.toFixed(2);
const roundTo5 = (value: number): number => Math.round(value / 5) * 5;
const formatTarget = (value: number): string => roundTo5(value).toFixed(0);
const isValidNumber = (value: string): boolean => !isNaN(parseFloat(value.replace(',', '.')));
const calculateTotalRation = (components: Record<string, number>): number =>
  Object.values(components).reduce((a, b) => a + b, 0);
const generateId = (): string => Date.now().toString();

const calculatePlannedAmounts = (
  baseComponents: Record<string, number>,
  totalAmount: number
): Record<string, number> => {
  const total = calculateTotalRation(baseComponents);
  if (total === 0) return {};
  return Object.fromEntries(
    Object.entries(baseComponents).map(([key, value]) => [key, (value / total) * totalAmount])
  );
};

// Berechne Durchschnitt der implizierten Tieranzahl aus allen gefütterten Komponenten
const calcAverageAnimalCount = (
  completedIds: string[],
  actualAmounts: Record<string, number>,
  restPerComponent: Record<string, number>,
  baseRationPerAnimal: Record<string, number>
): number => {
  const counts = completedIds
    .filter((id) => (baseRationPerAnimal[id] || 0) > 0)
    .map((id) => {
      const fresh = actualAmounts[id] || 0;
      const rest = restPerComponent[id] || 0;
      return (fresh + rest) / baseRationPerAnimal[id];
    });
  if (counts.length === 0) return 0;
  return counts.reduce((a, b) => a + b, 0) / counts.length;
};

export default function FeedingModeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  const selectedGroupId = groupId || 'milchkuehe';
  const [allGroups, setAllGroups] = useState(ANIMAL_GROUPS);
  const selectedGroup = allGroups.find((g) => g.id === selectedGroupId);

  const [currentRation, setCurrentRation] = useState<BaseRation | null>(null);
  const [activeComponents, setActiveComponents] = useState<FeedingComponent[]>([]);
  const [orderedComponents, setOrderedComponents] = useState<FeedingComponent[]>([]);
  const [baseRatios, setBaseRatios] = useState<Record<string, number>>({});
  const [baseRationPerAnimal, setBaseRationPerAnimal] = useState<Record<string, number>>({});
  const [prevSession, setPrevSession] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const groupData = await AsyncStorage.getItem(GROUPS_KEY);
        if (groupData) setAllGroups(JSON.parse(groupData));

        const data = await AsyncStorage.getItem('feeding:base_rations');
        if (data) {
          const rations = JSON.parse(data);
          const ration = rations[selectedGroupId] || null;
          setCurrentRation(ration);
          if (ration) {
            const defs = ration.componentDefs || DEFAULT_FEEDING_COMPONENTS;
            const active = defs.filter((c: FeedingComponent) => (ration.components[c.id] || 0) > 0);
            setActiveComponents(active);
            setOrderedComponents(active);

            const total = calculateTotalRation(ration.components);
            const ratios: Record<string, number> = {};
            const perAnimal: Record<string, number> = {};
            for (const comp of active) {
              ratios[comp.id] = total > 0 ? (ration.components[comp.id] || 0) / total : 0;
              perAnimal[comp.id] = ration.components[comp.id] || 0;
            }
            setBaseRatios(ratios);
            setBaseRationPerAnimal(perAnimal);
          }
        }

        // Letzte Fütterung laden für Rest-Funktion
        const logsData = await AsyncStorage.getItem(`logs_${selectedGroupId}`);
        if (logsData) {
          const logs = JSON.parse(logsData);
          if (logs.length > 0) setPrevSession(logs[logs.length - 1]);
        }
      } catch (error) { console.error('Error loading ration:', error); }
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

  const moveComponent = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...orderedComponents];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newOrder.length) return;
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    setOrderedComponents(newOrder);
  };

  const handleStart = () => {
    if (!isValidNumber(totalAmount)) { Alert.alert('Fehler', 'Bitte gib eine gültige Gesamtmenge ein'); return; }
    if (!currentRation) { Alert.alert('Fehler', 'Grundration nicht gefunden'); return; }
    if (orderedComponents.length === 0) { Alert.alert('Fehler', 'Keine Komponenten mit Menge > 0 gefunden'); return; }

    const total = parseAmount(totalAmount);
    const activeRationComponents = Object.fromEntries(
      orderedComponents.map((c) => [c.id, currentRation.components[c.id] || 0])
    );
    const planned = calculatePlannedAmounts(activeRationComponents, total);

    // Rest-Berechnung aus vorheriger Fütterung
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
        restComps = Object.fromEntries(
          Object.entries(prevTotalAmounts).map(([id, val]) => [id, restKg * (val / prevGrandTotal)])
        );
      }
    }
    setRestPerComponent(restComps);

    // Zielmenge pro Komponente = Gesamtziel minus Rest-Anteil
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

  // Waage-Zielwert: Rest + bereits geladen + aktuelle Komponente (gerundet auf 5kg)
  const getCumulativeTarget = (componentId: string): number => {
    const restKg = parseAmount(restAmount);
    return restKg + getCumulativeActual() + roundTo5(plannedAmounts[componentId] || 0);
  };

  const getCumulativeActual = (): number =>
    completedComponents.reduce((sum, id) => sum + (actualAmounts[id] || 0), 0);

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

    const remainingIds = orderedComponents
      .map((c) => c.id)
      .filter((id) => !completedComponents.includes(id) && id !== componentId);

    const updatedActuals = { ...actualAmounts, [componentId]: actualAmount };
    const updatedCompleted = [...completedComponents, componentId];

    // Durchschnittliche Tieranzahl aus allen gefütterten Komponenten (inkl. Rest)
    const avgAnimals = calcAverageAnimalCount(
      updatedCompleted,
      updatedActuals,
      restPerComponent,
      baseRationPerAnimal
    );

    // Alle ausstehenden Komponenten neu berechnen (minus jeweiligem Rest-Anteil)
    if (remainingIds.length > 0 && avgAnimals > 0) {
      const newAmounts = Object.fromEntries(
        remainingIds.map((id) => [
          id,
          Math.max(0, avgAnimals * (baseRationPerAnimal[id] || 0) - (restPerComponent[id] || 0))
        ])
      );
      setPlannedAmounts((prev) => ({ ...prev, ...newAmounts }));
    }

    setActualAmounts((prev) => ({ ...prev, [componentId]: actualAmount }));
    setCompletedComponents((prev) => [...prev, componentId]);
  };

  const handleSave = async () => {
    if (completedComponents.length !== orderedComponents.length) { Alert.alert('Fehler', 'Bitte füttere alle Komponenten'); return; }
    setIsSaving(true);
    try {
      const restKg = parseAmount(restAmount);
      const freshTotal = getCumulativeActual();
      const session: FeedingSession = {
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
      const logs = await AsyncStorage.getItem(`logs_${selectedGroupId}`);
      const existingLogs = logs ? JSON.parse(logs) : [];
      await AsyncStorage.setItem(`logs_${selectedGroupId}`, JSON.stringify([...existingLogs, session]));

      // Bestand automatisch abziehen (nur verfolgte Komponenten, nur frisch Geladenes)
      try {
        const bestandData = await AsyncStorage.getItem('app:bestand');
        if (bestandData) {
          const bestand = JSON.parse(bestandData);
          for (const [compId, amount] of Object.entries(actualAmounts)) {
            if (bestand[compId] && bestand[compId].tracked) {
              bestand[compId].currentStock = Math.max(0, (bestand[compId].currentStock || 0) - (amount as number));
            }
          }
          await AsyncStorage.setItem('app:bestand', JSON.stringify(bestand));
        }
      } catch { console.error('Bestand update failed'); }

      Alert.alert('Erfolg', `Fütterung gespeichert!\nFrisch: ${formatAmount(freshTotal)} kg${restKg > 0 ? `\nRest genutzt: ${formatAmount(restKg)} kg\nGesamt: ${formatAmount(freshTotal + restKg)} kg` : ''}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch { Alert.alert('Fehler', 'Fütterung konnte nicht gespeichert werden'); }
    finally { setIsSaving(false); }
  };

  if (!isStarted) {
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

            {prevSession && (
              <View className="gap-3">
                <Text className="text-sm font-semibold text-foreground">Rest aus vorheriger Fütterung</Text>
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

                {parseAmount(restAmount) > 0 && (
                  <View className="p-3 bg-primary/10 rounded-lg border border-primary/20 gap-1">
                    <Text className="text-xs font-semibold text-foreground">Geschätzte Rest-Zusammensetzung</Text>
                    {(() => {
                      const prevActuals = prevSession.actualAmounts as Record<string, number>;
                      const prevRestComps = (prevSession.restPerComponent || {}) as Record<string, number>;
                      const prevTotalAmounts: Record<string, number> = {};
                      for (const id of Object.keys(prevActuals)) {
                        prevTotalAmounts[id] = (prevActuals[id] || 0) + (prevRestComps[id] || 0);
                      }
                      const prevGrandTotal = Object.values(prevTotalAmounts).reduce((a: number, b: number) => a + b, 0);
                      return Object.entries(prevTotalAmounts).map(([id, val]) => {
                        const restShare = prevGrandTotal > 0 ? parseAmount(restAmount) * (val / prevGrandTotal) : 0;
                        if (restShare < 0.5) return null;
                        return (
                          <Text key={id} className="text-xs text-muted">{id}: {restShare.toFixed(0)} kg</Text>
                        );
                      });
                    })()}
                  </View>
                )}
              </View>
            )}

            {orderedComponents.length > 0 && (
              <View className="gap-3">
                <Text className="text-sm font-semibold text-foreground">Ladereihenfolge anpassen</Text>
                <View className="gap-2">
                  {orderedComponents.map((comp, index) => (
                    <View key={comp.id} className="flex-row items-center gap-2 p-3 bg-surface rounded-lg border border-border" style={{ borderColor: colors.border }}>
                      <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: colors.primary }}>
                        <Text className="text-xs font-bold text-background">{index + 1}</Text>
                      </View>
                      <Text className="flex-1 text-sm font-medium text-foreground">{comp.name}</Text>
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
                  ))}
                </View>
              </View>
            )}

            {currentRation && orderedComponents.length > 0 && (
              <View className="p-4 bg-primary/10 rounded-lg border border-primary/20 gap-2">
                <Text className="text-xs font-semibold text-foreground uppercase">Grundration pro Tier</Text>
                <Text className="text-sm text-foreground">
                  Summe: <Text className="font-semibold">
                    {formatAmount(calculateTotalRation(Object.fromEntries(orderedComponents.map((c) => [c.id, currentRation.components[c.id] || 0]))))} kg
                  </Text>
                </Text>
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

  const currentIndex = completedComponents.length;
  const currentComponent = orderedComponents[currentIndex];
  const cumulativeTarget = currentComponent ? getCumulativeTarget(currentComponent.id) : 0;

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-4">
          <View className="gap-1 mb-2">
            <Text className="text-2xl font-bold text-foreground">Fütterung läuft</Text>
            <Text className="text-sm text-muted">
              {selectedGroup?.name} • Ziel: {totalAmount} kg
              {parseAmount(restAmount) > 0 ? ` (inkl. ${parseAmount(restAmount).toFixed(0)} kg Rest)` : ''}
            </Text>
          </View>

          {parseAmount(restAmount) > 0 && (
            <View className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <Text className="text-xs font-semibold text-foreground">
                ✓ {parseAmount(restAmount).toFixed(0)} kg Rest bereits eingerechnet – Waage startet bei {parseAmount(restAmount).toFixed(0)} kg
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
            <View className="p-4 rounded-lg border-2" style={{ borderColor: colors.primary, backgroundColor: colors.surface }}>
              <Text className="text-xs font-semibold text-primary uppercase mb-3">Jetzt laden</Text>
              <Text className="text-lg font-bold text-foreground mb-1">{currentComponent.name}</Text>

              <View className="gap-1 mb-3 p-3 bg-primary/10 rounded-lg">
                {parseAmount(restAmount) > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted">Rest (bereits vorhanden)</Text>
                    <Text className="text-xs text-muted">{parseAmount(restAmount).toFixed(0)} kg ✓</Text>
                  </View>
                )}
                {completedComponents.map((id) => {
                  const comp = orderedComponents.find((c) => c.id === id);
                  return (
                    <View key={id} className="flex-row justify-between">
                      <Text className="text-xs text-muted">{comp?.name}</Text>
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

              <View className="flex-row items-center gap-2 px-3 py-3 bg-background rounded-lg border" style={{ borderColor: colors.primary }}>
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
              <Text className="text-xs text-muted mt-1">Gib den aktuellen Waagenstand ein</Text>

              <Pressable onPress={() => handleComponentComplete(currentComponent.id)}
                style={({ pressed }) => [{ backgroundColor: colors.primary, borderRadius: 8, padding: 14, marginTop: 12, opacity: pressed ? 0.8 : 1 }]}>
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
                return (
                  <View key={id} className="p-3 rounded-lg border" style={{ borderColor: colors.success, backgroundColor: colors.surface }}>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-sm font-semibold text-foreground">{comp?.name}</Text>
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
              {orderedComponents
                .filter((c) => !completedComponents.includes(c.id) && c.id !== currentComponent?.id)
                .map((comp) => (
                  <View key={comp.id} className="p-3 rounded-lg border" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
                    <View className="flex-row justify-between">
                      <Text className="text-xs text-muted">{comp.name}</Text>
                      <Text className="text-xs font-medium text-foreground">{formatTarget(plannedAmounts[comp.id] || 0)} kg</Text>
                    </View>
                  </View>
                ))}
            </View>
          )}

          {completedComponents.length === orderedComponents.length && (
            <View className="gap-3">
              <View className="p-4 bg-primary/10 rounded-lg border border-primary/20 gap-1">
                <Text className="text-sm font-bold text-foreground text-center">
                  Frisch geladen: {formatAmount(getCumulativeActual())} kg
                </Text>
                {parseAmount(restAmount) > 0 && (
                  <Text className="text-xs text-muted text-center">
                    Rest genutzt: {parseAmount(restAmount).toFixed(0)} kg
                  </Text>
                )}
                <Text className="text-sm font-bold text-primary text-center">
                  Gesamt: {formatAmount(getCumulativeActual() + parseAmount(restAmount))} kg
                </Text>
                <Text className="text-xs text-muted text-center">Geplant: {totalAmount} kg</Text>
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