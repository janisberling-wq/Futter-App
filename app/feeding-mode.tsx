import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, TextInput, Pressable, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';

// Type definitions
type AnimalGroupId = 'milchkuehe' | 'fresser' | 'bullen';
interface FeedingComponent {
  id: string;
  name: string;
}
interface BaseRation {
  groupId: AnimalGroupId;
  components: Record<string, number>;
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

const FEEDING_COMPONENTS: FeedingComponent[] = [
  { id: 'maissilage', name: 'Maissilage' },
  { id: 'grassilage', name: 'Grassilage' },
  { id: 'stroh', name: 'Stroh' },
  { id: 'ausgleichsfutter', name: 'Ausgleichsfutter' },
  { id: 'kraftfutter', name: 'Kraftfutter' },
  { id: 'wasser', name: 'Wasser' },
];

// Utility functions
const parseAmount = (value: string): number => parseFloat(value) || 0;
const formatAmount = (value: number): string => value.toFixed(2);
const isValidAmount = (value: string): boolean => !isNaN(parseFloat(value)) && parseFloat(value) > 0;
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

const adjustPlannedAmounts = (
  current: Record<string, number>,
  completedId: string,
  actualAmount: number,
  remainingIds: string[]
): Record<string, number> => {
  const totalRemaining = remainingIds.reduce((sum, id) => sum + current[id], 0);
  if (totalRemaining === 0) return current;

  const adjustmentFactor = (totalRemaining - (current[completedId] - actualAmount)) / totalRemaining;
  return Object.fromEntries(
    Object.entries(current).map(([id, value]) => [
      id,
      remainingIds.includes(id) ? value * adjustmentFactor : value,
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

  useEffect(() => {
    const loadRation = async () => {
      try {
        const data = await AsyncStorage.getItem('feeding:base_rations');
        if (data) {
          const rations = JSON.parse(data);
          setCurrentRation(rations[selectedGroupId] || null);
        }
      } catch (error) {
        console.error('Error loading ration:', error);
      }
    };
    loadRation();
  }, [selectedGroupId]);

  const [totalAmount, setTotalAmount] = useState('');
  const [plannedAmounts, setPlannedAmounts] = useState<Record<string, number>>({});
  const [actualAmounts, setActualAmounts] = useState<Record<string, string>>({});
  const [completedComponents, setCompletedComponents] = useState<Set<string>>(new Set());
  const [isStarted, setIsStarted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleStart = () => {
    if (!isValidAmount(totalAmount)) {
      Alert.alert('Fehler', 'Bitte gib eine gültige Gesamtmenge ein');
      return;
    }

    if (!currentRation) {
      Alert.alert('Fehler', 'Grundration nicht gefunden');
      return;
    }

    const total = parseAmount(totalAmount);
    const planned = calculatePlannedAmounts(currentRation.components, total);
    setPlannedAmounts(planned);
    setActualAmounts({});
    setCompletedComponents(new Set());
    setIsStarted(true);
  };

  const handleComponentInput = (componentId: string, value: string) => {
    setActualAmounts((prev) => ({
      ...prev,
      [componentId]: value,
    }));
  };

  const handleComponentComplete = (componentId: string) => {
    if (!isValidAmount(actualAmounts[componentId] || '')) {
      Alert.alert('Fehler', 'Bitte gib eine gültige Menge ein');
      return;
    }

    const actualAmount = parseAmount(actualAmounts[componentId]);
    const remainingComponents = FEEDING_COMPONENTS.map((c) => c.id).filter(
      (id) => !completedComponents.has(id) && id !== componentId
    );

    const adjusted = adjustPlannedAmounts(
      plannedAmounts,
      componentId,
      actualAmount,
      remainingComponents
    );
    setPlannedAmounts(adjusted);
    setCompletedComponents((prev) => new Set([...prev, componentId]));
  };

  const handleSave = async () => {
    if (completedComponents.size !== FEEDING_COMPONENTS.length) {
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
        actualAmounts: Object.fromEntries(
          FEEDING_COMPONENTS.map((c) => [c.id, parseAmount(actualAmounts[c.id] || '0')])
        ),
        completed: true,
      };

      const logs = await AsyncStorage.getItem(`logs_${selectedGroupId}`);
      const existingLogs = logs ? JSON.parse(logs) : [];
      await AsyncStorage.setItem(
        `logs_${selectedGroupId}`,
        JSON.stringify([...existingLogs, session])
      );
      Alert.alert('Erfolg', 'Fütterung gespeichert!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
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
              <Text className="text-base text-muted text-center">
                {selectedGroup?.name}
              </Text>
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

            {currentRation && (
              <View className="p-4 bg-primary/10 rounded-lg border border-primary/20 gap-2">
                <Text className="text-xs font-semibold text-foreground uppercase">
                  Grundration pro Tier
                </Text>
                <Text className="text-sm text-foreground">
                  Summe:{' '}
                  <Text className="font-semibold">
                    {formatAmount(calculateTotal