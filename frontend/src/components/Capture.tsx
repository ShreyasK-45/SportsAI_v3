import { useRef, useState } from 'react'
import { Camera, Upload, Video, X } from 'lucide-react'

type Props = { onFile: (file: File) => void; busy: boolean }

export function Capture({ onFile, busy }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLVideoElement>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      streamRef.current = stream; setCameraOpen(true)
      requestAnimationFrame(() => { if (previewRef.current) previewRef.current.srcObject = stream })
    } catch { alert('Camera access was not granted. You can upload a saved video instead.') }
  }
  const closeCamera = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setRecording(false); setCameraOpen(false)
  }
  const toggleRecording = () => {
    if (!streamRef.current) return
    if (recording) { recorderRef.current?.stop(); return }
    chunksRef.current = []
    const recorder = new MediaRecorder(streamRef.current, { mimeType: MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : undefined })
    recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data) }
    recorder.onstop = () => { recorderRef.current = null; streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setRecording(false); setCameraOpen(false); const file = new File([new Blob(chunksRef.current, { type: recorder.mimeType })], `running-clip-${Date.now()}.webm`, { type: recorder.mimeType }); onFile(file) }
    recorder.start(); recorderRef.current = recorder; setRecording(true)
  }

  return <section className="capture-panel">
    <div className="eyebrow"><span className="dot" />FORM CHECK · LONG-DISTANCE RUNNING</div>
    <h1>Run with more clarity,<br /><em>one frame at a time.</em></h1>
    <p className="lead">A private, browser-based form screen for endurance runners. Upload a side-view clip or record one now; your video stays on this device.</p>
    <div className="capture-actions">
      <button className="primary" disabled={busy} onClick={() => inputRef.current?.click()}><Upload size={18} /> Upload a running clip</button>
      <button className="secondary" disabled={busy} onClick={openCamera}><Camera size={18} /> Record a clip</button>
      <input ref={inputRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(event) => event.target.files?.[0] && onFile(event.target.files[0])} />
    </div>
    <p className="small-note"><Video size={15} /> Best results: 10–20 sec · landscape · steady side view · full body visible</p>
    {cameraOpen && <div className="camera-modal" role="dialog" aria-modal="true" aria-label="Record running clip">
      <div className="camera-card"><button className="close-button" onClick={closeCamera} aria-label="Close camera"><X /></button><video ref={previewRef} autoPlay muted playsInline />
        <div><strong>Position your phone side-on.</strong><span>Keep your head to feet in view as you run past the camera.</span></div>
        <button className={recording ? 'recording-button' : 'record-button'} onClick={toggleRecording}>{recording ? 'Stop & analyse clip' : 'Start recording'}</button>
      </div>
    </div>}
  </section>
}
