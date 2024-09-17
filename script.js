document.addEventListener('DOMContentLoaded', () => {
  // =====================================
  // 1. Feature Detection and Audio Context Initialization
  // =====================================

  // Check for Web Audio API support
  if (!window.AudioContext && !window.webkitAudioContext) {
    alert('Web Audio API is not supported in this browser.');
    return; // Exit if not supported
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContext();

  // =====================================
  // 2. Synthesizer Components Initialization
  // =====================================

  let oscillator;
  let filter;
  let envelope;
  let gainNode;
  let distortion;
  let delay;
  let tuning = 0; // In semitones
  let masterTune = 0; // In cents
  let feedback;
  let scriptProcessorNode; // Added for recording

  // Recording Variables
  let recording = false;
  let recordedBuffer = [];
  const bufferSize = 4096;
  const sampleRate = audioContext.sampleRate;

  // =====================================
  // 3. Sequencer Variables and Initialization
  // =====================================

  const SEQUENCE_LENGTH = 16;
  let currentStep = 0;
  let sequence = [];
  let tempo = 120; // BPM
  let isPlaying = false;
  let intervalId = null;
  let reversePlayback = false;

  // Initialize sequence array with default values
  const initializeSequence = () => {
    sequence = [];
    for (let i = 0; i < SEQUENCE_LENGTH; i++) {
      sequence.push({
        active: false,
        note: 'C',
        octave: 3,
        accent: false,
        slide: false,
      });
    }
  };

  initializeSequence();

  // =====================================
  // 4. UI Elements Selection
  // =====================================

  const startAudioButton = document.getElementById('start-audio');
  const synthContainer = document.getElementById('synth');

  // Control Panel Elements
  const waveformSelect = document.getElementById('waveform');
  const tuningSlider = document.getElementById('tuning');
  const masterTuneSlider = document.getElementById('master-tune');
  const tuningValue = document.getElementById('tuning-value');
  const masterTuneValue = document.getElementById('master-tune-value');

  const cutoffSlider = document.getElementById('cutoff');
  const resonanceSlider = document.getElementById('resonance');
  const envModSlider = document.getElementById('env-mod');
  const decaySlider = document.getElementById('decay');
  const accentSlider = document.getElementById('accent');
  const vcfTrimSlider = document.getElementById('vcf-trim');
  const vintageConditionSlider = document.getElementById('vintage-condition');

  const cutoffValue = document.getElementById('cutoff-value');
  const resonanceValue = document.getElementById('resonance-value');
  const envModValue = document.getElementById('env-mod-value');
  const decayValue = document.getElementById('decay-value');
  const accentValue = document.getElementById('accent-value');
  const vcfTrimValue = document.getElementById('vcf-trim-value');
  const vintageConditionValue = document.getElementById('vintage-condition-value');

  const distortionSlider = document.getElementById('distortion');
  const delayTimeSlider = document.getElementById('delay-time');
  const feedbackSlider = document.getElementById('feedback');

  const distortionValue = document.getElementById('distortion-value');
  const delayTimeValue = document.getElementById('delay-time-value');
  const feedbackValue = document.getElementById('feedback-value');

  // Sequencer Elements
  const sequenceGrid = document.getElementById('sequence-grid');
  const startSequencerButton = document.getElementById('start');
  const stopSequencerButton = document.getElementById('stop');
  const tempoInput = document.getElementById('tempo');
  const playbackModeSelect = document.getElementById('playback-mode');

  const editPatternButton = document.getElementById('edit-pattern');
  const randomizePatternButton = document.getElementById('randomize-pattern');
  const savePatternButton = document.getElementById('save-pattern');
  const loadPatternButton = document.getElementById('load-pattern');
  const exportPatternButton = document.getElementById('export-pattern');

  // Pattern Editor Modal Elements
  const patternEditorModal = document.getElementById('pattern-editor-modal');
  const closeModalButton = document.querySelector('.close-button');
  const patternEditorGrid = document.getElementById('pattern-editor-grid');
  const savePatternChangesButton = document.getElementById('save-pattern-changes');

  // Recording Controls Elements
  const startRecordingButton = document.getElementById('start-recording');
  const stopRecordingButton = document.getElementById('stop-recording');
  const recordingIndicator = document.getElementById('recording-indicator');

  // =====================================
  // 5. Event Listeners Setup
  // =====================================

  // Start Audio Button Event Listener
  startAudioButton.addEventListener('click', () => {
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    initializeSynth();
    initializeSequencerUI();
    synthContainer.setAttribute('aria-hidden', 'false');
    startAudioButton.style.display = 'none';
  });

  // Waveform Selector Change Event
  waveformSelect.addEventListener('change', updateOscillatorType);

  // Tuning Slider Event Listener
tuningSlider.addEventListener('input', () => {
  tuning = parseInt(tuningSlider.value, 10);
  tuningValue.textContent = tuning;
});

// Master Tune Slider Event Listener
masterTuneSlider.addEventListener('input', () => {
  masterTune = parseFloat(masterTuneSlider.value);
  masterTuneValue.textContent = masterTune.toFixed(1);
});

  // Filter Parameters Change Events
  cutoffSlider.addEventListener('input', updateFilterParameters);
  resonanceSlider.addEventListener('input', updateFilterParameters);
  vcfTrimSlider.addEventListener('input', updateFilterParameters);
  vintageConditionSlider.addEventListener('input', updateFilterParameters);

  // Envelope Modulation Change Event
  envModSlider.addEventListener('input', updateEnvelopeModulation);

  // Decay Time Change Event
  decaySlider.addEventListener('input', updateDecayTime);

  // Accent Level Change Event
  accentSlider.addEventListener('input', updateAccentLevel);

  // Effects Change Events
  distortionSlider.addEventListener('input', updateDistortion);
  delayTimeSlider.addEventListener('input', updateDelayTime);
  feedbackSlider.addEventListener('input', updateFeedback);

  // Sequencer Controls Event Listeners
  startSequencerButton.addEventListener('click', playSequencer);
  stopSequencerButton.addEventListener('click', stopSequencer);
  tempoInput.addEventListener('input', updateTempo);
  playbackModeSelect.addEventListener('change', resetSequencer);

  // Pattern Management Event Listeners
  randomizePatternButton.addEventListener('click', randomizePattern);
  savePatternButton.addEventListener('click', savePattern);
  loadPatternButton.addEventListener('click', loadPattern);
  exportPatternButton.addEventListener('click', exportPattern);

  // Pattern Editor Modal Event Listeners
  editPatternButton.addEventListener('click', openPatternEditor);
  closeModalButton.addEventListener('click', closePatternEditor);
  window.addEventListener('click', (event) => {
    if (event.target === patternEditorModal) {
      closePatternEditor();
    }
  });
  savePatternChangesButton.addEventListener('click', savePatternChanges);

  // Recording Controls Event Listeners
  startRecordingButton.addEventListener('click', startRecording);
  stopRecordingButton.addEventListener('click', stopRecording);

	/**
 * Calculates the frequency for a given note and octave, including tuning adjustments.
 * @param {string} note - The musical note (e.g., 'C', 'C#', etc.).
 * @param {number} octave - The octave number.
 * @returns {number} Frequency in Hz.
 */
function getAdjustedFrequency(note, octave) {
  const baseFrequency = getFrequencyForNote(note, octave);
  // Apply tuning adjustments
  const adjustedFrequency =
    baseFrequency * Math.pow(2, tuning / 12) * Math.pow(2, masterTune / 1200);
  return adjustedFrequency;
}

  // =====================================
  // 6. Synthesizer Initialization and Configuration
  // =====================================

  /**
   * Initializes the synthesizer components and connects the audio nodes.
   */
  function initializeSynth() {
    // Create Oscillator
    oscillator = audioContext.createOscillator();
    oscillator.type = waveformSelect.value;
    oscillator.frequency.setValueAtTime(getBaseFrequency(), audioContext.currentTime);
    oscillator.start();

    // Initialize tuning variables
  tuning = parseInt(tuningSlider.value, 10);
  masterTune = parseFloat(masterTuneSlider.value);

    // Create Filter
    filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(parseFloat(cutoffSlider.value) + parseFloat(vcfTrimSlider.value), audioContext.currentTime);
    filter.Q.setValueAtTime(parseFloat(resonanceSlider.value) + (parseFloat(vintageConditionSlider.value) * 5), audioContext.currentTime);

    // Create Envelope (Gain Node for Envelope)
    envelope = audioContext.createGain();
    envelope.gain.setValueAtTime(0, audioContext.currentTime);

    // Create Gain Node (Master Volume)
    gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);

    // Create Distortion
    distortion = audioContext.createWaveShaper();
    distortion.curve = makeDistortionCurve(parseFloat(distortionSlider.value));
    distortion.oversample = '4x';

    // Create Delay and Feedback
    delay = audioContext.createDelay();
    delay.delayTime.setValueAtTime(parseFloat(delayTimeSlider.value), audioContext.currentTime);
    feedback = audioContext.createGain();
    feedback.gain.setValueAtTime(parseFloat(feedbackSlider.value), audioContext.currentTime);

    // Create ScriptProcessorNode for recording
    scriptProcessorNode = audioContext.createScriptProcessor(bufferSize, 2, 2);
    scriptProcessorNode.onaudioprocess = handleAudioProcess;

    // Create a GainNode to split the signal
    const splitter = audioContext.createGain();

    // Connect Audio Nodes
    oscillator.connect(filter);
    filter.connect(envelope);
    envelope.connect(gainNode);
    gainNode.connect(distortion);
    distortion.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    
    // Connect delay 
    delay.connect(audioContext.destination); // Live audio output
    delay.connect(scriptProcessorNode); // For recording

    // Connect scriptProcessorNode to destination (needed for onaudioprocess to fire)
    scriptProcessorNode.connect(audioContext.destination);

  }

  /**
   * Updates the oscillator type based on user selection.
   */
  function updateOscillatorType() {
    if (oscillator) {
      oscillator.type = waveformSelect.value;
    }
  }


  /**
   * Updates filter parameters based on user input.
   */
  function updateFilterParameters() {
    const cutoff = parseFloat(cutoffSlider.value);
    const resonance = parseFloat(resonanceSlider.value);
    const vcfTrim = parseFloat(vcfTrimSlider.value);
    const vintageCondition = parseFloat(vintageConditionSlider.value);

    if (filter) {
      filter.frequency.setValueAtTime(cutoff + vcfTrim, audioContext.currentTime);
      filter.Q.setValueAtTime(resonance + (vintageCondition * 5), audioContext.currentTime);
    }

    cutoffValue.textContent = `${cutoff} Hz`;
    resonanceValue.textContent = resonance.toFixed(1);
    vcfTrimValue.textContent = vcfTrim;
    vintageConditionValue.textContent = vintageCondition.toFixed(1);
  }

  /**
   * Updates envelope modulation display.
   */
  function updateEnvelopeModulation() {
    const value = parseFloat(envModSlider.value);
    envModValue.textContent = value.toFixed(2);
  }

  /**
   * Updates decay time display.
   */
  function updateDecayTime() {
    const value = parseFloat(decaySlider.value);
    decayValue.textContent = `${value.toFixed(1)} s`;
  }

  /**
   * Updates accent level display.
   */
  function updateAccentLevel() {
    const value = parseFloat(accentSlider.value);
    accentValue.textContent = value.toFixed(1);
  }

  /**
   * Updates distortion effect.
   */
  function updateDistortion() {
    const value = parseFloat(distortionSlider.value);
    distortion.curve = makeDistortionCurve(value);
    distortionValue.textContent = value.toFixed(1);
  }

  /**
   * Updates delay time display.
   */
  function updateDelayTime() {
    const value = parseFloat(delayTimeSlider.value);
    delay.delayTime.setValueAtTime(value, audioContext.currentTime);
    delayTimeValue.textContent = `${(value * 1000).toFixed(0)} ms`;
  }

  /**
   * Updates feedback gain display.
   */
  function updateFeedback() {
    const value = parseFloat(feedbackSlider.value);
    feedback.gain.setValueAtTime(value, audioContext.currentTime);
    feedbackValue.textContent = value.toFixed(1);
  }

  /**
   * Calculates the base frequency based on the first active step or defaults to A4 (440 Hz).
   * @returns {number} Base frequency in Hz.
   */
  function getBaseFrequency() {
    const firstActiveStep = sequence.find(step => step.active);
    if (firstActiveStep) {
      return getFrequencyForNote(firstActiveStep.note, firstActiveStep.octave);
    }
    return 440; // Default to A4
  }

  /**
   * Creates a distortion curve for the WaveShaper node.
   * @param {number} amount - Distortion amount.
   * @returns {Float32Array} Distortion curve.
   */
  function makeDistortionCurve(amount) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    let x;
    for (let i = 0; i < n_samples; ++i) {
      x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // =====================================
  // 7. Sequencer UI Initialization
  // =====================================

  /**
   * Initializes the sequencer grid UI.
   */
  function initializeSequencerUI() {
    renderSequencerGrid();
  }

  /**
   * Renders the sequencer grid based on the sequence array.
   */
  function renderSequencerGrid() {
    sequenceGrid.innerHTML = ''; // Clear existing grid

    sequence.forEach((step, index) => {
      const stepElement = document.createElement('div');
      stepElement.classList.add('sequence-step');
      stepElement.setAttribute('data-step', index);
      stepElement.setAttribute('role', 'gridcell');
      stepElement.setAttribute('tabindex', '0'); // Make focusable

      // Note Display
      const noteDisplay = document.createElement('div');
      noteDisplay.classList.add('note-display');
      noteDisplay.textContent = `${step.note}${step.octave}`;
      stepElement.appendChild(noteDisplay);

      // Accent Indicator
      if (step.accent) {
        const accentIndicator = document.createElement('div');
        accentIndicator.classList.add('accent-indicator');
        accentIndicator.textContent = 'A';
        stepElement.appendChild(accentIndicator);
      }

      // Slide Indicator
      if (step.slide) {
        const slideIndicator = document.createElement('div');
        slideIndicator.classList.add('slide-indicator');
        slideIndicator.textContent = 'S';
        stepElement.appendChild(slideIndicator);
      }

      // Active State
      if (step.active) {
        stepElement.classList.add('active');
      }

      // Event Listeners
      stepElement.addEventListener('click', (e) => handleStepClick(e, index));
      stepElement.addEventListener('keydown', (e) => handleStepKeyDown(e, index));

      sequenceGrid.appendChild(stepElement);
    });
  }

  /**
   * Handles click events on sequencer steps.
   * @param {Event} event - The click event.
   * @param {number} index - The index of the step.
   */
  function handleStepClick(event, index) {
    if (event.shiftKey) {
      // Toggle Accent
      sequence[index].accent = !sequence[index].accent;
    } else if (event.altKey) {
      // Toggle Slide
      sequence[index].slide = !sequence[index].slide;
    } else if (event.ctrlKey || event.metaKey) {
      // Change Note and Octave
      changeStepNoteAndOctave(index);
    } else {
      // Toggle Active
      sequence[index].active = !sequence[index].active;
    }
    renderSequencerGrid();
  }

  /**
   * Handles keydown events for accessibility.
   * @param {KeyboardEvent} event - The keydown event.
   * @param {number} index - The index of the step.
   */
  function handleStepKeyDown(event, index) {
    switch (event.key) {
      case ' ':
      case 'Enter':
        // Toggle Active on Space or Enter
        sequence[index].active = !sequence[index].active;
        renderSequencerGrid();
        event.preventDefault();
        break;
      default:
        break;
    }
  }

  /**
   * Prompts the user to change the note and octave for a specific step.
   * @param {number} index - The index of the step.
   */
  function changeStepNoteAndOctave(index) {
    const validNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    let newNote = prompt('Enter note (C, C#, D, D#, E, F, F#, G, G#, A, A#, B):', sequence[index].note);
    if (!newNote) return;

    newNote = newNote.toUpperCase();
    if (!validNotes.includes(newNote)) {
      alert('Invalid note entered.');
      return;
    }

    let newOctave = prompt('Enter octave (0-5):', sequence[index].octave);
    newOctave = parseInt(newOctave, 10);
    if (isNaN(newOctave) || newOctave < 0 || newOctave > 5) {
      alert('Invalid octave entered.');
      return;
    }

    sequence[index].note = newNote;
    sequence[index].octave = newOctave;
  }

  // =====================================
  // 8. Sequencer Playback Functionality
  // =====================================

  /**
   * Plays the sequencer based on the current sequence and settings.
   */
  function playSequencer() {
    if (isPlaying) return; // Prevent multiple intervals
    isPlaying = true;
    calculateInterval();

    intervalId = setInterval(() => {
      let stepIndex = determinePlaybackStep();
      const step = sequence[stepIndex];

      if (step.active) {
        playNote(stepIndex);
      }

      highlightStep(stepIndex);

      updateCurrentStep();
    }, calculateInterval() * 1000);
  }

  /**
   * Stops the sequencer playback.
   */
  function stopSequencer() {
    if (!isPlaying) return;
  isPlaying = false;
  clearInterval(intervalId);
  clearStepHighlight();
  currentStep = 0;
  reversePlayback = false;

  // Smoothly ramp down the envelope gain
  const now = audioContext.currentTime;
  envelope.gain.cancelScheduledValues(now);
  envelope.gain.setValueAtTime(envelope.gain.value, now);
  envelope.gain.linearRampToValueAtTime(0, now + 0.05);
  }

  /**
   * Calculates the interval between steps based on the tempo.
   * @returns {number} Interval in seconds.
   */
  function calculateInterval() {
    return (60 / tempo) / 4; // Sixteenth notes
  }

  /**
   * Determines the next step index based on the playback mode.
   * @returns {number} The step index to play.
   */
  function determinePlaybackStep() {
    const mode = playbackModeSelect.value;
    let stepIndex;

    switch (mode) {
      case 'forward':
        stepIndex = currentStep;
        break;
      case 'reverse':
        stepIndex = SEQUENCE_LENGTH - 1 - currentStep;
        break;
      case 'fwrev':
        stepIndex = reversePlayback ? SEQUENCE_LENGTH - 1 - currentStep : currentStep;
        break;
      case 'invert':
        stepIndex = SEQUENCE_LENGTH - 1 - currentStep;
        break;
      case 'random':
        stepIndex = Math.floor(Math.random() * SEQUENCE_LENGTH);
        break;
      default:
        stepIndex = currentStep;
        break;
    }

    return stepIndex;
  }

  /**
   * Plays a note at a specific step index.
   * @param {number} stepIndex - The index of the step.
   */
  function playNote(stepIndex) {
    const step = sequence[stepIndex];
    const now = audioContext.currentTime;
    const decayTime = parseFloat(decaySlider.value);
    const envMod = parseFloat(envModSlider.value);
    const accentLevel = parseFloat(accentSlider.value);

    // Calculate frequency
    const frequency = getAdjustedFrequency(step.note, step.octave);

    // Handle Slide
    if (step.slide && stepIndex > 0) {
      const previousStep = sequence[stepIndex - 1];
      const previousFrequency = getAdjustedFrequency(previousStep.note, previousStep.octave);
      oscillator.frequency.cancelScheduledValues(now);
      oscillator.frequency.setValueAtTime(previousFrequency, now);
      oscillator.frequency.linearRampToValueAtTime(frequency, now + 0.1);
    } else {
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.setValueAtTime(oscillator.frequency.value, now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency, now + 0.01);
    }

    // Handle Accent
  const gainValue = step.accent ? accentLevel : 0.7;
  const attackTime = 0.01; // Small attack time to avoid clicks
  const releaseTime = 0.05; // Small release time to avoid clicks
  envelope.gain.cancelScheduledValues(now);
  envelope.gain.setValueAtTime(envelope.gain.value, now);
  envelope.gain.linearRampToValueAtTime(gainValue, now + attackTime);
  envelope.gain.exponentialRampToValueAtTime(0.001, now + decayTime + releaseTime);

    // Filter Envelope Modulation
    const originalCutoff = parseFloat(cutoffSlider.value);
    const modAmount = envMod * 1000;
    filter.frequency.cancelScheduledValues(now);
    filter.frequency.setValueAtTime(originalCutoff + modAmount, now);
    filter.frequency.exponentialRampToValueAtTime(originalCutoff, now + decayTime);
  }

  /**
   * Highlights the currently playing step in the sequencer grid.
   * @param {number} stepIndex - The index of the step.
   */
  function highlightStep(stepIndex) {
    clearStepHighlight();
    const stepElement = document.querySelector(`.sequence-step[data-step="${stepIndex}"]`);
    if (stepElement) {
      stepElement.classList.add('highlight');
    }
  }

  /**
   * Clears the highlight from all sequencer steps.
   */
  function clearStepHighlight() {
    const highlightedSteps = document.querySelectorAll('.sequence-step.highlight');
    highlightedSteps.forEach(step => step.classList.remove('highlight'));
  }

  /**
   * Updates the current step index based on playback mode.
   */
  function updateCurrentStep() {
    const mode = playbackModeSelect.value;

    if (mode === 'fwrev') {
      if (reversePlayback) {
        currentStep--;
        if (currentStep < 0) {
          currentStep = 0;
          reversePlayback = false;
        }
      } else {
        currentStep++;
        if (currentStep >= SEQUENCE_LENGTH) {
          currentStep = SEQUENCE_LENGTH - 1;
          reversePlayback = true;
        }
      }
    } else {
      currentStep = (currentStep + 1) % SEQUENCE_LENGTH;
    }
  }

  /**
   * Clears the sequencer playback and resets to initial state.
   */
  function resetSequencer() {
    stopSequencer();
    currentStep = 0;
    reversePlayback = false;
  }

  /**
   * Updates the tempo based on user input.
   */
  function updateTempo() {
    const newTempo = parseInt(tempoInput.value, 10);
    if (!isNaN(newTempo) && newTempo >= 60 && newTempo <= 200) {
      tempo = newTempo;
      if (isPlaying) {
        clearInterval(intervalId);
        playSequencer();
      }
    }
  }

  // =====================================
  // 9. Pattern Management Functions
  // =====================================

  /**
   * Randomizes the current sequence pattern.
   */
  function randomizePattern() {
    sequence.forEach(step => {
      step.active = Math.random() > 0.5;
      step.note = getRandomNote();
      step.octave = getRandomOctave();
      step.accent = Math.random() > 0.7;
      step.slide = Math.random() > 0.7;
    });
    renderSequencerGrid();
  }

  /**
   * Saves the current pattern to localStorage.
   */
  function savePattern() {
    const patternName = prompt('Enter a name for the pattern:');
    if (patternName) {
      const sanitizedPatternName = patternName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      localStorage.setItem(`pattern_${sanitizedPatternName}`, JSON.stringify(sequence));
      alert(`Pattern "${patternName}" saved.`);
    }
  }

  /**
   * Loads a saved pattern from localStorage.
   */
  function loadPattern() {
    const patternName = prompt('Enter the name of the pattern to load:');
    if (patternName) {
      const sanitizedPatternName = patternName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const patternData = localStorage.getItem(`pattern_${sanitizedPatternName}`);
      if (patternData) {
        sequence = JSON.parse(patternData);
        renderSequencerGrid();
        alert(`Pattern "${patternName}" loaded.`);
      } else {
        alert(`Pattern "${patternName}" not found.`);
      }
    }
  }

  /**
   * Exports the current pattern as a JSON file.
   */
  function exportPattern() {
    const patternData = JSON.stringify(sequence, null, 2);
    const blob = new Blob([patternData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'pattern.json';
    a.click();

    URL.revokeObjectURL(url);
  }

  // =====================================
  // 10. Pattern Editor Modal Functions
  // =====================================

  /**
   * Opens the pattern editor modal and renders the editor grid.
   */
  function openPatternEditor() {
    patternEditorModal.style.display = 'block';
    patternEditorModal.setAttribute('aria-hidden', 'false');
    renderPatternEditorGrid();
  }

  /**
   * Closes the pattern editor modal.
   */
  function closePatternEditor() {
    patternEditorModal.style.display = 'none';
    patternEditorModal.setAttribute('aria-hidden', 'true');
  }

  /**
   * Renders the pattern editor grid inside the modal.
   */
  function renderPatternEditorGrid() {
    patternEditorGrid.innerHTML = ''; // Clear existing content

    sequence.forEach((step, index) => {
      const editorStep = document.createElement('div');
      editorStep.classList.add('editor-step');
      editorStep.setAttribute('data-step', index);
      editorStep.setAttribute('role', 'gridcell');
      editorStep.setAttribute('tabindex', '0'); // Make focusable

      // Note Selector
      const noteSelect = document.createElement('select');
      noteSelect.classList.add('note-input');
      noteSelect.setAttribute('aria-label', `Select note for step ${index + 1}`);

      // Populate note options
      const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      for (let octave = 0; octave <= 5; octave++) {
        for (let note of notes) {
          const option = document.createElement('option');
          option.value = `${note}${octave}`;
          option.textContent = `${note}${octave}`;
          if (step.note === note && step.octave === octave) {
            option.selected = true;
          }
          noteSelect.appendChild(option);
        }
      }

      editorStep.appendChild(noteSelect);

      // Accent Checkbox
      const accentLabel = document.createElement('label');
      accentLabel.textContent = 'A';
      accentLabel.setAttribute('aria-label', `Toggle accent for step ${index + 1}`);

      const accentCheckbox = document.createElement('input');
      accentCheckbox.type = 'checkbox';
      accentCheckbox.classList.add('accent-checkbox');
      accentCheckbox.checked = step.accent;
      accentCheckbox.setAttribute('aria-checked', step.accent);
      accentLabel.appendChild(accentCheckbox);
      editorStep.appendChild(accentLabel);

      // Slide Checkbox
      const slideLabel = document.createElement('label');
      slideLabel.textContent = 'S';
      slideLabel.setAttribute('aria-label', `Toggle slide for step ${index + 1}`);

      const slideCheckbox = document.createElement('input');
      slideCheckbox.type = 'checkbox';
      slideCheckbox.classList.add('slide-checkbox');
      slideCheckbox.checked = step.slide;
      slideCheckbox.setAttribute('aria-checked', step.slide);
      slideLabel.appendChild(slideCheckbox);
      editorStep.appendChild(slideLabel);

      // Active Checkbox
      const activeLabel = document.createElement('label');
      activeLabel.textContent = 'X';
      activeLabel.setAttribute('aria-label', `Toggle active state for step ${index + 1}`);

      const activeCheckbox = document.createElement('input');
      activeCheckbox.type = 'checkbox';
      activeCheckbox.classList.add('active-checkbox');
      activeCheckbox.checked = step.active;
      activeCheckbox.setAttribute('aria-checked', step.active);
      activeLabel.appendChild(activeCheckbox);
      editorStep.appendChild(activeLabel);

      // Event Listeners for Editor Steps
      editorStep.addEventListener('click', (e) => {
        if (e.target.tagName.toLowerCase() !== 'select' && e.target.tagName.toLowerCase() !== 'input') {
          // Toggle active state on step click
          sequence[index].active = !sequence[index].active;
          renderPatternEditorGrid();
        }
      });

      patternEditorGrid.appendChild(editorStep);
    });
  }

  /**
   * Saves changes made in the pattern editor modal to the sequence array.
   */
  function savePatternChanges() {
    const editorSteps = patternEditorGrid.querySelectorAll('.editor-step');
    editorSteps.forEach((editorStep, index) => {
      const noteSelect = editorStep.querySelector('.note-input');
      const accentCheckbox = editorStep.querySelector('.accent-checkbox');
      const slideCheckbox = editorStep.querySelector('.slide-checkbox');
      const activeCheckbox = editorStep.querySelector('.active-checkbox');

      const noteValue = noteSelect.value;
      const note = noteValue.slice(0, -1);
      const octave = parseInt(noteValue.slice(-1), 10);

      sequence[index].note = note;
      sequence[index].octave = octave;
      sequence[index].accent = accentCheckbox.checked;
      sequence[index].slide = slideCheckbox.checked;
      sequence[index].active = activeCheckbox.checked;
    });

    renderSequencerGrid();
    closePatternEditor();
  }

  // =====================================
  // 11. Recording Functionality
  // =====================================

  /**
   * Starts recording the audio output.
   */
  function startRecording() {
    recordedBuffer = [];
    recording = true;

    // Update UI
    startRecordingButton.disabled = true;
    stopRecordingButton.disabled = false;
    recordingIndicator.style.display = 'inline';
  }

  /**
   * Stops recording and saves the audio file.
   */
  function stopRecording() {
    recording = false;

    // Concatenate all recorded buffers
    const leftChannel = [];
    const rightChannel = [];
    let totalLength = 0;

    recordedBuffer.forEach(buffer => {
      leftChannel.push(buffer[0]);
      rightChannel.push(buffer[1]);
      totalLength += buffer[0].length;
    });

    // Flatten the channel data
    const leftData = flattenArray(leftChannel, totalLength);
    const rightData = flattenArray(rightChannel, totalLength);

    // Create WAV file
    const wavBuffer = interleave(leftData, rightData);
    const wavBlob = createWavFile(wavBuffer);

    // Create a download link and click it
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'recording.wav';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);

    // Update UI
    startRecordingButton.disabled = false;
    stopRecordingButton.disabled = true;
    recordingIndicator.style.display = 'none';
  }

  /**
   * Handles audio processing to capture audio data.
   */
  function handleAudioProcess(event) {
    const inputBuffer = event.inputBuffer;

    // Only record if recording is active
    if (recording) {
      const left = inputBuffer.getChannelData(0);
      const right = inputBuffer.getChannelData(1);

      // Clone the data
      recordedBuffer.push([new Float32Array(left), new Float32Array(right)]);
    }

    // Mute the output to prevent audio feedback
    const outputBuffer = event.outputBuffer;
    for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
      const outputData = outputBuffer.getChannelData(channel);
      outputData.fill(0);
    }
  }

  /**
   * Flattens an array of Float32Arrays into a single Float32Array.
   */
  function flattenArray(channelBuffer, recordingLength) {
    const result = new Float32Array(recordingLength);
    let offset = 0;
    channelBuffer.forEach(buffer => {
      result.set(buffer, offset);
      offset += buffer.length;
    });
    return result;
  }

  /**
   * Interleaves left and right channel data into a single buffer.
   */
  function interleave(leftChannel, rightChannel) {
    const length = leftChannel.length + rightChannel.length;
    const result = new Float32Array(length);

    let index = 0;
    let inputIndex = 0;

    while (index < length) {
      result[index++] = leftChannel[inputIndex];
      result[index++] = rightChannel[inputIndex];
      inputIndex++;
    }
    return result;
  }

  /**
   * Creates a WAV file blob from interleaved audio data.
   */
  function createWavFile(interleaved) {
    const buffer = new ArrayBuffer(44 + interleaved.length * 2);
    const view = new DataView(buffer);

    // Write WAV header
    writeUTFBytes(view, 0, 'RIFF');
    view.setUint32(4, 36 + interleaved.length * 2, true);
    writeUTFBytes(view, 8, 'WAVE');
    writeUTFBytes(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, 2, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 4, true); // ByteRate
    view.setUint16(32, 4, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    writeUTFBytes(view, 36, 'data');
    view.setUint32(40, interleaved.length * 2, true); // Subchunk2Size

    // Write PCM samples
    let index = 44;
    const volume = 1;
    for (let i = 0; i < interleaved.length; i++) {
      view.setInt16(index, interleaved[i] * (0x7FFF * volume), true);
      index += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  /**
   * Writes a string to the DataView.
   */
  function writeUTFBytes(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // =====================================
  // 12. Utility Functions
  // =====================================

  /**
   * Retrieves the frequency for a given note and octave.
   * @param {string} note - The musical note (e.g., 'C', 'C#', etc.).
   * @param {number} octave - The octave number.
   * @returns {number} Frequency in Hz.
   */
  function getFrequencyForNote(note, octave) {
    const noteFrequencies = {
      'C': 16.3516,
    'C#': 17.3239,
    'D': 18.3540,
    'D#': 19.4454,
    'E': 20.6017,
    'F': 21.8268,
    'F#': 23.1247,
    'G': 24.4997,
    'G#': 25.9565,
    'A': 27.5000,
    'A#': 29.1352,
    'B': 30.8677,
    };
    const baseFrequency = noteFrequencies[note];
    return baseFrequency * Math.pow(2, octave);
  }

  /**
   * Generates a random note from the valid notes array.
   * @returns {string} A random musical note.
   */
  function getRandomNote() {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return notes[Math.floor(Math.random() * notes.length)];
  }

  /**
   * Generates a random octave between 0 and 5.
   * @returns {number} A random octave number.
   */
  function getRandomOctave() {
    return Math.floor(Math.random() * 6);
  }

  // =====================================
  // 13. Initialize Sequencer Grid on Load
  // =====================================

  // Initialize sequencer grid on load
  renderSequencerGrid();

});