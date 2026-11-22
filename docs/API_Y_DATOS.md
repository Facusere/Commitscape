# API de GitHub, Modelo de Datos y Estrategia de Cuota

**Commitscape (Repoescena)** consume exclusivamente la **GitHub REST API v3** pública, sin necesidad de backend propio ni base de datos. Este documento especifica los endpoints utilizados (actuales y previstos), la estrategia para optimizar el límite de 60 consultas/hora sin autenticación, el modelo normalizado de datos y el manejo de errores.

---

## 1. Endpoints Utilizados

| Endpoint | Uso en Commitscape | Estado | Costo de Cuota |
| :--- | :--- | :--- | :--- |
| `GET /users/{user}` | Avatar, nombre, bio, `public_repos`, `followers`, `following`, fecha de alta (`created_at`), ubicación y enlaces. | **Actual (v1)** | 1 req (0 si `304`) |
| `GET /users/{user}/repos?per_page=100&sort=updated&page={n}` | Catálogo de repositorios públicos propios y forks, `stargazers_count`, `forks_count`, `language`, `topics`, `license`, `homepage`, `size`, `pushed_at`. | **Actual (v1, pág. 1) / Evolución (paginación)** | 1 req por página de 100 |
| `GET /repos/{owner}/{repo}/languages` | Desglose exacto en **bytes** por lenguaje de cada repositorio para el modo de precisión del Skyline 3D y la Cápsula Inspectora. | **Mejora Planificada** | 1 req por repo analizado |
| `GET /users/{user}/events/public?per_page=100` | Últimos eventos públicos (`PushEvent`, `PullRequestEvent`, `CreateEvent`) para alimentar el paisaje topográfico 3D (*Commitscape Terrain*). | **Mejora Planificada** | 1 req por perfil |
| `GET /rate_limit` | Consulta puntual de cuota restante sin consumir límite horario (opcional, ya que cada respuesta entrega cabeceras de cuota). | **Mejora Planificada** | 0 req |

---

## 2. Optimización de Cuota y Caché (`ETag` + `localStorage`)

Sin autenticación, GitHub permite **60 consultas por hora por IP** (y hasta **5.000/hora** si el usuario configura un Personal Access Token opcional). Para que la aplicación sea ágil incluso sin login:

1. **Lectura de cabeceras en cada respuesta**:
   - `X-RateLimit-Limit`: Límite total (`60` o `5000`).
   - `X-RateLimit-Remaining`: Consultas disponibles en la ventana actual.
   - `X-RateLimit-Reset`: Timestamp UNIX de reinicio para mostrar el horario local exacto en caso de `403`.
   - `ETag`: Identificador de versión del recurso devuelto por GitHub.
   - `Link`: Cabecera de paginación (`rel="next"`, `rel="last"`) para detectar si existen más de 100 repositorios.

2. **Estrategia de caché en dos niveles**:
   - **TTL fresco (15 minutos)**: Evita llamadas innecesarias al navegar entre modos (`Repos` ↔ `Comparador`), recargar la página o compartir enlaces.
   - **Revalidación condicional (`If-None-Match`)**: Al vencer el TTL, envía el `ETag` almacenado. Si el recurso no cambió en GitHub, la respuesta `304 Not Modified` **no descuenta cuota** y reutiliza el cuerpo guardado localmente.

3. **Concurrencia acotada para `/languages`**:
   - En lugar de lanzar 100 peticiones simultáneas que agotarían la cuota en un solo clic, el modo *Bytes reales* opera bajo una cola de concurrencia acotada (`máx. 4 en paralelo`), priorizando los repositorios propios más relevantes (por estrellas/tamaño) o ejecutándose bajo demanda al abrir la Cápsula Inspectora de un repositorio puntual.
   - Si el usuario posee token configurado, puede ampliar el análisis al catálogo completo.

---

## 3. Modelo de Datos Normalizado y Cálculos Derivados

A partir de las respuestas crudas de GitHub, la capa analítica construye un objeto normalizado por perfil:

```json
{
  "user": {
    "login": "torvalds",
    "name": "Linus Torvalds",
    "avatarUrl": "https://avatars.githubusercontent.com/u/1024025?v=4",
    "bio": "Sin bio",
    "location": "Portland, OR",
    "createdAt": "2011-09-03T15:26:22Z",
    "yearsActive": 15,
    "publicRepos": 9,
    "followers": 220000
  },
  "stats": {
    "ownReposCount": 8,
    "forksCount": 1,
    "totalStars": 185400,
    "totalForks": 54200,
    "avgStarsPerRepo": 23175,
    "languageDiversity": 4
  },
  "languagesByRepo": [
    { "name": "C", "count": 5, "share": 62.5, "color": "#555555" }
  ],
  "languagesByBytes": [
    { "name": "C", "bytes": 84200120, "share": 94.1, "color": "#555555" }
  ],
  "activityGrid": [
    { "date": "2026-11-18", "events": 4, "commits": 9, "intensity": 3 }
  ],
  "repos": [
    {
      "name": "linux",
      "description": "Linux kernel source tree",
      "htmlUrl": "https://github.com/torvalds/linux",
      "homepageUrl": null,
      "language": "C",
      "stars": 185000,
      "forks": 54000,
      "sizeKb": 4800000,
      "topics": ["kernel", "os"],
      "license": "GPL-2.0",
      "isFork": false,
      "isArchived": false,
      "pushedAt": "2026-11-19T12:00:00Z"
    }
  ]
}
```

### Fórmulas de métricas derivadas
- **Impacto promedio por repositorio**: `totalStars / Math.max(ownReposCount, 1)`.
- **Índice de afinidad tecnológica (Modo Duelo)**:
  $$\text{Afinidad (\%)} = \frac{|L_A \cap L_B|}{|L_A \cup L_B|} \times 100$$
  donde $L_A$ y $L_B$ son los conjuntos de lenguajes activos (en repositorios propios) de cada usuario.
- **Altura normalizada en Skyline 3D**:
  $$H_i = H_{\min} + \left(\frac{V_i}{V_{\max}}\right) \times (H_{\max} - H_{\min})$$
  Con $H_{\min} = 40\text{px}$ y $(H_{\max} - H_{\min}) = 180\text{px}$ en la escena actual (adaptable al contenedor), manteniendo visibilidad incluso para el sexto lenguaje.

---

## 4. Matriz de Manejo de Errores y Estados de Interfaz

| Código / Situación | Causa Probable | Comportamiento de Commitscape |
| :--- | :--- | :--- |
| **`200 OK`** | Consulta exitosa con datos frescos. | Actualiza caché + `ETag`, refresca indicador de cuota y renderiza los objetos 3D. |
| **`304 Not Modified`** | El `ETag` enviado coincide con el servidor. | Renueva TTL de la caché sin descontar cuota y renderiza sin parpadeos. |
| **`404 Not Found`** | El usuario o repositorio ingresado no existe. | Limpia escena previa y muestra alerta clara: *"No existe ese usuario."* (evita falsos positivos). |
| **`403 Forbidden` (Rate Limit)** | Cuota horaria de 60 consultas agotada (`X-RateLimit-Remaining: 0`). | Si existe copia previa en caché (aunque expirada), la ofrece como **modo degradado offline** con aviso; si no existe, muestra la hora exacta de reinicio (`X-RateLimit-Reset`) y ofrece ingresar un PAT opcional. |
| **`401 Unauthorized`** | Token personal (PAT) inválido, revocado o mal formateado. | Notifica al usuario que revise o limpie su token guardado para volver al modo anónimo. |
| **Fallo de red / Offline** | Sin conexión o corte temporal de DNS. | Hidrata desde caché local si el usuario ya fue visitado; de lo contrario informa estado sin conexión con botón *Reintentar*. |
