/* ========================================
   Incident Reconstruction Engine
   Main Application Logic
   ======================================== */

const app = {
  // State
  currentScreen: 'incidents',
  api: null,
  state: null,
  reportData: {
    answers: {},
    photosYours: [],
    photosThird: [],
    sceneVideo: null,
    damageZones: { first: [], third: [] },
    severityFirst: null,
    severityThird: null,
    ocr: {},
    docLicense: null,
    docInsurance: null,
    docTag: null,
    thirdPartyPhone: { countryCode: '+1', number: '' },
    narrative: '',
    occupancy: { yourVehicle: 1, yourInjuries: null, thirdVehicle: 1, thirdInjuries: null },
    witnesses: { hasWitnesses: null, name: '', phone: { countryCode: '+1', number: '' } },
    policeReport: { filed: null, document: null, violations: null, citations: null, citationDoc: null },
    propertyDamageInfo: { damaged: null, photo: null, propertyName: '', address: '', ownerName: '', ownerPhone: { countryCode: '+1', number: '' } },
    context: {},
    aiResults: null,
    corrections: []
  },
  _sceneVideoBlob: null,

  // ---- Geotab Add-in Lifecycle ----
  initializeAddin() {
    // This is called by the Geotab Drive harness or dev harness
    window.geotab = window.geotab || {};
    window.geotab.addin = window.geotab.addin || {};
    window.geotab.addin.incidentReport = () => ({
      initialize: (api, state, callback) => {
        app.api = api;
        app.state = state;
        app.onInitialized();
        callback();
      },
      focus: (api, state) => {
        app.api = api;
        app.state = state;
        app.onFocus();
      },
      blur: () => {
        app.saveProgress();
      }
    });
  },

  onInitialized() {
    console.log('[Incident Add-in] Initialized');
    this.setupOfflineDetection();
    this.loadSavedProgress();
    this.initDamageZoneClicks();
  },

  onFocus() {
    console.log('[Incident Add-in] Focused');
    if (this.state) {
      const driver = this.state.driver;
      if (driver && driver.name) {
        const firstName = driver.name.split(' ')[0];
        this.setEl('driverFirstName', firstName);
        this.setEl('driverInitials', firstName[0] + (driver.name.split(' ')[1] || 'X')[0]);
      }
    }
  },

  // ---- Navigation ----
  goTo(screenId) {
    const current = document.querySelector('.screen.active');
    if (current) current.classList.remove('active');

    const next = document.getElementById('screen-' + screenId);
    if (next) {
      next.classList.add('active');
      this.currentScreen = screenId;
      this.updateHeader(screenId);
      window.scrollTo(0, 0);

      if (screenId === 'review') this.populateReview();
      if (screenId === 'narrative') this.initNarrativeScreen();
      if (screenId === 'property-damage') this.initPropertyDamageScreen();
    }
  },

  updateHeader(screenId) {
    const titles = {
      'incidents': 'Incidents',
      'safety': 'Incident Reporting',
      'communication': 'Incident Reporting',
      'qualifying': 'Report Incident',
      'photos-yours': 'Report Incident',
      'photos-third': 'Report Incident',
      'damage-first': 'Report Incident',
      'severity-first': 'Report Incident',
      'severity-third': 'Report Incident',
      'damage-third': 'Report Incident',
      'documents': 'Report Incident',
      'narrative': 'Report Incident',
      'police-report': 'Report Incident',
      'property-damage': 'Report Incident',
      'context': 'Report Incident',
      'review': 'Report Incident',
      'success': 'Incident Reporting'
    };
    this.setEl('headerTitle', titles[screenId] || 'Incident Reporting');
  },

  // ---- Qualifying Questions ----
  setAnswer(key, value, btnEl) {
    this.reportData.answers[key] = value;

    // Toggle button selection
    const siblings = btnEl.parentElement.querySelectorAll('.toggle-btn');
    siblings.forEach(b => b.classList.remove('selected'));
    btnEl.classList.add('selected');

    // Conditional: when thirdParty = No, auto-select atScene = No and disable
    if (key === 'thirdParty') {
      const atSceneGroup = document.getElementById('atSceneGroup');
      if (!value) {
        this.reportData.answers.atScene = false;
        atSceneGroup.classList.add('disabled-group');
        const noBtn = atSceneGroup.querySelectorAll('.toggle-btn')[1];
        atSceneGroup.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('selected'));
        noBtn.classList.add('selected');
      } else {
        atSceneGroup.classList.remove('disabled-group');
      }
    }
  },

  qualifyingContinue() {
    this.goTo('photos-yours');
  },

  // ---- Narrative screen init ----
  initNarrativeScreen() {
    const show = !!this.reportData.answers.thirdParty;
    const g = document.getElementById('thirdOccupancyGroup');
    if (g) g.style.display = show ? '' : 'none';
  },

  narrativeContinue() {
    this.reportData.narrative = document.getElementById('narrativeText').value;
    this.goTo('police-report');
  },

  // ---- Occupancy & witness helpers ----
  adjustOccupancy(party, delta) {
    const field = party === 'yours' ? 'yourVehicle' : 'thirdVehicle';
    const elId = party === 'yours' ? 'yourVehicleCount' : 'thirdVehicleCount';
    const current = this.reportData.occupancy[field];
    const next = Math.max(1, current + delta);
    this.reportData.occupancy[field] = next;
    this.setEl(elId, next);
  },

  setNarrativeAnswer(key, value, btnEl) {
    this.reportData.occupancy[key] = value;
    const siblings = btnEl.parentElement.querySelectorAll('.toggle-btn');
    siblings.forEach(b => b.classList.remove('selected'));
    btnEl.classList.add('selected');
  },

  setWitnessToggle(value, btnEl) {
    this.reportData.witnesses.hasWitnesses = value;
    const siblings = btnEl.parentElement.querySelectorAll('.toggle-btn');
    siblings.forEach(b => b.classList.remove('selected'));
    btnEl.classList.add('selected');
    const fields = document.getElementById('witnessFields');
    if (fields) fields.style.display = value ? '' : 'none';
  },

  // ---- Police Report ----
  setPoliceAnswer(key, value, btnEl) {
    this.reportData.policeReport[key] = value;
    const siblings = btnEl.parentElement.querySelectorAll('.toggle-btn');
    siblings.forEach(b => b.classList.remove('selected'));
    btnEl.classList.add('selected');
    if (key === 'filed') {
      const details = document.getElementById('policeReportDetails');
      if (details) details.style.display = value ? '' : 'none';
    }
    if (key === 'citations') {
      const citGroup = document.getElementById('citationDocGroup');
      if (citGroup) citGroup.style.display = value ? '' : 'none';
    }
  },

  capturePoliceReport() {
    const onFile = (file) => {
      const reader = new FileReader();
      reader.onload = () => {
        this.reportData.policeReport.document = reader.result;
        document.getElementById('policeDocUpload').style.display = 'none';
        document.getElementById('policeDocPreview').style.display = 'flex';
      };
      reader.readAsDataURL(file);
    };
    this._showDocMenu(
      () => this._imageInput(true, onFile),
      () => this._imageInput(false, onFile)
    );
  },

  removePoliceDoc() {
    this.reportData.policeReport.document = null;
    document.getElementById('policeDocUpload').style.display = '';
    document.getElementById('policeDocPreview').style.display = 'none';
  },

  captureCitationDoc() {
    const onFile = (file) => {
      const reader = new FileReader();
      reader.onload = () => {
        this.reportData.policeReport.citationDoc = reader.result;
        document.getElementById('citationDocUpload').style.display = 'none';
        document.getElementById('citationDocPreview').style.display = 'flex';
      };
      reader.readAsDataURL(file);
    };
    this._showDocMenu(
      () => this._imageInput(true, onFile),
      () => this._imageInput(false, onFile)
    );
  },

  removeCitationDoc() {
    this.reportData.policeReport.citationDoc = null;
    document.getElementById('citationDocUpload').style.display = '';
    document.getElementById('citationDocPreview').style.display = 'none';
  },

  // ---- Property Damage ----
  setPropertyAnswer(key, value, btnEl) {
    this.reportData.propertyDamageInfo[key] = value;
    const siblings = btnEl.parentElement.querySelectorAll('.toggle-btn');
    siblings.forEach(b => b.classList.remove('selected'));
    btnEl.classList.add('selected');
    if (key === 'damaged') {
      const details = document.getElementById('propertyDamageDetails');
      if (details) details.style.display = value ? '' : 'none';
    }
  },

  initPropertyDamageScreen() {
    // Pre-fill address from GPS context if available
    const loc = this.reportData.context;
    const addrEl = document.getElementById('propertyAddress');
    if (addrEl && loc.address && !addrEl.value) {
      addrEl.value = loc.address;
      this.reportData.propertyDamageInfo.address = loc.address;
    }
  },

  capturePropertyPhoto() {
    const onFile = (file) => {
      const reader = new FileReader();
      reader.onload = () => {
        this.reportData.propertyDamageInfo.photo = reader.result;
        document.getElementById('propertyPhotoUpload').style.display = 'none';
        document.getElementById('propertyPhotoPreview').style.display = 'flex';
      };
      reader.readAsDataURL(file);
    };
    this._showDocMenu(
      () => this._imageInput(true, onFile),
      () => this._imageInput(false, onFile)
    );
  },

  removePropertyPhoto() {
    this.reportData.propertyDamageInfo.photo = null;
    document.getElementById('propertyPhotoUpload').style.display = '';
    document.getElementById('propertyPhotoPreview').style.display = 'none';
  },

  // ---- Optional collapsible sections ----
  toggleSection(sectionId) {
    const body = document.getElementById(sectionId + 'Body');
    const chevron = document.getElementById(sectionId + 'Chevron');
    if (!body) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : '';
    if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
  },

  // ---- 360° Scene Video ----
  captureSceneVideo() {
    // No accept attribute — opens the Files app on iOS (no camera, no crash).
    // accept="video/*" tells iOS to offer the camera which crashes Drive's WKWebView.
    const input = document.createElement('input');
    input.type = 'file';
    input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        this._sceneVideoBlob = file;
        this.reportData.sceneVideo = { name: file.name, size: file.size };
        document.getElementById('sceneVideoSlot').style.display = 'none';
        document.getElementById('sceneVideoPreview').style.display = 'flex';
        this.setEl('sceneVideoName', file.name);
      }
      if (input.parentNode) input.parentNode.removeChild(input);
    };
    document.body.appendChild(input);
    input.click();
  },

  removeSceneVideo() {
    this.reportData.sceneVideo = null;
    this._sceneVideoBlob = null;
    document.getElementById('sceneVideoSlot').style.display = '';
    document.getElementById('sceneVideoPreview').style.display = 'none';
  },

  _startInAppVideoRecording() {
    // MediaRecorder with getUserMedia is not supported in iOS WKWebView (Geotab Drive).
    // Fall back to native file input which shows the iOS camera/video picker.
    const supportsMediaRecorder = (
      typeof MediaRecorder !== 'undefined' &&
      typeof navigator.mediaDevices !== 'undefined' &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );

    if (!supportsMediaRecorder) {
      this._videoFallbackInput();
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'video-record-overlay';
    overlay.innerHTML = `
      <div class="video-record-modal">
        <div class="video-record-header">
          <span>360° Scene Video</span>
          <button class="video-record-close" id="videoCloseBtn">&times;</button>
        </div>
        <div class="video-preview-container">
          <video id="videoPreviewStream" autoplay muted playsinline></video>
          <div class="video-record-indicator" id="videoRecordIndicator" style="display:none">
            <span class="video-rec-dot"></span> REC
          </div>
        </div>
        <div class="video-record-controls">
          <p id="videoRecordStatus" class="video-record-status">Position camera for a 360° walkthrough</p>
          <button class="video-rec-btn" id="videoRecordToggle">
            <span class="video-rec-icon"></span>
            <span id="videoRecordLabel">Start Recording</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    let mediaStream = null;
    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecordingVideo = false;

    const videoEl = document.getElementById('videoPreviewStream');
    const statusEl = document.getElementById('videoRecordStatus');
    const toggleBtn = document.getElementById('videoRecordToggle');
    const labelEl = document.getElementById('videoRecordLabel');
    const indicatorEl = document.getElementById('videoRecordIndicator');

    const cleanup = () => {
      try {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
      } catch (e) { /* ignore */ }
      overlay.remove();
    };

    document.getElementById('videoCloseBtn').onclick = cleanup;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true })
      .then(stream => {
        mediaStream = stream;
        videoEl.srcObject = stream;
      })
      .catch(err => {
        console.warn('[VideoRecord] Camera access denied:', err);
        overlay.remove();
        // Fall back to native file input
        this._videoFallbackInput();
      });

    toggleBtn.onclick = () => {
      if (!mediaStream) return;
      try {
        if (!isRecordingVideo) {
          recordedChunks = [];
          const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
            ? 'video/mp4'
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
              ? 'video/webm;codecs=vp9'
              : 'video/webm';

          try {
            mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
          } catch (e) {
            mediaRecorder = new MediaRecorder(mediaStream);
          }

          mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
          mediaRecorder.onstop = () => {
            try {
              const finalMime = mediaRecorder.mimeType || 'video/webm';
              const blob = new Blob(recordedChunks, { type: finalMime });
              const ext = finalMime.includes('mp4') ? 'mp4' : 'webm';
              const fileName = `scene_video_${Date.now()}.${ext}`;
              this._sceneVideoBlob = blob;
              this.reportData.sceneVideo = { name: fileName, size: blob.size };
              document.getElementById('sceneVideoSlot').style.display = 'none';
              document.getElementById('sceneVideoPreview').style.display = 'flex';
              this.setEl('sceneVideoName', fileName);
              if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
            } catch (e) { console.warn('[VideoRecord] onstop error:', e); }
            overlay.remove();
          };

          mediaRecorder.start(100);
          isRecordingVideo = true;
          indicatorEl.style.display = 'flex';
          toggleBtn.classList.add('recording');
          labelEl.textContent = 'Stop & Save';
          statusEl.textContent = 'Recording — walk around the scene slowly';
        } else {
          isRecordingVideo = false;
          statusEl.textContent = 'Processing video…';
          toggleBtn.disabled = true;
          mediaRecorder.stop();
        }
      } catch (e) {
        console.warn('[VideoRecord] Recording error:', e);
        cleanup();
        this._videoFallbackInput();
      }
    };
  },

  _videoFallbackInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.capture = 'environment';
    input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        this._sceneVideoBlob = file;
        this.reportData.sceneVideo = { name: file.name, size: file.size };
        document.getElementById('sceneVideoSlot').style.display = 'none';
        document.getElementById('sceneVideoPreview').style.display = 'flex';
        this.setEl('sceneVideoName', file.name);
      }
      if (input.parentNode) input.parentNode.removeChild(input);
    };
    document.body.appendChild(input);
    input.click();
  },

  // ---- Shared capture helpers ----
  _showDocMenu(onTake, onChoose) {
    const overlay = document.createElement('div');
    overlay.className = 'photo-menu-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    const menu = document.createElement('div');
    menu.className = 'photo-menu';
    menu.innerHTML = `
      <button class="photo-menu-btn">Take a Photo</button>
      <button class="photo-menu-btn">Choose from Photos</button>
      <button class="photo-menu-cancel">Cancel</button>
    `;
    const btns = menu.querySelectorAll('.photo-menu-btn');
    btns[0].onclick = () => { overlay.remove(); onTake(); };
    btns[1].onclick = () => { overlay.remove(); onChoose(); };
    menu.querySelector('.photo-menu-cancel').onclick = () => overlay.remove();
    overlay.appendChild(menu);
    document.body.appendChild(overlay);
  },

  _showVideoMenu(onRecord, onChoose) {
    const overlay = document.createElement('div');
    overlay.className = 'photo-menu-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    const menu = document.createElement('div');
    menu.className = 'photo-menu';
    menu.innerHTML = `
      <button class="photo-menu-btn">Take a Video</button>
      <button class="photo-menu-btn">Choose from Videos</button>
      <button class="photo-menu-cancel">Cancel</button>
    `;
    const btns = menu.querySelectorAll('.photo-menu-btn');
    btns[0].onclick = () => { overlay.remove(); onRecord(); };
    btns[1].onclick = () => { overlay.remove(); onChoose(); };
    menu.querySelector('.photo-menu-cancel').onclick = () => overlay.remove();
    overlay.appendChild(menu);
    document.body.appendChild(overlay);
  },

  _imageInput(useCamera, onFile) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (useCamera) input.capture = 'environment';
    input.onchange = (e) => { if (e.target.files[0]) onFile(e.target.files[0]); };
    input.click();
  },

  _videoInput(useCamera, onFile) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    if (useCamera) input.capture = 'environment';
    input.onchange = (e) => { if (e.target.files[0]) onFile(e.target.files[0]); };
    input.click();
  },

  // ---- Extra document captures (license, insurance, tag) ----
  captureExtraDoc(type) {
    const map = {
      license:   { key: 'docLicense',   box: 'docLicenseBox',   preview: 'docLicensePreview' },
      insurance: { key: 'docInsurance',  box: 'docInsuranceBox', preview: 'docInsurancePreview' },
      tag:       { key: 'docTag',        box: 'docTagBox',       preview: 'docTagPreview' }
    }[type];
    if (!map) return;
    const onFile = (file) => {
      const reader = new FileReader();
      reader.onload = () => {
        this.reportData[map.key] = reader.result;
        document.getElementById(map.box).style.display = 'none';
        document.getElementById(map.preview).style.display = 'flex';
      };
      reader.readAsDataURL(file);
    };
    this._showDocMenu(
      () => this._imageInput(true, onFile),
      () => this._imageInput(false, onFile)
    );
  },

  removeExtraDoc(type) {
    const map = {
      license:   { key: 'docLicense',   box: 'docLicenseBox',   preview: 'docLicensePreview' },
      insurance: { key: 'docInsurance',  box: 'docInsuranceBox', preview: 'docInsurancePreview' },
      tag:       { key: 'docTag',        box: 'docTagBox',       preview: 'docTagPreview' }
    }[type];
    if (!map) return;
    this.reportData[map.key] = null;
    document.getElementById(map.box).style.display = '';
    document.getElementById(map.preview).style.display = 'none';
  },

  // ---- Photo Capture ----
  showPhotoMenu(party, index) {
    // Skip the custom overlay menu and use the native iOS file picker directly
    // This gives "Take Photo" / "Photo Library" / "Browse" in one menu (no double-menu)
    this._triggerPhotoInput(party, index, false);
  },

  capturePhotoFromCamera(party, index) {
    this._triggerPhotoInput(party, index, true);
  },

  capturePhotoFromLibrary(party, index) {
    this._triggerPhotoInput(party, index, false);
  },

  _triggerPhotoInput(party, index, useCamera) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (useCamera) input.capture = 'environment';
    input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        // Render immediately using a blob URL — works reliably on iOS without large base64 strings
        const blobUrl = URL.createObjectURL(file);
        this.renderPhotoSlot(party, index, blobUrl);

        // Read base64 in background for storage/upload
        const reader = new FileReader();
        reader.onload = () => {
          const arr = party === 'yours' ? this.reportData.photosYours : this.reportData.photosThird;
          arr[index] = reader.result;
        };
        reader.readAsDataURL(file);
      }
      if (input.parentNode) input.parentNode.removeChild(input);
    };

    // Append to DOM before click — required for iOS WKWebView
    document.body.appendChild(input);
    input.click();
  },

  renderPhotoSlot(party, index, dataUrl) {
    const gridId = party === 'yours' ? 'photoGridYours' : 'photoGridThird';
    const grid = document.getElementById(gridId);
    const slot = grid.children[index];
    if (!slot) return;
    slot.innerHTML = `
      <img src="${dataUrl}" alt="Photo ${index + 1}">
      <button class="remove-photo" onclick="event.stopPropagation(); app.removePhoto('${party}',${index})">&times;</button>
    `;
  },

  removePhoto(party, index) {
    const arr = party === 'yours' ? this.reportData.photosYours : this.reportData.photosThird;
    arr[index] = null;
    const labelsYours = ['Front View', 'Rear View', 'Left Side', 'Right Side', 'Damage Close-up'];
    const labelsThird = ['Front View', 'Rear View', 'Left Side', 'Right Side', 'Damage Close-up'];
    const labels = party === 'yours' ? labelsYours : labelsThird;
    const gridId = party === 'yours' ? 'photoGridYours' : 'photoGridThird';
    const grid = document.getElementById(gridId);
    const slot = grid.children[index];
    slot.innerHTML = `
      <svg class="camera-icon" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
      <span class="label">${labels[index]}</span>
    `;
  },

  // ---- AI Photo Analysis ----
  async analyzeYoursAndContinue() {
    const hasPhotos = this.reportData.photosYours.some(p => p);

    if (hasPhotos && navigator.onLine) {
      document.getElementById('aiAnalysisStatusYours').style.display = 'block';

      try {
        const results = await this.callAIAnalysis(this.reportData.photosYours);
        this.reportData.aiResults = results;
        this.applyAIResults(results);
      } catch (err) {
        console.warn('[AI Analysis] Failed, continuing with manual input:', err);
      }

      document.getElementById('aiAnalysisStatusYours').style.display = 'none';
    }

    if (this.reportData.answers.thirdParty) {
      this.goTo('photos-third');
    } else {
      this.goTo('documents');
    }
  },

  async analyzeThirdAndContinue() {
    const hasPhotos = this.reportData.photosThird.some(p => p);

    if (hasPhotos && navigator.onLine) {
      document.getElementById('aiAnalysisStatusThird').style.display = 'block';

      try {
        const results = await this.callAIAnalysis(this.reportData.photosThird);
        // Merge third-party specific results
        if (this.reportData.aiResults) {
          if (results.damageZones && results.damageZones.third) {
            this.reportData.aiResults.damageZones.third = results.damageZones.third;
          }
          if (results.severityThird) {
            this.reportData.aiResults.severityThird = results.severityThird;
          }
        } else {
          this.reportData.aiResults = results;
        }
        this.applyAIResults(this.reportData.aiResults);
      } catch (err) {
        console.warn('[AI Analysis] Failed, continuing with manual input:', err);
      }

      document.getElementById('aiAnalysisStatusThird').style.display = 'none';
    }

    this.goTo('documents');
  },

  async callAIAnalysis(photos) {
    // In production, this calls your backend API
    // For dev/mock, we simulate a response
    if (this.api && this.api._isMock) {
      return this.getMockAIResults();
    }

    // Real API call would go here:
    // const response = await fetch(AI_BACKEND_URL, { ... });
    // return response.json();
    return this.getMockAIResults();
  },

  getMockAIResults() {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          thirdPartyDetected: true,
          thirdPartyVehicleType: 'Pick Up Truck',
          thirdPartyVIN: '1FTFW1ET5DFC10042',
          thirdPartyPlate: 'ABC 1234',
          damageZones: {
            first: ['Front Left', 'Front Center'],
            third: ['Rear Center', 'Rear Right']
          },
          severityFirst: 'Functional',
          severityThird: 'Minor',
          confidenceScores: {
            vehicleType: 0.92,
            vin: 0.67,
            plate: 0.88,
            severity: 0.81
          }
        });
      }, 2000);
    });
  },

  applyAIResults(results) {
    if (!results) return;

    // Auto-select damage zones
    if (results.damageZones) {
      (results.damageZones.first || []).forEach(zone => {
        const chip = document.querySelector(`#damageChipsFirst .zone-chip[onclick*="${zone}"]`);
        if (chip && !chip.classList.contains('selected')) {
          chip.classList.add('selected');
          this.reportData.damageZones.first.push(zone);
        }
      });
      (results.damageZones.third || []).forEach(zone => {
        const chip = document.querySelector(`#damageChipsThird .zone-chip[onclick*="${zone}"]`);
        if (chip && !chip.classList.contains('selected')) {
          chip.classList.add('selected');
          this.reportData.damageZones.third.push(zone);
        }
      });
    }

    // Auto-select severity (first party)
    if (results.severityFirst) {
      this.reportData.severityFirst = results.severityFirst;
      document.querySelectorAll('#screen-severity-first .severity-option').forEach(opt => {
        if (opt.querySelector('h4').textContent === results.severityFirst) {
          opt.classList.add('selected');
        }
      });
    }

    // Auto-select severity (third party)
    if (results.severityThird) {
      this.reportData.severityThird = results.severityThird;
      document.querySelectorAll('#screen-severity-third .severity-option').forEach(opt => {
        if (opt.querySelector('h4').textContent === results.severityThird) {
          opt.classList.add('selected');
        }
      });
    }

    // Auto-select third party vehicle type
    if (results.thirdPartyVehicleType) {
      this.reportData.answers.thirdPartyType = results.thirdPartyVehicleType;
    }

    // Populate OCR-like fields if available
    if (results.thirdPartyVIN) {
      this.reportData.ocr.vin = results.thirdPartyVIN;
    }
    if (results.thirdPartyPlate) {
      this.reportData.ocr.plate = results.thirdPartyPlate;
    }
  },

  // ---- Edit-from-review flow ----
  editFromReview(screenId) {
    this.goTo(screenId);
  },

  returnToReview() {
    this.goTo('review');
  },

  // ---- Damage Zones ----
  initDamageZoneClicks() {
    document.querySelectorAll('.damage-zone').forEach(zoneEl => {
      zoneEl.addEventListener('click', () => {
        const zoneName = zoneEl.getAttribute('data-zone');
        // Find the matching chip button
        const chip = document.querySelector(`#damageChipsFirst .zone-chip[onclick*="${zoneName}"]`);
        if (chip) {
          this.toggleZone('first', zoneName, chip);
          // Sync SVG highlight
          zoneEl.classList.toggle('selected', this.reportData.damageZones.first.includes(zoneName));
        }
      });
    });
  },

  toggleZone(party, zone, chipEl) {
    const zones = this.reportData.damageZones[party];
    const idx = zones.indexOf(zone);

    if (idx > -1) {
      zones.splice(idx, 1);
      chipEl.classList.remove('selected');
    } else {
      zones.push(zone);
      chipEl.classList.add('selected');
    }

    // Sync SVG zone highlight
    const svgZone = document.querySelector(`.damage-zone[data-zone="${zone}"]`);
    if (svgZone) {
      svgZone.classList.toggle('selected', zones.includes(zone));
    }

    // Track if user overrides AI suggestion
    if (this.reportData.aiResults) {
      const aiZones = this.reportData.aiResults.damageZones[party] || [];
      if (aiZones.includes(zone)) {
        this.reportData.corrections.push({
          field: `damageZones.${party}`,
          aiValue: zone,
          userAction: idx > -1 ? 'removed' : 'kept',
          timestamp: new Date().toISOString()
        });
      }
    }
  },

  // ---- Severity ----
  setSeverity(party, level, optionEl) {
    const field = party === 'first' ? 'severityFirst' : 'severityThird';
    const previous = this.reportData[field];
    this.reportData[field] = level;

    // Only deselect siblings within the same screen
    const screen = optionEl.closest('.screen');
    screen.querySelectorAll('.severity-option').forEach(o => o.classList.remove('selected'));
    optionEl.classList.add('selected');

    // Track correction
    const aiField = party === 'first' ? 'severityFirst' : 'severityThird';
    if (this.reportData.aiResults && previous !== level) {
      this.reportData.corrections.push({
        field: field,
        aiValue: this.reportData.aiResults[aiField],
        userValue: level,
        timestamp: new Date().toISOString()
      });
    }
  },

  // ---- Documents navigation ----
  documentsBack() {
    if (this.reportData.answers.thirdParty) {
      this.goTo('photos-third');
    } else {
      this.goTo('photos-yours');
    }
  },

  // ---- Document OCR ----
  captureDocument() {
    const onFile = async (file) => {
      const reader = new FileReader();
      reader.onload = async () => {
        this.reportData.ocr.documentImage = reader.result;
        await this.processDocumentOCR(reader.result);
      };
      reader.readAsDataURL(file);
    };
    this._showDocMenu(
      () => this._imageInput(true, onFile),
      () => this._imageInput(false, onFile)
    );
  },

  async processDocumentOCR(imageData) {
    // In production, send to AI backend for OCR
    // For now, use mock data or AI results
    let ocrData;
    if (this.reportData.aiResults) {
      ocrData = {
        name: 'Robert Johnson',
        policy: 'POL-789456123',
        vin: this.reportData.aiResults.thirdPartyVIN || '1FTFW1ET5DFC10042',
        plate: this.reportData.aiResults.thirdPartyPlate || 'ABC 1234',
        confidence: this.reportData.aiResults.confidenceScores || {}
      };
    } else {
      ocrData = {
        name: 'Robert Johnson',
        policy: 'POL-789456123',
        vin: '1FTFW1ET5DFC10042',
        plate: 'ABC 1234',
        confidence: { name: 0.95, policy: 0.92, vin: 0.67, plate: 0.91 }
      };
    }

    this.reportData.ocr = { ...this.reportData.ocr, ...ocrData };
    this.renderOCRResults(ocrData);
  },

  renderOCRResults(data) {
    const container = document.getElementById('ocrResults');
    container.style.display = 'block';

    this.setEl('ocrName', data.name);
    this.setEl('ocrPolicy', data.policy);
    this.setEl('ocrVin', data.vin);
    this.setEl('ocrPlate', data.plate);

    // Update confidence badges
    this.updateConfBadge('ocrNameConf', data.confidence.name);
    this.updateConfBadge('ocrPolicyConf', data.confidence.policy);
    this.updateConfBadge('ocrVinConf', data.confidence.vin);
    this.updateConfBadge('ocrPlateConf', data.confidence.plate);
  },

  updateConfBadge(elementId, score) {
    const el = document.getElementById(elementId);
    if (!el || !score) return;
    const pct = Math.round(score * 100);
    if (score >= 0.75) {
      el.className = 'confidence-badge high';
      el.innerHTML = `&#x2714; ${pct}%`;
    } else {
      el.className = 'confidence-badge low';
      el.innerHTML = `&#x26A0; ${pct}%`;
    }
  },

  // ---- Telemetry & Context ----
  async fetchTelemetry() {
    if (!this.api) return;

    try {
      const deviceId = this.state?.device?.id;
      if (!deviceId) return;

      const now = new Date();
      const from = new Date(now.getTime() - 120000); // 2 min ago

      // Get device info
      const devices = await this.api.call('Get', {
        typeName: 'Device',
        search: { id: deviceId }
      });

      if (devices && devices.length) {
        this.reportData.context.vin = devices[0].vehicleIdentificationNumber;
        this.reportData.context.vehicleName = devices[0].name;
      }

      // Get log records (GPS + speed)
      const logs = await this.api.call('Get', {
        typeName: 'LogRecord',
        search: {
          deviceSearch: { id: deviceId },
          fromDate: from.toISOString(),
          toDate: now.toISOString()
        }
      });

      if (logs && logs.length) {
        const last = logs[logs.length - 1];
        this.reportData.context.latitude = last.latitude;
        this.reportData.context.longitude = last.longitude;
        this.reportData.context.speed = last.speed;
      }
    } catch (err) {
      console.warn('[Telemetry] Failed to fetch:', err);
    }
  },

  // ---- Review Screen ----
  populateReview() {
    const d = this.reportData;
    const a = d.answers;
    const isThirdParty = !!a.thirdParty;

    this.setEl('revThirdParty', isThirdParty ? 'Yes' : 'No');
    this.setEl('revFirstDamage', d.damageZones.first.join(', ') || '—');
    this.setEl('revSeverityFirst', d.severityFirst || '—');
    this.setEl('revThirdType', a.thirdPartyType || '—');
    this.setEl('revThirdDamage', d.damageZones.third.join(', ') || '—');
    this.setEl('revSeverityThird', d.severityThird || '—');
    this.setEl('revName', d.ocr.name || '—');
    this.setEl('revPolicy', d.ocr.policy || '—');
    this.setEl('revVin', d.ocr.vin || '—');
    this.setEl('revPlate', d.ocr.plate || '—');

    // Occupancy
    this.setEl('revYourVehiclePeople', d.occupancy.yourVehicle);
    this.setEl('revYourInjuries', d.occupancy.yourInjuries === null ? '—' : d.occupancy.yourInjuries ? 'Yes' : 'No');
    this.setEl('revThirdVehiclePeople', d.occupancy.thirdVehicle);
    this.setEl('revThirdInjuries', d.occupancy.thirdInjuries === null ? '—' : d.occupancy.thirdInjuries ? 'Yes' : 'No');

    // Witnesses
    const hasW = d.witnesses.hasWitnesses;
    this.setEl('revWitnesses', hasW === null ? '—' : hasW ? 'Yes' : 'No');
    this.setEl('revWitnessName', hasW && d.witnesses.name ? d.witnesses.name : '—');
    const wp = d.witnesses.phone;
    this.setEl('revWitnessPhone', hasW && wp.number ? `${wp.countryCode} ${wp.number}` : '—');
    ['revRowWitnessName', 'revRowWitnessPhone'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = hasW ? '' : 'none';
    });

    // Police report
    const pr = d.policeReport;
    this.setEl('revPoliceFiled', pr.filed === null ? '—' : pr.filed ? 'Yes' : 'No');
    this.setEl('revPoliceDoc', pr.document ? 'Attached ✓' : 'Not provided');
    this.setEl('revPoliceViolations', pr.violations === null ? '—' : pr.violations ? 'Yes' : 'No');
    this.setEl('revPoliceCitations', pr.citations === null ? '—' : pr.citations ? 'Yes' : 'No');
    ['revRowPoliceDoc', 'revRowPoliceViolations', 'revRowPoliceCitations'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = pr.filed ? '' : 'none';
    });

    // Property damage
    const pd = d.propertyDamageInfo;
    this.setEl('revPropertyDamaged', pd.damaged === null ? '—' : pd.damaged ? 'Yes' : 'No');
    this.setEl('revPropertyName', pd.propertyName || '—');
    this.setEl('revPropertyAddress', pd.address || '—');
    ['revRowPropertyName', 'revRowPropertyAddress'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = pd.damaged ? '' : 'none';
    });

    // Show/hide third-party rows
    const thirdRows = ['revRowThirdDamage', 'revRowThirdSeverity', 'revRowThirdType'];
    thirdRows.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = isThirdParty ? '' : 'none';
    });
    const thirdInfoSection = document.getElementById('revSectionThirdInfo');
    if (thirdInfoSection) thirdInfoSection.style.display = isThirdParty ? '' : 'none';
    ['revRowThirdVehiclePeople', 'revRowThirdInjuries'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = isThirdParty ? '' : 'none';
    });
  },

  // ---- Submit ----
  async submitReport() {
    this.reportData.narrative = (document.getElementById('narrativeText')?.value) || this.reportData.narrative;

    const submitBtn = document.querySelector('#screen-review .btn-success');
    const statusEl = document.getElementById('submitStatus');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }
    if (statusEl) statusEl.style.display = '';

    try {
      if (this.api && !this.api._isMock) {
        await this.submitToGeotab();
      } else {
        // Demo mode — simulate delay
        this.setEl('submitStatus', 'Saving report (demo mode)…');
        await new Promise(r => setTimeout(r, 1500));
        console.log('[Submit] Mock submission data:', JSON.stringify(this.reportData, null, 2));
      }

      const reportId = 'INC-' + new Date().getFullYear() + '-' +
        String(Math.floor(Math.random() * 9999)).padStart(4, '0');
      this.setEl('reportId', reportId);
      this.goTo('success');
      this.clearProgress();
    } catch (err) {
      console.error('[Submit] Failed:', err);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Report'; }
      if (statusEl) {
        statusEl.textContent = 'Submission failed. Please try again.';
        statusEl.style.color = 'var(--error, #c62828)';
      }
      await this.saveOffline(this.reportData);
    }
  },

  async submitToGeotab() {
    const deviceId = this.state.device.id;
    const driverId = this.state.driver?.id || null;
    const dateTime = new Date().toISOString();
    const server = this.state.server || 'my.geotab.com';
    const credentials = this._getApiCredentials();

    // 1. Find the relevant exception event
    this.setEl('submitStatus', 'Locating incident event…');
    const exceptionEventId = await this.getExceptionEventId();
    console.log('[Submit] Exception event:', exceptionEventId);

    // 2. Collect every photo / document to upload
    const photoLabels = ['Front View', 'Rear View', 'Left Side', 'Right Side', 'Damage Close-up'];
    const uploads = [
      ...this.reportData.photosYours.map((d, i) => d ? { data: d, name: `Your Vehicle - ${photoLabels[i]}` } : null),
      ...this.reportData.photosThird.map((d, i) => d ? { data: d, name: `Third Party - ${photoLabels[i]}` } : null),
      this.reportData.docLicense                && { data: this.reportData.docLicense,                   name: "Driver's License" },
      this.reportData.docInsurance              && { data: this.reportData.docInsurance,                 name: 'Insurance Card' },
      this.reportData.docTag                    && { data: this.reportData.docTag,                       name: 'Vehicle Tag/Plate' },
      this.reportData.policeReport.document     && { data: this.reportData.policeReport.document,        name: 'Police Report' },
      this.reportData.policeReport.citationDoc  && { data: this.reportData.policeReport.citationDoc,     name: 'Citation Document' },
      this.reportData.propertyDamageInfo.photo  && { data: this.reportData.propertyDamageInfo.photo,     name: 'Property Damage Photo' },
    ].filter(Boolean);

    // 3. Upload each file as MediaFile (photos + documents)
    const mediaFileIds = [];
    for (let i = 0; i < uploads.length; i++) {
      const item = uploads[i];
      this.setEl('submitStatus', `Uploading ${i + 1} of ${uploads.length}: ${item.name}…`);
      try {
        const id = await this.uploadMediaFile(
          item.data, item.name, deviceId, driverId,
          dateTime, exceptionEventId, server, credentials
        );
        if (id) mediaFileIds.push({ id, name: item.name });
      } catch (e) {
        console.warn('[Submit] Upload failed for', item.name, e);
      }
    }

    // 3b. Upload scene video blob if captured
    if (this.reportData.sceneVideo && this._sceneVideoBlob) {
      this.setEl('submitStatus', 'Uploading scene video…');
      try {
        const id = await this.uploadVideoFile(
          this._sceneVideoBlob, this.reportData.sceneVideo.name,
          deviceId, driverId, dateTime, exceptionEventId, server, credentials
        );
        if (id) mediaFileIds.push({ id, name: this.reportData.sceneVideo.name });
      } catch (e) {
        console.warn('[Submit] Scene video upload failed:', e);
      }
    }

    // 4. Save full structured report as AddInData
    this.setEl('submitStatus', 'Saving report…');
    const d = this.reportData;
    const reportText = this.formatReportText();
    await this.api.call('Add', {
      typeName: 'AddInData',
      entity: {
        addInId: 'aIncidentReport001',
        details: {
          exceptionEventId: exceptionEventId || null,
          submittedAt: dateTime,
          device: { id: deviceId, name: this.state.device.name },
          driver: driverId ? { id: driverId, name: this.state.driver.name } : null,
          mediaFileIds,
          reportText,
          incident: {
            answers: d.answers,
            narrative: d.narrative,
            occupancy: d.occupancy,
            witnesses: { hasWitnesses: d.witnesses.hasWitnesses, name: d.witnesses.name, phone: d.witnesses.phone },
            policeReport: { filed: d.policeReport.filed, violations: d.policeReport.violations, citations: d.policeReport.citations },
            propertyDamage: {
              damaged: d.propertyDamageInfo.damaged,
              propertyName: d.propertyDamageInfo.propertyName,
              address: d.propertyDamageInfo.address,
              ownerName: d.propertyDamageInfo.ownerName,
            },
            thirdPartyOcr: d.ocr,
            thirdPartyPhone: d.thirdPartyPhone,
            damageZones: d.damageZones,
            severityFirst: d.severityFirst,
            severityThird: d.severityThird,
          }
        }
      }
    });

    // 5. Add report text as a comment on the ExceptionEvent so it's visible in the Geotab UI
    if (exceptionEventId) {
      this.setEl('submitStatus', 'Adding comment to exception…');
      try {
        await this.api.call('Set', {
          typeName: 'ExceptionEvent',
          entity: {
            id: exceptionEventId,
            comment: reportText
          }
        });
      } catch (e) {
        // comment field may not be writable on all server versions — non-fatal
        console.warn('[Submit] Could not set ExceptionEvent comment:', e);
      }
    }
  },

  // ---- Submission helpers ----

  async getExceptionEventId() {
    // Some Drive SDK versions expose the exception event context via state
    if (this.state?.exceptionEvent?.id) return this.state.exceptionEvent.id;

    // Fall back: query the most recent collision exception for this device (last 2 hours)
    try {
      const now = new Date();
      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);
      const events = await this.api.call('Get', {
        typeName: 'ExceptionEvent',
        search: {
          deviceSearch: { id: this.state.device.id },
          fromDate: twoHoursAgo.toISOString(),
          toDate: now.toISOString(),
        }
      });
      if (events && events.length > 0) {
        events.sort((a, b) => new Date(b.activeFrom) - new Date(a.activeFrom));
        return events[0].id;
      }
    } catch (e) {
      console.warn('[Submit] Could not find exception event:', e);
    }
    return null;
  },

  async uploadMediaFile(base64DataUrl, name, deviceId, driverId, dateTime, exceptionEventId, server, credentials) {
    // Resize/compress before upload
    const resized = await this._resizeImage(base64DataUrl);

    // Step 1: Create the MediaFile entity record
    const entityId = await this.api.call('Add', {
      typeName: 'MediaFile',
      entity: {
        device: { id: deviceId },
        ...(driverId ? { driver: { id: driverId } } : {}),
        fromDate: dateTime,
        toDate: dateTime,
        mediaType: 'Image',
        name: name,
        solutionId: 'IncidentReport',
        metaData: exceptionEventId ? { exceptionEventId } : {}
      }
    });

    // Step 2: POST the binary via UploadMediaFile endpoint
    if (!entityId || !credentials || !server) {
      console.warn('[Submit] Skipping binary upload — missing credentials or server');
      return entityId;
    }

    try {
      const base64 = resized.split(',')[1];
      const mimeType = resized.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
      const byteChars = atob(base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArray], { type: mimeType });

      const formData = new FormData();
      formData.append('file', blob, name.replace(/[^a-z0-9_-]/gi, '_') + '.jpg');

      const credStr = encodeURIComponent(JSON.stringify(credentials));
      const mediaStr = encodeURIComponent(JSON.stringify({ id: entityId }));
      await fetch(
        `https://${server}/apiv1/UploadMediaFile?credentials=${credStr}&mediaFile=${mediaStr}`,
        { method: 'POST', body: formData }
      );
    } catch (e) {
      console.warn('[Submit] Binary upload failed (entity record still saved):', e);
    }

    return entityId;
  },

  async uploadVideoFile(blob, name, deviceId, driverId, dateTime, exceptionEventId, server, credentials) {
    // Create the MediaFile entity record for a video
    const entityId = await this.api.call('Add', {
      typeName: 'MediaFile',
      entity: {
        device: { id: deviceId },
        ...(driverId ? { driver: { id: driverId } } : {}),
        fromDate: dateTime,
        toDate: dateTime,
        mediaType: 'Video',
        name: name,
        solutionId: 'IncidentReport',
        metaData: exceptionEventId ? { exceptionEventId } : {}
      }
    });

    if (!entityId || !credentials || !server) {
      console.warn('[Submit] Skipping video binary upload — missing credentials or server');
      return entityId;
    }

    try {
      const formData = new FormData();
      formData.append('file', blob, name);

      const credStr = encodeURIComponent(JSON.stringify(credentials));
      const mediaStr = encodeURIComponent(JSON.stringify({ id: entityId }));
      await fetch(
        `https://${server}/apiv1/UploadMediaFile?credentials=${credStr}&mediaFile=${mediaStr}`,
        { method: 'POST', body: formData }
      );
    } catch (e) {
      console.warn('[Submit] Video binary upload failed (entity record still saved):', e);
    }

    return entityId;
  },

  _getApiCredentials() {
    // Try common locations the Geotab SDK stores session credentials
    for (const src of [this.api, this.api?._api, this.api?._rpc]) {
      if (src?._credentials) return src._credentials;
      if (src?.credentials) return src.credentials;
    }
    return null;
  },

  async _resizeImage(base64DataUrl, maxWidth = 1280, quality = 0.75) {
    return new Promise((resolve) => {
      // Only resize actual images (skip PDFs or unknown types)
      if (!base64DataUrl || !base64DataUrl.startsWith('data:image/')) {
        return resolve(base64DataUrl);
      }
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(base64DataUrl);
      img.src = base64DataUrl;
    });
  },

  formatReportText() {
    const d = this.reportData;
    const wp = d.witnesses.phone;
    const op = d.propertyDamageInfo.ownerPhone;
    return [
      '=== INCIDENT REPORT ===',
      `Date: ${new Date().toISOString()}`,
      `Driver: ${this.state?.driver?.name || 'Unknown'}`,
      `Vehicle: ${d.context.vehicleName || 'Unknown'}`,
      `VIN: ${d.context.vin || 'N/A'}`,
      '',
      '--- Qualifying ---',
      `Third Party: ${d.answers.thirdParty ? 'Yes' : 'No'}`,
      `At Scene: ${d.answers.atScene ? 'Yes' : 'No'}`,
      `Property Damage: ${d.answers.propertyDamage ? 'Yes' : 'No'}`,
      '',
      '--- Damage Assessment ---',
      `1st Party Zones: ${d.damageZones.first.join(', ') || 'None'}`,
      `1st Party Severity: ${d.severityFirst || 'Not specified'}`,
      `3rd Party Type: ${d.answers.thirdPartyType || 'N/A'}`,
      `3rd Party Zones: ${d.damageZones.third.join(', ') || 'None'}`,
      `3rd Party Severity: ${d.severityThird || 'Not specified'}`,
      '',
      '--- Third Party Info ---',
      `Name: ${d.ocr.name || 'N/A'}`,
      `Policy: ${d.ocr.policy || 'N/A'}`,
      `VIN: ${d.ocr.vin || 'N/A'}`,
      `Plate: ${d.ocr.plate || 'N/A'}`,
      `Driver's License Captured: ${d.docLicense ? 'Yes' : 'No'}`,
      `Insurance Card Captured: ${d.docInsurance ? 'Yes' : 'No'}`,
      `Vehicle Tag Captured: ${d.docTag ? 'Yes' : 'No'}`,
      `3rd Party Phone: ${d.thirdPartyPhone.number ? `${d.thirdPartyPhone.countryCode} ${d.thirdPartyPhone.number}` : 'N/A'}`,
      '',
      '--- Narrative ---',
      d.narrative || 'No description provided',
      '',
      '--- Occupancy & Injuries ---',
      `Your Vehicle (People): ${d.occupancy.yourVehicle}`,
      `Your Vehicle (Injuries): ${d.occupancy.yourInjuries === null ? 'Not specified' : d.occupancy.yourInjuries ? 'Yes' : 'No'}`,
      `3rd Party Vehicle (People): ${d.occupancy.thirdVehicle}`,
      `3rd Party Vehicle (Injuries): ${d.occupancy.thirdInjuries === null ? 'Not specified' : d.occupancy.thirdInjuries ? 'Yes' : 'No'}`,
      '',
      '--- Witnesses ---',
      `Has Witnesses: ${d.witnesses.hasWitnesses === null ? 'Not specified' : d.witnesses.hasWitnesses ? 'Yes' : 'No'}`,
      ...(d.witnesses.hasWitnesses ? [
        `Witness Name: ${d.witnesses.name || 'N/A'}`,
        `Witness Phone: ${wp.number ? `${wp.countryCode} ${wp.number}` : 'N/A'}`
      ] : []),
      '',
      '--- Police Report ---',
      `Filed: ${d.policeReport.filed === null ? 'Not specified' : d.policeReport.filed ? 'Yes' : 'No'}`,
      ...(d.policeReport.filed ? [
        `Document: ${d.policeReport.document ? 'Attached' : 'Not provided'}`,
        `Violations: ${d.policeReport.violations === null ? 'Not specified' : d.policeReport.violations ? 'Yes' : 'No'}`,
        `Citations: ${d.policeReport.citations === null ? 'Not specified' : d.policeReport.citations ? 'Yes' : 'No'}`
      ] : []),
      '',
      '--- Property Damage ---',
      `Damaged: ${d.propertyDamageInfo.damaged === null ? 'Not specified' : d.propertyDamageInfo.damaged ? 'Yes' : 'No'}`,
      ...(d.propertyDamageInfo.damaged ? [
        `Property: ${d.propertyDamageInfo.propertyName || 'N/A'}`,
        `Address: ${d.propertyDamageInfo.address || 'N/A'}`,
        `Owner: ${d.propertyDamageInfo.ownerName || 'N/A'}`,
        `Owner Phone: ${op.number ? `${op.countryCode} ${op.number}` : 'N/A'}`
      ] : []),
      '',
      '--- AI Corrections ---',
      d.corrections.length ? JSON.stringify(d.corrections) : 'None',
      '=== END REPORT ==='
    ].join('\n');
  },

  // ---- Offline / Persistence ----
  setupOfflineDetection() {
    const banner = document.getElementById('offlineBanner');
    window.addEventListener('online', () => {
      banner.classList.remove('visible');
      this.processPendingReports();
    });
    window.addEventListener('offline', () => {
      banner.classList.add('visible');
    });
    if (!navigator.onLine) banner.classList.add('visible');
  },

  saveProgress() {
    try {
      localStorage.setItem('incident-progress', JSON.stringify({
        screen: this.currentScreen,
        data: this.reportData,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('[Save] localStorage failed:', e);
    }
  },

  loadSavedProgress() {
    try {
      const saved = localStorage.getItem('incident-progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore if less than 24 hours old
        if (Date.now() - parsed.timestamp < 86400000) {
          this.reportData = { ...this.reportData, ...parsed.data };
          console.log('[Restore] Loaded saved progress');
        }
      }
    } catch (e) {
      console.warn('[Restore] Failed:', e);
    }
  },

  clearProgress() {
    localStorage.removeItem('incident-progress');
  },

  async saveOffline(reportData) {
    try {
      const pending = JSON.parse(localStorage.getItem('incident-pending') || '[]');
      pending.push({
        id: crypto.randomUUID(),
        data: reportData,
        timestamp: Date.now()
      });
      localStorage.setItem('incident-pending', JSON.stringify(pending));
    } catch (e) {
      console.warn('[Offline Save] Failed:', e);
    }
  },

  async processPendingReports() {
    try {
      const pending = JSON.parse(localStorage.getItem('incident-pending') || '[]');
      if (!pending.length || !this.api) return;

      for (const report of pending) {
        try {
          this.reportData = report.data;
          await this.submitToGeotab();
        } catch (e) {
          console.warn('[Pending] Failed to submit:', e);
          return; // Stop on first failure, try again later
        }
      }
      localStorage.removeItem('incident-pending');
    } catch (e) {
      console.warn('[Pending] Process failed:', e);
    }
  },

  // ---- Helpers ----
  setEl(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
};

// Initialize the add-in registration
app.initializeAddin();

// If running outside Geotab Drive (dev mode), auto-start
if (!window._geotabDrive) {
  document.addEventListener('DOMContentLoaded', () => {
    // Check if dev harness will call initialize
    setTimeout(() => {
      if (!app.api) {
        console.log('[Dev] No API injected, running standalone');
        app.onInitialized();
      }
    }, 500);
  });
}
