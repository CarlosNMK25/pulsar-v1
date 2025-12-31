# SYNTH LAB - Roadmap de Evolución

## Visión General

La aplicación tiene dos casos de uso principales:
1. **LAB Mode**: Experimentación y producción musical detallada
2. **LIVE Mode**: Performance en tiempo real con controles optimizados

---

## Análisis de Mejoras

### 1. Módulo Sample Avanzado

**Problema**: El `SampleModule` actual es compacto pero limitado en funcionalidades.

**Solución**: Modal de Sampler Avanzado accesible desde botón `[⚙️ Advanced]`

**Funcionalidades del Modal**:
- **Slicing/Chopping**: 8 o 16 slices automáticos por transientes
- **ADSR por Sample**: Controles de envolvente individuales
- **Timestretch**: Ajuste de tempo sin cambiar pitch
- **Multi-Sample Slots**: 4-8 slots para cargar múltiples samples
- **Choke Groups**: Samples que se cortan entre sí
- **Slice Sequencer**: Pads para triggear slices individuales
- **Granular Mode**: Reproducción granular del sample

**Archivos a crear/modificar**:
- `src/components/synth/SampleAdvancedModal.tsx` (nuevo)
- `src/components/synth/SliceVisualizer.tsx` (nuevo)
- `src/components/synth/SlicePads.tsx` (nuevo)
- `src/audio/SampleEngine.ts` (añadir slicing)
- `src/hooks/useSampleState.ts` (añadir estado de slices)

---

### 2. Mejoras Internas del Motor de Audio

**Objetivo**: Optimizaciones y mejoras que no afectan la UI pero mejoran la calidad.

| Mejora | Archivo | Descripción |
|--------|---------|-------------|
| Look-ahead Limiter | `AudioEngine.ts` | Prevenir clipping en master |
| Compensación de Latencia | `Scheduler.ts` | Timing más preciso |
| Polifonía Real | `SynthVoice.ts` | Múltiples voces simultáneas |
| Sample Layering | `DrumEngine.ts` | Capas de samples por paso |
| Sidechain Compression | `FXEngine.ts` (nuevo) | Ducking automático |
| Más Curvas Waveshaper | `WaveshaperEngine.ts` | Tape, Tube, Asymmetric |
| Modos Granulares | `TextureEngine.ts` | Más algoritmos de granular |
| Buffer Pooling | `AudioEngine.ts` | Reutilización de buffers |
| Offline Rendering | `AudioEngine.ts` | Export más rápido |

**Prioridad**: Media-Alta (ejecutar en paralelo con UI)

---

### 3. Reorganización FX + Glitch

**Problema**: El espacio de las tarjetas FX y Glitch no se aprovecha óptimamente.

**Propuesta de Reorganización**:

```
┌─────────────────────────────────────────────────────────┐
│ FX PRINCIPAL                    │ MASTER SECTION        │
│ ┌─────────┐ ┌─────────┐        │ ┌─────┐ ┌─────┐      │
│ │ REVERB  │ │ DELAY   │        │ │ HPF │ │ LPF │      │
│ │ Size    │ │ Time    │        │ └─────┘ └─────┘      │
│ │ Decay   │ │ Feedback│        │ ┌─────────────┐      │
│ │ Mix     │ │ Mix     │        │ │   MASTER    │      │
│ └─────────┘ └─────────┘        │ │   VOLUME    │      │
│                                 │ └─────────────┘      │
│ ┌─────────────────────────────┐│                       │
│ │      FX VISUALIZER          ││ [LIMITER] [METER]    │
│ └─────────────────────────────┘│                       │
├─────────────────────────────────┴───────────────────────┤
│ SEND MATRIX (colapsable)                                │
│ [Drum→Rev] [Drum→Del] [Synth→Rev] [Synth→Del] ...      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ GLITCH                                                  │
│ ┌────────────────────────┐ ┌──────────────────────────┐│
│ │ TRIGGERS (5 botones)   │ │ PARAMETERS               ││
│ │ [REV][STUT][HALF][     │ │ Stutter ●────────        ││
│ │  CRUSH][TAPE]          │ │ BitDepth ●───────        ││
│ │                        │ │ Chaos ●──────────        ││
│ └────────────────────────┘ └──────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

**Archivos a modificar**:
- `src/components/synth/FXModule.tsx`
- `src/components/synth/GlitchModuleCompact.tsx`
- `src/components/synth/MasterSection.tsx` (nuevo)

---

### 4. Controles Globales

**Ubicación de Controles**:

#### Header Mejorado (siempre visible)
- Master Volume (knob pequeño)
- CPU/Load Meter
- Undo/Redo buttons
- MIDI Indicator LED
- Save/Load Quick Access
- Settings Icon → abre Side Panel

#### Side Panel (desplegable izquierda)
- **Preset Browser**: Navegación de presets/scenes
- **MIDI Settings**: Device selection, CC mapping
- **Audio Settings**: Buffer size, sample rate
- **Keyboard Shortcuts**: Referencia rápida
- **Project Info**: Nombre, BPM, notas

**Archivos a crear**:
- `src/components/synth/HeaderEnhanced.tsx` (o modificar Header.tsx)
- `src/components/synth/SidePanel.tsx` (nuevo)
- `src/components/synth/PresetBrowser.tsx` (nuevo)
- `src/components/synth/SettingsModal.tsx` (nuevo)

---

### 5. Modos LAB vs LIVE

#### LAB Mode (Producción/Experimentación)
- Secuenciadores completos con todos los pasos visibles
- P-Locks editor expandido
- Visualizadores detallados (waveforms, spectrum)
- Controles precisos (knobs pequeños, valores numéricos)
- Acceso a todas las configuraciones

#### LIVE Mode (Performance)
- Secuenciadores minimizados (solo indicador de paso)
- XY Pads grandes para control expresivo
- Knobs/Pads grandes para control táctil
- Scene launchers prominentes
- Macro knobs maximizados
- Teclado virtual visible
- Glitch triggers como pads grandes

**Implementación**:
- Toggle en Header: `[LAB] [LIVE]`
- Context provider para modo actual
- Componentes adaptativos según modo
- Layouts diferentes para cada modo

**Archivos a crear**:
- `src/contexts/ViewModeContext.tsx` (nuevo)
- `src/components/live/LiveDrumPad.tsx` (nuevo)
- `src/components/live/LiveMacroPanel.tsx` (nuevo)
- `src/components/live/LiveSceneLauncher.tsx` (nuevo)
- `src/components/live/XYPad.tsx` (nuevo)

---

### 6. Bottom Dock (Multi-función)

**Tabs del Dock**:
1. **🎹 Keys**: Teclado QWERTY → notas musicales
2. **📊 Mixer**: Faders de volumen por track
3. **🎛️ Params**: MIDI Learn, Automation lanes
4. **📈 Scope**: Oscilloscopio/Spectrum expandido

**Archivos a crear**:
- `src/components/synth/BottomDock.tsx` (nuevo)
- `src/components/synth/VirtualKeyboard.tsx` (nuevo)
- `src/components/synth/MixerView.tsx` (nuevo)
- `src/components/synth/ScopeView.tsx` (nuevo)

---

## Plan de Ejecución por Fases

### FASE 1: Consolidación (Semana 1-2)
**Objetivo**: Estabilizar y mejorar lo existente sin añadir complejidad

| Tarea | Prioridad | Complejidad | Archivos |
|-------|-----------|-------------|----------|
| Drive P-Lock | Alta | Baja | PLockEditor.tsx, useAudioEngine.ts |
| Reorganizar FX layout | Alta | Media | FXModule.tsx |
| Reorganizar Glitch layout | Alta | Media | GlitchModuleCompact.tsx |
| Master Section | Alta | Baja | MasterSection.tsx (nuevo) |
| Header: Master Volume | Media | Baja | Header.tsx |
| Header: Undo/Redo | Media | Media | Header.tsx, useHistory.ts |

### FASE 2: Sampler Avanzado (Semana 3-4)
**Objetivo**: Expandir capacidades del sampler

| Tarea | Prioridad | Complejidad | Archivos |
|-------|-----------|-------------|----------|
| Modal estructura | Alta | Media | SampleAdvancedModal.tsx |
| Slice Engine | Alta | Alta | SampleEngine.ts |
| Slice Visualizer | Alta | Media | SliceVisualizer.tsx |
| Slice Pads UI | Media | Media | SlicePads.tsx |
| ADSR por sample | Media | Media | SampleEngine.ts |
| Multi-sample slots | Baja | Alta | useSampleState.ts |

### FASE 3: Controles Globales (Semana 5-6)
**Objetivo**: Acceso centralizado a configuración

| Tarea | Prioridad | Complejidad | Archivos |
|-------|-----------|-------------|----------|
| Side Panel estructura | Alta | Media | SidePanel.tsx |
| Settings Modal | Alta | Media | SettingsModal.tsx |
| Preset Browser básico | Media | Media | PresetBrowser.tsx |
| MIDI Engine básico | Media | Alta | MidiEngine.ts |
| MIDI Settings UI | Baja | Media | MidiSettings.tsx |

### FASE 4: Modo Dual LAB/LIVE (Semana 7-8)
**Objetivo**: Dos experiencias optimizadas

| Tarea | Prioridad | Complejidad | Archivos |
|-------|-----------|-------------|----------|
| ViewMode Context | Alta | Baja | ViewModeContext.tsx |
| Toggle en Header | Alta | Baja | Header.tsx |
| Live Drum Pads | Alta | Media | LiveDrumPad.tsx |
| Live Scene Launcher | Alta | Media | LiveSceneLauncher.tsx |
| XY Pad | Media | Media | XYPad.tsx |
| Virtual Keyboard | Media | Media | VirtualKeyboard.tsx |
| Bottom Dock | Media | Media | BottomDock.tsx |

### FASE PARALELA: Motor de Audio
**Ejecutar en paralelo con las fases UI**

| Tarea | Prioridad | Complejidad |
|-------|-----------|-------------|
| Look-ahead Limiter | Alta | Media |
| Polifonía SynthVoice | Alta | Alta |
| Más curvas Waveshaper | Media | Baja |
| Sidechain básico | Media | Media |
| Offline Rendering | Baja | Alta |

---

## Principios de Desarrollo

### Seguridad
1. **Commits pequeños**: Una feature por commit
2. **Tests manuales**: Probar audio después de cada cambio
3. **Backwards compatible**: No romper scenes guardadas
4. **Feature flags**: Poder desactivar features nuevas

### Arquitectura
1. **Componentes pequeños**: Max 200 líneas por archivo
2. **Hooks separados**: Lógica en hooks, UI en componentes
3. **Tipos estrictos**: TypeScript para todo
4. **Design tokens**: Usar variables CSS del design system

### Performance
1. **Memoización**: useMemo/useCallback donde sea necesario
2. **Lazy loading**: Modales y componentes pesados
3. **Audio thread**: No bloquear el audio worklet
4. **RAF para animaciones**: No usar setInterval para UI

---

## Estructura de Archivos Propuesta

```
src/
├── audio/
│   ├── engines/
│   │   ├── AudioEngine.ts
│   │   ├── DrumEngine.ts
│   │   ├── SynthVoice.ts
│   │   ├── SampleEngine.ts      # + slicing
│   │   ├── TextureEngine.ts
│   │   ├── FXEngine.ts
│   │   ├── GlitchEngine.ts
│   │   └── MidiEngine.ts        # nuevo
│   ├── processors/
│   │   ├── WaveshaperEngine.ts
│   │   ├── Limiter.ts           # nuevo
│   │   └── Compressor.ts        # nuevo
│   └── utils/
│       ├── Scheduler.ts
│       ├── EuclideanGenerator.ts
│       └── PatternGenerator.ts  # nuevo
├── components/
│   ├── synth/
│   │   ├── modules/
│   │   │   ├── DrumModule.tsx
│   │   │   ├── SynthModule.tsx
│   │   │   ├── SampleModule.tsx
│   │   │   ├── TextureModule.tsx
│   │   │   ├── FXModule.tsx     # reorganizado
│   │   │   ├── GlitchModule.tsx # reorganizado
│   │   │   └── MasterSection.tsx # nuevo
│   │   ├── controls/
│   │   │   ├── Knob.tsx
│   │   │   ├── StepSequencer.tsx
│   │   │   ├── MacroKnobs.tsx
│   │   │   └── TransportControls.tsx
│   │   ├── modals/
│   │   │   ├── SampleAdvancedModal.tsx  # nuevo
│   │   │   ├── SettingsModal.tsx        # nuevo
│   │   │   └── PLockEditor.tsx
│   │   ├── panels/
│   │   │   ├── SidePanel.tsx            # nuevo
│   │   │   ├── PresetBrowser.tsx        # nuevo
│   │   │   └── BottomDock.tsx           # nuevo
│   │   └── layout/
│   │       ├── Header.tsx
│   │       └── ModuleCard.tsx
│   └── live/
│       ├── LiveDrumPad.tsx      # nuevo
│       ├── LiveSceneLauncher.tsx # nuevo
│       ├── XYPad.tsx            # nuevo
│       └── VirtualKeyboard.tsx  # nuevo
├── contexts/
│   └── ViewModeContext.tsx      # nuevo
├── hooks/
│   ├── useAudioEngine.ts
│   ├── useDrumState.ts
│   ├── useSynthState.ts
│   ├── useSampleState.ts        # + slices
│   ├── useTextureState.ts
│   ├── useFXState.ts
│   ├── useSceneManager.ts
│   ├── useMidi.ts               # nuevo
│   └── useHistory.ts            # nuevo (undo/redo)
└── pages/
    └── Index.tsx
```

---

## Notas Adicionales

### Compatibilidad de Scenes
Al añadir nuevos parámetros, asegurar que:
1. Scenes antiguas carguen con valores por defecto
2. Export/Import JSON sea backwards compatible
3. Factory presets se actualicen con nuevos params

### Testing Manual Prioritario
Después de cada cambio de audio:
1. Verificar que play/stop funciona
2. Verificar que no hay clicks/pops
3. Verificar que scenes cargan correctamente
4. Verificar que export audio funciona

---

*Documento creado: 2024*
*Última actualización: [fecha]*
