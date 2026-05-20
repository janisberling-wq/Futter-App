import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, TextInput, Pressable, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';

type AnimalGroupId = 'milchkuehe' | 'fresser' | 'bullen';

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
  plannedAmounts: Record<string, number>;
  actualAmounts: Record<string, number>;
  completed: boolean;
}

const ANIMAL_GROUPS = [
  { id: 'milchkuehe' as AnimalGroupId, name: 'Milchkühe' },
  { id: 'fresser' as AnimalGroupId, name: 'Fresser' },
  { id: 'bullen' as AnimalGroupId, name: 'Bullen' },
];

const DEFAULT_FEEDING_COMPONENTS: FeedingComponent[] = [
  { id: 'maissilage', name: 'Maissilage' },
  { id: 'grassilage', name: 'Grassilage' },
  { id: 'stroh', name: 'Stroh' },
  { id: 'ausgleichsfutter', name: 'Ausgleichsfutter' },
  { id: 'kraftfutter', name: 'Kraftfutter' },
  { id: 'wasser', name: 'Wasser' },
];

const parseAmount = (value: string): number => parseFloat(value.replace(',', '.')) || 0;
const formatAmount = (value: number): string => value.toFixed(2);
const isValidNumber = (value: string): boolean => !isNaN(parseFloat(value.replace(',', '.')));
const calculateTotalRation = (components: Record<string, number>): number =>
  Object.values(components).reduce((a, b) => a + b, 0);
const generateId = (): string => Date.now().toString();

const calculatePlannedAmounts = (
  components: Record<string, number>,
  totalAmount: number
): Record<string, number> => {
  const total = calculateTotalRation(components);
  if (total === 0) return {};
  return Object.fromEntries(
    Object.entries(components).map(([key, value]) => [
      key,
      (value / total) * totalAmount,
    ])
  );
};

export default function FeedingModeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  const selectedGroupId = (groupId || 'milchkuehe') as AnimalGroupId;
  const selectedGroup = ANIMAL_GROUPS.find((g) => g.id === selectedGroupId);

  const [currentRation, setCurrentRation] = useState<BaseRation | null>(null);
  const [activeComponents, setActiveComponents] = useState<FeedingComponent[]>([]);
  const [orderedComponents, setOrderedComponents] = useState<FeedingComponent[]>([]);

  useEffect(() => {
    const loadRation = async () => {
      try {
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
          }
        }
      } catch (error) {
        console.error('Error loading ration:', error);
      }
    };
    loadRation();
  }, [selectedGroupId]);

  const [totalAmount, setTotalAmount] = useState('');
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
    if (!isValidNumber(totalAmount)) {
      Alert.alert('Fehler', 'Bitte gib eine gültige Gesamtmenge ein');
      return;
    }
    if (!currentRation) {
      Alert.alert('Fehler', 'Grundration nicht gefunden');
      return;
    }
    if (orderedComponents.length === 0) {
      Alert.alert('Fehler', 'Keine Komponenten mit Menge > 0 gefunden');
      return;
    }

    const total = parseAmount(totalAmount);
    const activeRationComponents = Object.fromEntries(
      orderedComponents.map((c) => [c.id, currentRation.components[c.id] || 0])
    );
    const planned = calculatePlannedAmounts(activeRationComponents, total);
    setPlannedAmounts(planned);
    setActualAmounts({});
    setScaleInputs({});
    setCompletedComponents([]);
    setIsStarted(true);
  };

  const getCumulativeTarget = (componentId: string): number => {
    const index = orderedComponents.findIndex((c) => c.id === componentId);
    let sum = 0;
    for (let i = 0; i <= index; i++) {
      sum += plannedAmounts[orderedComponents[i].id] || 0;
    }
    return sum;
  };

  const getCumulativeActual = (): number => {
    return completedComponents.reduce((sum, id) => sum + (actualAmounts[id] || 0), 0);
  };

  const handleComponentComplete = (componentId: string) => {
    const scaleValue = scaleInputs[componentId] || '';
    if (!isValidNumber(scaleValue)) {
      Alert.alert('Fehler', 'Bitte gib einen gültigen Waagenwert ein');
      return;
    }

    const scaleReading = parseAmount(scaleValue);
    const previousCumulative = getCumulativeActual();
    const actualAmount = scaleReading - previousCumulative;

    if (actualAmount < 0) {
      Alert.alert('Fehler', `Der Waagenwert muss größer als ${formatAmount(previousCumulative)} kg sein`);
      return;
    }

    const planned = plannedAmounts[componentId];
    const deviation = actualAmount - planned;

    const remainingIds = orderedComponents
      .map((c) => c.id)
      .filter((id) => !completedComponents.includes(id) && id !== componentId);

    const totalRemaining = remainingIds.reduce((sum, id) => sum + (plannedAmounts[id] || 0), 0);

    if (remainingIds.length > 0 && totalRemaining > 0) {
      const updated = { ...plannedAmounts };
      for (const id of remainingIds) {
        const share = (plannedAmounts[id] || 0) / totalRemaining;
        updated[id] = Math.max(0, (plannedAmounts[id] || 0) - deviation * share);
      }
      setPlannedAmounts(updated);
    }

    setActualAmounts((prev) => ({ ...prev, [componentId]: actualAmount }));
    setCompletedComponents((prev) => [...prev, componentId]);
  };

  const handleSave = async () => {
    if (completedComponents.length !== orderedComponents.length) {
      Alert.alert('Fehler', 'Bitte füttere alle Komponenten');
      return;
    }

    setIsSaving(true);
    try {
      const session: FeedingSession = {
        id: generateId(),
        animalGroupId: selectedGroupId,
        timestamp: Date.now(),
        totalAmount: parseAmount(totalAmount),
        plannedAmounts,
        actualAmounts,
        completed: true,
      };

      const logs = await AsyncStorage.getItem(`logs_${selectedGroupId}`);
      const existingLogs = logs ? JSON.parse(logs) : [];
      await AsyncStorage.setItem(
        `logs_${selectedGroupId}`,
        JSON.stringify([...existingLogs, session])
      );
      Alert.alert('Erfolg', 'Fütterung gespeichert!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Fehler', 'Fütterung konnte nicht gespeichert werden');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
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
              <Text className="text-sm font-semibold text-foreground">
                Gewünschte Gesamtmenge (kg)
              </Text>
              <View
                className="flex-row items-center gap-2 px-4 py-3 bg-surface rounded-lg border border-border"
                style={{ borderColor: colors.border }}
              >
                <TextInput
                  className="flex-1 text-foreground text-lg font-semibold"
                  placeholder="z.B. 500"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={totalAmount}
                  onChangeText={setTotalAmount}
                />
                <Text className="text-sm text-muted font-medium">kg</Text>
              </View>
            </View>

            {/* Reihenfolge anpassen */}
            {orderedComponents.length > 0 && (
              <View className="gap-3">
                <Text className="text-sm font-semibold text-foreground">
                  Ladereihenfolge anpassen
                </Text>
                <View className="gap-2">
                  {orderedComponents.map((comp, index) => (
                    <View
                      key={comp.id}
                      className="flex-row items-center gap-2 p-3 bg-surface rounded-lg border border-border"
                      style={{ borderColor: colors.border }}
                    >
                      <View
                        className="w-6 h-6 rounded-full items-center justify-center"
                        style={{ backgroundColor: colors.primary }}
                      >
                        <Text className="text-xs font-bold text-background">{index + 1}</Text>
                      </View>
                      <Text className="flex-1 text-sm font-medium text-foreground">{comp.name}</Text>
                      {currentRation && (
                        <Text className="text-xs text-muted mr-2">
                          {formatAmount(currentRation.components[comp.id] || 0)} kg
                        </Text>
                      )}
                      <View className="flex-row gap-1">
                        <Pressable
                          onPress={() => moveComponent(index, 'up')}
                          disabled={index === 0}
                          style={({ pressed }) => [{
                            backgroundColor: index === 0 ? colors.surface : colors.primary,
                            borderRadius: 4,
                            width: 28,
                            height: 28,
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: pressed ? 0.7 : 1,
                          }]}
                        >
                          <Text style={{ color: index === 0 ? colors.muted : colors.background, fontSize: 14, fontWeight: 'bold' }}>↑</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => moveComponent(index, 'down')}
                          disabled={index === orderedComponents.length - 1}
                          style={({ pressed }) => [{
                            backgroundColor: index === orderedComponents.length - 1 ? colors.surface : colors.primary,
                            borderRadius: 4,
                            width: 28,
                            height: 28,
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: pressed ? 0.7 : 1,
                          }]}
                        >
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
                <Text className="text-xs font-semibold text-foreground uppercase">
                  Grundration pro Tier
                </Text>
                <Text className="text-sm text-foreground">
                  Summe:{' '}
                  <Text className="font-semibold">
                    {formatAmount(calculateTotalRation(
                      Object.fromEntries(orderedComponents.map((c) => [c.id, currentRation.components[c.id] || 0]))
                    ))} kg
                  </Text>
                </Text>
              </View>
            )}

            <Pressable
              onPress={handleStart}
              style={({ pressed }) => [{ backgroundColor: colors.primary, borderRadius: 8, padding: 16, opacity: pressed ? 0.8 : 1 }]}
            >
              <Text className="text-center font-semibold text-background text-base">
                Fütterung starten
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, opacity: pressed ? 0.8 : 1 }]}
            >
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
            <Text className="text-sm text-muted">{selectedGroup?.name} • {totalAmount} kg</Text>
          </View>

          <View className="gap-2 p-3 bg-primary/10 rounded-lg">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm font-semibold text-foreground">Fortschritt</Text>
              <Text className="text-sm font-semibold text-primary">
                {completedComponents.length} / {orderedComponents.length}
              </Text>
            </View>
            <View className="h-2 bg-surface rounded-full overflow-hidden" style={{ backgroundColor: colors.surface }}>
              <View
                className="h-full bg-primary"
                style={{ width: `${(completedComponents.length / orderedComponents.length) * 100}%` }}
              />
            </View>
          </View>

          {currentComponent && (
            <View
              className="p-4 rounded-lg border-2"
              style={{ borderColor: colors.primary, backgroundColor: colors.surface }}
            >
              <Text className="text-xs font-semibold text-primary uppercase mb-3">Jetzt laden</Text>
              <Text className="text-lg font-bold text-foreground mb-1">{currentComponent.name}</Text>

              <View className="gap-1 mb-3 p-3 bg-primary/10 rounded-lg">
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
                  <Text className="text-sm font-semibold text-foreground">{formatAmount(plannedAmounts[currentComponent.id] || 0)} kg</Text>
                </View>
                <View className="flex-row justify-between mt-1">
                  <Text className="text-sm font-bold text-primary">Waage-Zielwert</Text>
                  <Text className="text-sm font-bold text-primary">{formatAmount(cumulativeTarget)} kg</Text>
                </View>
              </View>

              <View
                className="flex-row items-center gap-2 px-3 py-3 bg-background rounded-lg border"
                style={{ borderColor: colors.primary }}
              >
                <TextInput
                  className="flex-1 text-foreground text-xl font-bold"
                  placeholder={formatAmount(cumulativeTarget)}
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={scaleInputs[currentComponent.id] || ''}
                  onChangeText={(value) =>
                    setScaleInputs((prev) => ({ ...prev, [currentComponent.id]: value }))
                  }
                />
                <Text className="text-base text-muted font-medium">kg</Text>
              </View>
              <Text className="text-xs text-muted mt-1">Gib den aktuellen Waagenstand ein</Text>

              <Pressable
                onPress={() => handleComponentComplete(currentComponent.id)}
                style={({ pressed }) => [{ backgroundColor: colors.primary, borderRadius: 8, padding: 14, marginTop: 12, opacity: pressed ? 0.8 : 1 }]}
              >
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
                const diff = actual - planned;
                return (
                  <View
                    key={id}
                    className="p-3 rounded-lg border"
                    style={{ borderColor: colors.success, backgroundColor: colors.surface }}
                  >
                    <View className="flex-row justify-between items-center">
                      <Text className="text-sm font-semibold text-foreground">{comp?.name}</Text>
                      <Text className="text-xs font-semibold text-success">✓ Fertig</Text>
                    </View>
                    <View className="flex-row justify-between mt-1">
                      <Text className="text-xs text-muted">Ist: {formatAmount(actual)} kg</Text>
                      <Text className="text-xs text-muted">Soll: {formatAmount(planned)} kg</Text>
                      <Text className={`text-xs font-medium ${diff > 0 ? 'text-orange-500' : diff < 0 ? 'text-blue-500' : 'text-success'}`}>
                        {diff > 0 ? '+' : ''}{formatAmount(diff)} kg
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {completedComponents.length === orderedComponents.length && (
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              style={({ pressed }) => [{ backgroundColor: colors.success, borderRadius: 8, padding: 16, opacity: pressed || isSaving ? 0.8 : 1 }]}
            >
              <Text className="text-center font-semibold text-background text-base">
                {isSaving ? 'Speichert...' : 'Fütterung abschließen'}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}