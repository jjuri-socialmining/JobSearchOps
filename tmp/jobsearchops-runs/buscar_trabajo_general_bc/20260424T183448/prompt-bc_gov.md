Busca ofertas de trabajo en British Columbia, Canada, publicadas en los últimos 7 días.

Usa SOLO esta fuente directa:
   - https://bcpublicservice.hua.hrsmart.com/hr/ats/JobSearch/index

Busca cualquier rol con "Manager" en el título.

Reglas:
- Devuelve SOLO ofertas de los últimos 7 días
- Devuelve entre 10 y 15 ofertas en un array JSON válido
- Sin texto extra, sin markdown, solo el array JSON

Cada objeto usa exactamente estas claves:
- Version: "1"
- Schema Version: "joboffers.v1"
- Alias: slug corto empresa-titulo
- Date: fecha actual YYYY-MM-DD
- Posted: fecha o texto relativo si disponible, vacío si no
- Industry: sector de la organización
- N Applicants: número si visible, vacío si no
- Ranking: entero 1-100 (encaje con perfil de gestión)
- Prioridad: "alta" si Ranking >= 80, "media" si 60-79, "baja" si < 60
- Veredicto: "APPLY" si todo está claro, "APPLY ONLY IF CLARIFIED" si falta info
- Organización: nombre exacto
- Título: título exacto del rol
- Ubicación / Modalidad: ciudad + presencial/híbrido/remoto
- Compensación: rango si publicado, vacío si no
- Por qué mirar esto primero: razón concreta
- Qué te falta validar antes de invertir tiempo: preguntas abiertas
- Link: URL directa de la oferta, vacío si no hay URL directa
