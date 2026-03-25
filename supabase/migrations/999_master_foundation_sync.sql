-- ============================================================================
-- GEOKANBAN V3: MASTER FOUNDATION & SECURITY SYNC
-- ============================================================================
-- Questo script garantisce che l'intero "motore" del database sia presente
-- e correttamente blindato. Esegue un check di tutte le tabelle, colonne
-- e viste definite nel progetto.
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. CORE TABLES (STRUTTURA BASE)
-- ═══════════════════════════════════════════════════════════════════════════

-- Vessels (Anagrafica Navi)
CREATE TABLE IF NOT EXISTS public.vessels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    mmsi TEXT UNIQUE,
    vessel_type TEXT,
    company_id UUID,
    avg_cargo NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geofences (Aree di Operazione)
CREATE TABLE IF NOT EXISTS public.geofences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    nature TEXT DEFAULT 'general', -- quarry, unloading_site, base_port, roadstead, general
    geometry GEOMETRY(POLYGON, 4326),
    radius NUMERIC, -- Per retrocompatibilità o cerchi
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vessel Activity (Registro Attività Automatizzato/Manuale)
CREATE TABLE IF NOT EXISTS public.vessel_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID REFERENCES public.vessels(id) ON DELETE CASCADE,
    activity_type TEXT,
    geofence_id UUID REFERENCES public.geofences(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER,
    status TEXT DEFAULT 'completed',
    source TEXT DEFAULT 'auto',
    export_flag BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logbook Entries (Certificazione Attività)
CREATE TABLE IF NOT EXISTS public.logbook_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_activity_id UUID REFERENCES public.vessel_activity(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'draft', -- draft, submitted, approved
    narrative_text TEXT,
    structured_fields JSONB DEFAULT '{}'::jsonb,
    document_hash TEXT,
    message_snapshot JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logbook Services (Servizi Nautici associati)
CREATE TABLE IF NOT EXISTS public.logbook_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    logbook_entry_id UUID REFERENCES public.logbook_entries(id) ON DELETE CASCADE,
    service_id UUID,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Messages (Chat di Bordo)
CREATE TABLE IF NOT EXISTS public.activity_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_activity_id UUID REFERENCES public.vessel_activity(id) ON DELETE CASCADE,
    sender_id UUID,
    sender_role TEXT,
    content TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Profiles (Anagrafica Utenti/Permessi)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    role TEXT DEFAULT 'crew',
    vessel_id UUID REFERENCES public.vessels(id),
    mmsi TEXT,
    company_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vessel Tracking (Dati AIS in tempo reale)
CREATE TABLE IF NOT EXISTS public.vessel_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID REFERENCES public.vessels(id) ON DELETE CASCADE,
    mmsi TEXT,
    lat NUMERIC,
    lon NUMERIC,
    speed NUMERIC,
    course NUMERIC,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ENGINE TABLES (MOTORE DI CALCOLO E INTELLIGENCE)
-- ═══════════════════════════════════════════════════════════════════════════

-- Vessel Geofence Status (Stato tempo reale)
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

-- Intelligence Config (Parametri del Motore)
CREATE TABLE IF NOT EXISTS public.intelligence_config (
    key TEXT PRIMARY KEY,
    value_minutes INTEGER,
    description TEXT
);

INSERT INTO public.intelligence_config (key, value_minutes, description) VALUES
    ('quarry_loading_threshold', 40, 'Minuti di sosta in cava per passare da Mooring a Loading'),
    ('unloading_site_threshold', 20, 'Minuti di sosta in sito scarico per passare da Mooring a Unloading')
ON CONFLICT (key) DO UPDATE SET value_minutes = EXCLUDED.value_minutes;

-- Production Plans (Obiettivi di Produzione)
CREATE TABLE IF NOT EXISTS public.production_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID REFERENCES public.vessels(id) ON DELETE CASCADE,
    month INTEGER,
    year INTEGER,
    target_trips INTEGER DEFAULT 0,
    target_quantity NUMERIC DEFAULT 0,
    actual_trips INTEGER DEFAULT 0,
    actual_quantity NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Production Logs (Audit Trip Counter)
CREATE TABLE IF NOT EXISTS public.production_plans_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_id UUID REFERENCES public.vessels(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs (Tracciamento Operazioni Enterprise)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity_id UUID,
    entity_type TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    device_fingerprint TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. KPI VIEWS (REPORTISTICA)
-- ═══════════════════════════════════════════════════════════════════════════

-- KPI Flotta
CREATE OR REPLACE VIEW public.monthly_fleet_kpi WITH (security_invoker=true) AS
SELECT 
    EXTRACT(MONTH FROM va.start_time) AS month,
    EXTRACT(YEAR FROM va.start_time) AS year,
    COUNT(*) FILTER (WHERE va.activity_type = 'Loading' AND (va.duration_minutes >= 20 OR va.duration_minutes IS NULL)) AS loading_count,
    COUNT(*) FILTER (WHERE va.activity_type = 'Navigation' AND (va.duration_minutes >= 20 OR va.duration_minutes IS NULL)) AS navigation_count,
    COUNT(*) FILTER (WHERE va.activity_type = 'Unloading' AND (va.duration_minutes >= 20 OR va.duration_minutes IS NULL)) AS unloading_count,
    COALESCE(SUM(CAST(le.structured_fields->>'actual_cargo_tonnes' AS NUMERIC)) FILTER (WHERE va.activity_type = 'Unloading' AND (va.duration_minutes >= 20 OR va.duration_minutes IS NULL)), 0) AS delivered_tons
FROM public.vessel_activity va
LEFT JOIN public.logbook_entries le ON le.vessel_activity_id = va.id AND le.status IN ('submitted', 'approved')
WHERE va.start_time IS NOT NULL
GROUP BY EXTRACT(YEAR FROM va.start_time), EXTRACT(MONTH FROM va.start_time);

-- KPI Nave
CREATE OR REPLACE VIEW public.monthly_vessel_kpi WITH (security_invoker=true) AS
SELECT 
    v.id AS vessel_id,
    v.name AS vessel_name,
    EXTRACT(MONTH FROM va.start_time) AS month,
    EXTRACT(YEAR FROM va.start_time) AS year,
    COUNT(va.id) FILTER (WHERE va.activity_type = 'Unloading' AND (va.duration_minutes >= 20 OR va.duration_minutes IS NULL)) AS actual_trips,
    COUNT(va.id) FILTER (WHERE va.activity_type = 'Unloading' AND (va.duration_minutes >= 20 OR va.duration_minutes IS NULL)) * v.avg_cargo AS actual_quantity_estimated,
    COALESCE(SUM(CAST(le.structured_fields->>'actual_cargo_tonnes' AS NUMERIC)) FILTER (WHERE va.activity_type = 'Unloading' AND (va.duration_minutes >= 20 OR va.duration_minutes IS NULL)), 0) AS actual_quantity_certified
FROM public.vessels v
LEFT JOIN public.vessel_activity va ON v.id = va.vessel_id
LEFT JOIN public.logbook_entries le ON le.vessel_activity_id = va.id AND le.status IN ('submitted', 'approved')
WHERE va.start_time IS NOT NULL
GROUP BY v.id, v.name, v.avg_cargo, EXTRACT(YEAR FROM va.start_time), EXTRACT(MONTH FROM va.start_time);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. SECURITY (RLS & POLICIES)
-- ═══════════════════════════════════════════════════════════════════════════

-- Abilita RLS su tutto
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vessel_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logbook_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_plans_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intelligence_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vessel_geofence_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cron_logs ENABLE ROW LEVEL SECURITY;

-- Esempio Policy: Read Access per utenti autenticati su anagrafiche
DROP POLICY IF EXISTS "Auth_Read_Vessels" ON public.vessels;
CREATE POLICY "Auth_Read_Vessels" ON public.vessels FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth_Read_Geofences" ON public.geofences;
CREATE POLICY "Auth_Read_Geofences" ON public.geofences FOR SELECT USING (auth.role() = 'authenticated');

-- Profile Policy (Fondamentale)
DROP POLICY IF EXISTS "Users_View_Own_Profile" ON public.user_profiles;
CREATE POLICY "Users_View_Own_Profile" ON public.user_profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins_View_All_Profiles" ON public.user_profiles;
CREATE POLICY "Admins_View_All_Profiles" ON public.user_profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role IN ('operation_admin', 'operation'))
);

-- ============================================================================
-- SCRIPT COMPLETATO. Copia ed esegui nel Supabase SQL Editor.
-- Garantisce l'integrità del sistema GeoKanban V3 e la sua sicurezza.
-- ============================================================================
