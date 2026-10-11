import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { isPictureElementId, pictureElementMime, type PictureElementId } from '../../lib/zx-core/pictureElements'
import { connectionError } from '../../lib/zx-core/connections'
import { classifyNode, flipPhase, parsePhase, phaseLabel } from '../../lib/zx-core/semantics'
import type { ZXGraph3D, ZXNode, Vector3 } from '../../types/zx'

export interface SpiderCanvasApi {
  centerPoint: () => Vector3
  startConnection: (id: string) => void
}

interface Spider3DCanvasViewProps {
  cameraKey?: string
  graph: ZXGraph3D
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  onMove: (moves: Record<string, Vector3>) => void
  onConnect: (source: string, target: string) => string | undefined
  onDelete: (ids: string[]) => void
  canDelete: (id: string) => boolean
  describeNode: (node: ZXNode) => string
  onDropElement?: (elementId: PictureElementId, position: Vector3) => void
  joinGuide?: string
  joinNodeIds?: string[]
  onJoinNode?: (id: string) => void
  onCancelJoin?: () => void
  apiRef?: RefObject<SpiderCanvasApi | null>
  className?: string
}

const sceneScale = 60
function labelSprite(node: ZXNode) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const context = canvas.getContext('2d')!
  context.textAlign = 'center'
  context.shadowColor = '#72ffe1'
  context.shadowBlur = 12
  context.fillStyle = '#f4fbff'
  context.font = 'bold 42px monospace'
  const text = node.kind === 'boundary' ? node.label ?? '' : `${node.phase}`
  context.fillText(text, 128, 48)
  const phase = node.kind === 'z' || node.kind === 'x' ? parsePhase(node.phase) : undefined
  if (phase) {
    context.beginPath()
    context.arc(28, 92, 8, 0, Math.PI * 2)
    context.fill()
    context.font = 'bold 24px monospace'
    context.fillStyle = '#9ad7ff'
    context.fillText(phaseLabel(flipPhase(phase)), 148, 100)
  }
  const texture = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
  sprite.scale.set(2.2, 1.1, 1)
  sprite.position.y = node.kind === 'boundary' ? 0.62 : 0.95
  return sprite
}

type Marquee = { x0: number; y0: number; x1: number; y1: number }
const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

export function Spider3DCanvasView({ cameraKey = '', graph, selectedIds, onSelectionChange, onMove, onConnect, onDelete, canDelete, describeNode, onDropElement, joinGuide = '', joinNodeIds = [], onJoinNode, onCancelJoin, apiRef, className = '' }: Spider3DCanvasViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const callbacks = useRef({ onSelectionChange, onMove, describeNode })
  const controls = useRef<{ zoom: (factor: number) => void; reset: () => void; pointAt: (clientX: number, clientY: number) => Vector3; center: () => Vector3 } | null>(null)
  const selectedRef = useRef(new Set(selectedIds))
  const savedView = useRef<{ projection: string; position: THREE.Vector3; target: THREE.Vector3; zoom: number } | null>(null)
  const [projection, setProjection] = useState<'3d' | '2d'>('2d')
  const [bookTime, setBookTime] = useState(true)
  const [dropActive, setDropActive] = useState(false)
  const [canvasCursor, setCanvasCursor] = useState<'default' | 'pointer' | 'crosshair' | 'grab' | 'grabbing' | 'move'>('default')
  const [marquee, setMarquee] = useState<Marquee>()
  const [hoverId, setHoverId] = useState<string>()
  const [connectionSource, setConnectionSource] = useState<string>()
  const [connectionMessage, setConnectionMessage] = useState('')
  const messageTimer = useRef(0)
  const connectionRef = useRef({ source: undefined as string | undefined, hover: undefined as string | undefined })
  const nodeHandles = useRef(new Map<string, HTMLButtonElement>())
  const actionMenu = useRef<HTMLDivElement>(null)
  const hoverTip = useRef<HTMLDivElement>(null)
  const hoverRef = useRef<string | undefined>(undefined)
  const connecting = Boolean(connectionSource)
  const joining = Boolean(joinGuide)
  const joinIds = new Set(joinNodeIds)
  const cancelJoin = useRef(onCancelJoin)
  cancelJoin.current = onCancelJoin

  const flash = useCallback((message: string) => {
    window.clearTimeout(messageTimer.current)
    setConnectionMessage(message)
    messageTimer.current = window.setTimeout(() => setConnectionMessage(''), 2600)
  }, [])
  const startConnection = useCallback((id: string) => {
    window.clearTimeout(messageTimer.current)
    connectionRef.current.source = id
    connectionRef.current.hover = undefined
    setConnectionSource(id)
    callbacks.current.onSelectionChange([id])
    setConnectionMessage('Click another node to connect it. Use × to delete this node. Esc or an empty click cancels.')
    cancelJoin.current?.()
  }, [])
  const cancelConnection = useCallback((message = '') => {
    connectionRef.current.source = undefined
    connectionRef.current.hover = undefined
    setConnectionSource(undefined)
    if (message) flash(message)
    else setConnectionMessage('')
  }, [flash])
  const chooseConnectionNode = (id: string) => {
    const source = connectionRef.current.source
    if (!source) {
      onSelectionChange([id])
      return
    }
    if (source === id) {
      cancelConnection('Connection cancelled.')
      return
    }
    const error = onConnect(source, id)
    if (error) {
      setConnectionMessage(`${error} Choose another node, or press Esc.`)
      return
    }
    cancelConnection(`Connected ${source} → ${id}.`)
    onSelectionChange([id])
  }
  const deleteNodes = (ids: string[]) => {
    const deletable = ids.filter(canDelete)
    if (!deletable.length) {
      flash('Circuit inputs and outputs cannot be deleted.')
      return
    }
    cancelConnection()
    onDelete(deletable)
    flash(`Deleted ${deletable.length} node${deletable.length === 1 ? '' : 's'}.`)
  }
  useEffect(() => {
    callbacks.current = { onSelectionChange, onMove, describeNode }
  }, [onSelectionChange, onMove, describeNode])
  useEffect(() => {
    selectedRef.current = new Set(selectedIds)
  }, [selectedIds])
  useEffect(() => () => window.clearTimeout(messageTimer.current), [])
  useEffect(() => {
    if (connectionRef.current.source && !graph.nodes.some((node) => node.id === connectionRef.current.source)) cancelConnection()
    if (hoverRef.current && !graph.nodes.some((node) => node.id === hoverRef.current)) {
      hoverRef.current = undefined
      setHoverId(undefined)
    }
  }, [graph, cancelConnection])
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (isEditable(event.target) || document.querySelector('[role="dialog"]')) return
      const wrap = hostRef.current?.parentElement
      if (event.target !== document.body && !(event.target instanceof Node && wrap?.contains(event.target))) return
      if (event.key === 'Escape') {
        if (connectionRef.current.source) { event.preventDefault(); cancelConnection('Connection cancelled.') }
        else if (joinGuide) { event.preventDefault(); onCancelJoin?.() }
        else if (selectedRef.current.size) { event.preventDefault(); onSelectionChange([]) }
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedRef.current.size) {
        event.preventDefault()
        deleteNodes([...selectedRef.current])
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        onSelectionChange(graph.nodes.map((node) => node.id))
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#08111d')
    const is2D = projection === '2d'
    const shownOf = (position: Vector3) => {
      const point = bookTime
        ? new THREE.Vector3(position.y, position.x, position.z)
        : new THREE.Vector3(position.x, position.y, position.z)
      return point.divideScalar(sceneScale)
    }
    const storedOf = (point: THREE.Vector3, z: number): Vector3 => {
      const across = point.x * sceneScale
      const along = point.y * sceneScale
      return bookTime ? { x: along, y: across, z } : { x: across, y: along, z }
    }
    const positionFor = (node: ZXNode) => {
      const position = shownOf(node.position)
      if (is2D) position.z = 0
      return position
    }
    const bounds = new THREE.Box3().setFromPoints(graph.nodes.map(positionFor))
    const target = graph.nodes.length ? bounds.getCenter(new THREE.Vector3()) : new THREE.Vector3()
    const aspect = host.clientWidth / Math.max(1, host.clientHeight)
    const size = graph.nodes.length ? bounds.getSize(new THREE.Vector3()) : new THREE.Vector3()
    const halfFov = THREE.MathUtils.degToRad(24)
    const distance = Math.max(12, (size.x + 3) / (2 * Math.tan(halfFov) * aspect), (size.y + 3) / (2 * Math.tan(halfFov))) + size.z
    const frustumHeight = Math.max(8, (size.y + 3), (size.x + 3) / aspect)
    scene.fog = new THREE.Fog('#08111d', Math.max(20, distance * 0.75), Math.max(65, distance * 2.5))
    const camera = is2D
      ? new THREE.OrthographicCamera(-frustumHeight / 2, frustumHeight / 2, frustumHeight / 2, -frustumHeight / 2, 0.1, distance * 4)
      : new THREE.PerspectiveCamera(48, 1, 0.1, Math.max(150, distance * 4))
    camera.position.copy(target).add(is2D ? new THREE.Vector3(0, 0, distance) : new THREE.Vector3(distance * 0.12, distance * 0.22, distance))
    camera.lookAt(target)
    const initialTarget = target.clone()
    const initialPosition = camera.position.clone()
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    const navigation = new OrbitControls(camera, renderer.domElement)
    navigation.target.copy(target)
    navigation.enableRotate = !is2D
    // Camera: middle = pan; left = select / move-if-selected / box; Alt+left orbits in 3D.
    navigation.mouseButtons.LEFT = -1 as THREE.MOUSE
    navigation.mouseButtons.MIDDLE = THREE.MOUSE.PAN
    navigation.mouseButtons.RIGHT = -1 as THREE.MOUSE
    navigation.touches.ONE = is2D ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE
    navigation.minDistance = 2
    navigation.maxDistance = distance * 2
    navigation.minZoom = 0.2
    navigation.maxZoom = 8
    const viewKey = `${cameraKey}:${projection}:${bookTime ? 'book' : 'app'}`
    const previousView = savedView.current
    if (previousView?.projection === viewKey) {
      camera.position.copy(previousView.position)
      navigation.target.copy(previousView.target)
      camera.zoom = previousView.zoom
      camera.updateProjectionMatrix()
    }
    navigation.update()
    controls.current = {
      zoom: (factor) => {
        if (camera instanceof THREE.OrthographicCamera) {
          camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, 0.2, 8)
          camera.updateProjectionMatrix()
        } else {
          const offset = camera.position.clone().sub(navigation.target)
          offset.setLength(THREE.MathUtils.clamp(offset.length() / factor, navigation.minDistance, navigation.maxDistance))
          camera.position.copy(navigation.target).add(offset)
        }
        navigation.update()
      },
      reset: () => {
        navigation.target.copy(initialTarget)
        camera.position.copy(initialPosition)
        camera.up.set(0, 1, 0)
        camera.lookAt(target)
        if (camera instanceof THREE.OrthographicCamera) {
          camera.zoom = 1
          camera.updateProjectionMatrix()
        }
        navigation.update()
      },
      pointAt: () => ({ x: 0, y: 0, z: 0 }),
      center: () => ({ x: 0, y: 0, z: 0 }),
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.35
    host.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight('#c9e8ff', 1.6))
    const keyLight = new THREE.PointLight('#9fffe7', 30)
    keyLight.position.set(5, 7, 10)
    scene.add(keyLight)
    const blueLight = new THREE.PointLight('#596cff', 18)
    blueLight.position.set(-8, -2, -8)
    scene.add(blueLight)
    const grid = new THREE.GridHelper(30, 30, '#1a3547', '#142636')
    grid.position.y = -5
    scene.add(grid)

    const nodeMeshes = new Map<string, THREE.Mesh>()
    const nodeHalos = new Map<string, THREE.Mesh>()
    const pickables: THREE.Object3D[] = []
    const edgeObjects: { from: string; to: string; line: THREE.Mesh; pulse?: THREE.Mesh; radius: number; offset: THREE.Vector3 }[] = []
    const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]))
    const previewGeometry = new THREE.BufferGeometry()
    const previewPositions = new THREE.BufferAttribute(new Float32Array(6), 3)
    previewGeometry.setAttribute('position', previewPositions)
    const previewMaterial = new THREE.LineBasicMaterial({ color: '#83f0d7', depthTest: false })
    const preview = new THREE.Line(previewGeometry, previewMaterial)
    preview.frustumCulled = false
    preview.renderOrder = 1
    preview.visible = false
    scene.add(preview)
    const previewPoint = new THREE.Vector3()
    for (const edge of graph.edges) {
      const from = nodeMap.get(edge.source)
      const to = nodeMap.get(edge.target)
      if (!from || !to) continue
      const start = positionFor(from)
      const end = positionFor(to)
      const ordinary = classifyNode(from)?.type === 'measure' || classifyNode(to)?.type === 'measure'
      const direction = end.clone().sub(start)
      const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0)
      if (perpendicular.lengthSq() < 1e-8) perpendicular.set(1, 0, 0)
      perpendicular.setLength(ordinary ? 0.05 : 0)
      const strokes = ordinary ? [perpendicular, perpendicular.clone().negate()] : [new THREE.Vector3()]
      const radius = edge.hadamard ? 0.035 : 0.022
      strokes.forEach((offset, index) => {
        const strokeStart = start.clone().add(offset)
        const strokeEnd = end.clone().add(offset)
        const curve = new THREE.CatmullRomCurve3([strokeStart, strokeStart.clone().lerp(strokeEnd, 0.5).add(new THREE.Vector3(0, 0.16, 0)), strokeEnd])
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 28, radius, 7, false),
          new THREE.MeshStandardMaterial({
            color: edge.hadamard ? '#f8b84e' : '#79a1b9',
            emissive: edge.hadamard ? '#9b5d12' : '#163e54',
            emissiveIntensity: 1.2,
            metalness: 0.35,
            roughness: 0.35,
          }),
        )
        scene.add(tube)
        const pulse = index === 0 ? new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 12, 12),
          new THREE.MeshBasicMaterial({ color: edge.hadamard ? '#ffe39b' : '#a3fff0' }),
        ) : undefined
        if (pulse) scene.add(pulse)
        edgeObjects.push({ from: edge.source, to: edge.target, line: tube, pulse, radius, offset })
      })
    }
    const refreshEdges = () => {
      for (const edge of edgeObjects) {
        const from = nodeMeshes.get(edge.from)?.position
        const to = nodeMeshes.get(edge.to)?.position
        if (!from || !to) continue
        const start = from.clone().add(edge.offset)
        const end = to.clone().add(edge.offset)
        edge.line.geometry.dispose()
        const middle = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.16, 0))
        edge.line.geometry = new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([start.clone(), middle, end.clone()]),
          28,
          edge.radius,
          7,
          false,
        )
      }
    }

    for (const node of graph.nodes) {
      const color = node.kind === 'z' ? '#10b981' : node.kind === 'x' ? '#ef4444' : node.kind === 'hadamard' ? '#f59e0b' : '#9eb5c7'
      const geometry = node.kind === 'hadamard'
        ? new THREE.BoxGeometry(0.65, 0.65, 0.65)
        : new THREE.SphereGeometry(node.kind === 'boundary' ? 0.2 : 0.52, 32, 24)
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.22,
      })
      const mesh = new THREE.Mesh(geometry, material)
      if (node.kind === 'z' || node.kind === 'x') {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.62, 0.045, 8, 24),
          new THREE.MeshStandardMaterial({
            color: node.kind === 'z' ? '#f4fbff' : '#8b97a6',
            emissive: node.kind === 'z' ? '#d7e7f5' : '#4d5660',
            emissiveIntensity: 0.6,
            roughness: 0.35,
          }),
        )
        ring.rotation.x = Math.PI / 2
        mesh.add(ring)
      }
      mesh.position.copy(positionFor(node))
      mesh.userData.nodeId = node.id
      mesh.add(labelSprite(node))
      scene.add(mesh)
      nodeMeshes.set(node.id, mesh)
      pickables.push(mesh)
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(node.kind === 'boundary' ? 0.3 : 0.68, 24, 20),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.BackSide }),
      )
      mesh.add(halo)
      nodeHalos.set(node.id, halo)
    }

    const resize = () => {
      const width = host.clientWidth
      const height = host.clientHeight
      if (!width || !height) return
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = width / height
      } else {
        camera.left = -frustumHeight * width / height / 2
        camera.right = frustumHeight * width / height / 2
        camera.top = frustumHeight / 2
        camera.bottom = -frustumHeight / 2
      }
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const dragPlane = new THREE.Plane()
    const dragPoint = new THREE.Vector3()
    const updatePointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
    }
    const toGraph = (point: THREE.Vector3): Vector3 => storedOf(point, is2D ? 0 : point.z * sceneScale)
    controls.current!.center = () => toGraph(navigation.target)
    controls.current!.pointAt = (clientX, clientY) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), navigation.target)
      const point = new THREE.Vector3()
      return toGraph(raycaster.ray.intersectPlane(plane, point) ? point : navigation.target)
    }
    const movable = (id: string) => {
      const node = nodeMap.get(id)
      return Boolean(node && (node.kind !== 'boundary' || node.custom))
    }
    const screenOf = (mesh: THREE.Object3D) => {
      const point = mesh.position.clone().project(camera)
      return { x: (point.x + 1) * host.clientWidth / 2, y: (1 - point.y) * host.clientHeight / 2, z: point.z }
    }
    const worldRadiusOf = (id: string) => {
      const kind = nodeMap.get(id)?.kind
      if (kind === 'boundary') return 0.2
      if (kind === 'hadamard') return 0.46
      return 0.62
    }
    const cameraRight = new THREE.Vector3()
    const marqueeHits = (mesh: THREE.Object3D, left: number, right: number, top: number, bottom: number) => {
      const screen = screenOf(mesh)
      if (Math.abs(screen.z) > 1) return false
      const radius = worldRadiusOf(mesh.userData.nodeId as string)
      cameraRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
      const edge = mesh.position.clone().addScaledVector(cameraRight, radius).project(camera)
      const edgeX = (edge.x + 1) * host.clientWidth / 2
      const edgeY = (1 - edge.y) * host.clientHeight / 2
      const pixelRadius = Math.max(4, Math.hypot(edgeX - screen.x, edgeY - screen.y))
      const nearestX = Math.min(right, Math.max(left, screen.x))
      const nearestY = Math.min(bottom, Math.max(top, screen.y))
      const dx = screen.x - nearestX
      const dy = screen.y - nearestY
      return dx * dx + dy * dy <= pixelRadius * pixelRadius
    }
    const hostPoint = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }
    let drag: { ids: string[]; start: THREE.Vector3; origins: Map<string, THREE.Vector3>; moved: boolean } | undefined
    let box: { x0: number; y0: number; x1: number; y1: number; additive: boolean; fromNode: boolean } | undefined
    let altOrbit = false
    let panning = false
    // OrbitControls writes an inline cursor on the canvas; set it here so grab/grabbing actually show.
    const setCursor = (cursor: 'default' | 'pointer' | 'crosshair' | 'grab' | 'grabbing' | 'move') => {
      renderer.domElement.style.cursor = cursor
      setCanvasCursor(cursor)
    }
    const idleCursor = () => setCursor(hoverRef.current && !connectionRef.current.source ? 'pointer' : 'default')
    setCursor('default')
    const hitNode = (event: PointerEvent | MouseEvent) => {
      updatePointer(event as PointerEvent)
      return raycaster.intersectObjects(pickables, false)[0]?.object as THREE.Mesh | undefined
    }
    const beginNodeDrag = (event: PointerEvent, hit: THREE.Mesh) => {
      const id = hit.userData.nodeId as string
      if (!movable(id) || !selectedRef.current.has(id)) return false
      navigation.enabled = false
      renderer.domElement.setPointerCapture(event.pointerId)
      const ids = [...selectedRef.current].filter(movable)
      dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), hit.position)
      if (!raycaster.ray.intersectPlane(dragPlane, dragPoint)) return false
      drag = { ids, start: dragPoint.clone(), origins: new Map(ids.map((item) => [item, nodeMeshes.get(item)!.position.clone()])), moved: false }
      setCursor('move')
      return true
    }
    const blockMiddleBrowser = (event: Event) => {
      const button = 'button' in event ? (event as MouseEvent).button : -1
      if (button === 1) event.preventDefault()
    }
    const down = (event: PointerEvent) => {
      if (event.button === 1) {
        event.preventDefault()
        panning = true
        setCursor('grabbing')
        return
      }
      if (event.button === 2) {
        event.preventDefault()
        return
      }
      if (event.button !== 0) return
      if (!is2D && event.altKey) {
        navigation.mouseButtons.LEFT = THREE.MOUSE.ROTATE
        altOrbit = true
        return
      }
      const hit = hitNode(event)
      if (connectionRef.current.source) {
        if (!hit) {
          cancelConnection('Connection cancelled.')
          return
        }
        navigation.enabled = false
        renderer.domElement.setPointerCapture(event.pointerId)
        return
      }
      if (hit) {
        const id = hit.userData.nodeId as string
        const additive = event.ctrlKey || event.metaKey
        if (additive) {
          const next = new Set(selectedRef.current)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          selectedRef.current = next
          callbacks.current.onSelectionChange([...next])
        } else if (selectedRef.current.has(id) && movable(id)) {
          beginNodeDrag(event, hit)
          return
        } else {
          selectedRef.current = new Set([id])
          callbacks.current.onSelectionChange([id])
        }
      }
      navigation.enabled = false
      renderer.domElement.setPointerCapture(event.pointerId)
      const point = hostPoint(event)
      box = { x0: point.x, y0: point.y, x1: point.x, y1: point.y, additive: event.ctrlKey || event.metaKey, fromNode: Boolean(hit) }
      setMarquee({ x0: point.x, y0: point.y, x1: point.x, y1: point.y })
      setCursor('crosshair')
    }
    const move = (event: PointerEvent) => {
      if (panning || (event.buttons & 4)) {
        setCursor('grabbing')
      }
      if (connectionRef.current.source) {
        updatePointer(event)
        const source = nodeMeshes.get(connectionRef.current.source)
        if (source) {
          const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), source.position)
          raycaster.ray.intersectPlane(plane, previewPoint)
        }
      }
      if (drag) {
        updatePointer(event)
        if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
          const delta = dragPoint.clone().sub(drag.start)
          if (delta.lengthSq() > 1e-6) drag.moved = true
          for (const id of drag.ids) nodeMeshes.get(id)?.position.copy(drag.origins.get(id)!).add(delta)
          refreshEdges()
        }
        setCursor('move')
        return
      }
      if (box) {
        const point = hostPoint(event)
        box.x1 = point.x
        box.y1 = point.y
        setMarquee({ x0: box.x0, y0: box.y0, x1: box.x1, y1: box.y1 })
        setCursor('crosshair')
        return
      }
      if (event.buttons) return
      const hovered = hitNode(event)?.userData.nodeId as string | undefined
      if (hovered !== hoverRef.current) {
        hoverRef.current = hovered
        setHoverId(hovered)
      }
      if (!panning && !altOrbit) setCursor(hovered && !connectionRef.current.source ? 'pointer' : 'default')
    }
    const up = (event: PointerEvent) => {
      if (altOrbit) {
        navigation.mouseButtons.LEFT = -1 as THREE.MOUSE
        altOrbit = false
      }
      if (panning || event.button === 1) {
        panning = false
        idleCursor()
      }
      if (drag?.moved) {
        const moves: Record<string, Vector3> = {}
        for (const id of drag.ids) {
          const position = nodeMeshes.get(id)!.position
          const originalZ = nodeMap.get(id)?.position.z ?? position.z * sceneScale
          moves[id] = storedOf(position, is2D ? originalZ : position.z * sceneScale)
        }
        callbacks.current.onMove(moves)
      }
      if (box) {
        const left = Math.min(box.x0, box.x1)
        const right = Math.max(box.x0, box.x1)
        const top = Math.min(box.y0, box.y1)
        const bottom = Math.max(box.y0, box.y1)
        if (right - left > 4 || bottom - top > 4) {
          const inside = [...nodeMeshes]
            .filter(([, mesh]) => marqueeHits(mesh, left, right, top, bottom))
            .map(([id]) => id)
          const next = box.additive ? [...new Set([...selectedRef.current, ...inside])] : inside
          selectedRef.current = new Set(next)
          callbacks.current.onSelectionChange(next)
        } else if (!box.fromNode && !box.additive) {
          selectedRef.current = new Set()
          callbacks.current.onSelectionChange([])
        }
        setMarquee(undefined)
      }
      drag = undefined
      box = undefined
      navigation.enabled = true
      if (!panning) idleCursor()
    }
    const doubleClick = (event: MouseEvent) => {
      const hit = hitNode(event)
      if (!hit) return
      startConnection(hit.userData.nodeId as string)
    }
    const leave = () => {
      if (hoverRef.current) {
        hoverRef.current = undefined
        setHoverId(undefined)
      }
      if (!drag && !box && !panning) setCursor('default')
    }
    const contextMenu = (event: Event) => event.preventDefault()
    renderer.domElement.addEventListener('pointerdown', down, { capture: true })
    renderer.domElement.addEventListener('pointermove', move)
    renderer.domElement.addEventListener('pointerup', up)
    renderer.domElement.addEventListener('pointercancel', up)
    renderer.domElement.addEventListener('pointerleave', leave)
    renderer.domElement.addEventListener('dblclick', doubleClick)
    renderer.domElement.addEventListener('contextmenu', contextMenu)
    renderer.domElement.addEventListener('mousedown', blockMiddleBrowser, { capture: true })
    renderer.domElement.addEventListener('auxclick', blockMiddleBrowser)

    const clock = new THREE.Clock()
    let frame = 0
    const render = () => {
      frame = requestAnimationFrame(render)
      const time = clock.getElapsedTime()
      for (const [index, edge] of edgeObjects.entries()) {
        const from = nodeMeshes.get(edge.from)?.position
        const to = nodeMeshes.get(edge.to)?.position
        if (!from || !to || !edge.pulse) continue
        edge.pulse.position.lerpVectors(from.clone().add(edge.offset), to.clone().add(edge.offset), (time * 0.35 + index * 0.21) % 1)
      }
      const connection = connectionRef.current
      const screenNodes = new Map<string, { x: number; y: number; z: number }>()
      for (const [id, mesh] of nodeMeshes) screenNodes.set(id, screenOf(mesh))
      for (const [id, mesh] of nodeMeshes) {
        const selected = selectedRef.current.has(id)
        const source = connection.source === id
        const hovered = hoverRef.current === id
        ;(mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = selected || source ? 1.8 : hovered ? 1.3 : 0.85
        ;(nodeHalos.get(id)!.material as THREE.MeshBasicMaterial).opacity = source ? 0.4 : selected ? 0.26 : hovered ? 0.12 : 0
        const handle = nodeHandles.current.get(id)
        if (handle) {
          const screen = screenNodes.get(id)!
          let diameter = 40
          if (connection.source) {
            for (const [otherId, other] of screenNodes) {
              if (otherId !== id) diameter = Math.min(diameter, Math.hypot(other.x - screen.x, other.y - screen.y) * 1.7)
            }
          }
          handle.style.width = handle.style.height = `${Math.max(22, diameter)}px`
          handle.style.left = `${screen.x}px`
          handle.style.top = `${screen.y}px`
          handle.style.visibility = screen.x >= 0 && screen.x <= host.clientWidth && screen.y >= 0 && screen.y <= host.clientHeight && Math.abs(screen.z) <= 1 ? 'visible' : 'hidden'
          handle.style.zIndex = `${Math.round((1 - screen.z) * 100000)}`
        }
      }
      const anchor = connection.source ? screenNodes.get(connection.source) : undefined
      if (actionMenu.current && anchor) {
        actionMenu.current.style.left = `${anchor.x}px`
        actionMenu.current.style.top = `${anchor.y}px`
      }
      const hoverAnchor = hoverRef.current ? screenNodes.get(hoverRef.current) : undefined
      if (hoverTip.current && hoverAnchor) {
        hoverTip.current.style.left = `${Math.min(Math.max(hoverAnchor.x, 130), host.clientWidth - 130)}px`
        hoverTip.current.style.top = `${hoverAnchor.y}px`
        hoverTip.current.classList.toggle('below', hoverAnchor.y < 130)
      }
      const start = connection.source ? nodeMeshes.get(connection.source)?.position : undefined
      preview.visible = Boolean(start)
      if (preview.visible && start) {
        const end = (connection.hover ? nodeMeshes.get(connection.hover)?.position : undefined) ?? previewPoint
        previewPositions.setXYZ(0, start.x, start.y, start.z)
        previewPositions.setXYZ(1, end.x, end.y, end.z)
        previewPositions.needsUpdate = true
        const invalid = connection.hover && connectionError(graph, connection.source!, connection.hover)
        previewMaterial.color.set(invalid ? '#ff9aaa' : '#83f0d7')
      }
      renderer.render(scene, camera)
    }
    previewPoint.copy(connectionRef.current.source ? nodeMeshes.get(connectionRef.current.source)?.position ?? previewPoint : previewPoint)
    render()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      savedView.current = { projection: viewKey, position: camera.position.clone(), target: navigation.target.clone(), zoom: camera.zoom }
      navigation.dispose()
      renderer.domElement.removeEventListener('pointerdown', down, { capture: true })
      renderer.domElement.removeEventListener('pointermove', move)
      renderer.domElement.removeEventListener('pointerup', up)
      renderer.domElement.removeEventListener('pointercancel', up)
      renderer.domElement.removeEventListener('pointerleave', leave)
      renderer.domElement.removeEventListener('dblclick', doubleClick)
      renderer.domElement.removeEventListener('contextmenu', contextMenu)
      renderer.domElement.removeEventListener('mousedown', blockMiddleBrowser, { capture: true })
      renderer.domElement.removeEventListener('auxclick', blockMiddleBrowser)
      controls.current = null
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          for (const material of materials) {
            if ('map' in material && material.map) material.map.dispose()
            material.dispose()
          }
        } else if (object instanceof THREE.Sprite) {
          object.material.map?.dispose()
          object.material.dispose()
        }
      })
      renderer.forceContextLoss()
      renderer.dispose()
      previewGeometry.dispose()
      previewMaterial.dispose()
      host.removeChild(renderer.domElement)
    }
  }, [graph, projection, bookTime, cameraKey, cancelConnection, startConnection])

  useEffect(() => {
    if (!apiRef) return
    apiRef.current = {
      centerPoint: () => controls.current?.center() ?? { x: 0, y: 0, z: 0 },
      startConnection,
    }
    return () => { apiRef.current = null }
  }, [apiRef, startConnection])

  const hoverNode = hoverId && !connecting ? graph.nodes.find((node) => node.id === hoverId) : undefined
  const [hoverTitle, ...hoverBody] = hoverNode ? describeNode(hoverNode).split('\n') : []
  const sourceDeletable = connectionSource ? canDelete(connectionSource) : false

  return <div
      className={`spider-canvas-wrap ${className}`}
      onDragOver={(event) => {
        if (!onDropElement || !event.dataTransfer.types.includes(pictureElementMime)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setDropActive(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropActive(false)
      }}
      onDrop={(event) => {
        setDropActive(false)
        const elementId = event.dataTransfer.getData(pictureElementMime)
        if (!onDropElement || !controls.current || !isPictureElementId(elementId)) return
        event.preventDefault()
        cancelConnection()
        onDropElement(elementId, controls.current.pointAt(event.clientX, event.clientY))
      }}
    >
    <div
      ref={hostRef}
      data-tour="canvas"
      className={`spider-3d-canvas cursor-${canvasCursor} ${dropActive ? 'drop-active' : ''}`}
      aria-label={`Interactive ${projection} ZX spider graph`}
    />
    <div className={`canvas-node-handles ${connecting ? 'connecting' : ''} ${joining ? 'joining' : ''}`} aria-label="Canvas nodes">
      {graph.nodes.map((node) => {
        const error = connectionSource && connectionSource !== node.id ? connectionError(graph, connectionSource, node.id) : undefined
        const joinable = joining && joinIds.has(node.id)
        const selected = selectedIds.includes(node.id)
        return <button
          key={node.id}
          ref={(button) => { if (button) nodeHandles.current.set(node.id, button); else nodeHandles.current.delete(node.id) }}
          type="button"
          className={`canvas-node-handle ${connectionSource === node.id ? 'source' : error ? 'invalid' : ''} ${joinable ? 'join' : ''} ${selected ? 'selected' : ''}`}
          data-node-id={node.id}
          aria-label={connectionSource ? `${connectionSource === node.id ? 'Cancel connection from' : 'Connect to'} ${node.id}` : joinable ? `Join at ${node.id}` : `Select ${node.id}`}
          aria-pressed={connectionSource ? connectionSource === node.id : selected}
          data-tip={`${describeNode(node)}${error ? `\n⚠ ${error}` : ''}${joinable ? '\nClick to place the symbol and connect it here.' : ''}`}
          onPointerEnter={() => { connectionRef.current.hover = node.id }}
          onPointerLeave={() => { connectionRef.current.hover = undefined }}
          onFocus={() => { connectionRef.current.hover = node.id }}
          onBlur={() => { connectionRef.current.hover = undefined }}
          onClick={() => { if (joinable) { onJoinNode?.(node.id); return } chooseConnectionNode(node.id) }}
          onKeyDown={(event) => {
            if (event.key === 'c' && !connectionSource) { event.preventDefault(); startConnection(node.id) }
          }}
        ><span className="sr-only">{node.id}</span></button>
      })}
    </div>
    {connectionSource && <div className="canvas-node-actions" ref={actionMenu} role="toolbar" aria-label={`Actions for ${connectionSource}`}>
      {sourceDeletable && <button type="button" className="node-delete" aria-label={`Delete ${connectionSource}`} data-tip={'Delete node\nRemoves this node. Circuit spiders remove their gate from the code and gate view.'} onClick={() => deleteNodes([connectionSource])}>×</button>}
    </div>}
    {hoverNode && <div className="canvas-hover-tip" ref={hoverTip} role="tooltip"><b>{hoverTitle}</b>{hoverBody.map((line, index) => <span key={index}>{line}</span>)}</div>}
    {marquee && <div className="canvas-marquee" style={{ left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1), width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0) }} />}
    <div className="canvas-toolbar" data-tour="canvas-toolbar" aria-label="Graph canvas controls">
      <button type="button" aria-label="Select all nodes" data-tip={'Select all\nSelects every node so you can move or delete them together. Shortcut: Ctrl/⌘ + A.'} onClick={() => onSelectionChange(graph.nodes.map((node) => node.id))}>All</button>
      {(connecting || joining) && <button type="button" aria-label={connecting ? 'Cancel connection' : 'Cancel join'} onClick={() => connecting ? cancelConnection('Connection cancelled.') : onCancelJoin?.()}>Cancel</button>}
      <span />
      <button type="button" aria-label="Zoom in" data-tip="Zoom in" onClick={() => controls.current?.zoom(1.2)}>+</button>
      <button type="button" aria-label="Zoom out" data-tip="Zoom out" onClick={() => controls.current?.zoom(1 / 1.2)}>−</button>
      <button type="button" aria-label="Reset camera" data-tip="Reset camera" onClick={() => controls.current?.reset()}>⌂</button>
      <button type="button" aria-label={bookTime ? 'Time upward. Switch to left to right' : 'Time left to right. Switch to upward'} aria-pressed={bookTime} data-tip={bookTime ? 'Book orientation\nTime runs upward. Switching back keeps the stored diagram, only the view changes.' : 'App orientation\nTime runs left to right. The book runs time upward; this button shows that view.'} onClick={() => { cancelConnection(); setBookTime((current) => !current) }}>{bookTime ? '↑' : '→'}</button>
      <button type="button" aria-label={projection === '3d' ? 'Switch to 2D view' : 'Switch to 3D view'} data-tip={projection === '3d' ? 'Flat 2D view\nOrthographic layout, easier for selecting and wiring.' : '3D view\nMiddle-drag pans. Alt + left-drag orbits. Left-drag a selected spider to move it.'} onClick={() => { cancelConnection(); setProjection((current) => current === '3d' ? '2d' : '3d') }}>
        {projection === '3d' ? '2D' : '3D'}
      </button>
    </div>
    {(connectionMessage || joinGuide) && <div className="canvas-connection-status" role="status">{connectionMessage || joinGuide}{connecting && <span>Palette wires are included in ZX JSON, not OpenQASM.</span>}{!connectionMessage && joining && <span>{joinNodeIds.length ? `${joinNodeIds.length} highlighted ${joinNodeIds.length === 1 ? 'node accepts' : 'nodes accept'} this symbol.` : 'No node on this diagram accepts this symbol yet.'}</span>}</div>}
    <div className="canvas-hint">{connecting ? 'CLICK A NODE TO CONNECT · × DELETES · ESC CANCELS' : joining ? 'CLICK A HIGHLIGHTED NODE TO PLACE AND CONNECT · ESC CANCELS' : `CLICK TO SELECT · LEFT-DRAG SELECTED TO MOVE · LEFT-DRAG EMPTY TO BOX-SELECT · MIDDLE-DRAG PAN${projection === '3d' ? ' · ALT+LEFT ORBIT' : ''} · ${bookTime ? 'TIME UP' : 'TIME TO THE RIGHT'} · DOUBLE-CLICK NODE TO CONNECT OR DELETE · DEL REMOVES SELECTION`}</div>
  </div>
}
