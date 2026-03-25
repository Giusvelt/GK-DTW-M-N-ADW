-- ============================================================================
-- MIGRATION 021: SECURITY HARDENING — RLS SU SCHEMA REALE
-- ============================================================================
-- Questo script abilita la sicurezza (Row Level Security) su tutte le tabelle
-- critiche identificate nell'audit dello schema public.
-- ============================================================================

-- ─── 0. cron_logs (Creazione se mancante) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cron_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_name TEXT,
    status TEXT,
    run_at TIMESTAMPTZ DEFAULT NOW(),
    result JSONB
);

-- ─── 1. user_profiles ───────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles read access" ON public.user_profiles;
CREATE POLICY "Profiles read access"
  ON public.user_profiles FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Profiles self update" ON public.user_profiles;
CREATE POLICY "Profiles self update"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- ─── 2. vessels ─────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.vessels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vessels read access" ON public.vessels;
CREATE POLICY "Vessels read access"
  ON public.vessels FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─── 3. vessel_activity ─────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.vessel_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Activity read access" ON public.vessel_activity;
CREATE POLICY "Activity read access"
  ON public.vessel_activity FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Activity update for crew" ON public.vessel_activity;
CREATE POLICY "Activity update for crew"
  ON public.vessel_activity FOR ALL
  USING (auth.role() = 'authenticated');

-- ─── 4. vessel_tracking (IL MOTORE AIS) ─────────────────────────────────────
ALTER TABLE IF EXISTS public.vessel_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tracking read access" ON public.vessel_tracking;
CREATE POLICY "Tracking read access"
  ON public.vessel_tracking FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role write tracking" ON public.vessel_tracking;
CREATE POLICY "Service role write tracking"
  ON public.vessel_tracking FOR INSERT
  WITH CHECK (true); -- Per le Edge Functions

-- ─── 5. logbook_entries ─────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.logbook_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Logbook read access" ON public.logbook_entries;
CREATE POLICY "Logbook read access"
  ON public.logbook_entries FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Logbook write access" ON public.logbook_entries;
CREATE POLICY "Logbook write access"
  ON public.logbook_entries FOR ALL
  USING (auth.role() = 'authenticated');

-- ─── 6. audit_logs ──────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Audit logs read access" ON public.audit_logs;
CREATE POLICY "Audit logs read access"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('operation_admin', 'operation'))
  );

DROP POLICY IF EXISTS "Audit logs insert" ON public.audit_logs;
CREATE POLICY "Audit logs insert"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ─── 7. production_plans ────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.production_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Production read access" ON public.production_plans;
CREATE POLICY "Production read access"
  ON public.production_plans FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─── 8. geofences ───────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.geofences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Geofences read access" ON public.geofences;
CREATE POLICY "Geofences read access"
  ON public.geofences FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─── 9. activity_messages ───────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.activity_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Messages read access" ON public.activity_messages;
CREATE POLICY "Messages read access"
  ON public.activity_messages FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Messages insert" ON public.activity_messages;
CREATE POLICY "Messages insert"
  ON public.activity_messages FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ─── 10. intelligence_config ────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.intelligence_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Intelligence config read" ON public.intelligence_config;
CREATE POLICY "Intelligence config read"
  ON public.intelligence_config FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- SCRIPT COMPLETATO. Eseguire nel Supabase SQL Editor.
-- Allinea la sicurezza al 100% sullo schema REALE scoperto nell'audit.
-- ============================================================================
