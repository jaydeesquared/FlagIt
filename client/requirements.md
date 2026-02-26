## Packages
wavesurfer.js | Audio waveform visualization and interaction
idb | IndexedDB wrapper for storing large audio blobs client-side
lucide-react | Beautiful icons
date-fns | Date formatting
framer-motion | Smooth animations for recording UI and transitions

## Notes
- Audio files (blobs) are stored in client-side IndexedDB to avoid large uploads/latency during recording.
- Backend stores metadata (recordings table) and flag positions (flags table).
- Synchronization logic required: load metadata from API, load blob from IDB by ID.
- Web Speech API (SpeechRecognition) is browser-native, no package needed but requires HTTPS or localhost.
- Tailwind config needs custom font extension for 'Outfit' and 'Inter'.
