self.onmessage = (e: MessageEvent) => {
  const { leftData, rightData, width, height, threshold = 10 } = e.data as {
    leftData: ArrayBuffer
    rightData: ArrayBuffer
    width: number
    height: number
    threshold: number
  }

  const left = new Uint8ClampedArray(leftData)
  const right = new Uint8ClampedArray(rightData)
  const diff = new Uint8ClampedArray(width * height * 4)
  const highlight = new Uint8ClampedArray(width * height * 4)
  const difference = new Uint8ClampedArray(width * height * 4)

  let changedPixels = 0
  const totalPixels = width * height

  let minX = width, minY = height, maxX = 0, maxY = 0

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4
    const x = i % width
    const y = Math.floor(i / width)

    const lr = left[idx], lg = left[idx + 1], lb = left[idx + 2], la = left[idx + 3]
    const rr = right[idx], rg = right[idx + 1], rb = right[idx + 2], ra = right[idx + 3]

    const dr = Math.abs(lr - rr)
    const dg = Math.abs(lg - rg)
    const db = Math.abs(lb - rb)
    const da = Math.abs(la - ra)
    const magnitude = (dr + dg + db + da) / 4

    // Difference mode: amplified pixel-level diff (grayscale)
    const amp = Math.min(255, magnitude * 4)
    difference[idx] = amp
    difference[idx + 1] = amp
    difference[idx + 2] = amp
    difference[idx + 3] = 255

    if (magnitude > threshold) {
      changedPixels++
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y

      // Diff overlay: red tinted
      diff[idx] = 255
      diff[idx + 1] = 30
      diff[idx + 2] = 30
      diff[idx + 3] = Math.min(255, 80 + magnitude * 3)

      // Highlight mode: left image with red overlay on changes
      highlight[idx] = Math.min(255, lr + 100)
      highlight[idx + 1] = Math.max(0, lg - 60)
      highlight[idx + 2] = Math.max(0, lb - 60)
      highlight[idx + 3] = 255
    } else {
      // Unchanged: copy left pixel (dimmed for diff overlay)
      diff[idx] = lr
      diff[idx + 1] = lg
      diff[idx + 2] = lb
      diff[idx + 3] = Math.floor(la * 0.4)

      // Unchanged in highlight mode: copy left pixel slightly faded
      highlight[idx] = lr
      highlight[idx + 1] = lg
      highlight[idx + 2] = lb
      highlight[idx + 3] = la
    }
  }

  const boundingBox = changedPixels > 0
    ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
    : null

  ;(self as unknown as Worker).postMessage(
    {
      diffData: diff.buffer,
      highlightData: highlight.buffer,
      differenceData: difference.buffer,
      changedPixels,
      totalPixels,
      percentDiff: (changedPixels / totalPixels) * 100,
      boundingBox,
    },
    { transfer: [diff.buffer, highlight.buffer, difference.buffer] },
  )
}
