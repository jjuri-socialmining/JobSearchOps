Busca ofertas de trabajo actuales en British Columbia, Canada. Incluye remoto e hibrido desde Canada.

## Perfil objetivo

Busca estos roles (y variantes senior/lead/director/program):
- Operations Manager
- Project Manager
- Contracts Manager
- Commercial Manager
- Risk Manager
- Program Manager, Business Operations Manager, Vendor Manager, Procurement Manager

Sectores aceptados (cualquiera sirve):
- Construccion, infraestructura, inmobiliario
- Energia, mineria, recursos naturales
- Gobierno, sector publico, defensa
- Logistica, supply chain, manufactura
- Servicios financieros, seguros, banca
- Salud
- Tecnologia — SOLO si el rol es gestion de operaciones, NO desarrollo de software

Excluir:
- Roles de software, QA, DevOps, ingenieria de datos
- Pasantias y voluntariados
- Comision pura sin salario base

## Fuente — busca solo aqui

BC Gov
   - https://bcpublicservice.hua.hrsmart.com/hr/ats/JobSearch/index

Reglas adicionales para esta búsqueda:
- Visita SOLO estas URLs, no uses otras fuentes
- Si no hay resultados relevantes, devuelve un array JSON vacio: []

## Reglas de antiguedad

- Prefiere ofertas de los ultimos 14 dias
- Si la fecha no esta disponible, incluye la oferta igual con Posted vacio
- Excluye solo si sabes con certeza que tiene mas de 45 dias

## Reglas de Link

- Prefiere URL directa a la oferta especifica
- Para Indeed: incluye la URL con vjk= o jk= (ej. ca.indeed.com/jobs?vjk=abc123 o viewjob?jk=abc123)
- Si no tienes URL directa, incluye la oferta con Link vacio — el sistema la filtrara
- NO inventes URLs

## Salida

Responde SOLO con un array JSON valido. Sin markdown, sin texto extra.
Devuelve entre 10 y 15 ofertas. Si encuentras menos de 10, incluye todas las que tengas.

Cada objeto usa exactamente estas claves:
- Version: "1"
- Schema Version: "joboffers.v1"
- Alias: slug corto (empresa-titulo)
- Date: fecha actual YYYY-MM-DD
- Posted: fecha o texto relativo, vacio si no disponible
- Industry: sector de la empresa
- N Applicants: numero si visible, vacio si no
- Ranking: entero 1-100 (encaje del rol con el perfil)
- Prioridad: "alta" si Ranking >= 80, "media" si 60-79, "baja" si < 60
- Veredicto: "APPLY" si todo esta claro, "APPLY ONLY IF CLARIFIED" si falta info clave
- Organización: nombre de la empresa
- Título: titulo exacto del rol
- Ubicación / Modalidad: ciudad + presencial/hibrido/remoto
- Compensación: rango si publicado, vacio si no
- Por qué mirar esto primero: razon concreta de encaje
- Qué te falta validar antes de invertir tiempo: preguntas abiertas
- Link: URL de la oferta (vacio si no tienes URL directa)
