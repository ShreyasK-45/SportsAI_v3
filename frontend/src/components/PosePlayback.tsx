import { Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Landmark, PoseSample } from '../types'

const connections = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]]
const leftLimb = new Set([11, 13, 15, 23, 25, 27, 31]); const rightLimb = new Set([12, 14, 16, 24, 26, 28, 32])

function colour(from: number, to: number) { if (leftLimb.has(from) && leftLimb.has(to)) return '#ff7b67'; if (rightLimb.has(from) && rightLimb.has(to)) return '#6da9ff'; return '#e4fff4' }

// Pose coordinates are normalized to the source video. Project them into the exact
// letterboxed bounds of the displayed video so the skeleton remains on the runner.
function drawSkeleton(context: CanvasRenderingContext2D, points: Landmark[], width: number, height: number, video: HTMLVideoElement) {
  const scale = Math.min(width / video.videoWidth, height / video.videoHeight); const offsetX = (width - video.videoWidth * scale) / 2; const offsetY = (height - video.videoHeight * scale) / 2
  const project = (point: Landmark) => ({ x: offsetX + point.x * video.videoWidth * scale, y: offsetY + point.y * video.videoHeight * scale })
  context.save(); context.lineWidth = 2.75
  connections.forEach(([from, to]) => { if (!points[from] || !points[to]) return; const a = project(points[from]); const b = project(points[to]); context.strokeStyle = colour(from, to); context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke() })
  points.forEach((point, index) => { if ((point.visibility ?? 1) < 0.5) return; const p = project(point); context.fillStyle = leftLimb.has(index) ? '#ff7b67' : rightLimb.has(index) ? '#6da9ff' : '#e4fff4'; context.beginPath(); context.arc(p.x, p.y, 3.2, 0, Math.PI * 2); context.fill() })
  context.restore()
}

export function PosePlayback({ videoUrl, samples }: { videoUrl: string; samples: PoseSample[] }) {
  const videoRef = useRef<HTMLVideoElement>(null); const canvasRef = useRef<HTMLCanvasElement>(null)
  const [speed, setSpeed] = useState(0.5); const [playing, setPlaying] = useState(false); const [currentTime, setCurrentTime] = useState(0); const [duration, setDuration] = useState(0)

  useEffect(() => {
    const video = videoRef.current; const canvas = canvasRef.current
    if (!video || !canvas || !samples.length) return
    const render = () => {
      if (!video.videoWidth) return
      const time = video.currentTime * 1000; const sample = samples.reduce((closest, item) => Math.abs(item.timestamp - time) < Math.abs(closest.timestamp - time) ? item : closest, samples[0])
      const context = canvas.getContext('2d'); const width = video.clientWidth; const height = video.clientHeight
      if (!context || !width || !height) return
      const scale = Math.min(width / video.videoWidth, height / video.videoHeight); const drawWidth = video.videoWidth * scale; const drawHeight = video.videoHeight * scale; const offsetX = (width - drawWidth) / 2; const offsetY = (height - drawHeight) / 2
      canvas.width = width * devicePixelRatio; canvas.height = height * devicePixelRatio; context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      context.fillStyle = '#03090e'; context.fillRect(0, 0, width, height)
      // Draw the decoded source frame first, then the landmarks into this same canvas.
      // This avoids browser video-layer compositing issues that can leave the runner black
      // while the overlay is visible.
      context.drawImage(video, offsetX, offsetY, drawWidth, drawHeight)
      drawSkeleton(context, sample.landmarks, width, height, video)
    }
    let animationFrame = 0; const drawLoop = () => { render(); animationFrame = requestAnimationFrame(drawLoop) }
    const sync = () => setCurrentTime(video.currentTime); const ready = () => { setDuration(video.duration || 0); video.playbackRate = speed; render() }; const finish = () => setPlaying(false)
    video.addEventListener('timeupdate', sync); video.addEventListener('loadeddata', ready); video.addEventListener('ended', finish); window.addEventListener('resize', render); animationFrame = requestAnimationFrame(drawLoop)
    return () => { cancelAnimationFrame(animationFrame); video.removeEventListener('timeupdate', sync); video.removeEventListener('loadeddata', ready); video.removeEventListener('ended', finish); window.removeEventListener('resize', render) }
  }, [samples, speed])

  const togglePlayback = async () => { const video = videoRef.current; if (!video) return; if (playing) { video.pause(); setPlaying(false) } else { await video.play(); setPlaying(true) } }
  const seek = (value: number) => { if (videoRef.current) videoRef.current.currentTime = value; setCurrentTime(value) }
  const changeSpeed = (value: number) => { if (videoRef.current) videoRef.current.playbackRate = value; setSpeed(value) }
  const restart = () => { seek(0); videoRef.current?.pause(); setPlaying(false) }

  return <div className="comparison-playback"><div className="comparison-legend"><span><i className="left-key" />Left limbs</span><span><i className="right-key" />Right limbs</span><span><i className="body-key" />Body line</span></div><div className="comparison-grid single"><div className="comparison-panel"><div className="comparison-label"><span className="observed-dot" />Your video with measured pose</div><video className="analysis-video-source" ref={videoRef} src={videoUrl} muted playsInline /><canvas ref={canvasRef} aria-label="Original running video with measured pose overlay" /></div></div><div className="comparison-controls"><button className="play-control" onClick={togglePlayback} aria-label={playing ? 'Pause video' : 'Play video'}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}{playing ? 'Pause' : 'Play'}</button><button className="restart-control" onClick={restart} aria-label="Restart video"><RotateCcw size={15} /></button><input aria-label="Video position" type="range" min="0" max={duration || 0} step="0.01" value={currentTime} onChange={(event) => seek(Number(event.target.value))} /><span className="time-readout">{currentTime.toFixed(1)}s</span><div className="speed-control"><span>Speed</span>{[0.25, 0.5, 0.75, 1].map((value) => <button className={speed === value ? 'selected' : ''} onClick={() => changeSpeed(value)} key={value}>{value}x</button>)}</div></div><p className="comparison-note">The canvas contains the original decoded video frame plus the measured skeleton. This ensures the skeleton is visibly drawn on the runner, with no synthetic “corrected” body.</p></div>
}
