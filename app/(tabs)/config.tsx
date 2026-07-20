import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, Text, View, TextInput, Pressable, Alert, Modal, ActivityIndicator } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useFocusEffect } from 'expo-router';
import {
  getFarmCode, getAnimalGroups, saveAnimalGroups,
  getRations, saveRation, deleteRation, getFeedingLogs, deleteFeedingLog
} from '@/lib/supabase-service';

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
  return num >= 0 && num <= 100000;
};

export default function ConfigScreen() {
  const colors = useColors();
  const [farmCode, setFarmCode] = useState<string | null>(null);
  const [animalGroups, setAnimalGroups] = useState<AnimalGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [components, setComponents] = useState<Record<string, string>>({});
  const [componentDefs, setComponentDefs] = useState<FeedingComponent[]>(DEFAULT_FEEDING_COMPONENTS);
  const [leadComponentIds, setLeadComponentIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [showAddComponentModal, setShowAddComponentModal] = useState(false);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newComponentName, setNewComponentName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const code = await getFarmCode();
      setFarmCode(code);
      if (!code) return;

      const groups = await getAnimalGroups(code);
      setAnimalGroups(groups);
      if (groups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(groups[0].id);
      }
    } catch (error) {
      Alert.alert('Fehler', 'Daten konnten nicht geladen werden');
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  useEffect(() => {
    if (!selectedGroupId || !farmCode) return;
    const loadRation = async () => {
      try {
        const rations = await getRations(farmCode);
        const ration = rations[selectedGroupId];
        if (ration) {
          const defs = ration.componentDefs || DEFAULT_FEEDING_COMPONENTS;
          setComponentDefs(defs);
          setLeadComponentIds(ration.leadComponentIds || defs.map((c: FeedingComponent) => c.id));
          const formatted: Record<string, string> = {};
          for (const comp of defs) {
            formatted[comp.id] = formatAmount(ration.components[comp.id] || 0);
          }
          setComponents(formatted);
        } else {
          setComponentDefs(DEFAULT_FEEDING_COMPONENTS);
          setLeadComponentIds(DEFAULT_FEEDING_COMPONENTS.map(c => c.id));
          const formatted: Record<string, string> = {};
          for (const comp of DEFAULT_FEEDING_COMPONENTS) formatted[comp.id] = '0.00';
          setComponents(formatted);
        }
      } catch { console.error('Error loading ration'); }
    };
    loadRation();
  }, [selectedGroupId, farmCode]);

  const handleAddComponent = () => {
    const name = newComponentName.trim();
    if (!name) { Alert.alert('Fehler', 'Bitte einen Namen eingeben'); return; }
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    setComponentDefs((prev) => [...prev, { id, name }]);
    setComponents((prev) => ({ ...prev, [id]: '0.00' }));
    setLeadComponentIds((prev) => [...prev, id]);
    setNewComponentName('');
    setShowAddComponentModal(false);
  };

  const handleDeleteComponent = (compId: string) => {
    Alert.alert('Komponente löschen', 'Möchtest du diese Komponente wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => {
        setComponentDefs((prev) => prev.filter((c) => c.id !== compId));
        setComponents((prev) => { const u = { ...prev }; delete u[compId]; return u; });
        setLeadComponentIds((prev) => prev.filter(id => id !== compId));
      }},
    ]);
  };

  const toggleLeadComponent = (compId: string) => {
    setLeadComponentIds((prev) =>
      prev.includes(compId) ? prev.filter(id => id !== compId) : [...prev, compId]
    );
  };

  const handleAddGroup = async () => {
    const name = newGroupName.trim();
    if (!name || !farmCode) { Alert.alert('Fehler', 'Bitte einen Namen eingeben'); return; }
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    const newGroups = [...animalGroups, { id, name }];
    try {
      await saveAnimalGroups(farmCode, newGroups);
      setAnimalGroups(newGroups);
      setSelectedGroupId(id);
      setNewGroupName('');
      setShowAddGroupModal(false);
    } catch { Alert.alert('Fehler', 'Gruppe konnte nicht gespeichert werden'); }
  };

  const handleDeleteGroup = (group: AnimalGroup) => {
    Alert.alert('Gruppe löschen', `"${group.name}" löschen? Alle Rationen und Protokolle dieser Gruppe gehen verloren.`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: async () => {
        if (!farmCode) return;
        try {
          await deleteRation(farmCode, group.id);
          const logs = await getFeedingLogs(farmCode, group.id);
          for (const log of logs) await deleteFeedingLog(farmCode, log.id);
          const newGroups = animalGroups.filter((g) => g.id !== group.id);
          await saveAnimalGroups(farmCode, newGroups);
          setAnimalGroups(newGroups);
          if (selectedGroupId === group.id) setSelectedGroupId(newGroups[0]?.id || '');
        } catch { Alert.alert('Fehler', 'Gruppe konnte nicht gelöscht werden'); }
      }},
    ]);
  };

  const handleSave = async () => {
    if (!farmCode) return;
    for (const [id, value] of Object.entries(components)) {
      if (!isValidAmount(value)) {
        const comp = componentDefs.find((c) => c.id === id);
        Alert.alert('Fehler', `Ungültige Eingabe für ${comp?.name || id}`);
        return;
      }
    }
    setIsSaving(true);
    try {
      const componentValues: Record<string, number> = {};
      for (const [id, value] of Object.entries(components)) componentValues[id] = parseAmount(value);
      await saveRation(farmCode, selectedGroupId, {
        components: componentValues,
        componentDefs,
        leadComponentIds,
        lastUpdated: Date.now(),
      });
      Alert.alert('Erfolg', 'Grundration gespeichert');
    } catch { Alert.alert('Fehler', 'Grundration konnte nicht gespeichert werden'); }
    finally { setIsSaving(false); }
  };

  const selectedGroup = animalGroups.find((g) => g.id === selectedGroupId);

  if (isLoading) {
    return (
      <ScreenContainer className="p-6">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, fontSize: 14 }}>Lade Daten...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-6">
          <View className="items-center gap-2 mb-2">
            <Text className="text-3xl font-bold text-foreground">Konfiguration</Text>
            <Text className="text-xs text-muted text-center">Betrieb: {farmCode}</Text>
          </View>

          {/* Groups */}
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

          {/* Components */}
          {selectedGroup && (
            <View className="gap-4">
              <Text className="text-sm font-semibold text-foreground">
                Grundration für {selectedGroup.name} (kg pro Tier)
              </Text>

              {componentDefs.map((comp) => {
                const isLead = leadComponentIds.includes(comp.id);
                return (
                  <View key={comp.id} className="gap-2">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-sm text-foreground font-medium">{comp.name}</Text>
                      <Pressable onPress={() => handleDeleteComponent(comp.id)}>
                        <Text className="text-xs font-medium" style={{ color: '#ef4444' }}>Löschen</Text>
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
                    {/* Leitkomponente Toggle */}
                    <Pressable
                      onPress={() => toggleLeadComponent(comp.id)}
                      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.7 : 1 }]}
                    >
                      <View style={{
                        width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                        borderColor: isLead ? colors.primary : colors.border,
                        backgroundColor: isLead ? colors.primary : 'transparent',
                        alignItems: 'center', justifyContent: 'center'
                      }}>
                        {isLead && <Text style={{ color: colors.background, fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
                      </View>
                      <Text className="text-xs text-muted">
                        {isLead ? '🎯 Leitkomponente (beeinflusst Tieranzahl)' : '📊 Folgekomponente (wird nur berechnet)'}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}

              <View className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <Text className="text-xs text-foreground font-medium">
                  🎯 Leitkomponenten bestimmen die Tieranzahl. 📊 Folgekomponenten werden nur anhand der Leitkomponenten berechnet und beeinflussen die Tieranzahl nicht.
                </Text>
              </View>

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
        </View>
      </ScrollView>

      {/* Add Component Modal */}
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
              <Pressable onPress={() => { setShowAddComponentModal(false); setNewComponentName(''); }}
                style={({ pressed }) => [{ flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, opacity: pressed ? 0.8 : 1 }]}>
                <Text className="text-center font-medium text-foreground">Abbrechen</Text>
              </Pressable>
              <Pressable onPress={handleAddComponent}
                style={({ pressed }) => [{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, padding: 12, opacity: pressed ? 0.8 : 1 }]}>
                <Text className="text-center font-semibold text-background">Hinzufügen</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Group Modal */}
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
              <Pressable onPress={() => { setShowAddGroupModal(false); setNewGroupName(''); }}
                style={({ pressed }) => [{ flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 12, opacity: pressed ? 0.8 : 1 }]}>
                <Text className="text-center font-medium text-foreground">Abbrechen</Text>
              </Pressable>
              <Pressable onPress={handleAddGroup}
                style={({ pressed }) => [{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, padding: 12, opacity: pressed ? 0.8 : 1 }]}>
                <Text className="text-center font-semibold text-background">Hinzufügen</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
