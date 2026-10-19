# Nenova — Presentación comercial escolar

Página independiente de `code/` y `app-escuelas/`, hecha para explicar y demostrar la plataforma de forma compacta. Marca Nenova con su logo original. Sin datos de contacto, enlaces comerciales externos ni formularios de captación, para facilitar su presentación por distribuidores.

## Vista local

```sh
cd dist
python3 -m http.server 8093 --bind 127.0.0.1
```

Abrir http://127.0.0.1:8093. No requiere instalar dependencias ni activar Odoo. La versión hospedada y su identidad se gestionan con Sites; `.openai/hosting.json` conserva el identificador del proyecto. La publicación inicial es privada.

## Contenido

- 12 módulos explorables: admisiones, alumnos y tutores, grupos y materias, horarios, calificaciones, asistencias, pagos, aula virtual, mensajería, credenciales QR, portales e institución.
- Nenova IA destacada con cuatro ejemplos preparados: promedios, asistencia, pagos y redacción de comunicados. Explicación de consultas de solo lectura, permisos y configuración.
- Mini demos por perfil, con estado compartido en memoria: validar un pago, registrar asistencia, publicar una nota y simular una entrega.
- Versión imprimible con el catálogo completo, aunque en pantalla esté filtrado. El botón abre la impresión del navegador; elegir Guardar como PDF.
- Dos imágenes ilustrativas generadas para esta página y logo original. Ver `RECURSOS.md` para archivos y prompts.

## Alcance de la demostración

Datos, personas, cifras y respuestas son ficticios. No son estadísticas del producto, testimonios ni resultados de una institución. La página no llama a IA, Odoo ni servicios externos. Los cambios desaparecen al recargar. Un archivo seleccionado no se sube: solo se muestra su nombre durante la visita.

Los flujos simplifican el producto para explicarlo: la publicación directa de una nota en esta demo no representa los criterios de evaluación ni el envío administrativo de actas; esos procesos se configuran en Odoo. La propuesta móvil anterior no se anuncia como una app publicada.

## Base del contenido

Revisión de los módulos del proyecto:

| Sección | Módulos consultados |
| --- | --- |
| Admisiones | `pre`, `pre_portal`, `enr` |
| Alumnos / institución / docentes | `stu`, `ins`, `par`, `grp` |
| Horarios / notas / asistencia | `cal`, `bol`, `his`, `att` |
| Pagos | `pay` |
| Aula virtual | `pla` |
| Comunicación y credenciales | `msg`, `cred` |
| Portales | `ins_student_portal`, `ins_teacher_portal` |
| IA | `ai_agent/services/query_executor.py`, `ai_agent/services/openai_service.py`, `ai_agent/controllers/chat_controller.py`, `msg/controllers/portal.py` |

## Comprobaciones

Probado en Chrome: filtros y 12 módulos, cuatro ejemplos IA, validación de pagos, publicación de notas, asistencia y entrega entre perfiles, reinicio de datos, ausencia de contactos, carga de imágenes y anchos de 320, 390, 768 y 1440 px. Sin errores JavaScript en esos recorridos. Revisada también la salida para impresión. No equivale a validar los servicios de Odoo.
