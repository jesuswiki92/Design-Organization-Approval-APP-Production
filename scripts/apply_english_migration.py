#!/usr/bin/env python3
"""Apply a deterministic surgical English migration to the DOA app.

The script is intentionally explicit: every DB table/column/status/route rename
is listed in a controlled map. It also generates an idempotent SQL migration
that can be applied to Supabase separately from the code commit.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

TEXT_SUFFIXES = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".json", ".md", ".mdx", ".sql", ".css", ".html", ".txt",
}
SKIP_DIRS = {
    ".git", ".next", "node_modules", ".npm-cache", ".turbo", "dist", "build",
    ".vercel", "coverage", ".cache", "__pycache__", "rag-backend",
}
SCAN_DIRS = [
    "app", "components", "lib", "types", "store", "docs", "Formularios",
    "01. Soporte_App", "scripts", "tools", "openspec",
]
# Migrations are historical; do not rewrite old files. Generate a new migration instead.
SKIP_REL_PREFIXES = ["supabase/migrations/"]
MAX_TEXT_BYTES = 2_000_000
SKIP_FILES = {"package-lock.json", "tsconfig.tsbuildinfo"}

TABLE_RENAMES = {
    "doa_clientes_datos_generales": "doa_clients",
    "doa_clientes_contactos": "doa_client_contacts",
    "doa_consultas_entrantes": "doa_incoming_requests",
    "doa_respuestas_formularios": "doa_form_responses",
    "doa_consultas_form_links": "doa_request_form_links",
    "doa_consultas_form_responses": "doa_request_form_responses",
    "doa_proyectos": "doa_projects",
    "doa_proyectos_generales": "doa_general_projects",
    "doa_proyectos_historico": "doa_historical_projects",
    "doa_proyectos_historico_documentos": "doa_historical_project_documents",
    "doa_proyectos_embeddings": "doa_project_embeddings",
    "doa_proyectos_estado_historial": "doa_project_status_history",
    "doa_ofertas_estado_historial": "doa_quote_status_history",
    "doa_conteo_horas_proyectos": "doa_project_time_entries",
    "doa_aeronaves": "doa_aircraft",
    "doa_aeronaves_modelos": "doa_aircraft_models",
    "doa_plantillas_compliance": "doa_compliance_templates",
    "doa_project_metrics_mv": "doa_project_metrics_mv",
}

COLUMN_RENAMES: dict[str, dict[str, str]] = {
    "doa_clients": {
        "nombre": "name",
        "cif_vat": "vat_tax_id",
        "pais": "country",
        "ciudad": "city",
        "direccion": "address",
        "telefono": "phone",
            "activo": "is_active",
        "notas": "notes",
        "dominio_email": "email_domain",
        "tipo_cliente": "client_type",
    },
    "doa_client_contacts": {
        "cliente_id": "client_id",
        "nombre": "name",
        "apellidos": "last_name",
        "telefono": "phone",
        "cargo": "job_title",
        "es_principal": "is_primary",
        "activo": "is_active",
    },
    "doa_aircraft": {
        "fabricante": "manufacturer",
        "pais": "country",
        "tipo": "type",
        "modelo": "model",
        "motor": "engine",
        "regulacion_base": "base_regulation",
        "categoria": "category",
        "msn_elegibles": "eligible_msns",
        "notas": "notes",
    },
    "doa_aircraft_models": {
        "fabricante": "manufacturer",
        "familia": "family",
        "modelo": "model",
        "activo": "is_active",
    },
    "doa_incoming_requests": {
        "asunto": "subject",
    "cuerpo": "body",
        "remitente": "sender",
        "cuerpo_original": "original_body",
        "clasificacion": "classification",
        "respuesta_ia": "ai_response",
        "estado": "status",
        "numero_entrada": "entry_number",
        "url_formulario": "form_url",
        "correo_cliente_enviado_at": "client_email_sent_at",
        "correo_cliente_enviado_by": "client_email_sent_by",
        "ultimo_borrador_cliente": "last_client_draft",
    },
    "doa_form_responses": {
        "consulta_id": "incoming_request_id",
        "respuestas": "answers",
    },
    "doa_request_form_links": {
        "consulta_id": "incoming_request_id",
    },
    "doa_request_form_responses": {
        "consulta_id": "incoming_request_id",
        "referencia_interna_proyecto": "internal_project_reference",
    },
    "doa_projects": {
        "numero_proyecto": "project_number",
        "titulo": "title",
        "descripcion": "description",
        "consulta_id": "incoming_request_id",
        "cliente_nombre": "client_name",
        "aeronave": "aircraft",
        "modelo": "model",
        "estado": "status",
        "estado_v2": "execution_status",
        "fase_actual": "current_phase",
        "estado_updated_at": "status_updated_at",
        "estado_updated_by": "status_updated_by",
        "fecha_inicio": "start_date",
        "fecha_entrega_estimada": "estimated_delivery_date",
        "fecha_cierre": "closed_at",
        "ruta_proyecto": "project_path",
        "prioridad": "priority",
        "anio": "year",
        "notas": "notes",
    },
    "doa_historical_projects": {
        "numero_proyecto": "project_number",
        "titulo": "title",
        "descripcion": "description",
        "cliente_nombre": "client_name",
        "anio": "year",
        "aeronave": "aircraft",
        "ruta_origen": "source_path",
        "nombre_carpeta_origen": "source_folder_name",
        "mdl_contenido": "mdl_content",
    },
    "doa_historical_project_documents": {
        "proyecto_historico_id": "historical_project_id",
        "familia_documento": "document_family",
        "titulo": "title",
        "ruta_relativa": "relative_path",
        "contenido_md": "content_md",
    },
    "doa_project_deliverables": {
        "proyecto_id": "project_id",
        "titulo": "title",
        "descripcion": "description",
        "estado": "status",
        "version_actual": "current_version",
        "orden": "sort_order",
    },
    "doa_project_validations": {
        "proyecto_id": "project_id",
        "comentarios": "comments",
        "observaciones": "observations",
    },
    "doa_project_signatures": {
        "proyecto_id": "project_id",
    },
    "doa_project_deliveries": {
        "proyecto_id": "project_id",
    },
    "doa_project_closures": {
        "proyecto_id": "project_id",
        "notas_cierre": "closure_notes",
    },
    "doa_project_lessons": {
        "proyecto_id": "project_id",
        "categoria": "category",
        "tipo": "type",
        "titulo": "title",
        "descripcion": "description",
        "impacto": "impact",
        "recomendacion": "recommendation",
    },
    "doa_project_time_entries": {
        "proyecto_id": "project_id",
        "numero_proyecto": "project_number",
        "inicio": "started_at",
        "fin": "ended_at",
        "duracion_minutos": "duration_minutes",
        "usuario": "user_label",
    },
    "doa_emails": {
        "consulta_id": "incoming_request_id",
        "direccion": "direction",
        "de": "from_email",
        "para": "to_email",
        "asunto": "subject",
    "cuerpo": "body",
        "cuerpo": "body",
        "fecha": "message_date",
        "mensaje_id": "message_id",
        "en_respuesta_a": "in_reply_to",
    },
}

VALUE_RENAMES = {
    # quotation board / incoming requests
    "entrada_recibida": "request_received",
    "formulario_enviado": "form_sent",
    "formulario_recibido": "form_received",
    "formulario_completado": "form_received",
    "definir_alcance": "define_scope",
    "esperando_respuesta_cliente": "awaiting_client_response",
    "alcance_definido": "scope_defined",
    "oferta_en_revision": "quote_in_review",
    "oferta_enviada": "quote_sent",
    "oferta_aceptada": "quote_accepted",
    "oferta_rechazada": "quote_rejected",
    "revision_final": "final_review",
    "esperando_formulario": "awaiting_form",
    # project legacy/new status values
    "proyecto_abierto": "project_opened",
    "nuevo": "new",
    "en_progreso": "in_progress",
    "revision": "review",
    "aprobacion": "approval",
    "entregado": "delivered",
    "cerrado": "closed",
    "archivado": "archived",
    "oferta": "quote",
    "activo": "active",
    "en_revision": "in_review",
    "pendiente_aprobacion_cve": "pending_cve_approval",
    "pendiente_aprobacion_easa": "pending_easa_approval",
    "en_pausa": "paused",
    "cancelado": "canceled",
    "guardado_en_base_de_datos": "saved_to_database",
    # execution state machine
    "planificacion": "planning",
    "en_ejecucion": "in_execution",
    "revision_interna": "internal_review",
    "listo_para_validacion": "ready_for_validation",
    "en_validacion": "in_validation",
    "validado": "validated",
    "devuelto_a_ejecucion": "returned_to_execution",
    "preparando_entrega": "preparing_delivery",
    "confirmacion_cliente": "client_confirmation",
    "archivado_proyecto": "project_archived",
    "ejecucion": "execution",
    "validacion": "validation",
    "entrega": "delivery",
    "cierre": "closure",
    # deliverables / validation / dispatch / lessons
    "pendiente": "pending",
    "en_curso": "in_progress",
    "completado": "completed",
    "bloqueado": "blocked",
    "no_aplica": "not_applicable",
    "aprobado": "approved",
    "devuelto": "returned",
    "enviando": "sending",
    "enviado": "sent",
    "fallo": "failed",
    "confirmado_cliente": "client_confirmed",
    "exitoso_con_reservas": "successful_with_reservations",
    "exitoso": "successful",
    "problematico": "problematic",
    "abortado": "aborted",
    "tecnica": "technical",
    "proceso": "process",
    "calidad": "quality",
    "herramientas": "tools",
    "regulatoria": "regulatory",
    "otro": "other",
    "positiva": "positive",
    "negativa": "negative",
    "mejora": "improvement",
    "riesgo": "risk",
    # booleans / form enums / priorities
    "no_seguro": "not_sure",
    "proyecto_nuevo": "new_project",
    "modificacion_existente": "existing_modification",
    "aerolinea": "airline",
    "privado": "private",
    "fabricante": "manufacturer",
    "baja": "low",
    "media": "medium",
    "alta": "high",
    "urgente": "urgent",
    "completada": "completed",
    "bloqueada": "blocked",
    "en_redaccion": "drafting",
    "plano": "drawing",
    "informe": "report",
    "instruccion": "instruction",
    "certificado": "certificate",
}

PASCAL_RENAMES = {
    "ClienteWithContactos": "ClientWithContacts",
    "ClienteContacto": "ClientContact",
    "Cliente": "Client",
    "AeronaveModelo": "AircraftModel",
    "AeronaveRow": "AircraftRow",
    "UsuarioDoa": "DoaUser",
    "EstadoProyectoPersistido": "PersistedProjectStatus",
    "EstadoProyectoWorkflow": "ProjectWorkflowStatus",
    "EstadoProyectoLegacy": "LegacyProjectStatus",
    "EstadoProyecto": "ProjectStatus",
    "ProyectoConRelaciones": "ProjectWithRelations",
    "ProyectoEstadoHistorial": "ProjectStatusHistory",
    "ProyectoHistoricoArchivo": "HistoricalProjectFile",
    "ProyectoHistoricoRow": "HistoricalProjectRow",
    "ProyectoDocumento": "ProjectDocument",
    "ProyectoHito": "ProjectMilestone",
    "ProyectoTarea": "ProjectTask",
    "Proyecto": "Project",
    "ConsultaEntrante": "IncomingRequest",
    "EstadoConsulta": "IncomingRequestStatus",
    "ConteoHorasProyecto": "ProjectTimeEntry",
    "MdlDocumento": "MdlDocument",
    "MdlContenido": "MdlContent",
    "DeliverableEstado": "DeliverableStatus",
    "ValidationObservation": "ValidationObservation",
    "LessonCategoria": "LessonCategory",
    "LessonTipo": "LessonType",
    "ProyectosHistoricoEntryClient": "HistoricalProjectEntryClient",
    "ProyectosHistoricoPageClient": "HistoricalProjectsPageClient",
    "ProyectosClient": "ProjectsClient",
    "AeronavesPageClient": "AircraftPageClient",
}

IDENTIFIER_RENAMES = {
    # Constants/functions
    "CONSULTA_ESTADOS": "INCOMING_REQUEST_STATUSES",
    "CONSULTA_STATE_CONFIG": "INCOMING_REQUEST_STATUS_CONFIG",
    "CONSULTA_TRANSITIONS": "INCOMING_REQUEST_TRANSITIONS",
    "getConsultaStatusMeta": "getIncomingRequestStatusMeta",
    "getAllowedConsultaTransitions": "getAllowedIncomingRequestTransitions",
    "isEstado": "isStatus",
    "PROJECT_LEGACY_BRIDGE_STATES": "PROJECT_LEGACY_STATUS_VALUES",
    "PROJECT_LEGACY_STATE_CONFIG": "PROJECT_LEGACY_STATUS_CONFIG",
    "PROJECT_LEGACY_TRANSITIONS": "PROJECT_LEGACY_STATUS_TRANSITIONS",
    "PROJECT_LEGACY_TO_WORKFLOW": "PROJECT_LEGACY_TO_WORKFLOW_STATUS",
    "LESSON_CATEGORIA_LABELS": "LESSON_CATEGORY_LABELS",
    "LESSON_TIPO_LABELS": "LESSON_TYPE_LABELS",
    "CLOSURE_OUTCOMES": "CLOSURE_OUTCOMES",
    # Uppercase object keys
    "ENTRADA_RECIBIDA": "REQUEST_RECEIVED",
    "FORMULARIO_ENVIADO": "FORM_SENT",
    "FORMULARIO_RECIBIDO": "FORM_RECEIVED",
    "DEFINIR_ALCANCE": "DEFINE_SCOPE",
    "ESPERANDO_RESPUESTA_CLIENTE": "AWAITING_CLIENT_RESPONSE",
    "ALCANCE_DEFINIDO": "SCOPE_DEFINED",
    "OFERTA_EN_REVISION": "QUOTE_IN_REVIEW",
    "OFERTA_ENVIADA": "QUOTE_SENT",
    "OFERTA_ACEPTADA": "QUOTE_ACCEPTED",
    "OFERTA_RECHAZADA": "QUOTE_REJECTED",
    "REVISION_FINAL": "FINAL_REVIEW",
    "PROYECTO_ABIERTO": "PROJECT_OPENED",
    "ESPERANDO_FORMULARIO": "AWAITING_FORM",
    "NUEVO": "NEW",
    "EN_PROGRESO": "IN_PROGRESS",
    "REVISION": "REVIEW",
    "APROBACION": "APPROVAL",
    "ENTREGADO": "DELIVERED",
    "CERRADO": "CLOSED",
    "ARCHIVADO": "ARCHIVED",
    "PLANIFICACION": "PLANNING",
    "EN_EJECUCION": "IN_EXECUTION",
    "REVISION_INTERNA": "INTERNAL_REVIEW",
    "LISTO_PARA_VALIDACION": "READY_FOR_VALIDATION",
    "EN_VALIDACION": "IN_VALIDATION",
    "VALIDADO": "VALIDATED",
    "DEVUELTO_A_EJECUCION": "RETURNED_TO_EXECUTION",
    "PREPARANDO_ENTREGA": "PREPARING_DELIVERY",
    "CONFIRMACION_CLIENTE": "CLIENT_CONFIRMATION",
    "ARCHIVADO_PROYECTO": "PROJECT_ARCHIVED",
    "EJECUCION": "EXECUTION",
    "VALIDACION": "VALIDATION",
    "ENTREGA": "DELIVERY",
    "CIERRE": "CLOSURE",
    "EXITOSO_CON_RESERVAS": "SUCCESSFUL_WITH_RESERVATIONS",
    "EXITOSO": "SUCCESSFUL",
    "PROBLEMATICO": "PROBLEMATIC",
    "ABORTADO": "ABORTED",
}

# Identifier/column fragment replacements. These are applied as plain strings,
# longest first, so more specific snake_case names win over shorter fragments.
SNAKE_RENAMES = {
    # table names first
    **TABLE_RENAMES,
    # columns and common variables
    "numero_proyecto": "project_number",
    "titulo": "title",
    "descripcion": "description",
    "descripción": "description",
    "consulta_id": "incoming_request_id",
    "cliente_id": "client_id",
    "cliente_nombre": "client_name",
    "proyecto_id": "project_id",
    "proyecto_historico_id": "historical_project_id",
    "aeronave": "aircraft",
    "aeronaves": "aircraft",
    "fabricante": "manufacturer",
    "fabricantes": "manufacturers",
    "familia_documento": "document_family",
    "familia": "family",
    "modelo": "model",
    "modelos": "models",
    "pais": "country",
    "país": "country",
    "ciudad": "city",
    "direccion": "address",
    "dirección": "address",
    "telefono": "phone",
    "nombre": "name",
    "rol": "role",
    "contactos": "contacts",
    "motor": "engine",
    "regulacion_base": "base_regulation",
    "msn_elegibles": "eligible_msns",
    "teléfono": "phone",
    "dominio_email": "email_domain",
    "tipo_cliente": "client_type",
    "cif_vat": "vat_tax_id",
    "nombre_carpeta_origen": "source_folder_name",
    "ruta_origen": "source_path",
    "ruta_relativa": "relative_path",
    "ruta_proyecto": "project_path",
    "nombre_archivo": "file_name",
    "codigo_documento": "document_code",
    "contenido_md": "content_md",
    "mdl_contenido": "mdl_content",
    "compliance_docs_md": "compliance_docs_md",
    "asunto": "subject",
    "cuerpo": "body",
    "remitente": "sender",
    "cuerpo_original": "original_body",
    "clasificacion": "classification",
    "clasificación": "classification",
    "respuesta_ia": "ai_response",
    "respuesta": "response",
    "respuestas": "responses",
    "estado_updated_at": "status_updated_at",
    "estado_updated_by": "status_updated_by",
    "estado_anterior": "previous_status",
    "estado_nuevo": "new_status",
    "estado_motivo": "status_reason",
    "estado_v2": "execution_status",
    "estado": "status",
    "estados": "statuses",
    "fase_actual": "current_phase",
    "numero_entrada": "entry_number",
    "url_formulario": "form_url",
    "correo_cliente_enviado_at": "client_email_sent_at",
    "correo_cliente_enviado_by": "client_email_sent_by",
    "ultimo_borrador_cliente": "last_client_draft",
    "fecha_inicio": "start_date",
    "fecha_entrega_estimada": "estimated_delivery_date",
    "fecha_cierre": "closed_at",
    "fecha_ultima_revision": "last_review_date",
    "fecha_prevista": "planned_date",
    "fecha_completado": "completed_at",
    "fecha_limite": "due_date",
    "fecha": "date",
    "prioridad": "priority",
    "anio": "year",
    "notas_cierre": "closure_notes",
    "notas": "notes",
    "activo": "is_active",
    "es_principal": "is_primary",
    "apellidos": "last_name",
    "cargo": "job_title",
    "tipo_documento": "document_type",
    "version_actual": "current_version",
    "orden": "sort_order",
    "observaciones": "observations",
    "observacion": "observation",
    "comentarios": "comments",
    "texto": "text",
    "severidad": "severity",
    "mensaje_id": "message_id",
    "en_respuesta_a": "in_reply_to",
    "duracion_minutos": "duration_minutes",
    "inicio": "started_at",
    "fin": "ended_at",
    "usuario": "user_label",
    "horas_plan": "planned_hours",
    "horas_real": "actual_hours",
    "horas_estimadas": "estimated_hours",
    "horas_reales": "actual_hours",
    "validaciones_total": "validations_total",
    "validaciones_aprobadas": "validations_approved",
    "validaciones_devueltas": "validations_returned",
    "validaciones_count": "validations_count",
    "devoluciones_count": "returns_count",
    "entregas_total": "deliveries_total",
    "entregas_enviadas": "deliveries_sent",
    "entregas_confirmadas": "deliveries_confirmed",
    "entregas_count": "deliveries_count",
    "dias_en_ejecucion": "days_in_execution",
    "dias_en_validacion": "days_in_validation",
    "dias_en_entrega": "days_in_delivery",
    "dias_totales_cerrado_vs_abierto": "total_days_closed_vs_opened",
    "dias_total": "total_days",
    "lecciones_count": "lessons_count",
    "categoria": "category",
    "impacto": "impact",
    "recomendacion": "recommendation",
    "tipo": "type",
    "documentos": "documents",
    "documento": "document",
    "plantillas": "templates",
    "plantilla": "template",
    "proyectos_historico": "historical_projects",
    "proyectos": "projects",
    "proyecto": "project",
    "consultas_entrantes": "incoming_requests",
    "consultas": "requests",
    "consulta": "request",
    "clientes": "clients",
    "cliente": "client",
    "historico": "historical",
    "histórico": "historical",
    "validacion": "validation",
    "validación": "validation",
    "aprobacion": "approval",
    "aprobación": "approval",
    "correo": "email",
    "correos": "emails",
    "carpeta": "folder",
    "ruta": "path",
    "ofertas": "quotes",
    "oferta": "quote",
}

# Human-facing labels and common Spanish phrases that should read naturally.
PHRASE_RENAMES = {
    "Entrada recibida": "Request received",
    "Nueva entrada": "New request",
    "Formulario enviado. Esperando respuesta": "Form sent. Awaiting response",
    "Formulario enviado": "Form sent",
    "Formulario general recibido. Revisar": "General form received. Review",
    "Form. gral. recibido": "General form received",
    "Definir alcance. Preliminar": "Define scope. Preliminary",
    "Alcance prelim.": "Preliminary scope",
    "Esperando respuesta del cliente": "Awaiting client response",
    "Esperando cliente": "Awaiting client",
    "Alcance definido. Preparar oferta": "Scope defined. Prepare quote",
    "Oferta preparada. Revisar": "Quote prepared. Review",
    "Oferta enviada a cliente": "Quote sent to client",
    "Oferta aceptada": "Quote accepted",
    "Oferta rechazada": "Quote rejected",
    "Revisión final. Abrir Proyecto": "Final review. Open project",
    "Proyecto abierto": "Project opened",
    "Archivado": "Archived",
    "En Progreso": "In Progress",
    "Revision": "Review",
    "Aprobacion": "Approval",
    "Entregado": "Delivered",
    "Cerrado": "Closed",
    "Planificacion": "Planning",
    "En ejecucion": "In execution",
    "Revision interna": "Internal review",
    "Listo para validacion": "Ready for validation",
    "En validacion": "In validation",
    "Validado": "Validated",
    "Devuelto a ejecucion": "Returned to execution",
    "Preparando entrega": "Preparing delivery",
    "Confirmacion cliente": "Client confirmation",
    "Estado desconocido": "Unknown status",
    "Estado de quotations desconocido": "Unknown quotation status",
    "Estado de ejecucion desconocido": "Unknown execution status",
    "Aprobado": "Approved",
    "Devuelto": "Returned",
    "Pendiente": "Pending",
    "Informativa": "Informational",
    "Advertencia": "Warning",
    "Bloqueante": "Blocking",
    "Tecnica": "Technical",
    "Planificacion": "Planning",
    "Herramientas": "Tools",
    "Regulatoria": "Regulatory",
    "Otro": "Other",
    "Positiva": "Positive",
    "Negativa": "Negative",
    "Mejora": "Improvement",
    "Riesgo": "Risk",
    "Exitoso con reservas": "Successful with reservations",
    "Exitoso": "Successful",
    "Problematico": "Problematic",
    "Abortado": "Aborted",
    "Recien creado": "Recently created",
    "pendiente de respuesta": "awaiting response",
    "pendiente de revisión": "awaiting review",
    "pendiente de revision": "awaiting review",
    "consulta comercial": "commercial request",
    "Consulta comercial": "Commercial request",
    "consulta": "request",
    "Consulta": "Request",
    "cliente": "client",
    "Cliente": "Client",
    "proyecto": "project",
    "Proyecto": "Project",
    "aeronave": "aircraft",
    "Aeronave": "Aircraft",
}

ROUTE_RENAMES = {
    "/api/proyectos-historico": "/api/historical-projects",
    "/api/proyectos": "/api/projects",
    "/api/consultas": "/api/incoming-requests",
    "/api/aeronaves/fabricantes": "/api/aircraft/manufacturers",
    "/api/aeronaves/modelos": "/api/aircraft/models",
    "/api/aeronaves": "/api/aircraft",
    "/api/clientes": "/api/clients",
    "/api/webhooks/conteo-horas": "/api/webhooks/time-tracking",
    "/proyectos-historico": "/historical-projects",
    "/proyectos": "/projects",
    "/aeronaves": "/aircraft",
    "/tools/experto": "/tools/expert",
    "/abrir-proyecto": "/open-project",
    "/documentos": "/documents",
    "/referencias": "/references",
    "/archivar": "/archive",
    "/cerrar": "/close",
    "/confirmar-entrega": "/confirm-delivery",
    "/enviar-a-validacion": "/send-to-validation",
    "/enviar-entrega": "/send-delivery",
    "/planificar": "/plan",
    "/preparar-entrega": "/prepare-delivery",
    "/retomar": "/resume",
    "/transicion": "/transition",
    "/validar": "/validate",
    "/crear-manual": "/create-manual",
    "/fabricantes": "/manufacturers",
    "/modelos": "/models",
}

PATH_RENAMES = [
    ("app/(dashboard)/aeronaves", "app/(dashboard)/aircraft"),
    ("app/(dashboard)/aircraft/AeronavesPageClient.tsx", "app/(dashboard)/aircraft/AircraftPageClient.tsx"),
    ("app/(dashboard)/proyectos", "app/(dashboard)/projects"),
    ("app/(dashboard)/projects/ProyectosClient.tsx", "app/(dashboard)/projects/ProjectsClient.tsx"),
    ("app/(dashboard)/proyectos-historico", "app/(dashboard)/historical-projects"),
    ("app/(dashboard)/historical-projects/ProyectosHistoricoPageClient.tsx", "app/(dashboard)/historical-projects/HistoricalProjectsPageClient.tsx"),
    ("app/(dashboard)/historical-projects/[id]/ProyectosHistoricoEntryClient.tsx", "app/(dashboard)/historical-projects/[id]/HistoricalProjectEntryClient.tsx"),
    ("app/(dashboard)/tools/experto", "app/(dashboard)/tools/expert"),
    ("app/api/aeronaves", "app/api/aircraft"),
    ("app/api/aircraft/fabricantes", "app/api/aircraft/manufacturers"),
    ("app/api/aircraft/modelos", "app/api/aircraft/models"),
    ("app/api/clientes", "app/api/clients"),
    ("app/api/consultas", "app/api/incoming-requests"),
    ("app/api/incoming-requests/[id]/abrir-proyecto", "app/api/incoming-requests/[id]/open-project"),
    ("app/api/incoming-requests/[id]/documentos", "app/api/incoming-requests/[id]/documents"),
    ("app/api/incoming-requests/[id]/referencias", "app/api/incoming-requests/[id]/references"),
    ("app/api/proyectos-historico", "app/api/historical-projects"),
    ("app/api/proyectos", "app/api/projects"),
    ("app/api/projects/[id]/archivar", "app/api/projects/[id]/archive"),
    ("app/api/projects/[id]/cerrar", "app/api/projects/[id]/close"),
    ("app/api/projects/[id]/confirmar-entrega", "app/api/projects/[id]/confirm-delivery"),
    ("app/api/projects/[id]/enviar-a-validacion", "app/api/projects/[id]/send-to-validation"),
    ("app/api/projects/[id]/enviar-entrega", "app/api/projects/[id]/send-delivery"),
    ("app/api/projects/[id]/planificar", "app/api/projects/[id]/plan"),
    ("app/api/projects/[id]/preparar-entrega", "app/api/projects/[id]/prepare-delivery"),
    ("app/api/projects/[id]/retomar", "app/api/projects/[id]/resume"),
    ("app/api/projects/[id]/transicion", "app/api/projects/[id]/transition"),
    ("app/api/projects/[id]/validar", "app/api/projects/[id]/validate"),
    ("app/api/projects/crear-manual", "app/api/projects/create-manual"),
    ("app/api/webhooks/conteo-horas", "app/api/webhooks/time-tracking"),
    ("lib/proyectos", "lib/projects"),
    ("lib/projects/crear-manual.ts", "lib/projects/create-manual.ts"),
]


def iter_files(root: Path) -> Iterable[Path]:
    roots = [root / name for name in SCAN_DIRS if (root / name).exists()]
    roots += [path for path in root.iterdir() if path.is_file() and path.suffix.lower() in TEXT_SUFFIXES]
    seen: set[Path] = set()
    for scan_root in roots:
        iterator = [scan_root] if scan_root.is_file() else sorted(scan_root.rglob("*"))
        for path in iterator:
            if path in seen:
                continue
            seen.add(path)
            if not path.is_file():
                continue
            rel = path.relative_to(root).as_posix()
            if any(rel.startswith(prefix) for prefix in SKIP_REL_PREFIXES):
                continue
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            if path.name in SKIP_FILES:
                continue
            if path.suffix.lower() not in TEXT_SUFFIXES:
                continue
            try:
                if path.stat().st_size > MAX_TEXT_BYTES:
                    continue
            except OSError:
                continue
            yield path


def build_replacements() -> list[tuple[str, str]]:
    pairs: dict[str, str] = {}
    # Priority matters: structural/code identifiers win over broad value/comment words.
    for mapping in [
        ROUTE_RENAMES,
        PASCAL_RENAMES,
        IDENTIFIER_RENAMES,
        SNAKE_RENAMES,
        VALUE_RENAMES,
        PHRASE_RENAMES,
    ]:
        for old, new in mapping.items():
            pairs.setdefault(old, new)

    # Contextual replacements for too-short or semantically overloaded DB columns/values.
    contextual = {
        "'si'": "'yes'",
        '"si"': '"yes"',
        "`si`": "`yes`",
        "'activo'": "'active'",
        '"activo"': '"active"',
        "`activo`": "`active`",
        "'entrante'": "'inbound'",
        '"entrante"': '"inbound"',
        "`entrante`": "`inbound`",
        "'saliente'": "'outbound'",
        '"saliente"': '"outbound"',
        "`saliente`": "`outbound`",
        "direccion: 'entrante' | 'saliente'": "direction: 'inbound' | 'outbound'",
        "direccion: 'inbound' | 'outbound'": "direction: 'inbound' | 'outbound'",
        "  de: string": "  from_email: string",
        "  para: string | null": "  to_email: string | null",
        "email.de": "email.from_email",
        "email.para": "email.to_email",
        "email.asunto": "email.subject",
        "email.cuerpo": "email.body",
        "email.fecha": "email.date",
        "email.mensaje_id": "email.message_id",
        "email.en_respuesta_a": "email.in_reply_to",
        "  web: string | null": "  website: string | null",
        "client.web": "client.website",
        "e.asunto": "e.subject",
        "e.cuerpo": "e.body",
        "e.fecha": "e.date",
        'direccion: "entrante" | "saliente"': 'direction: "inbound" | "outbound"',
        "email.direccion": "email.direction",
        "e.direccion": "e.direction",
    }
    # Contextual replacements must run before broader word-boundary replacements.
    ordered = list(contextual.items()) + sorted(pairs.items(), key=lambda item: len(item[0]), reverse=True)
    return ordered


WORD_CHARS = "A-Za-zÀ-ÿ0-9_"


def is_simple_word_key(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-zÀ-ÿ]+", value))


def apply_text_replacements(text: str, replacements: list[tuple[str, str]]) -> tuple[str, int]:
    """Apply replacements without corrupting substrings.

    Plain replacement is safe for paths, phrases, table names, snake_case names,
    and quoted contextual tokens. Bare words such as `fin` or `baja` are replaced
    only when surrounded by non-identifier characters.
    """
    total = 0
    for old, new in replacements:
        if old == new:
            continue
        if is_simple_word_key(old):
            pattern = re.compile(rf"(?<![{WORD_CHARS}]){re.escape(old)}(?![{WORD_CHARS}])")
            text, count = pattern.subn(new, text)
            total += count
        else:
            count = text.count(old)
            if count:
                text = text.replace(old, new)
                total += count
    return text, total


def rename_paths(app: Path, dry_run: bool) -> list[dict[str, str]]:
    changed = []
    for src_rel, dst_rel in PATH_RENAMES:
        src = app / src_rel
        dst = app / dst_rel
        if not src.exists():
            continue
        if dst.exists():
            # If target already exists because a previous rename moved parent first, skip safely.
            continue
        changed.append({"from": src_rel, "to": dst_rel})
        if not dry_run:
            dst.parent.mkdir(parents=True, exist_ok=True)
            src.rename(dst)
    return changed


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def apply_file_specific_fixes(path: Path, app: Path) -> None:
    """Fix overloaded Spanish terms where the global map cannot infer context."""
    rel = path.relative_to(app).as_posix()
    text = path.read_text(encoding="utf-8")
    original = text
    if rel == "lib/workflow-states.ts":
        # `activo` is a legacy status value here, not a client is_active field.
        text = text.replace("  is_active: {", "  active: {")
        text = text.replace("  is_active: [", "  active: [")
        text = text.replace("  is_active,", "  active,")
        text = text.replace("is_active: PROJECT_STATES", "active: PROJECT_STATES")
    if text != original:
        path.write_text(text, encoding="utf-8")


def generate_sql_migration(app: Path) -> Path:
    migration = app / "supabase" / "migrations" / "202604211200_english_schema_contract.sql"
    lines: list[str] = []
    lines.append("-- Surgical English schema contract migration for DOA Operations Hub")
    lines.append("-- Generated by scripts/apply_english_migration.py on 2026-04-21.")
    lines.append("-- Apply after backing up Supabase and before deploying the English-only app build.")
    lines.append("")
    lines.append("BEGIN;")
    lines.append("")

    # Drop known constraints before data/status renames and column renames.
    constraint_drops = [
        ("doa_consultas_entrantes", "doa_consultas_entrantes_estado_check"),
        ("doa_incoming_requests", "doa_incoming_requests_status_check"),
        ("doa_proyectos", "doa_proyectos_estado_check"),
        ("doa_projects", "doa_projects_status_check"),
        ("doa_proyectos", "doa_proyectos_estado_v2_check"),
        ("doa_projects", "doa_projects_execution_status_check"),
        ("doa_proyectos", "doa_proyectos_fase_actual_check"),
        ("doa_projects", "doa_projects_current_phase_check"),
        ("doa_workflow_state_config", "doa_workflow_state_config_scope_check"),
    ]
    for table, constraint in constraint_drops:
        lines.append(f"ALTER TABLE IF EXISTS public.{table} DROP CONSTRAINT IF EXISTS {constraint};")
    lines.append("")

    lines.append("-- Rename tables from Spanish to English when the English table does not already exist.")
    for old, new in TABLE_RENAMES.items():
        lines.append("DO $$")
        lines.append("BEGIN")
        lines.append(f"  IF to_regclass('public.{old}') IS NOT NULL AND to_regclass('public.{new}') IS NULL THEN")
        lines.append(f"    ALTER TABLE public.{old} RENAME TO {new};")
        lines.append("  END IF;")
        lines.append("END $$;")
    lines.append("")

    lines.append("-- Rename columns after table renames. Existing English columns are left untouched.")
    for table, cmap in COLUMN_RENAMES.items():
        for old, new in cmap.items():
            lines.append("DO $$")
            lines.append("BEGIN")
            lines.append("  IF EXISTS (")
            lines.append("    SELECT 1 FROM information_schema.columns")
            lines.append(f"    WHERE table_schema = 'public' AND table_name = {sql_literal(table)} AND column_name = {sql_literal(old)}")
            lines.append("  ) AND NOT EXISTS (")
            lines.append("    SELECT 1 FROM information_schema.columns")
            lines.append(f"    WHERE table_schema = 'public' AND table_name = {sql_literal(table)} AND column_name = {sql_literal(new)}")
            lines.append("  ) THEN")
            lines.append(f"    ALTER TABLE public.{table} RENAME COLUMN {old} TO {new};")
            lines.append("  END IF;")
            lines.append("END $$;")
    lines.append("")

    def update_values(table: str, column: str, mapping: dict[str, str]) -> None:
        cases = " ".join(f"WHEN {sql_literal(old)} THEN {sql_literal(new)}" for old, new in mapping.items())
        olds = ", ".join(sql_literal(old) for old in mapping)
        lines.append("DO $$")
        lines.append("BEGIN")
        lines.append(f"  IF to_regclass('public.{table}') IS NOT NULL AND EXISTS (")
        lines.append("    SELECT 1 FROM information_schema.columns")
        lines.append(f"    WHERE table_schema = 'public' AND table_name = {sql_literal(table)} AND column_name = {sql_literal(column)}")
        lines.append("  ) THEN")
        lines.append(f"    UPDATE public.{table} SET {column} = CASE {column} {cases} ELSE {column} END WHERE {column} IN ({olds});")
        lines.append("  END IF;")
        lines.append("END $$;")
        lines.append("")

    incoming_status = {k: v for k, v in VALUE_RENAMES.items() if k in {
        "entrada_recibida", "formulario_enviado", "formulario_recibido", "formulario_completado",
        "definir_alcance", "esperando_respuesta_cliente", "alcance_definido", "oferta_en_revision",
        "oferta_enviada", "oferta_aceptada", "oferta_rechazada", "revision_final", "proyecto_abierto",
        "nuevo", "esperando_formulario", "archivado",
    }}
    project_status = {k: v for k, v in VALUE_RENAMES.items() if k in {
        "nuevo", "en_progreso", "revision", "aprobacion", "entregado", "cerrado", "archivado",
        "oferta", "activo", "en_revision", "pendiente_aprobacion_cve", "pendiente_aprobacion_easa",
        "en_pausa", "cancelado", "guardado_en_base_de_datos",
    }}
    execution_status = {k: v for k, v in VALUE_RENAMES.items() if k in {
        "proyecto_abierto", "planificacion", "en_ejecucion", "revision_interna", "listo_para_validacion",
        "en_validacion", "validado", "devuelto_a_ejecucion", "preparando_entrega", "entregado",
        "confirmacion_cliente", "cerrado", "archivado_proyecto",
    }}
    phases = {k: v for k, v in VALUE_RENAMES.items() if k in {"ejecucion", "validacion", "entrega", "cierre"}}
    deliverable_status = {k: v for k, v in VALUE_RENAMES.items() if k in {"pendiente", "en_curso", "en_revision", "completado", "bloqueado", "no_aplica"}}
    validation_decisions = {k: v for k, v in VALUE_RENAMES.items() if k in {"aprobado", "devuelto", "pendiente"}}
    delivery_status = {k: v for k, v in VALUE_RENAMES.items() if k in {"pendiente", "enviando", "enviado", "fallo", "confirmado_cliente"}}
    closure_outcomes = {k: v for k, v in VALUE_RENAMES.items() if k in {"exitoso", "exitoso_con_reservas", "problematico", "abortado"}}
    lesson_categories = {k: v for k, v in VALUE_RENAMES.items() if k in {"tecnica", "proceso", "cliente", "calidad", "planificacion", "herramientas", "regulatoria", "otro"}}
    lesson_types = {k: v for k, v in VALUE_RENAMES.items() if k in {"positiva", "negativa", "mejora", "riesgo"}}
    email_direction = {"entrante": "inbound", "saliente": "outbound"}

    lines.append("-- Translate persisted enum/status values to English.")
    update_values("doa_incoming_requests", "status", incoming_status)
    update_values("doa_projects", "status", project_status)
    update_values("doa_projects", "execution_status", execution_status)
    update_values("doa_projects", "current_phase", phases)
    update_values("doa_project_deliverables", "status", deliverable_status)
    update_values("doa_project_validations", "decision", validation_decisions)
    update_values("doa_project_deliveries", "dispatch_status", delivery_status)
    update_values("doa_project_closures", "outcome", closure_outcomes)
    update_values("doa_project_lessons", "category", lesson_categories)
    update_values("doa_project_lessons", "type", lesson_types)
    update_values("doa_emails", "direction", email_direction)

    lines.append("-- Recreate critical CHECK constraints with English values.")
    incoming_values = sorted(set(incoming_status.values()))
    lines.append("ALTER TABLE IF EXISTS public.doa_incoming_requests")
    lines.append("  ADD CONSTRAINT doa_incoming_requests_status_check")
    lines.append("  CHECK (status IN (" + ", ".join(sql_literal(v) for v in incoming_values) + "));" )
    lines.append("")
    project_values = sorted(set(project_status.values()))
    lines.append("ALTER TABLE IF EXISTS public.doa_projects")
    lines.append("  ADD CONSTRAINT doa_projects_status_check")
    lines.append("  CHECK (status IN (" + ", ".join(sql_literal(v) for v in project_values) + "));" )
    lines.append("")
    execution_values = [
        "project_opened", "planning", "in_execution", "internal_review", "ready_for_validation",
        "in_validation", "validated", "returned_to_execution", "preparing_delivery", "delivered",
        "client_confirmation", "closed", "project_archived",
    ]
    lines.append("ALTER TABLE IF EXISTS public.doa_projects")
    lines.append("  ADD CONSTRAINT doa_projects_execution_status_check")
    lines.append("  CHECK (execution_status IS NULL OR execution_status IN (" + ", ".join(sql_literal(v) for v in execution_values) + "));" )
    lines.append("")
    phase_values = ["execution", "validation", "delivery", "closure"]
    lines.append("ALTER TABLE IF EXISTS public.doa_projects")
    lines.append("  ADD CONSTRAINT doa_projects_current_phase_check")
    lines.append("  CHECK (current_phase IS NULL OR current_phase IN (" + ", ".join(sql_literal(v) for v in phase_values) + "));" )
    lines.append("")
    lines.append("ALTER TABLE IF EXISTS public.doa_workflow_state_config")
    lines.append("  ADD CONSTRAINT doa_workflow_state_config_scope_check")
    lines.append("  CHECK (scope IN ('incoming_requests','quotation_board','project_board','project_execution'));" )
    lines.append("")

    lines.append("-- Normalize workflow state config rows after status-code translation.")
    update_values("doa_workflow_state_config", "state_code", {**incoming_status, **execution_status, **project_status})
    update_values("doa_workflow_state_config", "scope", {"incoming_queries": "incoming_requests"})

    lines.append("COMMIT;")
    lines.append("")
    migration.parent.mkdir(parents=True, exist_ok=True)
    migration.write_text("\n".join(lines), encoding="utf-8")
    return migration


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", required=True)
    parser.add_argument("--tmp", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    app = Path(args.app).resolve()
    tmp = Path(args.tmp).resolve()
    tmp.mkdir(parents=True, exist_ok=True)
    dry_run = not args.apply
    if not app.exists():
        raise SystemExit(f"App path does not exist: {app}")

    replacements = build_replacements()
    replacements_payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": dry_run,
        "tables": TABLE_RENAMES,
        "columns": COLUMN_RENAMES,
        "values": VALUE_RENAMES,
        "routes": ROUTE_RENAMES,
        "paths": PATH_RENAMES,
        "replacement_count": len(replacements),
    }
    (tmp / "english_migration_replacements.json").write_text(json.dumps(replacements_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    path_changes = rename_paths(app, dry_run=dry_run)
    file_changes = []
    for path in iter_files(app):
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        new_text, count = apply_text_replacements(text, replacements)
        if new_text != text:
            rel = path.relative_to(app).as_posix()
            file_changes.append({"file": rel, "replacements": count})
            if not dry_run:
                path.write_text(new_text, encoding="utf-8")
                apply_file_specific_fixes(path, app)

    migration_path = None
    if not dry_run:
        migration_path = generate_sql_migration(app).relative_to(app).as_posix()

    log = {
        "dry_run": dry_run,
        "path_changes": path_changes,
        "file_changes": file_changes,
        "migration": migration_path,
    }
    (tmp / "english_migration_apply.log").write_text(json.dumps(log, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "dry_run": dry_run,
        "paths": len(path_changes),
        "files": len(file_changes),
        "migration": migration_path,
        "log": str(tmp / "english_migration_apply.log"),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
