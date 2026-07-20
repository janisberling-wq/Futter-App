import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { createFarm, farmExists, saveFarmCode } from '@/lib/supabase-service';

const DEFAULT_GROUPS = [
  { id: 'milchkuehe', name: 'Milchkühe' },
  { id: 'fresser', name: 'Fresser' },
  { id: 'bullen', name: 'Bullen' },
];

interface Props {
  onComplete: () => void;
}

export default function SetupScreen({ onComplete }: Props) {
  const colors = useColors();
  const [code, setCode] = useState('');
  const [farmName, setFarmName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'choose' | 'join' | 'create'>('choose');

  const handleJoin = async () => {
    if (!code.trim()) { Alert.alert('Fehler', 'Bitte einen Betriebscode eingeben'); return; }
    setIsLoading(true);
    try {
      const exists = await farmExists(code);
      if (!exists) {
        Alert.alert('Nicht gefunden', 'Kein Betrieb mit diesem Code gefunden. Bitte prüfe den Code oder erstelle einen neuen Betrieb.');
        return;
      }
      await saveFarmCode(code);
      onComplete();
    } catch {
      Alert.alert('Fehler', 'Verbindung zu Supabase fehlgeschlagen. Bitte Internetverbindung prüfen.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!code.trim()) { Alert.alert('Fehler', 'Bitte einen Betriebscode eingeben'); return; }
    if (!farmName.trim()) { Alert.alert('Fehler', 'Bitte einen Betriebsnamen eingeben'); return; }
    if (code.length < 4) { Alert.alert('Fehler', 'Der Code muss mindestens 4 Zeichen lang sein'); return; }
    setIsLoading(true);
    try {
      const exists = await farmExists(code);
      if (exists) {
        Alert.alert('Bereits vergeben', 'Dieser Code ist bereits vergeben. Bitte wähle einen anderen Code oder tritt dem Betrieb bei.');
        return;
      }
      await createFarm(code, farmName);
      await saveFarmCode(code);
      onComplete();
    } catch {
      Alert.alert('Fehler', 'Betrieb konnte nicht erstellt werden. Bitte Internetverbindung prüfen.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center', gap: 24 }}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: colors.foreground }}>FutterRation</Text>
        <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center' }}>
          Cloud-Synchronisation für dein Team
        </Text>
      </View>

      {mode === 'choose' && (
        <View style={{ gap: 12 }}>
          <Pressable
            onPress={() => setMode('join')}
            style={({ pressed }) => [{ backgroundColor: colors.primary, borderRadius: 8, padding: 16, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={{ textAlign: 'center', color: colors.background, fontWeight: '600', fontSize: 16 }}>
              Bestehendem Betrieb beitreten
            </Text>
            <Text style={{ textAlign: 'center', color: colors.background, fontSize: 12, marginTop: 4, opacity: 0.8 }}>
              Ich habe bereits einen Betriebscode
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setMode('create')}
            style={({ pressed }) => [{ backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1, borderRadius: 8, padding: 16, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={{ textAlign: 'center', color: colors.primary, fontWeight: '600', fontSize: 16 }}>
              Neuen Betrieb erstellen
            </Text>
            <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 4 }}>
              Ich starte neu und möchte meinen Betrieb einrichten
            </Text>
          </Pressable>
        </View>
      )}

      {mode === 'join' && (
        <View style={{ gap: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground }}>Betrieb beitreten</Text>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, color: colors.muted }}>Betriebscode</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 14, color: colors.foreground, fontSize: 18, fontWeight: '600', letterSpacing: 2 }}
              placeholder="z.B. HOFTANNER24"
              placeholderTextColor={colors.muted}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          <Pressable
            onPress={handleJoin}
            disabled={isLoading}
            style={({ pressed }) => [{ backgroundColor: colors.primary, borderRadius: 8, padding: 16, opacity: pressed || isLoading ? 0.8 : 1, alignItems: 'center' }]}
          >
            {isLoading ? <ActivityIndicator color={colors.background} /> : (
              <Text style={{ color: colors.background, fontWeight: '600', fontSize: 16 }}>Beitreten</Text>
            )}
          </Pressable>

          <Pressable onPress={() => setMode('choose')}>
            <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 14 }}>Zurück</Text>
          </Pressable>
        </View>
      )}

      {mode === 'create' && (
        <View style={{ gap: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground }}>Neuen Betrieb erstellen</Text>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, color: colors.muted }}>Betriebsname</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 14, color: colors.foreground, fontSize: 16 }}
              placeholder="z.B. Hof Tanner"
              placeholderTextColor={colors.muted}
              value={farmName}
              onChangeText={setFarmName}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, color: colors.muted }}>Betriebscode (wähle selbst)</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 14, color: colors.foreground, fontSize: 18, fontWeight: '600', letterSpacing: 2 }}
              placeholder="z.B. HOFTANNER24"
              placeholderTextColor={colors.muted}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase().replace(/\s/g, ''))}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Text style={{ fontSize: 11, color: colors.muted }}>
              Diesen Code teilst du mit deinen Mitarbeitern damit sie beitreten können.
            </Text>
          </View>

          <Pressable
            onPress={handleCreate}
            disabled={isLoading}
            style={({ pressed }) => [{ backgroundColor: colors.primary, borderRadius: 8, padding: 16, opacity: pressed || isLoading ? 0.8 : 1, alignItems: 'center' }]}
          >
            {isLoading ? <ActivityIndicator color={colors.background} /> : (
              <Text style={{ color: colors.background, fontWeight: '600', fontSize: 16 }}>Betrieb erstellen</Text>
            )}
          </Pressable>

          <Pressable onPress={() => setMode('choose')}>
            <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 14 }}>Zurück</Text>
          </Pressable>
        </View>
      )}

      <View style={{ padding: 12, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ fontSize: 11, color: colors.muted, textAlign: 'center' }}>
          💡 Alle Geräte mit demselben Betriebscode teilen Rationen, Protokolle und Bestand in Echtzeit.
        </Text>
      </View>
    </View>
  );
}
