# Funcionalidades y Propuestas de Mejora

Este documento detalla tanto las capacidades ya presentes en el prototipo inicial (`index.html`) como el conjunto completo de **mejoras funcionales** diseñadas a partir de las limitaciones conocidas y las próximas metas planteadas en el planteo original de **Repoescena / Commitscape**.

---

## 1. Inventario de Capacidades Base (Prototipo v1)

El archivo actual ya resuelve de forma compacta el flujo mínimo de descubrimiento:
- Búsqueda por nombre de usuario de GitHub (botón `Ver perfil` o tecla `Enter`).
- Carga simultánea de perfil (`/users/{user}`) y hasta 100 repositorios ordenados por actualización.
- Filtrado automático de repositorios propios (`!r.fork`) para no inflar el perfil con código ajeno.
- Métricas agregadas en cabecera: total de repositorios públicos, seguidores, suma de estrellas en repos propios y año de ingreso a GitHub.
- Gráfico de prismas 3D con los 6 lenguajes más frecuentes según el campo `language`.
- Grilla con el **Top 6 de repositorios por estrellas**, enlazados de forma segura (`target="_blank" rel="noopener"`).
- Mensajes de error diferenciados para usuario inexistente (`404`) y cuota excedida (`403`).

---

## 2. Mejoras Funcionales Incorporadas en la Evolución

### 2.1 Motor Dual de Análisis de Lenguajes (Repos vs. Bytes Reales)
El prototipo original advierte como limitación que `repo.language` refleja solo el lenguaje mayoritario de cada proyecto. Para corregirlo sin agotar la cuota gratuita de GitHub:

- **Modo 1 · Instantáneo (Por Repositorio Principal)**: Cero llamadas adicionales; construye el Skyline 3D al instante a partir de `own` (`!r.fork`).
- **Modo 2 · Precisión en Bytes (`/repos/{owner}/{repo}/languages`)**:
  - Se activa mediante un conmutador en el escenario 3D (`[Por Repos | Por Bytes reales]`) o dentro de la Cápsula Inspectora de un repo específico.
  - Consulta de forma acotada (en lotes de concurrencia controlada, p. ej. top 12-15 repositorios propios por peso/estrellas o los seleccionados por el usuario) el volumen exacto en bytes de cada lenguaje.
  - Recalcula las alturas de las torres 3D, muestra porcentajes reales (`ej. TypeScript 54.2% · 1.8 MB`) y actualiza la paleta cromática oficial de GitHub Linguist.
  - **Protección automática de cuota**: Si `X-RateLimit-Remaining` cae por debajo de un umbral seguro (ej. `< 15` sin token), advierte antes de lanzar múltiples consultas por repo.

### 2.2 Paginación Completa (>100 Repositorios) y Explorador Avanzado
Supera la segunda limitación reconocida ("Solo se leen los primeros 100 repos"):

- **Carga paginada bajo control**: Lee el encabezado `Link` o itera `?page=2`, `?page=3` cuando `public_repos > 100` (con tope configurable de seguridad o botón *Cargar catálogo completo* si supera 300 repos sin autenticación).
- **Explorador de grilla enriquecido**:
  - **Filtro interactivo desde el 3D**: Hacer clic en una torre del Skyline 3D filtra la grilla para mostrar todos los repositorios que utilizan ese lenguaje.
  - **Buscador local instantáneo**: Filtra repositorios ya descargados por nombre, descripción o *topic* sin consumir API.
  - **Ordenamiento multipropósito**: Estrellas (`★`), Forks (`⑂`), Última actualización, Tamaño (`size`) o Alfabético.
  - **Toggles de inclusión**: Opción para incluir o excluir `forks` y repositorios `archived`.

### 2.3 Comparador Espacial de Dos Usuarios (Arena de Duelo 3D)
Responde directamente a la primera mejora listada en el README original (*"Comparar dos usuarios"*):

- Permite ingresar `@usuarioA` y `@usuarioB` en modo dual (`?user=torvalds&compare=gaearon`).
- Ejecuta las cargas en paralelo reutilizando la caché local cuando alguno de los perfiles ya fue consultado recientemente.
- Calcula y renderiza en la **Arena de Duelo 3D**:
  - Comparativa volumétrica de repositorios propios, estrellas totales, forks totales, seguidores y años activos.
  - **Índice de afinidad tecnológica**: Porcentaje de intersección de lenguajes compartidos y lenguajes exclusivos de cada desarrollador.
  - **Top 3 repositorios emblemáticos** lado a lado.

### 2.4 Caché Inteligente (`localStorage` + `ETag`) y Gestión de Cuota
Atiende la mejora *"Caché de resultados"* y resuelve la fricción de las 60 consultas/hora sin token:

- **Caché con TTL en `localStorage`**: Almacena el perfil, repositorios y desgloses de lenguajes durante un TTL configurable (por defecto `15 minutos`) para respuestas instantáneas en recargas o comparaciones repetidas.
- **Validación condicional `ETag` (`If-None-Match`)**: Cuando el TTL expira, se envía el `ETag` guardado. Si los datos en GitHub no cambiaron, la API responde **`304 Not Modified`**, que **no descuenta cuota del límite horario** según la documentación oficial de GitHub.
- **Telemetría transparente en cabecera**: Muestra una píldora discreta con las consultas restantes (`API: 54/60`) y la hora de reinicio si la cuota está baja.
- **Soporte opcional de Personal Access Token (PAT)**: Un modal opcional permite al usuario pegar su propio token de solo lectura pública guardado en `localStorage`/`sessionStorage` (nunca enviado a terceros), elevando el límite de `60` a `5.000` peticiones por hora para analizar cuentas masivas y activar el modo *Bytes reales* completo.

### 2.5 Paisaje de Actividad (*Commitscape Terrain*) e Inspector de Repo
- **Mapa topográfico de actividad pública**: Extrae los últimos eventos públicos del usuario (`/users/{user}/events/public?per_page=100`) para poblar el objeto 3D *Commitscape Terrain* y mostrar qué repositorios tuvieron actividad reciente.
- **Cápsula Inspectora Flip 180°**: Evita abandonar el sitio para conocer detalles de un repo; expone licencia, topics, tamaño, demo en vivo (`homepage`), breakdown de lenguajes propio y comando `git clone` copiable en un clic.

### 2.6 Deep Linking, Perfiles Sugeridos e Historial Reciente
- **Sincronización con la URL**: Actualizar parámetros (`?user=octocat`, `?compare=torvalds`, `?mode=bytes`, `?lang=TypeScript`) permite compartir enlaces directos a una escena 3D ya cargada.
- **Chips de descubrimiento**: Botones rápidos debajo del buscador con perfiles representativos (ej. `torvalds`, `gaearon`, `sindresorhus`, `tj`) para probar la experiencia 3D en un clic sin escribir.
- **Historial local**: Últimos 5 usuarios consultados disponibles como accesos inmediatos (con opción de limpiar historial).

---

## 3. Matriz de Priorización de Mejoras

| Mejora | Problema Original que Resuelve | Impacto Visual / UX | Costo de Cuota API | Prioridad |
| :--- | :--- | :--- | :--- | :--- |
| **Caché TTL + `ETag` (`304`)** | Agotamiento rápido de 60 req/h | Muy Alto (respuesta instantánea) | Reduce consumo drásticamente | P0 (Crítica) |
| **Ecosistema de 7 Objetos 3D** | Escena limitada a 1 gráfico y tilt básico | Máximo (sello del portfolio) | Nulo (100% cliente CSS/Canvas) | P0 (Crítica) |
| **Filtros, búsqueda y orden en grilla** | Solo mostraba el Top 6 fijo | Alto (exploración completa) | Nulo (sobre datos ya cargados) | P1 (Alta) |
| **Desglose real en bytes** | Sesgo por campo `language` único | Alto (precisión técnica real) | Medio (controlado por demanda) | P1 (Alta) |
| **Arena de Duelo 3D (2 usuarios)** | Consulta aislada de 1 perfil | Muy Alto (interacción social) | Bajo (2 req base por usuario B) | P1 (Alta) |
| **Paginación >100 repos + PAT opcional** | Corte en 100 repos en perfiles grandes | Medio-Alto (completitud) | Variable según repos | P2 (Media) |
| **Paisaje de Commits (`events/public`)** | Falta de noción temporal de actividad | Muy Alto (identidad *Commitscape*) | Mínimo (+1 req por perfil) | P2 (Media) |
