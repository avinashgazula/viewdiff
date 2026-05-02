import { useCallback, useEffect, useRef, useState } from 'react'
import { ModeTabs } from '../../components/mode-tabs'
import { useTheme } from '../../hooks/use-theme'
import { MoonIcon, MonitorIcon, SunIcon } from '../../components/icons'

type OverlayMode = 'side-by-side' | 'blend' | 'difference' | 'highlight'

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

function ImageCanvas({ imageData, label, zoom, pan, onPan }: {
  imageData: ImageData | null
  label: string
  zoom: number
  pan: { x: number; y: number }
  onPan: (dx: number, dy: number) => void
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
          if (!dragging.current) return
          onPan(e.clientX - lastPos.current.x, e.clientY - lastPos.current.y)
          lastPos.current = { x: e.clientX, y: e.clientY }
        }}
        onMouseUp={() => { dragging.current = false }}
        onMouseLeave={() => { dragging.current = false }}
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
  const blendCanvasRef = useRef<HTMLCanvasElement>(null)

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
          {(['side-by-side', 'blend', 'difference', 'highlight'] as OverlayMode[]).map((m) => (
            <button
              key={m}
              className={`btn outlined ${overlayMode === m ? 'active' : ''}`}
              onClick={() => setOverlayMode(m)}
              disabled={!hasBoth}
            >
              {m === 'side-by-side' ? 'Side by side' : m.charAt(0).toUpperCase() + m.slice(1)}
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

          <button className="btn" onClick={() => setZoom((z) => Math.min(8, z * 1.5))}>+</button>
          <span style={{ fontSize: 12, minWidth: 36, textAlign: 'center', color: 'var(--text-secondary)' }}>{Math.round(zoom * 100)}%</span>
          <button className="btn" onClick={() => setZoom((z) => Math.max(0.1, z / 1.5))}>−</button>
          <button className="btn" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>Fit</button>

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
            {overlayMode === 'blend' ? (
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
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
          {leftImage && <span>{leftImage.width}×{leftImage.height} · {(leftImage.file.size / 1024).toFixed(1)} KB</span>}
          {rightImage && <span>{rightImage.width}×{rightImage.height} · {(rightImage.file.size / 1024).toFixed(1)} KB</span>}
        </div>
      </div>
    </div>
  )
}
