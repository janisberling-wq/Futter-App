import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveFeedingLog, saveInventoryItem, saveAnimalGroups, saveRation } from '@/lib/supabase-service';

const MIGRATION_DONE_KEY = 'app:migration_done';

const DEFAULT_GROUPS = [
  { id: 'milchkuehe', name: 'Milchkühe' },
  { id: 'fresser', name: 'Fresser' },
  { id: 'bullen', name: 'Bullen' },
];

export const isMigrationDone = async (): Promise<boolean> => {
  const done = await AsyncStorage.getItem(MIGRATION_DONE_KEY);
  return done === 'true';
};

export const runMigration = async (farmCode: string, onProgress?: (msg: string) => void): Promise<{ logs: number; inventory: number }> => {
  let migratedLogs = 0;
  let migratedInventory = 0;

  try {
    // 1. Tiergruppen laden
    onProgress?.('Lade Tiergruppen...');
    const groupData = await AsyncStorage.getItem('app:animal_groups');
    const groups = groupData ? JSON.parse(groupData) : DEFAULT_GROUPS;

    // Gruppen nach Supabase übertragen
    await saveAnimalGroups(farmCode, groups);

    // 2. Grundrationen laden und migrieren
    onProgress?.('Migriere Grundrationen...');
    const rationData = await AsyncStorage.getItem('feeding:base_rations');
    if (rationData) {
      const rations = JSON.parse(rationData);
      for (const [groupId, ration] of Object.entries(rations)) {
        try {
          await saveRation(farmCode, groupId, ration);
        } catch (e) { console.error('Ration migration error:', groupId, e); }
      }
    }

    // 3. Protokolle migrieren
    onProgress?.('Migriere Protokolle...');
    for (const group of groups) {
      const logsData = await AsyncStorage.getItem(`logs_${group.id}`);
      if (logsData) {
        const logs = JSON.parse(logsData);
        for (const log of logs) {
          try {
            await saveFeedingLog(farmCode, log);
            migratedLogs++;
          } catch (e) { console.error('Log migration error:', log.id, e); }
        }
      }
    }

    // 4. Bestand migrieren
    onProgress?.('Migriere Bestand...');
    const bestandData = await AsyncStorage.getItem('app:bestand');
    if (bestandData) {
      const bestand = JSON.parse(bestandData);
      for (const [compId, entry] of Object.entries(bestand as Record<string, any>)) {
        try {
          await saveInventoryItem(farmCode, { ...entry, id: compId });
          migratedInventory++;
        } catch (e) { console.error('Inventory migration error:', compId, e); }
      }
    }

    // 5. Migration als erledigt markieren
    await AsyncStorage.setItem(MIGRATION_DONE_KEY, 'true');
    onProgress?.('Migration abgeschlossen!');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }

  return { logs: migratedLogs, inventory: migratedInventory };
};
