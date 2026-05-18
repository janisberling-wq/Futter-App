/**
 * Storage-Service für Futterrationen und Protokolle
 * Verwendet AsyncStorage für lokale Persistierung
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AnimalGroupId,
  BaseRation,
  FeedingSession,
  DEFAULT_BASE_RATIONS,
  FEEDING_COMPONENTS,
} from '@/lib/types/feeding';

const STORAGE_KEYS = {
  BASE_RATIONS: 'feeding:base_rations',
  FEEDING_LOGS: 'feeding:logs',
};

/**
 * Initialisiert die Standard-Grundrationen beim ersten Start
 */
export async function initializeBaseRations(): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEYS.BASE_RATIONS);
    if (!existing) {
      const initialRations: Record<AnimalGroupId, BaseRation> = {} as Record<AnimalGroupId, BaseRation>;
      for (const [groupId, components] of Object.entries(DEFAULT_BASE_RATIONS)) {
        initialRations[groupId as AnimalGroupId] = {
          animalGroupId: groupId as AnimalGroupId,
          components,
          lastUpdated: Date.now(),
        };
      }
      await AsyncStorage.setItem(
        STORAGE_KEYS.BASE_RATIONS,
        JSON.stringify(initialRations)
      );
    }
  } catch (error) {
    console.error('Error initializing base rations:', error);
  }
}

/**
 * Lädt die Grundration für eine Tiergruppe
 */
export async function getBaseRation(
  animalGroupId: AnimalGroupId
): Promise<BaseRation | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.BASE_RATIONS);
    if (!data) return null;
    const rations = JSON.parse(data) as Record<AnimalGroupId, BaseRation>;
    return rations[animalGroupId] || null;
  } catch (error) {
    console.error('Error loading base ration:', error);
    return null;
  }
}

/**
 * Speichert die Grundration für eine Tiergruppe
 */
export async function saveBaseRation(
  animalGroupId: AnimalGroupId,
  components: Record<string, number>
): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.BASE_RATIONS);
    const rations = data ? JSON.parse(data) : {};
    rations[animalGroupId] = {
      animalGroupId,
      components,
      lastUpdated: Date.now(),
    };
    await AsyncStorage.setItem(
      STORAGE_KEYS.BASE_RATIONS,
      JSON.stringify(rations)
    );
  } catch (error) {
    console.error('Error saving base ration:', error);
    throw error;
  }
}

/**
 * Speichert einen Fütterungseintrag
 */
export async function saveFeedingLog(session: FeedingSession): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.FEEDING_LOGS);
    const logs = data ? JSON.parse(data) : [];
    logs.push(session);
    await AsyncStorage.setItem(STORAGE_KEYS.FEEDING_LOGS, JSON.stringify(logs));
  } catch (error) {
    console.error('Error saving feeding log:', error);
    throw error;
  }
}

/**
 * Lädt alle Fütterungsprotokolle
 */
export async function getAllFeedingLogs(): Promise<FeedingSession[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.FEEDING_LOGS);
    if (!data) return [];
    const logs = JSON.parse(data) as FeedingSession[];
    return logs.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error loading feeding logs:', error);
    return [];
  }
}

/**
 * Lädt Fütterungsprotokolle für eine bestimmte Tiergruppe
 */
export async function getFeedingLogsByGroup(
  animalGroupId: AnimalGroupId
): Promise<FeedingSession[]> {
  try {
    const logs = await getAllFeedingLogs();
    return logs.filter((log) => log.animalGroupId === animalGroupId);
  } catch (error) {
    console.error('Error loading feeding logs for group:', error);
    return [];
  }
}

/**
 * Lädt einen einzelnen Fütterungseintrag
 */
export async function getFeedingLog(id: string): Promise<FeedingSession | null> {
  try {
    const logs = await getAllFeedingLogs();
    return logs.find((log) => log.id === id) || null;
  } catch (error) {
    console.error('Error loading feeding log:', error);
    return null;
  }
}

/**
 * Löscht einen Fütterungseintrag
 */
export async function deleteFeedingLog(id: string): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.FEEDING_LOGS);
    if (!data) return;
    const logs = JSON.parse(data) as FeedingSession[];
    const filtered = logs.filter((log) => log.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.FEEDING_LOGS, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting feeding log:', error);
    throw error;
  }
}

/**
 * Löscht alle Daten (für Debugging/Reset)
 */
export async function clearAllData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.BASE_RATIONS);
    await AsyncStorage.removeItem(STORAGE_KEYS.FEEDING_LOGS);
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
}
