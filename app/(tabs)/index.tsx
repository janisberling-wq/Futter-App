import { ScrollView, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useRouter, useFocusEffect } from 'expo-router';
import { useColors } from '@/hooks/use-colors';
import { useState, useCallback } from 'react';
import { getFarmCode, getAnimalGroups } from '@/lib/supabase-service';

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [farmCode, setFarmCode] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const code = await getFarmCode();
        setFarmCode(code);
        if (!code) return;
        const g = await getAnimalGroups(code);
        setGroups(g);
      } catch (e) {
        console.error('Error loading groups:', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []));

  const handleSelectGroup = (groupId: string) => {
    router.push({ pathname: '/feeding-mode', params: { groupId } });
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-6">
          <View className="items-center gap-2 mb-4">
            <Text className="text-4xl font-bold text-foreground">FutterRation</Text>
            <Text className="text-sm text-muted text-center">Verwalte Futterrationen für deine Tiere</Text>
            {farmCode && <Text className="text-xs text-muted">Betrieb: {farmCode}</Text>}
          </View>

          {isLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ color: colors.muted }}>Lade Gruppen...</Text>
            </View>
          ) : (
            <View className="gap-4">
              {groups.map((group) => (
                <Pressable
                  key={group.id}
                  onPress={() => handleSelectGroup(group.id)}
                  style={({ pressed }) => [{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, opacity: pressed ? 0.7 : 1 }]}
                >
                  <View className="gap-2">
                    <Text className="text-lg font-bold text-foreground">{group.name}</Text>
                    <Text className="text-xs text-primary font-semibold mt-2">Tippen zum Füttern →</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          <View className="p-4 bg-primary/10 rounded-lg border border-primary/20 mt-4">
            <Text className="text-xs text-foreground font-medium">
              💡 Wähle eine Tiergruppe, um eine Fütterung zu starten. Die Grundrationen können in der Konfiguration angepasst werden.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
