const WEB_API_BASE = 'https://api.ultreia.app/api';
const WEB_SCOPE_KEY = 'ultreia.web.scope';
let webRefreshPromise = null;

const webText = {
  de: {
    providerLogin: 'Anbieter anmelden', adminLogin: 'Admin anmelden', provider: 'Anbieter', admin: 'Administration', email: 'E-Mail', send: 'Magic Link senden', sent: 'Wenn die Adresse berechtigt ist, wird ein Magic Link an diese Adresse gesendet.', pendingMail: 'Der Produktions-Mailversand ist noch nicht eingerichtet.', verify: 'Anmeldung wird geprüft …', success: 'Anmeldung erfolgreich', role: 'Rolle', scope: 'Bereich', logout: 'Abmelden', dashboardPending: 'Provider-Dashboard wird schrittweise aufgebaut.', adminPending: 'Admin-Bereich wird schrittweise aufgebaut.', denied: 'Für diesen Bereich fehlt die erforderliche Rolle.', back: 'Zurück zur Anmeldung', localTest: 'Technischer local_test-Modus', localTestHint: 'Nur autorisierte Admin-/Test-Accounts können diesen Bereich nutzen.', requested: 'Anfrage konnte nicht verarbeitet werden.', mailMissing: 'Der Produktions-Mailprovider ist noch nicht konfiguriert.', mailFailed: 'Der Mailprovider konnte die Nachricht nicht versenden.'
  },
  en: {
    providerLogin: 'Provider login', adminLogin: 'Admin login', provider: 'Provider', admin: 'Administration', email: 'Email', send: 'Send magic link', sent: 'If this address is eligible, a magic link will be sent to it.', pendingMail: 'Production email delivery is not configured yet.', verify: 'Checking sign-in …', success: 'Sign-in successful', role: 'Role', scope: 'Scope', logout: 'Sign out', dashboardPending: 'The provider dashboard is being built step by step.', adminPending: 'The admin area is being built step by step.', denied: 'This area requires a different role.', back: 'Back to sign-in', localTest: 'Technical local_test mode', localTestHint: 'Only authorized admin/test accounts can use this scope.', requested: 'The request could not be processed.', mailMissing: 'The production mail provider is not configured yet.', mailFailed: 'The mail provider could not send the message.'
  },
  es: {
    providerLogin: 'Acceso para proveedores', adminLogin: 'Acceso de administración', provider: 'Proveedor', admin: 'Administración', email: 'Correo electrónico', send: 'Enviar enlace mágico', sent: 'Si la dirección está autorizada, se enviará un enlace mágico.', pendingMail: 'El envío de correo de producción aún no está configurado.', verify: 'Comprobando el acceso …', success: 'Acceso correcto', role: 'Rol', scope: 'Ámbito', logout: 'Cerrar sesión', dashboardPending: 'El panel de proveedores se está construyendo paso a paso.', adminPending: 'El área de administración se está construyendo paso a paso.', denied: 'Esta área requiere otro rol.', back: 'Volver al acceso', localTest: 'Modo técnico local_test', localTestHint: 'Solo las cuentas de administrador/prueba autorizadas pueden usar este ámbito.', requested: 'No se pudo procesar la solicitud.', mailMissing: 'El proveedor de correo de producción aún no está configurado.', mailFailed: 'El proveedor de correo no pudo enviar el mensaje.'
  }
};

const scopeText = {
  de: { scopeProduction: 'Produktiv', scopeLocalTest: 'Lokaler Test', switchScope: 'Bereich wechseln', testBanner: 'TESTDATEN - NICHT PRODUKTIV', scopeSwitchError: 'Der Bereich konnte nicht gewechselt werden.' },
  en: { scopeProduction: 'Production', scopeLocalTest: 'Local test', switchScope: 'Switch area', testBanner: 'TEST DATA - NOT PRODUCTION', scopeSwitchError: 'The area could not be changed.' },
  es: { scopeProduction: 'Producción', scopeLocalTest: 'Prueba local', switchScope: 'Cambiar ámbito', testBanner: 'DATOS DE PRUEBA - NO PRODUCTIVO', scopeSwitchError: 'No se pudo cambiar el ámbito.' },
};

const providerText = {
  de: {
    providerStep: 'Anbieter', locationStep: 'Standort', offerStep: 'Erstes Angebot', businessName: 'Betriebsname', sourceLocale: 'Quellsprache', phone: 'Telefon (optional)', website: 'Website (optional)', continue: 'Weiter', saving: 'Wird gespeichert …', profileSaved: 'Anbieterdaten gespeichert.', locationSaved: 'Standort übernommen.', locationSelected: 'Standort ausgewählt.', offerPublished: 'Angebot veröffentlicht.', offerSaved: 'Angebot gespeichert.', offerPaused: 'Angebot pausiert.', offerResumed: 'Angebot wieder aktiviert.', offerConfirmed: 'Angebot für weitere 30 Tage bestätigt.', profileError: 'Anbieterdaten konnten nicht gespeichert werden.', locationError: 'Standort konnte nicht gespeichert werden.', offerPublishError: 'Angebot konnte nicht veröffentlicht werden.', offerSaveError: 'Angebot konnte nicht gespeichert werden.', offerActionError: 'Angebot konnte nicht aktualisiert werden.', googleMissing: 'Google Places ist noch nicht konfiguriert.', locationSearch: 'Adresse oder Ort suchen', locationAdjust: 'Marker-Korrektur bis 25 m möglich.', needs: 'Needs', title: 'Titel', description: 'Beschreibung', price: 'Preis', priceType: 'Preisart', amount: 'Betrag', min: 'Von', max: 'Bis', currency: 'Währung', hours: 'Öffnungszeiten', radius: 'Radius (Meter)', saveLocation: 'Standort übernehmen & weiter', publishOffer: 'Angebot veröffentlichen', editOffer: 'Angebot bearbeiten', cancel: 'Abbrechen', active: 'Aktiv', pending: 'Ausstehend', incomplete: 'Unvollständig', complete: 'Vollständig', confirmed: 'Bestätigt', missing: 'Fehlt', draft: 'Entwurf', paused: 'Pausiert', expired: 'Abgelaufen', blocked: 'Gesperrt', pause: 'Pausieren', resume: 'Reaktivieren', confirm: 'Bestätigen', noOffers: 'Noch kein Angebot angelegt.', offerLocked: 'Anbieter und Standort müssen zuerst abgeschlossen werden.', businessNameRequired: 'Betriebsname fehlt.', locationRequired: 'Bitte zuerst einen Google-Standort auswählen.', needRequired: 'Mindestens ein Need muss ausgewählt werden.', priceInvalid: 'Bitte prüfe die Preisangabe.', hoursInvalid: 'Mindestens ein gültiges Öffnungszeitfenster ist erforderlich.', radiusInvalid: 'Der Radius muss zwischen 50 und 1000 m liegen.', websiteInvalid: 'Bitte gib eine gültige Website ein.', technical: 'Technik'
  },
  en: {
    providerStep: 'Provider', locationStep: 'Location', offerStep: 'First offer', businessName: 'Business name', sourceLocale: 'Source language', phone: 'Phone (optional)', website: 'Website (optional)', continue: 'Continue', saving: 'Saving …', profileSaved: 'Provider details saved.', locationSaved: 'Location accepted.', locationSelected: 'Location selected.', offerPublished: 'Offer published.', offerSaved: 'Offer saved.', offerPaused: 'Offer paused.', offerResumed: 'Offer reactivated.', offerConfirmed: 'Offer confirmed for another 30 days.', profileError: 'Provider details could not be saved.', locationError: 'Location could not be saved.', offerPublishError: 'Offer could not be published.', offerSaveError: 'Offer could not be saved.', offerActionError: 'Offer could not be updated.', googleMissing: 'Google Places is not configured yet.', locationSearch: 'Search address or place', locationAdjust: 'You can adjust the marker by up to 25 m.', needs: 'Needs', title: 'Title', description: 'Description', price: 'Price', priceType: 'Price type', amount: 'Amount', min: 'From', max: 'To', currency: 'Currency', hours: 'Opening hours', radius: 'Radius (metres)', saveLocation: 'Accept location & continue', publishOffer: 'Publish offer', editOffer: 'Edit offer', cancel: 'Cancel', active: 'Active', pending: 'Pending', incomplete: 'Incomplete', complete: 'Complete', confirmed: 'Confirmed', missing: 'Missing', draft: 'Draft', paused: 'Paused', expired: 'Expired', blocked: 'Blocked', pause: 'Pause', resume: 'Reactivate', confirm: 'Confirm', noOffers: 'No offer yet.', offerLocked: 'Complete the provider and location steps first.', businessNameRequired: 'Business name is required.', locationRequired: 'Select a Google location first.', needRequired: 'Select at least one need.', priceInvalid: 'Please check the price.', hoursInvalid: 'At least one valid opening window is required.', radiusInvalid: 'The radius must be between 50 and 1000 metres.', websiteInvalid: 'Enter a valid website.', technical: 'Technical'
  },
  es: {
    providerStep: 'Proveedor', locationStep: 'Ubicación', offerStep: 'Primera oferta', businessName: 'Nombre del negocio', sourceLocale: 'Idioma original', phone: 'Teléfono (opcional)', website: 'Sitio web (opcional)', continue: 'Continuar', saving: 'Guardando …', profileSaved: 'Datos del proveedor guardados.', locationSaved: 'Ubicación aceptada.', locationSelected: 'Ubicación seleccionada.', offerPublished: 'Oferta publicada.', offerSaved: 'Oferta guardada.', offerPaused: 'Oferta pausada.', offerResumed: 'Oferta reactivada.', offerConfirmed: 'Oferta confirmada durante otros 30 días.', profileError: 'No se pudieron guardar los datos del proveedor.', locationError: 'No se pudo guardar la ubicación.', offerPublishError: 'No se pudo publicar la oferta.', offerSaveError: 'No se pudo guardar la oferta.', offerActionError: 'No se pudo actualizar la oferta.', googleMissing: 'Google Places aún no está configurado.', locationSearch: 'Buscar dirección o lugar', locationAdjust: 'Puedes ajustar el marcador hasta 25 m.', needs: 'Necesidades', title: 'Título', description: 'Descripción', price: 'Precio', priceType: 'Tipo de precio', amount: 'Importe', min: 'Desde', max: 'Hasta', currency: 'Moneda', hours: 'Horario', radius: 'Radio (metros)', saveLocation: 'Aceptar ubicación y continuar', publishOffer: 'Publicar oferta', editOffer: 'Editar oferta', cancel: 'Cancelar', active: 'Activa', pending: 'Pendiente', incomplete: 'Incompleto', complete: 'Completo', confirmed: 'Confirmada', missing: 'Falta', draft: 'Borrador', paused: 'Pausada', expired: 'Caducada', blocked: 'Bloqueada', pause: 'Pausar', resume: 'Reactivar', confirm: 'Confirmar', noOffers: 'Todavía no hay ofertas.', offerLocked: 'Completa primero los pasos de proveedor y ubicación.', businessNameRequired: 'Falta el nombre del negocio.', locationRequired: 'Selecciona primero una ubicación de Google.', needRequired: 'Selecciona al menos una necesidad.', priceInvalid: 'Revisa el precio.', hoursInvalid: 'Se necesita al menos un horario válido.', radiusInvalid: 'El radio debe estar entre 50 y 1000 m.', websiteInvalid: 'Introduce un sitio web válido.', technical: 'Técnica'
  },
};

Object.assign(webText.de, { adminSignedInAs: 'Angemeldet als', adminRoleLabel: 'Rolle', adminScopeLabel: 'Bereich', adminFoundation: 'Admin-Grundlage', adminNavProvider: 'Provider', adminNavOffers: 'Offers', adminNavNeeds: 'Needs', myOffers: 'Meine Angebote', activeCount: 'Aktiv', pausedCount: 'Pausiert', draftCount: 'Entwürfe', lastConfirmed: 'Zuletzt bestätigt', nextConfirmation: 'Nächste Bestätigung', notAvailable: '—', offerDiagnostics: 'Technik', newOffer: 'Neues Angebot' });
Object.assign(webText.en, { adminSignedInAs: 'Signed in as', adminRoleLabel: 'Role', adminScopeLabel: 'Scope', adminFoundation: 'Admin foundation', adminNavProvider: 'Providers', adminNavOffers: 'Offers', adminNavNeeds: 'Needs', myOffers: 'My offers', activeCount: 'Active', pausedCount: 'Paused', draftCount: 'Drafts', lastConfirmed: 'Last confirmed', nextConfirmation: 'Next confirmation', notAvailable: '—', offerDiagnostics: 'Technical', newOffer: 'New offer' });
Object.assign(webText.es, { adminSignedInAs: 'Sesión iniciada como', adminRoleLabel: 'Rol', adminScopeLabel: 'Ámbito', adminFoundation: 'Base de administración', adminNavProvider: 'Proveedores', adminNavOffers: 'Ofertas', adminNavNeeds: 'Necesidades', myOffers: 'Mis ofertas', activeCount: 'Activas', pausedCount: 'Pausadas', draftCount: 'Borradores', lastConfirmed: 'Última confirmación', nextConfirmation: 'Próxima confirmación', notAvailable: '—', offerDiagnostics: 'Técnica', newOffer: 'Nueva oferta' });

providerText.de.providerStatus = 'Providerstatus';
providerText.en.providerStatus = 'Provider status';
providerText.es.providerStatus = 'Estado del proveedor';
providerText.de.offerTitleRequired = 'Titel fehlt.';
providerText.en.offerTitleRequired = 'Offer title is required.';
providerText.es.offerTitleRequired = 'Falta el título de la oferta.';
providerText.de.offerDescriptionRequired = 'Beschreibung fehlt.';
providerText.en.offerDescriptionRequired = 'Offer description is required.';
providerText.es.offerDescriptionRequired = 'Falta la descripción de la oferta.';
Object.assign(providerText.es, { radiusHelp: 'El radio es el área en la que Ultreia tendrá en cuenta tu oferta cuando sea relevante.' });
Object.assign(providerText.de, { offerIntro: 'Was bietest du an?', offerTitlePlaceholder: 'z. B. Frühstück für Pilger', offerDescriptionPlaceholder: 'Beschreibe kurz, was Pilger bei dir bekommen.', selectedNeeds: 'Ausgewählte Needs', needSearch: 'Was bietet dein Angebot?', frequentNeeds: 'Häufige Needs', moreNeeds: 'Weitere Needs', showMore: 'Weitere anzeigen', hideMore: 'Weniger anzeigen', noNeedMatches: 'Keine passenden Needs gefunden.', needGroupCore: 'Häufige Angebote', needGroupSecondary: 'Weitere Angebote', needGroupDiscovery: 'Weitere Möglichkeiten', priceIntro: 'Preis', priceFree: 'Kostenlos', priceFixed: 'Fixpreis', priceFrom: 'Ab', priceRange: 'Preisspanne', priceDonativo: 'Spende', priceOnRequest: 'Auf Anfrage', priceHint: 'Wähle zuerst, wie Pilger den Preis verstehen sollen.', availabilityIntro: 'Wann gibt es das?', presetDaily: 'Täglich', presetWeekdays: 'Montag–Freitag', presetCustom: 'Eigene Zeiten', openTime: 'Öffnet', closeTime: 'Schließt', closed: 'Geschlossen', addWindow: '+ Zeitfenster', copyHours: 'Auf andere Tage übertragen', availabilityHint: 'Geschlossene Tage bleiben für Pilger klar erkennbar.', radiusIntro: 'Wie weit soll Ultreia es berücksichtigen?', radiusRecommended: 'Empfohlen', radiusHelp: 'Der Radius bestimmt den Bereich, in dem Ultreia dein Angebot bei passendem Bedarf berücksichtigt.', preview: 'Vorschau', previewEmpty: 'Deine Vorschau erscheint hier.', previewNeeds: 'Needs', previewAvailability: 'Verfügbarkeit', previewRadius: 'Radius', saveChanges: 'Änderungen speichern', validationTime: 'Bitte ergänze mindestens ein gültiges Zeitfenster.', dayMonday: 'Montag', dayTuesday: 'Dienstag', dayWednesday: 'Mittwoch', dayThursday: 'Donnerstag', dayFriday: 'Freitag', daySaturday: 'Samstag', daySunday: 'Sonntag' });
Object.assign(providerText.en, { offerIntro: 'What are you offering?', offerTitlePlaceholder: 'e.g. Breakfast for pilgrims', offerDescriptionPlaceholder: 'Briefly describe what pilgrims can get from you.', selectedNeeds: 'Selected needs', needSearch: 'What does your offer provide?', frequentNeeds: 'Common needs', moreNeeds: 'More needs', showMore: 'Show more', hideMore: 'Show less', noNeedMatches: 'No matching needs found.', needGroupCore: 'Common offers', needGroupSecondary: 'More offers', needGroupDiscovery: 'More possibilities', priceIntro: 'Price', priceFree: 'Free', priceFixed: 'Fixed price', priceFrom: 'From', priceRange: 'Price range', priceDonativo: 'Donation', priceOnRequest: 'On request', priceHint: 'First choose how pilgrims should understand the price.', availabilityIntro: 'When is it available?', presetDaily: 'Every day', presetWeekdays: 'Monday–Friday', presetCustom: 'Custom times', openTime: 'Opens', closeTime: 'Closes', closed: 'Closed', addWindow: '+ Time window', copyHours: 'Copy to other days', availabilityHint: 'Closed days remain clear to pilgrims.', radiusIntro: 'How far should Ultreia consider it?', radiusRecommended: 'Recommended', radiusHelp: 'The radius is the area where Ultreia considers your offer for a relevant need.', preview: 'Preview', previewEmpty: 'Your preview will appear here.', previewNeeds: 'Needs', previewAvailability: 'Availability', previewRadius: 'Radius', saveChanges: 'Save changes', validationTime: 'Add at least one valid time window.', dayMonday: 'Monday', dayTuesday: 'Tuesday', dayWednesday: 'Wednesday', dayThursday: 'Thursday', dayFriday: 'Friday', daySaturday: 'Saturday', daySunday: 'Sunday' });
Object.assign(providerText.es, { offerIntro: '¿Qué ofreces?', offerTitlePlaceholder: 'p. ej., Desayuno para peregrinos', offerDescriptionPlaceholder: 'Describe brevemente qué pueden recibir los peregrinos.', selectedNeeds: 'Necesidades seleccionadas', needSearch: '¿Qué ofrece tu servicio?', frequentNeeds: 'Necesidades frecuentes', moreNeeds: 'Más necesidades', showMore: 'Mostrar más', hideMore: 'Mostrar menos', noNeedMatches: 'No se encontraron necesidades.', needGroupCore: 'Servicios frecuentes', needGroupSecondary: 'Más servicios', needGroupDiscovery: 'Más posibilidades', priceIntro: 'Precio', priceFree: 'Gratis', priceFixed: 'Precio fijo', priceFrom: 'Desde', priceRange: 'Intervalo de precios', priceDonativo: 'Donativo', priceOnRequest: 'Consultar', priceHint: 'Elige primero cómo deben entender el precio los peregrinos.', availabilityIntro: '¿Cuándo está disponible?', presetDaily: 'Cada día', presetWeekdays: 'Lunes–viernes', presetCustom: 'Horarios propios', openTime: 'Abre', closeTime: 'Cierra', closed: 'Cerrado', addWindow: '+ Franja horaria', copyHours: 'Copiar a otros días', availabilityHint: 'Los días cerrados quedan claros para los peregrinos.', preview: 'Vista previa', previewEmpty: 'La vista previa aparecerá aquí.', previewNeeds: 'Necesidades', previewAvailability: 'Disponibilidad', previewRadius: 'Radio', saveChanges: 'Guardar cambios', validationTime: 'Añade al menos una franja horaria válida.', dayMonday: 'Lunes', dayTuesday: 'Martes', dayWednesday: 'Miércoles', dayThursday: 'Jueves', dayFriday: 'Viernes', daySaturday: 'Sábado', daySunday: 'Domingo' });

Object.assign(webText.de, { lastConfirmed: 'Best\u00e4tigt', nextConfirmation: 'Erneut best\u00e4tigen bis' });
Object.assign(webText.en, { lastConfirmed: 'Confirmed', nextConfirmation: 'Confirm again by' });
Object.assign(webText.es, { lastConfirmed: 'Confirmada', nextConfirmation: 'Volver a confirmar antes del' });
Object.assign(providerText.de, { dashboardTitle: 'Anbieterbereich', profileLocation: 'Profil & Standort', editProfileLocation: 'Profil & Standort bearbeiten', firstOffer: 'Erstes Angebot anlegen', address: 'Adresse' });
Object.assign(providerText.en, { dashboardTitle: 'Provider dashboard', profileLocation: 'Profile & location', editProfileLocation: 'Edit profile & location', firstOffer: 'Create first offer', address: 'Address' });
Object.assign(providerText.es, { dashboardTitle: 'Panel del proveedor', profileLocation: 'Perfil y ubicaci\u00f3n', editProfileLocation: 'Editar perfil y ubicaci\u00f3n', firstOffer: 'Crear la primera oferta', address: 'Direcci\u00f3n' });
Object.assign(providerText.de, { noOffers: 'Noch keine Angebote vorhanden.' });
Object.assign(providerText.en, { noOffers: 'No offers yet.' });
Object.assign(providerText.es, { noOffers: 'Todav\u00eda no hay ofertas.' });
Object.assign(webText.de, { offerDiagnostics: 'Technikdetails' });
Object.assign(webText.en, { offerDiagnostics: 'Technical details' });
Object.assign(webText.es, { offerDiagnostics: 'Detalles t\u00e9cnicos' });
Object.assign(providerText.de, { moreNeedsShort: 'weitere', hideNeeds: 'Weniger anzeigen', mapLabel: 'Kartenansicht des Anbieterstandorts', markerMoved: 'Marker verschoben', markerUnchanged: 'Google-Position unverändert', markerTooFar: 'Der Marker darf maximal 25 m von der bestätigten Google-Position verschoben werden.', mapUnavailable: 'Kartenansicht nicht verfügbar; die Adresse bleibt als Text erhalten.', markerTitle: 'Anbieterstandort', locationAdjust: 'Marker auf den tatsächlichen Eingang ziehen (max. 25 m).', photos: 'Angebotsfotos', photosHint: 'Füge bis zu 3 Fotos hinzu. JPG, PNG oder WebP, maximal 8 MB pro Foto.', choosePhotos: 'Fotos auswählen', photoRemove: 'Foto entfernen', photoMoveUp: 'Nach oben', photoMoveDown: 'Nach unten', photoDragHandle: 'Foto verschieben', photoLimit: 'Maximal 3 Fotos sind möglich.', photoInvalid: 'Nur JPG, PNG oder WebP bis 8 MB sind möglich.', photoUpload: 'Fotos werden hochgeladen …', photoUploaded: 'Foto hochgeladen.', photoUploadError: 'Foto konnte nicht hochgeladen werden. Bitte Format und Größe prüfen.', noPhotos: 'Noch keine Fotos hinzugefügt.' });
Object.assign(providerText.en, { moreNeedsShort: 'more', hideNeeds: 'Show less', mapLabel: 'Map view of provider location', markerMoved: 'Marker moved', markerUnchanged: 'Google position unchanged', markerTooFar: 'The marker may be moved no more than 25 m from the confirmed Google position.', mapUnavailable: 'Map preview is unavailable; the address remains available as text.', markerTitle: 'Provider location', locationAdjust: 'Drag the marker to the actual entrance (max. 25 m).', photos: 'Offer photos', photosHint: 'Add up to 3 photos. JPG, PNG or WebP, maximum 8 MB per photo.', choosePhotos: 'Choose photos', photoRemove: 'Remove photo', photoMoveUp: 'Move up', photoMoveDown: 'Move down', photoDragHandle: 'Move photo', photoLimit: 'A maximum of 3 photos is allowed.', photoInvalid: 'Only JPG, PNG or WebP up to 8 MB are allowed.', photoUpload: 'Uploading photos …', photoUploaded: 'Photo uploaded.', photoUploadError: 'Photo could not be uploaded. Check its format and size.', noPhotos: 'No photos added yet.' });
Object.assign(providerText.es, { moreNeedsShort: 'más', hideNeeds: 'Mostrar menos', mapLabel: 'Mapa de la ubicación del proveedor', markerMoved: 'Marcador desplazado', markerUnchanged: 'Posición de Google sin cambios', markerTooFar: 'El marcador no puede alejarse más de 25 m de la posición de Google confirmada.', mapUnavailable: 'El mapa no está disponible; la dirección sigue visible como texto.', markerTitle: 'Ubicación del proveedor', locationAdjust: 'Arrastra el marcador hasta la entrada real (máx. 25 m).', photos: 'Fotos de la oferta', photosHint: 'Añade hasta 3 fotos. JPG, PNG o WebP, máximo 8 MB por foto.', choosePhotos: 'Elegir fotos', photoRemove: 'Eliminar foto', photoMoveUp: 'Mover arriba', photoMoveDown: 'Mover abajo', photoDragHandle: 'Mover foto', photoLimit: 'Se permiten como máximo 3 fotos.', photoInvalid: 'Solo se permiten JPG, PNG o WebP de hasta 8 MB.', photoUpload: 'Subiendo fotos …', photoUploaded: 'Foto subida.', photoUploadError: 'No se pudo subir la foto. Comprueba el formato y el tamaño.', noPhotos: 'Todavía no hay fotos.' });
Object.assign(providerText.de, { photoUploading: 'Foto wird übertragen', photoUploaded: 'Foto erfolgreich hochgeladen.', photoRetry: 'Upload fehlgeschlagen.', photoRetryAction: 'Erneut versuchen', photoSelected: 'Ausgewählt – wird nach dem Speichern hochgeladen', photoNumber: 'Foto', photoCount: 'Fotos', titleImage: 'Titelbild', photoWait: 'Bitte warten, bis alle Foto-Uploads abgeschlossen sind.', photoTransferComplete: 'Übertragung abgeschlossen', photoProcessing: 'Foto wird verarbeitet …', photoTransferError: 'Upload konnte nicht übertragen werden.', photoProcessingError: 'Foto konnte nicht verarbeitet werden.' });
Object.assign(providerText.en, { photoUploading: 'Transferring photo', photoUploaded: 'Photo uploaded successfully.', photoRetry: 'Upload failed.', photoRetryAction: 'Try again', photoSelected: 'Selected – uploads after saving', photoNumber: 'Photo', photoCount: 'photos', titleImage: 'Title image', photoWait: 'Please wait until all photo uploads are complete.', photoTransferComplete: 'Transfer complete', photoProcessing: 'Processing photo …', photoTransferError: 'The upload could not be transferred.', photoProcessingError: 'The photo could not be processed.' });
Object.assign(providerText.es, { photoUploading: 'Transfiriendo foto', photoUploaded: 'Foto subida correctamente.', photoRetry: 'Error de subida.', photoRetryAction: 'Intentar de nuevo', photoSelected: 'Seleccionada – se subirá al guardar', photoNumber: 'Foto', photoCount: 'fotos', titleImage: 'Imagen principal', photoWait: 'Espera hasta que terminen todas las subidas de fotos.', photoTransferComplete: 'Transferencia completada', photoProcessing: 'Procesando foto …', photoTransferError: 'No se pudo transferir la subida.', photoProcessingError: 'No se pudo procesar la foto.' });
Object.assign(providerText.de, { photoUploadTimeout: 'Cloudinary hat beim Upload nicht rechtzeitig geantwortet. Bitte erneut versuchen.', photoUploadUnavailable: 'Der Bilddienst ist vorübergehend nicht erreichbar. Bitte erneut versuchen.' });
Object.assign(providerText.en, { photoUploadTimeout: 'Cloudinary did not respond in time. Please try again.', photoUploadUnavailable: 'The image service is temporarily unavailable. Please try again.' });
Object.assign(providerText.es, { photoUploadTimeout: 'Cloudinary no respondió a tiempo. Inténtalo de nuevo.', photoUploadUnavailable: 'El servicio de imágenes no está disponible temporalmente. Inténtalo de nuevo.' });

Object.assign(providerText.de, { photoReorderSaving: 'Reihenfolge wird gespeichert …', photoReorderSaved: '✓ Reihenfolge gespeichert', photoReorderError: 'Reihenfolge konnte nicht geändert werden.' });
Object.assign(providerText.en, { photoReorderSaving: 'Saving order …', photoReorderSaved: '✓ Order saved', photoReorderError: 'Could not change the order.' });
Object.assign(providerText.es, { photoReorderSaving: 'Guardando orden …', photoReorderSaved: '✓ Orden guardado', photoReorderError: 'No se pudo cambiar el orden.' });

function pt(key) { return providerText[currentWebLanguage()][key] || providerText.en[key] || key; }

function feedbackItem(state, key) { return state.feedback[key] || { state: 'idle', message: '', diagnostic: null }; }

function providerFeedback(state, key) {
  return window.UltreiaProviderFeedback.component(key, feedbackItem(state, key), state.account?.scope === 'local_test' && state.account?.localTestAuthorized === true);
}

function setProviderFeedback(state, key, nextState, message, diagnostic = null) {
  state.feedback[key] = { state: nextState, message, diagnostic };
  window.UltreiaProviderFeedback.update(key, state.feedback[key], state.account?.scope === 'local_test' && state.account?.localTestAuthorized === true);
}

function setFormBusy(form, busy) {
  form?.querySelectorAll('button').forEach((button) => { button.disabled = busy; });
  form?.querySelector('[data-photo-input]')?.toggleAttribute('disabled', busy);
  if (form) form.dataset.saving = String(busy);
}

function captureProviderOfferEditorContext() {
  const form = document.querySelector('[data-offer-form]');
  if (!form) return null;
  const active = document.activeElement;
  const focus = active && form.contains(active) ? {
    name: active.getAttribute('name') || null,
    photoMove: active.dataset.photoMove || null,
    photoId: active.dataset.photoId || null,
  } : null;
  return { left: window.scrollX, top: window.scrollY, focus };
}

function restoreProviderOfferEditorContext(context) {
  if (!context) return;
  let target = null;
  if (context.focus?.name) target = [...document.querySelectorAll('[data-offer-form] [name]')].find((item) => item.getAttribute('name') === context.focus.name);
  if (!target && context.focus?.photoMove && context.focus?.photoId) {
    target = [...document.querySelectorAll('[data-offer-form] [data-photo-move]')].find((item) => item.dataset.photoMove === context.focus.photoMove && item.dataset.photoId === context.focus.photoId);
  }
  target?.focus({ preventScroll: true });
  window.scrollTo(context.left, context.top);
}

function clearFieldErrors(form) {
  form?.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
  form?.querySelectorAll('[data-field-error]').forEach((error) => { error.textContent = ''; });
}

function setFieldError(form, field, message) {
  if (field === 'hours' && form) {
    form.dataset.hoursExpanded = 'true';
    const visibleWindow = form.querySelector('.provider-time-window:not([hidden])');
    if (!visibleWindow) {
      const firstWindow = form.querySelector('.provider-time-window');
      firstWindow?.removeAttribute('hidden');
      firstWindow?.closest('[data-hours-day]')?.querySelector('[data-hours-closed]')?.setAttribute('hidden', '');
    }
  }
  const target = form?.querySelector(`[name="${field}"]`) || (field === 'price' ? form?.querySelector('[name="priceType"]') : null) || (field === 'hours' ? form?.querySelector('.provider-time-window:not([hidden]) input[type="time"]') : null);
  if (target) {
    target.setAttribute('aria-invalid', 'true');
    target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    target.focus();
  }
  const error = form?.querySelector(`[data-field-error="${field}"]`);
  if (error) error.textContent = message;
}

const providerErrorMap = {
  'title is required': ['title', 'offerTitleRequired'],
  'title is invalid': ['title', 'offerTitleRequired'],
  'description is required': ['description', 'offerDescriptionRequired'],
  'description is invalid': ['description', 'offerDescriptionRequired'],
  'businessName is required': ['businessName', 'businessNameRequired'],
  'businessName is invalid': ['businessName', 'businessNameRequired'],
  'website is invalid': ['website', 'websiteInvalid'],
  'googlePlaceId is required': ['locationSearch', 'locationRequired'],
  google_place_invalid: ['locationSearch', 'locationRequired'],
  'needKeys is required': ['needKeys', 'needRequired'],
  'price is invalid': ['price', 'priceInvalid'],
  'price.currency is invalid': ['currency', 'priceInvalid'],
  'availability is required': ['hours', 'hoursInvalid'],
  'availability is invalid': ['hours', 'hoursInvalid'],
  'availability must contain an opening window': ['hours', 'hoursInvalid'],
  'radiusMeters is invalid': ['radiusMeters', 'radiusInvalid'],
  image_too_large_or_empty: ['photos', 'photoInvalid'],
  image_type_not_allowed: ['photos', 'photoInvalid'],
  image_content_invalid: ['photos', 'photoInvalid'],
  media_provider_not_configured: ['photos', 'photoUploadError'],
  media_upload_failed: ['photos', 'photoUploadError'],
  media_upload_timeout: ['photos', 'photoUploadTimeout'],
  media_upload_network_error: ['photos', 'photoUploadUnavailable'],
  media_delete_failed: ['photos', 'photoUploadError'],
};

function providerErrorDetails(error, fallbackKey) {
  const code = error.detail || error.status;
  const mapped = providerErrorMap[code];
  return { field: mapped?.[0] || null, message: mapped ? pt(mapped[1]) : pt(fallbackKey), code };
}

function diagnostic(method, scope, result, profile = null, offer = null, error = null) {
  return { method, httpStatus: result?._httpStatus || error?.httpStatus, scope, providerStatus: profile?.status, offerStatus: offer?.status, phase: error?.phase || null, errorCode: error ? (error.detail || error.status) : null };
}

function currentWebLanguage() {
  return supportedLanguages.includes(window.localStorage.getItem(storageKey)) ? window.localStorage.getItem(storageKey) : getInitialLanguage();
}

function tx(key) { return webText[currentWebLanguage()][key] || scopeText[currentWebLanguage()][key]; }

function webScope() { return window.sessionStorage.getItem(WEB_SCOPE_KEY) || 'production'; }

async function webRefresh() {
  if (!webRefreshPromise) {
    webRefreshPromise = fetch(`${WEB_API_BASE}/auth/session/refresh`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', 'x-ultreia-web': '1', 'x-ultreia-scope': webScope() } }).then((response) => response.ok).finally(() => { webRefreshPromise = null; });
  }
  return webRefreshPromise;
}

async function webApi(path, options = {}, allowRefresh = true) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(`${WEB_API_BASE}${path}`, { ...options, credentials: 'include', headers: { ...(isFormData ? {} : { 'content-type': 'application/json' }), 'x-ultreia-web': '1', 'x-ultreia-scope': webScope(), ...(options.headers || {}) } });
  if (response.status === 401 && allowRefresh && !path.includes('/session/refresh') && await webRefresh()) return webApi(path, options, false);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(body.status || 'request_failed'); error.status = body.status || 'request_failed'; error.detail = body.error || null; error.httpStatus = response.status; throw error; }
  return { ...body, _httpStatus: response.status };
}

function webApiUpload(path, file, onProgress, allowRefresh = true) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.append('image', file, file.name);
    xhr.open('POST', `${WEB_API_BASE}${path}`, true);
    xhr.withCredentials = true;
    xhr.timeout = 120000;
    xhr.setRequestHeader('x-ultreia-web', '1');
    xhr.setRequestHeader('x-ultreia-scope', webScope());
    xhr.upload.onprogress = (event) => onProgress?.(event.lengthComputable ? Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))) : null);
    xhr.onerror = () => { const error = new Error('upload_network_error'); error.status = 'upload_network_error'; error.httpStatus = xhr.status || 0; reject(error); };
    xhr.ontimeout = () => { const error = new Error('upload_timeout'); error.status = 'upload_timeout'; error.httpStatus = xhr.status || 0; reject(error); };
    xhr.onabort = () => { const error = new Error('upload_aborted'); error.status = 'upload_aborted'; error.httpStatus = xhr.status || 0; reject(error); };
    xhr.onload = async () => {
      let responseBody = {};
      try { responseBody = JSON.parse(xhr.responseText || '{}'); } catch { const error = new Error('request_failed'); error.status = 'request_failed'; error.httpStatus = xhr.status; reject(error); return; }
      if (xhr.status === 401 && allowRefresh && await webRefresh()) return webApiUpload(path, file, onProgress, false).then(resolve, reject);
      if (xhr.status < 200 || xhr.status >= 300) {
        const error = new Error(responseBody.status || 'request_failed');
        error.status = responseBody.status || 'request_failed';
        error.detail = responseBody.error || null;
        error.httpStatus = xhr.status;
        reject(error);
        return;
      }
      resolve({ ...responseBody, _httpStatus: xhr.status });
    };
    xhr.send(body);
  });
}

function webShell(title, content) {
  const main = document.querySelector('[data-web-app]');
  if (!main) return null;
  main.innerHTML = `<section class="web-auth-shell"><div class="web-auth-card"><p class="section-label">Ultreia.app</p><h1 class="web-auth-title">${title}</h1>${content}</div></section>`;
  return main;
}

function renderLogin(role) {
  const isAdmin = role === 'admin';
  const title = isAdmin ? tx('adminLogin') : tx('providerLogin');
  webShell(title, `<form class="web-auth-form" data-auth-form><label for="auth-email">${tx('email')}</label><input id="auth-email" name="email" type="email" autocomplete="email" required><button class="web-auth-button" type="submit">${tx('send')}</button>${isAdmin ? `<label class="web-scope-option"><input type="checkbox" name="localTest"> <span>${tx('localTest')}</span><small>${tx('localTestHint')}</small></label>` : ''}</form><p class="web-auth-message" data-auth-message aria-live="polite"></p><p class="web-auth-back"><a href="/">${tx('back')}</a></p>`);
  document.querySelector('[data-auth-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const scope = isAdmin && form.get('localTest') === 'on' ? 'local_test' : 'production';
    window.sessionStorage.setItem(WEB_SCOPE_KEY, scope);
    const message = document.querySelector('[data-auth-message]');
    const submitButton = formElement.querySelector('button[type="submit"]');
    message.textContent = '';
    submitButton?.setAttribute('aria-busy', 'true');
    if (submitButton) submitButton.disabled = true;
    try {
      const result = await webApi('/auth/magic-link/request', { method: 'POST', body: JSON.stringify({ email: form.get('email'), role, preferredLocale: currentWebLanguage() }) }, false);
      message.textContent = result.diagnosticId ? `${tx('sent')} ${result.diagnosticId}` : tx('sent');
    } catch (error) {
      const friendly = error.status === 'access_not_available' || error.status === 'role_access_not_granted' ? tx('denied') : error.status === 'mail_provider_not_configured' ? tx('mailMissing') : error.status === 'mail_provider_failed' ? tx('mailFailed') : tx('requested');
      const diagnosticText = scope === 'local_test' && error.httpStatus ? ` (HTTP ${error.httpStatus} · ${error.status || 'request_failed'})` : '';
      message.textContent = `${friendly}${diagnosticText}`;
    } finally {
      submitButton?.removeAttribute('aria-busy');
      if (submitButton) submitButton.disabled = false;
    }
  });
}

async function renderVerify() {
  webShell(tx('verify'), '<p class="web-auth-message" data-verify-message aria-live="polite"></p>');
  const message = document.querySelector('[data-verify-message]');
  const token = new URL(window.location.href).searchParams.get('token');
  window.history.replaceState({}, document.title, '/auth/verify');
  if (!token) { message.textContent = new URL(window.location.href).searchParams.get('denied') ? tx('denied') : tx('requested'); return; }
  try {
    const result = await webApi('/auth/magic-link/verify', { method: 'POST', body: JSON.stringify({ token }) }, false);
    message.textContent = tx('success');
    const activeRole = result.session?.activeRole;
    window.location.replace(activeRole === 'admin' ? '/admin/' : activeRole === 'provider' ? '/provider/' : '/auth/verify?denied=1');
  } catch (error) { message.textContent = error.status === 'local_test_not_authorized' ? tx('denied') : tx('requested'); }
}

function escapeProviderHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
const providerDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function providerNeedGroupLabel(group) { return pt(group === 'core' ? 'needGroupCore' : group === 'secondary' ? 'needGroupSecondary' : 'needGroupDiscovery'); }
function providerDayLabel(day) { return pt(`day${day[0].toUpperCase()}${day.slice(1)}`); }

function providerDate(value) {
  if (!value) return tx('notAvailable');
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? tx('notAvailable') : new Intl.DateTimeFormat(currentWebLanguage(), { dateStyle: 'medium' }).format(date);
}

const offerUxText = {
  de: { openNow: 'Jetzt geoeffnet', today: 'Heute', closedToday: 'Heute geschlossen', moreTimes: 'Weitere Zeiten', moreNeeds: 'weitere' },
  en: { openNow: 'Open now', today: 'Today', closedToday: 'Closed today', moreTimes: 'More times', moreNeeds: 'more' },
  es: { openNow: 'Abierto ahora', today: 'Hoy', closedToday: 'Cerrado hoy', moreTimes: 'Mas horarios', moreNeeds: 'mas' },
};

function ot(key) { return offerUxText[currentWebLanguage()]?.[key] || offerUxText.en[key] || key; }

function providerMoney(value, currency) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value ?? '—');
  try { return new Intl.NumberFormat(currentWebLanguage(), { style: 'currency', currency: String(currency || 'EUR').toUpperCase() }).format(amount); } catch { return `${amount} ${currency || 'EUR'}`; }
}

function providerPriceLabel(price) {
  if (!price) return tx('notAvailable');
  if (price.type === 'free') return pt('priceFree');
  if (price.type === 'donativo') return pt('priceDonativo');
  if (price.type === 'on_request') return pt('priceOnRequest');
  if (price.type === 'range') return `${providerMoney(price.min, price.currency)}–${providerMoney(price.max, price.currency)}`;
  if (price.type === 'from') return `${pt('priceFrom')} ${providerMoney(price.amount, price.currency)}`;
  return providerMoney(price.amount, price.currency);
}

function offerTodaySummary(offer) {
  const dayNames = ['sunday', ...providerDays];
  const today = dayNames[new Date().getDay()];
  const windows = offer?.availability?.weekly?.[today] || offer?.openingHours?.[today] || [];
  if (!windows.length) return ot('closedToday');
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const isOpen = windows.some((window) => {
    const [openHour, openMinute] = String(window.open).split(':').map(Number);
    const [closeHour, closeMinute] = String(window.close).split(':').map(Number);
    const open = openHour * 60 + openMinute;
    const close = closeHour * 60 + closeMinute;
    return Number.isFinite(open) && Number.isFinite(close) && minutes >= open && minutes < close;
  });
  const times = windows.map((window) => `${window.open}–${window.close}`).join(', ');
  return `${isOpen ? ot('openNow') : ot('today')} · ${times}`;
}

function providerOfferActions(offer) {
  const actions = [`<button class="web-auth-button" data-offer-action="edit" data-offer-id="${escapeProviderHtml(offer.id)}" type="button">${pt('editOffer')}</button>`];
  if (offer.status === 'active') actions.push(`<button class="web-auth-button secondary" data-offer-action="pause" data-offer-id="${escapeProviderHtml(offer.id)}" type="button">${pt('pause')}</button>`);
  if (offer.status === 'paused') actions.push(`<button class="web-auth-button secondary" data-offer-action="resume" data-offer-id="${escapeProviderHtml(offer.id)}" type="button">${pt('resume')}</button>`);
  if (offer.status === 'expired') actions.push(`<button class="web-auth-button secondary" data-offer-action="confirm" data-offer-id="${escapeProviderHtml(offer.id)}" type="button">${pt('confirm')}</button>`);
  if (offer.status === 'active') actions.push(`<button class="web-auth-button secondary" data-offer-action="confirm" data-offer-id="${escapeProviderHtml(offer.id)}" type="button">${pt('confirm')}</button>`);
  return actions.join('');
}

function providerOffersOverview(offers, needs, requestInfo, account, showNew = true) {
  const counts = { active: 0, paused: 0, draft: 0 };
  const newOfferLabel = offers.length ? tx('newOffer') : pt('firstOffer');
  offers.forEach((offer) => { if (Object.hasOwn(counts, offer.status)) counts[offer.status] += 1; });
  const diagnostics = account?.scope === 'local_test' && account?.localTestAuthorized === true && requestInfo
    ? `<details class="provider-offer-diagnostics"><summary>${tx('offerDiagnostics')}</summary><small>GET /api/provider/offers · HTTP ${escapeProviderHtml(requestInfo.httpStatus)} · scope=${escapeProviderHtml(requestInfo.scope)} · count=${offers.length}</small></details>`
    : '';
  const cards = offers.map((offer) => {
    const allNeedLabels = (offer.needKeys || []).map((key) => needs.find((need) => need.key === key)?.label).filter(Boolean);
    const needSummary = window.UltreiaProviderOfferUi.summarizeNeedLabels(allNeedLabels);
    const needLabels = needSummary.visible.join(', ');
    const moreNeeds = needSummary.hidden.length ? `<button class="provider-inline-button provider-needs-toggle" data-toggle-offer-needs data-more-label="+${needSummary.hidden.length} ${escapeProviderHtml(pt('moreNeedsShort'))}" type="button" aria-expanded="false">+${needSummary.hidden.length} ${pt('moreNeedsShort')}</button><span class="provider-offer-needs-expanded" data-full-offer-needs hidden>${escapeProviderHtml(needSummary.hidden.join(', '))}</span>` : '';
    const thumbnail = offer.images?.[0]?.secureUrl ? `<img class="provider-offer-thumbnail" src="${escapeProviderHtml(offer.images[0].secureUrl)}" alt="${escapeProviderHtml(offer.title)}">` : '';
    const status = String(offer.status || 'draft');
    return `<article class="provider-offer-card">${thumbnail}<div class="provider-offer-card-main"><div class="provider-offer-card-heading"><strong>${escapeProviderHtml(offer.title)}</strong><span class="provider-offer-status status-${escapeProviderHtml(status)}">${escapeProviderHtml(pt(status) || status)}</span></div><p class="provider-offer-needs">${escapeProviderHtml(needLabels || tx('notAvailable'))} ${moreNeeds}</p><div class="provider-offer-meta"><strong>${escapeProviderHtml(providerPriceLabel(offer.price))}</strong><span>${escapeProviderHtml(offerTodaySummary(offer))}</span><span>${escapeProviderHtml(offer.radiusMeters)} m</span></div><dl class="provider-offer-dates"><div><dt>${tx('lastConfirmed')}</dt><dd>${providerDate(offer.lastConfirmedAt)}</dd></div><div><dt>${tx('nextConfirmation')}</dt><dd>${providerDate(offer.confirmationDueAt)}</dd></div></dl></div><div class="provider-actions">${providerOfferActions(offer)}</div></article>`;
  }).join('');
  return `<section class="provider-offers-overview"><div class="provider-offers-heading"><div><p class="section-label">${tx('myOffers')}</p><h3>${tx('myOffers')}</h3></div>${showNew ? `<button class="web-auth-button" data-new-offer type="button">${newOfferLabel}</button>` : ''}</div><div class="provider-offer-counts"><span>${tx('activeCount')} <strong>${counts.active}</strong></span><span>${tx('pausedCount')} <strong>${counts.paused}</strong></span><span>${tx('draftCount')} <strong>${counts.draft}</strong></span></div>${diagnostics}${offers.length ? `<div class="provider-offer-list">${cards}</div>` : `<div class="provider-empty-offers"><p>${pt('noOffers')}</p>${showNew ? `<button class="web-auth-button" data-new-offer type="button">${newOfferLabel}</button>` : ''}</div>`}</section>`;
}

function providerHoursEditor(weekly) {
  return providerDays.map((day) => {
    const windows = Array.isArray(weekly[day]) ? weekly[day] : [];
    const rows = [0, 1, 2].map((index) => {
      const window = windows[index] || {};
      const visible = Boolean(windows[index]);
      return `<div class="provider-time-window" data-hours-window="${day}-${index}" ${visible ? '' : 'hidden'}><input name="hours-open-${day}-${index}" data-hours-open="${day}" data-hours-index="${index}" type="time" aria-label="${escapeProviderHtml(providerDayLabel(day))} ${pt('openTime')}" value="${escapeProviderHtml(window.open || '')}"><span>–</span><input name="hours-close-${day}-${index}" data-hours-close="${day}" data-hours-index="${index}" type="time" aria-label="${escapeProviderHtml(providerDayLabel(day))} ${pt('closeTime')}" value="${escapeProviderHtml(window.close || '')}"></div>`;
    }).join('');
    return `<div class="provider-day-editor" data-hours-day="${day}"><div class="provider-day-heading"><strong>${escapeProviderHtml(providerDayLabel(day))}</strong><span data-hours-closed ${windows.length ? 'hidden' : ''}>${pt('closed')}</span></div><div class="provider-time-windows">${rows}</div><button class="provider-inline-button" data-add-window="${day}" type="button" ${windows.length >= 3 ? 'hidden' : ''}>${pt('addWindow')}</button></div>`;
  }).join('');
}

function providerOfferPreview(offer, needs, weekly, price, radius) {
  const selected = new Set(offer?.needKeys || []);
  const needLabels = needs.filter((need) => selected.has(need.key)).map((need) => need.label);
  const priceLabel = price.type === 'free' ? pt('priceFree') : price.type === 'donativo' ? pt('priceDonativo') : price.type === 'on_request' ? pt('priceOnRequest') : price.type === 'range' ? `${price.min || '—'}–${price.max || '—'} ${price.currency || 'EUR'}` : `${price.amount || '—'} ${price.currency || 'EUR'}`;
  const availability = providerDays.map((day) => `${providerDayLabel(day)}: ${(weekly[day] || []).length ? (weekly[day] || []).map((window) => `${window.open}–${window.close}`).join(', ') : pt('closed')}`).join(' · ');
  return `<div class="provider-preview-block"><strong data-preview-title>${escapeProviderHtml(offer?.title || pt('previewEmpty'))}</strong><p data-preview-description>${escapeProviderHtml(offer?.description || '')}</p></div><div class="provider-preview-block"><span>${pt('previewNeeds')}</span><strong data-preview-needs>${escapeProviderHtml(needLabels.length ? needLabels.join(', ') : '—')}</strong></div><div class="provider-preview-block"><span>${pt('priceIntro')}</span><strong data-preview-price>${escapeProviderHtml(priceLabel)}</strong></div><div class="provider-preview-block"><span>${pt('previewAvailability')}</span><small data-preview-hours>${escapeProviderHtml(availability)}</small></div><div class="provider-preview-block"><span>${pt('previewRadius')}</span><strong data-preview-radius>${escapeProviderHtml(radius)} m</strong></div>`;
}

function providerOfferPhotos(offer) {
  const images = Array.isArray(offer?.images) ? offer.images : [];
  if (!images.length) return `<p class="provider-empty-selection">${pt('noPhotos')}</p>`;
  return images.map((image, index) => `<li class="provider-photo-item" draggable="true" data-photo-id="${escapeProviderHtml(image.publicId || '')}"><button type="button" class="provider-photo-drag-handle" data-photo-drag-handle aria-label="${escapeProviderHtml(pt('photoDragHandle'))}" title="${escapeProviderHtml(pt('photoDragHandle'))}">⋮⋮</button><img src="${escapeProviderHtml(image.secureUrl)}" alt="${escapeProviderHtml(`${pt('photos')} ${index + 1}`)}"><span>${index === 0 ? pt('titleImage') : `${pt('photoNumber')} ${index + 1}`}</span><button type="button" class="provider-inline-button" data-photo-remove="${escapeProviderHtml(image.publicId || '')}">${pt('photoRemove')}</button><button type="button" class="provider-inline-button" data-photo-move="up" data-photo-id="${escapeProviderHtml(image.publicId || '')}" ${index === 0 ? 'disabled' : ''}>${pt('photoMoveUp')}</button><button type="button" class="provider-inline-button" data-photo-move="down" data-photo-id="${escapeProviderHtml(image.publicId || '')}" ${index === images.length - 1 ? 'disabled' : ''}>${pt('photoMoveDown')}</button></li>`).join('');
}

function providerPendingPhotoStatus(entry, index) {
  const status = entry.status || 'selected';
  if (status === 'uploading') return entry.progress === null ? `<span class="provider-photo-spinner" aria-hidden="true">◌</span> ${pt('photoUploading')}` : `<span class="provider-photo-spinner" aria-hidden="true">◌</span> ${pt('photoUploading')} ${entry.progress} %`;
  if (status === 'processing') return `✓ ${pt('photoTransferComplete')} · <span class="provider-photo-spinner" aria-hidden="true">◌</span> ${pt('photoProcessing')}`;
  if (status === 'uploaded') return `✓ ${pt('photoUploaded')}`;
  if (status === 'error') return `<span class="provider-photo-error-message">${pt(entry.errorPhase === 'browser_transfer' ? 'photoTransferError' : 'photoProcessingError')}</span><button type="button" class="provider-inline-button" data-retry-photo="${index}">${pt('photoRetryAction')}</button>`;
  return pt('photoSelected');
}

function providerPendingPhotosMarkup(entries = []) {
  return entries.map((entry, index) => {
    const status = entry.status || 'selected';
    const progress = status === 'uploading'
      ? `<progress max="100" ${entry.progress === null ? '' : `value="${entry.progress}"`}>${entry.progress ?? ''}</progress>`
      : status === 'processing' ? '<progress max="100"></progress>'
      : '';
    return `<li class="provider-photo-pending-item provider-photo-state-${status}" data-pending-photo="${index}"><img src="${escapeProviderHtml(entry.url || '')}" alt="${escapeProviderHtml(`${pt('photoNumber')} ${index + 1}`)}"><div><strong>${escapeProviderHtml(`${pt('photoNumber')} ${index + 1}`)}</strong><span data-photo-state-label>${providerPendingPhotoStatus(entry, index)}</span>${progress}</div></li>`;
  }).join('');
}

function updatePendingPhotoList(formElement, entries) {
  const list = formElement?.querySelector('[data-photo-pending]');
  if (list) list.innerHTML = providerPendingPhotosMarkup(entries);
  const count = formElement?.querySelector('[data-photo-count]');
  if (count) count.textContent = `${entries.length + formElement.querySelectorAll('[data-photo-id]').length} ${pt('photoCount')}`;
}

function validProviderPhoto(file) {
  return file && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 8 * 1024 * 1024;
}

async function uploadPendingOfferPhotos(offerId, entries, formElement) {
  const status = formElement.querySelector('[data-photo-status]');
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const file = entry.file || entry;
    entry.status = 'uploading';
    entry.progress = 0;
    entry.error = null;
    updatePendingPhotoList(formElement, entries);
    if (status) status.textContent = pt('photoUploading');
    try {
      const result = await webApiUpload(`/provider/offers/${offerId}/images`, file, (progress) => {
        if (progress === 100) entry.status = 'processing';
        else entry.status = 'uploading';
        entry.progress = progress;
        updatePendingPhotoList(formElement, entries);
      });
      entry.status = 'uploaded';
      entry.progress = 100;
      entry.result = result;
      updatePendingPhotoList(formElement, entries);
      if (status) status.textContent = pt('photoUploaded');
    } catch (error) {
      entry.status = 'error';
      entry.error = error.status || 'upload_failed';
      entry.errorPhase = String(error.status || '').startsWith('upload_') ? 'browser_transfer' : 'cloudinary_upload';
      error.phase = entry.errorPhase;
      error.uploadPath = `/provider/offers/${offerId}/images`;
      error.completedPhotoEntries = entries.slice(0, index);
      error.remainingPhotoEntries = entries.slice(index);
      updatePendingPhotoList(formElement, entries);
      throw error;
    }
  }
  return entries.at(-1)?.result || null;
}

function revokePendingPhotoEntries(entries = []) {
  entries.forEach((entry) => { if (entry.url && window.URL?.revokeObjectURL) window.URL.revokeObjectURL(entry.url); });
}

function providerOfferForm(offer, needs, pendingPhotoFiles = []) {
  const weekly = structuredClone(offer?.availability?.weekly || {});
  const price = offer?.price || { type: 'free', currency: 'EUR' };
  const selected = new Set(offer?.needKeys || []);
  const ui = window.UltreiaProviderOfferUi;
  const preset = Object.keys(weekly).some((day) => (weekly[day] || []).length) ? ui.detectHoursPreset(weekly) : '';
  const popular = new Set(ui.popularNeeds(needs).map((need) => need.key));
  const groups = ui.groupNeeds(needs);
  const totalPhotoCount = (offer?.images?.length || 0) + pendingPhotoFiles.length;
  const priceOptions = [['free', 'priceFree'], ['fixed', 'priceFixed'], ['from', 'priceFrom'], ['range', 'priceRange'], ['donativo', 'priceDonativo'], ['on_request', 'priceOnRequest']].map(([value, label]) => `<option value="${value}" ${price.type === value ? 'selected' : ''}>${pt(label)}</option>`).join('');
  return `<form class="provider-form provider-offer-form provider-offer-editor" data-offer-form novalidate data-offer-id="${offer?.id || ''}" data-hours-preset="${preset}" data-hours-expanded="${preset === 'custom' ? 'true' : 'false'}">
    <div class="provider-offer-editor-layout"><div class="provider-offer-main"><section class="provider-offer-section"><p class="provider-section-kicker">1</p><h3>${pt('offerIntro')}</h3><label>${pt('title')}<input name="title" required maxlength="120" placeholder="${pt('offerTitlePlaceholder')}" value="${escapeProviderHtml(offer?.title || '')}"><span class="provider-field-error" data-field-error="title"></span></label><label>${pt('description')}<textarea name="description" required maxlength="1000" placeholder="${pt('offerDescriptionPlaceholder')}">${escapeProviderHtml(offer?.description || '')}</textarea><span class="provider-field-error" data-field-error="description"></span></label></section>
      <section class="provider-offer-section"><p class="provider-section-kicker">2</p><h3>${pt('selectedNeeds')}</h3><div class="provider-selected-needs" data-selected-needs>${needs.filter((need) => selected.has(need.key)).map((need) => `<span class="provider-need-chip">${escapeProviderHtml(need.label)}</span>`).join('') || `<span class="provider-empty-selection">${pt('noNeedMatches')}</span>`}</div><label class="provider-need-search"><span>${pt('needSearch')}</span><input type="search" data-need-search placeholder="${pt('needSearch')}" autocomplete="off"></label><div class="provider-need-list" data-need-list><section class="provider-need-group provider-popular-group"><h4>${pt('frequentNeeds')}</h4><div class="provider-need-grid">${needs.filter((need) => popular.has(need.key)).map((need) => `<label class="provider-need-card is-popular" data-need-card data-need-key="${escapeProviderHtml(need.key)}" data-need-text="${escapeProviderHtml(`${need.label} ${need.key}`.toLocaleLowerCase())}"><input type="checkbox" name="needKeys" value="${escapeProviderHtml(need.key)}" ${selected.has(need.key) ? 'checked' : ''}><span>${escapeProviderHtml(need.label)}</span></label>`).join('')}</div></section><div class="provider-more-needs" data-more-needs hidden><h4>${pt('moreNeeds')}</h4>${groups.map(({ group, items }) => `<section class="provider-need-group" data-need-group="${escapeProviderHtml(group)}"><h4>${escapeProviderHtml(providerNeedGroupLabel(group))}</h4><div class="provider-need-grid">${items.filter((need) => !popular.has(need.key)).map((need) => `<label class="provider-need-card is-more" data-need-card data-need-key="${escapeProviderHtml(need.key)}" data-need-text="${escapeProviderHtml(`${need.label} ${need.key}`.toLocaleLowerCase())}"><input type="checkbox" name="needKeys" value="${escapeProviderHtml(need.key)}" ${selected.has(need.key) ? 'checked' : ''}><span>${escapeProviderHtml(need.label)}</span></label>`).join('')}</div></section>`).join('')}</div></div><button class="provider-inline-button" data-toggle-needs type="button">${pt('showMore')}</button><span class="provider-field-error" data-field-error="needKeys"></span></section>
      <section class="provider-offer-section"><p class="provider-section-kicker">3</p><h3>${pt('priceIntro')}</h3><p class="provider-section-help">${pt('priceHint')}</p><select name="priceType" data-price-type>${priceOptions}</select><div class="provider-price-fields" data-price-fields data-price-type="${price.type}"><label data-price-field="amount">${pt('amount')}<input name="amount" type="number" min="0" step="0.01" value="${escapeProviderHtml(price.amount ?? '')}"></label><div class="provider-range-fields" data-price-field="range"><label>${pt('min')}<input name="min" type="number" min="0" step="0.01" value="${escapeProviderHtml(price.min ?? '')}"></label><span>–</span><label>${pt('max')}<input name="max" type="number" min="0" step="0.01" value="${escapeProviderHtml(price.max ?? '')}"></label></div><label data-price-field="currency">${pt('currency')}<input name="currency" maxlength="3" value="${escapeProviderHtml(price.currency || 'EUR')}"><span class="provider-field-error" data-field-error="currency"></span></label></div><span class="provider-field-error" data-field-error="price"></span></section>
      <section class="provider-offer-section"><p class="provider-section-kicker">4</p><h3>${pt('availabilityIntro')}</h3><p class="provider-section-help">${pt('availabilityHint')}</p><div class="provider-hours-presets"><button type="button" class="provider-preset-button" data-hours-preset-action="daily">${pt('presetDaily')}</button><button type="button" class="provider-preset-button" data-hours-preset-action="weekdays">${pt('presetWeekdays')}</button><button type="button" class="provider-preset-button" data-hours-preset-action="custom">${pt('presetCustom')}</button></div><div class="provider-hours-editor" data-hours-editor>${providerHoursEditor(weekly)}</div><button type="button" class="provider-inline-button" data-copy-hours>${pt('copyHours')}</button><span class="provider-field-error" data-field-error="hours"></span></section>
      <section class="provider-offer-section"><p class="provider-section-kicker">5</p><h3>${pt('radiusIntro')}</h3><div class="provider-radius-control"><input name="radiusMeters" data-radius-input type="range" min="50" max="1000" step="10" value="${escapeProviderHtml(offer?.radiusMeters || 250)}"><output data-radius-value>${escapeProviderHtml(offer?.radiusMeters || 250)} m</output><div class="provider-radius-scale"><span>50 m</span><span>${pt('radiusRecommended')}</span><span>1000 m</span></div></div><p class="provider-section-help">${pt('radiusHelp')}</p><span class="provider-field-error" data-field-error="radiusMeters"></span></section>
       <section class="provider-offer-section"><p class="provider-section-kicker">6</p><h3>${pt('photos')} <span class="provider-photo-count" data-photo-count>${totalPhotoCount} ${pt('photoCount')}</span></h3><p class="provider-section-help">${pt('photosHint')}</p>${totalPhotoCount < 3 ? `<label class="provider-photo-picker"><span>${pt('choosePhotos')}</span><input type="file" data-photo-input accept="image/jpeg,image/png,image/webp" multiple></label>` : ''}<ul class="provider-photo-list" data-photo-list>${providerOfferPhotos(offer)}</ul><ul class="provider-photo-pending" data-photo-pending>${providerPendingPhotosMarkup(pendingPhotoFiles)}</ul><p class="provider-photo-status" data-photo-status aria-live="polite"></p><span class="provider-field-error" data-field-error="photos"></span></section>
      <button class="web-auth-button provider-publish-button" type="submit">${offer ? pt('saveChanges') : pt('publishOffer')}</button><button class="web-auth-button secondary" data-cancel-offer type="button">${pt('cancel')}</button>
    </div><details class="provider-offer-preview" open><summary>${pt('preview')}</summary><div data-offer-preview>${providerOfferPreview(offer, needs, weekly, price, offer?.radiusMeters || 250)}</div></details></div>
  </form>`;
}

function providerFormWeekly(form) {
  return Object.fromEntries(providerDays.map((day) => {
    const windows = [...form.querySelectorAll(`[data-hours-open="${day}"]`)].map((openInput) => {
      const index = openInput.dataset.hoursIndex;
      const closeInput = form.querySelector(`[data-hours-close="${day}"][data-hours-index="${index}"]`);
      return { open: openInput.value, close: closeInput?.value || '' };
    }).filter((window) => window.open && window.close);
    return [day, windows];
  }));
}

function providerUpdateNeedChips(form, needs) {
  const selected = new Set([...form.querySelectorAll('input[name="needKeys"]:checked')].map((input) => input.value));
  const target = form.querySelector('[data-selected-needs]');
  if (target) target.innerHTML = needs.filter((need) => selected.has(need.key)).map((need) => `<span class="provider-need-chip">${escapeProviderHtml(need.label)}</span>`).join('') || `<span class="provider-empty-selection">${pt('noNeedMatches')}</span>`;
}

function providerUpdateOfferPreview(form, needs) {
  const weekly = providerFormWeekly(form);
  const priceType = form.querySelector('[name="priceType"]')?.value || 'free';
  const price = { type: priceType, currency: String(form.querySelector('[name="currency"]')?.value || 'EUR').toUpperCase() };
  if (['fixed', 'from'].includes(priceType)) price.amount = form.querySelector('[name="amount"]')?.value || '';
  if (priceType === 'range') { price.min = form.querySelector('[name="min"]')?.value || ''; price.max = form.querySelector('[name="max"]')?.value || ''; }
  const selected = new Set([...form.querySelectorAll('input[name="needKeys"]:checked')].map((input) => input.value));
  const labels = needs.filter((need) => selected.has(need.key)).map((need) => need.label);
  const preview = form.querySelector('[data-offer-preview]');
  if (!preview) return;
  const priceLabel = price.type === 'free' ? pt('priceFree') : price.type === 'donativo' ? pt('priceDonativo') : price.type === 'on_request' ? pt('priceOnRequest') : price.type === 'range' ? `${price.min || '—'}–${price.max || '—'} ${price.currency}` : `${price.amount || '—'} ${price.currency}`;
  const hours = providerDays.map((day) => `${providerDayLabel(day)}: ${weekly[day].length ? weekly[day].map((window) => `${window.open}–${window.close}`).join(', ') : pt('closed')}`).join(' · ');
  preview.querySelector('[data-preview-title]').textContent = form.querySelector('[name="title"]')?.value || pt('previewEmpty');
  preview.querySelector('[data-preview-description]').textContent = form.querySelector('[name="description"]')?.value || '';
  preview.querySelector('[data-preview-needs]').textContent = labels.join(', ') || '—';
  preview.querySelector('[data-preview-price]').textContent = priceLabel;
  preview.querySelector('[data-preview-hours]').textContent = hours;
  preview.querySelector('[data-preview-radius]').textContent = `${form.querySelector('[data-radius-input]')?.value || 250} m`;
}

function providerApplyHoursPreset(form, preset, needs) {
  const weekly = window.UltreiaProviderOfferUi.presetWeekly(preset, providerFormWeekly(form));
  providerDays.forEach((day) => {
    const windows = weekly[day] || [];
    form.querySelectorAll(`[data-hours-open="${day}"]`).forEach((input, index) => {
      const window = windows[index] || {};
      input.value = window.open || '';
      const close = form.querySelector(`[data-hours-close="${day}"][data-hours-index="${index}"]`);
      if (close) close.value = window.close || '';
      const row = form.querySelector(`[data-hours-window="${day}-${index}"]`);
      if (row) row.hidden = !windows[index];
    });
    const closed = form.querySelector(`[data-hours-day="${day}"] [data-hours-closed]`);
    if (closed) closed.hidden = windows.length > 0;
    const add = form.querySelector(`[data-add-window="${day}"]`);
    if (add) add.hidden = windows.length >= 3;
  });
  form.dataset.hoursPreset = preset;
  form.dataset.hoursExpanded = String(preset === 'custom');
  providerUpdateOfferPreview(form, needs);
}

function providerProfileLocationSummary(profile) {
  const location = profile?.location || {};
  const rows = [
    [pt('businessName'), profile?.businessName || tx('notAvailable')],
    [pt('address'), location.formattedAddress || tx('notAvailable')],
    [pt('providerStatus'), pt(profile?.status || 'pending')],
    [pt('phone'), profile?.phone || tx('notAvailable')],
    [pt('website'), profile?.website || tx('notAvailable')],
  ];
  return `<section class="provider-profile-summary"><div class="provider-profile-summary-heading"><div><p class="section-label">${pt('profileLocation')}</p><h2>${pt('profileLocation')}</h2></div><button class="web-auth-button secondary" data-edit-profile-location type="button">${pt('editProfileLocation')}</button></div><dl>${rows.map(([label, value]) => `<div><dt>${escapeProviderHtml(label)}</dt><dd>${escapeProviderHtml(value)}</dd></div>`).join('')}</dl>${location.formattedAddress ? `<div class="provider-map-preview provider-map-summary" data-map-preview data-map-label="${escapeProviderHtml(pt('mapLabel'))}"><span>${escapeProviderHtml(location.formattedAddress)}</span></div>` : ''}</section>`;
}

function providerProfileFormMarkup(profile, state) {
  return `<section class="provider-panel"><p class="section-label">1. ${pt('providerStep')}</p><h2>${pt('businessName')}</h2><form class="provider-form" data-profile-form><label>${pt('businessName')}<input name="businessName" required maxlength="120" value="${escapeProviderHtml(profile.businessName)}"><span class="provider-field-error" data-field-error="businessName"></span></label><label>${pt('sourceLocale')}<select name="sourceLocale"><option value="de" ${profile.sourceLocale === 'de' ? 'selected' : ''}>DE</option><option value="en" ${profile.sourceLocale === 'en' ? 'selected' : ''}>EN</option><option value="es" ${profile.sourceLocale === 'es' ? 'selected' : ''}>ES</option></select></label><label>${pt('phone')}<input name="phone" value="${escapeProviderHtml(profile.phone)}"></label><label>${pt('website')}<input name="website" type="url" value="${escapeProviderHtml(profile.website)}"><span class="provider-field-error" data-field-error="website"></span></label><p>${escapeProviderHtml(profile.contactEmail || '')}</p>${providerFeedback(state, 'profile')}<button class="web-auth-button" type="submit">${pt('continue')}</button></form></section>`;
}

function providerLocationFormMarkup(profile, state) {
  const location = state.locationDraft || profile.location;
  return `<section class="provider-panel"><p class="section-label">2. ${pt('locationStep')}</p><h2>${pt('locationSearch')}</h2><form class="provider-form" data-location-form><label>${pt('locationSearch')}<input name="locationSearch" autocomplete="off" required><span class="provider-field-error" data-field-error="locationSearch"></span><div class="provider-suggestions" data-suggestions></div></label><p class="provider-location-help">${pt('locationAdjust')}</p><div class="provider-map-preview" data-map-preview data-map-label="${escapeProviderHtml(pt('mapLabel'))}">${location ? `<span class="provider-map-marker">+</span><strong>${escapeProviderHtml(location.formattedAddress)}</strong><small>${Number(location.latitude).toFixed(6)}, ${Number(location.longitude).toFixed(6)}</small>` : '<span>Google Place</span>'}</div>${location ? `<div class="provider-form-grid"><label>Latitude<input name="finalLatitude" type="number" step="0.000001" value="${location.latitude}"></label><label>Longitude<input name="finalLongitude" type="number" step="0.000001" value="${location.longitude}"></label></div>` : ''}${providerFeedback(state, 'location')}<button class="web-auth-button" data-save-location type="button" ${location ? '' : 'disabled'}>${pt('saveLocation')}</button></form></section>`;
}

async function renderProviderStart() {
  const state = { account: null, profile: null, offers: [], offersRequest: null, needs: [], locationDraft: null, editingOffer: null, editingSetup: false, pendingPhotoFiles: [], feedback: { profile: { state: 'idle' }, location: { state: 'idle' }, offer: { state: 'idle' } } };
  const load = async () => {
    const accountResult = await webApi('/auth/me');
    if (accountResult.session?.activeRole !== 'provider') throw Object.assign(new Error('role_context_mismatch'), { status: 'role_context_mismatch' });
    window.sessionStorage.setItem(WEB_SCOPE_KEY, accountResult.scope || 'production');
    state.account = accountResult;
    const [profileResult, needsResult, offersResult] = await Promise.all([webApi('/provider/profile'), webApi(`/needs?locale=${currentWebLanguage()}`), webApi('/provider/offers')]);
    state.profile = profileResult.profile; state.needs = needsResult.items || []; state.offers = offersResult.items || []; state.offersRequest = { httpStatus: offersResult._httpStatus, scope: accountResult.scope };
  };
  const renderDashboard = (editorContext = null) => {
    const profile = state.profile || {};
    const viewState = window.UltreiaProviderOfferUi.providerViewState(profile, state.offers);
    const scope = state.account?.scope || webScope();
    const scopeLabel = scope === 'local_test' ? tx('scopeLocalTest') : tx('scopeProduction');
    const scopeSwitcher = state.account?.localTestAuthorized ? `<div class="provider-scope-switch"><span>${tx('switchScope')}</span><button class="web-auth-button secondary" data-scope-switch="production" type="button" ${scope === 'production' ? 'disabled' : ''}>${tx('scopeProduction')}</button><button class="web-auth-button secondary" data-scope-switch="local_test" type="button" ${scope === 'local_test' ? 'disabled' : ''}>${tx('scopeLocalTest')}</button></div>` : '';
    const testBanner = scope === 'local_test' ? `<div class="provider-test-banner" role="status">${tx('testBanner')}</div>` : '';
    const account = `<div class="provider-account"><strong>${escapeProviderHtml(profile.businessName || profile.displayName || profile.contactEmail || '')}</strong><span>${escapeProviderHtml(profile.contactEmail || '')}</span><span class="scope-badge">${escapeProviderHtml(scopeLabel)}</span>${scopeSwitcher}<button class="web-auth-button secondary" data-logout type="button">${tx('logout')}</button></div>`;
    let content;
    if (state.editingOffer) {
      content = `<section class="provider-panel provider-offer-workspace"><p class="section-label">${pt('myOffers')}</p><h2>${pt('editOffer')}</h2>${providerFeedback(state, 'offer')}${providerOfferForm(state.editingOffer, state.needs, state.pendingPhotoFiles)}</section>`;
    } else if (state.editingSetup) {
      content = `<section class="provider-panel provider-setup-editor"><p class="section-label">${pt('profileLocation')}</p><h2>${pt('editProfileLocation')}</h2>${providerProfileFormMarkup(profile, state)}${providerLocationFormMarkup(profile, state)}<button class="web-auth-button secondary" data-cancel-setup type="button">${pt('cancel')}</button></section>`;
    } else {
      content = `<section class="provider-dashboard provider-dashboard-${viewState}"><div class="provider-dashboard-heading"><div><p class="section-label">${pt('dashboardTitle')}</p><h1>${escapeProviderHtml(profile.businessName || profile.displayName || pt('dashboardTitle'))}</h1></div><span class="scope-badge">${escapeProviderHtml(pt(profile.status || 'pending'))}</span></div><section class="provider-panel provider-offers-workspace">${providerFeedback(state, 'offer')}${providerOffersOverview(state.offers, state.needs, state.offersRequest, state.account, true)}</section>${providerProfileLocationSummary(profile)}</section>`;
    }
    webShell(pt('dashboardTitle'), `${testBanner}${account}${content}`);
    bind();
    if (state.editingOffer) {
      if (editorContext) restoreProviderOfferEditorContext(editorContext);
      else document.querySelector('[data-offer-form] [name="title"]')?.focus();
    }
    if (state.editingSetup) document.querySelector('[data-profile-form] [name="businessName"]')?.focus();
  };
  const render = () => {
    const editorContext = state.editingOffer ? captureProviderOfferEditorContext() : null;
    const viewState = window.UltreiaProviderOfferUi.providerViewState(state.profile, state.offers);
    if (viewState !== 'onboarding') { renderDashboard(editorContext); return; }
    const profile = state.profile || {};
    const scope = state.account?.scope || webScope();
    const steps = `<div class="provider-stepper"><span class="${profile.businessName ? 'is-done' : 'is-current'}">${profile.businessName ? '✓ ' : ''}1. ${pt('providerStep')}</span><span class="${profile.location ? 'is-done' : profile.businessName ? 'is-current' : ''}">${profile.location ? '✓ ' : ''}2. ${pt('locationStep')}</span><span class="${profile.status === 'active' ? 'is-current' : ''}">${profile.status === 'active' ? '' : '3. '}${pt('offerStep')}</span></div>`;
    const statusPanel = `<div class="provider-status-panel"><div><span>${pt('businessName')}</span><strong>${profile.businessName ? pt('complete') : pt('incomplete')}</strong></div><div><span>${pt('locationStep')}</span><strong>${profile.location ? pt('confirmed') : pt('missing')}</strong></div><div><span>${pt('providerStatus')}</span><strong>${escapeProviderHtml(pt(profile.status || 'pending'))}</strong></div></div>`;
    const profileForm = `<section class="provider-panel"><p class="section-label">1. ${pt('providerStep')}</p><h2>${pt('businessName')}</h2><form class="provider-form" data-profile-form><label>${pt('businessName')}<input name="businessName" required maxlength="120" value="${escapeProviderHtml(profile.businessName)}"><span class="provider-field-error" data-field-error="businessName"></span></label><label>${pt('sourceLocale')}<select name="sourceLocale"><option value="de" ${profile.sourceLocale === 'de' ? 'selected' : ''}>DE</option><option value="en" ${profile.sourceLocale === 'en' ? 'selected' : ''}>EN</option><option value="es" ${profile.sourceLocale === 'es' ? 'selected' : ''}>ES</option></select></label><label>${pt('phone')}<input name="phone" value="${escapeProviderHtml(profile.phone)}"></label><label>${pt('website')}<input name="website" type="url" value="${escapeProviderHtml(profile.website)}"><span class="provider-field-error" data-field-error="website"></span></label><p>${escapeProviderHtml(profile.contactEmail || '')}</p>${providerFeedback(state, 'profile')}<button class="web-auth-button" type="submit">${pt('continue')}</button></form></section>`;
    const location = state.locationDraft || profile.location;
    const locationForm = `<section class="provider-panel"><p class="section-label">2. ${pt('locationStep')}</p><h2>${pt('locationSearch')}</h2><form class="provider-form" data-location-form><label>${pt('locationSearch')}<input name="locationSearch" autocomplete="off" required><span class="provider-field-error" data-field-error="locationSearch"></span><div class="provider-suggestions" data-suggestions></div></label><p class="provider-location-help">${pt('locationAdjust')}</p><div class="provider-map-preview" data-map-preview data-map-label="${escapeProviderHtml(pt('mapLabel'))}">${location ? `<span class="provider-map-marker">+</span><strong>${escapeProviderHtml(location.formattedAddress)}</strong><small>${Number(location.latitude).toFixed(6)}, ${Number(location.longitude).toFixed(6)}</small>` : '<span>Google Place</span>'}</div>${location ? `<div class="provider-form-grid"><label>Latitude<input name="finalLatitude" type="number" step="0.000001" value="${location.latitude}"></label><label>Longitude<input name="finalLongitude" type="number" step="0.000001" value="${location.longitude}"></label></div>` : ''}${providerFeedback(state, 'location')}<button class="web-auth-button" data-save-location type="button" ${location ? '' : 'disabled'}>${pt('saveLocation')}</button></form></section>`;
    const offerSection = profile.status === 'active' && profile.location ? `<section class="provider-panel"><p class="section-label">3. ${pt('offerStep')}</p><h2>${state.editingOffer ? pt('editOffer') : pt('offerStep')}</h2>${providerFeedback(state, 'offer')}${state.editingOffer || state.offers.length === 0 ? providerOfferForm(state.editingOffer, state.needs, state.pendingPhotoFiles) : ''}${providerOffersOverview(state.offers, state.needs, state.offersRequest, state.account, state.offers.length > 0 && !state.editingOffer)}</section>` : `<section class="provider-panel"><p class="section-label">3. ${pt('offerStep')}</p><p>${pt('offerLocked')}</p></section>`;
    const scopeSwitcher = state.account?.localTestAuthorized ? `<div class="provider-scope-switch"><span>${tx('switchScope')}</span><button class="web-auth-button secondary" data-scope-switch="production" type="button" ${scope === 'production' ? 'disabled' : ''}>${tx('scopeProduction')}</button><button class="web-auth-button secondary" data-scope-switch="local_test" type="button" ${scope === 'local_test' ? 'disabled' : ''}>${tx('scopeLocalTest')}</button></div>` : '';
    const testBanner = scope === 'local_test' ? `<div class="provider-test-banner" role="status">${tx('testBanner')}</div>` : '';
    webShell(tx('provider'), `${testBanner}${steps}<div class="provider-account"><strong>${escapeProviderHtml(profile.displayName || profile.contactEmail || '')}</strong><span>${escapeProviderHtml(profile.contactEmail || '')}</span><span class="scope-badge">${escapeProviderHtml(scope)}</span>${scopeSwitcher}<button class="web-auth-button secondary" data-logout type="button">${tx('logout')}</button></div>${statusPanel}${profileForm}${locationForm}${offerSection}`);
    bind();
  };
  const bind = () => {
    document.querySelectorAll('[data-scope-switch]').forEach((button) => button.addEventListener('click', async () => { try { await webApi('/auth/session/switch-scope', { method: 'POST', body: JSON.stringify({ scope: button.dataset.scopeSwitch }) }); window.sessionStorage.setItem(WEB_SCOPE_KEY, button.dataset.scopeSwitch); window.location.reload(); } catch { const message = document.querySelector('[data-dashboard-message]') || document.querySelector('[data-location-message]'); if (message) message.textContent = tx('scopeSwitchError'); } }));
    document.querySelector('[data-profile-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formElement = event.currentTarget;
      clearFieldErrors(formElement);
      const form = new FormData(formElement);
      const businessName = String(form.get('businessName') || '').trim();
      const website = String(form.get('website') || '').trim();
      if (businessName.length < 2) { setFieldError(formElement, 'businessName', pt('businessNameRequired')); return; }
      if (website && !/^https?:\/\/[^\s]+$/i.test(website)) { setFieldError(formElement, 'website', pt('websiteInvalid')); return; }
      const scope = state.account?.scope || webScope();
      setProviderFeedback(state, 'profile', 'saving', pt('saving'));
      setFormBusy(formElement, true);
      try {
        const result = await webApi('/provider/profile', { method: 'PUT', body: JSON.stringify({ businessName, sourceLocale: form.get('sourceLocale'), phone: form.get('phone'), website }) });
        state.feedback.profile = { state: 'success', message: pt('profileSaved'), diagnostic: diagnostic('PUT /api/provider/profile', scope, result, result.profile) };
        await load();
        render();
        document.querySelector('[name="locationSearch"]')?.focus();
      } catch (error) {
        const details = providerErrorDetails(error, 'profileError');
        setFieldError(formElement, details.field, details.message);
        setProviderFeedback(state, 'profile', 'error', details.message, diagnostic('PUT /api/provider/profile', scope, null, null, null, error));
      } finally { setFormBusy(formElement, false); }
    });
    const locationInput = document.querySelector('[name="locationSearch"]');
    const mapContainer = document.querySelector('[data-map-preview]');
    const mapLocation = state.locationDraft || state.profile?.location;
    if (mapContainer && mapLocation && window.UltreiaProviderMap) {
      webApi('/provider/maps-config').then((config) => {
        if (!config.configured || !config.key) {
          mapContainer.classList.add('provider-map-error');
          mapContainer.textContent = pt('mapUnavailable');
          return null;
        }
        return window.UltreiaProviderMap.mount(mapContainer, {
          apiKey: config.key,
          location: mapLocation,
          editable: Boolean(document.querySelector('[data-location-form]')),
          labels: { mapLabel: pt('mapLabel'), markerMoved: pt('markerMoved'), markerUnchanged: pt('markerUnchanged'), markerTooFar: pt('markerTooFar'), mapUnavailable: pt('mapUnavailable'), markerTitle: pt('markerTitle') },
          onMove: ({ lat, lng, accepted }) => {
            const latitude = document.querySelector('[name="finalLatitude"]');
            const longitude = document.querySelector('[name="finalLongitude"]');
            if (latitude && longitude && accepted) { latitude.value = lat.toFixed(6); longitude.value = lng.toFixed(6); }
            const save = document.querySelector('[data-save-location]');
            if (save) save.disabled = !accepted;
          },
          onError: () => { mapContainer.classList.add('provider-map-error'); },
        });
      }).catch(() => { mapContainer.classList.add('provider-map-error'); mapContainer.textContent = pt('mapUnavailable'); });
    }
    const autocomplete = window.UltreiaProviderAutocomplete?.create({
      fetchSuggestions: async ({ input, locale, sessionToken, signal }) => { const result = await webApi('/provider/location/autocomplete', { method: 'POST', signal, body: JSON.stringify({ input, locale, sessionToken }) }); return result.suggestions || []; },
      onResults: (suggestions) => { document.querySelector('[data-suggestions]').innerHTML = suggestions.map((item) => `<button type="button" class="provider-suggestion" data-place-id="${escapeProviderHtml(item.placeId)}"><strong>${escapeProviderHtml(item.mainText || item.text)}</strong><small>${escapeProviderHtml(item.secondaryText)}</small></button>`).join(''); },
      onError: (error) => { const message = error.status === 'google_places_not_configured' ? pt('googleMissing') : pt('locationError'); setProviderFeedback(state, 'location', 'error', message, diagnostic('POST /api/provider/location/autocomplete', state.account?.scope || webScope(), null, null, null, error)); },
    });
    locationInput?.addEventListener('input', () => autocomplete?.schedule(locationInput.value, currentWebLanguage()));
    document.querySelector('[data-suggestions]')?.addEventListener('click', async (event) => { const button = event.target.closest('[data-place-id]'); if (!button) return; autocomplete?.cancel(); const form = document.querySelector('[data-location-form]'); setProviderFeedback(state, 'location', 'saving', pt('saving')); try { const result = await webApi('/provider/location/validate', { method: 'POST', body: JSON.stringify({ googlePlaceId: button.dataset.placeId, sourceLocale: currentWebLanguage(), sessionToken: autocomplete?.sessionToken }) }); state.locationDraft = result.location; state.feedback.location = { state: 'success', message: pt('locationSelected'), diagnostic: diagnostic('POST /api/provider/location/validate', state.account?.scope || webScope(), result, state.profile) }; render(); } catch (error) { const details = providerErrorDetails(error, 'locationError'); setFieldError(form, details.field, details.message); setProviderFeedback(state, 'location', 'error', details.message, diagnostic('POST /api/provider/location/validate', state.account?.scope || webScope(), null, null, null, error)); } });
    document.querySelector('[data-save-location]')?.addEventListener('click', async (event) => { const formElement = event.currentTarget.closest('[data-location-form]'); clearFieldErrors(formElement); if (!state.locationDraft && !state.profile?.location) { setFieldError(formElement, 'locationSearch', pt('locationRequired')); return; } const location = state.locationDraft || state.profile.location; const latitude = document.querySelector('[name="finalLatitude"]')?.value; const longitude = document.querySelector('[name="finalLongitude"]')?.value; const scope = state.account?.scope || webScope(); setProviderFeedback(state, 'location', 'saving', pt('saving')); setFormBusy(formElement, true); try { const result = await webApi('/provider/location', { method: 'PUT', body: JSON.stringify({ googlePlaceId: location.googlePlaceId, finalLatitude: latitude ? Number(latitude) : undefined, finalLongitude: longitude ? Number(longitude) : undefined, sourceLocale: currentWebLanguage(), sessionToken: autocomplete?.sessionToken }) }); state.locationDraft = null; state.feedback.location = { state: 'success', message: pt('locationSaved'), diagnostic: diagnostic('PUT /api/provider/location', scope, result, result.profile) }; await load(); render(); document.querySelector('[data-offer-form]')?.querySelector('[name="title"]')?.focus(); } catch (error) { const details = providerErrorDetails(error, 'locationError'); setFieldError(formElement, details.field, details.message); setProviderFeedback(state, 'location', 'error', details.message, diagnostic('PUT /api/provider/location', scope, null, null, null, error)); } finally { setFormBusy(formElement, false); } });
    document.querySelector('[data-offer-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formElement = event.currentTarget;
      clearFieldErrors(formElement);
      const form = new FormData(formElement);
      const weekly = providerFormWeekly(formElement);
      const priceType = form.get('priceType');
      const price = { type: priceType, currency: String(form.get('currency') || 'EUR').toUpperCase() };
      if (['fixed', 'from'].includes(priceType)) price.amount = Number(form.get('amount'));
      if (priceType === 'range') { price.min = Number(form.get('min')); price.max = Number(form.get('max')); }
      const body = { title: String(form.get('title') || '').trim(), description: String(form.get('description') || '').trim(), sourceLocale: currentWebLanguage(), needKeys: form.getAll('needKeys'), price, availability: { weekly, exceptions: [] }, radiusMeters: Number(form.get('radiusMeters')), activate: true };
      const validationResult = window.UltreiaProviderOfferUi.validateOfferDraft(body);
      const validationMessages = { title_required: 'offerTitleRequired', description_required: 'offerDescriptionRequired', needs_required: 'needRequired', price_invalid: 'priceInvalid', hours_required: 'validationTime', radius_invalid: 'radiusInvalid' };
      const validation = validationResult ? [validationResult.field, pt(validationMessages[validationResult.code] || 'offerSaveError')] : null;
      if (validation) { if (validation[0] === 'hours') formElement.dataset.hoursExpanded = 'true'; setFieldError(formElement, validation[0], validation[1]); return; }
      const pendingPhotos = state.pendingPhotoFiles || [];
      const existingPhotoCount = Array.isArray(state.editingOffer?.images) ? state.editingOffer.images.length : 0;
      if (existingPhotoCount + pendingPhotos.length > 3) { setFieldError(formElement, 'photos', pt('photoLimit')); return; }
      if (pendingPhotos.some((entry) => entry.status === 'uploading')) { setFieldError(formElement, 'photos', pt('photoWait')); return; }
      const scope = state.account?.scope || webScope();
      const id = formElement.dataset.offerId;
      const endpoint = id ? `/provider/offers/${id}` : '/provider/offers';
      setProviderFeedback(state, 'offer', 'saving', pt('saving'));
      setFormBusy(formElement, true);
      let savedOffer = null;
      try {
        const result = await webApi(endpoint, { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
        const offer = result.offer;
        savedOffer = offer;
        const uploadResult = pendingPhotos.length ? await uploadPendingOfferPhotos(offer.id, pendingPhotos, formElement) : null;
        const successDiagnostic = diagnostic(`${id ? 'PUT' : 'POST'} /api/provider/offers${id ? `/${id}` : ''}`, scope, result, state.profile, offer);
        if (uploadResult) { successDiagnostic.method = `POST /api/provider/offers/${offer.id}/images`; successDiagnostic.httpStatus = uploadResult._httpStatus; successDiagnostic.cloudinary = 'uploaded'; }
        state.feedback.offer = { state: 'success', message: body.activate ? pt('offerPublished') : pt('offerSaved'), diagnostic: successDiagnostic };
        state.editingOffer = null;
        revokePendingPhotoEntries(pendingPhotos);
        state.pendingPhotoFiles = [];
        await load();
        render();
      } catch (error) {
        const details = providerErrorDetails(error, id ? 'offerSaveError' : 'offerPublishError');
        if (savedOffer) {
          revokePendingPhotoEntries(error.completedPhotoEntries || []);
          formElement.dataset.offerId = savedOffer.id;
          state.editingOffer = savedOffer;
          state.pendingPhotoFiles = error.remainingPhotoEntries || pendingPhotos;
        }
        setFieldError(formElement, details.field, details.message);
        setProviderFeedback(state, 'offer', 'error', details.message, diagnostic(error.uploadPath || `${id ? 'PUT' : 'POST'} /api/provider/offers${id ? `/${id}` : ''}`, scope, null, null, null, error));
      } finally { setFormBusy(formElement, false); }
    });
    const offerForm = document.querySelector('[data-offer-form]');
    const startExistingOfferPhotoUpload = async () => {
      const offerId = offerForm?.dataset.offerId;
      const entries = state.pendingPhotoFiles || [];
      if (!offerId || !entries.length) return;
      const scope = state.account?.scope || webScope();
      setProviderFeedback(state, 'offer', 'saving', pt('photoUploading'));
      setFormBusy(offerForm, true);
      try {
        const uploadResult = await uploadPendingOfferPhotos(offerId, entries, offerForm);
        const successDiagnostic = { method: `POST /api/provider/offers/${offerId}/images`, httpStatus: uploadResult?._httpStatus || 201, scope, phase: 'cloudinary_upload', cloudinary: 'uploaded' };
        revokePendingPhotoEntries(entries);
        state.pendingPhotoFiles = [];
        await load();
        state.editingOffer = state.offers.find((item) => item.id === offerId) || state.editingOffer;
        state.feedback.offer = { state: 'success', message: pt('photoUploaded'), diagnostic: successDiagnostic };
        render();
      } catch (error) {
        revokePendingPhotoEntries(error.completedPhotoEntries || []);
        state.pendingPhotoFiles = error.remainingPhotoEntries || entries;
        setFieldError(offerForm, 'photos', pt(error.phase === 'browser_transfer' ? 'photoTransferError' : 'photoProcessingError'));
        setProviderFeedback(state, 'offer', 'error', pt(error.phase === 'browser_transfer' ? 'photoTransferError' : 'photoProcessingError'), diagnostic(error.uploadPath || `POST /api/provider/offers/${offerId}/images`, scope, null, null, null, error));
        updatePendingPhotoList(offerForm, state.pendingPhotoFiles);
      } finally {
        setFormBusy(offerForm, false);
      }
    };
    document.querySelectorAll('[data-toggle-offer-needs]').forEach((button) => button.addEventListener('click', () => {
      const expanded = document.querySelector(`[data-full-offer-needs]`);
      if (!expanded) return;
      expanded.hidden = !expanded.hidden;
      button.setAttribute('aria-expanded', String(!expanded.hidden));
      button.textContent = expanded.hidden ? button.dataset.moreLabel : pt('hideNeeds');
    }));
    offerForm?.querySelector('[data-photo-input]')?.addEventListener('change', (event) => {
      const selectedFiles = [...event.currentTarget.files];
      const currentCount = Array.isArray(state.editingOffer?.images) ? state.editingOffer.images.length : 0;
      if (selectedFiles.some((file) => !validProviderPhoto(file)) || currentCount + selectedFiles.length > 3) {
        setFieldError(offerForm, 'photos', selectedFiles.some((file) => !validProviderPhoto(file)) ? pt('photoInvalid') : pt('photoLimit'));
        event.currentTarget.value = '';
        return;
      }
      revokePendingPhotoEntries(state.pendingPhotoFiles);
      state.pendingPhotoFiles = selectedFiles.map((file) => ({ file, url: window.URL?.createObjectURL ? window.URL.createObjectURL(file) : '', status: 'selected', progress: 0 }));
      updatePendingPhotoList(offerForm, state.pendingPhotoFiles);
      if (offerForm.dataset.offerId) startExistingOfferPhotoUpload();
    });
    offerForm?.querySelector('[data-photo-pending]')?.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-retry-photo]');
      if (!button) return;
      const index = Number(button.dataset.retryPhoto);
      const entry = state.pendingPhotoFiles[index];
      const offerId = offerForm.dataset.offerId;
      if (!entry || !offerId) return;
      setFormBusy(offerForm, true);
      try {
        await uploadPendingOfferPhotos(offerId, [entry], offerForm);
        revokePendingPhotoEntries([entry]);
        state.pendingPhotoFiles.splice(index, 1);
        await load();
        state.editingOffer = state.offers.find((item) => item.id === offerId) || state.editingOffer;
        state.feedback.offer = { state: 'success', message: pt('photoUploaded'), diagnostic: { method: `POST /api/provider/offers/${offerId}/images`, httpStatus: 201, scope: state.account?.scope || webScope(), phase: 'cloudinary_upload', cloudinary: 'uploaded' } };
        render();
      } catch (error) {
        const message = pt(error.phase === 'browser_transfer' ? 'photoTransferError' : 'photoProcessingError');
        setProviderFeedback(state, 'offer', 'error', message, diagnostic(error.uploadPath || `POST /api/provider/offers/${offerId}/images`, state.account?.scope || webScope(), null, null, null, error));
        updatePendingPhotoList(offerForm, state.pendingPhotoFiles);
      } finally { setFormBusy(offerForm, false); }
    });
    offerForm?.querySelectorAll('[data-photo-remove]')?.forEach((button) => button.addEventListener('click', async () => {
      const offerId = offerForm.dataset.offerId;
      if (!offerId) return;
      setProviderFeedback(state, 'offer', 'saving', pt('saving'));
      try {
        await webApi(`/provider/offers/${offerId}/images`, { method: 'DELETE', body: JSON.stringify({ publicId: button.dataset.photoRemove }) });
        await load();
        state.editingOffer = state.offers.find((item) => item.id === offerId) || state.editingOffer;
        render();
      } catch (error) { setProviderFeedback(state, 'offer', 'error', pt('photoUploadError'), diagnostic(`DELETE /api/provider/offers/${offerId}/images`, state.account?.scope || webScope(), null, null, null, error)); }
    }));
    offerForm?.querySelectorAll('[data-photo-move]')?.forEach((button) => button.addEventListener('click', async () => {
      const offerId = offerForm.dataset.offerId;
      if (!offerId) return;
      const publicIds = [...offerForm.querySelectorAll('[data-photo-list] > [data-photo-id]')].map((item) => item.dataset.photoId).filter(Boolean);
      const from = publicIds.indexOf(button.dataset.photoId);
      const to = button.dataset.photoMove === 'up' ? from - 1 : from + 1;
      if (from < 0 || to < 0 || to >= publicIds.length) return;
      [publicIds[from], publicIds[to]] = [publicIds[to], publicIds[from]];
      setProviderFeedback(state, 'offer', 'saving', pt('photoReorderSaving'));
      setFormBusy(offerForm, true);
      try {
        const response = await webApi(`/provider/offers/${offerId}/images/reorder`, { method: 'POST', body: JSON.stringify({ publicIds }) });
        await load();
        state.editingOffer = state.offers.find((item) => item.id === offerId) || state.editingOffer;
        state.feedback.offer = { state: 'success', message: pt('photoReorderSaved'), diagnostic: diagnostic(`POST /api/provider/offers/${offerId}/images/reorder`, state.account?.scope || webScope(), response) };
        render();
      } catch (error) {
        setProviderFeedback(state, 'offer', 'error', pt('photoReorderError'), diagnostic(`POST /api/provider/offers/${offerId}/images/reorder`, state.account?.scope || webScope(), null, null, null, error));
      } finally { setFormBusy(offerForm, false); }
    }));
    const photoList = offerForm?.querySelector('[data-photo-list]');
    let draggedPhotoId = null;
    photoList?.querySelectorAll('[data-photo-id]')?.forEach((item) => {
      item.addEventListener('dragstart', (event) => {
        draggedPhotoId = item.dataset.photoId;
        item.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', draggedPhotoId);
      });
      item.addEventListener('dragend', () => {
        draggedPhotoId = null;
        item.classList.remove('is-dragging');
        photoList.querySelectorAll('.is-drop-target').forEach((target) => target.classList.remove('is-drop-target'));
      });
      item.addEventListener('dragover', (event) => {
        if (!draggedPhotoId || draggedPhotoId === item.dataset.photoId) return;
        event.preventDefault();
        photoList.querySelectorAll('.is-drop-target').forEach((target) => target.classList.remove('is-drop-target'));
        item.classList.add('is-drop-target');
        event.dataTransfer.dropEffect = 'move';
      });
      item.addEventListener('drop', async (event) => {
        event.preventDefault();
        const targetId = item.dataset.photoId;
        if (!draggedPhotoId || draggedPhotoId === targetId) return;
        const publicIds = [...photoList.querySelectorAll(':scope > [data-photo-id]')].map((entry) => entry.dataset.photoId).filter(Boolean);
        const from = publicIds.indexOf(draggedPhotoId);
        const target = publicIds.indexOf(targetId);
        if (from < 0 || target < 0) return;
        publicIds.splice(from, 1);
        const targetRect = item.getBoundingClientRect();
        const insertAt = target + (event.clientY > targetRect.top + targetRect.height / 2 ? 1 : 0) - (from < target ? 1 : 0);
        publicIds.splice(Math.max(0, Math.min(insertAt, publicIds.length)), 0, draggedPhotoId);
        const offerId = offerForm.dataset.offerId;
        const scope = state.account?.scope || webScope();
        setProviderFeedback(state, 'offer', 'saving', pt('photoReorderSaving'));
        setFormBusy(offerForm, true);
        try {
          const response = await webApi(`/provider/offers/${offerId}/images/reorder`, { method: 'POST', body: JSON.stringify({ publicIds }) });
          await load();
          state.editingOffer = state.offers.find((offer) => offer.id === offerId) || state.editingOffer;
          state.feedback.offer = { state: 'success', message: pt('photoReorderSaved'), diagnostic: diagnostic(`POST /api/provider/offers/${offerId}/images/reorder`, scope, response) };
          render();
        } catch (error) {
          await load().catch(() => {});
          state.editingOffer = state.offers.find((offer) => offer.id === offerId) || state.editingOffer;
          setProviderFeedback(state, 'offer', 'error', pt('photoReorderError'), diagnostic(`POST /api/provider/offers/${offerId}/images/reorder`, scope, null, null, null, error));
          render();
        } finally { setFormBusy(offerForm, false); }
      });
    });
    const refreshOfferPreview = () => { if (offerForm) { providerUpdateNeedChips(offerForm, state.needs); providerUpdateOfferPreview(offerForm, state.needs); } };
    offerForm?.querySelectorAll('input, textarea, select').forEach((field) => field.addEventListener('input', () => {
      if (field.matches('[data-radius-input]')) offerForm.querySelector('[data-radius-value]').textContent = `${field.value} m`;
      if (field.matches('[data-price-type]')) offerForm.querySelector('[data-price-fields]').dataset.priceType = field.value;
      refreshOfferPreview();
    }));
    offerForm?.querySelectorAll('input[name="needKeys"]').forEach((field) => field.addEventListener('change', refreshOfferPreview));
    offerForm?.querySelector('[data-need-search]')?.addEventListener('input', (event) => {
      const query = event.currentTarget.value;
      const cards = [...offerForm.querySelectorAll('[data-need-card]')];
      const matches = window.UltreiaProviderOfferUi.filterNeeds(state.needs, query).map((need) => need.key);
      cards.forEach((card) => { card.hidden = !matches.includes(card.dataset.needKey); });
      const more = offerForm.querySelector('[data-more-needs]');
      if (more && query.trim()) more.hidden = false;
      offerForm.querySelectorAll('[data-need-group]').forEach((group) => { group.hidden = !group.querySelector('[data-need-card]:not([hidden])'); });
    });
    offerForm?.querySelector('[data-toggle-needs]')?.addEventListener('click', (event) => { const more = offerForm.querySelector('[data-more-needs]'); more.hidden = !more.hidden; event.currentTarget.textContent = more.hidden ? pt('showMore') : pt('hideMore'); });
    offerForm?.querySelectorAll('[data-hours-preset-action]').forEach((button) => button.addEventListener('click', () => { providerApplyHoursPreset(offerForm, button.dataset.hoursPresetAction, state.needs); offerForm.querySelectorAll('[data-hours-preset-action]').forEach((item) => item.classList.toggle('is-selected', item === button)); providerUpdateOfferPreview(offerForm, state.needs); }));
    if (offerForm) offerForm.querySelector(`[data-hours-preset-action="${offerForm.dataset.hoursPreset}"]`)?.classList.add('is-selected');
    offerForm?.querySelectorAll('[data-add-window]').forEach((button) => button.addEventListener('click', () => { const day = button.dataset.addWindow; const row = [...offerForm.querySelectorAll(`[data-hours-window^="${day}-"]`)].find((item) => item.hidden); if (row) { row.hidden = false; offerForm.dataset.hoursPreset = 'custom'; offerForm.dataset.hoursExpanded = 'true'; offerForm.querySelector(`[data-hours-day="${day}"] [data-hours-closed]`).hidden = true; button.hidden = [...offerForm.querySelectorAll(`[data-hours-window^="${day}-"]`)].every((item) => !item.hidden); } }));
    offerForm?.querySelector('[data-copy-hours]')?.addEventListener('click', () => { const source = providerFormWeekly(offerForm).monday || []; providerDays.filter((day) => day !== 'monday').forEach((day) => { offerForm.querySelectorAll(`[data-hours-open="${day}"]`).forEach((input, index) => { const window = source[index] || {}; input.value = window.open || ''; const close = offerForm.querySelector(`[data-hours-close="${day}"][data-hours-index="${index}"]`); if (close) close.value = window.close || ''; const row = offerForm.querySelector(`[data-hours-window="${day}-${index}"]`); if (row) row.hidden = !source[index]; }); offerForm.querySelector(`[data-hours-day="${day}"] [data-hours-closed]`).hidden = source.length > 0; }); providerUpdateOfferPreview(offerForm, state.needs); });
    document.querySelector('[data-cancel-offer]')?.addEventListener('click', () => { revokePendingPhotoEntries(state.pendingPhotoFiles); state.pendingPhotoFiles = []; state.editingOffer = null; render(); });
    document.querySelector('[data-new-offer]')?.addEventListener('click', () => { state.editingOffer = {}; render(); });
    document.querySelector('[data-edit-profile-location]')?.addEventListener('click', () => { state.editingSetup = true; render(); });
    document.querySelector('[data-cancel-setup]')?.addEventListener('click', () => { state.editingSetup = false; state.locationDraft = null; render(); });
    document.querySelectorAll('[data-offer-action]').forEach((button) => button.addEventListener('click', async () => { const id = button.dataset.offerId; const action = button.dataset.offerAction; if (action === 'edit') { state.editingOffer = state.offers.find((offer) => offer.id === id); render(); return; } const scope = state.account?.scope || webScope(); setProviderFeedback(state, 'offer', 'saving', pt('saving')); setFormBusy(button.closest('.provider-panel'), true); try { const result = await webApi(`/provider/offers/${id}/${action}`, { method: 'POST', body: '{}' }); const messages = { pause: 'offerPaused', resume: 'offerResumed', confirm: 'offerConfirmed' }; state.feedback.offer = { state: 'success', message: pt(messages[action] || 'offerSaved'), diagnostic: diagnostic(`POST /api/provider/offers/${id}/${action}`, scope, result, state.profile, result.offer) }; await load(); render(); } catch (error) { const details = providerErrorDetails(error, 'offerActionError'); setProviderFeedback(state, 'offer', 'error', details.message, diagnostic(`POST /api/provider/offers/${id}/${action}`, scope, null, null, null, error)); } finally { setFormBusy(button.closest('.provider-panel'), false); } }));
    document.querySelector('[data-logout]')?.addEventListener('click', async () => { await webApi('/auth/logout', { method: 'POST' }, false).catch(() => {}); window.location.replace('/provider/login/'); });
  };
  try { await load(); render(); } catch { window.location.replace('/provider/login/'); }
}

async function renderStart(role) {
  if (role === 'provider') return renderProviderStart();
  const title = tx('admin');
  webShell(title, `<p class="web-auth-message" data-start-message>${tx('verify')}</p><section class="admin-foundation-panel" data-admin-panel hidden><p class="section-label">${tx('adminFoundation')}</p><h2>${tx('adminFoundation')}</h2><div class="web-account" data-account></div><nav class="admin-foundation-nav" aria-label="${tx('adminFoundation')}"><a href="/provider/login/">${tx('adminNavProvider')}</a></nav></section><button class="web-auth-button" data-logout type="button">${tx('logout')}</button>`);
  try {
    const result = await webApi('/auth/me');
    if (!result.user?.roles?.includes(role) || result.session?.activeRole !== role) { document.querySelector('[data-start-message]').textContent = tx('denied'); return; }
    document.querySelector('[data-start-message]').textContent = tx('adminFoundation');
    const panel = document.querySelector('[data-admin-panel]');
    panel.hidden = false;
    document.querySelector('[data-account]').innerHTML = `<strong>${tx('adminSignedInAs')}: ${escapeProviderHtml(result.user.email)}</strong><span>${tx('adminRoleLabel')}: ${escapeProviderHtml(result.session.activeRole)}</span><span>${tx('adminScopeLabel')}: <span class="scope-badge">${escapeProviderHtml(result.scope)}</span></span>`;
  } catch { window.location.replace(`/${role}/login/`); return; }
  document.querySelector('[data-logout]')?.addEventListener('click', async () => { await webApi('/auth/logout', { method: 'POST' }, false).catch(() => {}); window.location.replace(`/${role}/login/`); });
}

function initializeWebAuth() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/provider/login') renderLogin('provider');
  if (path === '/admin/login') renderLogin('admin');
  if (path === '/auth/verify') renderVerify();
  if (path === '/provider') renderStart('provider');
  if (path === '/admin') renderStart('admin');
}

document.querySelectorAll('[data-language-button]').forEach((button) => {
  button.addEventListener('click', () => window.setTimeout(() => window.location.reload(), 0));
});

initializeWebAuth();
