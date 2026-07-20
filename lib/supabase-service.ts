import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://ihemtstdgsqfjvtbnlpb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloZW10c3RkZ3NxZmp2dGJubHBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NjgxNTEsImV4cCI6MjEwMDE0NDE1MX0.qyMJL56RJtczHCcg6v0zPPJ2UiTkhsl0QggtE8t4_Y4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const FARM_CODE_KEY = 'app:farm_code';

export const getFarmCode = async (): Promise<string | null> => {
  return await AsyncStorage.getItem(FARM_CODE_KEY);
};

export const saveFarmCode = async (code: string): Promise<void> => {
  await AsyncStorage.setItem(FARM_CODE_KEY, code.toUpperCase().trim());
};

// Farm
export const createFarm = async (code: string, name: string) => {
  const { error } = await supabase.from('farms').insert({ code: code.toUpperCase().trim(), name });
  if (error) throw error;
};

export const farmExists = async (code: string): Promise<boolean> => {
  const { data } = await supabase.from('farms').select('code').eq('code', code.toUpperCase().trim()).single();
  return !!data;
};

// Animal Groups
export const getAnimalGroups = async (farmCode: string) => {
  const { data, error } = await supabase.from('animal_groups').select('*').eq('farm_code', farmCode).order('created_at');
  if (error) throw error;
  return data?.map((r: any) => ({ id: r.group_id, name: r.name })) || [];
};

export const saveAnimalGroups = async (farmCode: string, groups: { id: string; name: string }[]) => {
  await supabase.from('animal_groups').delete().eq('farm_code', farmCode);
  if (groups.length > 0) {
    const { error } = await supabase.from('animal_groups').insert(
      groups.map(g => ({ farm_code: farmCode, group_id: g.id, name: g.name }))
    );
    if (error) throw error;
  }
};

// Rations
export const getRations = async (farmCode: string) => {
  const { data, error } = await supabase.from('rations').select('*').eq('farm_code', farmCode);
  if (error) throw error;
  const result: Record<string, any> = {};
  for (const r of data || []) {
    result[r.group_id] = {
      animalGroupId: r.group_id,
      components: r.components,
      componentDefs: r.component_defs,
      leadComponentIds: r.lead_component_ids || [],
      lastUpdated: new Date(r.updated_at).getTime(),
    };
  }
  return result;
};

export const saveRation = async (farmCode: string, groupId: string, ration: any) => {
  const { error } = await supabase.from('rations').upsert({
    farm_code: farmCode,
    group_id: groupId,
    components: ration.components,
    component_defs: ration.componentDefs,
    lead_component_ids: ration.leadComponentIds || [],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'farm_code,group_id' });
  if (error) throw error;
};

export const deleteRation = async (farmCode: string, groupId: string) => {
  const { error } = await supabase.from('rations').delete().eq('farm_code', farmCode).eq('group_id', groupId);
  if (error) throw error;
};

// Feeding Logs
export const getFeedingLogs = async (farmCode: string, groupId?: string) => {
  let query = supabase.from('feeding_logs').select('*').eq('farm_code', farmCode).order('timestamp', { ascending: false });
  if (groupId) query = query.eq('animal_group_id', groupId);
  const { data, error } = await query;
  if (error) throw error;
  return data?.map((r: any) => ({
    id: r.session_id,
    animalGroupId: r.animal_group_id,
    timestamp: r.timestamp,
    totalAmount: r.total_amount,
    freshAmount: r.fresh_amount,
    restAmount: r.rest_amount,
    restPerComponent: r.rest_per_component,
    plannedAmounts: r.planned_amounts,
    actualAmounts: r.actual_amounts,
    completed: r.completed,
  })) || [];
};

export const saveFeedingLog = async (farmCode: string, session: any) => {
  const { error } = await supabase.from('feeding_logs').insert({
    farm_code: farmCode,
    session_id: session.id,
    animal_group_id: session.animalGroupId,
    timestamp: session.timestamp,
    total_amount: session.totalAmount,
    fresh_amount: session.freshAmount,
    rest_amount: session.restAmount,
    rest_per_component: session.restPerComponent,
    planned_amounts: session.plannedAmounts,
    actual_amounts: session.actualAmounts,
    completed: session.completed,
  });
  if (error) throw error;
};

export const deleteFeedingLog = async (farmCode: string, sessionId: string) => {
  const { error } = await supabase.from('feeding_logs').delete().eq('farm_code', farmCode).eq('session_id', sessionId);
  if (error) throw error;
};

// Inventory
export const getInventory = async (farmCode: string) => {
  const { data, error } = await supabase.from('inventory').select('*').eq('farm_code', farmCode);
  if (error) throw error;
  const result: Record<string, any> = {};
  for (const r of data || []) {
    result[r.component_id] = {
      id: r.component_id,
      name: r.name,
      tracked: r.tracked,
      currentStock: r.current_stock,
      warningEnabled: r.warning_enabled,
      warningThreshold: r.warning_threshold,
    };
  }
  return result;
};

export const saveInventoryItem = async (farmCode: string, item: any) => {
  const { error } = await supabase.from('inventory').upsert({
    farm_code: farmCode,
    component_id: item.id,
    name: item.name,
    tracked: item.tracked,
    current_stock: item.currentStock,
    warning_enabled: item.warningEnabled,
    warning_threshold: item.warningThreshold,
  }, { onConflict: 'farm_code,component_id' });
  if (error) throw error;
};

export const updateInventoryStock = async (farmCode: string, componentId: string, newStock: number) => {
  const { error } = await supabase.from('inventory').update({ current_stock: newStock })
    .eq('farm_code', farmCode).eq('component_id', componentId);
  if (error) throw error;
};

// Feeding Order
export const getFeedingOrder = async (farmCode: string, groupId: string): Promise<string[] | null> => {
  const { data } = await supabase.from('feeding_order').select('order_ids').eq('farm_code', farmCode).eq('group_id', groupId).single();
  return data?.order_ids || null;
};

export const saveFeedingOrder = async (farmCode: string, groupId: string, orderIds: string[]) => {
  const { error } = await supabase.from('feeding_order').upsert({
    farm_code: farmCode,
    group_id: groupId,
    order_ids: orderIds,
  }, { onConflict: 'farm_code,group_id' });
  if (error) throw error;
};
