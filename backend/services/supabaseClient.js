const { createClient } = require('@supabase/supabase-js');

function getEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var ${name}`);
  }
  return typeof value === 'string' ? value.trim() : value;
}

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || getEnv('SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

module.exports = { supabase };
