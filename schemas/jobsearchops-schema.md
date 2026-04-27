# JobSearchOps — Schema Mandatorio v1

Estas reglas aplican a **todos** los buscadores de este repo.
Un campo marcado como `MANDATORIO` no puede ser inventado ni aproximado — si no está disponible, se deja vacío o la oferta se descarta.

---

## Campos y reglas

| Campo | Tipo | Mandatorio | Regla |
| --- | --- | --- | --- |
| `Version` | string | sí | Siempre `"1"` |
| `Schema Version` | string | sí | Siempre `"joboffers.v1"` |
| `Alias` | string | sí | Slug corto, estable, sin espacios. Derivado de Organización + Título + Date si no viene explícito |
| `Date` | string | sí | Fecha de ejecución del batch en formato `YYYY-MM-DD` |
| `Posted` | string | no | Fecha o texto relativo de publicación. Vacío si no está disponible |
| `Industry` | string | no | Industria inferida del rol. Vacío si no es claro |
| `N Applicants` | string | no | Número de postulantes si está visible. Vacío si no |
| `Ranking` | integer | sí | Entero del 1 al 100. Estimación del encaje basada en señales reales de la oferta |
| `Prioridad` | string | sí | Exactamente uno de: `alta`, `media`, `baja` |
| `Veredicto` | string | sí | Exactamente uno de: `APPLY`, `APPLY ONLY IF CLARIFIED`, `DISCARD` |
| `Organización` | string | sí | Nombre real de la empresa. No inventar |
| `Título` | string | sí | Título exacto del rol como aparece en la oferta |
| `Ubicación / Modalidad` | string | sí | Ciudad/provincia + modalidad (Presencial / Híbrido / Remoto) |
| `Compensación` | string | no | Rango o valor si está publicado. Vacío si no aparece en la oferta |
| `Por qué mirar esto primero` | string | sí | Razón concreta basada en señales reales de la oferta. No genérico |
| `Qué te falta validar antes de invertir tiempo` | string | sí | Preguntas abiertas reales. No inventar respuestas |
| `Link` | string | **MANDATORIO ESTRICTO** | Ver regla abajo |

---

## Regla estricta del campo `Link`

> **El `Link` debe ser la URL directa y exacta a la oferta específica.**

### Válido
- `https://ca.linkedin.com/jobs/view/customer-success-manager-at-martell-media-4405264388`
- `https://jobs.lever.co/hopper/abc123`
- `https://boards.greenhouse.io/company/jobs/456`
- `https://www.company.com/careers/job-title-123`

### Inválido — dejar Link vacío
- URLs de búsqueda: `https://ca.indeed.com/q-something-l-bc-jobs.html`
- URLs de categoría: `https://linkedin.com/jobs/search?keywords=developer`
- URLs de página principal: `https://company.com/careers`
- Cualquier URL que lleve a una lista, no a una oferta específica

### Criterio de decisión
Si al abrir el link el usuario vería **la oferta concreta** → válido.
Si vería **una lista de resultados o página general** → dejar `Link` vacío.

**No inventes ni aproximes URLs. Vacío es mejor que incorrecto.**

---

## Reglas de descarte de oferta completa

Descarta la oferta (no la incluyas en el output) si:
- No puedes confirmar que la oferta existe realmente
- El título o empresa parecen spam o agregador de terceros sin fuente original
- Es práctica, voluntariado, o rol claramente junior sin señal de excepción
- No cumple el filtro geográfico del prompt (BC o remoto desde Canadá)

---

## Volumen de salida

- Mínimo: 5 ofertas
- Máximo: 12 ofertas
- Si no hay suficientes ofertas que cumplan todas las reglas → devuelve las que hay, aunque sean menos de 5
