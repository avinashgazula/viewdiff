import { useCallback, useEffect, useRef, useState } from 'react'
import { ModeTabs } from '../../components/mode-tabs'
import { useTheme } from '../../hooks/use-theme'
import { MoonIcon, MonitorIcon, SunIcon } from '../../components/icons'

type OverlayMode = 'side-by-side' | 'blend' | 'difference' | 'highlight' | 'swipe'

interface ImageInfo {
  file: File
  url: string
  width: number
  height: number
  data: ImageData
}

interface DiffResult {
  percentDiff: number
  changedPixels: number
  totalPixels: number
  boundingBox: { x: number; y: number; w: number; h: number } | null
  diffImageData: ImageData
  highlightImageData: ImageData
  differenceImageData: ImageData
}

function loadImage(file: File): Promise<ImageInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
      resolve({ file, url, width: img.naturalWidth, height: img.naturalHeight, data })
    }
    img.onerror = reject
    img.src = url
  })
}

function computeDiff(left: ImageInfo, right: ImageInfo, threshold: number): DiffResult {
  const w = Math.max(left.width, right.width)
  const h = Math.max(left.height, right.height)

  // Normalize both images to same size
  const leftCanvas = document.createElement('canvas')
  leftCanvas.width = w; leftCanvas.height = h
  const lCtx = leftCanvas.getContext('2d')!
  const lImg = new Image(); lImg.src = left.url
  lCtx.drawImage(lImg, 0, 0)
  const leftData = lCtx.getImageData(0, 0, w, h)

  const rightCanvas = document.createElement('canvas')
  rightCanvas.width = w; rightCanvas.height = h
  const rCtx = rightCanvas.getContext('2d')!
  const rImg = new Image(); rImg.src = right.url
  rCtx.drawImage(rImg, 0, 0)
  const rightData = rCtx.getImageData(0, 0, w, h)

  const l = leftData.data
  const r = rightData.data
  const diff = new Uint8ClampedArray(w * h * 4)
  const highlight = new Uint8ClampedArray(w * h * 4)
  const difference = new Uint8ClampedArray(w * h * 4)

  let changedPixels = 0
  const totalPixels = w * h
  let minX = w, minY = h, maxX = 0, maxY = 0

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4
    const x = i % w, y = Math.floor(i / w)

    const dr = Math.abs(l[idx] - r[idx])
    const dg = Math.abs(l[idx + 1] - r[idx + 1])
    const db = Math.abs(l[idx + 2] - r[idx + 2])
    const da = Math.abs(l[idx + 3] - r[idx + 3])
    const mag = (dr + dg + db + da) / 4

    const amp = Math.min(255, mag * 4)
    difference[idx] = amp; difference[idx + 1] = amp; difference[idx + 2] = amp; difference[idx + 3] = 255

    if (mag > threshold) {
      changedPixels++
      if (x < minX) minX = x; if (y < minY) minY = y
      if (x > maxX) maxX = x; if (y > maxY) maxY = y

      diff[idx] = 255; diff[idx + 1] = 30; diff[idx + 2] = 30
      diff[idx + 3] = Math.min(255, 80 + mag * 3)

      highlight[idx] = Math.min(255, l[idx] + 100)
      highlight[idx + 1] = Math.max(0, l[idx + 1] - 60)
      highlight[idx + 2] = Math.max(0, l[idx + 2] - 60)
      highlight[idx + 3] = 255
    } else {
      diff[idx] = l[idx]; diff[idx + 1] = l[idx + 1]; diff[idx + 2] = l[idx + 2]
      diff[idx + 3] = Math.floor(l[idx + 3] * 0.4)
      highlight[idx] = l[idx]; highlight[idx + 1] = l[idx + 1]; highlight[idx + 2] = l[idx + 2]; highlight[idx + 3] = l[idx + 3]
    }
  }

  return {
    percentDiff: (changedPixels / totalPixels) * 100,
    changedPixels,
    totalPixels,
    boundingBox: changedPixels > 0 ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null,
    diffImageData: new ImageData(diff, w, h),
    highlightImageData: new ImageData(highlight, w, h),
    differenceImageData: new ImageData(difference, w, h),
  }
}

function DropZone({ label, image, onFile }: { label: string; image: ImageInfo | null; onFile: (f: File) => void }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: `2px dashed ${drag ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 12,
        margin: 12,
        background: drag ? 'var(--accent-subtle)' : 'var(--surface)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 160,
      }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault(); setDrag(false)
        const f = e.dataTransfer.files[0]
        if (f && f.type.startsWith('image/')) onFile(f)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      {image ? (
        <img
          src={image.url}
          alt={label}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
        />
      ) : (
        <>
          <div style={{ fontSize: 28, marginBottom: 8, color: 'var(--text-dim)' }}>+</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>Drop image or click to browse</div>
        </>
      )}
    </div>
  )
}

function ImageCanvas({ imageData, label, zoom, pan, onPan, onHover, onLeave }: {
  imageData: ImageData | null
  label: string
  zoom: number
  pan: { x: number; y: number }
  onPan: (dx: number, dy: number) => void
  onHover?: (x: number, y: number, r: number, g: number, b: number, a: number) => void
  onLeave?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!canvasRef.current || !imageData) return
    canvasRef.current.width = imageData.width
    canvasRef.current.height = imageData.height
    canvasRef.current.getContext('2d')!.putImageData(imageData, 0, 0)
  }, [imageData])

  return (
    <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: 'var(--bg)' }}>
      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10, fontSize: 10.5, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', padding: '2px 6px', background: 'var(--surface)', borderRadius: 4, border: '1px solid var(--border)' }}>{label}</div>
      <div
        style={{ width: '100%', height: '100%', overflow: 'hidden', cursor: 'grab' }}
        onMouseDown={(e) => { dragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY } }}
        onMouseMove={(e) => {
          if (dragging.current) {
            onPan(e.clientX - lastPos.current.x, e.clientY - lastPos.current.y)
            lastPos.current = { x: e.clientX, y: e.clientY }
          }
          if (!canvasRef.current || !imageData || !onHover) return
          const rect = canvasRef.current.getBoundingClientRect()
          if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            onLeave?.(); return
          }
          const px = Math.floor((e.clientX - rect.left) / rect.width * imageData.width)
          const py = Math.floor((e.clientY - rect.top) / rect.height * imageData.height)
          if (px >= 0 && px < imageData.width && py >= 0 && py < imageData.height) {
            const idx = (py * imageData.width + px) * 4
            onHover(px, py, imageData.data[idx], imageData.data[idx + 1], imageData.data[idx + 2], imageData.data[idx + 3])
          }
        }}
        onMouseUp={() => { dragging.current = false }}
        onMouseLeave={() => { dragging.current = false; onLeave?.() }}
      >
        <canvas
          ref={canvasRef}
          style={{
            transformOrigin: 'center center',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            imageRendering: zoom > 2 ? 'pixelated' : 'auto',
            display: 'block',
            margin: 'auto',
            marginTop: '5%',
            maxWidth: '90%',
            maxHeight: '85%',
          }}
        />
      </div>
    </div>
  )
}

export function ImageMode() {
  const { mode: themeMode, toggle: toggleTheme } = useTheme()
  const [leftImage, setLeftImage] = useState<ImageInfo | null>(null)
  const [rightImage, setRightImage] = useState<ImageInfo | null>(null)
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('side-by-side')
  const [alpha, setAlpha] = useState(50)
  const [threshold, setThreshold] = useState(10)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [loading, setLoading] = useState(false)
  const [pixelInfo, setPixelInfo] = useState<{ x: number; y: number; r: number; g: number; b: number; a: number } | null>(null)
  const [swipePos, setSwipePos] = useState(50)
  const blendCanvasRef = useRef<HTMLCanvasElement>(null)
  const swipeContainerRef = useRef<HTMLDivElement>(null)

  async function handleFile(side: 'left' | 'right', file: File) {
    setLoading(true)
    try {
      const info = await loadImage(file)
      if (side === 'left') setLeftImage(info)
      else setRightImage(info)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!leftImage || !rightImage) return
    setLoading(true)
    const result = computeDiff(leftImage, rightImage, threshold)
    setDiffResult(result)
    setLoading(false)
  }, [leftImage, rightImage, threshold])

  useEffect(() => {
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }, [overlayMode])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom((z) => Math.min(8, z * 1.5)) }
      else if (e.key === '-') { e.preventDefault(); setZoom((z) => Math.max(0.1, z / 1.5)) }
      else if (e.key === '0') { e.preventDefault(); setZoom(0.5); setPan({ x: 0, y: 0 }) }
      else if (e.key === '1') { e.preventDefault(); setZoom(1); setPan({ x: 0, y: 0 }) }
      else if (e.key === '2') { e.preventDefault(); setZoom(2); setPan({ x: 0, y: 0 }) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Blend canvas
  useEffect(() => {
    if (overlayMode !== 'blend' || !blendCanvasRef.current || !leftImage || !rightImage) return
    const canvas = blendCanvasRef.current
    const w = Math.max(leftImage.width, rightImage.width)
    const h = Math.max(leftImage.height, rightImage.height)
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.globalAlpha = 1
    const lImg = new Image(); lImg.src = leftImage.url
    ctx.drawImage(lImg, 0, 0)
    ctx.globalAlpha = alpha / 100
    const rImg = new Image(); rImg.src = rightImage.url
    ctx.drawImage(rImg, 0, 0)
    ctx.globalAlpha = 1
  }, [overlayMode, leftImage, rightImage, alpha])

  function getDisplayImageData(side: 'left' | 'right'): ImageData | null {
    if (!diffResult) return side === 'left' ? leftImage?.data ?? null : rightImage?.data ?? null
    if (overlayMode === 'difference') return diffResult.differenceImageData
    if (overlayMode === 'highlight') return diffResult.highlightImageData
    if (side === 'left') return leftImage?.data ?? null
    return rightImage?.data ?? null
  }

  const hasBoth = !!(leftImage && rightImage)

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <nav className="toolbar" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="toolbar-brand">
          <a href="/" className="toolbar-title-link" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1 className="toolbar-title">diff</h1>
          </a>
          <span className="toolbar-subtitle">compare anything</span>
        </div>
        <div className="toolbar-controls">
          {(['side-by-side', 'swipe', 'blend', 'difference', 'highlight'] as OverlayMode[]).map((m) => (
            <button
              key={m}
              className={`btn outlined ${overlayMode === m ? 'active' : ''}`}
              onClick={() => setOverlayMode(m)}
              disabled={!hasBoth}
            >
              {m === 'side-by-side' ? 'Side by side' : m === 'swipe' ? 'Swipe' : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}

          {overlayMode === 'blend' && hasBoth && (
            <>
              <div className="divider" aria-hidden="true" />
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Alpha</label>
              <input
                type="range" min={0} max={100} value={alpha}
                onChange={(e) => setAlpha(Number(e.target.value))}
                style={{ width: 80, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 30 }}>{alpha}%</span>
            </>
          )}

          <div className="divider" aria-hidden="true" />

          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Threshold</label>
          <input
            type="range" min={0} max={50} value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            style={{ width: 60, accentColor: 'var(--accent)' }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 20 }}>{threshold}</span>

          <div className="divider" aria-hidden="true" />

          <button className="btn" onClick={() => setZoom((z) => Math.min(8, z * 1.5))} title="Zoom in">+</button>
          <select
            value={Math.round(zoom * 100)}
            onChange={(e) => setZoom(Number(e.target.value) / 100)}
            className="lang-select"
            style={{ width: 72 }}
            title="Zoom level"
          >
            {[10, 25, 50, 75, 100, 150, 200, 400, 800].map((p) => (
              <option key={p} value={p}>{p}%</option>
            ))}
          </select>
          <button className="btn" onClick={() => setZoom((z) => Math.max(0.1, z / 1.5))} title="Zoom out">−</button>
          <button className="btn" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} title="Reset to 100% and center">1:1</button>
          <button className="btn" onClick={() => { setZoom(0.5); setPan({ x: 0, y: 0 }) }} title="Fit to view">Fit</button>

          <div className="divider" aria-hidden="true" />

          {diffResult && (
            <button
              className="btn outlined"
              title="Download diff image as PNG"
              onClick={() => {
                const imgData = overlayMode === 'blend' ? null
                  : overlayMode === 'difference' ? diffResult.differenceImageData
                  : overlayMode === 'highlight' ? diffResult.highlightImageData
                  : null
                if (!imgData) return
                const c = document.createElement('canvas')
                c.width = imgData.width; c.height = imgData.height
                c.getContext('2d')!.putImageData(imgData, 0, 0)
                const a = document.createElement('a')
                a.download = `diff-${overlayMode}.png`
                a.href = c.toDataURL('image/png')
                a.click()
              }}
            >
              Save PNG
            </button>
          )}

          <button onClick={toggleTheme} className="btn icon">
            {themeMode === 'system' ? <MonitorIcon /> : themeMode === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </nav>

      <ModeTabs />

      {!hasBoth ? (
        <div style={{ flex: 1, display: 'flex' }}>
          <DropZone label="Original image" image={leftImage} onFile={(f) => handleFile('left', f)} />
          <DropZone label="Modified image" image={rightImage} onFile={(f) => handleFile('right', f)} />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {overlayMode === 'swipe' && leftImage && rightImage ? (
              <div
                ref={swipeContainerRef}
                style={{ flex: 1, position: 'relative', overflow: 'hidden', userSelect: 'none', cursor: 'col-resize' }}
                onMouseMove={(e) => {
                  if (e.buttons !== 1) return
                  const rect = swipeContainerRef.current?.getBoundingClientRect()
                  if (!rect) return
                  setSwipePos(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)))
                }}
                onMouseDown={(e) => {
                  const rect = swipeContainerRef.current?.getBoundingClientRect()
                  if (!rect) return
                  setSwipePos(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)))
                }}
              >
                <img src={leftImage.url} alt="Original" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', width: `${swipePos}%` }}>
                  <img src={rightImage.url} alt="Modified" style={{ width: swipeContainerRef.current?.offsetWidth ?? 800, height: '100%', objectFit: 'contain', objectPosition: 'left' }} />
                </div>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${swipePos}%`, width: 2, background: 'var(--accent)', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'white', fontWeight: 700 }}>
                    ⇔
                  </div>
                </div>
                <div style={{ position: 'absolute', top: 8, left: 8, background: 'var(--surface)', borderRadius: 4, padding: '2px 6px', fontSize: 10.5, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', border: '1px solid var(--border)' }}>Original</div>
                <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--surface)', borderRadius: 4, padding: '2px 6px', fontSize: 10.5, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', border: '1px solid var(--border)' }}>Modified</div>
              </div>
            ) : overlayMode === 'blend' ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <canvas
                  ref={blendCanvasRef}
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center',
                    maxWidth: '90%',
                    maxHeight: '90%',
                    objectFit: 'contain',
                  }}
                />
              </div>
            ) : (
              <>
                <ImageCanvas
                  imageData={getDisplayImageData('left')}
                  label={overlayMode === 'side-by-side' ? 'Original' : 'Diff overlay'}
                  zoom={zoom}
                  pan={pan}
                  onPan={(dx, dy) => setPan((p) => ({ x: p.x + dx, y: p.y + dy }))}
                  onHover={(x, y, r, g, b, a) => setPixelInfo({ x, y, r, g, b, a })}
                  onLeave={() => setPixelInfo(null)}
                />
                {overlayMode === 'side-by-side' && (
                  <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
                )}
                {overlayMode === 'side-by-side' && (
                  <ImageCanvas
                    imageData={getDisplayImageData('right')}
                    label="Modified"
                    zoom={zoom}
                    pan={pan}
                    onPan={(dx, dy) => setPan((p) => ({ x: p.x + dx, y: p.y + dy }))}
                    onHover={(x, y, r, g, b, a) => setPixelInfo({ x, y, r, g, b, a })}
                    onLeave={() => setPixelInfo(null)}
                  />
                )}
              </>
            )}
          </div>

          {/* Image swap bar */}
          <div style={{ display: 'flex', gap: 12, padding: '6px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
            <label className="btn outlined" style={{ cursor: 'pointer', fontSize: 12 }}>
              Replace original
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile('left', f) }} />
            </label>
            <label className="btn outlined" style={{ cursor: 'pointer', fontSize: 12 }}>
              Replace modified
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile('right', f) }} />
            </label>
          </div>
        </div>
      )}

      <div className="status-bar">
        <div style={{ display: 'flex', gap: 16 }}>
          {loading && <span>Computing diff...</span>}
          {diffResult && !loading && (
            <>
              <span className={diffResult.percentDiff > 0 ? 'stat-red' : 'stat-green'}>
                {diffResult.percentDiff.toFixed(2)}% pixels differ
              </span>
              <span>{diffResult.changedPixels.toLocaleString()} / {diffResult.totalPixels.toLocaleString()} pixels</span>
              {diffResult.boundingBox && (
                <span>Diff region: {diffResult.boundingBox.w}×{diffResult.boundingBox.h}px</span>
              )}
            </>
          )}
          {pixelInfo && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
              ({pixelInfo.x}, {pixelInfo.y})
              {' '}
              <span style={{
                display: 'inline-block', width: 10, height: 10, borderRadius: 2,
                background: `rgba(${pixelInfo.r},${pixelInfo.g},${pixelInfo.b},${(pixelInfo.a / 255).toFixed(2)})`,
                border: '1px solid var(--border)', verticalAlign: 'middle', marginRight: 3,
              }} />
              rgb({pixelInfo.r},{pixelInfo.g},{pixelInfo.b})
              {pixelInfo.a < 255 && ` α:${pixelInfo.a}`}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-dim)' }}>
          {leftImage && (
            <span title={`${leftImage.file.name} — ${leftImage.width}×${leftImage.height}px — ${(leftImage.file.size / 1024).toFixed(1)} KB${leftImage.file.lastModified ? ' — ' + new Date(leftImage.file.lastModified).toLocaleString() : ''}`}>
              Orig: {leftImage.width}×{leftImage.height} · {(leftImage.file.size / 1024).toFixed(1)} KB
            </span>
          )}
          {rightImage && (
            <span title={`${rightImage.file.name} — ${rightImage.width}×${rightImage.height}px — ${(rightImage.file.size / 1024).toFixed(1)} KB${rightImage.file.lastModified ? ' — ' + new Date(rightImage.file.lastModified).toLocaleString() : ''}`}>
              Mod: {rightImage.width}×{rightImage.height} · {(rightImage.file.size / 1024).toFixed(1)} KB
            </span>
          )}
          {leftImage && rightImage && leftImage.width !== rightImage.width || leftImage && rightImage && leftImage.height !== rightImage.height ? (
            <span style={{ color: 'var(--amber)' }}>⚠ Size mismatch</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
