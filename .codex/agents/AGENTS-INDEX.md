# JobOps Agents Index

Guia rapida para saber que agente usar segun el tipo de decision o problema.

## Agentes disponibles

### `architecture-governor-CI-CD`
- Archivo: [architecture-governor-CI-CD.toml](/Volumes/Storage/PKM/JobOps-OS/JobSearchOps/.codex/agents/architecture-governor-CI-CD.toml)
- Uso:
  - gobernanza general de arquitectura
  - integridad CI/CD
  - decisiones marco del repo

### `jobops-search-architect`
- Archivo: [jobops-search-architect.toml](/Volumes/Storage/PKM/JobOps-OS/JobSearchOps/.codex/agents/jobops-search-architect.toml)
- Uso:
  - diseño del buscador laboral especializado
  - estrategia de fuentes
  - estrategia de adapters
  - routing por dominio
  - observabilidad de runtime
- Pregunta tipica:
  - “Como hacemos que nuevas URLs del prompt entren al runtime sin trabajo manual excesivo?”

### `jobops-source-debugger`
- Archivo: [jobops-source-debugger.toml](/Volumes/Storage/PKM/JobOps-OS/JobSearchOps/.codex/agents/jobops-source-debugger.toml)
- Uso:
  - `fetch failed`
  - `HTTP 404`
  - parser roto
  - selector debil
  - `NO_RESULTS` sospechoso
  - diferencias entre raw/final
- Pregunta tipica:
  - “Por que esta fuente no devolvio nada?”

### `jobops-scoring-governor`
- Archivo: [jobops-scoring-governor.toml](/Volumes/Storage/PKM/JobOps-OS/JobSearchOps/.codex/agents/jobops-scoring-governor.toml)
- Uso:
  - keywords
  - exclusiones
  - hard filters
  - weighted criteria
  - consistencia de veredictos
- Pregunta tipica:
  - “Estamos filtrando demasiado o demasiado poco?”

### `jobops-capture-operator`
- Archivo: [jobops-capture-operator.toml](/Volumes/Storage/PKM/JobOps-OS/JobSearchOps/.codex/agents/jobops-capture-operator.toml)
- Uso:
  - revisar corridas
  - comparar cobertura por fuente
  - ver que fuentes son productivas, debiles o rotas
  - definir el siguiente paso operativo
- Pregunta tipica:
  - “Como estuvo la corrida de hoy y donde estan los huecos?”

## Escalation map

- Problema estructural o multi-source:
  - `jobops-search-architect`

- Problema tecnico de una fuente o adapter:
  - `jobops-source-debugger`

- Problema de filtros, exclusiones o scoring:
  - `jobops-scoring-governor`

- Revision operativa de resultados:
  - `jobops-capture-operator`

- Gobernanza general del repo o CI/CD:
  - `architecture-governor-CI-CD`

## Orden recomendado

1. `jobops-capture-operator`
   - para leer el estado actual de una corrida
2. `jobops-source-debugger`
   - si una fuente falla o da cero
3. `jobops-scoring-governor`
   - si el problema parece de filtros
4. `jobops-search-architect`
   - si hace falta rediseño o expansion estructural

## Regla practica

Si no sabes cual usar:
- empieza con `jobops-capture-operator` para ver el panorama
- luego escala al especialista correcto
