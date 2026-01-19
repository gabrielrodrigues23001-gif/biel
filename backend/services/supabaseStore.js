const { supabase } = require('./supabaseClient');

function throwIfError(error) {
  if (!error) return;
  const err = new Error(error.message || 'Supabase error');
  err.code = error.code;
  err.details = error.details;
  throw err;
}

async function selectAll(table, orderBy = 'id') {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order(orderBy, { ascending: true });
  throwIfError(error);
  return data || [];
}

async function selectById(table, id) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  throwIfError(error);
  return data || null;
}

async function insertRow(table, payload, select = '*') {
  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select(select)
    .single();
  throwIfError(error);
  return data;
}

async function updateById(table, id, payload, select = '*') {
  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq('id', id)
    .select(select)
    .maybeSingle();
  throwIfError(error);
  return data || null;
}

async function deleteById(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  throwIfError(error);
  return true;
}

module.exports = {
  supabase,
  throwIfError,
  selectAll,
  selectById,
  insertRow,
  updateById,
  deleteById
};
