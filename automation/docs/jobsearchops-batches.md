# JobSearchOps Batches

Tabla base para registrar batches ejecutables desde Obsidian y sus destinos operativos.

Notas:
- Si existe `.env` en la raiz del repo, el runner carga automaticamente `N8N_WEBHOOK_URL` y otras variables antes de correr.
- El acceso directo recomendado para ejecutar desde Obsidian es el launcher `.command` dentro de la tabla.

| nombre del script                                   | ejecutar                                                                      | rol                       | dias max posted | min ofertas | total ofertas                                            | usa filtro | keywords excluyentes aviso                                                   | prompt file            | keywords  | nota                                                               | status                                     |
| --------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------- | --------------- | ----------- | -------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------- | ---------------------- | --------- | ------------------------------------------------------------------ | ------------------------------------------ |
| `scripts/jobops-test-level1.sh`                     | [Nivel 1 Node](../../scripts/jobops-test-level1.command)                      | `management`              | `30`            | `10`        | [5](../../tmp/jobops-pipeline/latest-level1-jobs.md)     | `si`       | `journalism`                                                                 | `config/keywords.yaml` | `manager` | 15 raw -> 5 final; filtradas 10; relajar filtros o ampliar fuentes | bug: por debajo del minimo esperado (5/10) |
| `scripts/jobsearchops/buscar_trabajo_general_bc.sh` | [Generar ahora](../../scripts/jobsearchops/buscar_trabajo_general_bc.command) | `management multi-source` | `30`            | `10`        | [59](../../tmp/jobops-pipeline/latest-all-sites-jobs.md) | `si`       | `journalism, Manager of Criminal Operations, Financial Analyst, Tax Auditor` | `config/keywords.yaml` | `AI`      | 1 fuentes configuradas; 59 ofertas finales; adzuna-bc: 59          | exito ✅                                    |
| `scripts/jobsearchops/reenviar_ultimo_batch.sh`     | [Reenviar último](../../scripts/jobsearchops/reenviar_ultimo_batch.command)   | `reenvio`                 | `—`             | `—`         | `—`                                                      | `—`        | `—`                                                                          | —                      | —         | `solo reenvia payload existente`                                   | `manual`                                   |

### Salida MD del pipeline Node

- Acceso rapido estable: [latest-level1-jobs.md](../../tmp/jobops-pipeline/latest-level1-jobs.md)
- Acceso rapido estable multi-source: [latest-all-sites-jobs.md](../../tmp/jobops-pipeline/latest-all-sites-jobs.md)
- Archivo unico por corrida: `tmp/jobops-pipeline/runs/<run_id>-bc_public_service-level1/YYYY-MM-DD - bc_public_service - level1-joboffers.md`
- La ruta exacta del ultimo archivo generado tambien queda en `tmp/jobops-pipeline/latest-summary.json` bajo `report_md_file`

## Workflow n8n

### Resumen ejecutivo

Veredicto: APPLY.
Por que: el pipeline ya entrega un `POST` JSON simple con `columns`, `rows`, `count`, `batch_name`, `prompt_file`, `raw_output_file` y `exported_at`, asi que en n8n solo necesitas recibirlo, opcionalmente iterar `rows`, y decidir si lo guardas en base de datos, Notion, correo o una tabla Markdown externa.

### Flujo minimo recomendado

1. Crea un workflow nuevo en n8n.
2. Agrega un nodo `Webhook`.
3. Configuralo asi:
   - `HTTP Method`: `POST`
   - `Path`: `jobsearchops/joboffers`
   - `Response`: `When Last Node Finishes`
4. Copia la `Production URL` del webhook.
5. En este repo, crea o edita `.env` con:

```bash
N8N_WEBHOOK_URL=https://TU-N8N/webhook/jobsearchops/joboffers
```

6. Agrega un nodo `Respond to Webhook`.
7. Configura la respuesta JSON:

```json
{
  "ok": true,
  "received": {{$json.count}},
  "batch_name": "{{$json.batch_name}}"
}
```

8. Conecta `Webhook -> Respond to Webhook`.
9. Activa el workflow.
10. Ejecuta el boton `Generar ahora` o corre el script manualmente.

### Payload esperado

El exportador envia este formato:

```json
{
  "columns": [
    "Version",
    "Schema Version",
    "Alias",
    "Date",
    "Posted",
    "Industry",
    "N Applicants",
    "Ranking",
    "Prioridad",
    "Veredicto",
    "Organización",
    "Título",
    "Ubicación / Modalidad",
    "Compensación",
    "Por qué mirar esto primero",
    "Qué te falta validar antes de invertir tiempo",
    "Link"
  ],
  "rows": [
    {
      "Version": "1",
      "Schema Version": "joboffers.v1",
      "Alias": "example-org-program-manager-2026-04-24",
      "Date": "2026-04-24",
      "Posted": "",
      "Industry": "",
      "N Applicants": "",
      "Ranking": "88",
      "Prioridad": "alta",
      "Veredicto": "APPLY",
      "Organización": "Example Org",
      "Título": "Program Manager",
      "Ubicación / Modalidad": "Vancouver / Hybrid",
      "Compensación": "",
      "Por qué mirar esto primero": "",
      "Qué te falta validar antes de invertir tiempo": "",
      "Link": "https://example.com/job/1"
    }
  ],
  "count": 1,
  "batch_name": "buscar_trabajo_general_bc",
  "prompt_file": "/ruta/al/prompt.md",
  "raw_output_file": "/ruta/al/codex-last-message.txt",
  "exported_at": "2026-04-24T18:08:12.354606+00:00"
}
```

### Si quieres procesar una oferta por item

1. Despues del `Webhook`, agrega un nodo `Code`.
2. Usa este codigo JavaScript:

```javascript
const rows = $json.rows || [];
return rows.map((row) => ({ json: row }));
```

3. Desde ahi puedes conectar:
   - `Google Sheets` si luego quieres volver a hoja
   - `Notion`
   - `Airtable`
   - `Markdown` o `HTML` generator
   - `Slack` o `Email`

### Hard filters

- El webhook debe aceptar `POST` JSON.
- La URL productiva de n8n debe estar en `N8N_WEBHOOK_URL`.
- Si solo usas webhook, no necesitas `GOOGLE_SERVICE_ACCOUNT_JSON` ni `GOOGLE_SHEET_ID`.

### Next action

- Crea el workflow minimo con `Webhook -> Respond to Webhook`.
- Guarda `N8N_WEBHOOK_URL` en `.env`.
- Prueba con el boton `Generar ahora`.

#batch