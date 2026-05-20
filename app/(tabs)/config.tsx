import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, TextInput, Pressable, Alert, Modal } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_ANIMAL_GROUPS = [
  { id: 'milchkuehe', name: 'Milchkühe' },
  { id: 'fresser', name: 'Fresser' },
  { id: 'bullen', name: 'Bullen' },
];

const DEFAULT_FEEDING_COMPONENTS = [
  { id: 'maissilage', name: 'Maissilage' },
  { id: 'grassilage', name: 'Grassilage' },
  { id: 'stroh', name: 'Stroh' },
  { id: 'ausgleichsfutter', name: 'Ausgleichsfutter' },
  { id: 'kraftfutter', name: 'Kraftfutter' },
  { id: 'wasser', name: 'Wasser' },
];

interface FeedingComponent { id: string; name: string; }
interface AnimalGroup { id: string; name: string; }

const parseAmount = (value: string): number => {
  const num = parseFloat(value.replace(',', '.'));
  return isNaN(num) ? 0 : Math.max(0, num);
};
const formatAmount = (num: number): string => num.toFixed(2);
const isValidAmount = (value: string): boolean => {
  const num = parseAmount(value);
  return num >= 0 && num <= 10000;
};

const GROUPS_KEY = 'app:animal_groups';

export default function ConfigScreen() {
  const colors = useColors();
  const [animalGroups, setAnimalGroups] = useState<AnimalGroup[]>(DEFAULT_ANIMAL_GROUPS);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [components, setComponents] = useState<Record<string, string>>({});
  const [componentDefs, setComponentDefs] = useState<FeedingComponent[]>(DEFAULT_FEEDING_COMPONENTS);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddComponentModal, setShowAddComponentModal] = useState(false);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newComponentName, setNewComponentName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');

  const loadGroups = async () => {
    try {
      const data = await AsyncStorage.getItem(GROUPS_KEY);
      if (data) {
        const groups = JSON.parse(data);
        setAnimalGroups(groups);
        if (!selectedGroupId) setSelectedGroupId(groups[0]?.id || '');
      } else {
        setAnimalGroups(DEFAULT_ANIMAL_GROUPS);
        setSelectedGroupId(DEFAULT_ANIMAL_GROUPS[0].id);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  useEffect(() => { loadGroups(); }, []);

  useEffect(() => {
    if (!selectedGroupId) return;
    const loadRation = async () => {
      try {
        const data = await AsyncStorage.getItem('feeding:base_rations');
        if (data) {
          const rations = JSON.parse(data);
          const ration = rations[selectedGroupId] || null;
          if (ration) {
            const defs = ration.componentDefs || DEFAULT_FEEDING_COMPONENTS;
            setComponentDefs(defs);
            const formatted: Record<string, string> = {};
            for (const comp of defs) {
              formatted[comp.id] = formatAmount(ration.components[comp.id] || 0);
            }
            setComponents(formatted);
          } else {
            setComponentDefs(DEFAULT_FEEDING_COMPONENTS);
            const formatted: Record<string, string> = {};
            for (const comp of DEFAULT_FEEDING_COMPONENTS) formatted[comp.id] = '0.00';
            setComponents(formatted);
          }
        } else {
          setComponentDefs(DEFAULT_FEEDING_COMPONENTS);
          const formatted: Record<string, string> = {};
          for (const comp of DEFAULT_FEEDING_COMPONENTS) formatted[comp.id] = '0.00';
          setComponents(formatted);
        }
      } catch (error) { console.error('Error loading ration:', error); }
    };
    loadRation();
  }, [selectedGroupId]);

  const handleAddComponent = () => {
    const name = newComponentName.trim();
    if (!name) { Alert.alert('Fehler', 'Bitte einen Namen eingeben'); return; }
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    setComponentDefs((prev) => [...prev, { id, name }]);
    setComponents((prev) => ({ ...prev, [id]: '0.00' }));
    setNewComponentName('');
    setShowAddComponentModal(false);
  };

  const handleDeleteComponent = (compId: string) => {
    const isDefault = DEFAULT_FEEDING_COMPONENTS.some((c) => c.id === compId);
    if (isDefault) {
      Alert.alert('Hinweis', 'Standard-Komponenten können nicht gelöscht werden. Setze die Menge auf 0 um sie auszublenden.');
      return;
    }
    Alert.alert('Komponente löschen', 'Möchtest du diese Komponente wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => {
        setComponentDefs((prev) => prev.filter((c) => c.id !== compId));
        setComponents((prev) => { const u = { ...prev }; delete u[compId]; return u; });
      }},
    ]);
  };

  const handleAddGroup = async () => {
    const name = newGroupName.trim();
    if (!name) { Alert.alert('Fehler', 'Bitte einen Namen eingeben'); return; }
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    const newGroups = [...animalGroups, { id, name }];
    setAnimalGroups(newGroups);
    await AsyncStorage.setItem(GROUPS_KEY, JSON.stringify(newGroups));
    setSelectedGroupId(id);
    setNewGroupName('');
    setShowAddGroupModal(false);
  };

  const handleDeleteGroup = (group: AnimalGroup) => {
    Alert.alert(
      'Gruppe löschen',
      `"${group.name}" löschen? Alle Rationen und Protokolle dieser Gruppe gehen verloren.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: async () => {
          try {
            const rationData = await AsyncStorage.getItem('feeding:base_rations');
            if (rationData) {
              const rations = JSON.parse(rationData);
              delete rations[group.id];
              await AsyncStorage.setItem('feeding:base_rations', JSON.stringify(rations));
            }
            await AsyncStorage.removeItem(`logs_${group.id}`);
            const newGroups = animalGroups.filter((g) => g.id !== group.id);
            setAnimalGroups(newGroups);
            await AsyncStorage.setItem(GROUPS_KEY, JSON.stringify(newGroups));
            if (selectedGroupId === group.id) setSelectedGroupId(newGroups[0]?.id || '');
          } catch { Alert.alert('Fehler', 'Gruppe konnte nicht gelöscht werden'); }
        }},
      ]
    );
  };

  const handleSave = async () => {
    for (const [id, value] of Object.entries(components)) {
      if (!isValidAmount(value)) {
        const comp = componentDefs.find((c) => c.id === id);
        Alert.alert('Fehler', `Ungültige Eingabe für ${comp?.name || id}`);
        return;
      }
    }
    setIsSaving(true);
    try {
      const data = await AsyncStorage.getItem('feeding:base_rations');
      const rations = data ? JSON.parse(data) : {};
      const componentValues: Record<string, number> = {};
      for (const [id, value] of Object.entries(components)) componentValues[id] = parseAmount(value);
      rations[selectedGroupId] = { animalGroupId: selectedGroupId, components: componentValues, componentDefs, lastUpdated: Date.now() };
      await AsyncStorage.setItem('feeding:base_rations', JSON.stringify(rations));
      Alert.alert('Erfolg', 'Grundration gespeichert');
    } catch { Alert.alert('Fehler', 'Grundration konnte nicht gespeichert werden'); }
    finally { setIsSaving(false); }
  };

  const selectedGroup = animalGroups.find((g) => g.id === selectedGroupId);

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-6">
          <View className="items-center gap-2 mb-2">
            <Text className="text-3xl font-bold text-foreground">Konfiguration</Text>
            <Text className="text-sm text-muted text-center">Passe die Grundrationen pro Tier an</Text>
          </View>

          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">Tiergruppe</Text>
            <View className="gap-2">
              {animalGroups.map((group) => (
                <View key={group.id} className="flex-row gap-2 items-center">
                  <Pressable
                    onPress={() => setSelectedGroupId(group.id)}
                    style={({ pressed }) => [{ flex: 1, backgroundColor: selectedGroupId === group.id ? colors.primary : colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Text className={selectedGroupId === group.id ? 'font-semibold text-background' : 'font-medium text-foreground'}>
                      {group.name}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeleteGroup(group)}
                    style={({ pressed }) => [{ backgroundColor: colors.surface, borderColor: '#ef4444', borderWidth: 1, borderRadius: 8, padding: 10, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text style={{ color: '#ef4444' }}>🗑</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={() => setShowAddGroupModal(true)}
                style={({ pressed }) => [{ backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 12, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text className="text-center font-medium text-primary">+ Gruppe hinzufügen</Text>
              </Pressable>
            </View>
          </View>

          {selectedGroup && (
            <View className="gap-4">
              <Text className="text-sm font-semibold text-foreground">
                Grundration für {selectedGroup.name} (kg pro Tier)
              </Text>
              {componentDefs.map((comp) => (
                <View key={comp.id} className="gap-2">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-sm text-foreground font-medium">{comp.name}</Text>
                    <Pressable onPress={() => handleDeleteComponent(comp.id)}>
                      <Text className="text-xs font-medium" style={{ color: DEFAULT_FEEDING_COMPONENTS.some((c) => c.id === comp.id) ? colors.muted : '#ef4444' }}>
                        {DEFAULT_FEEDING_COMPONENTS.some((c) => c.id === comp.id) ? 'Standard' : 'Löschen'}
                      </Text>
                    </Pressable>
                  </View>
                  <View className="flex-row items-center gap-2 px-4 py-3 bg-surface rounded-lg border border-border" style={{ borderColor: colors.border }}>
                    <TextInput
                      className="flex-1 text-foreground text-base"
                      placeholder="0.00"
                      placeholderTextColor={colors.muted}
                      keyboardType="decimal-pad"
                      value={components[comp.id] || ''}
                      onChangeText={(value) => setComponents((prev) => ({ ...prev, [comp.id]: value }))}
                    />
                    <Text className="text-sm text-muted font-medium">kg</Text>
                  </View>
                </View>
              ))}
              <Pressable
                onPress={() => setShowAddComponentModal(true)}
                style={({ pressed }) => [{ backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1, borderStyle: 'dashed', borderRadius: 8, padding: 12, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text className="text-center font-medium text-primary">+ Komponente hinzufügen</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={({ pressed }) => [{ backgroundColor: colors.primary, borderRadius: 8, padding: 16, opacity: pressed || isSaving ? 0.8 : 1 }]}
          >
            <Text className="text-center font-semibold text-background text-base">
              {isSaving ? 'Speichert...' : 'Speichern'}
            </Text>
          </Pressable>

          <View className="p-4 bg-primary/10 rounded-lg border border-primary/20">
            <Text className="text-xs text-foreground font-medium">
              💡 Komponenten mit Menge 0 werden bei der Fütterung ausgeblendet.
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showAddComponentModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.background, borderRadius: 12, padding: 24, gap: 16 }}>
            <Text className="text-lg font-bold text-foreground">Neue Komponente</Text>
            <TextInput
              className="text-foreground text-base px-4 py-3 bg-surface rounded-lg border border-border"
              style={{ borderColor: colors.border }}
              placeholder="z.B. Rübenblatt"
              placeholderTextColor={colors.muted}
              value={newComponentName}
              onChangeText={setNewComponentName}
              autoFocus
            />
            <View className="flex-row gap-3">
              <Pressable onPress={() => { setShowAddComponentModal(false); setNewComponentName(''); }} style={({ pressed }) => [{ flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, opacity: pressed ? 0.8 : 1 }]}>
                <Text className="text-center font-medium text-foreground">Abbrechen</Text>
              </Pressable>
              <Pressable onPress={handleAddComponent} style={({ pressed }) => [{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, padding: 12, opacity: pressed ? 0.8 : 1 }]}>
                <Text className="text-center font-semibold text-background">Hinzufügen</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddGroupModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.background, borderRadius: 12, padding: 24, gap: 16 }}>
            <Text className="text-lg font-bold text-foreground">Neue Tiergruppe</Text>
            <TextInput
              className="text-foreground text-base px-4 py-3 bg-surface rounded-lg border border-border"
              style={{ borderColor: colors.border }}
              placeholder="z.B. Kälber"
              placeholderTextColor={colors.muted}
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
            />
            <View className="flex-row gap-3">
              <Pressable onPress={() => { setShowAddGroupModal(false); setNewGroupName(''); }} style={({ pressed }) => [{ flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, opacity: pressed ? 0.8 : 1 }]}>
                <Text className="text-center font-medium text-foreground">Abbrechen</Text>
              </Pressable>
              <Pressable onPress={handleAddGroup} style={({ pressed }) => [{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, padding: 12, opacity: pressed ? 0.8 : 1 }]}>
                <Text className="text-center font-semibold text-background">Hinzufügen</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}