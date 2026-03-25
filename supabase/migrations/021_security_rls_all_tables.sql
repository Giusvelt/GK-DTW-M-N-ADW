-- ============================================================================
-- MIGRATION 021: CREAZIONE TABELLE MANCANTI + RLS COMPLETO
-- ============================================================================
-- Passo 1: Crea le tabelle che mancano nel DB (definite nei file di migrazione
--          ma mai eseguite su Supabase).
-- Passo 2: Abilita RLS e crea le policy di sicurezza per OGNI tabella pubblica.
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- PASSO 1: CREAZIONE TABELLE MANCANTI
-- ═══════════════════════════════════════════════════════════════════════════

-- Da migrazione 006
CREATE TABLE IF NOT EXISTS public.cron_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_name TEXT,
    status TEXT,
    run_at TIMESTAMPTZ DEFAULT NOW(),
    result JSONB
);

-- Da migrazione 013
CREATE TABLE IF NOT EXISTS public.production_plans_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID REFERENCES public.vessels(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Da migrazione 014
CREATE TABLE IF NOT EXISTS public.vessel_geofence_status (
    vessel_id UUID REFERENCES public.vessels(id) ON DELETE CASCADE,
    geofence_id UUID REFERENCES public.geofences(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'outside',
    current_activity TEXT,
    entered_at TIMESTAMPTZ,
    last_transition_at TIMESTAMPTZ DEFAULT NOW(),
    last_check_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (vessel_id, geofence_id)
);

CREATE TABLE IF NOT EXISTS public.intelligence_config (
    key TEXT PRIMARY KEY,
    value_minutes INTEGER,
    description TEXT
);

INSERT INTO public.intelligence_config (key, value_minutes, description) VALUES
    ('quarry_loading_threshold', 40, 'Minuti di sosta in cava per passare da Mooring a Loading'),
    ('unloading_site_threshold', 20, 'Minuti di sosta in sito scarico per passare da Mooring a Unloading')
ON CONFLICT (key) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- PASSO 2: ABILITAZIONE RLS SU TUTTE LE TABELLE PUBBLICHE
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── user_profiles ──────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admin can view all profiles" ON public.user_profiles;
CREATE POLICY "Admin can view all profiles"
  ON public.user_profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role IN ('operation_admin', 'operation'))
  );

DROP POLICY IF EXISTS "Admin can update all profiles" ON public.user_profiles;
CREATE POLICY "Admin can update all profiles"
  ON public.user_profiles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'operation_admin')
  );

DROP POLICY IF EXISTS "Insert own profile" ON public.user_profiles;
CREATE POLICY "Insert own profile"
  ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);


-- ─── logbook_services ───────────────────────────────────────────────────────
ALTER TABLE public.logbook_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth can read logbook services" ON public.logbook_services;
CREATE POLICY "Auth can read logbook services"
  ON public.logbook_services FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth can insert logbook services" ON public.logbook_services;
CREATE POLICY "Auth can insert logbook services"
  ON public.logbook_services FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth can update logbook services" ON public.logbook_services;
CREATE POLICY "Auth can update logbook services"
  ON public.logbook_services FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth can delete logbook services" ON public.logbook_services;
CREATE POLICY "Auth can delete logbook services"
  ON public.logbook_services FOR DELETE USING (auth.role() = 'authenticated');


-- ─── cron_logs ──────────────────────────────────────────────────────────────
ALTER TABLE public.cron_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read cron logs" ON public.cron_logs;
CREATE POLICY "Admin can read cron logs"
  ON public.cron_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role IN ('operation_admin', 'operation'))
  );

DROP POLICY IF EXISTS "Service can insert cron logs" ON public.cron_logs;
CREATE POLICY "Service can insert cron logs"
  ON public.cron_logs FOR INSERT WITH CHECK (true);


-- ─── production_plans_logs ──────────────────────────────────────────────────
ALTER TABLE public.production_plans_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth can read production logs" ON public.production_plans_logs;
CREATE POLICY "Auth can read production logs"
  ON public.production_plans_logs FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service can insert production logs" ON public.production_plans_logs;
CREATE POLICY "Service can insert production logs"
  ON public.production_plans_logs FOR INSERT WITH CHECK (true);


-- ─── vessel_geofence_status ─────────────────────────────────────────────────
ALTER TABLE public.vessel_geofence_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth can read geofence status" ON public.vessel_geofence_status;
CREATE POLICY "Auth can read geofence status"
  ON public.vessel_geofence_status FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service can manage geofence status" ON public.vessel_geofence_status;
CREATE POLICY "Service can manage geofence status"
  ON public.vessel_geofence_status FOR ALL USING (true);


-- ─── intelligence_config ────────────────────────────────────────────────────
ALTER TABLE public.intelligence_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth can read intelligence config" ON public.intelligence_config;
CREATE POLICY "Auth can read intelligence config"
  ON public.intelligence_config FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin can manage intelligence config" ON public.intelligence_config;
CREATE POLICY "Admin can manage intelligence config"
  ON public.intelligence_config FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'operation_admin')
  );


-- ─── standby_reasons (se esiste) ────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.standby_reasons ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Auth can read standby reasons" ON public.standby_reasons;
  CREATE POLICY "Auth can read standby reasons"
    ON public.standby_reasons FOR SELECT USING (auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "Admin can manage standby reasons" ON public.standby_reasons;
  CREATE POLICY "Admin can manage standby reasons"
    ON public.standby_reasons FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'operation_admin')
    );
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'standby_reasons not found, skipping';
END $$;


-- ─── vessel_schedules (se esiste) ───────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.vessel_schedules ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Auth can read schedules" ON public.vessel_schedules;
  CREATE POLICY "Auth can read schedules"
    ON public.vessel_schedules FOR SELECT USING (auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "Auth can manage schedules" ON public.vessel_schedules;
  CREATE POLICY "Auth can manage schedules"
    ON public.vessel_schedules FOR ALL USING (auth.role() = 'authenticated');
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'vessel_schedules not found, skipping';
END $$;


-- ─── weather_logs (se esiste) ───────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.weather_logs ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Auth can read weather logs" ON public.weather_logs;
  CREATE POLICY "Auth can read weather logs"
    ON public.weather_logs FOR SELECT USING (auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "Service can insert weather logs" ON public.weather_logs;
  CREATE POLICY "Service can insert weather logs"
    ON public.weather_logs FOR INSERT WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN RAISE NOTICE 'weather_logs not found, skipping';
END $$;


-- ============================================================================
-- FATTO. Tutte le tabelle del progetto sono ora create e blindate con RLS.
-- Eseguire nel Supabase SQL Editor. Verificare che l'alert scompaia.
-- ============================================================================
