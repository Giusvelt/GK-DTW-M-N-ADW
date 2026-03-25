-- ============================================================================
-- MIGRATION 021: SECURITY HARDENING — RLS su TUTTE le tabelle pubbliche
-- ============================================================================
-- Risolve l'alert critico Supabase: "rls_disabled_in_public"
-- Abilita RLS su ogni tabella dello schema public che ne è priva.
-- Le policy usano il pattern "authenticated users can read, role-based write".
-- ============================================================================

-- ─── 1. user_profiles ───────────────────────────────────────────────────────
-- Tabella critica: contiene ruoli e dati utente. Ogni utente legge il proprio profilo.
ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admin può vedere tutti i profili (necessario per User Management tab)
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.user_profiles;
CREATE POLICY "Admin can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('operation_admin', 'operation')
    )
  );

-- Admin può aggiornare tutti i profili
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.user_profiles;
CREATE POLICY "Admin can update all profiles"
  ON public.user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'operation_admin'
    )
  );

-- Insert policy per la registrazione (trigger on auth.users insert)
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.user_profiles;
CREATE POLICY "Service role can insert profiles"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);


-- ─── 2. vessel_positions ────────────────────────────────────────────────────
-- NOTA: La tabella vessel_positions non esiste nello schema public di questo progetto.
-- I dati posizionali sono gestiti tramite vista o tabella in altro schema.
-- Se in futuro viene creata, aggiungere RLS qui.


-- ─── 3. logbook_services ────────────────────────────────────────────────────
-- Servizi nautici associati al logbook. Stessa logica di logbook_entries.
ALTER TABLE IF EXISTS public.logbook_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read logbook services" ON public.logbook_services;
CREATE POLICY "Authenticated users can read logbook services"
  ON public.logbook_services FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Crew can insert logbook services" ON public.logbook_services;
CREATE POLICY "Crew can insert logbook services"
  ON public.logbook_services FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Crew can update logbook services" ON public.logbook_services;
CREATE POLICY "Crew can update logbook services"
  ON public.logbook_services FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Crew can delete logbook services" ON public.logbook_services;
CREATE POLICY "Crew can delete logbook services"
  ON public.logbook_services FOR DELETE
  USING (auth.role() = 'authenticated');


-- ─── 4. vessel_geofence_status ──────────────────────────────────────────────
-- Stato interno del motore geofencing. Solo lettura per utenti.
ALTER TABLE IF EXISTS public.vessel_geofence_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read geofence status" ON public.vessel_geofence_status;
CREATE POLICY "Authenticated can read geofence status"
  ON public.vessel_geofence_status FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service can manage geofence status" ON public.vessel_geofence_status;
CREATE POLICY "Service can manage geofence status"
  ON public.vessel_geofence_status FOR ALL
  USING (true);


-- ─── 5. intelligence_config ─────────────────────────────────────────────────
-- Configurazione del motore intelligence. Solo admin può modificare.
ALTER TABLE IF EXISTS public.intelligence_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read intelligence config" ON public.intelligence_config;
CREATE POLICY "Authenticated can read intelligence config"
  ON public.intelligence_config FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin can manage intelligence config" ON public.intelligence_config;
CREATE POLICY "Admin can manage intelligence config"
  ON public.intelligence_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'operation_admin'
    )
  );


-- ─── 6. production_plans_logs ──────────────────────────────────────────────
-- Log automatici dei trip counter. Solo lettura per utenti autenticati.
ALTER TABLE IF EXISTS public.production_plans_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read production logs" ON public.production_plans_logs;
CREATE POLICY "Authenticated can read production logs"
  ON public.production_plans_logs FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service can insert production logs" ON public.production_plans_logs;
CREATE POLICY "Service can insert production logs"
  ON public.production_plans_logs FOR INSERT
  WITH CHECK (true);


-- ─── 7. cron_logs ───────────────────────────────────────────────────────────
-- Log tecnici dei cron job. Solo lettura per admin.
ALTER TABLE IF EXISTS public.cron_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read cron logs" ON public.cron_logs;
CREATE POLICY "Admin can read cron logs"
  ON public.cron_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('operation_admin', 'operation')
    )
  );

DROP POLICY IF EXISTS "Service can insert cron logs" ON public.cron_logs;
CREATE POLICY "Service can insert cron logs"
  ON public.cron_logs FOR INSERT
  WITH CHECK (true);


-- ─── 8. weather_logs ────────────────────────────────────────────────────────
-- Se esiste, blindare anche questa.
ALTER TABLE IF EXISTS public.weather_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read weather logs" ON public.weather_logs;
CREATE POLICY "Authenticated can read weather logs"
  ON public.weather_logs FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service can insert weather logs" ON public.weather_logs;
CREATE POLICY "Service can insert weather logs"
  ON public.weather_logs FOR INSERT
  WITH CHECK (true);


-- ─── 9. standby_reasons ─────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.standby_reasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read standby reasons" ON public.standby_reasons;
CREATE POLICY "Authenticated can read standby reasons"
  ON public.standby_reasons FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin can manage standby reasons" ON public.standby_reasons;
CREATE POLICY "Admin can manage standby reasons"
  ON public.standby_reasons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'operation_admin'
    )
  );


-- ─── 10. vessel_schedules ───────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.vessel_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read schedules" ON public.vessel_schedules;
CREATE POLICY "Authenticated can read schedules"
  ON public.vessel_schedules FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Crew can manage own schedules" ON public.vessel_schedules;
CREATE POLICY "Crew can manage own schedules"
  ON public.vessel_schedules FOR ALL
  USING (auth.role() = 'authenticated');


-- ============================================================================
-- NOTA: Eseguire questo script nel Supabase SQL Editor.
-- Dopo l'esecuzione, verificare su https://supabase.com/dashboard che
-- l'alert "rls_disabled_in_public" sia scomparso.
-- ============================================================================
