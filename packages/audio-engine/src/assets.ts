// Asset URLs resolved by Vite (the web app and the demo are Vite builds). Kept apart so the Node
// tests never import them.
import dspUrl from '@splitune/audio-dsp/dsp.wasm?url'
import processorUrl from './processor.ts?worker&url'

export { dspUrl, processorUrl }
