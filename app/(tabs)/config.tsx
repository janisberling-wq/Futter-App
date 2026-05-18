import { ScrollView, Text, View, TextInput, Pressable, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Inline Definitions
const ANIMAL_GROUPS = [
  { id: 'milchkuehe', name: 'Milchkühe' },
  { id: 'fresser', name: 'Fresser' },
  { id: 'bullen', name: 'Bullen' },
];

const FEEDING_COMPONENTS = [
  { id: 'maissilage', name: 'Maissilage' },
  { id: 'grassilage', name: 'Grassilage' },
  { id: 'stroh', name: 'Stroh' },
  { id: 'ausgleichsfutter', name: 'Ausgleichsfutter' },
  { id: 'kraftfutter', name: 'Kraftfutter' },
  { id: 'wasser', name: 'Wasser' },
];

const parseAmount = (value: string): number => {
  const num = parseFloat(value.replace(',', '.'));
  return isNaN(num) ? 0 : Math.max(0, num);
};

const formatAmount = (num: number): string => {
  return num.toFixed(2);
};

const isValidAmount = (value: string): boolean => {
  const num = parseAmount(value);
  return num >= 0 && num <= 10000;
};

export default function ConfigScreen() {
  const colors = useColors();
  const [selectedGroupId, setSelectedGroupId] = useState('milchkuehe');
  const [components, setComponents] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [currentRation, setCurrentRation] = useState<any>(null);

  const selectedGroup = ANIMAL_GROUPS.find((g) => g.id === selectedGroupId);

  // Load ration when group changes
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

  // Update component values when ration loads
  useEffect(() => {
    if (currentRation) {
      const formatted: Record<string, string> = {};
      for (const comp of FEEDING_COMPONENTS) {
        formatted[comp.id] = formatAmount(currentRation.components[comp.id] || 0);
      }
      setComponents(formatted);
    }
  }, [currentRation]);

  const handleComponentChange = (componentId: string, value: string) => {
    setComponents((prev) => ({
      ...prev,
      [componentId]: value,
    }));
  };

  const handleSave = async () => {
    // Validate all inputs
    for (const [id, value] of Object.entries(components)) {
      if (!isValidAmount(value)) {
        Alert.alert('Fehler', `Ungültige Eingabe für ${id}`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const data = await AsyncStorage.getItem('feeding:base_rations');
      const rations = data ? JSON.parse(data) : {};
      const componentValues: Record<string, number> = {};
      for (const [id, value] of Object.entries(components)) {
        componentValues[id] = parseAmount(value);
      }
      rations[selectedGroupId] = {
        animalGroupId: selectedGroupId,
        components: componentValues,
        lastUpdated: Date.now(),
      };
      await AsyncStorage.setItem('feeding:base_rations', JSON.stringify(rations));
      setCurrentRation(rations[selectedGroupId]);
      Alert.alert('Erfolg', 'Grundration gespeichert');
    } catch (error) {
      Alert.alert('Fehler', 'Grundration konnte nicht gespeichert werden');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-6">
          {/* Header */}
          <View className="items-center gap-2 mb-2">
            <Text className="text-3xl font-bold text-foreground">Konfiguration</Text>
            <Text className="text-sm text-muted text-center">
              Passe die Grundrationen pro Tier an
            </Text>
          </View>

          {/* Group Selection */}
          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">Tiergruppe</Text>
            <View className="gap-2">
              {ANIMAL_GROUPS.map((group) => (
                <Pressable
                  key={group.id}
                  onPress={() => setSelectedGroupId(group.id)}
                  style={({ pressed }) => [
                    {
                      backgroundColor:
                        selectedGroupId === group.id ? colors.primary : colors.surface,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: 8,
                      padding: 12,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    className={
                      selectedGroupId === group.id
                        ? 'font-semibold text-background'
                        : 'font-medium text-foreground'
                    }
                  >
                    {group.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Components Form */}
          {selectedGroup && (
            <View className="gap-4">
              <Text className="text-sm font-semibold text-foreground">
                Grundration für {selectedGroup.name} (kg pro Tier)
              </Text>

              {FEEDING_COMPONENTS.map((comp) => (
                <View key={comp.id} className="gap-2">
                  <Text className="text-sm text-foreground font-medium">{comp.name}</Text>
                  <View
                    className="flex-row items-center gap-2 px-4 py-3 bg-surface rounded-lg border border-border"
                    style={{ borderColor: colors.border }}
                  >
                    <TextInput
                      className="flex-1 text-foreground text-base"
                      placeholder="0.00"
                      placeholderTextColor={colors.muted}
                      keyboardType="decimal-pad"
                      value={components[comp.id] || ''}
                      onChangeText={(value) => handleComponentChange(comp.id, value)}
                    />
                    <Text className="text-sm text-muted font-medium">kg</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Save Button */}
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                borderRadius: 8,
                padding: 16,
                opacity: pressed || isSaving ? 0.8 : 1,
              },
            ]}
          >
            <Text className="text-center font-semibold text-background text-base">
              {isSaving ? 'Speichert...' : 'Speichern'}
            </Text>
          </Pressable>

          {/* Info */}
          <View className="p-4 bg-primary/10 rounded-lg border border-primary/20">
            <Text className="text-xs text-foreground font-medium">
              💡 Diese Werte werden als Grundration pro Tier verwendet. Sie können beim Füttern
              angepasst werden.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
