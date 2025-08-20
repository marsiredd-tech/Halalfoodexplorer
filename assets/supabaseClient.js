/* global window, supabase */
(function(){
  // Prefer values from env.js; fallback to localStorage for quick testing.
  const url = window.SUPABASE_URL || localStorage.getItem('hr_supabase_url');
  const key = window.SUPABASE_ANON_KEY || localStorage.getItem('hr_supabase_key');
  if(!url || !key){
    console.warn("Supabase URL/Key missing. Create assets/env.js from env.sample.js.");
  }
  window.sb = supabase.createClient(url, key);
})();
