--
-- PostgreSQL database dump
--

\restrict bugYDYzgnerwUoQ9CtINIDtqSBfATQdvCWiCniXp8bbTf9bOybLlt13Oh2FXUD2

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_assignments (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    cliente_id character varying(100) NOT NULL,
    puesto character varying(255),
    servicio character varying(100),
    ubicacion character varying(255),
    supervisor_nombre character varying(255),
    codigo_asignacion character varying(50),
    fecha_inicio timestamp with time zone DEFAULT now() NOT NULL,
    fecha_fin timestamp with time zone,
    estado character varying(50) DEFAULT 'activo'::character varying NOT NULL,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agent_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agent_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agent_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agent_assignments_id_seq OWNED BY public.agent_assignments.id;


--
-- Name: agente_fichajes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agente_fichajes (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    puesto_id integer,
    qr_token text NOT NULL,
    latitud numeric(10,7),
    longitud numeric(10,7),
    distancia_metros integer,
    resultado character varying(20) DEFAULT 'ok'::character varying NOT NULL,
    tipo character varying(20) DEFAULT 'fichaje'::character varying NOT NULL,
    supervisor_id integer,
    supervisor_nombre character varying(255),
    checks jsonb,
    calificacion smallint,
    observaciones text,
    registrado_en timestamp with time zone DEFAULT now() NOT NULL,
    supervisor_device_id integer,
    accion_disciplinaria character varying(50),
    notas_disciplinarias text,
    cliente_id integer,
    slot_numero integer,
    tracking_token_hash text,
    turno_cerrado_en timestamp with time zone,
    recorrido_padre_id integer,
    device_uuid_origen text
);


--
-- Name: agente_fichajes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agente_fichajes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agente_fichajes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agente_fichajes_id_seq OWNED BY public.agente_fichajes.id;


--
-- Name: agente_qr_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agente_qr_tokens (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    qr_token text DEFAULT (gen_random_uuid())::text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    carnet_impreso_at timestamp with time zone,
    carnet_impreso_por character varying(100)
);


--
-- Name: agente_qr_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agente_qr_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agente_qr_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agente_qr_tokens_id_seq OWNED BY public.agente_qr_tokens.id;


--
-- Name: agente_recorrido_gps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agente_recorrido_gps (
    id bigint NOT NULL,
    fichaje_id integer NOT NULL,
    latitud double precision NOT NULL,
    longitud double precision NOT NULL,
    precision_metros integer,
    velocidad_mps double precision,
    rumbo_grados double precision,
    bateria_pct integer,
    capturado_en timestamp with time zone NOT NULL,
    registrado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agente_recorrido_gps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agente_recorrido_gps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agente_recorrido_gps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agente_recorrido_gps_id_seq OWNED BY public.agente_recorrido_gps.id;


--
-- Name: amonestacion_causales_legales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amonestacion_causales_legales (
    id integer NOT NULL,
    codigo text NOT NULL,
    inciso text NOT NULL,
    articulo text DEFAULT 'Art. 77 Código de Trabajo de Guatemala'::text NOT NULL,
    titulo text NOT NULL,
    descripcion text NOT NULL,
    activo boolean DEFAULT true,
    orden integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: amonestacion_causales_legales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.amonestacion_causales_legales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: amonestacion_causales_legales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.amonestacion_causales_legales_id_seq OWNED BY public.amonestacion_causales_legales.id;


--
-- Name: amonestacion_motivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amonestacion_motivos (
    id integer NOT NULL,
    nombre text NOT NULL,
    monto_sugerido numeric(10,2) DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: amonestacion_motivos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.amonestacion_motivos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: amonestacion_motivos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.amonestacion_motivos_id_seq OWNED BY public.amonestacion_motivos.id;


--
-- Name: amonestacion_solicitudes_creacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amonestacion_solicitudes_creacion (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    empleado_nombre text NOT NULL,
    tipo_solicitado text NOT NULL,
    motivo text NOT NULL,
    descripcion text,
    causal_legal_codigo text,
    monto_sugerido numeric(12,2) DEFAULT 0,
    evidencia_url text,
    cliente_id integer,
    cliente_nombre text,
    puesto_id integer,
    puesto_nombre text,
    fecha_incidente date,
    solicitada_por_user_id integer,
    solicitada_por_username text,
    solicitada_por_rol text,
    estado text DEFAULT 'pendiente'::text,
    respuesta_rrhh text,
    amonestacion_creada_id integer,
    resuelta_por text,
    resuelta_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT amonestacion_solicitudes_creacion_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'aprobada'::text, 'rechazada'::text]))),
    CONSTRAINT amonestacion_solicitudes_creacion_tipo_solicitado_check CHECK ((tipo_solicitado = ANY (ARRAY['llamada_atencion'::text, 'economica'::text, 'acta_administrativa'::text])))
);


--
-- Name: amonestacion_solicitudes_creacion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.amonestacion_solicitudes_creacion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: amonestacion_solicitudes_creacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.amonestacion_solicitudes_creacion_id_seq OWNED BY public.amonestacion_solicitudes_creacion.id;


--
-- Name: amonestacion_solicitudes_modificacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amonestacion_solicitudes_modificacion (
    id integer NOT NULL,
    amonestacion_id integer NOT NULL,
    solicitada_por_user_id integer,
    solicitada_por_username text,
    solicitada_por_rol text,
    cambio_solicitado text NOT NULL,
    motivo_solicitud text NOT NULL,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    resuelta_por text,
    resuelta_at timestamp with time zone,
    respuesta_rrhh text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT amonestacion_solicitudes_modificacion_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'aprobada'::text, 'rechazada'::text])))
);


--
-- Name: amonestacion_solicitudes_modificacion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.amonestacion_solicitudes_modificacion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: amonestacion_solicitudes_modificacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.amonestacion_solicitudes_modificacion_id_seq OWNED BY public.amonestacion_solicitudes_modificacion.id;


--
-- Name: amonestaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.amonestaciones (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    empleado_nombre text,
    creado_por_user_id integer,
    creado_por_username text,
    creado_por_rol text NOT NULL,
    tipo text NOT NULL,
    motivo text NOT NULL,
    descripcion text,
    monto numeric(10,2) DEFAULT 0 NOT NULL,
    evidencia_url text,
    cliente_id text,
    cliente_nombre text,
    puesto_id integer,
    puesto_nombre text,
    fecha date DEFAULT CURRENT_DATE NOT NULL,
    estado text DEFAULT 'activa'::text NOT NULL,
    planilla_id integer,
    descontado boolean DEFAULT false NOT NULL,
    anulada_por text,
    anulada_at timestamp with time zone,
    anulada_motivo text,
    notas_rrhh text,
    evento_rrhh_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    causal_legal text,
    articulo_legal text,
    acta_numero integer,
    acta_pdf_url text,
    aplica_descuento boolean DEFAULT false,
    amon_economica_id integer,
    firma_colaborador text,
    firma_levanta text,
    firmada_at timestamp without time zone,
    CONSTRAINT amonestaciones_estado_check CHECK ((estado = ANY (ARRAY['activa'::text, 'anulada'::text]))),
    CONSTRAINT amonestaciones_tipo_check CHECK ((tipo = ANY (ARRAY['llamada_atencion'::text, 'economica'::text, 'acta_administrativa'::text])))
);


--
-- Name: amonestaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.amonestaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: amonestaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.amonestaciones_id_seq OWNED BY public.amonestaciones.id;


--
-- Name: anticipos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.anticipos (
    id integer NOT NULL,
    employee_id integer,
    nombre character varying(255) NOT NULL,
    puesto character varying(255),
    dpi character varying(20),
    telefono character varying(50),
    cantidad integer NOT NULL,
    origen character varying(50) DEFAULT 'manual'::character varying NOT NULL,
    estado character varying(50) DEFAULT 'pendiente'::character varying NOT NULL,
    periodo character varying(30),
    fecha_solicitud timestamp with time zone DEFAULT now() NOT NULL,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    planilla_id integer,
    monto_cobro numeric(10,2),
    num_cuotas integer DEFAULT 1,
    cuota_monto numeric(10,2),
    cuotas_pagadas integer DEFAULT 0,
    extraordinario boolean DEFAULT false NOT NULL,
    autorizado_por character varying(100)
);


--
-- Name: anticipos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.anticipos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: anticipos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.anticipos_id_seq OWNED BY public.anticipos.id;


--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    telefono character varying(50) NOT NULL,
    correo character varying(255),
    experiencia character varying(100),
    ubicacion character varying(255),
    puesto character varying(255) DEFAULT 'Agente de Seguridad'::character varying,
    canal character varying(50) DEFAULT 'web'::character varying NOT NULL,
    estado character varying(50) DEFAULT 'recibido'::character varying NOT NULL,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tarea_asociada character varying(255),
    dpi character varying(15),
    employee_id integer
);


--
-- Name: applications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.applications_id_seq OWNED BY public.applications.id;


--
-- Name: arma_custodia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.arma_custodia (
    id integer NOT NULL,
    arma_id integer NOT NULL,
    employee_id integer,
    puesto_id integer,
    fecha_inicio timestamp with time zone DEFAULT now() NOT NULL,
    fecha_fin timestamp with time zone,
    tipo_origen character varying(30) DEFAULT 'turno_normal'::character varying NOT NULL,
    notas text,
    registrado_por character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: arma_custodia_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.arma_custodia_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: arma_custodia_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.arma_custodia_id_seq OWNED BY public.arma_custodia.id;


--
-- Name: arma_ordenes_servicio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.arma_ordenes_servicio (
    id integer NOT NULL,
    arma_id integer,
    origen character varying(30) DEFAULT 'reporte_turno'::character varying NOT NULL,
    origen_id integer,
    puesto_id integer,
    reportado_por integer,
    descripcion text NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    atendida_por character varying(120),
    atendida_en timestamp with time zone,
    notas_cierre text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: arma_ordenes_servicio_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.arma_ordenes_servicio_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: arma_ordenes_servicio_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.arma_ordenes_servicio_id_seq OWNED BY public.arma_ordenes_servicio.id;


--
-- Name: arma_sugerencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.arma_sugerencias (
    id integer NOT NULL,
    arma_id integer NOT NULL,
    supervisor_nombre character varying(120) NOT NULL,
    puesto_id integer,
    estado_sugerido character varying(30) NOT NULL,
    observacion text,
    atendido boolean DEFAULT false NOT NULL,
    atendido_por character varying(80),
    atendido_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: arma_sugerencias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.arma_sugerencias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: arma_sugerencias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.arma_sugerencias_id_seq OWNED BY public.arma_sugerencias.id;


--
-- Name: armas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.armas (
    id integer NOT NULL,
    codigo character varying(30) NOT NULL,
    tipo character varying(30) DEFAULT 'pistola'::character varying NOT NULL,
    marca character varying(50),
    modelo character varying(50),
    calibre character varying(20),
    serie character varying(60),
    estado character varying(25) DEFAULT 'activo'::character varying NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    puesto_id integer,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    numero_tenencia text,
    fecha_vencimiento_tenencia date,
    numero_portacion text,
    fecha_vencimiento_portacion date,
    ubicacion text,
    client_id integer,
    numero_carnet text,
    fecha_emision_tenencia date,
    fecha_emision_portacion date,
    custodia_cliente_id integer,
    custodia_slot_numero integer,
    tenencia_en_tramite boolean DEFAULT false NOT NULL,
    portacion_en_tramite boolean DEFAULT false NOT NULL,
    ubicacion_interna character varying(40) DEFAULT 'armeria'::character varying NOT NULL,
    custodio_employee_id integer
);


--
-- Name: armas_alertas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.armas_alertas (
    id integer NOT NULL,
    arma_id integer NOT NULL,
    inspeccion_id integer,
    sesion_id integer,
    supervisor_employee_id integer,
    agente_employee_id integer,
    tipo character varying(40) NOT NULL,
    descripcion text,
    estado character varying(15) DEFAULT 'abierta'::character varying NOT NULL,
    abierta_at timestamp with time zone DEFAULT now() NOT NULL,
    cerrada_at timestamp with time zone,
    cerrada_por_user_id integer,
    nota_cierre text,
    CONSTRAINT armas_alertas_estado_check CHECK (((estado)::text = ANY ((ARRAY['abierta'::character varying, 'cerrada'::character varying])::text[]))),
    CONSTRAINT armas_alertas_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['arma_mal_estado'::character varying, 'portacion_extraviada'::character varying, 'portacion_no_legible'::character varying, 'tenencia_extraviada'::character varying, 'tenencia_no_legible'::character varying, 'otro'::character varying])::text[])))
);


--
-- Name: armas_alertas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.armas_alertas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: armas_alertas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.armas_alertas_id_seq OWNED BY public.armas_alertas.id;


--
-- Name: armas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.armas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: armas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.armas_id_seq OWNED BY public.armas.id;


--
-- Name: barraca_asignaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.barraca_asignaciones (
    id integer NOT NULL,
    barraca_id integer NOT NULL,
    employee_id integer NOT NULL,
    fecha_inicio date DEFAULT CURRENT_DATE NOT NULL,
    fecha_fin date,
    activo boolean DEFAULT true NOT NULL,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: barraca_asignaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.barraca_asignaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: barraca_asignaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.barraca_asignaciones_id_seq OWNED BY public.barraca_asignaciones.id;


--
-- Name: barracas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.barracas (
    id integer NOT NULL,
    nombre character varying(200) NOT NULL,
    direccion text,
    departamento character varying(100),
    municipio character varying(100),
    cuota_mensual numeric(10,2) DEFAULT 0 NOT NULL,
    capacidad integer DEFAULT 10 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: barracas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.barracas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: barracas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.barracas_id_seq OWNED BY public.barracas.id;


--
-- Name: bodega_articulos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bodega_articulos (
    id integer NOT NULL,
    categoria_id integer,
    nombre character varying(120) NOT NULL,
    descripcion text,
    codigo_prefijo character varying(6) NOT NULL,
    tipo_rastreo character varying(20) DEFAULT 'seriado'::character varying NOT NULL,
    tipo_asignacion character varying(20) DEFAULT 'colaborador'::character varying NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    costo_unitario numeric(12,2) DEFAULT 0 NOT NULL,
    tipo_equipo character varying(30),
    talla character varying(20),
    stock_bodega integer DEFAULT 0 NOT NULL,
    stock_lavanderia integer DEFAULT 0 NOT NULL,
    stock_servicio integer DEFAULT 0 NOT NULL,
    stock_mal_estado integer DEFAULT 0 NOT NULL
);


--
-- Name: bodega_articulos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bodega_articulos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bodega_articulos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bodega_articulos_id_seq OWNED BY public.bodega_articulos.id;


--
-- Name: bodega_categorias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bodega_categorias (
    id integer NOT NULL,
    nombre character varying(80) NOT NULL,
    descripcion text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bodega_categorias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bodega_categorias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bodega_categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bodega_categorias_id_seq OWNED BY public.bodega_categorias.id;


--
-- Name: bodega_movimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bodega_movimientos (
    id integer NOT NULL,
    unidad_id integer NOT NULL,
    tipo character varying(30) NOT NULL,
    puesto_id integer,
    employee_id integer,
    condicion_antes character varying(20),
    condicion_despues character varying(20),
    notas text,
    registrado_por character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bodega_movimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bodega_movimientos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bodega_movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bodega_movimientos_id_seq OWNED BY public.bodega_movimientos.id;


--
-- Name: bodega_solicitudes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bodega_solicitudes (
    id integer NOT NULL,
    origen character varying(30) DEFAULT 'reporte_turno'::character varying NOT NULL,
    origen_id integer,
    puesto_id integer,
    employee_id integer,
    tipo character varying(40) NOT NULL,
    descripcion text NOT NULL,
    articulo_id integer,
    talla character varying(20),
    cantidad integer DEFAULT 1 NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    atendida_por character varying(120),
    atendida_en timestamp with time zone,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bodega_solicitudes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bodega_solicitudes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bodega_solicitudes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bodega_solicitudes_id_seq OWNED BY public.bodega_solicitudes.id;


--
-- Name: bodega_unidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bodega_unidades (
    id integer NOT NULL,
    articulo_id integer NOT NULL,
    codigo_inventario character varying(30) NOT NULL,
    numero_serie character varying(80),
    condicion character varying(20) DEFAULT 'bueno'::character varying NOT NULL,
    estado character varying(30) DEFAULT 'disponible'::character varying NOT NULL,
    puesto_id integer,
    employee_id integer,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    talla character varying(20)
);


--
-- Name: bodega_unidades_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bodega_unidades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bodega_unidades_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bodega_unidades_id_seq OWNED BY public.bodega_unidades.id;


--
-- Name: cambios_salariales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cambios_salariales (
    id integer NOT NULL,
    movimiento_id integer,
    employee_id integer NOT NULL,
    empleado_nombre character varying(255) NOT NULL,
    puesto_id integer,
    puesto_nombre character varying(255),
    cliente_nombre character varying(255),
    fecha date DEFAULT CURRENT_DATE NOT NULL,
    salario_actual numeric(12,2) NOT NULL,
    salario_puesto numeric(12,2) NOT NULL,
    diferencia numeric(12,2) NOT NULL,
    tipo_impacto character varying(20) NOT NULL,
    estado character varying(30) DEFAULT 'pendiente_rrhh'::character varying NOT NULL,
    valor_aprobado numeric(12,2),
    rrhh_notas text,
    rrhh_usuario character varying(100),
    rrhh_resuelto_at timestamp with time zone,
    operacion_usuario character varying(100),
    tipo_movimiento character varying(30),
    snapshot_puesto jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cambios_salariales_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente_rrhh'::character varying, 'aprobado'::character varying, 'rechazado'::character varying, 'modificado'::character varying])::text[]))),
    CONSTRAINT cambios_salariales_tipo_impacto_check CHECK (((tipo_impacto)::text = ANY ((ARRAY['aumento'::character varying, 'disminucion'::character varying])::text[])))
);


--
-- Name: cambios_salariales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cambios_salariales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cambios_salariales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cambios_salariales_id_seq OWNED BY public.cambios_salariales.id;


--
-- Name: cierre_auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cierre_auditoria (
    id integer NOT NULL,
    cierre_id integer,
    fecha_accion timestamp with time zone DEFAULT now() NOT NULL,
    accion character varying(50) NOT NULL,
    user_id integer,
    user_nombre character varying(100),
    detalle text
);


--
-- Name: cierre_auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cierre_auditoria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cierre_auditoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cierre_auditoria_id_seq OWNED BY public.cierre_auditoria.id;


--
-- Name: cierre_operativo_diario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cierre_operativo_diario (
    id integer NOT NULL,
    fecha date NOT NULL,
    estado character varying(20) DEFAULT 'abierto'::character varying NOT NULL,
    resumen_json jsonb,
    cerrado_por_id integer,
    cerrado_por character varying(100),
    cerrado_en timestamp with time zone,
    comentario text,
    reabierto_por_id integer,
    reabierto_por character varying(100),
    reabierto_en timestamp with time zone,
    motivo_reapertura text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    retroactivo boolean DEFAULT false NOT NULL
);


--
-- Name: cierre_operativo_diario_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cierre_operativo_diario_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cierre_operativo_diario_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cierre_operativo_diario_id_seq OWNED BY public.cierre_operativo_diario.id;


--
-- Name: client_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_aliases (
    id integer NOT NULL,
    client_id integer NOT NULL,
    alias character varying(255) NOT NULL,
    tipo_alias character varying(50) DEFAULT 'comun'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: client_aliases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.client_aliases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: client_aliases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.client_aliases_id_seq OWNED BY public.client_aliases.id;


--
-- Name: client_sedes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_sedes (
    id integer NOT NULL,
    client_id integer,
    nombre character varying(255) NOT NULL,
    direccion text,
    ciudad character varying(100),
    contacto character varying(255),
    telefono character varying(30),
    activo boolean DEFAULT true NOT NULL,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: client_sedes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.client_sedes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: client_sedes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.client_sedes_id_seq OWNED BY public.client_sedes.id;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    nombre_comercial character varying(255),
    nit character varying(50),
    sector character varying(100),
    estado character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    portal_cliente_id character varying(100),
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    observaciones_contractuales text,
    fecha_inicio_contrato date,
    tarifa_base_mensual numeric(12,2),
    estado_contrato character varying(30) DEFAULT 'activo'::character varying,
    dotacion_uniforme_num integer DEFAULT 0,
    dotacion_uniforme_frecuencia_meses integer DEFAULT 0,
    depto_codigo character varying(30),
    igss_aplica boolean DEFAULT false NOT NULL,
    igss_codigo_centro character varying(10),
    igss_direccion text,
    igss_zona character varying(10),
    igss_departamento smallint,
    igss_municipio smallint,
    igss_codigo_actividad character varying(20),
    igss_contacto character varying(200),
    igss_fax character varying(50),
    igss_email character varying(200),
    igss_telefono character varying(100),
    contrato_sin_prueba boolean DEFAULT false NOT NULL,
    tipo_servicio character varying(20) DEFAULT 'vigilancia'::character varying NOT NULL
);


--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- Name: cobertura_diaria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cobertura_diaria (
    id integer NOT NULL,
    fecha date NOT NULL,
    puesto_id integer,
    client_id integer,
    sede_id integer,
    cliente_nombre character varying(255),
    puesto_nombre character varying(150),
    titular_employee_id integer,
    titular_nombre character varying(255),
    cobertura_employee_id integer,
    cobertura_nombre character varying(255),
    tipo_cobertura character varying(20) DEFAULT 'titular'::character varying NOT NULL,
    motivo character varying(50),
    horas_trabajadas numeric(5,2),
    horas_extra numeric(5,2),
    observaciones text,
    usuario_registro character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cobertura_diaria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cobertura_diaria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cobertura_diaria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cobertura_diaria_id_seq OWNED BY public.cobertura_diaria.id;


--
-- Name: cobertura_segmentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cobertura_segmentos (
    id integer NOT NULL,
    fecha date NOT NULL,
    puesto_id integer,
    client_id integer,
    sede_id integer,
    employee_id integer,
    empleado_nombre character varying(255),
    tipo_cobertura character varying(20) DEFAULT 'relevo'::character varying NOT NULL,
    hora_inicio character varying(5),
    hora_fin character varying(5),
    horas_calculadas numeric(5,2),
    motivo character varying(100),
    fue_en_dia_descanso boolean DEFAULT false NOT NULL,
    genera_horas_extra boolean DEFAULT false NOT NULL,
    observaciones text,
    usuario_registro character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    horas_extra_calculadas numeric(5,2),
    tipo_novedad character varying(60),
    cobertura_alcance character varying(20) DEFAULT 'completo'::character varying,
    cubriendo_a_employee_id integer,
    cubriendo_a_nombre character varying(255),
    es_externo boolean DEFAULT false NOT NULL,
    externo_dpi character varying(20)
);


--
-- Name: cobertura_segmentos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cobertura_segmentos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cobertura_segmentos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cobertura_segmentos_id_seq OWNED BY public.cobertura_segmentos.id;


--
-- Name: config_empresa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.config_empresa (
    id integer NOT NULL,
    representante_legal_id integer,
    direccion_empresa text DEFAULT '14 calle 15-52 zona 1, Barrio Gerona, Ciudad de Guatemala'::text NOT NULL,
    nombre_empresa character varying(255) DEFAULT 'Investigaciones y Seguridad Profesional S.A.'::character varying NOT NULL,
    umbral_dias_consecutivos integer DEFAULT 2 NOT NULL,
    umbral_medios_turnos_mes integer DEFAULT 6 NOT NULL,
    acta_correlativo integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by character varying(100),
    representante_nombre character varying(255),
    representante_dpi character varying(30),
    nit_empresa character varying(30),
    patente_comercio character varying(50),
    telefono_empresa character varying(30),
    representante_fecha_nacimiento date,
    dominio_correo_interno character varying(120) DEFAULT 'ispsa.net'::character varying
);


--
-- Name: config_empresa_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.config_empresa_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: config_empresa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.config_empresa_id_seq OWNED BY public.config_empresa.id;


--
-- Name: config_tarifa_he; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.config_tarifa_he (
    id integer NOT NULL,
    jornada character varying(10) NOT NULL,
    horas_turno integer DEFAULT 12 NOT NULL,
    tarifa numeric(10,2) DEFAULT 150 NOT NULL,
    descripcion character varying(200),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by character varying(100)
);


--
-- Name: config_tarifa_he_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.config_tarifa_he_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: config_tarifa_he_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.config_tarifa_he_id_seq OWNED BY public.config_tarifa_he.id;


--
-- Name: contratos_empleados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contratos_empleados (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    tipo_contrato character varying(50) DEFAULT 'inicial'::character varying NOT NULL,
    etiqueta character varying(100) NOT NULL,
    fecha_contrato date NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date,
    puesto character varying(200),
    sueldo_base numeric(10,2),
    observaciones text,
    generado_automatico boolean DEFAULT false NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contratos_empleados_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contratos_empleados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contratos_empleados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contratos_empleados_id_seq OWNED BY public.contratos_empleados.id;


--
-- Name: custodia_asignacion_diaria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custodia_asignacion_diaria (
    id integer NOT NULL,
    cliente_id integer NOT NULL,
    fecha date NOT NULL,
    employee_id integer,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    slot_numero integer DEFAULT 1,
    ruta_texto text,
    hora_salida time without time zone,
    hora_regreso time without time zone,
    observaciones text,
    registrado_por character varying(100),
    registrado_at timestamp with time zone,
    es_externo boolean DEFAULT false NOT NULL,
    externo_nombre character varying(150),
    externo_dpi character varying(20)
);


--
-- Name: custodia_asignacion_diaria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.custodia_asignacion_diaria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: custodia_asignacion_diaria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.custodia_asignacion_diaria_id_seq OWNED BY public.custodia_asignacion_diaria.id;


--
-- Name: custodia_excepciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custodia_excepciones (
    id integer NOT NULL,
    cliente_id integer NOT NULL,
    fecha date NOT NULL,
    cantidad integer NOT NULL,
    motivo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custodia_excepciones_cantidad_check CHECK ((cantidad >= 0))
);


--
-- Name: custodia_excepciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.custodia_excepciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: custodia_excepciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.custodia_excepciones_id_seq OWNED BY public.custodia_excepciones.id;


--
-- Name: custodia_fuerza_semanal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custodia_fuerza_semanal (
    id integer NOT NULL,
    cliente_id integer NOT NULL,
    dia_semana smallint NOT NULL,
    cantidad_agentes integer DEFAULT 0 NOT NULL,
    CONSTRAINT custodia_fuerza_semanal_dia_semana_check CHECK (((dia_semana >= 0) AND (dia_semana <= 6)))
);


--
-- Name: custodia_fuerza_semanal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.custodia_fuerza_semanal_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: custodia_fuerza_semanal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.custodia_fuerza_semanal_id_seq OWNED BY public.custodia_fuerza_semanal.id;


--
-- Name: custodia_sync_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custodia_sync_log (
    id integer NOT NULL,
    cierre_id integer,
    fecha date NOT NULL,
    tipo_activo text NOT NULL,
    activo_id integer NOT NULL,
    activo_codigo text,
    custodio_anterior_id integer,
    custodio_anterior_nombre text,
    custodio_nuevo_id integer,
    custodio_nuevo_nombre text,
    referencia_nombre text,
    origen text DEFAULT 'cierre_operativo'::text NOT NULL,
    usuario text,
    usuario_id integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custodia_sync_log_tipo_activo_check CHECK ((tipo_activo = ANY (ARRAY['arma'::text, 'vehiculo'::text])))
);


--
-- Name: custodia_sync_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.custodia_sync_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: custodia_sync_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.custodia_sync_log_id_seq OWNED BY public.custodia_sync_log.id;


--
-- Name: custodia_titulares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custodia_titulares (
    id integer NOT NULL,
    cliente_id integer NOT NULL,
    slot_numero integer NOT NULL,
    employee_id integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: custodia_titulares_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.custodia_titulares_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: custodia_titulares_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.custodia_titulares_id_seq OWNED BY public.custodia_titulares.id;


--
-- Name: detalle_lib_sal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.detalle_lib_sal (
    id integer NOT NULL,
    emp_nit character varying(30),
    pla_numero integer,
    empl_numero integer NOT NULL,
    lbl_tpla character varying(10),
    lbl_ano integer NOT NULL,
    lbl_mes integer NOT NULL,
    lbl_pla integer NOT NULL,
    ordinario numeric(12,2) DEFAULT 0 NOT NULL,
    horas_extra numeric(12,2) DEFAULT 0 NOT NULL,
    otros_devengados numeric(12,2) DEFAULT 0 NOT NULL,
    bonificacion numeric(12,2) DEFAULT 0 NOT NULL,
    igss_trabajador numeric(12,2) DEFAULT 0 NOT NULL,
    otras_deducciones numeric(12,2) DEFAULT 0 NOT NULL,
    importado_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: detalle_lib_sal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.detalle_lib_sal_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: detalle_lib_sal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.detalle_lib_sal_id_seq OWNED BY public.detalle_lib_sal.id;


--
-- Name: detalle_prestaciones_odbc; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.detalle_prestaciones_odbc (
    id integer NOT NULL,
    empl_numero integer NOT NULL,
    pre_ano integer NOT NULL,
    pre_mes integer NOT NULL,
    pla_numero integer DEFAULT 1 NOT NULL,
    dias_lab numeric(6,2) DEFAULT 0,
    pro_bono14 numeric(12,4) DEFAULT 0,
    pro_aguinaldo numeric(12,4) DEFAULT 0,
    pro_vacaciones numeric(12,4) DEFAULT 0,
    pro_indemnizacion numeric(12,4) DEFAULT 0,
    base_bono14 numeric(12,2) DEFAULT 0,
    base_aguinaldo numeric(12,2) DEFAULT 0,
    base_vacas numeric(12,2) DEFAULT 0,
    base_indem numeric(12,2) DEFAULT 0,
    importado_at timestamp with time zone DEFAULT now()
);


--
-- Name: detalle_prestaciones_odbc_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.detalle_prestaciones_odbc_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: detalle_prestaciones_odbc_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.detalle_prestaciones_odbc_id_seq OWNED BY public.detalle_prestaciones_odbc.id;


--
-- Name: device_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_reports (
    id integer NOT NULL,
    device_id character varying(100) NOT NULL,
    user_id integer,
    platform character varying(20) DEFAULT 'web'::character varying NOT NULL,
    native_version character varying(50),
    bundle_version character varying(50),
    bundle_id character varying(100),
    device_model character varying(100),
    last_ota_check_at timestamp with time zone,
    last_ota_status character varying(50),
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: device_reports_cleanup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_reports_cleanup (
    id integer NOT NULL,
    run_at timestamp with time zone DEFAULT now() NOT NULL,
    purged_count integer DEFAULT 0 NOT NULL,
    cutoff_days integer NOT NULL
);


--
-- Name: device_reports_cleanup_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.device_reports_cleanup_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: device_reports_cleanup_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.device_reports_cleanup_id_seq OWNED BY public.device_reports_cleanup.id;


--
-- Name: device_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.device_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: device_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.device_reports_id_seq OWNED BY public.device_reports.id;


--
-- Name: dotacion_pendiente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dotacion_pendiente (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    lead_id integer,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dotacion_pendiente_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dotacion_pendiente_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dotacion_pendiente_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dotacion_pendiente_id_seq OWNED BY public.dotacion_pendiente.id;


--
-- Name: dotacion_pendiente_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dotacion_pendiente_items (
    id integer NOT NULL,
    dotacion_id integer NOT NULL,
    articulo_id integer,
    nombre_articulo character varying(200) NOT NULL,
    cantidad integer DEFAULT 1 NOT NULL,
    entregado boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dotacion_pendiente_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dotacion_pendiente_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dotacion_pendiente_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dotacion_pendiente_items_id_seq OWNED BY public.dotacion_pendiente_items.id;


--
-- Name: empleados_periodos_laborales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empleados_periodos_laborales (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    numero_periodo integer NOT NULL,
    fecha_ingreso date NOT NULL,
    fecha_baja date,
    motivo_baja character varying(100),
    liquidacion_id integer,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: empleados_periodos_laborales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.empleados_periodos_laborales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: empleados_periodos_laborales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.empleados_periodos_laborales_id_seq OWNED BY public.empleados_periodos_laborales.id;


--
-- Name: employee_descanso_semanal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_descanso_semanal (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    semana_inicio date NOT NULL,
    dia_descanso character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_descanso_semanal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_descanso_semanal_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_descanso_semanal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_descanso_semanal_id_seq OWNED BY public.employee_descanso_semanal.id;


--
-- Name: employee_operational_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_operational_assignments (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    puesto_id integer,
    sede_id integer,
    cliente_id integer,
    zona_operativa_id integer,
    tipo_turno_id integer,
    tipo_asignacion character varying(30) DEFAULT 'sin_asignacion'::character varying NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    fecha_inicio timestamp with time zone DEFAULT now(),
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_operational_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_operational_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_operational_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_operational_assignments_id_seq OWNED BY public.employee_operational_assignments.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    external_id character varying(100),
    source_system character varying(50) DEFAULT 'manual'::character varying NOT NULL,
    sync_status character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    last_sync_at timestamp with time zone,
    nombre_completo character varying(255) NOT NULL,
    dpi character varying(20),
    telefono character varying(50),
    correo character varying(255),
    puesto character varying(255),
    area character varying(100),
    estado_laboral character varying(50) DEFAULT 'activo'::character varying NOT NULL,
    sede character varying(100),
    supervisor_nombre character varying(255),
    fecha_ingreso timestamp with time zone,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    telefono_secundario character varying(50),
    tipo_servicio character varying(100),
    supervisor_id integer,
    cliente_id integer,
    wa_autorizado boolean DEFAULT false NOT NULL,
    telefono_verificado_at timestamp with time zone,
    limite_anticipo integer,
    tipo_limite_periodo character varying(30) DEFAULT 'quincenal'::character varying,
    ultima_actualizacion_limite_at timestamp with time zone,
    sueldo_base numeric(12,2),
    tipo_jornada character varying(20),
    dia_descanso character varying(20),
    horas_contrato smallint,
    elegible_pool boolean DEFAULT true NOT NULL,
    aplica_igss_general boolean DEFAULT false NOT NULL,
    estado_igss character varying(30) DEFAULT 'no_activo'::character varying NOT NULL,
    fecha_inicio_igss date,
    observaciones_igss text,
    frecuencia_pago character varying(20) DEFAULT 'quincenal'::character varying NOT NULL,
    tipo_personal character varying(30) DEFAULT 'guardia'::character varying NOT NULL,
    fecha_baja date,
    motivo_baja character varying(100),
    fecha_nacimiento date,
    sexo character(1),
    estado_civil character varying(30),
    nit character varying(30),
    direccion text,
    num_dependencias smallint DEFAULT 0 NOT NULL,
    forma_pago character varying(20),
    banco character varying(60),
    cuenta_bancaria character varying(60),
    nivel_educativo character varying(30),
    condicion_laboral character varying(20) DEFAULT 'permanente'::character varying NOT NULL,
    empl_numero integer,
    igss_numero character varying(30),
    depto_codigo_legacy character varying(30),
    bonificacion_incentivo numeric(10,2),
    bonificacion_1 numeric(10,2),
    bonificacion_2 numeric(10,2),
    bonificacion_3 numeric(10,2),
    foto_url text,
    municipio character varying(100),
    departamento character varying(100),
    nombre_contacto_emergencia character varying(200),
    telefono_emergencia character varying(30),
    parentesco_emergencia character varying(60),
    estatura character varying(10),
    peso character varying(10),
    tiene_licencia character varying(3),
    tipo_licencia character varying(30),
    vigencia_licencia character varying(30),
    dpi_frente_url text,
    dpi_reverso_url text,
    habilidades text,
    tiene_vehiculo character varying(3),
    licencia_armas character varying(3),
    disp_rotativo character varying(3),
    disp_nocturno character varying(3),
    disp_fds character varying(3),
    disponible_exterior character varying(3),
    disponibilidad_horario character varying(100),
    lugar_nacimiento character varying(200),
    profesion character varying(100),
    tipo_vivienda character varying(60),
    tiempo_residencia character varying(60),
    renta_mensual character varying(30),
    nombre_padre character varying(200),
    nombre_madre character varying(200),
    nombre_conyuge character varying(200),
    facebook character varying(200),
    instagram character varying(200),
    experiencia_seguridad character varying(3),
    anios_experiencia_seg character varying(10),
    empresa_anterior_seg character varying(200),
    tipos_seguridad text,
    servicio_militar character varying(3),
    rango_militar character varying(60),
    unidad_militar character varying(100),
    fue_policia character varying(3),
    tipo_cuenta character varying(20),
    fecha_inicio_prestaciones date,
    vacaciones_pagadas_hasta date
);


--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: entregas_uniforme; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entregas_uniforme (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    articulo_id integer,
    nombre_articulo character varying(150) DEFAULT 'Uniforme'::character varying NOT NULL,
    tipo_cargo character varying(30) DEFAULT 'cargo_empleado'::character varying NOT NULL,
    cliente_id integer,
    puesto_id integer,
    monto_total numeric(10,2) DEFAULT 0 NOT NULL,
    num_cuotas integer DEFAULT 1 NOT NULL,
    cuotas_pagadas integer DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    notas text,
    registrado_por character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: entregas_uniforme_cuotas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entregas_uniforme_cuotas (
    id integer NOT NULL,
    entrega_id integer NOT NULL,
    num_cuota integer NOT NULL,
    monto numeric(10,2) NOT NULL,
    planilla_id integer,
    descontado boolean DEFAULT false NOT NULL,
    fecha_descuento date,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: entregas_uniforme_cuotas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.entregas_uniforme_cuotas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: entregas_uniforme_cuotas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.entregas_uniforme_cuotas_id_seq OWNED BY public.entregas_uniforme_cuotas.id;


--
-- Name: entregas_uniforme_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.entregas_uniforme_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: entregas_uniforme_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.entregas_uniforme_id_seq OWNED BY public.entregas_uniforme.id;


--
-- Name: eventos_rrhh; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eventos_rrhh (
    id integer NOT NULL,
    employee_id integer,
    employee_nombre character varying(255) NOT NULL,
    employee_dpi character varying(20),
    tipo_evento character varying(50) DEFAULT 'falta'::character varying NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    cliente_nombre character varying(255),
    puesto_nombre character varying(150),
    supervisor_nombre character varying(255),
    generado_desde character varying(50) DEFAULT 'operaciones'::character varying NOT NULL,
    movimiento_id integer,
    estado character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    observaciones text,
    notas text,
    usuario_generador character varying(100),
    documentos_generados jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    anulado_por character varying(100),
    anulado_at timestamp with time zone,
    motivo_anulacion text,
    estado_anterior character varying(30),
    fecha_fin date,
    tipo_resolucion character varying(50),
    afecta_nomina boolean DEFAULT true,
    cantidad_horas numeric(5,2),
    cantidad_dias numeric(5,2),
    afecta_septimo_res boolean DEFAULT false,
    rrhh_resuelto_por character varying(100),
    rrhh_resuelto_at timestamp with time zone,
    impacto_septimo character varying(20) DEFAULT 'pierde'::character varying,
    evento_par_id integer,
    fichaje_origen_id integer,
    numero_acta integer,
    metadata_json jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: eventos_rrhh_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.eventos_rrhh_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: eventos_rrhh_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.eventos_rrhh_id_seq OWNED BY public.eventos_rrhh.id;


--
-- Name: historial_lib_sal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historial_lib_sal (
    id integer NOT NULL,
    emp_nit character varying(30),
    pla_numero integer,
    empl_numero integer NOT NULL,
    lbl_tpla character varying(10),
    lbl_ano integer NOT NULL,
    lbl_mes integer NOT NULL,
    lbl_pla integer NOT NULL,
    lbl_dt numeric(10,2) DEFAULT 0 NOT NULL,
    lbl_dsigss numeric(10,2) DEFAULT 0 NOT NULL,
    lbl_dsemp numeric(10,2) DEFAULT 0 NOT NULL,
    lbl_faltas numeric(10,2) DEFAULT 0 NOT NULL,
    lbl_dvac numeric(10,2) DEFAULT 0 NOT NULL,
    lbl_hrses numeric(10,2) DEFAULT 0 NOT NULL,
    lbl_hrsed numeric(10,2) DEFAULT 0 NOT NULL,
    lbl_hrst numeric(10,2) DEFAULT 0 NOT NULL,
    lbl_tdev numeric(10,2) DEFAULT 0 NOT NULL,
    lbl_tdes numeric(10,2) DEFAULT 0 NOT NULL,
    lbl_liquido numeric(10,2) DEFAULT 0 NOT NULL,
    lbl_bono14 numeric(10,2) DEFAULT 0 NOT NULL,
    lbl_aguinaldo numeric(10,2) DEFAULT 0 NOT NULL,
    lbl_vacaciones numeric(10,2) DEFAULT 0 NOT NULL,
    lbl_indem numeric(10,2) DEFAULT 0 NOT NULL,
    lbl_ordinario numeric(10,2) DEFAULT 0 NOT NULL,
    depto_codigo character varying(10),
    lbl_dsep numeric(10,2) DEFAULT 0 NOT NULL,
    lbl_dasu numeric(10,2) DEFAULT 0 NOT NULL,
    lbl_dsigssa numeric(10,2) DEFAULT 0 NOT NULL,
    importado_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: historial_lib_sal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.historial_lib_sal_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: historial_lib_sal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.historial_lib_sal_id_seq OWNED BY public.historial_lib_sal.id;


--
-- Name: historial_prestaciones_externas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historial_prestaciones_externas (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    tipo character varying(20) NOT NULL,
    anio smallint NOT NULL,
    monto numeric(12,2),
    dias numeric(6,2),
    periodo_completo boolean DEFAULT false NOT NULL,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT historial_prestaciones_externas_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['bono14'::character varying, 'aguinaldo'::character varying, 'vacaciones'::character varying])::text[])))
);


--
-- Name: historial_prestaciones_externas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.historial_prestaciones_externas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: historial_prestaciones_externas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.historial_prestaciones_externas_id_seq OWNED BY public.historial_prestaciones_externas.id;


--
-- Name: igss_config_patrono; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.igss_config_patrono (
    id integer NOT NULL,
    numero_patronal character varying(30),
    nit_patrono character varying(50),
    nombre_comercial character varying(255),
    correo_igss character varying(255),
    codigo_actividad_principal character varying(20),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: igss_config_patrono_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.igss_config_patrono_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: igss_config_patrono_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.igss_config_patrono_id_seq OWNED BY public.igss_config_patrono.id;


--
-- Name: incentivos_cash_cobertura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incentivos_cash_cobertura (
    id integer NOT NULL,
    employee_id integer,
    employee_nombre character varying(200) NOT NULL,
    fecha date NOT NULL,
    cliente_id integer,
    cliente_nombre character varying(200),
    sede_id integer,
    puesto_id integer,
    puesto_nombre character varying(200),
    segmento_id integer,
    tipo character varying(50) NOT NULL,
    monto numeric(10,2) NOT NULL,
    motivo text,
    autorizado_por character varying(100),
    pagado_por character varying(100),
    metodo_pago character varying(50),
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    es_externo boolean DEFAULT false NOT NULL,
    externo_dpi character varying(20)
);


--
-- Name: incentivos_cash_cobertura_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.incentivos_cash_cobertura_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incentivos_cash_cobertura_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.incentivos_cash_cobertura_id_seq OWNED BY public.incentivos_cash_cobertura.id;


--
-- Name: incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidents (
    id character varying(20) NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    origen character varying(50) DEFAULT 'manual'::character varying NOT NULL,
    cliente character varying(255) NOT NULL,
    ubicacion character varying(255),
    tipo character varying(100) NOT NULL,
    prioridad character varying(20) DEFAULT 'media'::character varying NOT NULL,
    estado character varying(50) DEFAULT 'abierta'::character varying NOT NULL,
    responsable character varying(255) DEFAULT 'Sin asignar'::character varying,
    tarea_asociada character varying(50),
    descripcion text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cliente_ref_id character varying(100),
    es_emergencia boolean DEFAULT false NOT NULL,
    reportado_por character varying(255),
    client_id integer,
    responsable_id integer,
    puesto_id integer,
    sede_id integer,
    fecha_cierre timestamp with time zone
);


--
-- Name: kit_ingreso_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kit_ingreso_items (
    id integer NOT NULL,
    articulo_id integer,
    nombre_articulo character varying(200) NOT NULL,
    cantidad integer DEFAULT 1 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: kit_ingreso_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kit_ingreso_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kit_ingreso_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kit_ingreso_items_id_seq OWNED BY public.kit_ingreso_items.id;


--
-- Name: lead_dotacion_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_dotacion_items (
    id integer NOT NULL,
    lead_id integer NOT NULL,
    articulo_id integer,
    nombre_articulo character varying(200) NOT NULL,
    es_equipo_personal boolean DEFAULT false NOT NULL,
    cantidad_por_puesto numeric(8,2) DEFAULT 1 NOT NULL,
    costo_unitario numeric(12,2) DEFAULT 0 NOT NULL,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lead_dotacion_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lead_dotacion_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lead_dotacion_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lead_dotacion_items_id_seq OWNED BY public.lead_dotacion_items.id;


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id integer NOT NULL,
    empresa character varying(255) NOT NULL,
    contacto character varying(255) NOT NULL,
    telefono character varying(50),
    correo character varying(255),
    servicio character varying(255) NOT NULL,
    ubicacion character varying(255),
    canal character varying(50) DEFAULT 'web'::character varying NOT NULL,
    estado character varying(50) DEFAULT 'nuevo'::character varying NOT NULL,
    ejecutivo character varying(255) DEFAULT 'Sin asignar'::character varying,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tarea_asociada character varying(255),
    cliente_id integer,
    num_puestos integer,
    tipo_jornada character varying(30)
);


--
-- Name: leads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leads_id_seq OWNED BY public.leads.id;


--
-- Name: movimientos_operativos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movimientos_operativos (
    id integer NOT NULL,
    puesto_id integer,
    cliente_nombre character varying(255),
    puesto_nombre character varying(150),
    agente_saliente_id integer,
    agente_saliente_nombre character varying(255),
    agente_entrante_id integer,
    agente_entrante_nombre character varying(255),
    tipo character varying(30) DEFAULT 'asignacion'::character varying NOT NULL,
    motivo character varying(50),
    usuario_cambio character varying(100),
    notas text,
    fecha_hora timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: movimientos_operativos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.movimientos_operativos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: movimientos_operativos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.movimientos_operativos_id_seq OWNED BY public.movimientos_operativos.id;


--
-- Name: nfc_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nfc_audit_log (
    id integer NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id integer,
    action character varying(50) NOT NULL,
    actor character varying(100),
    meta jsonb,
    sandbox_mode boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: nfc_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nfc_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nfc_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nfc_audit_log_id_seq OWNED BY public.nfc_audit_log.id;


--
-- Name: nfc_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nfc_devices (
    id integer NOT NULL,
    device_code character varying(60) NOT NULL,
    device_name character varying(150) NOT NULL,
    puesto_id_ref integer,
    cliente_id_ref integer,
    sede_id_ref integer,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    sandbox_mode boolean DEFAULT true NOT NULL,
    last_seen_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    device_uuid text,
    device_token_hash text,
    enrolled_at timestamp with time zone,
    revoked_at timestamp with time zone
);


--
-- Name: nfc_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nfc_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nfc_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nfc_devices_id_seq OWNED BY public.nfc_devices.id;


--
-- Name: nfc_ronda_eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nfc_ronda_eventos (
    id integer NOT NULL,
    ronda_punto_id integer NOT NULL,
    device_id integer,
    escaneado_en timestamp with time zone DEFAULT now() NOT NULL,
    numero_ronda integer DEFAULT 1 NOT NULL,
    latitud numeric(10,7),
    longitud numeric(10,7),
    precision_metros integer,
    sandbox_mode boolean DEFAULT true NOT NULL
);


--
-- Name: nfc_ronda_eventos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nfc_ronda_eventos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nfc_ronda_eventos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nfc_ronda_eventos_id_seq OWNED BY public.nfc_ronda_eventos.id;


--
-- Name: nfc_ronda_puntos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nfc_ronda_puntos (
    id integer NOT NULL,
    cliente_id integer,
    puesto_id integer,
    nombre text NOT NULL,
    descripcion text,
    tag_uid text NOT NULL,
    orden integer DEFAULT 1 NOT NULL,
    latitud_ref numeric(10,7),
    longitud_ref numeric(10,7),
    activo boolean DEFAULT true NOT NULL,
    sandbox_mode boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: nfc_ronda_puntos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nfc_ronda_puntos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nfc_ronda_puntos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nfc_ronda_puntos_id_seq OWNED BY public.nfc_ronda_puntos.id;


--
-- Name: nfc_sandbox_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nfc_sandbox_schedules (
    id integer NOT NULL,
    device_id integer,
    puesto_id_ref integer,
    empleado_id_ref integer,
    dia_semana integer,
    hora_inicio time without time zone NOT NULL,
    hora_fin time without time zone NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: nfc_sandbox_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nfc_sandbox_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nfc_sandbox_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nfc_sandbox_schedules_id_seq OWNED BY public.nfc_sandbox_schedules.id;


--
-- Name: nfc_shift_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nfc_shift_events (
    id integer NOT NULL,
    tag_id integer,
    empleado_id_ref integer,
    device_id integer,
    puesto_id_ref integer,
    event_type character varying(30) DEFAULT 'INICIO_TURNO'::character varying NOT NULL,
    scheduled_status character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    validation_status character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    photo_path character varying(500),
    notes text,
    sandbox_mode boolean DEFAULT true NOT NULL,
    event_at timestamp with time zone DEFAULT now() NOT NULL,
    validated_by character varying(100),
    validated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    latitud numeric(10,7),
    longitud numeric(10,7),
    precision_metros integer
);


--
-- Name: nfc_shift_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nfc_shift_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nfc_shift_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nfc_shift_events_id_seq OWNED BY public.nfc_shift_events.id;


--
-- Name: nfc_supervisor_form_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nfc_supervisor_form_items (
    id integer NOT NULL,
    form_id integer NOT NULL,
    item_type character varying(30) NOT NULL,
    item_name character varying(100) NOT NULL,
    item_status character varying(20) DEFAULT 'ok'::character varying NOT NULL,
    item_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: nfc_supervisor_form_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nfc_supervisor_form_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nfc_supervisor_form_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nfc_supervisor_form_items_id_seq OWNED BY public.nfc_supervisor_form_items.id;


--
-- Name: nfc_supervisor_forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nfc_supervisor_forms (
    id integer NOT NULL,
    supervisor_tag_id integer,
    supervisor_id_ref integer,
    device_id integer,
    puesto_id_ref integer,
    agente_id_ref integer,
    arma_estado character varying(30) DEFAULT 'sin_novedad'::character varying NOT NULL,
    uniforme_estado character varying(30) DEFAULT 'completo'::character varying NOT NULL,
    puesto_estado character varying(30) DEFAULT 'sin_novedad'::character varying NOT NULL,
    agente_estado character varying(30) DEFAULT 'presente'::character varying NOT NULL,
    observaciones text,
    photo_path character varying(500),
    form_status character varying(20) DEFAULT 'borrador'::character varying NOT NULL,
    sandbox_mode boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    latitud numeric(10,7),
    longitud numeric(10,7),
    precision_metros integer
);


--
-- Name: nfc_supervisor_forms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nfc_supervisor_forms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nfc_supervisor_forms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nfc_supervisor_forms_id_seq OWNED BY public.nfc_supervisor_forms.id;


--
-- Name: nfc_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nfc_tags (
    id integer NOT NULL,
    tag_uid character varying(100) NOT NULL,
    profile_type character varying(20) DEFAULT 'AGENTE'::character varying NOT NULL,
    empleado_id_ref integer,
    alias character varying(100),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    sandbox_mode boolean DEFAULT true NOT NULL,
    issued_at date,
    revoked_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: nfc_tags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nfc_tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nfc_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nfc_tags_id_seq OWNED BY public.nfc_tags.id;


--
-- Name: nomina_feriado_pago; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nomina_feriado_pago (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    periodo_desde date NOT NULL,
    periodo_hasta date NOT NULL,
    feriado_fecha date NOT NULL,
    monto numeric(12,2) DEFAULT 0 NOT NULL,
    editado_por character varying(100),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: nomina_feriado_pago_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nomina_feriado_pago_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nomina_feriado_pago_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nomina_feriado_pago_id_seq OWNED BY public.nomina_feriado_pago.id;


--
-- Name: nomina_feriados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nomina_feriados (
    id integer NOT NULL,
    fecha date NOT NULL,
    nombre character varying(120) NOT NULL,
    tipo character varying(20) DEFAULT 'nacional'::character varying NOT NULL,
    cliente_nombre character varying(200),
    activo boolean DEFAULT true NOT NULL,
    created_por character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: nomina_feriados_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nomina_feriados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nomina_feriados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nomina_feriados_id_seq OWNED BY public.nomina_feriados.id;


--
-- Name: novedades_nomina_diarias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.novedades_nomina_diarias (
    id integer NOT NULL,
    fecha date NOT NULL,
    employee_id integer,
    empleado_nombre character varying(255),
    trabajo_dia boolean DEFAULT false NOT NULL,
    horas_trabajadas numeric(5,2) DEFAULT 0 NOT NULL,
    horas_extra numeric(5,2) DEFAULT 0 NOT NULL,
    falta boolean DEFAULT false NOT NULL,
    suspension boolean DEFAULT false NOT NULL,
    descanso_trabajado boolean DEFAULT false NOT NULL,
    afecta_septimo boolean DEFAULT false NOT NULL,
    descuento_dia boolean DEFAULT false NOT NULL,
    puesto_titular_id integer,
    puesto_titular_nombre character varying(255),
    puesto_cubierto_id integer,
    puesto_cubierto_nombre character varying(255),
    num_puestos_cubiertos integer DEFAULT 0 NOT NULL,
    observaciones text,
    fuente character varying(50) DEFAULT 'cierre_operativo'::character varying NOT NULL,
    cierre_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tipo_turno_id integer,
    horas_esperadas numeric(6,2),
    trabajo_esperado boolean,
    tipo_novedad character varying(60),
    impacto_nomina character varying(30),
    requiere_revision_rrhh boolean DEFAULT false,
    evento_rrhh_id integer,
    dias_descuento numeric(5,2),
    horas_extra_estado character varying(20) DEFAULT 'pendiente'::character varying,
    horas_extra_aprobadas_por character varying(100),
    horas_extra_aprobadas_at timestamp with time zone
);


--
-- Name: novedades_nomina_diarias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.novedades_nomina_diarias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: novedades_nomina_diarias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.novedades_nomina_diarias_id_seq OWNED BY public.novedades_nomina_diarias.id;


--
-- Name: operational_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operational_zones (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    supervisor_employee_id integer,
    supervisor_user_id integer,
    estado character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: operational_zones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.operational_zones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: operational_zones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.operational_zones_id_seq OWNED BY public.operational_zones.id;


--
-- Name: ordenes_compra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordenes_compra (
    id integer NOT NULL,
    lead_id integer,
    cliente_id integer,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    notas text,
    created_by character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ordenes_compra_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ordenes_compra_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ordenes_compra_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ordenes_compra_id_seq OWNED BY public.ordenes_compra.id;


--
-- Name: ordenes_compra_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordenes_compra_items (
    id integer NOT NULL,
    orden_id integer NOT NULL,
    articulo_id integer,
    nombre_articulo character varying(200) NOT NULL,
    cantidad integer DEFAULT 1 NOT NULL,
    costo_unitario numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ordenes_compra_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ordenes_compra_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ordenes_compra_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ordenes_compra_items_id_seq OWNED BY public.ordenes_compra_items.id;


--
-- Name: page_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.page_content (
    page_key character varying(80) NOT NULL,
    content_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    seo_title character varying(255),
    seo_description text,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    updated_by character varying(100),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permisos_ruta_rol; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permisos_ruta_rol (
    id integer NOT NULL,
    rol character varying(30) NOT NULL,
    path character varying(255) NOT NULL
);


--
-- Name: permisos_ruta_rol_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permisos_ruta_rol_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permisos_ruta_rol_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permisos_ruta_rol_id_seq OWNED BY public.permisos_ruta_rol.id;


--
-- Name: personal_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personal_slots (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    tipo character varying(20) DEFAULT 'supervisor'::character varying NOT NULL,
    slot_numero integer DEFAULT 1 NOT NULL,
    horas_turno integer DEFAULT 8 NOT NULL,
    hora_entrada time without time zone DEFAULT '07:00:00'::time without time zone NOT NULL,
    hora_entrada_por_semana text[],
    dias_trabajo integer[] DEFAULT '{1,2,3,4,5}'::integer[] NOT NULL,
    dias_medio_turno integer[] DEFAULT '{}'::integer[] NOT NULL,
    longitud_ciclo smallint DEFAULT 7 NOT NULL,
    fecha_inicio_ciclo date,
    notas text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT personal_slots_tipo_chk CHECK (((tipo)::text = ANY ((ARRAY['supervisor'::character varying, 'administrativo'::character varying])::text[])))
);


--
-- Name: personal_slots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.personal_slots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: personal_slots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.personal_slots_id_seq OWNED BY public.personal_slots.id;


--
-- Name: phone_auth_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phone_auth_log (
    id integer NOT NULL,
    user_id integer,
    empleado_id integer DEFAULT 0 NOT NULL,
    dpi character varying(20),
    numero_anterior character varying(50),
    numero_nuevo character varying(50) NOT NULL,
    accion character varying(30) NOT NULL,
    metodo_validacion character varying(20) DEFAULT 'dpi'::character varying NOT NULL,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: phone_auth_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.phone_auth_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: phone_auth_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.phone_auth_log_id_seq OWNED BY public.phone_auth_log.id;


--
-- Name: planificacion_futura; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planificacion_futura (
    id integer NOT NULL,
    fecha date NOT NULL,
    puesto_id integer,
    tipo_evento text DEFAULT 'ausencia'::text NOT NULL,
    tipo_ausencia text,
    titular_ausente_id integer,
    relevo_id integer,
    motivo text,
    notas text,
    estado text DEFAULT 'programado'::text NOT NULL,
    fuente text DEFAULT 'operaciones'::text NOT NULL,
    creado_por text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    ssa_id character varying(30),
    tipo_cobertura_futura text DEFAULT 'relevo_ausencia'::text NOT NULL
);


--
-- Name: planificacion_futura_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.planificacion_futura_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: planificacion_futura_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.planificacion_futura_id_seq OWNED BY public.planificacion_futura.id;


--
-- Name: planilla_lineas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planilla_lineas (
    id integer NOT NULL,
    planilla_id integer NOT NULL,
    employee_id integer,
    nombre_completo character varying(200) NOT NULL,
    dpi character varying(20),
    puesto character varying(200),
    sede character varying(200),
    cliente character varying(200),
    tipo_jornada character varying(50),
    horas_contrato numeric(5,1),
    sueldo_base numeric(10,2) DEFAULT 0 NOT NULL,
    periodo_dias integer DEFAULT 0 NOT NULL,
    dias_trabajados integer DEFAULT 0 NOT NULL,
    faltas integer DEFAULT 0 NOT NULL,
    suspensiones integer DEFAULT 0 NOT NULL,
    horas_trabajadas numeric(8,2) DEFAULT 0 NOT NULL,
    horas_extra numeric(8,2) DEFAULT 0 NOT NULL,
    sueldo_periodo numeric(10,2) DEFAULT 0 NOT NULL,
    desc_faltas numeric(10,2) DEFAULT 0 NOT NULL,
    valor_he numeric(10,2) DEFAULT 0 NOT NULL,
    total_bruto numeric(10,2) DEFAULT 0 NOT NULL,
    anticipos numeric(10,2) DEFAULT 0 NOT NULL,
    total_neto numeric(10,2) DEFAULT 0 NOT NULL,
    revision_estado character varying(30),
    observaciones_rrhh text,
    frecuencia_pago character varying(20) DEFAULT 'quincenal'::character varying NOT NULL,
    aplica_igss boolean DEFAULT false NOT NULL,
    motivo_exclusion_igss text,
    anticipo_ids jsonb DEFAULT '[]'::jsonb,
    novedad_ids jsonb DEFAULT '[]'::jsonb,
    segmento_ids jsonb DEFAULT '[]'::jsonb,
    igss_trabajador numeric(10,2) DEFAULT 0 NOT NULL,
    igss_patronal numeric(10,2) DEFAULT 0 NOT NULL,
    otros_descuentos numeric(10,2) DEFAULT 0 NOT NULL,
    otros_descuentos_detalle text,
    desc_septimo numeric(10,2) DEFAULT 0,
    bonificacion_incentivo numeric(10,2) DEFAULT 0 NOT NULL,
    descuentos_uniforme numeric(10,2) DEFAULT 0 NOT NULL,
    uniforme_cuota_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    isr numeric DEFAULT 0,
    bonificacion_1 numeric(10,2) DEFAULT 0,
    bonificacion_2 numeric(10,2) DEFAULT 0,
    bonificacion_3 numeric(10,2) DEFAULT 0,
    descuento_barraca numeric(10,2) DEFAULT 0 NOT NULL,
    descuento_seguro_vida numeric(10,2) DEFAULT 0 NOT NULL,
    pago_feriados numeric(10,2) DEFAULT 0 NOT NULL,
    dias_vacaciones integer DEFAULT 0 NOT NULL
);


--
-- Name: planilla_lineas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.planilla_lineas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: planilla_lineas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.planilla_lineas_id_seq OWNED BY public.planilla_lineas.id;


--
-- Name: planillas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planillas (
    id integer NOT NULL,
    periodo_desde date NOT NULL,
    periodo_hasta date NOT NULL,
    cierre_id integer NOT NULL,
    fecha_generacion timestamp with time zone DEFAULT now() NOT NULL,
    generado_por character varying(100) NOT NULL,
    estado character varying(20) DEFAULT 'borrador'::character varying NOT NULL,
    observaciones text,
    total_colaboradores integer DEFAULT 0 NOT NULL,
    total_sueldo_periodo numeric(12,2) DEFAULT 0 NOT NULL,
    total_desc_faltas numeric(12,2) DEFAULT 0 NOT NULL,
    total_valor_he numeric(12,2) DEFAULT 0 NOT NULL,
    total_bruto numeric(12,2) DEFAULT 0 NOT NULL,
    total_anticipos numeric(12,2) DEFAULT 0 NOT NULL,
    total_neto numeric(12,2) DEFAULT 0 NOT NULL,
    anulada boolean DEFAULT false NOT NULL,
    anulada_por character varying(100),
    anulada_at timestamp with time zone,
    total_desc_septimo numeric(12,2) DEFAULT 0,
    total_igss_trabajador numeric(12,2) DEFAULT 0 NOT NULL,
    total_igss_patronal numeric(12,2) DEFAULT 0 NOT NULL,
    total_bonificacion_incentivo numeric(12,2) DEFAULT 0 NOT NULL,
    total_isr numeric DEFAULT 0
);


--
-- Name: planillas_especiales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planillas_especiales (
    id integer NOT NULL,
    tipo character varying(20) NOT NULL,
    anio integer NOT NULL,
    periodo_inicio date NOT NULL,
    periodo_fin date NOT NULL,
    num_pagos integer DEFAULT 1 NOT NULL,
    estado character varying(20) DEFAULT 'borrador'::character varying NOT NULL,
    total_colaboradores integer DEFAULT 0 NOT NULL,
    total_bruto numeric(14,2) DEFAULT 0 NOT NULL,
    generado_por text,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT planillas_especiales_estado_check CHECK (((estado)::text = ANY ((ARRAY['borrador'::character varying, 'aprobada'::character varying, 'completada'::character varying, 'anulada'::character varying])::text[]))),
    CONSTRAINT planillas_especiales_num_pagos_check CHECK (((num_pagos >= 1) AND (num_pagos <= 3))),
    CONSTRAINT planillas_especiales_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['bono14'::character varying, 'aguinaldo'::character varying])::text[])))
);


--
-- Name: planillas_especiales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.planillas_especiales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: planillas_especiales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.planillas_especiales_id_seq OWNED BY public.planillas_especiales.id;


--
-- Name: planillas_especiales_lineas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planillas_especiales_lineas (
    id integer NOT NULL,
    planilla_especial_id integer NOT NULL,
    employee_id integer,
    nombre_completo text NOT NULL,
    puesto text,
    sede text,
    cliente text,
    fecha_ingreso date NOT NULL,
    fecha_egreso_emp date,
    dias_periodo_total integer NOT NULL,
    dias_laborados integer NOT NULL,
    salario_referencia numeric(12,2) NOT NULL,
    monto_total numeric(12,2) NOT NULL,
    monto_ya_pagado numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    fuente_dias character varying(20) DEFAULT 'calendario'::character varying NOT NULL
);


--
-- Name: planillas_especiales_lineas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.planillas_especiales_lineas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: planillas_especiales_lineas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.planillas_especiales_lineas_id_seq OWNED BY public.planillas_especiales_lineas.id;


--
-- Name: planillas_especiales_pagos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planillas_especiales_pagos (
    id integer NOT NULL,
    planilla_especial_id integer NOT NULL,
    numero_pago integer NOT NULL,
    porcentaje numeric(6,2) NOT NULL,
    fecha_programada date,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    total_este_pago numeric(14,2) DEFAULT 0 NOT NULL,
    pagado_por text,
    pagado_at timestamp with time zone,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT planillas_especiales_pagos_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'pagado'::character varying])::text[]))),
    CONSTRAINT planillas_especiales_pagos_numero_pago_check CHECK ((numero_pago >= 1)),
    CONSTRAINT planillas_especiales_pagos_porcentaje_check CHECK (((porcentaje > (0)::numeric) AND (porcentaje <= (100)::numeric)))
);


--
-- Name: planillas_especiales_pagos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.planillas_especiales_pagos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: planillas_especiales_pagos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.planillas_especiales_pagos_id_seq OWNED BY public.planillas_especiales_pagos.id;


--
-- Name: planillas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.planillas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: planillas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.planillas_id_seq OWNED BY public.planillas.id;


--
-- Name: plantillas_contrato; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plantillas_contrato (
    id integer NOT NULL,
    tipo character varying(32) NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    activa boolean DEFAULT false NOT NULL,
    titulo character varying(255) DEFAULT 'CONTRATO INDIVIDUAL DE TRABAJO'::character varying NOT NULL,
    subtitulo character varying(255),
    encabezado text NOT NULL,
    clausulas text NOT NULL,
    cierre text NOT NULL,
    notas text,
    created_by character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plantillas_contrato_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plantillas_contrato_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plantillas_contrato_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plantillas_contrato_id_seq OWNED BY public.plantillas_contrato.id;


--
-- Name: position_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.position_aliases (
    id integer NOT NULL,
    puesto_id integer NOT NULL,
    alias character varying(255) NOT NULL,
    tipo_alias character varying(50) DEFAULT 'comun'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: position_aliases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.position_aliases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: position_aliases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.position_aliases_id_seq OWNED BY public.position_aliases.id;


--
-- Name: pre_planilla_auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pre_planilla_auditoria (
    id integer NOT NULL,
    periodo_desde date NOT NULL,
    periodo_hasta date NOT NULL,
    employee_id integer,
    accion character varying(50) NOT NULL,
    usuario character varying(100) NOT NULL,
    observaciones text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pre_planilla_auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pre_planilla_auditoria_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pre_planilla_auditoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pre_planilla_auditoria_id_seq OWNED BY public.pre_planilla_auditoria.id;


--
-- Name: pre_planilla_cierres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pre_planilla_cierres (
    id integer NOT NULL,
    periodo_desde date NOT NULL,
    periodo_hasta date NOT NULL,
    cerrado_por character varying(100) NOT NULL,
    cerrado_at timestamp with time zone DEFAULT now() NOT NULL,
    observaciones text,
    snapshot jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_colaboradores integer DEFAULT 0 NOT NULL,
    total_estimado numeric(12,2) DEFAULT 0 NOT NULL,
    anulado boolean DEFAULT false NOT NULL,
    anulado_por character varying(100),
    anulado_at timestamp with time zone
);


--
-- Name: pre_planilla_cierres_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pre_planilla_cierres_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pre_planilla_cierres_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pre_planilla_cierres_id_seq OWNED BY public.pre_planilla_cierres.id;


--
-- Name: pre_planilla_dias_anticipados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pre_planilla_dias_anticipados (
    id integer NOT NULL,
    cierre_id integer,
    periodo_desde date NOT NULL,
    periodo_hasta date NOT NULL,
    fecha date NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    reconciliado_periodo_desde date,
    reconciliado_periodo_hasta date,
    reconciliado_cierre_id integer,
    reconciliado_at timestamp with time zone,
    dias_descuento_aplicados numeric(6,2) DEFAULT 0 NOT NULL,
    empleados_afectados integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pre_planilla_dias_anticipados_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pre_planilla_dias_anticipados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pre_planilla_dias_anticipados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pre_planilla_dias_anticipados_id_seq OWNED BY public.pre_planilla_dias_anticipados.id;


--
-- Name: pre_planilla_revision; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pre_planilla_revision (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    periodo_desde date NOT NULL,
    periodo_hasta date NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    observaciones text,
    revisado_por character varying(100),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    aprobado_por character varying(100),
    aprobado_at timestamp with time zone,
    periodo_cerrado boolean DEFAULT false NOT NULL
);


--
-- Name: pre_planilla_revision_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pre_planilla_revision_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pre_planilla_revision_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pre_planilla_revision_id_seq OWNED BY public.pre_planilla_revision.id;


--
-- Name: prestaciones_acumulados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prestaciones_acumulados (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    tipo character varying(30) NOT NULL,
    anio integer NOT NULL,
    dias_acumulados numeric(10,4) DEFAULT 0 NOT NULL,
    monto_acumulado numeric(12,2) DEFAULT 0 NOT NULL,
    monto_pagado numeric(12,2) DEFAULT 0 NOT NULL,
    monto_pendiente numeric(12,2) DEFAULT 0 NOT NULL
);


--
-- Name: prestaciones_acumulados_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prestaciones_acumulados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prestaciones_acumulados_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prestaciones_acumulados_id_seq OWNED BY public.prestaciones_acumulados.id;


--
-- Name: prestaciones_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prestaciones_config (
    id integer NOT NULL,
    client_id integer,
    aguinaldo_base character varying(30) DEFAULT 'salario_actual'::character varying NOT NULL,
    bono14_base character varying(30) DEFAULT 'promedio_periodo'::character varying NOT NULL,
    vacaciones_dias_primer_anio integer DEFAULT 15 NOT NULL,
    vacaciones_dias_quinquenio integer DEFAULT 20 NOT NULL,
    vacaciones_dias_elegibilidad integer DEFAULT 150 NOT NULL,
    indemnizacion_solo_legal boolean DEFAULT true NOT NULL,
    redondeo_decimales integer DEFAULT 2 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: prestaciones_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prestaciones_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prestaciones_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prestaciones_config_id_seq OWNED BY public.prestaciones_config.id;


--
-- Name: prestaciones_liquidacion_detalle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prestaciones_liquidacion_detalle (
    id integer NOT NULL,
    liquidacion_id integer NOT NULL,
    rubro character varying(40) NOT NULL,
    descripcion text,
    periodo_inicio date,
    periodo_fin date,
    dias_base numeric(10,4),
    salario_referencia numeric(12,2),
    monto numeric(12,2) NOT NULL,
    base_calculo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    monto_original numeric(12,2)
);


--
-- Name: prestaciones_liquidacion_detalle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prestaciones_liquidacion_detalle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prestaciones_liquidacion_detalle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prestaciones_liquidacion_detalle_id_seq OWNED BY public.prestaciones_liquidacion_detalle.id;


--
-- Name: prestaciones_liquidacion_ediciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prestaciones_liquidacion_ediciones (
    id integer NOT NULL,
    liquidacion_id integer NOT NULL,
    detalle_id integer,
    rubro character varying(40),
    monto_anterior numeric(12,2),
    monto_nuevo numeric(12,2),
    motivo text,
    editado_por text,
    editado_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: prestaciones_liquidacion_ediciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prestaciones_liquidacion_ediciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prestaciones_liquidacion_ediciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prestaciones_liquidacion_ediciones_id_seq OWNED BY public.prestaciones_liquidacion_ediciones.id;


--
-- Name: prestaciones_liquidaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prestaciones_liquidaciones (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    empleado_nombre text,
    fecha_egreso date NOT NULL,
    causal_egreso character varying(40) NOT NULL,
    fecha_ingreso date NOT NULL,
    anios_servicio numeric(10,4),
    dias_servicio integer,
    salario_actual numeric(12,2),
    promedio_salario numeric(12,2),
    total_salario_pendiente numeric(12,2) DEFAULT 0 NOT NULL,
    total_vacaciones numeric(12,2) DEFAULT 0 NOT NULL,
    total_aguinaldo numeric(12,2) DEFAULT 0 NOT NULL,
    total_bono14 numeric(12,2) DEFAULT 0 NOT NULL,
    total_indemnizacion numeric(12,2) DEFAULT 0 NOT NULL,
    total_otros numeric(12,2) DEFAULT 0 NOT NULL,
    total_general numeric(12,2) DEFAULT 0 NOT NULL,
    estado character varying(20) DEFAULT 'confirmada'::character varying NOT NULL,
    simulacion boolean DEFAULT false NOT NULL,
    observaciones text,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    editado boolean DEFAULT false NOT NULL,
    editado_por text,
    editado_at timestamp with time zone
);


--
-- Name: prestaciones_liquidaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prestaciones_liquidaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prestaciones_liquidaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prestaciones_liquidaciones_id_seq OWNED BY public.prestaciones_liquidaciones.id;


--
-- Name: prestaciones_movimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prestaciones_movimientos (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    empleado_nombre text,
    tipo_prestacion character varying(30) NOT NULL,
    subtipo character varying(30),
    periodo_inicio date,
    periodo_fin date,
    fecha_calculo date DEFAULT CURRENT_DATE NOT NULL,
    base_calculo text,
    monto numeric(12,2) NOT NULL,
    dias_base numeric(10,4),
    dias_aplicados numeric(10,4),
    salario_referencia numeric(12,2),
    promedio_referencia numeric(12,2),
    origen character varying(60),
    referencia_origen_id integer,
    observaciones text,
    version_calculo integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: prestaciones_movimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prestaciones_movimientos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prestaciones_movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prestaciones_movimientos_id_seq OWNED BY public.prestaciones_movimientos.id;


--
-- Name: prestaciones_provisiones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prestaciones_provisiones (
    id integer NOT NULL,
    periodo_desde date NOT NULL,
    periodo_hasta date NOT NULL,
    tipo character varying(30) NOT NULL,
    employee_id integer NOT NULL,
    empleado_nombre text,
    sede text,
    puesto text,
    client_id integer,
    dias_periodo numeric(10,4),
    salario_referencia numeric(12,2),
    monto_provision numeric(12,2) NOT NULL,
    observaciones text,
    generado_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: prestaciones_provisiones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prestaciones_provisiones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prestaciones_provisiones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prestaciones_provisiones_id_seq OWNED BY public.prestaciones_provisiones.id;


--
-- Name: puesto_municion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.puesto_municion (
    id integer NOT NULL,
    puesto_id integer NOT NULL,
    descripcion character varying(120) DEFAULT '9mm Luger'::character varying NOT NULL,
    cantidad_asignada integer DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: puesto_municion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.puesto_municion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: puesto_municion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.puesto_municion_id_seq OWNED BY public.puesto_municion.id;


--
-- Name: puesto_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.puesto_slots (
    id integer NOT NULL,
    puesto_id integer NOT NULL,
    slot_numero integer DEFAULT 1 NOT NULL,
    horas_turno integer DEFAULT 24 NOT NULL,
    hora_entrada time without time zone DEFAULT '07:00:00'::time without time zone NOT NULL,
    dias_trabajo integer[] DEFAULT '{1,2,3,4,5,6,7}'::integer[] NOT NULL,
    empleado_id integer,
    notas text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    longitud_ciclo smallint DEFAULT 14 NOT NULL,
    fecha_inicio_ciclo date,
    dias_medio_turno integer[] DEFAULT '{}'::integer[] NOT NULL,
    hora_entrada_por_semana text[],
    hora_entrada_por_dia jsonb
);


--
-- Name: puesto_slots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.puesto_slots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: puesto_slots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.puesto_slots_id_seq OWNED BY public.puesto_slots.id;


--
-- Name: puesto_titular_historico; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.puesto_titular_historico (
    id integer NOT NULL,
    puesto_id integer NOT NULL,
    employee_id integer NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date,
    motivo character varying(120),
    creado_por character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: puesto_titular_historico_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.puesto_titular_historico_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: puesto_titular_historico_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.puesto_titular_historico_id_seq OWNED BY public.puesto_titular_historico.id;


--
-- Name: puesto_titulares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.puesto_titulares (
    id integer NOT NULL,
    puesto_id integer NOT NULL,
    employee_id integer NOT NULL,
    orden smallint DEFAULT 1 NOT NULL,
    fecha_inicio_ciclo date,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: puesto_titulares_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.puesto_titulares_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: puesto_titulares_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.puesto_titulares_id_seq OWNED BY public.puesto_titulares.id;


--
-- Name: puestos_gps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.puestos_gps (
    id integer NOT NULL,
    puesto_id integer NOT NULL,
    latitud numeric(10,7) NOT NULL,
    longitud numeric(10,7) NOT NULL,
    radio_metros integer DEFAULT 50 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: puestos_gps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.puestos_gps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: puestos_gps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.puestos_gps_id_seq OWNED BY public.puestos_gps.id;


--
-- Name: puestos_operativos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.puestos_operativos (
    id integer NOT NULL,
    cliente_id integer,
    cliente_nombre character varying(255) DEFAULT ''::character varying NOT NULL,
    nombre character varying(150) NOT NULL,
    turno character varying(20) DEFAULT 'día'::character varying,
    agente_id integer,
    agente_nombre character varying(255),
    estado character varying(30) DEFAULT 'descubierto'::character varying NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sede_id integer,
    titular_employee_id integer,
    titular_nombre character varying(255),
    horario character varying(100),
    jornada character varying(30),
    costo_hora numeric(10,2),
    cantidad_contratada smallint DEFAULT 1,
    tarifa_puesto numeric(12,2),
    hora_entrada character varying(5),
    hora_salida character varying(5),
    descanso_inicio character varying(5),
    descanso_fin character varying(5),
    elegible_horas_extra boolean DEFAULT false,
    tipo_servicio character varying(50),
    zona_operativa_id integer,
    tipo_turno_id integer,
    fecha_inicio_ciclo date,
    aplica_igss boolean DEFAULT false NOT NULL,
    regimen_igss character varying(30) DEFAULT 'no_aplica'::character varying NOT NULL,
    notas_igss text,
    estado_operativo_puesto character varying(50) DEFAULT 'normal'::character varying,
    tipo_puesto character varying(20) DEFAULT 'normal'::character varying NOT NULL,
    salario_puesto numeric(12,2),
    novedad text,
    direccion text,
    falta_employee_id integer,
    falta_motivo character varying(100),
    falta_notas text,
    falta_usuario character varying(100),
    CONSTRAINT chk_tipo_puesto CHECK (((tipo_puesto)::text = ANY ((ARRAY['normal'::character varying, 'custodia'::character varying])::text[])))
);


--
-- Name: puestos_operativos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.puestos_operativos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: puestos_operativos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.puestos_operativos_id_seq OWNED BY public.puestos_operativos.id;


--
-- Name: push_envios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_envios (
    id integer NOT NULL,
    user_id integer,
    token_preview character varying(64),
    title character varying(200) NOT NULL,
    body character varying(500) NOT NULL,
    evento character varying(50) DEFAULT 'manual'::character varying NOT NULL,
    estado character varying(20) NOT NULL,
    error_code character varying(100),
    error_message text,
    message_id character varying(255),
    data text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: push_envios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.push_envios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: push_envios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.push_envios_id_seq OWNED BY public.push_envios.id;


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_tokens (
    id integer NOT NULL,
    token character varying(512) NOT NULL,
    user_id integer NOT NULL,
    platform character varying(20) DEFAULT 'android'::character varying NOT NULL,
    app_version character varying(50),
    device_model character varying(100),
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: push_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.push_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: push_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.push_tokens_id_seq OWNED BY public.push_tokens.id;


--
-- Name: qr_ronda_eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qr_ronda_eventos (
    id integer NOT NULL,
    punto_id integer NOT NULL,
    user_id integer,
    escaneado_en timestamp with time zone DEFAULT now() NOT NULL,
    latitud numeric(10,7),
    longitud numeric(10,7),
    precision_metros integer,
    distancia_metros integer,
    resultado character varying(20) DEFAULT 'ok'::character varying NOT NULL,
    notas text,
    employee_id integer
);


--
-- Name: qr_ronda_eventos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.qr_ronda_eventos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: qr_ronda_eventos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.qr_ronda_eventos_id_seq OWNED BY public.qr_ronda_eventos.id;


--
-- Name: qr_ronda_puntos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qr_ronda_puntos (
    id integer NOT NULL,
    ronda_id integer NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    qr_token text NOT NULL,
    latitud_ref numeric(10,7) NOT NULL,
    longitud_ref numeric(10,7) NOT NULL,
    radio_metros integer DEFAULT 30 NOT NULL,
    orden integer DEFAULT 1 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: qr_ronda_puntos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.qr_ronda_puntos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: qr_ronda_puntos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.qr_ronda_puntos_id_seq OWNED BY public.qr_ronda_puntos.id;


--
-- Name: qr_rondas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qr_rondas (
    id integer NOT NULL,
    cliente_id integer,
    nombre text NOT NULL,
    descripcion text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: qr_rondas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.qr_rondas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: qr_rondas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.qr_rondas_id_seq OWNED BY public.qr_rondas.id;


--
-- Name: relevo_equipo_novedades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relevo_equipo_novedades (
    id integer NOT NULL,
    reporte_id integer NOT NULL,
    fichaje_id integer,
    puesto_id integer,
    employee_id integer,
    item_tipo character varying(40) NOT NULL,
    item_nombre character varying(200) NOT NULL,
    item_ref_id integer,
    estado character varying(20) DEFAULT 'ok'::character varying NOT NULL,
    descripcion text,
    registrado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: relevo_equipo_novedades_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.relevo_equipo_novedades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: relevo_equipo_novedades_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.relevo_equipo_novedades_id_seq OWNED BY public.relevo_equipo_novedades.id;


--
-- Name: reporte_turno; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reporte_turno (
    id integer NOT NULL,
    fichaje_id integer NOT NULL,
    puesto_id integer,
    employee_id integer,
    tipo character varying(20) DEFAULT 'fichaje'::character varying NOT NULL,
    arma_id integer,
    arma_estado character varying(30),
    arma_observacion text,
    municion_ok boolean,
    municion_faltante integer DEFAULT 0 NOT NULL,
    municion_responsable_anterior integer,
    uniforme_ok boolean,
    uniforme_items_faltantes jsonb,
    registrado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reporte_turno_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reporte_turno_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reporte_turno_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reporte_turno_id_seq OWNED BY public.reporte_turno.id;


--
-- Name: rol_permisos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rol_permisos (
    rol_clave character varying(60) NOT NULL,
    modulo_clave character varying(80) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rrhh_alertas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rrhh_alertas (
    id integer NOT NULL,
    employee_id integer,
    employee_nombre character varying(255),
    tipo character varying(30) NOT NULL,
    prioridad character varying(10) DEFAULT 'media'::character varying NOT NULL,
    estado character varying(20) DEFAULT 'nueva'::character varying NOT NULL,
    datos_clave text,
    sugerencia text,
    generada_at timestamp with time zone DEFAULT now() NOT NULL,
    vista_at timestamp with time zone,
    resuelta_at timestamp with time zone,
    resuelta_por character varying(100),
    puesto_id integer,
    puesto_nombre character varying(255),
    fecha_evento date,
    cubierto_por_employee_id integer,
    cubierto_por_nombre character varying(255),
    cubierto_at timestamp with time zone,
    novedad_id integer
);


--
-- Name: rrhh_alertas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rrhh_alertas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rrhh_alertas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rrhh_alertas_id_seq OWNED BY public.rrhh_alertas.id;


--
-- Name: seguros_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seguros_config (
    id integer NOT NULL,
    prima_mensual numeric(10,2) NOT NULL,
    vigente_desde date NOT NULL,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by character varying(100)
);


--
-- Name: seguros_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seguros_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seguros_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.seguros_config_id_seq OWNED BY public.seguros_config.id;


--
-- Name: service_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_locations (
    id integer NOT NULL,
    client_id integer NOT NULL,
    nombre_puesto character varying(255) NOT NULL,
    ubicacion character varying(255),
    tipo character varying(50) DEFAULT 'vigilancia'::character varying NOT NULL,
    estado character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_locations_id_seq OWNED BY public.service_locations.id;


--
-- Name: solicitudes_servicio_adicional; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitudes_servicio_adicional (
    id character varying(30) NOT NULL,
    cliente_id integer,
    sede_id integer,
    puesto_id integer,
    tipo_solicitud character varying(50) NOT NULL,
    fecha date NOT NULL,
    hora_inicio character varying(5),
    hora_fin character varying(5),
    cantidad_guardias integer DEFAULT 1 NOT NULL,
    descripcion text,
    prioridad character varying(20) DEFAULT 'normal'::character varying NOT NULL,
    contacto_solicitante character varying(255),
    acepta_cobro_adicional boolean DEFAULT false NOT NULL,
    origen character varying(30) DEFAULT 'portal_cliente'::character varying NOT NULL,
    estado_general character varying(30) DEFAULT 'nueva'::character varying NOT NULL,
    estado_operaciones character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    estado_rrhh character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    estado_comercial character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    observaciones_operaciones text,
    observaciones_rrhh text,
    observaciones_comercial text,
    monto_estimado numeric(10,2),
    tarifa_aplicada character varying(100),
    estado_facturacion character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    cubierta_con character varying(100),
    tarea_operaciones_id character varying(20),
    tarea_rrhh_id character varying(20),
    tarea_comercial_id character varying(20),
    solicitado_por_user_id integer,
    solicitado_por_nombre character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    agente_id integer,
    agente_nombre character varying(255),
    tipo_cobertura character varying(50),
    fecha_fin date,
    tarjeta_activa boolean DEFAULT false NOT NULL,
    estado_contabilidad character varying(30) DEFAULT 'pendiente_autorizacion'::character varying NOT NULL,
    fecha_inicio_real timestamp with time zone,
    fecha_fin_real timestamp with time zone,
    resumen_final text,
    resumen_generado_at timestamp with time zone,
    estado_preplanilla character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    enviado_preplanilla_at timestamp with time zone,
    motivo_ultima_remocion character varying(50),
    agentes_rechazados jsonb DEFAULT '[]'::jsonb NOT NULL,
    motivo_cancelacion text,
    cancelado_por character varying(100),
    cancelado_at timestamp with time zone
);


--
-- Name: servicios_programados_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.servicios_programados_v AS
 SELECT 'inicio_cliente'::text AS tipo,
    NULL::character varying AS ssa_id,
    NULL::character varying AS tipo_solicitud,
    c.id AS cliente_id,
    c.nombre AS cliente_nombre,
    c.nombre_comercial AS cliente_nombre_comercial,
    c.sector,
    c.fecha_inicio_contrato AS fecha_servicio,
    NULL::text AS descripcion,
    NULL::character varying AS hora_inicio,
    NULL::character varying AS hora_fin,
    NULL::character varying AS estado_ssa,
    c.created_at
   FROM public.clients c
  WHERE (c.fecha_inicio_contrato IS NOT NULL)
UNION ALL
 SELECT 'ssa'::text AS tipo,
    s.id AS ssa_id,
    s.tipo_solicitud,
    s.cliente_id,
    c.nombre AS cliente_nombre,
    c.nombre_comercial AS cliente_nombre_comercial,
    c.sector,
    s.fecha AS fecha_servicio,
    s.descripcion,
    s.hora_inicio,
    s.hora_fin,
    s.estado_general AS estado_ssa,
    s.created_at
   FROM (public.solicitudes_servicio_adicional s
     JOIN public.clients c ON ((c.id = s.cliente_id)))
  WHERE ((s.estado_general)::text <> ALL ((ARRAY['cancelada'::character varying, 'cubierta'::character varying])::text[]));


--
-- Name: solicitudes_cambio_operativo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitudes_cambio_operativo (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    origen_modulo character varying(50) NOT NULL,
    tipo_cambio character varying(80) NOT NULL,
    estado character varying(50) DEFAULT 'pendiente_rrhh'::character varying NOT NULL,
    datos_antes jsonb,
    datos_despues jsonb,
    creado_por character varying(100),
    motivo text,
    validado_por_rrhh character varying(100),
    validado_por_operaciones character varying(100),
    decidido_por_admin character varying(100),
    notas_rrhh text,
    notas_operaciones text,
    notas_admin text,
    fecha_validacion_rrhh timestamp with time zone,
    fecha_validacion_operaciones timestamp with time zone,
    fecha_decision_admin timestamp with time zone,
    puesto_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: solicitudes_cambio_operativo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.solicitudes_cambio_operativo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitudes_cambio_operativo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.solicitudes_cambio_operativo_id_seq OWNED BY public.solicitudes_cambio_operativo.id;


--
-- Name: solicitudes_cambio_turno; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitudes_cambio_turno (
    id integer NOT NULL,
    puesto_id integer NOT NULL,
    turno_actual_id integer,
    turno_nuevo_id integer NOT NULL,
    estado character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    motivo text,
    creado_por character varying(100),
    autorizado_por character varying(100),
    notas text,
    fecha_autorizacion timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: solicitudes_cambio_turno_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.solicitudes_cambio_turno_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitudes_cambio_turno_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.solicitudes_cambio_turno_id_seq OWNED BY public.solicitudes_cambio_turno.id;


--
-- Name: solicitudes_eliminacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitudes_eliminacion (
    id integer NOT NULL,
    entidad character varying(50) NOT NULL,
    entidad_id integer NOT NULL,
    entidad_descripcion text NOT NULL,
    motivo text NOT NULL,
    solicitante_username character varying(100) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    revisado_por character varying(100),
    revisado_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: solicitudes_eliminacion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.solicitudes_eliminacion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitudes_eliminacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.solicitudes_eliminacion_id_seq OWNED BY public.solicitudes_eliminacion.id;


--
-- Name: solicitudes_empleo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitudes_empleo (
    id integer NOT NULL,
    nombre_completo character varying(255) NOT NULL,
    fecha_nacimiento date,
    dpi character varying(20),
    genero character varying(20),
    estado_civil character varying(30),
    telefono character varying(50),
    telefono_emergencia character varying(50),
    nombre_contacto_emergencia character varying(255),
    correo character varying(255),
    direccion text,
    municipio character varying(100),
    departamento character varying(100),
    nombre_padre character varying(255),
    nombre_madre character varying(255),
    num_dependientes smallint DEFAULT 0,
    familiar_en_empresa boolean DEFAULT false,
    nombre_familiar_empresa character varying(255),
    grado_estudios character varying(50),
    experiencia_seguridad boolean DEFAULT false,
    anios_experiencia smallint DEFAULT 0,
    empresa_anterior character varying(255),
    licencia_armas boolean DEFAULT false,
    tiene_vehiculo boolean DEFAULT false,
    puesto_solicitado character varying(100),
    disponibilidad_horario character varying(50),
    disponible_exterior boolean DEFAULT false,
    pretension_salarial text,
    foto_url text,
    foto_expira_at timestamp with time zone,
    estado character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    notas_reclutador text,
    revisado_por character varying(255),
    revisado_at timestamp with time zone,
    employee_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    canal character varying(30) DEFAULT 'kiosco'::character varying NOT NULL,
    dpi_frente_url text,
    dpi_reverso_url text,
    es_reingreso boolean DEFAULT false NOT NULL,
    tipo_vivienda character varying(60),
    tiempo_residencia character varying(60),
    renta_mensual character varying(30),
    banco character varying(60),
    tipo_cuenta character varying(30),
    num_cuenta character varying(60),
    tiene_licencia character varying(3),
    tipo_licencia character varying(60),
    vigencia_licencia character varying(30),
    tel_padre character varying(30),
    tel_madre character varying(30),
    nombre_conyuge character varying(200),
    ocup_conyuge character varying(200),
    tel_conyuge character varying(30),
    hermano1_nombre character varying(200),
    hermano1_tel character varying(30),
    hermano2_nombre character varying(200),
    hermano2_tel character varying(30),
    facebook character varying(200),
    instagram character varying(200),
    estatura character varying(10),
    peso character varying(10),
    enfermedad_cronica character varying(3),
    enfermedad_det text,
    medicamento character varying(3),
    medicamento_det character varying(200),
    impedimento_fisico character varying(3),
    impedimento_det character varying(200),
    consume_alcohol character varying(3),
    consume_drogas character varying(3),
    tiene_tatuajes character varying(3),
    tatuajes_det text,
    parentesco_emergencia character varying(60),
    proceso_judicial character varying(3),
    proceso_det text,
    detenido character varying(3),
    detencion_det text,
    tiene_deudas character varying(3),
    estado_deuda character varying(60),
    gastos_mensuales character varying(30),
    tiene_prestamo character varying(3),
    monto_prestamo character varying(30),
    prim_escuela character varying(200),
    prim_lugar character varying(120),
    prim_titulo character varying(200),
    bas_escuela character varying(200),
    bas_lugar character varying(120),
    bas_titulo character varying(200),
    div_escuela character varying(200),
    div_lugar character varying(120),
    div_titulo character varying(200),
    uni_escuela character varying(200),
    uni_lugar character varying(120),
    uni_titulo character varying(200),
    emp1_nombre character varying(200),
    emp1_puesto character varying(120),
    emp1_salario character varying(30),
    emp1_inicio character varying(10),
    emp1_fin character varying(10),
    emp1_motivo character varying(120),
    emp2_nombre character varying(200),
    emp2_puesto character varying(120),
    emp2_salario character varying(30),
    emp2_inicio character varying(10),
    emp2_fin character varying(10),
    emp2_motivo character varying(120),
    emp3_nombre character varying(200),
    emp3_puesto character varying(120),
    emp3_salario character varying(30),
    emp3_inicio character varying(10),
    emp3_fin character varying(10),
    emp3_motivo character varying(120),
    servicio_militar character varying(3),
    rango_militar character varying(60),
    unidad_militar character varying(120),
    fue_policia character varying(3),
    motivo_baja_policial character varying(200),
    habilidades text,
    tipos_seguridad text,
    disp_rotativo character varying(3),
    disp_nocturno character varying(3),
    disp_fds character varying(3),
    ref1_nombre character varying(200),
    ref1_relacion character varying(120),
    ref1_tel character varying(30),
    ref1_anios character varying(10),
    ref2_nombre character varying(200),
    ref2_relacion character varying(120),
    ref2_tel character varying(30),
    ref2_anios character varying(10),
    ref3_nombre character varying(200),
    ref3_relacion character varying(120),
    ref3_tel character varying(30),
    ref3_anios character varying(10),
    forma_pago character varying(20)
);


--
-- Name: solicitudes_empleo_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.solicitudes_empleo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitudes_empleo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.solicitudes_empleo_id_seq OWNED BY public.solicitudes_empleo.id;


--
-- Name: solicitudes_merge_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitudes_merge_requests (
    id integer NOT NULL,
    solicitud_id integer NOT NULL,
    employee_id integer NOT NULL,
    estado character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    revisado_por character varying(100),
    revisado_at timestamp with time zone,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: solicitudes_merge_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.solicitudes_merge_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitudes_merge_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.solicitudes_merge_requests_id_seq OWNED BY public.solicitudes_merge_requests.id;


--
-- Name: ssa_agentes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ssa_agentes (
    id integer NOT NULL,
    ssa_id character varying(30) NOT NULL,
    employee_id integer NOT NULL,
    estado character varying(20) DEFAULT 'asignado'::character varying NOT NULL,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ssa_agentes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ssa_agentes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ssa_agentes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ssa_agentes_id_seq OWNED BY public.ssa_agentes.id;


--
-- Name: ssa_historial_cambios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ssa_historial_cambios (
    id integer NOT NULL,
    ssa_id character varying NOT NULL,
    tipo_evento character varying(30) NOT NULL,
    agente_id integer,
    agente_nombre character varying(255),
    motivo character varying(50),
    notas text,
    usuario_sesion character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ssa_historial_cambios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ssa_historial_cambios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ssa_historial_cambios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ssa_historial_cambios_id_seq OWNED BY public.ssa_historial_cambios.id;


--
-- Name: supervision_catalogo_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supervision_catalogo_items (
    id integer NOT NULL,
    cliente_id integer,
    categoria character varying(20) NOT NULL,
    clave character varying(40) NOT NULL,
    etiqueta text NOT NULL,
    tipo character varying(15) DEFAULT 'boolean'::character varying NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT supervision_catalogo_items_categoria_check CHECK (((categoria)::text = ANY ((ARRAY['equipo'::character varying, 'presentacion'::character varying, 'arma'::character varying, 'otro'::character varying])::text[]))),
    CONSTRAINT supervision_catalogo_items_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['boolean'::character varying, 'numero'::character varying, 'texto'::character varying])::text[])))
);


--
-- Name: supervision_catalogo_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supervision_catalogo_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supervision_catalogo_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supervision_catalogo_items_id_seq OWNED BY public.supervision_catalogo_items.id;


--
-- Name: supervision_geofence_eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supervision_geofence_eventos (
    id bigint NOT NULL,
    sesion_id integer NOT NULL,
    supervisor_employee_id integer NOT NULL,
    puesto_id integer,
    cliente_id integer,
    programacion_id integer,
    tipo character varying(10) NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    accuracy_m double precision,
    distancia_m double precision,
    radio_m double precision,
    ocurrido_at timestamp with time zone DEFAULT now() NOT NULL,
    recibido_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT supervision_geofence_eventos_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['entry'::character varying, 'exit'::character varying])::text[])))
);


--
-- Name: supervision_geofence_eventos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supervision_geofence_eventos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supervision_geofence_eventos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supervision_geofence_eventos_id_seq OWNED BY public.supervision_geofence_eventos.id;


--
-- Name: supervision_gps_tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supervision_gps_tracks (
    id bigint NOT NULL,
    sesion_id integer NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    accuracy_m double precision,
    registrado_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: supervision_gps_tracks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supervision_gps_tracks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supervision_gps_tracks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supervision_gps_tracks_id_seq OWNED BY public.supervision_gps_tracks.id;


--
-- Name: supervision_inspecciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supervision_inspecciones (
    id integer NOT NULL,
    sesion_id integer NOT NULL,
    supervisor_employee_id integer NOT NULL,
    agente_employee_id integer NOT NULL,
    puesto_id integer,
    cliente_id integer,
    arma_id integer,
    datos jsonb DEFAULT '{}'::jsonb NOT NULL,
    arma_estado jsonb,
    observaciones text,
    lat double precision,
    lng double precision,
    realizada_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: supervision_inspecciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supervision_inspecciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supervision_inspecciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supervision_inspecciones_id_seq OWNED BY public.supervision_inspecciones.id;


--
-- Name: supervision_novedades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supervision_novedades (
    id integer NOT NULL,
    sesion_id integer,
    supervisor_employee_id integer NOT NULL,
    fecha date NOT NULL,
    puesto_id integer,
    cliente_id integer,
    observaciones text,
    datos_consolidados jsonb DEFAULT '{}'::jsonb NOT NULL,
    generada_at timestamp with time zone DEFAULT now() NOT NULL,
    tipo text DEFAULT 'inspeccion'::text NOT NULL,
    push_enviado_at timestamp with time zone,
    reconocida_por_user_id integer,
    reconocida_at timestamp with time zone,
    recordatorio_enviado_at timestamp with time zone
);


--
-- Name: supervision_novedades_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supervision_novedades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supervision_novedades_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supervision_novedades_id_seq OWNED BY public.supervision_novedades.id;


--
-- Name: supervision_plan_mensual; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supervision_plan_mensual (
    id integer NOT NULL,
    sede_id integer NOT NULL,
    semana_mes smallint NOT NULL,
    supervisor_employee_id integer NOT NULL,
    notas text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT supervision_plan_mensual_semana_mes_check CHECK (((semana_mes >= 1) AND (semana_mes <= 5)))
);


--
-- Name: supervision_plan_mensual_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supervision_plan_mensual_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supervision_plan_mensual_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supervision_plan_mensual_id_seq OWNED BY public.supervision_plan_mensual.id;


--
-- Name: supervision_sesiones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supervision_sesiones (
    id integer NOT NULL,
    supervisor_employee_id integer NOT NULL,
    fecha date NOT NULL,
    hora_inicio_real timestamp with time zone DEFAULT now() NOT NULL,
    hora_fin_real timestamp with time zone,
    hora_inicio_planificada time without time zone,
    hora_fin_planificada time without time zone,
    estado character varying(20) DEFAULT 'activa'::character varying NOT NULL,
    device_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT supervision_sesiones_estado_check CHECK (((estado)::text = ANY ((ARRAY['activa'::character varying, 'cerrada_manual'::character varying, 'cerrada_auto'::character varying])::text[])))
);


--
-- Name: supervision_sesiones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supervision_sesiones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supervision_sesiones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supervision_sesiones_id_seq OWNED BY public.supervision_sesiones.id;


--
-- Name: supervision_visitas_programadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supervision_visitas_programadas (
    id integer NOT NULL,
    supervisor_employee_id integer NOT NULL,
    cliente_id integer,
    puesto_id integer,
    zona_id integer,
    fecha_planificada date NOT NULL,
    ventana_inicio time without time zone,
    ventana_fin time without time zone,
    tipo character varying(20) DEFAULT 'rutina'::character varying NOT NULL,
    prioridad character varying(10) DEFAULT 'normal'::character varying NOT NULL,
    instrucciones text,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    visita_id integer,
    recorrido_padre_id integer,
    iniciada_at timestamp with time zone,
    completada_at timestamp with time zone,
    created_by_user_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bono_monto numeric(10,2),
    bono_pagado boolean DEFAULT false NOT NULL,
    bono_pagado_at timestamp with time zone,
    bono_pagado_por_user_id integer,
    observaciones text,
    fichaje_supervisor_id integer,
    CONSTRAINT supervision_visitas_programadas_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'en_curso'::character varying, 'completada'::character varying, 'cancelada'::character varying, 'no_realizada'::character varying])::text[]))),
    CONSTRAINT supervision_visitas_programadas_prioridad_check CHECK (((prioridad)::text = ANY ((ARRAY['baja'::character varying, 'normal'::character varying, 'alta'::character varying, 'urgente'::character varying])::text[]))),
    CONSTRAINT supervision_visitas_programadas_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['rutina'::character varying, 'extraordinaria'::character varying, 'comision'::character varying])::text[])))
);


--
-- Name: supervision_visitas_programadas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supervision_visitas_programadas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supervision_visitas_programadas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supervision_visitas_programadas_id_seq OWNED BY public.supervision_visitas_programadas.id;


--
-- Name: supervisor_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supervisor_devices (
    id integer NOT NULL,
    device_uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    device_token_hash character varying(64),
    supervisor_nombre character varying(150) NOT NULL,
    descripcion character varying(200),
    tipo character varying(20) DEFAULT 'supervisor'::character varying NOT NULL,
    puesto_id integer,
    activo boolean DEFAULT true NOT NULL,
    ultimo_uso timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cliente_id integer,
    slot_numero integer,
    supervisor_employee_id integer
);


--
-- Name: supervisor_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supervisor_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supervisor_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supervisor_devices_id_seq OWNED BY public.supervisor_devices.id;


--
-- Name: system_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_config (
    key character varying(100) NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: system_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_roles (
    clave character varying(60) NOT NULL,
    label character varying(120) NOT NULL,
    descripcion character varying(300),
    color character varying(120) DEFAULT 'text-white/50 bg-white/5 border-white/10'::character varying NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    es_sistema boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tareas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tareas (
    id character varying(20) NOT NULL,
    titulo character varying(500) NOT NULL,
    descripcion text,
    incidencia_id character varying(20),
    prioridad character varying(20) DEFAULT 'media'::character varying NOT NULL,
    estado character varying(50) DEFAULT 'pendiente'::character varying NOT NULL,
    asignado character varying(255),
    asignado_id integer,
    trello_card_id character varying(100),
    trello_card_url character varying(500),
    fecha_vencimiento timestamp with time zone,
    canal character varying(50) DEFAULT 'manual'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cliente_id integer,
    puesto_id integer,
    sede_id integer,
    pasos jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: task_evidencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_evidencias (
    id integer NOT NULL,
    tarea_id character varying(20) NOT NULL,
    supervisor_id integer,
    supervisor_nombre character varying(255) NOT NULL,
    comentario text NOT NULL,
    foto_url text NOT NULL,
    canal character varying(50) DEFAULT 'admin'::character varying NOT NULL,
    fecha_cierre timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_evidencias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.task_evidencias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: task_evidencias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.task_evidencias_id_seq OWNED BY public.task_evidencias.id;


--
-- Name: tipos_personal_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipos_personal_config (
    clave character varying(60) NOT NULL,
    label character varying(120) NOT NULL,
    color character varying(120) DEFAULT 'text-white/50 bg-white/5 border-white/10'::character varying NOT NULL,
    descripcion character varying(300),
    activo boolean DEFAULT true NOT NULL,
    es_sistema boolean DEFAULT false NOT NULL,
    orden smallint DEFAULT 99 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: turnos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.turnos (
    id integer NOT NULL,
    nombre character varying(60) NOT NULL,
    descripcion text,
    horas_trabajo numeric(5,2) NOT NULL,
    horas_descanso numeric(5,2) DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tipo_ciclo character varying(20),
    num_titulares integer DEFAULT 2 NOT NULL
);


--
-- Name: turnos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.turnos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: turnos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.turnos_id_seq OWNED BY public.turnos.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    correo character varying(255),
    password_hash character varying(255) NOT NULL,
    rol character varying(50) DEFAULT 'operaciones'::character varying NOT NULL,
    estado character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    telefono character varying(50),
    cliente_id character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    employee_id integer,
    can_report_emergency boolean,
    can_request_advance boolean,
    telefono_secundario character varying(50),
    wa_autorizado boolean DEFAULT false NOT NULL,
    telefono_verificado_at timestamp with time zone,
    last_phone_update_at timestamp with time zone,
    auth_source character varying(20)
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: usuarios_clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios_clientes (
    id integer NOT NULL,
    user_id integer NOT NULL,
    portal_cliente_id text NOT NULL,
    es_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuarios_clientes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_clientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_clientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_clientes_id_seq OWNED BY public.usuarios_clientes.id;


--
-- Name: vacaciones_movimientos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vacaciones_movimientos (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    tipo character varying(20) NOT NULL,
    dias numeric(10,4) NOT NULL,
    fecha date NOT NULL,
    periodo_inicio date,
    periodo_fin date,
    referencia text,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vacaciones_movimientos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vacaciones_movimientos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vacaciones_movimientos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vacaciones_movimientos_id_seq OWNED BY public.vacaciones_movimientos.id;


--
-- Name: vacaciones_saldos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vacaciones_saldos (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    dias_ganados numeric(10,4) DEFAULT 0 NOT NULL,
    dias_gozados numeric(10,4) DEFAULT 0 NOT NULL,
    dias_disponibles numeric(10,4) DEFAULT 0 NOT NULL,
    dias_pendientes_pago numeric(10,4) DEFAULT 0 NOT NULL,
    fecha_ultima_actualizacion timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vacaciones_saldos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vacaciones_saldos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vacaciones_saldos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vacaciones_saldos_id_seq OWNED BY public.vacaciones_saldos.id;


--
-- Name: vehiculo_custodia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehiculo_custodia (
    id integer NOT NULL,
    vehiculo_id integer NOT NULL,
    employee_id integer,
    zona_operativa_id integer,
    fecha_inicio timestamp with time zone DEFAULT now() NOT NULL,
    fecha_fin timestamp with time zone,
    tipo_relevo character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    notas text,
    registrado_por character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vehiculo_custodia_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vehiculo_custodia_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vehiculo_custodia_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vehiculo_custodia_id_seq OWNED BY public.vehiculo_custodia.id;


--
-- Name: vehiculos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehiculos (
    id integer NOT NULL,
    placa character varying(15) NOT NULL,
    tipo character varying(30) NOT NULL,
    marca character varying(50),
    modelo character varying(50),
    color character varying(30),
    anio smallint,
    estado character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    zona_operativa_id integer,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vehiculos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vehiculos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vehiculos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vehiculos_id_seq OWNED BY public.vehiculos.id;


--
-- Name: visitas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visitas (
    id integer NOT NULL,
    tipo character varying(20) NOT NULL,
    puesto_id integer NOT NULL,
    cliente_id integer,
    cliente_nombre character varying(200),
    puesto_nombre character varying(200),
    dpi_numero character varying(20),
    nombre_completo character varying(200),
    fecha_nacimiento date,
    genero character varying(20),
    dpi_frente_url text,
    foto_persona_url text,
    placa character varying(20),
    marca_vehiculo character varying(100),
    color_vehiculo character varying(50),
    foto_vehiculo_url text,
    conductor_dpi_numero character varying(20),
    conductor_nombre character varying(200),
    conductor_dpi_frente_url text,
    motivo text,
    a_quien_visita character varying(200),
    observaciones text,
    entrada_at timestamp with time zone DEFAULT now() NOT NULL,
    entrada_employee_id integer,
    entrada_employee_nombre character varying(200),
    entrada_device_id integer,
    salida_at timestamp with time zone,
    salida_employee_id integer,
    salida_employee_nombre character varying(200),
    salida_device_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    dpi_frente_subida_en timestamp with time zone,
    conductor_dpi_frente_subida_en timestamp with time zone,
    CONSTRAINT visitas_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['persona'::character varying, 'vehiculo'::character varying])::text[])))
);


--
-- Name: visitas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.visitas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: visitas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.visitas_id_seq OWNED BY public.visitas.id;


--
-- Name: wa_anticipo_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wa_anticipo_sessions (
    telefono character varying(32) NOT NULL,
    state character varying(32) NOT NULL,
    employee_id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    puesto character varying(255),
    dpi character varying(32),
    periodo character varying(32) NOT NULL,
    limite_restante integer,
    limite_total integer,
    monto_solicitado integer,
    last_activity timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: wa_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wa_audit_log (
    id integer NOT NULL,
    modulo character varying(50) NOT NULL,
    clave character varying(100) NOT NULL,
    valor_anterior text,
    valor_nuevo text NOT NULL,
    usuario character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wa_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wa_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wa_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wa_audit_log_id_seq OWNED BY public.wa_audit_log.id;


--
-- Name: wa_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wa_config (
    id integer NOT NULL,
    clave character varying(100) NOT NULL,
    valor text NOT NULL,
    tipo character varying(50) DEFAULT 'texto'::character varying NOT NULL,
    descripcion character varying(255),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wa_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wa_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wa_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wa_config_id_seq OWNED BY public.wa_config.id;


--
-- Name: wa_menu_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wa_menu_options (
    id integer NOT NULL,
    rol character varying(50) NOT NULL,
    texto character varying(255) NOT NULL,
    accion character varying(100) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wa_menu_options_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wa_menu_options_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wa_menu_options_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wa_menu_options_id_seq OWNED BY public.wa_menu_options.id;


--
-- Name: wa_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wa_messages (
    id integer NOT NULL,
    clave character varying(100) NOT NULL,
    texto text NOT NULL,
    descripcion character varying(255),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wa_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wa_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wa_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wa_messages_id_seq OWNED BY public.wa_messages.id;


--
-- Name: wa_notificaciones_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wa_notificaciones_log (
    id integer NOT NULL,
    tarea_id character varying(20),
    usuario_id integer,
    telefono character varying(20),
    mensaje text,
    evento character varying(80) DEFAULT 'tarea_asignada'::character varying NOT NULL,
    estado character varying(20) DEFAULT 'simulado'::character varying NOT NULL,
    error_msg text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wa_notificaciones_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wa_notificaciones_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wa_notificaciones_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wa_notificaciones_log_id_seq OWNED BY public.wa_notificaciones_log.id;


--
-- Name: wa_phone_reg_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wa_phone_reg_sessions (
    telefono character varying(32) NOT NULL,
    nombre character varying(255) NOT NULL,
    state character varying(32) NOT NULL,
    intentos integer DEFAULT 0 NOT NULL,
    empleado_id integer,
    empleado_nombre character varying(255),
    user_id integer,
    dpi_validado character varying(32),
    telefono_anterior character varying(32),
    intencion_original character varying(64) NOT NULL,
    last_activity timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: wa_simulator_scenarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wa_simulator_scenarios (
    id integer NOT NULL,
    grupo character varying(20) NOT NULL,
    label character varying(120) NOT NULL,
    icono character varying(16) DEFAULT ''::character varying NOT NULL,
    mensaje text NOT NULL,
    color character varying(200) DEFAULT ''::character varying NOT NULL,
    skip_validacion boolean DEFAULT false NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wa_simulator_scenarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wa_simulator_scenarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wa_simulator_scenarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wa_simulator_scenarios_id_seq OWNED BY public.wa_simulator_scenarios.id;


--
-- Name: zona_supervisores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zona_supervisores (
    id integer NOT NULL,
    zona_id integer NOT NULL,
    employee_id integer NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: zona_supervisores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.zona_supervisores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: zona_supervisores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.zona_supervisores_id_seq OWNED BY public.zona_supervisores.id;


--
-- Name: agent_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_assignments ALTER COLUMN id SET DEFAULT nextval('public.agent_assignments_id_seq'::regclass);


--
-- Name: agente_fichajes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_fichajes ALTER COLUMN id SET DEFAULT nextval('public.agente_fichajes_id_seq'::regclass);


--
-- Name: agente_qr_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_qr_tokens ALTER COLUMN id SET DEFAULT nextval('public.agente_qr_tokens_id_seq'::regclass);


--
-- Name: agente_recorrido_gps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_recorrido_gps ALTER COLUMN id SET DEFAULT nextval('public.agente_recorrido_gps_id_seq'::regclass);


--
-- Name: amonestacion_causales_legales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amonestacion_causales_legales ALTER COLUMN id SET DEFAULT nextval('public.amonestacion_causales_legales_id_seq'::regclass);


--
-- Name: amonestacion_motivos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amonestacion_motivos ALTER COLUMN id SET DEFAULT nextval('public.amonestacion_motivos_id_seq'::regclass);


--
-- Name: amonestacion_solicitudes_creacion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amonestacion_solicitudes_creacion ALTER COLUMN id SET DEFAULT nextval('public.amonestacion_solicitudes_creacion_id_seq'::regclass);


--
-- Name: amonestacion_solicitudes_modificacion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amonestacion_solicitudes_modificacion ALTER COLUMN id SET DEFAULT nextval('public.amonestacion_solicitudes_modificacion_id_seq'::regclass);


--
-- Name: amonestaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amonestaciones ALTER COLUMN id SET DEFAULT nextval('public.amonestaciones_id_seq'::regclass);


--
-- Name: anticipos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anticipos ALTER COLUMN id SET DEFAULT nextval('public.anticipos_id_seq'::regclass);


--
-- Name: applications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications ALTER COLUMN id SET DEFAULT nextval('public.applications_id_seq'::regclass);


--
-- Name: arma_custodia id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arma_custodia ALTER COLUMN id SET DEFAULT nextval('public.arma_custodia_id_seq'::regclass);


--
-- Name: arma_ordenes_servicio id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arma_ordenes_servicio ALTER COLUMN id SET DEFAULT nextval('public.arma_ordenes_servicio_id_seq'::regclass);


--
-- Name: arma_sugerencias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arma_sugerencias ALTER COLUMN id SET DEFAULT nextval('public.arma_sugerencias_id_seq'::regclass);


--
-- Name: armas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.armas ALTER COLUMN id SET DEFAULT nextval('public.armas_id_seq'::regclass);


--
-- Name: armas_alertas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.armas_alertas ALTER COLUMN id SET DEFAULT nextval('public.armas_alertas_id_seq'::regclass);


--
-- Name: barraca_asignaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barraca_asignaciones ALTER COLUMN id SET DEFAULT nextval('public.barraca_asignaciones_id_seq'::regclass);


--
-- Name: barracas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barracas ALTER COLUMN id SET DEFAULT nextval('public.barracas_id_seq'::regclass);


--
-- Name: bodega_articulos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_articulos ALTER COLUMN id SET DEFAULT nextval('public.bodega_articulos_id_seq'::regclass);


--
-- Name: bodega_categorias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_categorias ALTER COLUMN id SET DEFAULT nextval('public.bodega_categorias_id_seq'::regclass);


--
-- Name: bodega_movimientos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_movimientos ALTER COLUMN id SET DEFAULT nextval('public.bodega_movimientos_id_seq'::regclass);


--
-- Name: bodega_solicitudes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_solicitudes ALTER COLUMN id SET DEFAULT nextval('public.bodega_solicitudes_id_seq'::regclass);


--
-- Name: bodega_unidades id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_unidades ALTER COLUMN id SET DEFAULT nextval('public.bodega_unidades_id_seq'::regclass);


--
-- Name: cambios_salariales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cambios_salariales ALTER COLUMN id SET DEFAULT nextval('public.cambios_salariales_id_seq'::regclass);


--
-- Name: cierre_auditoria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierre_auditoria ALTER COLUMN id SET DEFAULT nextval('public.cierre_auditoria_id_seq'::regclass);


--
-- Name: cierre_operativo_diario id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierre_operativo_diario ALTER COLUMN id SET DEFAULT nextval('public.cierre_operativo_diario_id_seq'::regclass);


--
-- Name: client_aliases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_aliases ALTER COLUMN id SET DEFAULT nextval('public.client_aliases_id_seq'::regclass);


--
-- Name: client_sedes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_sedes ALTER COLUMN id SET DEFAULT nextval('public.client_sedes_id_seq'::regclass);


--
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- Name: cobertura_diaria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobertura_diaria ALTER COLUMN id SET DEFAULT nextval('public.cobertura_diaria_id_seq'::regclass);


--
-- Name: cobertura_segmentos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobertura_segmentos ALTER COLUMN id SET DEFAULT nextval('public.cobertura_segmentos_id_seq'::regclass);


--
-- Name: config_empresa id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config_empresa ALTER COLUMN id SET DEFAULT nextval('public.config_empresa_id_seq'::regclass);


--
-- Name: config_tarifa_he id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config_tarifa_he ALTER COLUMN id SET DEFAULT nextval('public.config_tarifa_he_id_seq'::regclass);


--
-- Name: contratos_empleados id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contratos_empleados ALTER COLUMN id SET DEFAULT nextval('public.contratos_empleados_id_seq'::regclass);


--
-- Name: custodia_asignacion_diaria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_asignacion_diaria ALTER COLUMN id SET DEFAULT nextval('public.custodia_asignacion_diaria_id_seq'::regclass);


--
-- Name: custodia_excepciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_excepciones ALTER COLUMN id SET DEFAULT nextval('public.custodia_excepciones_id_seq'::regclass);


--
-- Name: custodia_fuerza_semanal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_fuerza_semanal ALTER COLUMN id SET DEFAULT nextval('public.custodia_fuerza_semanal_id_seq'::regclass);


--
-- Name: custodia_sync_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_sync_log ALTER COLUMN id SET DEFAULT nextval('public.custodia_sync_log_id_seq'::regclass);


--
-- Name: custodia_titulares id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_titulares ALTER COLUMN id SET DEFAULT nextval('public.custodia_titulares_id_seq'::regclass);


--
-- Name: detalle_lib_sal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_lib_sal ALTER COLUMN id SET DEFAULT nextval('public.detalle_lib_sal_id_seq'::regclass);


--
-- Name: detalle_prestaciones_odbc id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_prestaciones_odbc ALTER COLUMN id SET DEFAULT nextval('public.detalle_prestaciones_odbc_id_seq'::regclass);


--
-- Name: device_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_reports ALTER COLUMN id SET DEFAULT nextval('public.device_reports_id_seq'::regclass);


--
-- Name: device_reports_cleanup id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_reports_cleanup ALTER COLUMN id SET DEFAULT nextval('public.device_reports_cleanup_id_seq'::regclass);


--
-- Name: dotacion_pendiente id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dotacion_pendiente ALTER COLUMN id SET DEFAULT nextval('public.dotacion_pendiente_id_seq'::regclass);


--
-- Name: dotacion_pendiente_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dotacion_pendiente_items ALTER COLUMN id SET DEFAULT nextval('public.dotacion_pendiente_items_id_seq'::regclass);


--
-- Name: empleados_periodos_laborales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empleados_periodos_laborales ALTER COLUMN id SET DEFAULT nextval('public.empleados_periodos_laborales_id_seq'::regclass);


--
-- Name: employee_descanso_semanal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_descanso_semanal ALTER COLUMN id SET DEFAULT nextval('public.employee_descanso_semanal_id_seq'::regclass);


--
-- Name: employee_operational_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_operational_assignments ALTER COLUMN id SET DEFAULT nextval('public.employee_operational_assignments_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: entregas_uniforme id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entregas_uniforme ALTER COLUMN id SET DEFAULT nextval('public.entregas_uniforme_id_seq'::regclass);


--
-- Name: entregas_uniforme_cuotas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entregas_uniforme_cuotas ALTER COLUMN id SET DEFAULT nextval('public.entregas_uniforme_cuotas_id_seq'::regclass);


--
-- Name: eventos_rrhh id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_rrhh ALTER COLUMN id SET DEFAULT nextval('public.eventos_rrhh_id_seq'::regclass);


--
-- Name: historial_lib_sal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_lib_sal ALTER COLUMN id SET DEFAULT nextval('public.historial_lib_sal_id_seq'::regclass);


--
-- Name: historial_prestaciones_externas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_prestaciones_externas ALTER COLUMN id SET DEFAULT nextval('public.historial_prestaciones_externas_id_seq'::regclass);


--
-- Name: igss_config_patrono id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.igss_config_patrono ALTER COLUMN id SET DEFAULT nextval('public.igss_config_patrono_id_seq'::regclass);


--
-- Name: incentivos_cash_cobertura id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentivos_cash_cobertura ALTER COLUMN id SET DEFAULT nextval('public.incentivos_cash_cobertura_id_seq'::regclass);


--
-- Name: kit_ingreso_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kit_ingreso_items ALTER COLUMN id SET DEFAULT nextval('public.kit_ingreso_items_id_seq'::regclass);


--
-- Name: lead_dotacion_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_dotacion_items ALTER COLUMN id SET DEFAULT nextval('public.lead_dotacion_items_id_seq'::regclass);


--
-- Name: leads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads ALTER COLUMN id SET DEFAULT nextval('public.leads_id_seq'::regclass);


--
-- Name: movimientos_operativos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_operativos ALTER COLUMN id SET DEFAULT nextval('public.movimientos_operativos_id_seq'::regclass);


--
-- Name: nfc_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_audit_log ALTER COLUMN id SET DEFAULT nextval('public.nfc_audit_log_id_seq'::regclass);


--
-- Name: nfc_devices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_devices ALTER COLUMN id SET DEFAULT nextval('public.nfc_devices_id_seq'::regclass);


--
-- Name: nfc_ronda_eventos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_ronda_eventos ALTER COLUMN id SET DEFAULT nextval('public.nfc_ronda_eventos_id_seq'::regclass);


--
-- Name: nfc_ronda_puntos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_ronda_puntos ALTER COLUMN id SET DEFAULT nextval('public.nfc_ronda_puntos_id_seq'::regclass);


--
-- Name: nfc_sandbox_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_sandbox_schedules ALTER COLUMN id SET DEFAULT nextval('public.nfc_sandbox_schedules_id_seq'::regclass);


--
-- Name: nfc_shift_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_shift_events ALTER COLUMN id SET DEFAULT nextval('public.nfc_shift_events_id_seq'::regclass);


--
-- Name: nfc_supervisor_form_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_supervisor_form_items ALTER COLUMN id SET DEFAULT nextval('public.nfc_supervisor_form_items_id_seq'::regclass);


--
-- Name: nfc_supervisor_forms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_supervisor_forms ALTER COLUMN id SET DEFAULT nextval('public.nfc_supervisor_forms_id_seq'::regclass);


--
-- Name: nfc_tags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_tags ALTER COLUMN id SET DEFAULT nextval('public.nfc_tags_id_seq'::regclass);


--
-- Name: nomina_feriado_pago id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nomina_feriado_pago ALTER COLUMN id SET DEFAULT nextval('public.nomina_feriado_pago_id_seq'::regclass);


--
-- Name: nomina_feriados id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nomina_feriados ALTER COLUMN id SET DEFAULT nextval('public.nomina_feriados_id_seq'::regclass);


--
-- Name: novedades_nomina_diarias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novedades_nomina_diarias ALTER COLUMN id SET DEFAULT nextval('public.novedades_nomina_diarias_id_seq'::regclass);


--
-- Name: operational_zones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_zones ALTER COLUMN id SET DEFAULT nextval('public.operational_zones_id_seq'::regclass);


--
-- Name: ordenes_compra id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra ALTER COLUMN id SET DEFAULT nextval('public.ordenes_compra_id_seq'::regclass);


--
-- Name: ordenes_compra_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra_items ALTER COLUMN id SET DEFAULT nextval('public.ordenes_compra_items_id_seq'::regclass);


--
-- Name: permisos_ruta_rol id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_ruta_rol ALTER COLUMN id SET DEFAULT nextval('public.permisos_ruta_rol_id_seq'::regclass);


--
-- Name: personal_slots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_slots ALTER COLUMN id SET DEFAULT nextval('public.personal_slots_id_seq'::regclass);


--
-- Name: phone_auth_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_auth_log ALTER COLUMN id SET DEFAULT nextval('public.phone_auth_log_id_seq'::regclass);


--
-- Name: planificacion_futura id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planificacion_futura ALTER COLUMN id SET DEFAULT nextval('public.planificacion_futura_id_seq'::regclass);


--
-- Name: planilla_lineas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planilla_lineas ALTER COLUMN id SET DEFAULT nextval('public.planilla_lineas_id_seq'::regclass);


--
-- Name: planillas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planillas ALTER COLUMN id SET DEFAULT nextval('public.planillas_id_seq'::regclass);


--
-- Name: planillas_especiales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planillas_especiales ALTER COLUMN id SET DEFAULT nextval('public.planillas_especiales_id_seq'::regclass);


--
-- Name: planillas_especiales_lineas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planillas_especiales_lineas ALTER COLUMN id SET DEFAULT nextval('public.planillas_especiales_lineas_id_seq'::regclass);


--
-- Name: planillas_especiales_pagos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planillas_especiales_pagos ALTER COLUMN id SET DEFAULT nextval('public.planillas_especiales_pagos_id_seq'::regclass);


--
-- Name: plantillas_contrato id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantillas_contrato ALTER COLUMN id SET DEFAULT nextval('public.plantillas_contrato_id_seq'::regclass);


--
-- Name: position_aliases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.position_aliases ALTER COLUMN id SET DEFAULT nextval('public.position_aliases_id_seq'::regclass);


--
-- Name: pre_planilla_auditoria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_planilla_auditoria ALTER COLUMN id SET DEFAULT nextval('public.pre_planilla_auditoria_id_seq'::regclass);


--
-- Name: pre_planilla_cierres id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_planilla_cierres ALTER COLUMN id SET DEFAULT nextval('public.pre_planilla_cierres_id_seq'::regclass);


--
-- Name: pre_planilla_dias_anticipados id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_planilla_dias_anticipados ALTER COLUMN id SET DEFAULT nextval('public.pre_planilla_dias_anticipados_id_seq'::regclass);


--
-- Name: pre_planilla_revision id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_planilla_revision ALTER COLUMN id SET DEFAULT nextval('public.pre_planilla_revision_id_seq'::regclass);


--
-- Name: prestaciones_acumulados id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_acumulados ALTER COLUMN id SET DEFAULT nextval('public.prestaciones_acumulados_id_seq'::regclass);


--
-- Name: prestaciones_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_config ALTER COLUMN id SET DEFAULT nextval('public.prestaciones_config_id_seq'::regclass);


--
-- Name: prestaciones_liquidacion_detalle id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_liquidacion_detalle ALTER COLUMN id SET DEFAULT nextval('public.prestaciones_liquidacion_detalle_id_seq'::regclass);


--
-- Name: prestaciones_liquidacion_ediciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_liquidacion_ediciones ALTER COLUMN id SET DEFAULT nextval('public.prestaciones_liquidacion_ediciones_id_seq'::regclass);


--
-- Name: prestaciones_liquidaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_liquidaciones ALTER COLUMN id SET DEFAULT nextval('public.prestaciones_liquidaciones_id_seq'::regclass);


--
-- Name: prestaciones_movimientos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_movimientos ALTER COLUMN id SET DEFAULT nextval('public.prestaciones_movimientos_id_seq'::regclass);


--
-- Name: prestaciones_provisiones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_provisiones ALTER COLUMN id SET DEFAULT nextval('public.prestaciones_provisiones_id_seq'::regclass);


--
-- Name: puesto_municion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puesto_municion ALTER COLUMN id SET DEFAULT nextval('public.puesto_municion_id_seq'::regclass);


--
-- Name: puesto_slots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puesto_slots ALTER COLUMN id SET DEFAULT nextval('public.puesto_slots_id_seq'::regclass);


--
-- Name: puesto_titular_historico id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puesto_titular_historico ALTER COLUMN id SET DEFAULT nextval('public.puesto_titular_historico_id_seq'::regclass);


--
-- Name: puesto_titulares id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puesto_titulares ALTER COLUMN id SET DEFAULT nextval('public.puesto_titulares_id_seq'::regclass);


--
-- Name: puestos_gps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puestos_gps ALTER COLUMN id SET DEFAULT nextval('public.puestos_gps_id_seq'::regclass);


--
-- Name: puestos_operativos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puestos_operativos ALTER COLUMN id SET DEFAULT nextval('public.puestos_operativos_id_seq'::regclass);


--
-- Name: push_envios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_envios ALTER COLUMN id SET DEFAULT nextval('public.push_envios_id_seq'::regclass);


--
-- Name: push_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens ALTER COLUMN id SET DEFAULT nextval('public.push_tokens_id_seq'::regclass);


--
-- Name: qr_ronda_eventos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_ronda_eventos ALTER COLUMN id SET DEFAULT nextval('public.qr_ronda_eventos_id_seq'::regclass);


--
-- Name: qr_ronda_puntos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_ronda_puntos ALTER COLUMN id SET DEFAULT nextval('public.qr_ronda_puntos_id_seq'::regclass);


--
-- Name: qr_rondas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_rondas ALTER COLUMN id SET DEFAULT nextval('public.qr_rondas_id_seq'::regclass);


--
-- Name: relevo_equipo_novedades id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relevo_equipo_novedades ALTER COLUMN id SET DEFAULT nextval('public.relevo_equipo_novedades_id_seq'::regclass);


--
-- Name: reporte_turno id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reporte_turno ALTER COLUMN id SET DEFAULT nextval('public.reporte_turno_id_seq'::regclass);


--
-- Name: rrhh_alertas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rrhh_alertas ALTER COLUMN id SET DEFAULT nextval('public.rrhh_alertas_id_seq'::regclass);


--
-- Name: seguros_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seguros_config ALTER COLUMN id SET DEFAULT nextval('public.seguros_config_id_seq'::regclass);


--
-- Name: service_locations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_locations ALTER COLUMN id SET DEFAULT nextval('public.service_locations_id_seq'::regclass);


--
-- Name: solicitudes_cambio_operativo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_cambio_operativo ALTER COLUMN id SET DEFAULT nextval('public.solicitudes_cambio_operativo_id_seq'::regclass);


--
-- Name: solicitudes_cambio_turno id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_cambio_turno ALTER COLUMN id SET DEFAULT nextval('public.solicitudes_cambio_turno_id_seq'::regclass);


--
-- Name: solicitudes_eliminacion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_eliminacion ALTER COLUMN id SET DEFAULT nextval('public.solicitudes_eliminacion_id_seq'::regclass);


--
-- Name: solicitudes_empleo id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_empleo ALTER COLUMN id SET DEFAULT nextval('public.solicitudes_empleo_id_seq'::regclass);


--
-- Name: solicitudes_merge_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_merge_requests ALTER COLUMN id SET DEFAULT nextval('public.solicitudes_merge_requests_id_seq'::regclass);


--
-- Name: ssa_agentes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ssa_agentes ALTER COLUMN id SET DEFAULT nextval('public.ssa_agentes_id_seq'::regclass);


--
-- Name: ssa_historial_cambios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ssa_historial_cambios ALTER COLUMN id SET DEFAULT nextval('public.ssa_historial_cambios_id_seq'::regclass);


--
-- Name: supervision_catalogo_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_catalogo_items ALTER COLUMN id SET DEFAULT nextval('public.supervision_catalogo_items_id_seq'::regclass);


--
-- Name: supervision_geofence_eventos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_geofence_eventos ALTER COLUMN id SET DEFAULT nextval('public.supervision_geofence_eventos_id_seq'::regclass);


--
-- Name: supervision_gps_tracks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_gps_tracks ALTER COLUMN id SET DEFAULT nextval('public.supervision_gps_tracks_id_seq'::regclass);


--
-- Name: supervision_inspecciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_inspecciones ALTER COLUMN id SET DEFAULT nextval('public.supervision_inspecciones_id_seq'::regclass);


--
-- Name: supervision_novedades id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_novedades ALTER COLUMN id SET DEFAULT nextval('public.supervision_novedades_id_seq'::regclass);


--
-- Name: supervision_plan_mensual id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_plan_mensual ALTER COLUMN id SET DEFAULT nextval('public.supervision_plan_mensual_id_seq'::regclass);


--
-- Name: supervision_sesiones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_sesiones ALTER COLUMN id SET DEFAULT nextval('public.supervision_sesiones_id_seq'::regclass);


--
-- Name: supervision_visitas_programadas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_visitas_programadas ALTER COLUMN id SET DEFAULT nextval('public.supervision_visitas_programadas_id_seq'::regclass);


--
-- Name: supervisor_devices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisor_devices ALTER COLUMN id SET DEFAULT nextval('public.supervisor_devices_id_seq'::regclass);


--
-- Name: task_evidencias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_evidencias ALTER COLUMN id SET DEFAULT nextval('public.task_evidencias_id_seq'::regclass);


--
-- Name: turnos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos ALTER COLUMN id SET DEFAULT nextval('public.turnos_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: usuarios_clientes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_clientes ALTER COLUMN id SET DEFAULT nextval('public.usuarios_clientes_id_seq'::regclass);


--
-- Name: vacaciones_movimientos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vacaciones_movimientos ALTER COLUMN id SET DEFAULT nextval('public.vacaciones_movimientos_id_seq'::regclass);


--
-- Name: vacaciones_saldos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vacaciones_saldos ALTER COLUMN id SET DEFAULT nextval('public.vacaciones_saldos_id_seq'::regclass);


--
-- Name: vehiculo_custodia id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculo_custodia ALTER COLUMN id SET DEFAULT nextval('public.vehiculo_custodia_id_seq'::regclass);


--
-- Name: vehiculos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculos ALTER COLUMN id SET DEFAULT nextval('public.vehiculos_id_seq'::regclass);


--
-- Name: visitas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitas ALTER COLUMN id SET DEFAULT nextval('public.visitas_id_seq'::regclass);


--
-- Name: wa_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_audit_log ALTER COLUMN id SET DEFAULT nextval('public.wa_audit_log_id_seq'::regclass);


--
-- Name: wa_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_config ALTER COLUMN id SET DEFAULT nextval('public.wa_config_id_seq'::regclass);


--
-- Name: wa_menu_options id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_menu_options ALTER COLUMN id SET DEFAULT nextval('public.wa_menu_options_id_seq'::regclass);


--
-- Name: wa_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_messages ALTER COLUMN id SET DEFAULT nextval('public.wa_messages_id_seq'::regclass);


--
-- Name: wa_notificaciones_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_notificaciones_log ALTER COLUMN id SET DEFAULT nextval('public.wa_notificaciones_log_id_seq'::regclass);


--
-- Name: wa_simulator_scenarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_simulator_scenarios ALTER COLUMN id SET DEFAULT nextval('public.wa_simulator_scenarios_id_seq'::regclass);


--
-- Name: zona_supervisores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zona_supervisores ALTER COLUMN id SET DEFAULT nextval('public.zona_supervisores_id_seq'::regclass);


--
-- Name: agent_assignments agent_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_assignments
    ADD CONSTRAINT agent_assignments_pkey PRIMARY KEY (id);


--
-- Name: agente_fichajes agente_fichajes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_fichajes
    ADD CONSTRAINT agente_fichajes_pkey PRIMARY KEY (id);


--
-- Name: agente_qr_tokens agente_qr_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_qr_tokens
    ADD CONSTRAINT agente_qr_tokens_pkey PRIMARY KEY (id);


--
-- Name: agente_qr_tokens agente_qr_tokens_qr_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_qr_tokens
    ADD CONSTRAINT agente_qr_tokens_qr_token_key UNIQUE (qr_token);


--
-- Name: agente_recorrido_gps agente_recorrido_gps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_recorrido_gps
    ADD CONSTRAINT agente_recorrido_gps_pkey PRIMARY KEY (id);


--
-- Name: amonestacion_causales_legales amonestacion_causales_legales_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amonestacion_causales_legales
    ADD CONSTRAINT amonestacion_causales_legales_codigo_key UNIQUE (codigo);


--
-- Name: amonestacion_causales_legales amonestacion_causales_legales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amonestacion_causales_legales
    ADD CONSTRAINT amonestacion_causales_legales_pkey PRIMARY KEY (id);


--
-- Name: amonestacion_motivos amonestacion_motivos_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amonestacion_motivos
    ADD CONSTRAINT amonestacion_motivos_nombre_key UNIQUE (nombre);


--
-- Name: amonestacion_motivos amonestacion_motivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amonestacion_motivos
    ADD CONSTRAINT amonestacion_motivos_pkey PRIMARY KEY (id);


--
-- Name: amonestacion_solicitudes_creacion amonestacion_solicitudes_creacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amonestacion_solicitudes_creacion
    ADD CONSTRAINT amonestacion_solicitudes_creacion_pkey PRIMARY KEY (id);


--
-- Name: amonestacion_solicitudes_modificacion amonestacion_solicitudes_modificacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amonestacion_solicitudes_modificacion
    ADD CONSTRAINT amonestacion_solicitudes_modificacion_pkey PRIMARY KEY (id);


--
-- Name: amonestaciones amonestaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amonestaciones
    ADD CONSTRAINT amonestaciones_pkey PRIMARY KEY (id);


--
-- Name: anticipos anticipos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.anticipos
    ADD CONSTRAINT anticipos_pkey PRIMARY KEY (id);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: arma_custodia arma_custodia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arma_custodia
    ADD CONSTRAINT arma_custodia_pkey PRIMARY KEY (id);


--
-- Name: arma_ordenes_servicio arma_ordenes_servicio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arma_ordenes_servicio
    ADD CONSTRAINT arma_ordenes_servicio_pkey PRIMARY KEY (id);


--
-- Name: arma_sugerencias arma_sugerencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arma_sugerencias
    ADD CONSTRAINT arma_sugerencias_pkey PRIMARY KEY (id);


--
-- Name: armas_alertas armas_alertas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.armas_alertas
    ADD CONSTRAINT armas_alertas_pkey PRIMARY KEY (id);


--
-- Name: armas armas_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.armas
    ADD CONSTRAINT armas_codigo_key UNIQUE (codigo);


--
-- Name: armas armas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.armas
    ADD CONSTRAINT armas_pkey PRIMARY KEY (id);


--
-- Name: barraca_asignaciones barraca_asignaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barraca_asignaciones
    ADD CONSTRAINT barraca_asignaciones_pkey PRIMARY KEY (id);


--
-- Name: barracas barracas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barracas
    ADD CONSTRAINT barracas_pkey PRIMARY KEY (id);


--
-- Name: bodega_articulos bodega_articulos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_articulos
    ADD CONSTRAINT bodega_articulos_pkey PRIMARY KEY (id);


--
-- Name: bodega_categorias bodega_categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_categorias
    ADD CONSTRAINT bodega_categorias_pkey PRIMARY KEY (id);


--
-- Name: bodega_movimientos bodega_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_movimientos
    ADD CONSTRAINT bodega_movimientos_pkey PRIMARY KEY (id);


--
-- Name: bodega_solicitudes bodega_solicitudes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_solicitudes
    ADD CONSTRAINT bodega_solicitudes_pkey PRIMARY KEY (id);


--
-- Name: bodega_unidades bodega_unidades_codigo_inventario_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_unidades
    ADD CONSTRAINT bodega_unidades_codigo_inventario_key UNIQUE (codigo_inventario);


--
-- Name: bodega_unidades bodega_unidades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_unidades
    ADD CONSTRAINT bodega_unidades_pkey PRIMARY KEY (id);


--
-- Name: cambios_salariales cambios_salariales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cambios_salariales
    ADD CONSTRAINT cambios_salariales_pkey PRIMARY KEY (id);


--
-- Name: cierre_auditoria cierre_auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierre_auditoria
    ADD CONSTRAINT cierre_auditoria_pkey PRIMARY KEY (id);


--
-- Name: cierre_operativo_diario cierre_operativo_diario_fecha_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierre_operativo_diario
    ADD CONSTRAINT cierre_operativo_diario_fecha_key UNIQUE (fecha);


--
-- Name: cierre_operativo_diario cierre_operativo_diario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierre_operativo_diario
    ADD CONSTRAINT cierre_operativo_diario_pkey PRIMARY KEY (id);


--
-- Name: client_aliases client_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_aliases
    ADD CONSTRAINT client_aliases_pkey PRIMARY KEY (id);


--
-- Name: client_sedes client_sedes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_sedes
    ADD CONSTRAINT client_sedes_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: clients clients_portal_cliente_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_portal_cliente_id_unique UNIQUE (portal_cliente_id);


--
-- Name: cobertura_diaria cobertura_diaria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobertura_diaria
    ADD CONSTRAINT cobertura_diaria_pkey PRIMARY KEY (id);


--
-- Name: cobertura_segmentos cobertura_segmentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobertura_segmentos
    ADD CONSTRAINT cobertura_segmentos_pkey PRIMARY KEY (id);


--
-- Name: config_empresa config_empresa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config_empresa
    ADD CONSTRAINT config_empresa_pkey PRIMARY KEY (id);


--
-- Name: config_tarifa_he config_tarifa_he_jornada_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config_tarifa_he
    ADD CONSTRAINT config_tarifa_he_jornada_key UNIQUE (jornada);


--
-- Name: config_tarifa_he config_tarifa_he_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config_tarifa_he
    ADD CONSTRAINT config_tarifa_he_pkey PRIMARY KEY (id);


--
-- Name: contratos_empleados contratos_empleados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contratos_empleados
    ADD CONSTRAINT contratos_empleados_pkey PRIMARY KEY (id);


--
-- Name: custodia_asignacion_diaria custodia_asignacion_diaria_cliente_id_fecha_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_asignacion_diaria
    ADD CONSTRAINT custodia_asignacion_diaria_cliente_id_fecha_employee_id_key UNIQUE (cliente_id, fecha, employee_id);


--
-- Name: custodia_asignacion_diaria custodia_asignacion_diaria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_asignacion_diaria
    ADD CONSTRAINT custodia_asignacion_diaria_pkey PRIMARY KEY (id);


--
-- Name: custodia_excepciones custodia_excepciones_cliente_id_fecha_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_excepciones
    ADD CONSTRAINT custodia_excepciones_cliente_id_fecha_key UNIQUE (cliente_id, fecha);


--
-- Name: custodia_excepciones custodia_excepciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_excepciones
    ADD CONSTRAINT custodia_excepciones_pkey PRIMARY KEY (id);


--
-- Name: custodia_fuerza_semanal custodia_fuerza_semanal_cliente_id_dia_semana_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_fuerza_semanal
    ADD CONSTRAINT custodia_fuerza_semanal_cliente_id_dia_semana_key UNIQUE (cliente_id, dia_semana);


--
-- Name: custodia_fuerza_semanal custodia_fuerza_semanal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_fuerza_semanal
    ADD CONSTRAINT custodia_fuerza_semanal_pkey PRIMARY KEY (id);


--
-- Name: custodia_sync_log custodia_sync_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_sync_log
    ADD CONSTRAINT custodia_sync_log_pkey PRIMARY KEY (id);


--
-- Name: custodia_titulares custodia_titulares_cliente_id_slot_numero_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_titulares
    ADD CONSTRAINT custodia_titulares_cliente_id_slot_numero_employee_id_key UNIQUE (cliente_id, slot_numero, employee_id);


--
-- Name: custodia_titulares custodia_titulares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_titulares
    ADD CONSTRAINT custodia_titulares_pkey PRIMARY KEY (id);


--
-- Name: detalle_lib_sal detalle_lib_sal_empl_numero_lbl_ano_lbl_mes_lbl_pla_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_lib_sal
    ADD CONSTRAINT detalle_lib_sal_empl_numero_lbl_ano_lbl_mes_lbl_pla_key UNIQUE (empl_numero, lbl_ano, lbl_mes, lbl_pla);


--
-- Name: detalle_lib_sal detalle_lib_sal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_lib_sal
    ADD CONSTRAINT detalle_lib_sal_pkey PRIMARY KEY (id);


--
-- Name: detalle_prestaciones_odbc detalle_prestaciones_odbc_empl_numero_pre_ano_pre_mes_pla_n_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_prestaciones_odbc
    ADD CONSTRAINT detalle_prestaciones_odbc_empl_numero_pre_ano_pre_mes_pla_n_key UNIQUE (empl_numero, pre_ano, pre_mes, pla_numero);


--
-- Name: detalle_prestaciones_odbc detalle_prestaciones_odbc_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_prestaciones_odbc
    ADD CONSTRAINT detalle_prestaciones_odbc_pkey PRIMARY KEY (id);


--
-- Name: device_reports_cleanup device_reports_cleanup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_reports_cleanup
    ADD CONSTRAINT device_reports_cleanup_pkey PRIMARY KEY (id);


--
-- Name: device_reports device_reports_device_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_reports
    ADD CONSTRAINT device_reports_device_id_key UNIQUE (device_id);


--
-- Name: device_reports device_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_reports
    ADD CONSTRAINT device_reports_pkey PRIMARY KEY (id);


--
-- Name: dotacion_pendiente_items dotacion_pendiente_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dotacion_pendiente_items
    ADD CONSTRAINT dotacion_pendiente_items_pkey PRIMARY KEY (id);


--
-- Name: dotacion_pendiente dotacion_pendiente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dotacion_pendiente
    ADD CONSTRAINT dotacion_pendiente_pkey PRIMARY KEY (id);


--
-- Name: empleados_periodos_laborales empleados_periodos_laborales_employee_id_numero_periodo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empleados_periodos_laborales
    ADD CONSTRAINT empleados_periodos_laborales_employee_id_numero_periodo_key UNIQUE (employee_id, numero_periodo);


--
-- Name: empleados_periodos_laborales empleados_periodos_laborales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empleados_periodos_laborales
    ADD CONSTRAINT empleados_periodos_laborales_pkey PRIMARY KEY (id);


--
-- Name: employee_descanso_semanal employee_descanso_semanal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_descanso_semanal
    ADD CONSTRAINT employee_descanso_semanal_pkey PRIMARY KEY (id);


--
-- Name: employee_operational_assignments employee_operational_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_operational_assignments
    ADD CONSTRAINT employee_operational_assignments_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: entregas_uniforme_cuotas entregas_uniforme_cuotas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entregas_uniforme_cuotas
    ADD CONSTRAINT entregas_uniforme_cuotas_pkey PRIMARY KEY (id);


--
-- Name: entregas_uniforme entregas_uniforme_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entregas_uniforme
    ADD CONSTRAINT entregas_uniforme_pkey PRIMARY KEY (id);


--
-- Name: eventos_rrhh eventos_rrhh_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_rrhh
    ADD CONSTRAINT eventos_rrhh_pkey PRIMARY KEY (id);


--
-- Name: historial_lib_sal historial_lib_sal_empl_numero_lbl_ano_lbl_mes_lbl_pla_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_lib_sal
    ADD CONSTRAINT historial_lib_sal_empl_numero_lbl_ano_lbl_mes_lbl_pla_key UNIQUE (empl_numero, lbl_ano, lbl_mes, lbl_pla);


--
-- Name: historial_lib_sal historial_lib_sal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_lib_sal
    ADD CONSTRAINT historial_lib_sal_pkey PRIMARY KEY (id);


--
-- Name: historial_prestaciones_externas historial_prestaciones_externas_employee_id_tipo_anio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_prestaciones_externas
    ADD CONSTRAINT historial_prestaciones_externas_employee_id_tipo_anio_key UNIQUE (employee_id, tipo, anio);


--
-- Name: historial_prestaciones_externas historial_prestaciones_externas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_prestaciones_externas
    ADD CONSTRAINT historial_prestaciones_externas_pkey PRIMARY KEY (id);


--
-- Name: igss_config_patrono igss_config_patrono_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.igss_config_patrono
    ADD CONSTRAINT igss_config_patrono_pkey PRIMARY KEY (id);


--
-- Name: incentivos_cash_cobertura incentivos_cash_cobertura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incentivos_cash_cobertura
    ADD CONSTRAINT incentivos_cash_cobertura_pkey PRIMARY KEY (id);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: kit_ingreso_items kit_ingreso_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kit_ingreso_items
    ADD CONSTRAINT kit_ingreso_items_pkey PRIMARY KEY (id);


--
-- Name: lead_dotacion_items lead_dotacion_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_dotacion_items
    ADD CONSTRAINT lead_dotacion_items_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: movimientos_operativos movimientos_operativos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_operativos
    ADD CONSTRAINT movimientos_operativos_pkey PRIMARY KEY (id);


--
-- Name: nfc_audit_log nfc_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_audit_log
    ADD CONSTRAINT nfc_audit_log_pkey PRIMARY KEY (id);


--
-- Name: nfc_devices nfc_devices_device_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_devices
    ADD CONSTRAINT nfc_devices_device_code_key UNIQUE (device_code);


--
-- Name: nfc_devices nfc_devices_device_uuid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_devices
    ADD CONSTRAINT nfc_devices_device_uuid_key UNIQUE (device_uuid);


--
-- Name: nfc_devices nfc_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_devices
    ADD CONSTRAINT nfc_devices_pkey PRIMARY KEY (id);


--
-- Name: nfc_ronda_eventos nfc_ronda_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_ronda_eventos
    ADD CONSTRAINT nfc_ronda_eventos_pkey PRIMARY KEY (id);


--
-- Name: nfc_ronda_puntos nfc_ronda_puntos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_ronda_puntos
    ADD CONSTRAINT nfc_ronda_puntos_pkey PRIMARY KEY (id);


--
-- Name: nfc_sandbox_schedules nfc_sandbox_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_sandbox_schedules
    ADD CONSTRAINT nfc_sandbox_schedules_pkey PRIMARY KEY (id);


--
-- Name: nfc_shift_events nfc_shift_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_shift_events
    ADD CONSTRAINT nfc_shift_events_pkey PRIMARY KEY (id);


--
-- Name: nfc_supervisor_form_items nfc_supervisor_form_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_supervisor_form_items
    ADD CONSTRAINT nfc_supervisor_form_items_pkey PRIMARY KEY (id);


--
-- Name: nfc_supervisor_forms nfc_supervisor_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_supervisor_forms
    ADD CONSTRAINT nfc_supervisor_forms_pkey PRIMARY KEY (id);


--
-- Name: nfc_tags nfc_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_tags
    ADD CONSTRAINT nfc_tags_pkey PRIMARY KEY (id);


--
-- Name: nfc_tags nfc_tags_tag_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_tags
    ADD CONSTRAINT nfc_tags_tag_uid_key UNIQUE (tag_uid);


--
-- Name: nomina_feriado_pago nomina_feriado_pago_employee_id_periodo_desde_periodo_hasta_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nomina_feriado_pago
    ADD CONSTRAINT nomina_feriado_pago_employee_id_periodo_desde_periodo_hasta_key UNIQUE (employee_id, periodo_desde, periodo_hasta, feriado_fecha);


--
-- Name: nomina_feriado_pago nomina_feriado_pago_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nomina_feriado_pago
    ADD CONSTRAINT nomina_feriado_pago_pkey PRIMARY KEY (id);


--
-- Name: nomina_feriados nomina_feriados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nomina_feriados
    ADD CONSTRAINT nomina_feriados_pkey PRIMARY KEY (id);


--
-- Name: novedades_nomina_diarias novedades_nomina_diarias_fecha_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novedades_nomina_diarias
    ADD CONSTRAINT novedades_nomina_diarias_fecha_employee_id_key UNIQUE (fecha, employee_id);


--
-- Name: novedades_nomina_diarias novedades_nomina_diarias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novedades_nomina_diarias
    ADD CONSTRAINT novedades_nomina_diarias_pkey PRIMARY KEY (id);


--
-- Name: operational_zones operational_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_zones
    ADD CONSTRAINT operational_zones_pkey PRIMARY KEY (id);


--
-- Name: ordenes_compra_items ordenes_compra_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra_items
    ADD CONSTRAINT ordenes_compra_items_pkey PRIMARY KEY (id);


--
-- Name: ordenes_compra ordenes_compra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra
    ADD CONSTRAINT ordenes_compra_pkey PRIMARY KEY (id);


--
-- Name: page_content page_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_content
    ADD CONSTRAINT page_content_pkey PRIMARY KEY (page_key);


--
-- Name: permisos_ruta_rol permisos_ruta_rol_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_ruta_rol
    ADD CONSTRAINT permisos_ruta_rol_pkey PRIMARY KEY (id);


--
-- Name: permisos_ruta_rol permisos_ruta_rol_rol_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permisos_ruta_rol
    ADD CONSTRAINT permisos_ruta_rol_rol_path_key UNIQUE (rol, path);


--
-- Name: personal_slots personal_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_slots
    ADD CONSTRAINT personal_slots_pkey PRIMARY KEY (id);


--
-- Name: phone_auth_log phone_auth_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_auth_log
    ADD CONSTRAINT phone_auth_log_pkey PRIMARY KEY (id);


--
-- Name: planificacion_futura planificacion_futura_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planificacion_futura
    ADD CONSTRAINT planificacion_futura_pkey PRIMARY KEY (id);


--
-- Name: planilla_lineas planilla_lineas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planilla_lineas
    ADD CONSTRAINT planilla_lineas_pkey PRIMARY KEY (id);


--
-- Name: planillas_especiales_lineas planillas_especiales_lineas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planillas_especiales_lineas
    ADD CONSTRAINT planillas_especiales_lineas_pkey PRIMARY KEY (id);


--
-- Name: planillas_especiales_pagos planillas_especiales_pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planillas_especiales_pagos
    ADD CONSTRAINT planillas_especiales_pagos_pkey PRIMARY KEY (id);


--
-- Name: planillas_especiales_pagos planillas_especiales_pagos_planilla_especial_id_numero_pago_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planillas_especiales_pagos
    ADD CONSTRAINT planillas_especiales_pagos_planilla_especial_id_numero_pago_key UNIQUE (planilla_especial_id, numero_pago);


--
-- Name: planillas_especiales planillas_especiales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planillas_especiales
    ADD CONSTRAINT planillas_especiales_pkey PRIMARY KEY (id);


--
-- Name: planillas planillas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planillas
    ADD CONSTRAINT planillas_pkey PRIMARY KEY (id);


--
-- Name: plantillas_contrato plantillas_contrato_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantillas_contrato
    ADD CONSTRAINT plantillas_contrato_pkey PRIMARY KEY (id);


--
-- Name: position_aliases position_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.position_aliases
    ADD CONSTRAINT position_aliases_pkey PRIMARY KEY (id);


--
-- Name: pre_planilla_auditoria pre_planilla_auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_planilla_auditoria
    ADD CONSTRAINT pre_planilla_auditoria_pkey PRIMARY KEY (id);


--
-- Name: pre_planilla_cierres pre_planilla_cierres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_planilla_cierres
    ADD CONSTRAINT pre_planilla_cierres_pkey PRIMARY KEY (id);


--
-- Name: pre_planilla_dias_anticipados pre_planilla_dias_anticipados_periodo_desde_periodo_hasta_f_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_planilla_dias_anticipados
    ADD CONSTRAINT pre_planilla_dias_anticipados_periodo_desde_periodo_hasta_f_key UNIQUE (periodo_desde, periodo_hasta, fecha);


--
-- Name: pre_planilla_dias_anticipados pre_planilla_dias_anticipados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_planilla_dias_anticipados
    ADD CONSTRAINT pre_planilla_dias_anticipados_pkey PRIMARY KEY (id);


--
-- Name: pre_planilla_revision pre_planilla_revision_employee_id_periodo_desde_periodo_has_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_planilla_revision
    ADD CONSTRAINT pre_planilla_revision_employee_id_periodo_desde_periodo_has_key UNIQUE (employee_id, periodo_desde, periodo_hasta);


--
-- Name: pre_planilla_revision pre_planilla_revision_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_planilla_revision
    ADD CONSTRAINT pre_planilla_revision_pkey PRIMARY KEY (id);


--
-- Name: prestaciones_acumulados prestaciones_acumulados_employee_id_tipo_anio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_acumulados
    ADD CONSTRAINT prestaciones_acumulados_employee_id_tipo_anio_key UNIQUE (employee_id, tipo, anio);


--
-- Name: prestaciones_acumulados prestaciones_acumulados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_acumulados
    ADD CONSTRAINT prestaciones_acumulados_pkey PRIMARY KEY (id);


--
-- Name: prestaciones_config prestaciones_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_config
    ADD CONSTRAINT prestaciones_config_pkey PRIMARY KEY (id);


--
-- Name: prestaciones_liquidacion_detalle prestaciones_liquidacion_detalle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_liquidacion_detalle
    ADD CONSTRAINT prestaciones_liquidacion_detalle_pkey PRIMARY KEY (id);


--
-- Name: prestaciones_liquidacion_ediciones prestaciones_liquidacion_ediciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_liquidacion_ediciones
    ADD CONSTRAINT prestaciones_liquidacion_ediciones_pkey PRIMARY KEY (id);


--
-- Name: prestaciones_liquidaciones prestaciones_liquidaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_liquidaciones
    ADD CONSTRAINT prestaciones_liquidaciones_pkey PRIMARY KEY (id);


--
-- Name: prestaciones_movimientos prestaciones_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_movimientos
    ADD CONSTRAINT prestaciones_movimientos_pkey PRIMARY KEY (id);


--
-- Name: prestaciones_provisiones prestaciones_provisiones_periodo_desde_periodo_hasta_tipo_e_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_provisiones
    ADD CONSTRAINT prestaciones_provisiones_periodo_desde_periodo_hasta_tipo_e_key UNIQUE (periodo_desde, periodo_hasta, tipo, employee_id);


--
-- Name: prestaciones_provisiones prestaciones_provisiones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_provisiones
    ADD CONSTRAINT prestaciones_provisiones_pkey PRIMARY KEY (id);


--
-- Name: puesto_municion puesto_municion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puesto_municion
    ADD CONSTRAINT puesto_municion_pkey PRIMARY KEY (id);


--
-- Name: puesto_slots puesto_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puesto_slots
    ADD CONSTRAINT puesto_slots_pkey PRIMARY KEY (id);


--
-- Name: puesto_titular_historico puesto_titular_historico_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puesto_titular_historico
    ADD CONSTRAINT puesto_titular_historico_pkey PRIMARY KEY (id);


--
-- Name: puesto_titulares puesto_titulares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puesto_titulares
    ADD CONSTRAINT puesto_titulares_pkey PRIMARY KEY (id);


--
-- Name: puesto_titulares puesto_titulares_puesto_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puesto_titulares
    ADD CONSTRAINT puesto_titulares_puesto_id_employee_id_key UNIQUE (puesto_id, employee_id);


--
-- Name: puestos_gps puestos_gps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puestos_gps
    ADD CONSTRAINT puestos_gps_pkey PRIMARY KEY (id);


--
-- Name: puestos_gps puestos_gps_puesto_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puestos_gps
    ADD CONSTRAINT puestos_gps_puesto_id_key UNIQUE (puesto_id);


--
-- Name: puestos_operativos puestos_operativos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puestos_operativos
    ADD CONSTRAINT puestos_operativos_pkey PRIMARY KEY (id);


--
-- Name: push_envios push_envios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_envios
    ADD CONSTRAINT push_envios_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_token_key UNIQUE (token);


--
-- Name: qr_ronda_eventos qr_ronda_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_ronda_eventos
    ADD CONSTRAINT qr_ronda_eventos_pkey PRIMARY KEY (id);


--
-- Name: qr_ronda_puntos qr_ronda_puntos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_ronda_puntos
    ADD CONSTRAINT qr_ronda_puntos_pkey PRIMARY KEY (id);


--
-- Name: qr_ronda_puntos qr_ronda_puntos_qr_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_ronda_puntos
    ADD CONSTRAINT qr_ronda_puntos_qr_token_key UNIQUE (qr_token);


--
-- Name: qr_rondas qr_rondas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_rondas
    ADD CONSTRAINT qr_rondas_pkey PRIMARY KEY (id);


--
-- Name: relevo_equipo_novedades relevo_equipo_novedades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relevo_equipo_novedades
    ADD CONSTRAINT relevo_equipo_novedades_pkey PRIMARY KEY (id);


--
-- Name: reporte_turno reporte_turno_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reporte_turno
    ADD CONSTRAINT reporte_turno_pkey PRIMARY KEY (id);


--
-- Name: rol_permisos rol_permisos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol_permisos
    ADD CONSTRAINT rol_permisos_pkey PRIMARY KEY (rol_clave, modulo_clave);


--
-- Name: rrhh_alertas rrhh_alertas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rrhh_alertas
    ADD CONSTRAINT rrhh_alertas_pkey PRIMARY KEY (id);


--
-- Name: seguros_config seguros_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seguros_config
    ADD CONSTRAINT seguros_config_pkey PRIMARY KEY (id);


--
-- Name: service_locations service_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_locations
    ADD CONSTRAINT service_locations_pkey PRIMARY KEY (id);


--
-- Name: solicitudes_cambio_operativo solicitudes_cambio_operativo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_cambio_operativo
    ADD CONSTRAINT solicitudes_cambio_operativo_pkey PRIMARY KEY (id);


--
-- Name: solicitudes_cambio_turno solicitudes_cambio_turno_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_cambio_turno
    ADD CONSTRAINT solicitudes_cambio_turno_pkey PRIMARY KEY (id);


--
-- Name: solicitudes_eliminacion solicitudes_eliminacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_eliminacion
    ADD CONSTRAINT solicitudes_eliminacion_pkey PRIMARY KEY (id);


--
-- Name: solicitudes_empleo solicitudes_empleo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_empleo
    ADD CONSTRAINT solicitudes_empleo_pkey PRIMARY KEY (id);


--
-- Name: solicitudes_merge_requests solicitudes_merge_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_merge_requests
    ADD CONSTRAINT solicitudes_merge_requests_pkey PRIMARY KEY (id);


--
-- Name: solicitudes_servicio_adicional solicitudes_servicio_adicional_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_servicio_adicional
    ADD CONSTRAINT solicitudes_servicio_adicional_pkey PRIMARY KEY (id);


--
-- Name: ssa_agentes ssa_agentes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ssa_agentes
    ADD CONSTRAINT ssa_agentes_pkey PRIMARY KEY (id);


--
-- Name: ssa_historial_cambios ssa_historial_cambios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ssa_historial_cambios
    ADD CONSTRAINT ssa_historial_cambios_pkey PRIMARY KEY (id);


--
-- Name: supervision_catalogo_items supervision_catalogo_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_catalogo_items
    ADD CONSTRAINT supervision_catalogo_items_pkey PRIMARY KEY (id);


--
-- Name: supervision_geofence_eventos supervision_geofence_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_geofence_eventos
    ADD CONSTRAINT supervision_geofence_eventos_pkey PRIMARY KEY (id);


--
-- Name: supervision_gps_tracks supervision_gps_tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_gps_tracks
    ADD CONSTRAINT supervision_gps_tracks_pkey PRIMARY KEY (id);


--
-- Name: supervision_inspecciones supervision_inspecciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_inspecciones
    ADD CONSTRAINT supervision_inspecciones_pkey PRIMARY KEY (id);


--
-- Name: supervision_novedades supervision_novedades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_novedades
    ADD CONSTRAINT supervision_novedades_pkey PRIMARY KEY (id);


--
-- Name: supervision_plan_mensual supervision_plan_mensual_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_plan_mensual
    ADD CONSTRAINT supervision_plan_mensual_pkey PRIMARY KEY (id);


--
-- Name: supervision_sesiones supervision_sesiones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_sesiones
    ADD CONSTRAINT supervision_sesiones_pkey PRIMARY KEY (id);


--
-- Name: supervision_visitas_programadas supervision_visitas_programadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_visitas_programadas
    ADD CONSTRAINT supervision_visitas_programadas_pkey PRIMARY KEY (id);


--
-- Name: supervisor_devices supervisor_devices_device_uuid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisor_devices
    ADD CONSTRAINT supervisor_devices_device_uuid_key UNIQUE (device_uuid);


--
-- Name: supervisor_devices supervisor_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisor_devices
    ADD CONSTRAINT supervisor_devices_pkey PRIMARY KEY (id);


--
-- Name: system_config system_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_pkey PRIMARY KEY (key);


--
-- Name: system_roles system_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_roles
    ADD CONSTRAINT system_roles_pkey PRIMARY KEY (clave);


--
-- Name: tareas tareas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tareas
    ADD CONSTRAINT tareas_pkey PRIMARY KEY (id);


--
-- Name: task_evidencias task_evidencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_evidencias
    ADD CONSTRAINT task_evidencias_pkey PRIMARY KEY (id);


--
-- Name: tipos_personal_config tipos_personal_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_personal_config
    ADD CONSTRAINT tipos_personal_config_pkey PRIMARY KEY (clave);


--
-- Name: turnos turnos_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos
    ADD CONSTRAINT turnos_nombre_key UNIQUE (nombre);


--
-- Name: turnos turnos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos
    ADD CONSTRAINT turnos_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: usuarios_clientes usuarios_clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_clientes
    ADD CONSTRAINT usuarios_clientes_pkey PRIMARY KEY (id);


--
-- Name: usuarios_clientes usuarios_clientes_user_id_portal_cliente_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_clientes
    ADD CONSTRAINT usuarios_clientes_user_id_portal_cliente_id_key UNIQUE (user_id, portal_cliente_id);


--
-- Name: vacaciones_movimientos vacaciones_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vacaciones_movimientos
    ADD CONSTRAINT vacaciones_movimientos_pkey PRIMARY KEY (id);


--
-- Name: vacaciones_saldos vacaciones_saldos_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vacaciones_saldos
    ADD CONSTRAINT vacaciones_saldos_employee_id_key UNIQUE (employee_id);


--
-- Name: vacaciones_saldos vacaciones_saldos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vacaciones_saldos
    ADD CONSTRAINT vacaciones_saldos_pkey PRIMARY KEY (id);


--
-- Name: vehiculo_custodia vehiculo_custodia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculo_custodia
    ADD CONSTRAINT vehiculo_custodia_pkey PRIMARY KEY (id);


--
-- Name: vehiculos vehiculos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculos
    ADD CONSTRAINT vehiculos_pkey PRIMARY KEY (id);


--
-- Name: vehiculos vehiculos_placa_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculos
    ADD CONSTRAINT vehiculos_placa_key UNIQUE (placa);


--
-- Name: visitas visitas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitas
    ADD CONSTRAINT visitas_pkey PRIMARY KEY (id);


--
-- Name: wa_anticipo_sessions wa_anticipo_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_anticipo_sessions
    ADD CONSTRAINT wa_anticipo_sessions_pkey PRIMARY KEY (telefono);


--
-- Name: wa_audit_log wa_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_audit_log
    ADD CONSTRAINT wa_audit_log_pkey PRIMARY KEY (id);


--
-- Name: wa_config wa_config_clave_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_config
    ADD CONSTRAINT wa_config_clave_unique UNIQUE (clave);


--
-- Name: wa_config wa_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_config
    ADD CONSTRAINT wa_config_pkey PRIMARY KEY (id);


--
-- Name: wa_menu_options wa_menu_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_menu_options
    ADD CONSTRAINT wa_menu_options_pkey PRIMARY KEY (id);


--
-- Name: wa_messages wa_messages_clave_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_messages
    ADD CONSTRAINT wa_messages_clave_unique UNIQUE (clave);


--
-- Name: wa_messages wa_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_messages
    ADD CONSTRAINT wa_messages_pkey PRIMARY KEY (id);


--
-- Name: wa_notificaciones_log wa_notificaciones_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_notificaciones_log
    ADD CONSTRAINT wa_notificaciones_log_pkey PRIMARY KEY (id);


--
-- Name: wa_phone_reg_sessions wa_phone_reg_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_phone_reg_sessions
    ADD CONSTRAINT wa_phone_reg_sessions_pkey PRIMARY KEY (telefono);


--
-- Name: wa_simulator_scenarios wa_simulator_scenarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wa_simulator_scenarios
    ADD CONSTRAINT wa_simulator_scenarios_pkey PRIMARY KEY (id);


--
-- Name: zona_supervisores zona_supervisores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zona_supervisores
    ADD CONSTRAINT zona_supervisores_pkey PRIMARY KEY (id);


--
-- Name: zona_supervisores zona_supervisores_zona_id_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zona_supervisores
    ADD CONSTRAINT zona_supervisores_zona_id_employee_id_key UNIQUE (zona_id, employee_id);


--
-- Name: ac_activa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ac_activa ON public.arma_custodia USING btree (arma_id) WHERE (fecha_fin IS NULL);


--
-- Name: ac_arma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ac_arma ON public.arma_custodia USING btree (arma_id);


--
-- Name: ac_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ac_employee ON public.arma_custodia USING btree (employee_id);


--
-- Name: af_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX af_employee ON public.agente_fichajes USING btree (employee_id);


--
-- Name: af_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX af_fecha ON public.agente_fichajes USING btree (registrado_en DESC);


--
-- Name: af_puesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX af_puesto ON public.agente_fichajes USING btree (puesto_id);


--
-- Name: af_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX af_tipo ON public.agente_fichajes USING btree (tipo);


--
-- Name: amon_emp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amon_emp_idx ON public.amonestaciones USING btree (employee_id);


--
-- Name: amon_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amon_estado_idx ON public.amonestaciones USING btree (estado);


--
-- Name: amon_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amon_fecha_idx ON public.amonestaciones USING btree (fecha);


--
-- Name: amon_pendiente_planilla; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amon_pendiente_planilla ON public.amonestaciones USING btree (employee_id, fecha) WHERE ((estado = 'activa'::text) AND (tipo = 'economica'::text) AND (descontado = false));


--
-- Name: amon_solm_amon_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amon_solm_amon_idx ON public.amonestacion_solicitudes_modificacion USING btree (amonestacion_id);


--
-- Name: amon_solm_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX amon_solm_estado_idx ON public.amonestacion_solicitudes_modificacion USING btree (estado);


--
-- Name: aord_arma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aord_arma ON public.arma_ordenes_servicio USING btree (arma_id);


--
-- Name: aord_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aord_estado ON public.arma_ordenes_servicio USING btree (estado);


--
-- Name: aord_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aord_fecha ON public.arma_ordenes_servicio USING btree (created_at DESC);


--
-- Name: aord_puesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aord_puesto ON public.arma_ordenes_servicio USING btree (puesto_id);


--
-- Name: aqt_emp_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX aqt_emp_activo ON public.agente_qr_tokens USING btree (employee_id) WHERE (activo = true);


--
-- Name: aqt_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aqt_token ON public.agente_qr_tokens USING btree (qr_token);


--
-- Name: armalert_abiertas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX armalert_abiertas ON public.armas_alertas USING btree (abierta_at DESC) WHERE ((estado)::text = 'abierta'::text);


--
-- Name: armalert_arma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX armalert_arma ON public.armas_alertas USING btree (arma_id, estado);


--
-- Name: armas_custodia_slot_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX armas_custodia_slot_uq ON public.armas USING btree (custodia_cliente_id, custodia_slot_numero) WHERE ((custodia_cliente_id IS NOT NULL) AND (custodia_slot_numero IS NOT NULL));


--
-- Name: armas_numero_portacion_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX armas_numero_portacion_uq ON public.armas USING btree (lower(TRIM(BOTH FROM numero_portacion))) WHERE ((numero_portacion IS NOT NULL) AND (TRIM(BOTH FROM numero_portacion) <> ''::text));


--
-- Name: armas_numero_tenencia_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX armas_numero_tenencia_uq ON public.armas USING btree (lower(TRIM(BOTH FROM numero_tenencia))) WHERE ((numero_tenencia IS NOT NULL) AND (TRIM(BOTH FROM numero_tenencia) <> ''::text));


--
-- Name: armas_puesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX armas_puesto ON public.armas USING btree (puesto_id);


--
-- Name: armas_puesto_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX armas_puesto_uq ON public.armas USING btree (puesto_id) WHERE ((puesto_id IS NOT NULL) AND (activo = true));


--
-- Name: armas_serie_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX armas_serie_uq ON public.armas USING btree (lower(TRIM(BOTH FROM serie))) WHERE ((serie IS NOT NULL) AND (TRIM(BOTH FROM serie) <> ''::text));


--
-- Name: ars_arma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ars_arma ON public.arma_sugerencias USING btree (arma_id);


--
-- Name: ars_atend; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ars_atend ON public.arma_sugerencias USING btree (atendido) WHERE (atendido = false);


--
-- Name: ba_cat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ba_cat ON public.bodega_articulos USING btree (categoria_id);


--
-- Name: barraca_asig_emp_activo_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX barraca_asig_emp_activo_uq ON public.barraca_asignaciones USING btree (employee_id) WHERE (activo = true);


--
-- Name: bm_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bm_date ON public.bodega_movimientos USING btree (created_at DESC);


--
-- Name: bm_unid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bm_unid ON public.bodega_movimientos USING btree (unidad_id);


--
-- Name: bsol_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bsol_estado ON public.bodega_solicitudes USING btree (estado);


--
-- Name: bsol_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bsol_fecha ON public.bodega_solicitudes USING btree (created_at DESC);


--
-- Name: bsol_puesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bsol_puesto ON public.bodega_solicitudes USING btree (puesto_id);


--
-- Name: bsol_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bsol_tipo ON public.bodega_solicitudes USING btree (tipo);


--
-- Name: bu_art; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bu_art ON public.bodega_unidades USING btree (articulo_id);


--
-- Name: bu_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bu_emp ON public.bodega_unidades USING btree (employee_id);


--
-- Name: bu_est; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bu_est ON public.bodega_unidades USING btree (estado);


--
-- Name: bu_psto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bu_psto ON public.bodega_unidades USING btree (puesto_id);


--
-- Name: cobertura_segmentos_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cobertura_segmentos_employee ON public.cobertura_segmentos USING btree (fecha, employee_id);


--
-- Name: cobertura_segmentos_fecha_puesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cobertura_segmentos_fecha_puesto ON public.cobertura_segmentos USING btree (fecha, puesto_id);


--
-- Name: contratos_emp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contratos_emp_idx ON public.contratos_empleados USING btree (employee_id);


--
-- Name: custodia_asig_diaria_cliente_fecha_emp_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX custodia_asig_diaria_cliente_fecha_emp_uq ON public.custodia_asignacion_diaria USING btree (cliente_id, fecha, employee_id);


--
-- Name: custodia_asig_diaria_cliente_fecha_slot_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX custodia_asig_diaria_cliente_fecha_slot_uq ON public.custodia_asignacion_diaria USING btree (cliente_id, fecha, slot_numero);


--
-- Name: custodia_asig_diaria_emp_cli_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX custodia_asig_diaria_emp_cli_fecha_idx ON public.custodia_asignacion_diaria USING btree (employee_id, cliente_id, fecha DESC);


--
-- Name: custodia_excepciones_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX custodia_excepciones_fecha_idx ON public.custodia_excepciones USING btree (fecha);


--
-- Name: custodia_titulares_slot_activo_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX custodia_titulares_slot_activo_uq ON public.custodia_titulares USING btree (cliente_id, slot_numero) WHERE (activo = true);


--
-- Name: device_reports_cleanup_run_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX device_reports_cleanup_run_idx ON public.device_reports_cleanup USING btree (run_at DESC);


--
-- Name: device_reports_last_seen_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX device_reports_last_seen_idx ON public.device_reports USING btree (last_seen_at DESC);


--
-- Name: device_reports_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX device_reports_user_idx ON public.device_reports USING btree (user_id);


--
-- Name: dls_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dls_emp ON public.detalle_lib_sal USING btree (empl_numero);


--
-- Name: dls_periodo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dls_periodo ON public.detalle_lib_sal USING btree (lbl_ano, lbl_mes);


--
-- Name: dp_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dp_emp ON public.dotacion_pendiente USING btree (employee_id);


--
-- Name: dp_est; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dp_est ON public.dotacion_pendiente USING btree (estado);


--
-- Name: dpi_dot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dpi_dot ON public.dotacion_pendiente_items USING btree (dotacion_id);


--
-- Name: dprest_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dprest_emp ON public.detalle_prestaciones_odbc USING btree (empl_numero);


--
-- Name: dprest_periodo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dprest_periodo ON public.detalle_prestaciones_odbc USING btree (pre_ano, pre_mes);


--
-- Name: employees_dpi_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employees_dpi_unique ON public.employees USING btree (dpi) WHERE (dpi IS NOT NULL);


--
-- Name: eoa_activa_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eoa_activa_idx ON public.employee_operational_assignments USING btree (employee_id, activa);


--
-- Name: eoa_employee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eoa_employee_idx ON public.employee_operational_assignments USING btree (employee_id);


--
-- Name: eu_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eu_emp ON public.entregas_uniforme USING btree (employee_id);


--
-- Name: eu_est; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eu_est ON public.entregas_uniforme USING btree (estado);


--
-- Name: euc_des; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX euc_des ON public.entregas_uniforme_cuotas USING btree (descontado);


--
-- Name: euc_ent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX euc_ent ON public.entregas_uniforme_cuotas USING btree (entrega_id);


--
-- Name: hls_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hls_emp ON public.historial_lib_sal USING btree (empl_numero);


--
-- Name: hls_periodo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hls_periodo ON public.historial_lib_sal USING btree (lbl_ano, lbl_mes);


--
-- Name: hpe_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hpe_emp ON public.historial_prestaciones_externas USING btree (employee_id);


--
-- Name: idx_agente_fichajes_cliente_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agente_fichajes_cliente_id ON public.agente_fichajes USING btree (cliente_id) WHERE (cliente_id IS NOT NULL);


--
-- Name: idx_amon_sol_crea_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amon_sol_crea_estado ON public.amonestacion_solicitudes_creacion USING btree (estado);


--
-- Name: idx_amon_sol_crea_solicitante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_amon_sol_crea_solicitante ON public.amonestacion_solicitudes_creacion USING btree (solicitada_por_username);


--
-- Name: idx_cierres_periodo_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_cierres_periodo_unico ON public.pre_planilla_cierres USING btree (periodo_desde, periodo_hasta) WHERE (anulado = false);


--
-- Name: idx_clients_depto_codigo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_clients_depto_codigo ON public.clients USING btree (depto_codigo) WHERE (depto_codigo IS NOT NULL);


--
-- Name: idx_cs_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cs_employee ON public.cambios_salariales USING btree (employee_id);


--
-- Name: idx_cs_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cs_estado ON public.cambios_salariales USING btree (estado);


--
-- Name: idx_cs_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cs_fecha ON public.cambios_salariales USING btree (fecha);


--
-- Name: idx_csl_cierre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csl_cierre ON public.custodia_sync_log USING btree (cierre_id);


--
-- Name: idx_csl_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_csl_fecha ON public.custodia_sync_log USING btree (fecha);


--
-- Name: idx_emp_descanso_semanal_semana; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emp_descanso_semanal_semana ON public.employee_descanso_semanal USING btree (semana_inicio);


--
-- Name: idx_fichajes_device_origen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fichajes_device_origen ON public.agente_fichajes USING btree (device_uuid_origen, registrado_en);


--
-- Name: idx_fichajes_recorrido_padre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fichajes_recorrido_padre ON public.agente_fichajes USING btree (recorrido_padre_id);


--
-- Name: idx_merge_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_merge_estado ON public.solicitudes_merge_requests USING btree (estado);


--
-- Name: idx_merge_solicitud; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_merge_solicitud ON public.solicitudes_merge_requests USING btree (solicitud_id);


--
-- Name: idx_nnd_revision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nnd_revision ON public.novedades_nomina_diarias USING btree (requiere_revision_rrhh, impacto_nomina) WHERE (requiere_revision_rrhh = true);


--
-- Name: idx_periodos_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_periodos_emp ON public.empleados_periodos_laborales USING btree (employee_id);


--
-- Name: idx_pesp_lineas_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pesp_lineas_employee ON public.planillas_especiales_lineas USING btree (employee_id, planilla_especial_id);


--
-- Name: idx_pesp_pagos_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pesp_pagos_estado ON public.planillas_especiales_pagos USING btree (planilla_especial_id, estado);


--
-- Name: idx_pf_ssa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pf_ssa_id ON public.planificacion_futura USING btree (ssa_id) WHERE (ssa_id IS NOT NULL);


--
-- Name: idx_planificacion_futura_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_planificacion_futura_fecha ON public.planificacion_futura USING btree (fecha);


--
-- Name: idx_planillas_esp_tipo_anio_activa; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_planillas_esp_tipo_anio_activa ON public.planillas_especiales USING btree (tipo, anio) WHERE ((estado)::text <> 'anulada'::text);


--
-- Name: idx_prest_liq_edic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prest_liq_edic ON public.prestaciones_liquidacion_ediciones USING btree (liquidacion_id);


--
-- Name: idx_prest_liq_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prest_liq_employee ON public.prestaciones_liquidaciones USING btree (employee_id, estado);


--
-- Name: idx_prest_mov_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prest_mov_employee ON public.prestaciones_movimientos USING btree (employee_id, tipo_prestacion);


--
-- Name: idx_prest_prov_periodo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prest_prov_periodo ON public.prestaciones_provisiones USING btree (periodo_desde, periodo_hasta, tipo);


--
-- Name: idx_prestaciones_config_client; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_prestaciones_config_client ON public.prestaciones_config USING btree (COALESCE(client_id, 0));


--
-- Name: idx_pt_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pt_employee ON public.puesto_titulares USING btree (employee_id) WHERE (activo = true);


--
-- Name: idx_pt_puesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pt_puesto ON public.puesto_titulares USING btree (puesto_id) WHERE (activo = true);


--
-- Name: idx_pth_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pth_employee ON public.puesto_titular_historico USING btree (employee_id);


--
-- Name: idx_pth_puesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pth_puesto ON public.puesto_titular_historico USING btree (puesto_id);


--
-- Name: idx_recorrido_fichaje_capturado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recorrido_fichaje_capturado ON public.agente_recorrido_gps USING btree (fichaje_id, capturado_en);


--
-- Name: idx_rol_permisos_rol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rol_permisos_rol ON public.rol_permisos USING btree (rol_clave);


--
-- Name: idx_sco_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sco_employee ON public.solicitudes_cambio_operativo USING btree (employee_id);


--
-- Name: idx_sco_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sco_estado ON public.solicitudes_cambio_operativo USING btree (estado);


--
-- Name: idx_sct_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sct_estado ON public.solicitudes_cambio_turno USING btree (estado);


--
-- Name: idx_sct_puesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sct_puesto ON public.solicitudes_cambio_turno USING btree (puesto_id);


--
-- Name: idx_sol_empleo_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sol_empleo_created ON public.solicitudes_empleo USING btree (created_at DESC);


--
-- Name: idx_sol_empleo_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sol_empleo_estado ON public.solicitudes_empleo USING btree (estado);


--
-- Name: idx_sol_empleo_foto_expira; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sol_empleo_foto_expira ON public.solicitudes_empleo USING btree (foto_expira_at) WHERE (foto_url IS NOT NULL);


--
-- Name: idx_ssa_agentes_ssa_emp_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ssa_agentes_ssa_emp_activo ON public.ssa_agentes USING btree (ssa_id, employee_id) WHERE ((estado)::text = 'asignado'::text);


--
-- Name: idx_ssa_agentes_ssa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ssa_agentes_ssa_id ON public.ssa_agentes USING btree (ssa_id);


--
-- Name: idx_ssa_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ssa_cliente ON public.solicitudes_servicio_adicional USING btree (cliente_id);


--
-- Name: idx_ssa_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ssa_estado ON public.solicitudes_servicio_adicional USING btree (estado_general);


--
-- Name: idx_ssa_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ssa_fecha ON public.solicitudes_servicio_adicional USING btree (fecha);


--
-- Name: idx_ssa_hist_ssa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ssa_hist_ssa_id ON public.ssa_historial_cambios USING btree (ssa_id);


--
-- Name: idx_ssa_tarjeta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ssa_tarjeta ON public.solicitudes_servicio_adicional USING btree (tarjeta_activa) WHERE (tarjeta_activa = true);


--
-- Name: idx_vac_mov_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vac_mov_employee ON public.vacaciones_movimientos USING btree (employee_id, fecha);


--
-- Name: inc_cash_employee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inc_cash_employee_idx ON public.incentivos_cash_cobertura USING btree (employee_id);


--
-- Name: inc_cash_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inc_cash_fecha_idx ON public.incentivos_cash_cobertura USING btree (fecha);


--
-- Name: incidents_puesto_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidents_puesto_id ON public.incidents USING btree (puesto_id);


--
-- Name: incidents_responsable_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidents_responsable_id ON public.incidents USING btree (responsable_id);


--
-- Name: incidents_sede_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX incidents_sede_id ON public.incidents USING btree (sede_id);


--
-- Name: ldi_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ldi_lead ON public.lead_dotacion_items USING btree (lead_id);


--
-- Name: nfc_al_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nfc_al_at ON public.nfc_audit_log USING btree (created_at DESC);


--
-- Name: nfc_dev_puesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nfc_dev_puesto ON public.nfc_devices USING btree (puesto_id_ref);


--
-- Name: nfc_dev_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nfc_dev_status ON public.nfc_devices USING btree (status);


--
-- Name: nfc_dev_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nfc_dev_uuid ON public.nfc_devices USING btree (device_uuid);


--
-- Name: nfc_ev_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nfc_ev_at ON public.nfc_shift_events USING btree (event_at DESC);


--
-- Name: nfc_ev_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nfc_ev_tag ON public.nfc_shift_events USING btree (tag_id);


--
-- Name: nfc_ev_val; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nfc_ev_val ON public.nfc_shift_events USING btree (validation_status);


--
-- Name: nfc_re_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nfc_re_at ON public.nfc_ronda_eventos USING btree (escaneado_en DESC);


--
-- Name: nfc_re_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nfc_re_device ON public.nfc_ronda_eventos USING btree (device_id);


--
-- Name: nfc_re_punto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nfc_re_punto ON public.nfc_ronda_eventos USING btree (ronda_punto_id);


--
-- Name: nfc_rp_puesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nfc_rp_puesto ON public.nfc_ronda_puntos USING btree (puesto_id);


--
-- Name: nfc_rp_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX nfc_rp_uid ON public.nfc_ronda_puntos USING btree (tag_uid) WHERE (activo = true);


--
-- Name: nfc_sf_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nfc_sf_at ON public.nfc_supervisor_forms USING btree (created_at DESC);


--
-- Name: nfc_sf_puesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nfc_sf_puesto ON public.nfc_supervisor_forms USING btree (puesto_id_ref);


--
-- Name: nfc_sfi_form; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nfc_sfi_form ON public.nfc_supervisor_form_items USING btree (form_id);


--
-- Name: nfc_tag_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nfc_tag_emp ON public.nfc_tags USING btree (empleado_id_ref);


--
-- Name: nfc_tag_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nfc_tag_status ON public.nfc_tags USING btree (status);


--
-- Name: nomina_feriado_pago_periodo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nomina_feriado_pago_periodo_idx ON public.nomina_feriado_pago USING btree (periodo_desde, periodo_hasta);


--
-- Name: nomina_feriados_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nomina_feriados_fecha_idx ON public.nomina_feriados USING btree (fecha);


--
-- Name: nomina_feriados_fecha_nombre_cliente_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX nomina_feriados_fecha_nombre_cliente_uq ON public.nomina_feriados USING btree (fecha, nombre, COALESCE(cliente_nombre, ''::character varying));


--
-- Name: novedades_nomina_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX novedades_nomina_employee ON public.novedades_nomina_diarias USING btree (employee_id);


--
-- Name: novedades_nomina_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX novedades_nomina_fecha ON public.novedades_nomina_diarias USING btree (fecha);


--
-- Name: oc_est; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX oc_est ON public.ordenes_compra USING btree (estado);


--
-- Name: oc_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX oc_lead ON public.ordenes_compra USING btree (lead_id);


--
-- Name: oci_ord; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX oci_ord ON public.ordenes_compra_items USING btree (orden_id);


--
-- Name: persslot_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persslot_activo ON public.personal_slots USING btree (activo) WHERE (activo = true);


--
-- Name: persslot_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persslot_emp ON public.personal_slots USING btree (employee_id);


--
-- Name: persslot_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX persslot_tipo ON public.personal_slots USING btree (tipo) WHERE (activo = true);


--
-- Name: plan_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plan_estado_idx ON public.planillas USING btree (estado);


--
-- Name: planillas_periodo_activa_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX planillas_periodo_activa_idx ON public.planillas USING btree (periodo_desde, periodo_hasta) WHERE (anulada = false);


--
-- Name: planl_planilla_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX planl_planilla_idx ON public.planilla_lineas USING btree (planilla_id);


--
-- Name: plantillas_contrato_tipo_activa_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plantillas_contrato_tipo_activa_idx ON public.plantillas_contrato USING btree (tipo, activa);


--
-- Name: pm_puesto_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pm_puesto_activo ON public.puesto_municion USING btree (puesto_id) WHERE (activo = true);


--
-- Name: ppa_periodo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ppa_periodo_idx ON public.pre_planilla_auditoria USING btree (periodo_desde, periodo_hasta);


--
-- Name: ppc_periodo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ppc_periodo_idx ON public.pre_planilla_cierres USING btree (periodo_desde, periodo_hasta);


--
-- Name: ppda_estado_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ppda_estado_fecha_idx ON public.pre_planilla_dias_anticipados USING btree (estado, fecha);


--
-- Name: ppr_periodo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ppr_periodo_idx ON public.pre_planilla_revision USING btree (periodo_desde, periodo_hasta);


--
-- Name: ps_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ps_activo ON public.puesto_slots USING btree (activo) WHERE (activo = true);


--
-- Name: ps_empleado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ps_empleado ON public.puesto_slots USING btree (empleado_id);


--
-- Name: ps_puesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ps_puesto ON public.puesto_slots USING btree (puesto_id);


--
-- Name: push_envios_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_envios_created_idx ON public.push_envios USING btree (created_at DESC);


--
-- Name: push_envios_evento_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_envios_evento_idx ON public.push_envios USING btree (evento);


--
-- Name: push_envios_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_envios_user_idx ON public.push_envios USING btree (user_id);


--
-- Name: push_tokens_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_tokens_user_idx ON public.push_tokens USING btree (user_id);


--
-- Name: qr_re_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qr_re_at ON public.qr_ronda_eventos USING btree (escaneado_en DESC);


--
-- Name: qr_re_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qr_re_emp ON public.qr_ronda_eventos USING btree (employee_id);


--
-- Name: qr_re_punto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qr_re_punto ON public.qr_ronda_eventos USING btree (punto_id);


--
-- Name: qr_re_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qr_re_user ON public.qr_ronda_eventos USING btree (user_id);


--
-- Name: qr_rondas_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qr_rondas_cliente ON public.qr_rondas USING btree (cliente_id);


--
-- Name: qr_rp_ronda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qr_rp_ronda ON public.qr_ronda_puntos USING btree (ronda_id);


--
-- Name: qr_rp_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qr_rp_token ON public.qr_ronda_puntos USING btree (qr_token);


--
-- Name: ren_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ren_fecha ON public.relevo_equipo_novedades USING btree (registrado_en DESC);


--
-- Name: ren_puesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ren_puesto ON public.relevo_equipo_novedades USING btree (puesto_id);


--
-- Name: ren_reporte; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ren_reporte ON public.relevo_equipo_novedades USING btree (reporte_id);


--
-- Name: rt_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rt_emp ON public.reporte_turno USING btree (employee_id);


--
-- Name: rt_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rt_fecha ON public.reporte_turno USING btree (registrado_en DESC);


--
-- Name: rt_fichaje; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rt_fichaje ON public.reporte_turno USING btree (fichaje_id);


--
-- Name: rt_puesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rt_puesto ON public.reporte_turno USING btree (puesto_id);


--
-- Name: sd_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sd_uuid ON public.supervisor_devices USING btree (device_uuid);


--
-- Name: supcat_uniq_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX supcat_uniq_cliente ON public.supervision_catalogo_items USING btree (cliente_id, clave) WHERE (cliente_id IS NOT NULL);


--
-- Name: supcat_uniq_global; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX supcat_uniq_global ON public.supervision_catalogo_items USING btree (clave) WHERE (cliente_id IS NULL);


--
-- Name: supgeo_puesto_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supgeo_puesto_at ON public.supervision_geofence_eventos USING btree (puesto_id, ocurrido_at DESC) WHERE (puesto_id IS NOT NULL);


--
-- Name: supgeo_sesion_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supgeo_sesion_at ON public.supervision_geofence_eventos USING btree (sesion_id, ocurrido_at DESC);


--
-- Name: supgeo_sup_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supgeo_sup_at ON public.supervision_geofence_eventos USING btree (supervisor_employee_id, ocurrido_at DESC);


--
-- Name: supgps_sesion_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supgps_sesion_at ON public.supervision_gps_tracks USING btree (sesion_id, registrado_at);


--
-- Name: supins_agente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supins_agente ON public.supervision_inspecciones USING btree (agente_employee_id, realizada_at DESC);


--
-- Name: supins_puesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supins_puesto ON public.supervision_inspecciones USING btree (puesto_id, realizada_at DESC);


--
-- Name: supins_sesion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supins_sesion ON public.supervision_inspecciones USING btree (sesion_id);


--
-- Name: supjor_sup_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supjor_sup_fecha ON public.supervision_sesiones USING btree (supervisor_employee_id, fecha);


--
-- Name: supjor_uniq_activa; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX supjor_uniq_activa ON public.supervision_sesiones USING btree (supervisor_employee_id, fecha) WHERE ((estado)::text = 'activa'::text);


--
-- Name: supnov_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supnov_fecha ON public.supervision_novedades USING btree (fecha DESC);


--
-- Name: supnov_puesto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supnov_puesto ON public.supervision_novedades USING btree (puesto_id, fecha DESC);


--
-- Name: supnov_reconocida; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supnov_reconocida ON public.supervision_novedades USING btree (tipo, reconocida_at) WHERE (tipo = 'abandono_puesto'::text);


--
-- Name: supnov_tipo_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supnov_tipo_fecha ON public.supervision_novedades USING btree (tipo, fecha DESC);


--
-- Name: supnov_uniq_sesion_puesto_v2; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX supnov_uniq_sesion_puesto_v2 ON public.supervision_novedades USING btree (sesion_id, puesto_id) WHERE (puesto_id IS NOT NULL);


--
-- Name: supnov_uniq_sesion_sin_puesto; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX supnov_uniq_sesion_sin_puesto ON public.supervision_novedades USING btree (sesion_id) WHERE (puesto_id IS NULL);


--
-- Name: supplanmes_supervisor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplanmes_supervisor_idx ON public.supervision_plan_mensual USING btree (supervisor_employee_id) WHERE (activo = true);


--
-- Name: supplanmes_uniq_sede_semana; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX supplanmes_uniq_sede_semana ON public.supervision_plan_mensual USING btree (sede_id, semana_mes);


--
-- Name: svp_fecha_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX svp_fecha_estado_idx ON public.supervision_visitas_programadas USING btree (fecha_planificada, estado);


--
-- Name: svp_sup_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX svp_sup_fecha_idx ON public.supervision_visitas_programadas USING btree (supervisor_employee_id, fecha_planificada);


--
-- Name: svp_zona_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX svp_zona_idx ON public.supervision_visitas_programadas USING btree (zona_id) WHERE (zona_id IS NOT NULL);


--
-- Name: tareas_cliente_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tareas_cliente_id ON public.tareas USING btree (cliente_id);


--
-- Name: tareas_puesto_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tareas_puesto_id ON public.tareas USING btree (puesto_id);


--
-- Name: uc_portal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX uc_portal ON public.usuarios_clientes USING btree (portal_cliente_id);


--
-- Name: uc_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX uc_user ON public.usuarios_clientes USING btree (user_id);


--
-- Name: uq_emp_descanso_semanal; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_emp_descanso_semanal ON public.employee_descanso_semanal USING btree (employee_id, semana_inicio);


--
-- Name: users_telefono_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_telefono_unique ON public.users USING btree (telefono) WHERE (telefono IS NOT NULL);


--
-- Name: vc_activa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vc_activa ON public.vehiculo_custodia USING btree (vehiculo_id) WHERE (fecha_fin IS NULL);


--
-- Name: vc_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vc_employee ON public.vehiculo_custodia USING btree (employee_id);


--
-- Name: vc_vehiculo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vc_vehiculo ON public.vehiculo_custodia USING btree (vehiculo_id);


--
-- Name: vehiculos_zona; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vehiculos_zona ON public.vehiculos USING btree (zona_operativa_id);


--
-- Name: vis_cliente_entrada; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vis_cliente_entrada ON public.visitas USING btree (cliente_id, entrada_at DESC);


--
-- Name: vis_cond_dpi_retencion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vis_cond_dpi_retencion ON public.visitas USING btree (conductor_dpi_frente_subida_en) WHERE (conductor_dpi_frente_url IS NOT NULL);


--
-- Name: vis_dpi_abiertas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vis_dpi_abiertas ON public.visitas USING btree (dpi_numero) WHERE ((salida_at IS NULL) AND (dpi_numero IS NOT NULL));


--
-- Name: vis_dpi_retencion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vis_dpi_retencion ON public.visitas USING btree (dpi_frente_subida_en) WHERE (dpi_frente_url IS NOT NULL);


--
-- Name: vis_entrada_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vis_entrada_at ON public.visitas USING btree (entrada_at DESC);


--
-- Name: vis_placa_abiertas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vis_placa_abiertas ON public.visitas USING btree (placa) WHERE ((salida_at IS NULL) AND (placa IS NOT NULL));


--
-- Name: vis_puesto_abiertas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vis_puesto_abiertas ON public.visitas USING btree (puesto_id) WHERE (salida_at IS NULL);


--
-- Name: vis_puesto_entrada; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vis_puesto_entrada ON public.visitas USING btree (puesto_id, entrada_at DESC);


--
-- Name: wa_anticipo_sessions_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wa_anticipo_sessions_expires_idx ON public.wa_anticipo_sessions USING btree (expires_at);


--
-- Name: wa_phone_reg_sessions_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wa_phone_reg_sessions_expires_idx ON public.wa_phone_reg_sessions USING btree (expires_at);


--
-- Name: zs_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX zs_emp ON public.zona_supervisores USING btree (employee_id);


--
-- Name: zs_zona; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX zs_zona ON public.zona_supervisores USING btree (zona_id);


--
-- Name: agente_fichajes agente_fichajes_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_fichajes
    ADD CONSTRAINT agente_fichajes_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: agente_fichajes agente_fichajes_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_fichajes
    ADD CONSTRAINT agente_fichajes_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: agente_fichajes agente_fichajes_recorrido_padre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_fichajes
    ADD CONSTRAINT agente_fichajes_recorrido_padre_id_fkey FOREIGN KEY (recorrido_padre_id) REFERENCES public.agente_fichajes(id) ON DELETE SET NULL;


--
-- Name: agente_fichajes agente_fichajes_supervisor_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_fichajes
    ADD CONSTRAINT agente_fichajes_supervisor_device_id_fkey FOREIGN KEY (supervisor_device_id) REFERENCES public.supervisor_devices(id) ON DELETE SET NULL;


--
-- Name: agente_fichajes agente_fichajes_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_fichajes
    ADD CONSTRAINT agente_fichajes_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: agente_qr_tokens agente_qr_tokens_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_qr_tokens
    ADD CONSTRAINT agente_qr_tokens_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: agente_recorrido_gps agente_recorrido_gps_fichaje_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agente_recorrido_gps
    ADD CONSTRAINT agente_recorrido_gps_fichaje_id_fkey FOREIGN KEY (fichaje_id) REFERENCES public.agente_fichajes(id) ON DELETE CASCADE;


--
-- Name: amonestacion_solicitudes_modificacion amonestacion_solicitudes_modificaci_solicitada_por_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amonestacion_solicitudes_modificacion
    ADD CONSTRAINT amonestacion_solicitudes_modificaci_solicitada_por_user_id_fkey FOREIGN KEY (solicitada_por_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: amonestacion_solicitudes_modificacion amonestacion_solicitudes_modificacion_amonestacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amonestacion_solicitudes_modificacion
    ADD CONSTRAINT amonestacion_solicitudes_modificacion_amonestacion_id_fkey FOREIGN KEY (amonestacion_id) REFERENCES public.amonestaciones(id) ON DELETE CASCADE;


--
-- Name: amonestaciones amonestaciones_creado_por_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amonestaciones
    ADD CONSTRAINT amonestaciones_creado_por_user_id_fkey FOREIGN KEY (creado_por_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: amonestaciones amonestaciones_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.amonestaciones
    ADD CONSTRAINT amonestaciones_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: applications applications_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: arma_custodia arma_custodia_arma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arma_custodia
    ADD CONSTRAINT arma_custodia_arma_id_fkey FOREIGN KEY (arma_id) REFERENCES public.armas(id) ON DELETE CASCADE;


--
-- Name: arma_custodia arma_custodia_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arma_custodia
    ADD CONSTRAINT arma_custodia_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: arma_custodia arma_custodia_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arma_custodia
    ADD CONSTRAINT arma_custodia_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: arma_ordenes_servicio arma_ordenes_servicio_arma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arma_ordenes_servicio
    ADD CONSTRAINT arma_ordenes_servicio_arma_id_fkey FOREIGN KEY (arma_id) REFERENCES public.armas(id) ON DELETE SET NULL;


--
-- Name: arma_ordenes_servicio arma_ordenes_servicio_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arma_ordenes_servicio
    ADD CONSTRAINT arma_ordenes_servicio_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: arma_ordenes_servicio arma_ordenes_servicio_reportado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arma_ordenes_servicio
    ADD CONSTRAINT arma_ordenes_servicio_reportado_por_fkey FOREIGN KEY (reportado_por) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: arma_sugerencias arma_sugerencias_arma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arma_sugerencias
    ADD CONSTRAINT arma_sugerencias_arma_id_fkey FOREIGN KEY (arma_id) REFERENCES public.armas(id) ON DELETE CASCADE;


--
-- Name: arma_sugerencias arma_sugerencias_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.arma_sugerencias
    ADD CONSTRAINT arma_sugerencias_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: armas_alertas armas_alertas_agente_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.armas_alertas
    ADD CONSTRAINT armas_alertas_agente_employee_id_fkey FOREIGN KEY (agente_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: armas_alertas armas_alertas_arma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.armas_alertas
    ADD CONSTRAINT armas_alertas_arma_id_fkey FOREIGN KEY (arma_id) REFERENCES public.armas(id) ON DELETE CASCADE;


--
-- Name: armas_alertas armas_alertas_cerrada_por_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.armas_alertas
    ADD CONSTRAINT armas_alertas_cerrada_por_user_id_fkey FOREIGN KEY (cerrada_por_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: armas_alertas armas_alertas_inspeccion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.armas_alertas
    ADD CONSTRAINT armas_alertas_inspeccion_id_fkey FOREIGN KEY (inspeccion_id) REFERENCES public.supervision_inspecciones(id) ON DELETE SET NULL;


--
-- Name: armas_alertas armas_alertas_sesion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.armas_alertas
    ADD CONSTRAINT armas_alertas_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES public.supervision_sesiones(id) ON DELETE SET NULL;


--
-- Name: armas_alertas armas_alertas_supervisor_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.armas_alertas
    ADD CONSTRAINT armas_alertas_supervisor_employee_id_fkey FOREIGN KEY (supervisor_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: armas armas_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.armas
    ADD CONSTRAINT armas_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: armas armas_custodia_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.armas
    ADD CONSTRAINT armas_custodia_cliente_id_fkey FOREIGN KEY (custodia_cliente_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: armas armas_custodio_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.armas
    ADD CONSTRAINT armas_custodio_employee_id_fkey FOREIGN KEY (custodio_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: armas armas_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.armas
    ADD CONSTRAINT armas_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: barraca_asignaciones barraca_asignaciones_barraca_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barraca_asignaciones
    ADD CONSTRAINT barraca_asignaciones_barraca_id_fkey FOREIGN KEY (barraca_id) REFERENCES public.barracas(id) ON DELETE CASCADE;


--
-- Name: barraca_asignaciones barraca_asignaciones_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barraca_asignaciones
    ADD CONSTRAINT barraca_asignaciones_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: bodega_articulos bodega_articulos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_articulos
    ADD CONSTRAINT bodega_articulos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.bodega_categorias(id) ON DELETE SET NULL;


--
-- Name: bodega_movimientos bodega_movimientos_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_movimientos
    ADD CONSTRAINT bodega_movimientos_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: bodega_movimientos bodega_movimientos_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_movimientos
    ADD CONSTRAINT bodega_movimientos_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: bodega_movimientos bodega_movimientos_unidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_movimientos
    ADD CONSTRAINT bodega_movimientos_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES public.bodega_unidades(id) ON DELETE CASCADE;


--
-- Name: bodega_solicitudes bodega_solicitudes_articulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_solicitudes
    ADD CONSTRAINT bodega_solicitudes_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.bodega_articulos(id) ON DELETE SET NULL;


--
-- Name: bodega_solicitudes bodega_solicitudes_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_solicitudes
    ADD CONSTRAINT bodega_solicitudes_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: bodega_solicitudes bodega_solicitudes_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_solicitudes
    ADD CONSTRAINT bodega_solicitudes_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: bodega_unidades bodega_unidades_articulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_unidades
    ADD CONSTRAINT bodega_unidades_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.bodega_articulos(id) ON DELETE RESTRICT;


--
-- Name: bodega_unidades bodega_unidades_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_unidades
    ADD CONSTRAINT bodega_unidades_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: bodega_unidades bodega_unidades_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bodega_unidades
    ADD CONSTRAINT bodega_unidades_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: cambios_salariales cambios_salariales_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cambios_salariales
    ADD CONSTRAINT cambios_salariales_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: cambios_salariales cambios_salariales_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cambios_salariales
    ADD CONSTRAINT cambios_salariales_movimiento_id_fkey FOREIGN KEY (movimiento_id) REFERENCES public.movimientos_operativos(id) ON DELETE SET NULL;


--
-- Name: cambios_salariales cambios_salariales_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cambios_salariales
    ADD CONSTRAINT cambios_salariales_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: cierre_auditoria cierre_auditoria_cierre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cierre_auditoria
    ADD CONSTRAINT cierre_auditoria_cierre_id_fkey FOREIGN KEY (cierre_id) REFERENCES public.cierre_operativo_diario(id);


--
-- Name: client_sedes client_sedes_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_sedes
    ADD CONSTRAINT client_sedes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: cobertura_diaria cobertura_diaria_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobertura_diaria
    ADD CONSTRAINT cobertura_diaria_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: cobertura_diaria cobertura_diaria_cobertura_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobertura_diaria
    ADD CONSTRAINT cobertura_diaria_cobertura_employee_id_fkey FOREIGN KEY (cobertura_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: cobertura_diaria cobertura_diaria_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobertura_diaria
    ADD CONSTRAINT cobertura_diaria_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: cobertura_diaria cobertura_diaria_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobertura_diaria
    ADD CONSTRAINT cobertura_diaria_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.client_sedes(id) ON DELETE SET NULL;


--
-- Name: cobertura_diaria cobertura_diaria_titular_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobertura_diaria
    ADD CONSTRAINT cobertura_diaria_titular_employee_id_fkey FOREIGN KEY (titular_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: cobertura_segmentos cobertura_segmentos_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobertura_segmentos
    ADD CONSTRAINT cobertura_segmentos_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: cobertura_segmentos cobertura_segmentos_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobertura_segmentos
    ADD CONSTRAINT cobertura_segmentos_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: cobertura_segmentos cobertura_segmentos_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobertura_segmentos
    ADD CONSTRAINT cobertura_segmentos_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE CASCADE;


--
-- Name: cobertura_segmentos cobertura_segmentos_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobertura_segmentos
    ADD CONSTRAINT cobertura_segmentos_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.client_sedes(id) ON DELETE SET NULL;


--
-- Name: config_empresa config_empresa_representante_legal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config_empresa
    ADD CONSTRAINT config_empresa_representante_legal_id_fkey FOREIGN KEY (representante_legal_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: contratos_empleados contratos_empleados_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contratos_empleados
    ADD CONSTRAINT contratos_empleados_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: custodia_asignacion_diaria custodia_asignacion_diaria_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_asignacion_diaria
    ADD CONSTRAINT custodia_asignacion_diaria_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: custodia_asignacion_diaria custodia_asignacion_diaria_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_asignacion_diaria
    ADD CONSTRAINT custodia_asignacion_diaria_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: custodia_excepciones custodia_excepciones_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_excepciones
    ADD CONSTRAINT custodia_excepciones_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: custodia_fuerza_semanal custodia_fuerza_semanal_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_fuerza_semanal
    ADD CONSTRAINT custodia_fuerza_semanal_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: custodia_sync_log custodia_sync_log_cierre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_sync_log
    ADD CONSTRAINT custodia_sync_log_cierre_id_fkey FOREIGN KEY (cierre_id) REFERENCES public.cierre_operativo_diario(id);


--
-- Name: custodia_titulares custodia_titulares_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_titulares
    ADD CONSTRAINT custodia_titulares_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: custodia_titulares custodia_titulares_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custodia_titulares
    ADD CONSTRAINT custodia_titulares_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: dotacion_pendiente dotacion_pendiente_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dotacion_pendiente
    ADD CONSTRAINT dotacion_pendiente_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: dotacion_pendiente_items dotacion_pendiente_items_articulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dotacion_pendiente_items
    ADD CONSTRAINT dotacion_pendiente_items_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.bodega_articulos(id) ON DELETE SET NULL;


--
-- Name: dotacion_pendiente_items dotacion_pendiente_items_dotacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dotacion_pendiente_items
    ADD CONSTRAINT dotacion_pendiente_items_dotacion_id_fkey FOREIGN KEY (dotacion_id) REFERENCES public.dotacion_pendiente(id) ON DELETE CASCADE;


--
-- Name: dotacion_pendiente dotacion_pendiente_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dotacion_pendiente
    ADD CONSTRAINT dotacion_pendiente_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: empleados_periodos_laborales empleados_periodos_laborales_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empleados_periodos_laborales
    ADD CONSTRAINT empleados_periodos_laborales_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: empleados_periodos_laborales empleados_periodos_laborales_liquidacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empleados_periodos_laborales
    ADD CONSTRAINT empleados_periodos_laborales_liquidacion_id_fkey FOREIGN KEY (liquidacion_id) REFERENCES public.prestaciones_liquidaciones(id) ON DELETE SET NULL;


--
-- Name: employee_descanso_semanal employee_descanso_semanal_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_descanso_semanal
    ADD CONSTRAINT employee_descanso_semanal_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_operational_assignments employee_operational_assignments_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_operational_assignments
    ADD CONSTRAINT employee_operational_assignments_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: employee_operational_assignments employee_operational_assignments_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_operational_assignments
    ADD CONSTRAINT employee_operational_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_operational_assignments employee_operational_assignments_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_operational_assignments
    ADD CONSTRAINT employee_operational_assignments_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: employee_operational_assignments employee_operational_assignments_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_operational_assignments
    ADD CONSTRAINT employee_operational_assignments_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.client_sedes(id) ON DELETE SET NULL;


--
-- Name: employee_operational_assignments employee_operational_assignments_tipo_turno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_operational_assignments
    ADD CONSTRAINT employee_operational_assignments_tipo_turno_id_fkey FOREIGN KEY (tipo_turno_id) REFERENCES public.turnos(id) ON DELETE SET NULL;


--
-- Name: employee_operational_assignments employee_operational_assignments_zona_operativa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_operational_assignments
    ADD CONSTRAINT employee_operational_assignments_zona_operativa_id_fkey FOREIGN KEY (zona_operativa_id) REFERENCES public.operational_zones(id) ON DELETE SET NULL;


--
-- Name: entregas_uniforme entregas_uniforme_articulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entregas_uniforme
    ADD CONSTRAINT entregas_uniforme_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.bodega_articulos(id) ON DELETE SET NULL;


--
-- Name: entregas_uniforme entregas_uniforme_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entregas_uniforme
    ADD CONSTRAINT entregas_uniforme_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: entregas_uniforme_cuotas entregas_uniforme_cuotas_entrega_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entregas_uniforme_cuotas
    ADD CONSTRAINT entregas_uniforme_cuotas_entrega_id_fkey FOREIGN KEY (entrega_id) REFERENCES public.entregas_uniforme(id) ON DELETE CASCADE;


--
-- Name: entregas_uniforme_cuotas entregas_uniforme_cuotas_planilla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entregas_uniforme_cuotas
    ADD CONSTRAINT entregas_uniforme_cuotas_planilla_id_fkey FOREIGN KEY (planilla_id) REFERENCES public.planillas(id) ON DELETE SET NULL;


--
-- Name: entregas_uniforme entregas_uniforme_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entregas_uniforme
    ADD CONSTRAINT entregas_uniforme_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: entregas_uniforme entregas_uniforme_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entregas_uniforme
    ADD CONSTRAINT entregas_uniforme_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: eventos_rrhh eventos_rrhh_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_rrhh
    ADD CONSTRAINT eventos_rrhh_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: eventos_rrhh eventos_rrhh_evento_par_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_rrhh
    ADD CONSTRAINT eventos_rrhh_evento_par_id_fkey FOREIGN KEY (evento_par_id) REFERENCES public.eventos_rrhh(id) ON DELETE SET NULL;


--
-- Name: eventos_rrhh eventos_rrhh_fichaje_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_rrhh
    ADD CONSTRAINT eventos_rrhh_fichaje_origen_id_fkey FOREIGN KEY (fichaje_origen_id) REFERENCES public.agente_fichajes(id) ON DELETE SET NULL;


--
-- Name: eventos_rrhh eventos_rrhh_movimiento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos_rrhh
    ADD CONSTRAINT eventos_rrhh_movimiento_id_fkey FOREIGN KEY (movimiento_id) REFERENCES public.movimientos_operativos(id) ON DELETE SET NULL;


--
-- Name: agent_assignments fk_agent_assignments_cliente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_assignments
    ADD CONSTRAINT fk_agent_assignments_cliente FOREIGN KEY (cliente_id) REFERENCES public.clients(portal_cliente_id) NOT VALID;


--
-- Name: historial_prestaciones_externas historial_prestaciones_externas_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_prestaciones_externas
    ADD CONSTRAINT historial_prestaciones_externas_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: incidents incidents_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: incidents incidents_responsable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: kit_ingreso_items kit_ingreso_items_articulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kit_ingreso_items
    ADD CONSTRAINT kit_ingreso_items_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.bodega_articulos(id) ON DELETE SET NULL;


--
-- Name: lead_dotacion_items lead_dotacion_items_articulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_dotacion_items
    ADD CONSTRAINT lead_dotacion_items_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.bodega_articulos(id) ON DELETE SET NULL;


--
-- Name: lead_dotacion_items lead_dotacion_items_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_dotacion_items
    ADD CONSTRAINT lead_dotacion_items_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: leads leads_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id);


--
-- Name: movimientos_operativos movimientos_operativos_agente_entrante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_operativos
    ADD CONSTRAINT movimientos_operativos_agente_entrante_id_fkey FOREIGN KEY (agente_entrante_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: movimientos_operativos movimientos_operativos_agente_saliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_operativos
    ADD CONSTRAINT movimientos_operativos_agente_saliente_id_fkey FOREIGN KEY (agente_saliente_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: movimientos_operativos movimientos_operativos_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_operativos
    ADD CONSTRAINT movimientos_operativos_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: nfc_devices nfc_devices_cliente_id_ref_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_devices
    ADD CONSTRAINT nfc_devices_cliente_id_ref_fkey FOREIGN KEY (cliente_id_ref) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: nfc_devices nfc_devices_puesto_id_ref_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_devices
    ADD CONSTRAINT nfc_devices_puesto_id_ref_fkey FOREIGN KEY (puesto_id_ref) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: nfc_devices nfc_devices_sede_id_ref_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_devices
    ADD CONSTRAINT nfc_devices_sede_id_ref_fkey FOREIGN KEY (sede_id_ref) REFERENCES public.client_sedes(id) ON DELETE SET NULL;


--
-- Name: nfc_ronda_eventos nfc_ronda_eventos_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_ronda_eventos
    ADD CONSTRAINT nfc_ronda_eventos_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.nfc_devices(id) ON DELETE SET NULL;


--
-- Name: nfc_ronda_eventos nfc_ronda_eventos_ronda_punto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_ronda_eventos
    ADD CONSTRAINT nfc_ronda_eventos_ronda_punto_id_fkey FOREIGN KEY (ronda_punto_id) REFERENCES public.nfc_ronda_puntos(id) ON DELETE CASCADE;


--
-- Name: nfc_ronda_puntos nfc_ronda_puntos_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_ronda_puntos
    ADD CONSTRAINT nfc_ronda_puntos_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: nfc_sandbox_schedules nfc_sandbox_schedules_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_sandbox_schedules
    ADD CONSTRAINT nfc_sandbox_schedules_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.nfc_devices(id) ON DELETE CASCADE;


--
-- Name: nfc_sandbox_schedules nfc_sandbox_schedules_empleado_id_ref_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_sandbox_schedules
    ADD CONSTRAINT nfc_sandbox_schedules_empleado_id_ref_fkey FOREIGN KEY (empleado_id_ref) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: nfc_sandbox_schedules nfc_sandbox_schedules_puesto_id_ref_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_sandbox_schedules
    ADD CONSTRAINT nfc_sandbox_schedules_puesto_id_ref_fkey FOREIGN KEY (puesto_id_ref) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: nfc_shift_events nfc_shift_events_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_shift_events
    ADD CONSTRAINT nfc_shift_events_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.nfc_devices(id) ON DELETE SET NULL;


--
-- Name: nfc_shift_events nfc_shift_events_empleado_id_ref_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_shift_events
    ADD CONSTRAINT nfc_shift_events_empleado_id_ref_fkey FOREIGN KEY (empleado_id_ref) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: nfc_shift_events nfc_shift_events_puesto_id_ref_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_shift_events
    ADD CONSTRAINT nfc_shift_events_puesto_id_ref_fkey FOREIGN KEY (puesto_id_ref) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: nfc_shift_events nfc_shift_events_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_shift_events
    ADD CONSTRAINT nfc_shift_events_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.nfc_tags(id) ON DELETE SET NULL;


--
-- Name: nfc_supervisor_form_items nfc_supervisor_form_items_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_supervisor_form_items
    ADD CONSTRAINT nfc_supervisor_form_items_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.nfc_supervisor_forms(id) ON DELETE CASCADE;


--
-- Name: nfc_supervisor_forms nfc_supervisor_forms_agente_id_ref_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_supervisor_forms
    ADD CONSTRAINT nfc_supervisor_forms_agente_id_ref_fkey FOREIGN KEY (agente_id_ref) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: nfc_supervisor_forms nfc_supervisor_forms_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_supervisor_forms
    ADD CONSTRAINT nfc_supervisor_forms_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.nfc_devices(id) ON DELETE SET NULL;


--
-- Name: nfc_supervisor_forms nfc_supervisor_forms_puesto_id_ref_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_supervisor_forms
    ADD CONSTRAINT nfc_supervisor_forms_puesto_id_ref_fkey FOREIGN KEY (puesto_id_ref) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: nfc_supervisor_forms nfc_supervisor_forms_supervisor_id_ref_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_supervisor_forms
    ADD CONSTRAINT nfc_supervisor_forms_supervisor_id_ref_fkey FOREIGN KEY (supervisor_id_ref) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: nfc_supervisor_forms nfc_supervisor_forms_supervisor_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_supervisor_forms
    ADD CONSTRAINT nfc_supervisor_forms_supervisor_tag_id_fkey FOREIGN KEY (supervisor_tag_id) REFERENCES public.nfc_tags(id) ON DELETE SET NULL;


--
-- Name: nfc_tags nfc_tags_empleado_id_ref_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nfc_tags
    ADD CONSTRAINT nfc_tags_empleado_id_ref_fkey FOREIGN KEY (empleado_id_ref) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: nomina_feriado_pago nomina_feriado_pago_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nomina_feriado_pago
    ADD CONSTRAINT nomina_feriado_pago_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: novedades_nomina_diarias novedades_nomina_diarias_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novedades_nomina_diarias
    ADD CONSTRAINT novedades_nomina_diarias_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: novedades_nomina_diarias novedades_nomina_diarias_evento_rrhh_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novedades_nomina_diarias
    ADD CONSTRAINT novedades_nomina_diarias_evento_rrhh_id_fkey FOREIGN KEY (evento_rrhh_id) REFERENCES public.eventos_rrhh(id) ON DELETE SET NULL;


--
-- Name: novedades_nomina_diarias novedades_nomina_diarias_puesto_cubierto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novedades_nomina_diarias
    ADD CONSTRAINT novedades_nomina_diarias_puesto_cubierto_id_fkey FOREIGN KEY (puesto_cubierto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: novedades_nomina_diarias novedades_nomina_diarias_puesto_titular_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novedades_nomina_diarias
    ADD CONSTRAINT novedades_nomina_diarias_puesto_titular_id_fkey FOREIGN KEY (puesto_titular_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: novedades_nomina_diarias novedades_nomina_diarias_tipo_turno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.novedades_nomina_diarias
    ADD CONSTRAINT novedades_nomina_diarias_tipo_turno_id_fkey FOREIGN KEY (tipo_turno_id) REFERENCES public.turnos(id) ON DELETE SET NULL;


--
-- Name: operational_zones operational_zones_supervisor_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_zones
    ADD CONSTRAINT operational_zones_supervisor_employee_id_fkey FOREIGN KEY (supervisor_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: operational_zones operational_zones_supervisor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_zones
    ADD CONSTRAINT operational_zones_supervisor_user_id_fkey FOREIGN KEY (supervisor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ordenes_compra ordenes_compra_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra
    ADD CONSTRAINT ordenes_compra_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: ordenes_compra_items ordenes_compra_items_articulo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra_items
    ADD CONSTRAINT ordenes_compra_items_articulo_id_fkey FOREIGN KEY (articulo_id) REFERENCES public.bodega_articulos(id) ON DELETE SET NULL;


--
-- Name: ordenes_compra_items ordenes_compra_items_orden_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra_items
    ADD CONSTRAINT ordenes_compra_items_orden_id_fkey FOREIGN KEY (orden_id) REFERENCES public.ordenes_compra(id) ON DELETE CASCADE;


--
-- Name: ordenes_compra ordenes_compra_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordenes_compra
    ADD CONSTRAINT ordenes_compra_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: personal_slots personal_slots_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personal_slots
    ADD CONSTRAINT personal_slots_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: planificacion_futura planificacion_futura_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planificacion_futura
    ADD CONSTRAINT planificacion_futura_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE CASCADE;


--
-- Name: planificacion_futura planificacion_futura_relevo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planificacion_futura
    ADD CONSTRAINT planificacion_futura_relevo_id_fkey FOREIGN KEY (relevo_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: planificacion_futura planificacion_futura_ssa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planificacion_futura
    ADD CONSTRAINT planificacion_futura_ssa_id_fkey FOREIGN KEY (ssa_id) REFERENCES public.solicitudes_servicio_adicional(id) ON DELETE CASCADE;


--
-- Name: planificacion_futura planificacion_futura_titular_ausente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planificacion_futura
    ADD CONSTRAINT planificacion_futura_titular_ausente_id_fkey FOREIGN KEY (titular_ausente_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: planilla_lineas planilla_lineas_planilla_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planilla_lineas
    ADD CONSTRAINT planilla_lineas_planilla_id_fkey FOREIGN KEY (planilla_id) REFERENCES public.planillas(id) ON DELETE CASCADE;


--
-- Name: planillas planillas_cierre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planillas
    ADD CONSTRAINT planillas_cierre_id_fkey FOREIGN KEY (cierre_id) REFERENCES public.pre_planilla_cierres(id) ON DELETE RESTRICT;


--
-- Name: planillas_especiales_lineas planillas_especiales_lineas_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planillas_especiales_lineas
    ADD CONSTRAINT planillas_especiales_lineas_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: planillas_especiales_lineas planillas_especiales_lineas_planilla_especial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planillas_especiales_lineas
    ADD CONSTRAINT planillas_especiales_lineas_planilla_especial_id_fkey FOREIGN KEY (planilla_especial_id) REFERENCES public.planillas_especiales(id) ON DELETE CASCADE;


--
-- Name: planillas_especiales_pagos planillas_especiales_pagos_planilla_especial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planillas_especiales_pagos
    ADD CONSTRAINT planillas_especiales_pagos_planilla_especial_id_fkey FOREIGN KEY (planilla_especial_id) REFERENCES public.planillas_especiales(id) ON DELETE CASCADE;


--
-- Name: pre_planilla_auditoria pre_planilla_auditoria_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_planilla_auditoria
    ADD CONSTRAINT pre_planilla_auditoria_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: pre_planilla_dias_anticipados pre_planilla_dias_anticipados_cierre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_planilla_dias_anticipados
    ADD CONSTRAINT pre_planilla_dias_anticipados_cierre_id_fkey FOREIGN KEY (cierre_id) REFERENCES public.pre_planilla_cierres(id) ON DELETE CASCADE;


--
-- Name: pre_planilla_revision pre_planilla_revision_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_planilla_revision
    ADD CONSTRAINT pre_planilla_revision_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: prestaciones_acumulados prestaciones_acumulados_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_acumulados
    ADD CONSTRAINT prestaciones_acumulados_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: prestaciones_liquidacion_detalle prestaciones_liquidacion_detalle_liquidacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_liquidacion_detalle
    ADD CONSTRAINT prestaciones_liquidacion_detalle_liquidacion_id_fkey FOREIGN KEY (liquidacion_id) REFERENCES public.prestaciones_liquidaciones(id) ON DELETE CASCADE;


--
-- Name: prestaciones_liquidacion_ediciones prestaciones_liquidacion_ediciones_liquidacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_liquidacion_ediciones
    ADD CONSTRAINT prestaciones_liquidacion_ediciones_liquidacion_id_fkey FOREIGN KEY (liquidacion_id) REFERENCES public.prestaciones_liquidaciones(id) ON DELETE CASCADE;


--
-- Name: prestaciones_liquidaciones prestaciones_liquidaciones_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_liquidaciones
    ADD CONSTRAINT prestaciones_liquidaciones_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: prestaciones_movimientos prestaciones_movimientos_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_movimientos
    ADD CONSTRAINT prestaciones_movimientos_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: prestaciones_provisiones prestaciones_provisiones_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prestaciones_provisiones
    ADD CONSTRAINT prestaciones_provisiones_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: puesto_municion puesto_municion_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puesto_municion
    ADD CONSTRAINT puesto_municion_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE CASCADE;


--
-- Name: puesto_slots puesto_slots_empleado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puesto_slots
    ADD CONSTRAINT puesto_slots_empleado_id_fkey FOREIGN KEY (empleado_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: puesto_slots puesto_slots_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puesto_slots
    ADD CONSTRAINT puesto_slots_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE CASCADE;


--
-- Name: puesto_titular_historico puesto_titular_historico_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puesto_titular_historico
    ADD CONSTRAINT puesto_titular_historico_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: puesto_titular_historico puesto_titular_historico_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puesto_titular_historico
    ADD CONSTRAINT puesto_titular_historico_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE CASCADE;


--
-- Name: puesto_titulares puesto_titulares_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puesto_titulares
    ADD CONSTRAINT puesto_titulares_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: puesto_titulares puesto_titulares_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puesto_titulares
    ADD CONSTRAINT puesto_titulares_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE CASCADE;


--
-- Name: puestos_gps puestos_gps_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puestos_gps
    ADD CONSTRAINT puestos_gps_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE CASCADE;


--
-- Name: puestos_operativos puestos_operativos_agente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puestos_operativos
    ADD CONSTRAINT puestos_operativos_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: puestos_operativos puestos_operativos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puestos_operativos
    ADD CONSTRAINT puestos_operativos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: puestos_operativos puestos_operativos_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puestos_operativos
    ADD CONSTRAINT puestos_operativos_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.client_sedes(id) ON DELETE SET NULL;


--
-- Name: puestos_operativos puestos_operativos_tipo_turno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puestos_operativos
    ADD CONSTRAINT puestos_operativos_tipo_turno_id_fkey FOREIGN KEY (tipo_turno_id) REFERENCES public.turnos(id) ON DELETE SET NULL;


--
-- Name: puestos_operativos puestos_operativos_titular_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puestos_operativos
    ADD CONSTRAINT puestos_operativos_titular_employee_id_fkey FOREIGN KEY (titular_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: puestos_operativos puestos_operativos_zona_operativa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puestos_operativos
    ADD CONSTRAINT puestos_operativos_zona_operativa_id_fkey FOREIGN KEY (zona_operativa_id) REFERENCES public.operational_zones(id) ON DELETE SET NULL;


--
-- Name: qr_ronda_eventos qr_ronda_eventos_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_ronda_eventos
    ADD CONSTRAINT qr_ronda_eventos_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: qr_ronda_eventos qr_ronda_eventos_punto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_ronda_eventos
    ADD CONSTRAINT qr_ronda_eventos_punto_id_fkey FOREIGN KEY (punto_id) REFERENCES public.qr_ronda_puntos(id) ON DELETE CASCADE;


--
-- Name: qr_ronda_eventos qr_ronda_eventos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_ronda_eventos
    ADD CONSTRAINT qr_ronda_eventos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: qr_ronda_puntos qr_ronda_puntos_ronda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_ronda_puntos
    ADD CONSTRAINT qr_ronda_puntos_ronda_id_fkey FOREIGN KEY (ronda_id) REFERENCES public.qr_rondas(id) ON DELETE CASCADE;


--
-- Name: qr_rondas qr_rondas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_rondas
    ADD CONSTRAINT qr_rondas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: relevo_equipo_novedades relevo_equipo_novedades_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relevo_equipo_novedades
    ADD CONSTRAINT relevo_equipo_novedades_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: relevo_equipo_novedades relevo_equipo_novedades_fichaje_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relevo_equipo_novedades
    ADD CONSTRAINT relevo_equipo_novedades_fichaje_id_fkey FOREIGN KEY (fichaje_id) REFERENCES public.agente_fichajes(id) ON DELETE SET NULL;


--
-- Name: relevo_equipo_novedades relevo_equipo_novedades_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relevo_equipo_novedades
    ADD CONSTRAINT relevo_equipo_novedades_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: relevo_equipo_novedades relevo_equipo_novedades_reporte_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relevo_equipo_novedades
    ADD CONSTRAINT relevo_equipo_novedades_reporte_id_fkey FOREIGN KEY (reporte_id) REFERENCES public.reporte_turno(id) ON DELETE CASCADE;


--
-- Name: reporte_turno reporte_turno_arma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reporte_turno
    ADD CONSTRAINT reporte_turno_arma_id_fkey FOREIGN KEY (arma_id) REFERENCES public.armas(id) ON DELETE SET NULL;


--
-- Name: reporte_turno reporte_turno_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reporte_turno
    ADD CONSTRAINT reporte_turno_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: reporte_turno reporte_turno_fichaje_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reporte_turno
    ADD CONSTRAINT reporte_turno_fichaje_id_fkey FOREIGN KEY (fichaje_id) REFERENCES public.agente_fichajes(id) ON DELETE CASCADE;


--
-- Name: reporte_turno reporte_turno_municion_responsable_anterior_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reporte_turno
    ADD CONSTRAINT reporte_turno_municion_responsable_anterior_fkey FOREIGN KEY (municion_responsable_anterior) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: reporte_turno reporte_turno_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reporte_turno
    ADD CONSTRAINT reporte_turno_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: rol_permisos rol_permisos_rol_clave_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rol_permisos
    ADD CONSTRAINT rol_permisos_rol_clave_fkey FOREIGN KEY (rol_clave) REFERENCES public.system_roles(clave) ON DELETE CASCADE;


--
-- Name: rrhh_alertas rrhh_alertas_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rrhh_alertas
    ADD CONSTRAINT rrhh_alertas_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: solicitudes_cambio_operativo solicitudes_cambio_operativo_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_cambio_operativo
    ADD CONSTRAINT solicitudes_cambio_operativo_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: solicitudes_cambio_operativo solicitudes_cambio_operativo_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_cambio_operativo
    ADD CONSTRAINT solicitudes_cambio_operativo_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: solicitudes_cambio_turno solicitudes_cambio_turno_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_cambio_turno
    ADD CONSTRAINT solicitudes_cambio_turno_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE CASCADE;


--
-- Name: solicitudes_cambio_turno solicitudes_cambio_turno_turno_actual_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_cambio_turno
    ADD CONSTRAINT solicitudes_cambio_turno_turno_actual_id_fkey FOREIGN KEY (turno_actual_id) REFERENCES public.turnos(id) ON DELETE SET NULL;


--
-- Name: solicitudes_cambio_turno solicitudes_cambio_turno_turno_nuevo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_cambio_turno
    ADD CONSTRAINT solicitudes_cambio_turno_turno_nuevo_id_fkey FOREIGN KEY (turno_nuevo_id) REFERENCES public.turnos(id) ON DELETE RESTRICT;


--
-- Name: solicitudes_merge_requests solicitudes_merge_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_merge_requests
    ADD CONSTRAINT solicitudes_merge_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: solicitudes_merge_requests solicitudes_merge_requests_solicitud_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_merge_requests
    ADD CONSTRAINT solicitudes_merge_requests_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES public.solicitudes_empleo(id) ON DELETE CASCADE;


--
-- Name: solicitudes_servicio_adicional solicitudes_servicio_adicional_agente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_servicio_adicional
    ADD CONSTRAINT solicitudes_servicio_adicional_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: solicitudes_servicio_adicional solicitudes_servicio_adicional_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_servicio_adicional
    ADD CONSTRAINT solicitudes_servicio_adicional_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: solicitudes_servicio_adicional solicitudes_servicio_adicional_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_servicio_adicional
    ADD CONSTRAINT solicitudes_servicio_adicional_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: solicitudes_servicio_adicional solicitudes_servicio_adicional_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_servicio_adicional
    ADD CONSTRAINT solicitudes_servicio_adicional_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.client_sedes(id) ON DELETE SET NULL;


--
-- Name: solicitudes_servicio_adicional solicitudes_servicio_adicional_solicitado_por_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_servicio_adicional
    ADD CONSTRAINT solicitudes_servicio_adicional_solicitado_por_user_id_fkey FOREIGN KEY (solicitado_por_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ssa_agentes ssa_agentes_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ssa_agentes
    ADD CONSTRAINT ssa_agentes_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: ssa_agentes ssa_agentes_ssa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ssa_agentes
    ADD CONSTRAINT ssa_agentes_ssa_id_fkey FOREIGN KEY (ssa_id) REFERENCES public.solicitudes_servicio_adicional(id) ON DELETE CASCADE;


--
-- Name: supervision_catalogo_items supervision_catalogo_items_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_catalogo_items
    ADD CONSTRAINT supervision_catalogo_items_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: supervision_geofence_eventos supervision_geofence_eventos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_geofence_eventos
    ADD CONSTRAINT supervision_geofence_eventos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: supervision_geofence_eventos supervision_geofence_eventos_programacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_geofence_eventos
    ADD CONSTRAINT supervision_geofence_eventos_programacion_id_fkey FOREIGN KEY (programacion_id) REFERENCES public.supervision_visitas_programadas(id) ON DELETE SET NULL;


--
-- Name: supervision_geofence_eventos supervision_geofence_eventos_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_geofence_eventos
    ADD CONSTRAINT supervision_geofence_eventos_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: supervision_geofence_eventos supervision_geofence_eventos_sesion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_geofence_eventos
    ADD CONSTRAINT supervision_geofence_eventos_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES public.supervision_sesiones(id) ON DELETE CASCADE;


--
-- Name: supervision_geofence_eventos supervision_geofence_eventos_supervisor_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_geofence_eventos
    ADD CONSTRAINT supervision_geofence_eventos_supervisor_employee_id_fkey FOREIGN KEY (supervisor_employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: supervision_gps_tracks supervision_gps_tracks_sesion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_gps_tracks
    ADD CONSTRAINT supervision_gps_tracks_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES public.supervision_sesiones(id) ON DELETE CASCADE;


--
-- Name: supervision_inspecciones supervision_inspecciones_agente_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_inspecciones
    ADD CONSTRAINT supervision_inspecciones_agente_employee_id_fkey FOREIGN KEY (agente_employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: supervision_inspecciones supervision_inspecciones_arma_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_inspecciones
    ADD CONSTRAINT supervision_inspecciones_arma_id_fkey FOREIGN KEY (arma_id) REFERENCES public.armas(id) ON DELETE SET NULL;


--
-- Name: supervision_inspecciones supervision_inspecciones_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_inspecciones
    ADD CONSTRAINT supervision_inspecciones_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: supervision_inspecciones supervision_inspecciones_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_inspecciones
    ADD CONSTRAINT supervision_inspecciones_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: supervision_inspecciones supervision_inspecciones_sesion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_inspecciones
    ADD CONSTRAINT supervision_inspecciones_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES public.supervision_sesiones(id) ON DELETE CASCADE;


--
-- Name: supervision_inspecciones supervision_inspecciones_supervisor_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_inspecciones
    ADD CONSTRAINT supervision_inspecciones_supervisor_employee_id_fkey FOREIGN KEY (supervisor_employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: supervision_novedades supervision_novedades_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_novedades
    ADD CONSTRAINT supervision_novedades_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: supervision_novedades supervision_novedades_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_novedades
    ADD CONSTRAINT supervision_novedades_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: supervision_novedades supervision_novedades_reconocida_por_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_novedades
    ADD CONSTRAINT supervision_novedades_reconocida_por_user_id_fkey FOREIGN KEY (reconocida_por_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: supervision_novedades supervision_novedades_sesion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_novedades
    ADD CONSTRAINT supervision_novedades_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES public.supervision_sesiones(id) ON DELETE SET NULL;


--
-- Name: supervision_novedades supervision_novedades_supervisor_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_novedades
    ADD CONSTRAINT supervision_novedades_supervisor_employee_id_fkey FOREIGN KEY (supervisor_employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: supervision_plan_mensual supervision_plan_mensual_sede_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_plan_mensual
    ADD CONSTRAINT supervision_plan_mensual_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.client_sedes(id) ON DELETE CASCADE;


--
-- Name: supervision_plan_mensual supervision_plan_mensual_supervisor_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_plan_mensual
    ADD CONSTRAINT supervision_plan_mensual_supervisor_employee_id_fkey FOREIGN KEY (supervisor_employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: supervision_sesiones supervision_sesiones_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_sesiones
    ADD CONSTRAINT supervision_sesiones_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.supervisor_devices(id) ON DELETE SET NULL;


--
-- Name: supervision_sesiones supervision_sesiones_supervisor_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_sesiones
    ADD CONSTRAINT supervision_sesiones_supervisor_employee_id_fkey FOREIGN KEY (supervisor_employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: supervision_visitas_programadas supervision_visitas_programadas_bono_pagado_por_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_visitas_programadas
    ADD CONSTRAINT supervision_visitas_programadas_bono_pagado_por_user_id_fkey FOREIGN KEY (bono_pagado_por_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: supervision_visitas_programadas supervision_visitas_programadas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_visitas_programadas
    ADD CONSTRAINT supervision_visitas_programadas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: supervision_visitas_programadas supervision_visitas_programadas_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_visitas_programadas
    ADD CONSTRAINT supervision_visitas_programadas_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: supervision_visitas_programadas supervision_visitas_programadas_fichaje_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_visitas_programadas
    ADD CONSTRAINT supervision_visitas_programadas_fichaje_supervisor_id_fkey FOREIGN KEY (fichaje_supervisor_id) REFERENCES public.agente_fichajes(id) ON DELETE SET NULL;


--
-- Name: supervision_visitas_programadas supervision_visitas_programadas_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_visitas_programadas
    ADD CONSTRAINT supervision_visitas_programadas_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: supervision_visitas_programadas supervision_visitas_programadas_supervisor_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_visitas_programadas
    ADD CONSTRAINT supervision_visitas_programadas_supervisor_employee_id_fkey FOREIGN KEY (supervisor_employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: supervision_visitas_programadas supervision_visitas_programadas_visita_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_visitas_programadas
    ADD CONSTRAINT supervision_visitas_programadas_visita_id_fkey FOREIGN KEY (visita_id) REFERENCES public.visitas(id) ON DELETE SET NULL;


--
-- Name: supervision_visitas_programadas supervision_visitas_programadas_zona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervision_visitas_programadas
    ADD CONSTRAINT supervision_visitas_programadas_zona_id_fkey FOREIGN KEY (zona_id) REFERENCES public.operational_zones(id) ON DELETE SET NULL;


--
-- Name: supervisor_devices supervisor_devices_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisor_devices
    ADD CONSTRAINT supervisor_devices_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: supervisor_devices supervisor_devices_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisor_devices
    ADD CONSTRAINT supervisor_devices_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE SET NULL;


--
-- Name: supervisor_devices supervisor_devices_supervisor_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisor_devices
    ADD CONSTRAINT supervisor_devices_supervisor_employee_id_fkey FOREIGN KEY (supervisor_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: tareas tareas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tareas
    ADD CONSTRAINT tareas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: usuarios_clientes usuarios_clientes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios_clientes
    ADD CONSTRAINT usuarios_clientes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: vacaciones_movimientos vacaciones_movimientos_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vacaciones_movimientos
    ADD CONSTRAINT vacaciones_movimientos_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: vacaciones_saldos vacaciones_saldos_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vacaciones_saldos
    ADD CONSTRAINT vacaciones_saldos_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: vehiculo_custodia vehiculo_custodia_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculo_custodia
    ADD CONSTRAINT vehiculo_custodia_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: vehiculo_custodia vehiculo_custodia_vehiculo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculo_custodia
    ADD CONSTRAINT vehiculo_custodia_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES public.vehiculos(id) ON DELETE CASCADE;


--
-- Name: vehiculo_custodia vehiculo_custodia_zona_operativa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculo_custodia
    ADD CONSTRAINT vehiculo_custodia_zona_operativa_id_fkey FOREIGN KEY (zona_operativa_id) REFERENCES public.operational_zones(id) ON DELETE SET NULL;


--
-- Name: vehiculos vehiculos_zona_operativa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehiculos
    ADD CONSTRAINT vehiculos_zona_operativa_id_fkey FOREIGN KEY (zona_operativa_id) REFERENCES public.operational_zones(id) ON DELETE SET NULL;


--
-- Name: visitas visitas_entrada_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitas
    ADD CONSTRAINT visitas_entrada_device_id_fkey FOREIGN KEY (entrada_device_id) REFERENCES public.supervisor_devices(id) ON DELETE SET NULL;


--
-- Name: visitas visitas_entrada_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitas
    ADD CONSTRAINT visitas_entrada_employee_id_fkey FOREIGN KEY (entrada_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: visitas visitas_puesto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitas
    ADD CONSTRAINT visitas_puesto_id_fkey FOREIGN KEY (puesto_id) REFERENCES public.puestos_operativos(id) ON DELETE CASCADE;


--
-- Name: visitas visitas_salida_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitas
    ADD CONSTRAINT visitas_salida_device_id_fkey FOREIGN KEY (salida_device_id) REFERENCES public.supervisor_devices(id) ON DELETE SET NULL;


--
-- Name: visitas visitas_salida_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitas
    ADD CONSTRAINT visitas_salida_employee_id_fkey FOREIGN KEY (salida_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: zona_supervisores zona_supervisores_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zona_supervisores
    ADD CONSTRAINT zona_supervisores_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: zona_supervisores zona_supervisores_zona_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zona_supervisores
    ADD CONSTRAINT zona_supervisores_zona_id_fkey FOREIGN KEY (zona_id) REFERENCES public.operational_zones(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict bugYDYzgnerwUoQ9CtINIDtqSBfATQdvCWiCniXp8bbTf9bOybLlt13Oh2FXUD2

