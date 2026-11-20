# Google Drive en MotilityJ-web · Google Drive in MotilityJ-web

[Español](#español) · [English](#english)

---

## Español

La versión web de MotilityJ puede usar, de forma opcional, el Google Drive **propio** de cada usuario para:

* guardar copias de seguridad de los experimentos y cargarlas en otro ordenador;
* enviar fotos de placas tomadas con el móvil a `MotilityJ/Inbox` y analizarlas después en un ordenador.

Mientras `GOOGLE_CLIENT_ID` en `web/js/config.js` esté vacío, Drive está **totalmente desactivado**: la interfaz
oculta los botones y no se carga ningún script de Google.

### Cómo funciona

* Inicio de sesión con [Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
  (modelo de token). `accounts.google.com/gsi/client` se carga sólo cuando el usuario pulsa *Conectar Google Drive*.
* Permiso (scope): sólo `https://www.googleapis.com/auth/drive.file` (no sensible): la aplicación ve
  únicamente los archivos que ella misma ha creado.
* El token de acceso (≈1 h) se guarda sólo en memoria. Cuando caduca, el estado pasa a *expired* y la app pide
  reconectar; las fotos pendientes siguen en cola. No hay tokens de refresco ni secretos de cliente.
* API REST de Drive v3 desde el navegador (`web/js/drive.js`, probado con `web/js/drive.mock-test.html`).
* Estructura en Drive:
  ```
  MotilityJ/
    Backups/   <experimento>.motilityj.json     un archivo por experimento, actualizado en el mismo sitio
               <experimento> (conflict, <dispositivo> <fecha>).motilityj.json
    Inbox/     <fecha> <cepa> <muestra> <id>.jpg + .json (sidecar)
      Processed/
  ```
* Conflictos: cada dispositivo recuerda la versión de Drive del archivo que escribió o leyó por última vez. Si el
  archivo cambió en Drive desde entonces (otro ordenador lo guardó), no se sobrescribe: se crea una copia
  `(conflict, …)`. Cargar una copia nunca escribe nada en Drive.
* Capturas del móvil: la foto se reduce a JPEG de 3000 px como máximo; el JSON (sidecar) con los datos de la
  placa y una miniatura se sube al final y marca la captura como completa. Las subidas esperan en una base de
  datos IndexedDB propia (`motilityj-drive-queue`) y se reintentan al recuperar la conexión o al reconectar.

### Configuración de Google Cloud (responsable del despliegue)

1. Entra en <https://console.cloud.google.com/> con la cuenta que administrará la aplicación y crea un proyecto
   (p. ej. *MotilityJ web*).
2. **Habilitar la API**: *APIs y servicios → Biblioteca* → busca **Google Drive API** → *Habilitar*.
3. **Pantalla de consentimiento OAuth** (*APIs y servicios → Pantalla de consentimiento de OAuth*, o
   *Google Auth Platform → Branding / Audience / Data access* en la consola nueva):
   * Tipo de usuario: **Externo**.
   * Nombre de la app: *MotilityJ*; correo de asistencia y correo de contacto del desarrollador.
   * Página principal: `https://joheras.github.io/MotilityJ/`; política de privacidad:
     `https://joheras.github.io/MotilityJ/privacy.html`; dominio autorizado: `joheras.github.io`.
   * Permisos (*Data access → Add or remove scopes*): añade sólo
     `https://www.googleapis.com/auth/drive.file` (*See, edit, create, and delete only the specific Google
     Drive files you use with this app*).
   * Estado de publicación: **Prueba (Testing)**. En *Usuarios de prueba* añade las cuentas de Gmail que vayan a
     usarlo (máx. 100). En modo prueba, Google muestra el aviso "app no verificada" (se puede continuar).
4. **Cliente OAuth**: *Credenciales → Crear credenciales → ID de cliente de OAuth* (o *Clients → Create client*):
   * Tipo de aplicación: **Aplicación web**.
   * Orígenes de JavaScript autorizados:
     * `https://joheras.github.io`
     * `http://localhost:8090`
   * URIs de redirección: **ninguna** (el modelo de token usa una ventana emergente). No se usa el secreto de
     cliente: no lo copies en ningún sitio.
5. **Pegar el ID de cliente** (público, no es un secreto) en `web/js/config.js`:
   ```js
   export const GOOGLE_CLIENT_ID = "1234567890-abcdefg.apps.googleusercontent.com";
   ```
   Haz commit y publica en GitHub Pages. Eso es todo: la interfaz mostrará *Conectar Google Drive*.
6. **Salir del modo prueba** (opcional, para que cualquier persona pueda conectar sin el aviso): pulsa
   *Publicar app*. Como `drive.file` **no es un permiso sensible ni restringido**, no hace falta la verificación
   de permisos (ni auditoría de seguridad); Google sólo verifica la **marca** (*brand verification*):
   * página principal y política de privacidad públicas en el mismo dominio (arriba), enlazadas desde la app;
   * el dominio (`joheras.github.io`, o un dominio propio) verificado en
     [Google Search Console](https://search.google.com/search-console) por un propietario del proyecto;
   * nombre de la app coherente con la página principal y, opcionalmente, un logotipo (si se sube un logotipo,
     la verificación es obligatoria y tarda unos días).

### Probar en local

```bash
python3 -m http.server 8090 --directory web
```

Abre `http://localhost:8090/` (usa `localhost`, no `127.0.0.1`: sólo `localhost` está entre los orígenes
autorizados). Las pruebas automáticas, que no hablan con Google, están en
`http://localhost:8090/js/drive.mock-test.html`.

### Problemas frecuentes

* `origin_mismatch` / `redirect_uri_mismatch`: el origen exacto (esquema, host y puerto) no está en el cliente
  OAuth. Los cambios pueden tardar unos minutos.
* `access_denied` en modo prueba: la cuenta no está en *Usuarios de prueba*.
* La ventana de Google no se abre: permite ventanas emergentes para el sitio; los bloqueadores de anuncios pueden
  impedir cargar `accounts.google.com/gsi/client`.

---

## English

The web version of MotilityJ can optionally use each user's **own** Google Drive to:

* back up experiments and load them on another computer;
* send photos of plates taken with a phone to `MotilityJ/Inbox` and analyse them later on a computer.

While `GOOGLE_CLIENT_ID` in `web/js/config.js` is empty, Drive is **completely disabled**: the UI hides it and no
Google script is loaded.

### How it works

* Sign-in with [Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
  (token model). `accounts.google.com/gsi/client` is loaded only when the user clicks *Connect Google Drive*.
* Scope: only `https://www.googleapis.com/auth/drive.file` (non-sensitive): the app sees only the files it
  created.
* The access token (≈1 h) is kept in memory only. When it expires the status becomes *expired* and the app asks
  to reconnect; pending photos stay queued. No refresh tokens, no client secret.
* Drive REST API v3 from the browser (`web/js/drive.js`, tested by `web/js/drive.mock-test.html`).
* Layout in Drive:
  ```
  MotilityJ/
    Backups/   <experiment>.motilityj.json     one file per experiment, updated in place
               <experiment> (conflict, <device> <date>).motilityj.json
    Inbox/     <date> <strain> <sample> <id>.jpg + .json (sidecar)
      Processed/
  ```
* Conflicts: each device remembers the Drive version of the file it last wrote or read. If the file changed in
  Drive since then (another computer saved it), it is not overwritten: a `(conflict, …)` copy is written instead.
  Loading a backup never writes to Drive.
* Phone captures: the photo is downscaled to a JPEG of at most 3000 px; the JSON sidecar (plate data and a small
  thumbnail) is uploaded last and marks the capture complete. Uploads wait in their own IndexedDB database
  (`motilityj-drive-queue`) and are retried when the connection comes back or after reconnecting.

### Google Cloud setup (owner of the deployment)

1. Go to <https://console.cloud.google.com/> with the account that will own the app and create a project
   (e.g. *MotilityJ web*).
2. **Enable the API**: *APIs & Services → Library* → search **Google Drive API** → *Enable*.
3. **OAuth consent screen** (*APIs & Services → OAuth consent screen*, or *Google Auth Platform → Branding /
   Audience / Data access* in the new console):
   * User type: **External**.
   * App name *MotilityJ*; user support e-mail and developer contact e-mail.
   * Home page `https://joheras.github.io/MotilityJ/`; privacy policy
     `https://joheras.github.io/MotilityJ/privacy.html`; authorised domain `joheras.github.io`.
   * Scopes (*Data access → Add or remove scopes*): add only `https://www.googleapis.com/auth/drive.file`
     (*See, edit, create, and delete only the specific Google Drive files you use with this app*).
   * Publishing status: **Testing**. Under *Test users* add the Gmail accounts that will use it (max. 100).
     In Testing, Google shows an "unverified app" warning (users can continue).
4. **OAuth client**: *Credentials → Create credentials → OAuth client ID* (or *Clients → Create client*):
   * Application type: **Web application**.
   * Authorised JavaScript origins:
     * `https://joheras.github.io`
     * `http://localhost:8090`
   * Redirect URIs: **none** (the token model uses a pop-up). The client secret is not used: do not copy it
     anywhere.
5. **Paste the client ID** (public, not a secret) into `web/js/config.js`:
   ```js
   export const GOOGLE_CLIENT_ID = "1234567890-abcdefg.apps.googleusercontent.com";
   ```
   Commit and publish to GitHub Pages. That's all: the UI will show *Connect Google Drive*.
6. **Leave Testing** (optional, so that anyone can connect without the warning): click *Publish app*. Because
   `drive.file` is **neither a sensitive nor a restricted scope**, no scope verification (or security assessment)
   is needed; Google only performs **brand verification**:
   * public home page and privacy policy on the same domain (above), linked from the app;
   * the domain (`joheras.github.io`, or a custom domain) verified in
     [Google Search Console](https://search.google.com/search-console) by a project owner;
   * an app name consistent with the home page and, optionally, a logo (uploading a logo makes verification
     mandatory and takes a few days).

### Local testing

```bash
python3 -m http.server 8090 --directory web
```

Open `http://localhost:8090/` (use `localhost`, not `127.0.0.1`: only `localhost` is an authorised origin). The
automated tests, which never talk to Google, are at `http://localhost:8090/js/drive.mock-test.html`.

### Troubleshooting

* `origin_mismatch` / `redirect_uri_mismatch`: the exact origin (scheme, host and port) is not in the OAuth
  client. Changes can take a few minutes to apply.
* `access_denied` while in Testing: the account is not in *Test users*.
* The Google window does not open: allow pop-ups for the site; ad blockers can block
  `accounts.google.com/gsi/client`.
