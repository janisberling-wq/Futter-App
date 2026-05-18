import { ScrollView, Text, View, FlatList, Pressable, Share, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

// Inline Definitions
const ANIMAL_GROUPS = [
  { id: 'milchkuehe', name: 'Milchkühe' },
  { id: 'fresser', name: 'Fresser' },
  { id: 'bullen', name: 'Bullen' },
];

export default function ProtocolScreen() {
  const colors = useColors();
  const router = useRouter();
  const [selectedGroupId, setSelectedGroupId] = useState<string | 'all'>('all');
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]);

  const loadAllLogs = async () => {
    try {
      const data = await AsyncStorage.getItem('feeding:logs');
      if (data) {
        const logs = JSON.parse(data);
        setAllLogs(logs.sort((a: any, b: any) => b.timestamp - a.timestamp));
      }
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  useEffect(() => {
    loadAllLogs();
  }, []);

  useEffect(() => {
    if (selectedGroupId === 'all') {
      setFilteredLogs(allLogs);
    } else {
      setFilteredLogs(allLogs.filter((log) => log.animalGroupId === selectedGroupId));
    }
  }, [allLogs, selectedGroupId]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadAllLogs();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

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

  const getGroupName = (groupId: string) => {
    return ANIMAL_GROUPS.find((g) => g.id === groupId)?.name || groupId;
  };

  const handleExportCSV = async () => {
    try {
      let csvData = 'Tiergruppe,Datum,Gesamtmenge (kg),Komponenten\n';
      for (const log of filteredLogs) {
        const groupName = getGroupName(log.animalGroupId);
        const date = formatDate(log.timestamp);
        const totalAmount = log.totalAmount.toFixed(1);
        const componentCount = Object.keys(log.actualAmounts).length;
        csvData += `${groupName},${date},${totalAmount},${componentCount}\n`;
      }

      await Share.share({
        message: csvData,
        title: 'FutterRation_Protokoll.csv',
        url: undefined,
      });
    } catch (error) {
      Alert.alert('Export', 'Daten wurden kopiert. Du kannst sie jetzt einfügen.');
      console.error('Export error:', error);
    }
  };

  const renderLogItem = ({ item }: { item: any }) => (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/protocol-detail',
          params: { logId: item.id },
        })
      }
      style={({ pressed }) => [
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 8,
          padding: 12,
          marginBottom: 8,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View className="gap-2">
        <View className="flex-row justify-between items-start">
          <Text className="text-sm font-semibold text-foreground">
            {getGroupName(item.animalGroupId)}
          </Text>
          <Text className="text-xs text-muted">{formatDate(item.timestamp)}</Text>
        </View>
        <Text className="text-sm text-foreground">
          Gesamtmenge: <Text className="font-semibold">{item.totalAmount.toFixed(1)} kg</Text>
        </Text>
        <Text className="text-xs text-muted">
          {Object.keys(item.actualAmounts).length} Komponenten
        </Text>
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer className="p-6">
      <View className="flex-1 gap-4">
        {/* Header */}
        <View className="items-center gap-2 mb-2">
          <Text className="text-3xl font-bold text-foreground">Protokoll</Text>
          <Text className="text-sm text-muted text-center">
            Übersicht aller Fütterungen
          </Text>
        </View>

        {/* Group Filter */}
        <View className="gap-2">
          <Text className="text-xs font-semibold text-foreground uppercase">Filter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
            <Pressable
              onPress={() => setSelectedGroupId('all')}
              style={({ pressed }) => [
                {
                  backgroundColor:
                    selectedGroupId === 'all' ? colors.primary : colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                className={
                  selectedGroupId === 'all'
                    ? 'font-semibold text-background text-sm'
                    : 'font-medium text-foreground text-sm'
                }
              >
                Alle
              </Text>
            </Pressable>

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
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  className={
                    selectedGroupId === group.id
                      ? 'font-semibold text-background text-sm'
                      : 'font-medium text-foreground text-sm'
                  }
                >
                  {group.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Export Button */}
        {filteredLogs.length > 0 && (
          <Pressable
            onPress={handleExportCSV}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                borderRadius: 8,
                padding: 12,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text className="text-white font-semibold text-center">
              📥 Als CSV exportieren ({filteredLogs.length})
            </Text>
          </Pressable>
        )}

        {/* Logs List */}
        {filteredLogs.length > 0 ? (
          <FlatList
            data={filteredLogs}
            renderItem={renderLogItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={{ paddingTop: 8 }}
          />
        ) : (
          <View className="flex-1 items-center justify-center gap-3">
            <Text className="text-lg font-semibold text-foreground">Keine Einträge</Text>
            <Text className="text-sm text-muted text-center">
              Starte eine Fütterung, um Einträge zu erstellen
            </Text>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
