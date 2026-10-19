# Nenova — Presentación comercial con login propio

Proyecto independiente para tu servidor. Incluye presentación interactiva, marca Nenova, imágenes y autenticación por usuario y contraseña. **No requiere ChatGPT, Sites, Odoo, una base de datos ni paquetes de npm.** No contiene contactos comerciales ni formularios de captación.

## Ejecutar en local

Requisito: Node.js 22 o superior.

Desde `brochure-escolar/`:

```sh
# Solo la primera vez: crea .env y muestra una contraseña aleatoria.
npm run setup -- --user demo

# Iniciar el servidor.
npm start
```

Abrir **http://127.0.0.1:8093**. Usar el usuario y la contraseña mostrados por setup. `npm run dev` también inicia el mismo servidor. No es necesario ejecutar `npm install`.

**Usa esta dirección exacta en local:** `PUBLIC_ORIGIN` verifica el origen de los formularios. Si prefieres `localhost`, cambia `PUBLIC_ORIGIN=http://localhost:8093` en `.env` y reinicia.

No servir `dist/` directamente con Python, Nginx o un hosting estático: eso omitiría el login. El punto de entrada es `server.mjs`; el proxy debe dirigir todas las rutas a Node.

## Credenciales

Esta versión utiliza **una cuenta compartida para la presentación**, independiente de las cuentas de las escuelas. `.env` contiene el usuario y un hash scrypt; la contraseña no aparece en el HTML ni se conserva en texto plano.

Para cambiar usuario o generar una contraseña nueva:

```sh
npm run setup -- --user vendedor --reset
```

Guarda la nueva contraseña que muestra el comando y reinicia el proceso. La configuración de dominio y puerto se conserva. Para mantener el mismo usuario, especifícalo con `--user`.

Las sesiones duran 8 horas y se guardan en memoria. Reiniciar el servidor cierra todas las sesiones. El cierre de sesión invalida el token en el servidor. Diseñado para una instancia del proceso; varias réplicas requerirían almacenamiento compartido de sesiones.

## Preparar el paquete para subir

```sh
npm run package
```

Genera **`artifacts/nenova-servidor.tar.gz`** con el proyecto completo, incluido `.env.example`. Excluye `.env`, credenciales locales, historial Git, dependencias de QA y metadatos del alojamiento anterior.

Sube ese archivo y extráelo en una carpeta de tu servidor:

```sh
mkdir -p /opt/nenova-brochure
# Ejecutar desde donde se haya subido el archivo.
tar -xzf nenova-servidor.tar.gz -C /opt/nenova-brochure
cd /opt/nenova-brochure
npm run setup -- --user demo
```

La configuración inicial muestra una contraseña nueva para ese servidor. También puedes transferir tu `.env` por un canal privado si deseas conservar el mismo acceso; no se incluye en el paquete.

### Dominio y HTTPS

En el servidor, editar `.env`:

```dotenv
HOST=127.0.0.1
PORT=8093
PUBLIC_ORIGIN=https://demo.tu-dominio.com
NODE_ENV=production
COOKIE_SECURE=true
SESSION_HOURS=8
# Conservar LOGIN_USER y LOGIN_PASSWORD_HASH generados por setup.
```

Configurar el dominio con HTTPS y dirigir **todas las rutas** a `127.0.0.1:8093`. `PUBLIC_ORIGIN` debe coincidir exactamente con la dirección visible en el navegador, sin rutas finales. El servidor no confía en cabeceras de proxy suministradas por el cliente.

Incluye dos opciones de ejecución:

- **Node + systemd:** adaptar `deploy/nenova.service.example` al usuario y ubicación de Node. El servicio lee `.env`; usar un archivo propietario del usuario del servicio con permisos `600`.
- **Docker:** con `.env` ya configurado para HTTPS, ejecutar `docker compose up -d --build`. El contenedor escucha internamente en `0.0.0.0`, pero el puerto del host se publica solo en `127.0.0.1:8093`. El contenedor usa un usuario sin privilegios y un sistema de archivos de solo lectura.

El archivo `deploy/Caddyfile.example` muestra un proxy HTTPS. Si ya tienes Nginx u otro proxy, usa el existente y dirige el dominio a ese puerto. No es necesario instalar Caddy si ya tienes un proxy.

`GET /healthz` devuelve `ok` sin autenticación para comprobar que el proceso está disponible.

## Contenido de la presentación

- 12 módulos explorables: admisiones, alumnos y tutores, grupos y materias, horarios, calificaciones, asistencias, pagos, aula virtual, mensajería, credenciales QR, portales e institución.
- Nenova IA con cuatro ejemplos preparados: promedios, asistencia, pagos y redacción de comunicados.
- Mini demos por perfil: validar un pago, registrar asistencia, publicar una nota y simular una entrega.
- Versión para impresión que muestra el catálogo completo. El botón abre el diálogo del navegador; elegir Guardar como PDF.
- Dos imágenes ilustrativas y logo original. Los archivos y prompts están documentados en `RECURSOS.md`.

Los datos, personas, cifras y respuestas son ficticios. No hay consultas reales a IA ni a Odoo. Las interacciones de la demo permanecen en memoria del navegador y desaparecen al recargar; no se suben archivos. El login sí es real y lo valida este servidor.

## Comprobaciones y alcance

```sh
npm test
```

Pruebas HTTP: protección de contenido y assets, login correcto/incorrecto, rotación de sesión, logout, caducidad, cookies, rechazo de orígenes externos, bloqueo de archivos privados, límite de peticiones e inicio seguro en producción.

La limitación de intentos usa la dirección de conexión: detrás de un proxy local se comparte entre los visitantes. Son 5 intentos fallidos por 15 minutos; esto es deliberado para una presentación con cuenta compartida. No hay recuperación por correo ni gestión de múltiples usuarios.

El diseño y los flujos se comprobaron en Chrome en tamaños móvil y escritorio. La configuración de Docker y proxy se entrega como plantilla; el despliegue en tu servidor no se ha realizado.

Referencias técnicas de implementación: [scrypt y crypto de Node](https://nodejs.org/api/crypto.html) y [manejo de sesiones de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Base del contenido

Los textos comerciales se basan en los módulos locales `pre`, `pre_portal`, `enr`, `stu`, `ins`, `par`, `grp`, `cal`, `bol`, `his`, `att`, `pay`, `pla`, `msg`, `cred`, `ins_student_portal`, `ins_teacher_portal` y `ai_agent`. La demo simplifica los procesos para explicarlos; no reemplaza la operación real de Odoo.
