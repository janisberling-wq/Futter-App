import { ScrollView, Text, View, Pressable } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/use-colors';
import { useEffect } from 'react';

// Inline Animal Groups Definition
const ANIMAL_GROUPS = [
  { id: 'milchkuehe', name: 'Milchkühe', description: 'Milchproduzierende Kühe' },
  { id: 'fresser', name: 'Fresser', description: 'Jungvieh zum Mästen' },
  { id: 'bullen', name: 'Bullen', description: 'Zuchtbullen' },
];

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();

  useEffect(() => {
    // Ensure app is initialized
  }, []);

  const handleSelectGroup = (groupId: string) => {
    router.push({
      pathname: '/feeding-mode',
      params: { groupId },
    });
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-6">
          {/* Header */}
          <View className="items-center gap-2 mb-4">
            <Text className="text-4xl font-bold text-foreground">FutterRation</Text>
            <Text className="text-sm text-muted text-center">
              Verwalte Futterrationen für deine Tiere
            </Text>
          </View>

          {/* Animal Groups */}
          <View className="gap-4">
            {ANIMAL_GROUPS.map((group) => (
              <Pressable
                key={group.id}
                onPress={() => handleSelectGroup(group.id)}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 12,
                    padding: 16,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View className="gap-2">
                  <Text className="text-lg font-bold text-foreground">{group.name}</Text>
                  <Text className="text-sm text-muted">{group.description}</Text>
                  <Text className="text-xs text-primary font-semibold mt-2">
                    Tippen zum Füttern →
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          {/* Info Box */}
          <View className="p-4 bg-primary/10 rounded-lg border border-primary/20 mt-4">
            <Text className="text-xs text-foreground font-medium">
              💡 Wähle eine Tiergruppe, um eine Fütterung zu starten. Die Grundrationen können in
              der Konfiguration angepasst werden.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
