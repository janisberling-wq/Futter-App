import { ScrollView, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';

// Type definitions
type AnimalGroupId = 'milchkuehe' | 'fresser' | 'bullen';
interface FeedingComponent {
  id: string;
  name: string;
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

const formatAmount = (value: number): string => value.toFixed(2);
const calculateDeviation = (planned: number, actual: number): number => {
  if (planned === 0) return 0;
  return ((actual - planned) / planned) * 100;
};
const formatDeviation = (value: number): string => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

export default function ProtocolDetailScreen() {
  const colors = useColors();
  const { logId } = useLocalSearchParams<{ logId: string }>();
  const [log, setLog] = useState<FeedingSession | null>(null);

  useEffect(() => {
    const loadLog = async () => {
      try {
        // Search through all groups
        for (const group of ANIMAL_GROUPS) {
          const data = await AsyncStorage.getItem(`logs_${group.id}`);
          if (data) {
            const logs = JSON.parse(data) as FeedingSession[];
            const found = logs.find((l) => l.id === logId);
            if (found) {
              setLog(found);
              return;
            }
          }
        }
      } catch (error) {
        console.error('Error loading log:', error);
      }
    };
    loadLog();
  }, [logId]);

  if (!log) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-foreground">Eintrag nicht gefunden</Text>
        </View>
      </ScreenContainer>
    );
  }

  const groupName = ANIMAL_GROUPS.find((g) => g.id === log.animalGroupId)?.name || log.animalGroupId;
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

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Fütterungsdetails</Text>
            <Text className="text-sm text-muted">{formatDate(log.timestamp)}</Text>
          </View>

          {/* Summary */}
          <View className="p-4 bg-primary/10 rounded-lg border border-primary/20 gap-3">
            <View className="gap-1">
              <Text className="text-xs font-semibold text-foreground uppercase">Tiergruppe</Text>
              <Text className="text-base font-semibold text-foreground">{groupName}</Text>
            </View>
            <View className="gap-1">
              <Text className="text-xs font-semibold text-foreground uppercase">Gesamtmenge</Text>
              <Text className="text-base font-semibold text-foreground">
                {formatAmount(log.totalAmount)} kg
              </Text>
            </View>
          </View>

          {/* Components */}
          <View className="gap-3">
            <Text className="text-lg font-bold text-foreground">Komponenten</Text>
            {FEEDING_COMPONENTS.map((comp) => {
              const planned = log.plannedAmounts[comp.id] || 0;
              const actual = log.actualAmounts[comp.id] || 0;
              const deviation = calculateDeviation(planned, actual);

              return (
                <View
                  key={comp.id}
                  className="p-4 bg-surface rounded-lg border border-border gap-2"
                  style={{ borderColor: colors.border }}
                >
                  <View className="flex-row justify-between items-start">
                    <Text className="text-sm font-semibold text-foreground">{comp.name}</Text>
                    <View
                      className={`px-2 py-1 rounded ${
                        Math.abs(deviation) < 5
                          ? 'bg-success/20'
                          : deviation > 0
                            ? 'bg-warning/20'
                            : 'bg-error/20'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          Math.abs(deviation) < 5
                            ? 'text-success'
                            : deviation > 0
                              ? 'text-warning'
                              : 'text-error'
                        }`}
                      >
                        {formatDeviation(deviation)}
                      </Text>
                    </View>
                  </View>

                  <View className="gap-1">
                    <View className="flex-row justify-between">
                      <Text className="text-xs text-muted">Sollmenge</Text>
                      <Text className="text-xs font-semibold text-foreground">
                        {formatAmount(planned)} kg
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-xs text-muted">Ist-Menge</Text>
                      <Text className="text-xs font-semibold text-foreground">
                        {formatAmount(actual)} kg
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-xs text-muted">Differenz</Text>
                      <Text className="text-xs font-semibold text-foreground">
                        {formatAmount(actual - planned)} kg
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
