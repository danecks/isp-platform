export interface CmsField {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "tel" | "email";
  hint?: string;
  placeholder?: string;
}

export interface CmsPageSchema {
  pageKey: string;
  title: string;
  description?: string;
  sections: { sectionTitle: string; fields: CmsField[] }[];
}

export const CMS_PAGES: CmsPageSchema[] = [
  {
    pageKey: "_global",
    title: "Configuración Global",
    description: "Datos de contacto y empresa usados en todo el sitio",
    sections: [
      {
        sectionTitle: "Empresa",
        fields: [
          { key: "company_name", label: "Razón Social", type: "text", placeholder: "Investigaciones y Seguridad Profesional S.A." },
          { key: "company_short", label: "Nombre Corto", type: "text", placeholder: "ISP, S.A." },
          { key: "tagline", label: "Eslogan", type: "text", placeholder: "Empresa Certificada · Guatemala" },
        ],
      },
      {
        sectionTitle: "Contacto",
        fields: [
          { key: "phone_main", label: "Teléfono Principal", type: "tel", placeholder: "+502 2200-0000" },
          { key: "phone_emergency", label: "Teléfono Emergencias", type: "tel", placeholder: "+502 2200-0001" },
          { key: "whatsapp_number", label: "Número WhatsApp (sin +)", type: "tel", placeholder: "50250000000" },
          { key: "email_contact", label: "Correo Contacto", type: "email", placeholder: "contacto@isp-guatemala.com" },
          { key: "email_operations", label: "Correo Operaciones", type: "email", placeholder: "operaciones@isp-guatemala.com" },
        ],
      },
      {
        sectionTitle: "Dirección",
        fields: [
          { key: "address_line1", label: "Dirección Línea 1", type: "text", placeholder: "Centro Corporativo, Zona 10" },
          { key: "address_line2", label: "Dirección Línea 2", type: "text", placeholder: "Ciudad de Guatemala, Guatemala" },
          { key: "hours_admin", label: "Horario Administración", type: "text", placeholder: "Lunes a Viernes 8:00 a 17:00" },
          { key: "hours_ops", label: "Horario Operaciones", type: "text", placeholder: "24/7 los 365 días" },
        ],
      },
    ],
  },
  {
    pageKey: "home",
    title: "Página Principal",
    description: "Hero, estadísticas, servicios y secciones de la portada",
    sections: [
      {
        sectionTitle: "Hero",
        fields: [
          { key: "hero_badge", label: "Insignia (badge)", type: "text", placeholder: "Empresa Certificada · Guatemala" },
          { key: "hero_title1", label: "Título Línea 1 (blanco)", type: "text", placeholder: "PROTECCIÓN" },
          { key: "hero_title2", label: "Título Línea 2 (dorado)", type: "text", placeholder: "PROFESIONAL" },
          { key: "hero_subtitle", label: "Subtítulo", type: "textarea", placeholder: "Seguridad física, custodia de transporte..." },
          { key: "hero_btn_primary", label: "Botón Principal", type: "text", placeholder: "Solicitar Evaluación" },
          { key: "hero_btn_secondary", label: "Botón Secundario", type: "text", placeholder: "WhatsApp Directo" },
          { key: "hero_note", label: "Nota Inferior", type: "text", placeholder: "Operaciones activas 24 / 7 · 365 días" },
        ],
      },
      {
        sectionTitle: "Servicios",
        fields: [
          { key: "service1_title", label: "Servicio 1 — Título", type: "text", placeholder: "Seguridad Física" },
          { key: "service1_desc", label: "Servicio 1 — Descripción", type: "textarea", placeholder: "Protección experta para instalaciones..." },
          { key: "service2_title", label: "Servicio 2 — Título", type: "text", placeholder: "Custodia de Transporte" },
          { key: "service2_desc", label: "Servicio 2 — Descripción", type: "textarea", placeholder: "Escoltas especializadas..." },
          { key: "service3_title", label: "Servicio 3 — Título", type: "text", placeholder: "Operaciones Móviles" },
          { key: "service3_desc", label: "Servicio 3 — Descripción", type: "textarea", placeholder: "Unidades patrulla y reacción rápida..." },
          { key: "service4_title", label: "Servicio 4 — Título", type: "text", placeholder: "Supervisión y Control" },
          { key: "service4_desc", label: "Servicio 4 — Descripción", type: "textarea", placeholder: "Gestión centralizada..." },
        ],
      },
      {
        sectionTitle: "CTA Final",
        fields: [
          { key: "cta_title", label: "Título CTA", type: "text", placeholder: "Proteja lo que más importa" },
          { key: "cta_subtitle", label: "Subtítulo CTA", type: "textarea", placeholder: "Contáctenos para una evaluación..." },
          { key: "cta_btn_primary", label: "Botón CTA Principal", type: "text", placeholder: "Solicitar Cotización" },
          { key: "cta_btn_secondary", label: "Botón CTA Secundario", type: "text", placeholder: "Contactar por WhatsApp" },
        ],
      },
    ],
  },
  {
    pageKey: "nosotros",
    title: "Sobre Nosotros",
    sections: [
      {
        sectionTitle: "Hero",
        fields: [
          { key: "hero_title", label: "Título", type: "text", placeholder: "Sobre ISP, S.A." },
          { key: "hero_subtitle", label: "Subtítulo", type: "textarea", placeholder: "Nuestra trayectoria en la industria..." },
        ],
      },
      {
        sectionTitle: "Misión y Visión",
        fields: [
          { key: "mision_title", label: "Título Misión", type: "text", placeholder: "Nuestra Misión" },
          { key: "mision_desc", label: "Descripción Misión", type: "textarea", placeholder: "Proveer servicios de seguridad integral..." },
          { key: "vision_title", label: "Título Visión", type: "text", placeholder: "Nuestra Visión" },
          { key: "vision_desc", label: "Descripción Visión", type: "textarea", placeholder: "Consolidarnos como la firma..." },
        ],
      },
      {
        sectionTitle: "Valores",
        fields: [
          { key: "valores_title", label: "Título Sección Valores", type: "text", placeholder: "Valores Corporativos" },
          { key: "valor1_title", label: "Valor 1 — Nombre", type: "text", placeholder: "Profesionalismo" },
          { key: "valor1_desc", label: "Valor 1 — Descripción", type: "text", placeholder: "Actuamos con disciplina..." },
          { key: "valor2_title", label: "Valor 2 — Nombre", type: "text", placeholder: "Integridad" },
          { key: "valor2_desc", label: "Valor 2 — Descripción", type: "text", placeholder: "Honestidad absoluta..." },
          { key: "valor3_title", label: "Valor 3 — Nombre", type: "text", placeholder: "Respuesta" },
          { key: "valor3_desc", label: "Valor 3 — Descripción", type: "text", placeholder: "Capacidad de reacción rápida..." },
          { key: "valor4_title", label: "Valor 4 — Nombre", type: "text", placeholder: "Innovación" },
          { key: "valor4_desc", label: "Valor 4 — Descripción", type: "text", placeholder: "Búsqueda constante de herramientas..." },
        ],
      },
    ],
  },
  {
    pageKey: "servicios",
    title: "Servicios",
    sections: [
      {
        sectionTitle: "Hero",
        fields: [
          { key: "hero_title", label: "Título", type: "text", placeholder: "Nuestros Servicios" },
          { key: "hero_subtitle", label: "Subtítulo", type: "textarea", placeholder: "Estrategias de seguridad a la medida..." },
        ],
      },
      {
        sectionTitle: "Tarjetas de Servicio",
        fields: [
          { key: "s1_title", label: "Servicio 1 — Título", type: "text", placeholder: "Seguridad Física" },
          { key: "s1_desc", label: "Servicio 1 — Descripción", type: "textarea", placeholder: "Protección experta para instalaciones..." },
          { key: "s2_title", label: "Servicio 2 — Título", type: "text", placeholder: "Custodia de Transporte" },
          { key: "s2_desc", label: "Servicio 2 — Descripción", type: "textarea", placeholder: "Escoltas especializadas..." },
          { key: "s3_title", label: "Servicio 3 — Título", type: "text", placeholder: "Operaciones Móviles" },
          { key: "s3_desc", label: "Servicio 3 — Descripción", type: "textarea", placeholder: "Unidades patrulla..." },
          { key: "s4_title", label: "Servicio 4 — Título", type: "text", placeholder: "Supervisión y Control" },
          { key: "s4_desc", label: "Servicio 4 — Descripción", type: "textarea", placeholder: "Gestión centralizada..." },
        ],
      },
    ],
  },
  {
    pageKey: "seguridad-fisica",
    title: "Seguridad Física",
    sections: [
      {
        sectionTitle: "Hero",
        fields: [
          { key: "hero_badge", label: "Insignia", type: "text", placeholder: "Servicio Especializado" },
          { key: "hero_title", label: "Título", type: "text", placeholder: "Seguridad Física" },
          { key: "hero_subtitle", label: "Subtítulo", type: "textarea", placeholder: "Presencia profesional y disuasiva..." },
        ],
      },
      {
        sectionTitle: "Contenido",
        fields: [
          { key: "section_title", label: "Título Sección Servicios", type: "text", placeholder: "¿Qué incluye nuestro servicio?" },
          { key: "agents_title", label: "Título Perfil Agentes", type: "text", placeholder: "Perfil de nuestros agentes" },
          { key: "agents_desc", label: "Descripción Perfil Agentes", type: "textarea", placeholder: "Todo el personal de ISP, S.A. atraviesa..." },
          { key: "ideal_title", label: "Título Sectores Ideales", type: "text", placeholder: "Ideal para:" },
          { key: "cta_title", label: "Título CTA Final", type: "text", placeholder: "Asegure la continuidad de sus operaciones" },
        ],
      },
    ],
  },
  {
    pageKey: "custodia-transporte",
    title: "Custodia de Transporte",
    sections: [
      {
        sectionTitle: "Hero",
        fields: [
          { key: "hero_badge", label: "Insignia", type: "text", placeholder: "Logística Segura" },
          { key: "hero_title", label: "Título", type: "text", placeholder: "Custodia de Transporte" },
          { key: "hero_subtitle", label: "Subtítulo", type: "textarea", placeholder: "Acompañamiento táctico..." },
        ],
      },
      {
        sectionTitle: "Proceso y CTA",
        fields: [
          { key: "process_title", label: "Título Proceso", type: "text", placeholder: "Proceso Operativo" },
          { key: "process_subtitle", label: "Subtítulo Proceso", type: "textarea", placeholder: "Implementamos un protocolo estricto..." },
          { key: "cta_title", label: "Título CTA Final", type: "text", placeholder: "Proteja su cadena de suministro hoy" },
        ],
      },
    ],
  },
  {
    pageKey: "sectores",
    title: "Sectores",
    sections: [
      {
        sectionTitle: "Hero",
        fields: [
          { key: "hero_title", label: "Título", type: "text", placeholder: "Sectores que Atendemos" },
          { key: "hero_subtitle", label: "Subtítulo", type: "textarea", placeholder: "Nuestra experiencia nos permite..." },
        ],
      },
      {
        sectionTitle: "Sectores",
        fields: [
          { key: "s1_title", label: "Sector 1 — Título", type: "text", placeholder: "Industria y Manufactura" },
          { key: "s1_desc", label: "Sector 1 — Descripción", type: "textarea", placeholder: "Protección de plantas de producción..." },
          { key: "s2_title", label: "Sector 2 — Título", type: "text", placeholder: "Logística y Transporte" },
          { key: "s2_desc", label: "Sector 2 — Descripción", type: "textarea", placeholder: "Blindaje de la cadena de suministro..." },
          { key: "s3_title", label: "Sector 3 — Título", type: "text", placeholder: "Comercio y Retail" },
          { key: "s3_desc", label: "Sector 3 — Descripción", type: "textarea", placeholder: "Prevención de robo hormiga..." },
          { key: "s4_title", label: "Sector 4 — Título", type: "text", placeholder: "Corporativo y Oficinas" },
          { key: "s4_desc", label: "Sector 4 — Descripción", type: "textarea", placeholder: "Seguridad ejecutiva..." },
          { key: "s5_title", label: "Sector 5 — Título", type: "text", placeholder: "Eventos Especiales" },
          { key: "s5_desc", label: "Sector 5 — Descripción", type: "textarea", placeholder: "Agentes especializados para manejo de masas..." },
          { key: "s6_title", label: "Sector 6 — Título", type: "text", placeholder: "Residenciales y Condominios" },
          { key: "s6_desc", label: "Sector 6 — Descripción", type: "textarea", placeholder: "Control de visitas, rondines perimetrales..." },
        ],
      },
    ],
  },
  {
    pageKey: "reclutamiento",
    title: "Reclutamiento",
    sections: [
      {
        sectionTitle: "Hero",
        fields: [
          { key: "hero_title", label: "Título", type: "text", placeholder: "Únase a Nuestro Equipo" },
          { key: "hero_subtitle", label: "Subtítulo", type: "textarea", placeholder: "Buscamos profesionales comprometidos..." },
        ],
      },
      {
        sectionTitle: "Requisitos",
        fields: [
          { key: "reqs_title", label: "Título Sección Requisitos", type: "text", placeholder: "Requisitos Generales" },
        ],
      },
    ],
  },
  {
    pageKey: "solicitar-servicio",
    title: "Solicitar Servicio",
    sections: [
      {
        sectionTitle: "Hero",
        fields: [
          { key: "hero_title", label: "Título", type: "text", placeholder: "Solicitar Evaluación de Seguridad" },
          { key: "hero_subtitle", label: "Subtítulo", type: "textarea", placeholder: "Diseñamos esquemas de seguridad corporativa..." },
        ],
      },
    ],
  },
  {
    pageKey: "contacto",
    title: "Contacto",
    sections: [
      {
        sectionTitle: "Hero",
        fields: [
          { key: "hero_title", label: "Título", type: "text", placeholder: "Contacto Institucional" },
          { key: "hero_subtitle", label: "Subtítulo", type: "textarea", placeholder: "Estamos a su disposición..." },
        ],
      },
      {
        sectionTitle: "Información de Contacto",
        fields: [
          { key: "address_title", label: "Título Dirección", type: "text", placeholder: "Oficinas Centrales" },
          { key: "address_value", label: "Dirección", type: "textarea", placeholder: "Centro Corporativo, Zona 10\nCiudad de Guatemala" },
          { key: "phone_title", label: "Título Teléfonos", type: "text", placeholder: "Central Telefónica" },
          { key: "phone_value", label: "Teléfonos", type: "textarea", placeholder: "+502 2200-0000\n+502 2200-0001 (Emergencias)" },
          { key: "email_title", label: "Título Correos", type: "text", placeholder: "Correos Electrónicos" },
          { key: "email_value", label: "Correos", type: "textarea", placeholder: "contacto@isp-guatemala.com\noperaciones@isp-guatemala.com" },
          { key: "hours_title", label: "Título Horarios", type: "text", placeholder: "Horarios de Atención" },
          { key: "hours_value", label: "Horarios", type: "textarea", placeholder: "Administración: Lunes a Viernes 8:00 a 17:00\nMonitoreo y Operaciones: 24/7 los 365 días" },
          { key: "whatsapp_number", label: "Número WhatsApp (sin +)", type: "tel", placeholder: "50250000000" },
        ],
      },
    ],
  },
  {
    pageKey: "acceso-clientes",
    title: "Acceso Clientes",
    sections: [
      {
        sectionTitle: "Hero",
        fields: [
          { key: "hero_badge", label: "Insignia", type: "text", placeholder: "Portal Operativo · ISP, S.A." },
          { key: "hero_title", label: "Título", type: "text", placeholder: "Portal de Clientes ISP" },
          { key: "hero_subtitle", label: "Subtítulo", type: "textarea", placeholder: "Acceso exclusivo al sistema de operaciones internas..." },
        ],
      },
      {
        sectionTitle: "CTA Final",
        fields: [
          { key: "cta_title", label: "Título CTA", type: "text", placeholder: "¿Es cliente actual de ISP, S.A.?" },
          { key: "cta_subtitle", label: "Subtítulo CTA", type: "textarea", placeholder: "Mientras la plataforma está en desarrollo..." },
        ],
      },
    ],
  },
];

export function getCmsPage(pageKey: string): CmsPageSchema | undefined {
  return CMS_PAGES.find((p) => p.pageKey === pageKey);
}

export function getAllFields(pageKey: string): CmsField[] {
  const page = getCmsPage(pageKey);
  if (!page) return [];
  return page.sections.flatMap((s) => s.fields);
}
