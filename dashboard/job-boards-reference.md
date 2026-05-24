# Job Boards Reference — Canadá / USA

> **[W] Workflow** — Referencia de fuentes, canales y portales de búsqueda activos
> Origen: `JobOps-LEGACY-LOCAL/Inbox/2026.Job Search.md` (sanitizado)
> Relacionado con: `JobSearchOps/config/sources.yaml`

---

## Fuentes activas en el pipeline (automatizadas)

Configuradas en `config/sources.yaml`:
- `bc-gov` — BC Public Service
- `adzuna-bc` — Adzuna British Columbia
- `civicjobs` — CivicJobs Canada

---

## Job Boards manuales — Canadá / USA

### Core (alta prioridad)

- LinkedIn: https://www.linkedin.com
- Indeed (CA): https://ca.indeed.com
- Indeed (US): https://www.indeed.com
- Glassdoor: https://www.glassdoor.ca/
- JobBank (GC): https://www.jobbank.gc.ca
- WorkBC: https://www.workbc.ca/

### Agregadores / Otros

- Monster (CA): https://www.monster.ca
- Workopolis: https://www.workopolis.com/
- ZipRecruiter: https://www.ziprecruiter.com/
- SimplyHired: https://www.simplyhired.com/
- Wowjobs: https://www.wowjobs.ca/
- Careerjet: https://www.careerjet.com/
- Jobleads: https://www.jobleads.com

### Tech / Especializados

- BCJobs: https://www.bcjobs.ca/
- BC Technology: https://www.bctechnology.com
- ComputerJobs: https://www.computerjobs.com/
- Eluta: http://www.eluta.ca/
- Jobbio: https://talent.jobbio.com/

### Gobierno / Local

- Government of BC jobs: https://search.employment.gov.bc.ca/
- Jobs Vancouver (City): https://jobs.vancouver.ca/
- CivicInfo BC: https://www.civicinfo.bc.ca/
- WorkBC Blueprint Builder: https://www.workbc.ca/blueprintbuilder

---

## ATS / Portales corporativos (alta prioridad)

| ATS | Empresa | URL |
|-----|---------|-----|
| Workday | Four Seasons | https://fourseasons.wd3.myworkdayjobs.com/ |
| Workday | Finning | https://finning.wd3.myworkdayjobs.com/en-US/External/jobs |
| iCIMS | Amazon CA | https://ca-amazon.icims.com |
| Taleo | Eaton | https://eaton.taleo.net |
| Taleo | Fujitsu | https://fujitsujobs.taleo.net/ |
| BambooHR | DFO | https://dfo.bamboohr.com/jobs/ |
| SAP SF | City of Vancouver | https://career17.sapsf.com/ |
| SAP Jobs | SAP | https://jobs.sap.com |
| Microsoft | Microsoft | https://careers.microsoft.com |

---

## Agencias / Recruiters

- Randstad: https://www.randstad.ca/
- Impact Recruitment: https://impactrecruitment.ca/candidate-portal/

---

## Freelance / Side gigs

- Upwork: https://www.upwork.com
- FlexJobs: https://www.flexjobs.com
- Workana: https://www.workana.com

---

## Búsquedas guardadas (Indeed — Vancouver)

- Manager: https://ca.indeed.com/jobs?q=manager&l=Vancouver%2C+BC&radius=50&sort=date
- Lead: https://ca.indeed.com/jobs?as_and=lead&l=Vancouver%2C+BC&radius=50&sort=date&limit=10

---

## Notas de integración

Para agregar una nueva fuente al pipeline automatizado, editar `config/sources.yaml` y crear el crawler correspondiente en `src/`.
Ver guía en `README.md` sección "Agregar fuentes nuevas".
