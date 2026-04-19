-- =======================================================================
-- AMS BOOTSTRAP (Cloud Supabase -> self-hosted AMS)
-- Generated 2026-04-18 from the Cloud project `gterzsoapepzozgqbljk`.
-- Produces the full `ams_*` schema from scratch (rename of `doa_*`).
-- This file is idempotent on a clean database. It supersedes all the
-- legacy `doa_*.sql` migrations in this folder, which should be moved
-- to `_archive/` in Phase B before running this file.
-- Rename rules applied:
--   doa_<ident>    -> ams_<ident>   (tables, functions, indexes, policies, triggers, constraints)
--   doa-<bucket>   -> ams-<bucket>  (storage.buckets)
-- Unchanged: enum VALUES, column names, domain strings.
-- =======================================================================

-- 1. Extensions -------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";

-- 2. Enums ------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE public.ams_classification AS ENUM ('minor', 'major', 'repair');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE public.ams_doc_status AS ENUM ('vigente', 'obsoleto', 'pendiente', 'na');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE public.ams_project_status AS ENUM ('active', 'review', 'approved', 'paused', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE public.ams_task_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE public.ams_task_status AS ENUM ('todo', 'in_progress', 'blocked', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE public.ams_user_role AS ENUM ('engineer', 'team_lead', 'head_of_design', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Sequences --------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.ams_solicitudes_seq;
CREATE SEQUENCE IF NOT EXISTS public.ams_ofertas_seq;
CREATE SEQUENCE IF NOT EXISTS public.ams_chunks_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.ams_tcds_embeddings_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.ams_part21_embeddings_id_seq;

-- 4. Tables -----------------------------------------------------------------
CREATE TABLE public.ams_aeronaves (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tcds_code text NOT NULL,
    tcds_code_short text NOT NULL,
    tcds_issue text,
    tcds_date text,
    tcds_pdf_url text,
    fabricante text NOT NULL,
    pais text,
    tipo text NOT NULL,
    modelo text NOT NULL,
    msn_elegibles text,
    motor text,
    mtow_kg numeric,
    mlw_kg numeric,
    regulacion_base text,
    categoria text,
    notas text,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT ams_aeronaves_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ams_ai_response_cache (
    key text NOT NULL,
    value text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT ams_ai_response_cache_pkey PRIMARY KEY (key)
);

CREATE TABLE public.ams_app_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    event_name text NOT NULL,
    event_category text NOT NULL,
    event_source text DEFAULT 'server'::text NOT NULL,
    outcome text DEFAULT 'info'::text NOT NULL,
    actor_user_id uuid,
    request_id text,
    session_id text,
    route text,
    method text,
    entity_type text,
    entity_id text,
    entity_code text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    user_agent text,
    ip_address text,
    referrer text,
    severity text DEFAULT 'info'::text NOT NULL,
    CONSTRAINT ams_app_events_event_source_check CHECK ((event_source = ANY (ARRAY['server'::text, 'client'::text]))),
    CONSTRAINT ams_app_events_outcome_check CHECK ((outcome = ANY (ARRAY['attempt'::text, 'success'::text, 'failure'::text, 'info'::text]))),
    CONSTRAINT ams_app_events_pkey PRIMARY KEY (id),
    CONSTRAINT ams_app_events_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warn'::text, 'error'::text, 'critical'::text])))
);

CREATE TABLE public.ams_chunks (
    id bigint DEFAULT nextval('ams_chunks_id_seq'::regclass) NOT NULL,
    content text NOT NULL,
    embedding vector(3072),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    parent_id text,
    proyecto_id uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT ams_chunks_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ams_clientes_datos_generales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    cif_vat text,
    pais text NOT NULL,
    ciudad text,
    direccion text,
    telefono text,
    web text,
    activo boolean DEFAULT true NOT NULL,
    notas text,
    created_at timestamptz DEFAULT now() NOT NULL,
    dominio_email text,
    tipo_cliente text,
    codigo_cliente text,
    CONSTRAINT clientes_pkey PRIMARY KEY (id),
    CONSTRAINT ams_clientes_datos_generales_codigo_cliente_key UNIQUE (codigo_cliente),
    CONSTRAINT ams_clientes_datos_generales_tipo_cliente_check CHECK ((tipo_cliente = ANY (ARRAY['aerolinea'::text, 'mro'::text, 'privado'::text, 'fabricante'::text, 'otro'::text])))
);

CREATE TABLE public.ams_clientes_contactos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    nombre text NOT NULL,
    apellidos text,
    email text NOT NULL,
    telefono text,
    cargo text,
    es_principal boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT contactos_cliente_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ams_consultas_entrantes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    asunto text,
    remitente text,
    cuerpo_original text,
    clasificacion text,
    respuesta_ia text,
    estado text DEFAULT 'nuevo'::text NOT NULL,
    correo_cliente_enviado_at timestamptz,
    correo_cliente_enviado_by uuid,
    ultimo_borrador_cliente text,
    numero_entrada text,
    url_formulario text,
    tcds_number text,
    aircraft_manufacturer text,
    aircraft_model text,
    aircraft_count integer,
    aircraft_msn text,
    tcds_pdf_url text,
    work_type text,
    existing_project_code text,
    modification_summary text,
    operational_goal text,
    has_equipment text,
    equipment_details text,
    has_drawings text,
    has_previous_mod text,
    previous_mod_ref text,
    has_manufacturer_docs text,
    target_date date,
    is_aog text,
    aircraft_location text,
    additional_notes text,
    reply_body text,
    reply_sent_at timestamptz,
    proyectos_referencia text[] DEFAULT '{}'::text[],
    documentos_compliance jsonb DEFAULT '[]'::jsonb,
    doc_g12_01 boolean DEFAULT false NOT NULL,
    doc_g12_02 boolean DEFAULT false NOT NULL,
    doc_g12_03 boolean DEFAULT false NOT NULL,
    doc_g12_04 boolean DEFAULT false NOT NULL,
    doc_g12_05 boolean DEFAULT false NOT NULL,
    doc_g12_06 boolean DEFAULT false NOT NULL,
    doc_g12_07 boolean DEFAULT false NOT NULL,
    doc_g12_08 boolean DEFAULT false NOT NULL,
    doc_g12_09 boolean DEFAULT false NOT NULL,
    doc_g12_10 boolean DEFAULT false NOT NULL,
    doc_g12_11 boolean DEFAULT false NOT NULL,
    doc_g12_12 boolean DEFAULT false NOT NULL,
    doc_g12_14 boolean DEFAULT false NOT NULL,
    doc_g12_15 boolean DEFAULT false NOT NULL,
    doc_g12_16 boolean DEFAULT false NOT NULL,
    doc_g12_17 boolean DEFAULT false NOT NULL,
    doc_g12_18 boolean DEFAULT false NOT NULL,
    doc_g12_19 boolean DEFAULT false NOT NULL,
    doc_g12_20 boolean DEFAULT false NOT NULL,
    doc_g12_21 boolean DEFAULT false NOT NULL,
    doc_g12_22 boolean DEFAULT false NOT NULL,
    doc_g12_23 boolean DEFAULT false NOT NULL,
    doc_g12_24 boolean DEFAULT false NOT NULL,
    doc_g12_25 boolean DEFAULT false NOT NULL,
    doc_g12_26 boolean DEFAULT false NOT NULL,
    doc_g12_28 boolean DEFAULT false NOT NULL,
    doc_g12_29 boolean DEFAULT false NOT NULL,
    doc_g12_30 boolean DEFAULT false NOT NULL,
    doc_g12_31 boolean DEFAULT false NOT NULL,
    doc_g12_32 boolean DEFAULT false NOT NULL,
    doc_g12_36 boolean DEFAULT false NOT NULL,
    doc_g12_37 boolean DEFAULT false NOT NULL,
    doc_g12_38 boolean DEFAULT false NOT NULL,
    doc_g12_39 boolean DEFAULT false NOT NULL,
    doc_g12_40 boolean DEFAULT false NOT NULL,
    doc_g12_41 boolean DEFAULT false NOT NULL,
    doc_g12_42 boolean DEFAULT false NOT NULL,
    doc_g12_43 boolean DEFAULT false NOT NULL,
    doc_g12_44 boolean DEFAULT false NOT NULL,
    doc_g12_45 boolean DEFAULT false NOT NULL,
    doc_g12_46 boolean DEFAULT false NOT NULL,
    doc_g12_60 boolean DEFAULT false NOT NULL,
    doc_g18_02 boolean DEFAULT false NOT NULL,
    doc_g18_03 boolean DEFAULT false NOT NULL,
    impact_location text,
    impact_structural_attachment text,
    impact_structural_interface text,
    impact_electrical text,
    impact_avionics text,
    impact_cabin_layout text,
    impact_pressurized text,
    impact_operational_change text,
    change_classification jsonb,
    estimated_weight_kg text,
    related_to_ad text,
    ad_reference text,
    affects_critical_system text,
    changes_limitations text,
    items_weight_list jsonb DEFAULT '[]'::jsonb,
    fuselage_position text,
    sta_location text,
    affects_primary_structure text,
    CONSTRAINT ams_consultas_entrantes_estado_check CHECK ((estado = ANY (ARRAY['nuevo'::text, 'esperando_formulario'::text, 'formulario_recibido'::text, 'archivado'::text, 'entrada_recibida'::text, 'formulario_enviado'::text, 'definir_alcance'::text, 'esperando_respuesta_cliente'::text, 'alcance_definido'::text, 'oferta_en_revision'::text, 'oferta_enviada'::text, 'oferta_aceptada'::text, 'oferta_rechazada'::text, 'revision_final'::text, 'proyecto_abierto'::text]))),
    CONSTRAINT ams_consultas_entrantes_numero_entrada_key UNIQUE (numero_entrada),
    CONSTRAINT ams_consultas_entrantes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ams_proyectos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero_proyecto text NOT NULL,
    titulo text NOT NULL,
    descripcion text,
    consulta_id uuid,
    cliente_nombre text,
    client_id uuid,
    aeronave text,
    modelo text,
    msn text,
    tcds_code text,
    tcds_code_short text,
    estado text DEFAULT 'op_01_data_collection'::text NOT NULL,
    owner text,
    checker text,
    approval text,
    cve text,
    fecha_inicio date,
    fecha_entrega_estimada date,
    fecha_cierre date,
    ruta_proyecto text,
    prioridad text DEFAULT 'normal'::text,
    anio integer DEFAULT EXTRACT(year FROM now()),
    notas text,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    estado_v2 text,
    fase_actual text,
    estado_updated_at timestamptz DEFAULT now(),
    estado_updated_by uuid,
    CONSTRAINT ams_proyectos_estado_check CHECK ((estado = ANY (ARRAY['nuevo'::text, 'en_progreso'::text, 'revision'::text, 'aprobacion'::text, 'entregado'::text, 'cerrado'::text, 'archivado'::text]))),
    CONSTRAINT ams_proyectos_estado_v2_check CHECK ((estado_v2 = ANY (ARRAY['proyecto_abierto'::text, 'planificacion'::text, 'en_ejecucion'::text, 'revision_interna'::text, 'listo_para_validacion'::text, 'en_validacion'::text, 'validado'::text, 'devuelto_a_ejecucion'::text, 'preparando_entrega'::text, 'entregado'::text, 'confirmacion_cliente'::text, 'cerrado'::text, 'archivado_proyecto'::text]))),
    CONSTRAINT ams_proyectos_fase_actual_check CHECK ((fase_actual = ANY (ARRAY['ejecucion'::text, 'validacion'::text, 'entrega'::text, 'cierre'::text]))),
    CONSTRAINT ams_proyectos_numero_proyecto_key UNIQUE (numero_proyecto),
    CONSTRAINT ams_proyectos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ams_conteo_horas_proyectos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proyecto_id uuid NOT NULL,
    numero_proyecto text NOT NULL,
    inicio timestamptz NOT NULL,
    fin timestamptz,
    duracion_minutos numeric(10,2),
    usuario text,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ams_conteo_horas_proyectos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ams_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consulta_id uuid,
    direccion text NOT NULL,
    de text,
    para text,
    asunto text,
    cuerpo text,
    fecha timestamptz,
    mensaje_id text,
    en_respuesta_a uuid,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT ams_emails_direccion_check CHECK ((direccion = ANY (ARRAY['entrante'::text, 'saliente'::text]))),
    CONSTRAINT ams_emails_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ams_part21_embeddings (
    id bigint DEFAULT nextval('ams_part21_embeddings_id_seq'::regclass) NOT NULL,
    content text NOT NULL,
    embedding vector(3072) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    parent_id text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ams_part21_embeddings_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ams_plantillas_compliance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    subpart_easa text,
    CONSTRAINT ams_plantillas_compliance_category_check CHECK ((category = ANY (ARRAY['classification'::text, 'review'::text, 'approval'::text, 'analysis'::text, 'test'::text, 'manual'::text, 'management'::text]))),
    CONSTRAINT ams_plantillas_compliance_code_key UNIQUE (code),
    CONSTRAINT ams_plantillas_compliance_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ams_project_validations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proyecto_id uuid NOT NULL,
    validator_user_id uuid NOT NULL,
    role text NOT NULL,
    decision text NOT NULL,
    comentarios text,
    observaciones jsonb DEFAULT '[]'::jsonb NOT NULL,
    deliverables_snapshot jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ams_project_validations_decision_check CHECK ((decision = ANY (ARRAY['aprobado'::text, 'devuelto'::text, 'pendiente'::text]))),
    CONSTRAINT ams_project_validations_pkey PRIMARY KEY (id),
    CONSTRAINT ams_project_validations_role_check CHECK ((role = ANY (ARRAY['doh'::text, 'dos'::text, 'reviewer'::text])))
);

CREATE TABLE public.ams_project_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proyecto_id uuid NOT NULL,
    validation_id uuid,
    signer_user_id uuid NOT NULL,
    signer_role text NOT NULL,
    signature_type text NOT NULL,
    payload_hash text NOT NULL,
    hmac_signature text NOT NULL,
    hmac_key_id text DEFAULT 'v1'::text NOT NULL,
    signed_payload jsonb NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ams_project_signatures_pkey PRIMARY KEY (id),
    CONSTRAINT ams_project_signatures_signature_type_check CHECK ((signature_type = ANY (ARRAY['validation_approval'::text, 'validation_return'::text, 'delivery_release'::text, 'closure'::text]))),
    CONSTRAINT ams_project_signatures_signer_role_check CHECK ((signer_role = ANY (ARRAY['doh'::text, 'dos'::text, 'staff'::text, 'manager'::text, 'cvc'::text])))
);

CREATE TABLE public.ams_project_closures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proyecto_id uuid NOT NULL,
    closer_user_id uuid NOT NULL,
    signature_id uuid,
    metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    outcome text NOT NULL,
    notas_cierre text,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ams_project_closures_outcome_check CHECK ((outcome = ANY (ARRAY['exitoso'::text, 'exitoso_con_reservas'::text, 'problematico'::text, 'abortado'::text]))),
    CONSTRAINT ams_project_closures_pkey PRIMARY KEY (id),
    CONSTRAINT ams_project_closures_proyecto_id_key UNIQUE (proyecto_id)
);

CREATE TABLE public.ams_project_deliverables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proyecto_id uuid NOT NULL,
    template_code text,
    subpart_easa text,
    titulo text NOT NULL,
    descripcion text,
    owner_user_id uuid,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    storage_path text,
    version_actual integer DEFAULT 1 NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ams_project_deliverables_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'en_curso'::text, 'en_revision'::text, 'completado'::text, 'bloqueado'::text, 'no_aplica'::text]))),
    CONSTRAINT ams_project_deliverables_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ams_project_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proyecto_id uuid NOT NULL,
    validation_id uuid,
    signature_id uuid,
    sent_by_user_id uuid NOT NULL,
    recipient_email text NOT NULL,
    recipient_name text,
    cc_emails text[],
    subject text NOT NULL,
    body text,
    soc_pdf_storage_path text,
    soc_pdf_sha256 text,
    attachments jsonb DEFAULT '[]'::jsonb,
    n8n_execution_id text,
    dispatch_status text DEFAULT 'pendiente'::text NOT NULL,
    dispatched_at timestamptz,
    client_confirmed_at timestamptz,
    client_confirmation_token text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ams_project_deliveries_client_confirmation_token_key UNIQUE (client_confirmation_token),
    CONSTRAINT ams_project_deliveries_dispatch_status_check CHECK ((dispatch_status = ANY (ARRAY['pendiente'::text, 'enviando'::text, 'enviado'::text, 'fallo'::text, 'confirmado_cliente'::text]))),
    CONSTRAINT ams_project_deliveries_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ams_project_lessons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proyecto_id uuid NOT NULL,
    closure_id uuid,
    author_user_id uuid NOT NULL,
    categoria text NOT NULL,
    tipo text NOT NULL,
    titulo text NOT NULL,
    descripcion text NOT NULL,
    impacto text,
    recomendacion text,
    tags text[],
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ams_project_lessons_categoria_check CHECK ((categoria = ANY (ARRAY['tecnica'::text, 'proceso'::text, 'cliente'::text, 'calidad'::text, 'planificacion'::text, 'herramientas'::text, 'regulatoria'::text, 'otro'::text]))),
    CONSTRAINT ams_project_lessons_pkey PRIMARY KEY (id),
    CONSTRAINT ams_project_lessons_tipo_check CHECK ((tipo = ANY (ARRAY['positiva'::text, 'negativa'::text, 'mejora'::text, 'riesgo'::text])))
);

CREATE TABLE public.ams_proyectos_historico (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero_proyecto text NOT NULL,
    titulo text NOT NULL,
    descripcion text,
    cliente_nombre text,
    estado text,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    client_id uuid,
    anio integer NOT NULL,
    ruta_origen text NOT NULL,
    nombre_carpeta_origen text NOT NULL,
    mdl_contenido jsonb,
    aeronave text,
    msn text,
    summary_md text,
    compliance_docs_md jsonb,
    CONSTRAINT ams_proyectos_historico_numero_proyecto_check CHECK ((length(TRIM(BOTH FROM numero_proyecto)) > 0)),
    CONSTRAINT ams_proyectos_historico_numero_proyecto_key UNIQUE (numero_proyecto),
    CONSTRAINT ams_proyectos_historico_pkey PRIMARY KEY (id),
    CONSTRAINT ams_proyectos_historico_titulo_check CHECK ((length(TRIM(BOTH FROM titulo)) > 0))
);

CREATE TABLE public.ams_proyectos_historico_documentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proyecto_historico_id uuid NOT NULL,
    orden_documental integer,
    familia_documental text NOT NULL,
    carpeta_origen text NOT NULL,
    ruta_origen text NOT NULL,
    archivo_referencia text,
    total_archivos integer DEFAULT 0 NOT NULL,
    formatos_disponibles text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT ams_proyectos_historico_documentos_carpeta_check CHECK ((length(TRIM(BOTH FROM carpeta_origen)) > 0)),
    CONSTRAINT ams_proyectos_historico_documentos_familia_check CHECK ((length(TRIM(BOTH FROM familia_documental)) > 0)),
    CONSTRAINT ams_proyectos_historico_documentos_pkey PRIMARY KEY (id),
    CONSTRAINT ams_proyectos_historico_documentos_ruta_check CHECK ((length(TRIM(BOTH FROM ruta_origen)) > 0)),
    CONSTRAINT ams_proyectos_historico_documentos_total_archivos_check CHECK ((total_archivos >= 0))
);

CREATE TABLE public.ams_proyectos_historico_archivos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    documento_id uuid NOT NULL,
    nombre_archivo text NOT NULL,
    codigo_documento text,
    edicion text,
    formato text NOT NULL,
    es_edicion_vigente boolean DEFAULT true NOT NULL,
    ruta_relativa text,
    contenido_md text,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT ams_proyectos_historico_archivos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ams_quotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consulta_id uuid NOT NULL,
    quotation_number text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    quotation_date date DEFAULT CURRENT_DATE NOT NULL,
    validity_days integer DEFAULT 90 NOT NULL,
    lead_time_days integer,
    engineering_hours numeric(10,2),
    hourly_rate numeric(10,2),
    tax_code text DEFAULT 'IVA 21%'::text,
    subtotal numeric(12,2) DEFAULT 0,
    tax_amount numeric(12,2) DEFAULT 0,
    total numeric(12,2) DEFAULT 0,
    payment_terms text,
    required_docs text,
    assumptions text,
    estado text DEFAULT 'borrador'::text NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT ams_quotations_pkey PRIMARY KEY (id),
    CONSTRAINT ams_quotations_quotation_number_key UNIQUE (quotation_number)
);

CREATE TABLE public.ams_quotation_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    category text DEFAULT 'engineering'::text NOT NULL,
    CONSTRAINT ams_quotation_items_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ams_respuestas_formularios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consulta_id uuid,
    company_name text,
    vat_tax_id text,
    country text,
    city text,
    address text,
    company_phone text,
    website text,
    contact_first_name text,
    contact_last_name text,
    contact_email text,
    contact_phone text,
    position_role text,
    aircraft_manufacturer text,
    aircraft_model text,
    registration text,
    project_type text,
    modification_description text,
    affected_aircraft_count integer,
    number_of_stcs text,
    ata_chapter text,
    applicable_regulation text,
    has_previous_approval boolean,
    reference_document text,
    aircraft_effectivity text,
    aircraft_location text,
    desired_timeline text,
    is_aog boolean DEFAULT false,
    has_drawings boolean DEFAULT false,
    additional_notes text,
    estado text DEFAULT 'recibido'::text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT ams_respuestas_formularios_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ams_tcds_embeddings (
    id bigint DEFAULT nextval('ams_tcds_embeddings_id_seq'::regclass) NOT NULL,
    content text NOT NULL,
    embedding vector(3072) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    parent_id text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ams_tcds_embeddings_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ams_usuarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    apellidos text,
    email text,
    telefono text,
    rol text NOT NULL,
    titulo text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ams_usuarios_email_key UNIQUE (email),
    CONSTRAINT ams_usuarios_pkey PRIMARY KEY (id),
    CONSTRAINT ams_usuarios_rol_check CHECK ((rol = ANY (ARRAY['ingeniero'::text, 'cve'::text, 'approval'::text, 'marketing'::text, 'admin'::text])))
);

CREATE TABLE public.ams_workflow_state_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope text NOT NULL,
    state_code text NOT NULL,
    label text NOT NULL,
    short_label text,
    description text,
    color_token text DEFAULT 'slate'::text NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    is_system boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT ams_workflow_state_config_color_token_check CHECK ((color_token = ANY (ARRAY['sky'::text, 'cyan'::text, 'teal'::text, 'emerald'::text, 'amber'::text, 'violet'::text, 'indigo'::text, 'slate'::text, 'blue'::text, 'green'::text, 'yellow'::text, 'rose'::text]))),
    CONSTRAINT ams_workflow_state_config_pkey PRIMARY KEY (id),
    CONSTRAINT ams_workflow_state_config_scope_check CHECK ((scope = ANY (ARRAY['incoming_queries'::text, 'quotation_board'::text, 'project_board'::text, 'project_execution'::text]))),
    CONSTRAINT ams_workflow_state_config_scope_state_code_key UNIQUE (scope,state_code)
);

-- Helper functions (moved from section 7 to precede GIN indexes)
CREATE OR REPLACE FUNCTION public.ams_part21_search_vector(content text, metadata jsonb)
 RETURNS tsvector
 LANGUAGE sql
 IMMUTABLE
AS $function$
    SELECT to_tsvector(
        'simple',
        concat_ws(
            ' ',
            COALESCE(content, ''),
            COALESCE(metadata->>'search_text', ''),
            COALESCE(metadata->>'section', ''),
            COALESCE(metadata->>'section_title', ''),
            COALESCE(metadata->>'document_code', ''),
            COALESCE(metadata->>'document_title', ''),
            COALESCE(metadata->>'category', ''),
            COALESCE(metadata->>'classification', ''),
            COALESCE(metadata->>'content_type', '')
        )
    );
$function$;

CREATE OR REPLACE FUNCTION public.ams_tcds_search_vector(content text, metadata jsonb)
 RETURNS tsvector
 LANGUAGE sql
 IMMUTABLE
AS $function$
    SELECT to_tsvector(
        'simple',
        concat_ws(
            ' ',
            COALESCE(content, ''),
            COALESCE(metadata->>'search_text', ''),
            COALESCE(metadata->>'section_id', ''),
            COALESCE(metadata->>'normalized_section_id', ''),
            COALESCE(metadata->>'official_code', ''),
            COALESCE(metadata->>'document_title', ''),
            COALESCE(metadata->>'title', ''),
            COALESCE(metadata->>'agency', ''),
            COALESCE(metadata->>'doc_type', '')
        )
    );
$function$;

-- 5. Indexes (non-constraint) -----------------------------------------------
CREATE INDEX idx_aeronaves_fabricante ON public.ams_aeronaves USING btree (fabricante);
CREATE INDEX idx_aeronaves_tcds_code ON public.ams_aeronaves USING btree (tcds_code);
CREATE INDEX idx_aeronaves_tcds_short ON public.ams_aeronaves USING btree (tcds_code_short);
CREATE INDEX idx_aeronaves_tipo ON public.ams_aeronaves USING btree (tipo);
CREATE INDEX idx_ams_ai_response_cache_expires_at ON public.ams_ai_response_cache USING btree (expires_at);
CREATE INDEX ams_app_events_actor_created_at_idx ON public.ams_app_events USING btree (actor_user_id, created_at DESC);
CREATE INDEX ams_app_events_created_at_idx ON public.ams_app_events USING btree (created_at DESC);
CREATE INDEX ams_app_events_entity_created_at_idx ON public.ams_app_events USING btree (entity_type, entity_id, created_at DESC);
CREATE INDEX ams_app_events_event_name_created_at_idx ON public.ams_app_events USING btree (event_name, created_at DESC);
CREATE INDEX ams_app_events_metadata_gin_idx ON public.ams_app_events USING gin (metadata jsonb_path_ops);
CREATE INDEX ams_app_events_request_id_idx ON public.ams_app_events USING btree (request_id) WHERE (request_id IS NOT NULL);
CREATE INDEX idx_ams_app_events_severity ON public.ams_app_events USING btree (severity);
CREATE INDEX idx_ams_chunks_created ON public.ams_chunks USING btree (created_at DESC);
CREATE INDEX idx_ams_chunks_embedding ON public.ams_chunks USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
CREATE INDEX idx_ams_chunks_fts ON public.ams_chunks USING gin (to_tsvector('spanish'::regconfig, ((((((((COALESCE(content, ''::text) || ' '::text) || COALESCE((metadata ->> 'search_text'::text), ''::text)) || ' '::text) || COALESCE((metadata ->> 'proyecto_ref'::text), ''::text)) || ' '::text) || COALESCE((metadata ->> 'aeronave'::text), ''::text)) || ' '::text) || COALESCE((metadata ->> 'tipo_modificacion'::text), ''::text))));
CREATE INDEX idx_ams_chunks_meta_aeronave ON public.ams_chunks USING btree (((metadata ->> 'aeronave'::text)));
CREATE INDEX idx_ams_chunks_meta_chunk_id ON public.ams_chunks USING btree (((metadata ->> 'chunk_id'::text)));
CREATE INDEX idx_ams_chunks_meta_proyecto_id ON public.ams_chunks USING btree (((metadata ->> 'proyecto_id'::text)));
CREATE INDEX idx_ams_chunks_meta_tipo ON public.ams_chunks USING btree (((metadata ->> 'tipo_modificacion'::text)));
CREATE INDEX idx_ams_chunks_proyecto_id ON public.ams_chunks USING btree (proyecto_id);
CREATE INDEX idx_ams_clientes_contactos_cliente_id ON public.ams_clientes_contactos USING btree (cliente_id);
CREATE INDEX idx_ams_clientes_contactos_email ON public.ams_clientes_contactos USING btree (email);
CREATE INDEX ams_consultas_entrantes_estado_idx ON public.ams_consultas_entrantes USING btree (estado);
CREATE INDEX idx_ams_consultas_entrantes_created_at ON public.ams_consultas_entrantes USING btree (created_at DESC);
CREATE INDEX idx_conteo_horas_inicio ON public.ams_conteo_horas_proyectos USING btree (inicio);
CREATE INDEX idx_conteo_horas_proyecto ON public.ams_conteo_horas_proyectos USING btree (proyecto_id);
CREATE INDEX idx_ams_emails_consulta ON public.ams_emails USING btree (consulta_id);
CREATE INDEX idx_ams_emails_fecha ON public.ams_emails USING btree (consulta_id, fecha);
CREATE UNIQUE INDEX idx_ams_emails_mensaje_id ON public.ams_emails USING btree (mensaje_id) WHERE (mensaje_id IS NOT NULL);
CREATE INDEX idx_ams_part21_created_at ON public.ams_part21_embeddings USING btree (created_at DESC);
CREATE INDEX idx_ams_part21_metadata_category ON public.ams_part21_embeddings USING btree (((metadata ->> 'category'::text)));
CREATE INDEX idx_ams_part21_metadata_chapter ON public.ams_part21_embeddings USING btree (((metadata ->> 'chapter'::text)));
CREATE INDEX idx_ams_part21_metadata_chunk_id ON public.ams_part21_embeddings USING btree (((metadata ->> 'chunk_id'::text)));
CREATE INDEX idx_ams_part21_metadata_classification ON public.ams_part21_embeddings USING btree (((metadata ->> 'classification'::text)));
CREATE INDEX idx_ams_part21_metadata_content_type ON public.ams_part21_embeddings USING btree (((metadata ->> 'content_type'::text)));
CREATE INDEX idx_ams_part21_metadata_document_code ON public.ams_part21_embeddings USING btree (((metadata ->> 'document_code'::text)));
CREATE INDEX idx_ams_part21_metadata_section ON public.ams_part21_embeddings USING btree (((metadata ->> 'section'::text)));
CREATE INDEX idx_ams_part21_parent_id ON public.ams_part21_embeddings USING btree (parent_id);
CREATE INDEX idx_ams_part21_search_text ON public.ams_part21_embeddings USING gin (ams_part21_search_vector(content, metadata));
CREATE INDEX IF NOT EXISTS idx_ams_part21_embeddings_embedding ON public.ams_part21_embeddings USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
CREATE INDEX idx_plantillas_compliance_category ON public.ams_plantillas_compliance USING btree (category, sort_order);
CREATE INDEX idx_ams_project_closures_closer ON public.ams_project_closures USING btree (closer_user_id);
CREATE INDEX idx_ams_project_closures_created ON public.ams_project_closures USING btree (created_at DESC);
CREATE INDEX idx_ams_project_closures_proyecto ON public.ams_project_closures USING btree (proyecto_id);
CREATE INDEX idx_ams_project_deliverables_estado ON public.ams_project_deliverables USING btree (proyecto_id, estado);
CREATE INDEX idx_ams_project_deliverables_owner ON public.ams_project_deliverables USING btree (owner_user_id);
CREATE INDEX idx_ams_project_deliverables_proyecto ON public.ams_project_deliverables USING btree (proyecto_id);
CREATE INDEX idx_ams_project_deliveries_dispatch_status ON public.ams_project_deliveries USING btree (dispatch_status);
CREATE INDEX idx_ams_project_deliveries_proyecto ON public.ams_project_deliveries USING btree (proyecto_id);
CREATE INDEX idx_ams_project_deliveries_proyecto_created ON public.ams_project_deliveries USING btree (proyecto_id, created_at DESC);
CREATE INDEX idx_ams_project_lessons_cat_tipo ON public.ams_project_lessons USING btree (categoria, tipo);
CREATE INDEX idx_ams_project_lessons_closure ON public.ams_project_lessons USING btree (closure_id);
CREATE INDEX idx_ams_project_lessons_proyecto ON public.ams_project_lessons USING btree (proyecto_id);
CREATE INDEX idx_ams_project_lessons_tags ON public.ams_project_lessons USING gin (tags);
CREATE INDEX idx_ams_project_signatures_proyecto ON public.ams_project_signatures USING btree (proyecto_id);
CREATE INDEX idx_ams_project_signatures_proyecto_created ON public.ams_project_signatures USING btree (proyecto_id, created_at DESC);
CREATE INDEX idx_ams_project_signatures_signer ON public.ams_project_signatures USING btree (signer_user_id);
CREATE INDEX idx_ams_project_signatures_validation ON public.ams_project_signatures USING btree (validation_id);
CREATE INDEX idx_ams_project_validations_proyecto ON public.ams_project_validations USING btree (proyecto_id);
CREATE INDEX idx_ams_project_validations_proyecto_created ON public.ams_project_validations USING btree (proyecto_id, created_at DESC);
CREATE INDEX idx_ams_project_validations_validator ON public.ams_project_validations USING btree (validator_user_id);
CREATE INDEX idx_ams_proy_estado ON public.ams_proyectos USING btree (estado);
CREATE INDEX idx_ams_proy_numero ON public.ams_proyectos USING btree (numero_proyecto);
CREATE INDEX idx_ams_proy_tcds ON public.ams_proyectos USING btree (tcds_code_short);
CREATE INDEX idx_ams_proyectos_estado_v2 ON public.ams_proyectos USING btree (estado_v2);
CREATE INDEX idx_ams_proyectos_fase_actual ON public.ams_proyectos USING btree (fase_actual);
CREATE INDEX ams_proyectos_historico_aeronave_idx ON public.ams_proyectos_historico USING btree (aeronave);
CREATE INDEX ams_proyectos_historico_anio_idx ON public.ams_proyectos_historico USING btree (anio);
CREATE INDEX ams_proyectos_historico_client_id_idx ON public.ams_proyectos_historico USING btree (client_id);
CREATE INDEX ams_proyectos_historico_cliente_nombre_idx ON public.ams_proyectos_historico USING btree (cliente_nombre);
CREATE INDEX ams_proyectos_historico_created_at_idx ON public.ams_proyectos_historico USING btree (created_at DESC);
CREATE INDEX ams_proyectos_historico_msn_idx ON public.ams_proyectos_historico USING btree (msn);
CREATE INDEX idx_historico_archivos_documento_id ON public.ams_proyectos_historico_archivos USING btree (documento_id);
CREATE INDEX idx_historico_archivos_vigente ON public.ams_proyectos_historico_archivos USING btree (es_edicion_vigente) WHERE (es_edicion_vigente = true);
CREATE INDEX ams_proyectos_historico_documentos_order_idx ON public.ams_proyectos_historico_documentos USING btree (orden_documental, familia_documental);
CREATE UNIQUE INDEX ams_proyectos_historico_documentos_project_folder_uidx ON public.ams_proyectos_historico_documentos USING btree (proyecto_historico_id, carpeta_origen);
CREATE INDEX ams_proyectos_historico_documentos_project_idx ON public.ams_proyectos_historico_documentos USING btree (proyecto_historico_id);
CREATE INDEX idx_ams_quotation_items_quotation ON public.ams_quotation_items USING btree (quotation_id);
CREATE INDEX idx_ams_quotations_consulta ON public.ams_quotations USING btree (consulta_id);
CREATE INDEX idx_respuestas_consulta_id ON public.ams_respuestas_formularios USING btree (consulta_id);
CREATE INDEX idx_respuestas_email ON public.ams_respuestas_formularios USING btree (contact_email);
CREATE INDEX idx_ams_tcds_embeddings_created_at ON public.ams_tcds_embeddings USING btree (created_at DESC);
CREATE INDEX idx_ams_tcds_embeddings_metadata_agency ON public.ams_tcds_embeddings USING btree (((metadata ->> 'agency'::text)));
CREATE INDEX idx_ams_tcds_embeddings_metadata_chunk_id ON public.ams_tcds_embeddings USING btree (((metadata ->> 'chunk_id'::text)));
CREATE INDEX idx_ams_tcds_embeddings_metadata_doc_type ON public.ams_tcds_embeddings USING btree (((metadata ->> 'doc_type'::text)));
CREATE INDEX idx_ams_tcds_embeddings_metadata_normalized_section_id ON public.ams_tcds_embeddings USING btree (((metadata ->> 'normalized_section_id'::text)));
CREATE INDEX idx_ams_tcds_embeddings_metadata_official_code ON public.ams_tcds_embeddings USING btree (((metadata ->> 'official_code'::text)));
CREATE INDEX idx_ams_tcds_embeddings_metadata_section_id ON public.ams_tcds_embeddings USING btree (((metadata ->> 'section_id'::text)));
CREATE INDEX idx_ams_tcds_embeddings_parent_id ON public.ams_tcds_embeddings USING btree (parent_id);
CREATE INDEX idx_ams_tcds_embeddings_search_text ON public.ams_tcds_embeddings USING gin (ams_tcds_search_vector(content, metadata));
CREATE INDEX IF NOT EXISTS idx_ams_tcds_embeddings_embedding ON public.ams_tcds_embeddings USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
CREATE INDEX idx_ams_workflow_state_config_scope ON public.ams_workflow_state_config USING btree (scope);
CREATE INDEX idx_ams_workflow_state_config_scope_active ON public.ams_workflow_state_config USING btree (scope, is_active);
CREATE INDEX idx_ams_workflow_state_config_scope_order ON public.ams_workflow_state_config USING btree (scope, sort_order);

-- 6. Foreign keys -----------------------------------------------------------
ALTER TABLE public.ams_clientes_contactos ADD CONSTRAINT contactos_cliente_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.ams_clientes_datos_generales (id) ON DELETE CASCADE;
ALTER TABLE public.ams_conteo_horas_proyectos ADD CONSTRAINT ams_conteo_horas_proyectos_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES public.ams_proyectos (id) ON DELETE CASCADE;
ALTER TABLE public.ams_emails ADD CONSTRAINT ams_emails_consulta_id_fkey FOREIGN KEY (consulta_id) REFERENCES public.ams_consultas_entrantes (id) ON DELETE CASCADE;
ALTER TABLE public.ams_emails ADD CONSTRAINT ams_emails_en_respuesta_a_fkey FOREIGN KEY (en_respuesta_a) REFERENCES public.ams_emails (id);
ALTER TABLE public.ams_project_closures ADD CONSTRAINT ams_project_closures_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES public.ams_proyectos (id) ON DELETE CASCADE;
ALTER TABLE public.ams_project_closures ADD CONSTRAINT ams_project_closures_signature_id_fkey FOREIGN KEY (signature_id) REFERENCES public.ams_project_signatures (id);
ALTER TABLE public.ams_project_deliverables ADD CONSTRAINT ams_project_deliverables_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES public.ams_proyectos (id) ON DELETE CASCADE;
ALTER TABLE public.ams_project_deliveries ADD CONSTRAINT ams_project_deliveries_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES public.ams_proyectos (id) ON DELETE CASCADE;
ALTER TABLE public.ams_project_deliveries ADD CONSTRAINT ams_project_deliveries_signature_id_fkey FOREIGN KEY (signature_id) REFERENCES public.ams_project_signatures (id);
ALTER TABLE public.ams_project_deliveries ADD CONSTRAINT ams_project_deliveries_validation_id_fkey FOREIGN KEY (validation_id) REFERENCES public.ams_project_validations (id);
ALTER TABLE public.ams_project_lessons ADD CONSTRAINT ams_project_lessons_closure_id_fkey FOREIGN KEY (closure_id) REFERENCES public.ams_project_closures (id) ON DELETE SET NULL;
ALTER TABLE public.ams_project_lessons ADD CONSTRAINT ams_project_lessons_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES public.ams_proyectos (id) ON DELETE CASCADE;
ALTER TABLE public.ams_project_signatures ADD CONSTRAINT ams_project_signatures_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES public.ams_proyectos (id) ON DELETE CASCADE;
ALTER TABLE public.ams_project_signatures ADD CONSTRAINT ams_project_signatures_validation_id_fkey FOREIGN KEY (validation_id) REFERENCES public.ams_project_validations (id);
ALTER TABLE public.ams_project_validations ADD CONSTRAINT ams_project_validations_proyecto_id_fkey FOREIGN KEY (proyecto_id) REFERENCES public.ams_proyectos (id) ON DELETE CASCADE;
ALTER TABLE public.ams_proyectos ADD CONSTRAINT ams_proyectos_consulta_id_fkey FOREIGN KEY (consulta_id) REFERENCES public.ams_consultas_entrantes (id);
ALTER TABLE public.ams_proyectos_historico ADD CONSTRAINT ams_proyectos_historico_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.ams_clientes_datos_generales (id) ON DELETE SET NULL;
ALTER TABLE public.ams_proyectos_historico_archivos ADD CONSTRAINT ams_proyectos_historico_archivos_documento_id_fkey FOREIGN KEY (documento_id) REFERENCES public.ams_proyectos_historico_documentos (id) ON DELETE CASCADE;
ALTER TABLE public.ams_proyectos_historico_documentos ADD CONSTRAINT ams_proyectos_historico_documentos_proyecto_historico_id_fkey FOREIGN KEY (proyecto_historico_id) REFERENCES public.ams_proyectos_historico (id) ON DELETE CASCADE;
ALTER TABLE public.ams_quotation_items ADD CONSTRAINT ams_quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.ams_quotations (id) ON DELETE CASCADE;
ALTER TABLE public.ams_quotations ADD CONSTRAINT ams_quotations_consulta_id_fkey FOREIGN KEY (consulta_id) REFERENCES public.ams_consultas_entrantes (id) ON DELETE CASCADE;
ALTER TABLE public.ams_respuestas_formularios ADD CONSTRAINT ams_respuestas_formularios_consulta_id_fkey FOREIGN KEY (consulta_id) REFERENCES public.ams_consultas_entrantes (id) ON DELETE CASCADE;

-- 7. Functions --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_generate_numero_entrada()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  current_prefix TEXT;
  max_num INTEGER;
  next_num INTEGER;
BEGIN
  IF NEW.numero_entrada IS NULL OR NEW.numero_entrada = '' THEN
    -- Advisory lock prevents concurrent inserts from generating same number
    PERFORM pg_advisory_xact_lock(hashtext('numero_entrada_gen'));

    current_prefix := 'QRY-' || EXTRACT(YEAR FROM NOW())::TEXT || '-';

    SELECT COALESCE(MAX(
      CAST(REPLACE(numero_entrada, current_prefix, '') AS INTEGER)
    ), 0)
    INTO max_num
    FROM ams_consultas_entrantes
    WHERE numero_entrada LIKE current_prefix || '%';

    next_num := max_num + 1;
    NEW.numero_entrada := current_prefix || LPAD(next_num::TEXT, 4, '0');
  END IF;

  RETURN NEW;
END;
$function$;

-- Moved earlier (before GIN indexes): ams_part21_search_vector

CREATE OR REPLACE FUNCTION public.ams_proyectos_historico_documentos_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$function$;

-- Moved earlier (before GIN indexes): ams_tcds_search_vector

CREATE OR REPLACE FUNCTION public.set_ams_project_deliverables_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_ams_project_deliveries_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_ams_project_lessons_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_quotation_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  current_year text;
  next_seq integer;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;

  SELECT COALESCE(
    MAX(
      CAST(SPLIT_PART(quotation_number, '-', 3) AS integer)
    ), 0
  ) + 1
  INTO next_seq
  FROM ams_quotations
  WHERE quotation_number LIKE 'Q-' || current_year || '-%';

  RETURN 'Q-' || current_year || '-' || LPAD(next_seq::text, 6, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_set_quotation_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.quotation_number IS NULL OR NEW.quotation_number = '' THEN
    NEW.quotation_number := generate_quotation_number();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_ams_chunks_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_ams_part21_embeddings_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_ams_tcds_embeddings_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- 8. Triggers ---------------------------------------------------------------
CREATE TRIGGER trg_ams_chunks_updated_at BEFORE UPDATE ON public.ams_chunks FOR EACH ROW EXECUTE FUNCTION update_ams_chunks_updated_at();
CREATE TRIGGER trg_auto_numero_entrada BEFORE INSERT ON public.ams_consultas_entrantes FOR EACH ROW EXECUTE FUNCTION auto_generate_numero_entrada();
CREATE TRIGGER update_ams_part21_embeddings_updated_at BEFORE UPDATE ON public.ams_part21_embeddings FOR EACH ROW EXECUTE FUNCTION update_ams_part21_embeddings_updated_at_column();
CREATE TRIGGER trg_ams_project_deliverables_updated_at BEFORE UPDATE ON public.ams_project_deliverables FOR EACH ROW EXECUTE FUNCTION set_ams_project_deliverables_updated_at();
CREATE TRIGGER trg_ams_project_deliveries_updated_at BEFORE UPDATE ON public.ams_project_deliveries FOR EACH ROW EXECUTE FUNCTION set_ams_project_deliveries_updated_at();
CREATE TRIGGER trg_ams_project_lessons_updated_at BEFORE UPDATE ON public.ams_project_lessons FOR EACH ROW EXECUTE FUNCTION set_ams_project_lessons_updated_at();
CREATE TRIGGER update_ams_proyectos_updated_at BEFORE UPDATE ON public.ams_proyectos FOR EACH ROW EXECUTE FUNCTION update_ams_tcds_embeddings_updated_at_column();
CREATE TRIGGER ams_proyectos_historico_documentos_set_updated_at BEFORE UPDATE ON public.ams_proyectos_historico_documentos FOR EACH ROW EXECUTE FUNCTION ams_proyectos_historico_documentos_set_updated_at();
CREATE TRIGGER trg_quotations_updated_at BEFORE UPDATE ON public.ams_quotations FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER trg_quotation_number_before_insert BEFORE INSERT ON public.ams_quotations FOR EACH ROW EXECUTE FUNCTION trg_set_quotation_number();
CREATE TRIGGER update_ams_tcds_embeddings_updated_at BEFORE UPDATE ON public.ams_tcds_embeddings FOR EACH ROW EXECUTE FUNCTION update_ams_tcds_embeddings_updated_at_column();
CREATE TRIGGER trg_ams_workflow_state_config_updated_at BEFORE UPDATE ON public.ams_workflow_state_config FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 9. Row Level Security -----------------------------------------------------
ALTER TABLE public.ams_ai_response_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ams_app_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ams_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ams_conteo_horas_proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ams_project_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ams_project_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ams_project_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ams_project_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ams_project_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ams_project_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ams_proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ams_respuestas_formularios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ams_tcds_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_ams_chunks" ON public.ams_chunks
    FOR ALL
    TO public
    USING (true);
CREATE POLICY "Allow all for authenticated and anon" ON public.ams_conteo_horas_proyectos
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);
CREATE POLICY "ams_project_closures_select" ON public.ams_project_closures
    FOR SELECT
    TO public
    USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "ams_project_closures_service_all" ON public.ams_project_closures
    FOR ALL
    TO public
    USING ((auth.role() = 'service_role'::text));
CREATE POLICY "ams_project_deliverables_select" ON public.ams_project_deliverables
    FOR SELECT
    TO public
    USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "ams_project_deliverables_service_all" ON public.ams_project_deliverables
    FOR ALL
    TO public
    USING ((auth.role() = 'service_role'::text));
CREATE POLICY "ams_project_deliveries_select" ON public.ams_project_deliveries
    FOR SELECT
    TO public
    USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "ams_project_deliveries_service_all" ON public.ams_project_deliveries
    FOR ALL
    TO public
    USING ((auth.role() = 'service_role'::text));
CREATE POLICY "ams_project_lessons_select" ON public.ams_project_lessons
    FOR SELECT
    TO public
    USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "ams_project_lessons_service_all" ON public.ams_project_lessons
    FOR ALL
    TO public
    USING ((auth.role() = 'service_role'::text));
CREATE POLICY "ams_project_signatures_select" ON public.ams_project_signatures
    FOR SELECT
    TO public
    USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "ams_project_signatures_service_all" ON public.ams_project_signatures
    FOR ALL
    TO public
    USING ((auth.role() = 'service_role'::text));
CREATE POLICY "ams_project_validations_select" ON public.ams_project_validations
    FOR SELECT
    TO public
    USING ((auth.role() = 'authenticated'::text));
CREATE POLICY "ams_project_validations_service_all" ON public.ams_project_validations
    FOR ALL
    TO public
    USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Allow public read" ON public.ams_proyectos
    FOR SELECT
    TO public
    USING (true);
CREATE POLICY "Allow service role full access" ON public.ams_proyectos
    FOR ALL
    TO public
    USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Allow all for service role" ON public.ams_respuestas_formularios
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);
CREATE POLICY "Allow public read access on ams_tcds_embeddings" ON public.ams_tcds_embeddings
    FOR SELECT
    TO public
    USING (true);
CREATE POLICY "Allow service role full access on ams_tcds_embeddings" ON public.ams_tcds_embeddings
    FOR ALL
    TO public
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

-- 10. Materialized views ----------------------------------------------------
CREATE MATERIALIZED VIEW public.ams_project_metrics_mv AS
WITH del_agg AS (
         SELECT d.proyecto_id,
            count(*) FILTER (WHERE true) AS deliverables_total,
            count(*) FILTER (WHERE (d.estado = 'completado'::text)) AS deliverables_completado,
            count(*) FILTER (WHERE (d.estado = 'no_aplica'::text)) AS deliverables_no_aplica,
            count(*) FILTER (WHERE (d.estado = 'bloqueado'::text)) AS deliverables_bloqueado
           FROM ams_project_deliverables d
          GROUP BY d.proyecto_id
        ), val_agg AS (
         SELECT v.proyecto_id,
            count(*) AS validaciones_total,
            count(*) FILTER (WHERE (v.decision = 'aprobado'::text)) AS validaciones_aprobadas,
            count(*) FILTER (WHERE (v.decision = 'devuelto'::text)) AS validaciones_devueltas
           FROM ams_project_validations v
          GROUP BY v.proyecto_id
        ), ent_agg AS (
         SELECT e.proyecto_id,
            count(*) AS entregas_total,
            count(*) FILTER (WHERE (e.dispatch_status = ANY (ARRAY['enviado'::text, 'confirmado_cliente'::text]))) AS entregas_enviadas,
            count(*) FILTER (WHERE (e.dispatch_status = 'confirmado_cliente'::text)) AS entregas_confirmadas
           FROM ams_project_deliveries e
          GROUP BY e.proyecto_id
        ), less_agg AS (
         SELECT l.proyecto_id,
            count(*) AS lecciones_count
           FROM ams_project_lessons l
          GROUP BY l.proyecto_id
        )
 SELECT p.id AS proyecto_id,
    p.titulo,
    p.client_id AS cliente_id,
    p.estado_v2,
    p.fase_actual,
    p.created_at,
    p.estado_updated_at,
    COALESCE(da.deliverables_total, (0)::bigint) AS deliverables_total,
    COALESCE(da.deliverables_completado, (0)::bigint) AS deliverables_completado,
    COALESCE(da.deliverables_no_aplica, (0)::bigint) AS deliverables_no_aplica,
    COALESCE(da.deliverables_bloqueado, (0)::bigint) AS deliverables_bloqueado,
    COALESCE(va.validaciones_total, (0)::bigint) AS validaciones_total,
    COALESCE(va.validaciones_aprobadas, (0)::bigint) AS validaciones_aprobadas,
    COALESCE(va.validaciones_devueltas, (0)::bigint) AS validaciones_devueltas,
    COALESCE(ea.entregas_total, (0)::bigint) AS entregas_total,
    COALESCE(ea.entregas_enviadas, (0)::bigint) AS entregas_enviadas,
    COALESCE(ea.entregas_confirmadas, (0)::bigint) AS entregas_confirmadas,
    NULL::numeric AS horas_plan,
    NULL::numeric AS horas_real,
    (EXTRACT(epoch FROM (COALESCE(p.estado_updated_at, now()) - p.created_at)) / 86400.0) AS dias_en_ejecucion,
    NULL::numeric AS dias_en_validacion,
    NULL::numeric AS dias_en_entrega,
        CASE
            WHEN (p.estado_v2 = ANY (ARRAY['cerrado'::text, 'archivado_proyecto'::text])) THEN (EXTRACT(epoch FROM (COALESCE(p.estado_updated_at, now()) - p.created_at)) / 86400.0)
            ELSE (EXTRACT(epoch FROM (now() - p.created_at)) / 86400.0)
        END AS dias_totales_cerrado_vs_abierto,
    c.outcome AS closure_outcome,
    COALESCE(la.lecciones_count, (0)::bigint) AS lecciones_count
   FROM (((((ams_proyectos p
     LEFT JOIN del_agg da ON ((da.proyecto_id = p.id)))
     LEFT JOIN val_agg va ON ((va.proyecto_id = p.id)))
     LEFT JOIN ent_agg ea ON ((ea.proyecto_id = p.id)))
     LEFT JOIN less_agg la ON ((la.proyecto_id = p.id)))
     LEFT JOIN ams_project_closures c ON ((c.proyecto_id = p.id)));

CREATE INDEX idx_ams_project_metrics_mv_estado ON public.ams_project_metrics_mv USING btree (estado_v2);
CREATE INDEX idx_ams_project_metrics_mv_fase ON public.ams_project_metrics_mv USING btree (fase_actual);
CREATE UNIQUE INDEX idx_ams_project_metrics_mv_proyecto ON public.ams_project_metrics_mv USING btree (proyecto_id);

-- 11. Grants ----------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- 12. Storage buckets -------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('ams-formularios', 'ams-formularios', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('ams-tcds-storage', 'ams-tcds-storage', true) ON CONFLICT (id) DO NOTHING;

-- END OF BOOTSTRAP ---------------------------------------------------------
