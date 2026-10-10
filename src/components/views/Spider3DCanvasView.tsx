import { useEffect, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { isPictureElementId, pictureElementMime, type PictureElementId } from '../../lib/zx-core/pictureElements'
import type { ZXGraph3D, ZXNode, Vector3 } from '../../types/zx'

export interface SpiderCanvasApi {
  centerPoint: () => Vector3
}

interface Spider3DCanvasViewProps {
  graph: ZXGraph3D
  selectedId?: string
  onSelect: (id: string) => void
  onMove: (id: string, position: Vector3) => void
  onDropElement?: (elementId: PictureElementId, position: Vector3) => void
  apiRef?: RefObject<SpiderCanvasApi | null>
  className?: string
}

const sceneScale = 60
const asVector = (position: Vector3) => new THREE.Vector3(position.x, position.y, position.z).divideScalar(sceneScale)

function labelSprite(node: ZXNode) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const context = canvas.getContext('2d')!
  context.font = 'bold 48px monospace'
  context.textAlign = 'center'
  context.shadowColor = '#72ffe1'
  context.shadowBlur = 12
  context.fillStyle = '#f4fbff'
  const text = node.kind === 'boundary' ? node.label ?? '' : `${node.phase}`
  context.fillText(text, 128, 58)
  const texture = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
  sprite.scale.set(2.2, 0.82, 1)
  sprite.position.y = node.kind === 'boundary' ? 0.62 : 0.82
  return sprite
}

export function Spider3DCanvasView({ graph, selectedId, onSelect, onMove, onDropElement, apiRef, className = '' }: Spider3DCanvasViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const callbacks = useRef({ onSelect, onMove })
  const controls = useRef<{ zoom: (factor: number) => void; reset: () => void; pointAt: (clientX: number, clientY: number) => Vector3; center: () => Vector3 } | null>(null)
  const selectedRef = useRef(selectedId)
  const savedView = useRef<{ projection: string; position: THREE.Vector3; target: THREE.Vector3; zoom: number } | null>(null)
  const [projection, setProjection] = useState<'3d' | '2d'>('3d')
  const [dropActive, setDropActive] = useState(false)
  useEffect(() => {
    callbacks.current = { onSelect, onMove }
  }, [onSelect, onMove])
  useEffect(() => {
    selectedRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#08111d')
    const is2D = projection === '2d'
    const positionFor = (node: ZXNode) => {
      const position = asVector(node.position)
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
    navigation.mouseButtons.LEFT = is2D ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE
    navigation.touches.ONE = is2D ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE
    navigation.minDistance = 2
    navigation.maxDistance = distance * 2
    navigation.minZoom = 0.2
    navigation.maxZoom = 8
    const previousView = savedView.current
    if (previousView?.projection === projection) {
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
    const edgeObjects: { from: string; to: string; line: THREE.Mesh; pulse: THREE.Mesh; radius: number }[] = []
    const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]))
    for (const edge of graph.edges) {
      const from = nodeMap.get(edge.source)
      const to = nodeMap.get(edge.target)
      if (!from || !to) continue
      const start = positionFor(from)
      const end = positionFor(to)
      const curve = new THREE.CatmullRomCurve3([start, start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.16, 0)), end])
      const radius = edge.hadamard ? 0.035 : 0.022
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
      const pulse = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 12, 12),
        new THREE.MeshBasicMaterial({ color: edge.hadamard ? '#ffe39b' : '#a3fff0' }),
      )
      scene.add(pulse)
      edgeObjects.push({ from: edge.source, to: edge.target, line: tube, pulse, radius })
    }
    const refreshEdges = () => {
      for (const edge of edgeObjects) {
        const start = nodeMeshes.get(edge.from)?.position
        const end = nodeMeshes.get(edge.to)?.position
        if (!start || !end) continue
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
    const dragOffset = new THREE.Vector3()
    const dragPoint = new THREE.Vector3()
    let dragging: THREE.Mesh | undefined
    const updatePointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
    }
    const toGraph = (point: THREE.Vector3): Vector3 => ({ x: point.x * sceneScale, y: point.y * sceneScale, z: is2D ? 0 : point.z * sceneScale })
    controls.current!.center = () => toGraph(navigation.target)
    controls.current!.pointAt = (clientX, clientY) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), navigation.target)
      const point = new THREE.Vector3()
      return toGraph(raycaster.ray.intersectPlane(plane, point) ? point : navigation.target)
    }
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey) return
      updatePointer(event)
      const hit = raycaster.intersectObjects(pickables, false)[0]?.object as THREE.Mesh | undefined
      if (hit) {
        navigation.enabled = false
        const id = hit.userData.nodeId as string
        callbacks.current.onSelect(id)
        const node = nodeMap.get(id)
        if (node && (node.kind !== 'boundary' || node.custom)) {
          dragging = hit
          dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), hit.position)
          raycaster.ray.intersectPlane(dragPlane, dragPoint)
          dragOffset.copy(hit.position).sub(dragPoint)
        }
        renderer.domElement.setPointerCapture(event.pointerId)
      }
    }
    const move = (event: PointerEvent) => {
      if (dragging) {
        updatePointer(event)
        if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) {
          dragging.position.copy(dragPoint.add(dragOffset))
          refreshEdges()
        }
      }
    }
    const up = () => {
      if (dragging) {
        const nodeId = dragging.userData.nodeId as string
        const position = dragging.position
        const originalZ = nodeMap.get(nodeId)?.position.z ?? position.z * sceneScale
        callbacks.current.onMove(nodeId, { x: position.x * sceneScale, y: position.y * sceneScale, z: is2D ? originalZ : position.z * sceneScale })
      }
      dragging = undefined
      navigation.enabled = true
    }
    const doubleClick = (event: MouseEvent) => {
      updatePointer(event as PointerEvent)
      const hit = raycaster.intersectObjects(pickables, false)[0]?.object as THREE.Mesh | undefined
      if (!hit) return
      const offset = camera.position.clone().sub(navigation.target)
      navigation.target.copy(hit.position)
      camera.position.copy(hit.position).add(offset)
      navigation.update()
    }
    const contextMenu = (event: Event) => event.preventDefault()
    renderer.domElement.addEventListener('pointerdown', down, { capture: true })
    renderer.domElement.addEventListener('pointermove', move)
    renderer.domElement.addEventListener('pointerup', up)
    renderer.domElement.addEventListener('pointercancel', up)
    renderer.domElement.addEventListener('dblclick', doubleClick)
    renderer.domElement.addEventListener('contextmenu', contextMenu)

    const clock = new THREE.Clock()
    let frame = 0
    const render = () => {
      frame = requestAnimationFrame(render)
      const time = clock.getElapsedTime()
      for (const [index, edge] of edgeObjects.entries()) {
        const start = nodeMeshes.get(edge.from)?.position
        const end = nodeMeshes.get(edge.to)?.position
        if (!start || !end) continue
        edge.pulse.position.lerpVectors(start, end, (time * 0.35 + index * 0.21) % 1)
      }
      for (const [id, mesh] of nodeMeshes) {
        const selected = selectedRef.current === id
        ;(mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = selected ? 1.8 : 0.85
        ;(nodeHalos.get(id)!.material as THREE.MeshBasicMaterial).opacity = selected ? 0.22 : 0
      }
      renderer.render(scene, camera)
    }
    render()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      savedView.current = { projection, position: camera.position.clone(), target: navigation.target.clone(), zoom: camera.zoom }
      navigation.dispose()
      renderer.domElement.removeEventListener('pointerdown', down, { capture: true })
      renderer.domElement.removeEventListener('pointermove', move)
      renderer.domElement.removeEventListener('pointerup', up)
      renderer.domElement.removeEventListener('pointercancel', up)
      renderer.domElement.removeEventListener('dblclick', doubleClick)
      renderer.domElement.removeEventListener('contextmenu', contextMenu)
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
      renderer.dispose()
      host.removeChild(renderer.domElement)
    }
  }, [graph, projection])

  useEffect(() => {
    if (!apiRef) return
    apiRef.current = { centerPoint: () => controls.current?.center() ?? { x: 0, y: 0, z: 0 } }
    return () => { apiRef.current = null }
  }, [apiRef])

  return <div className={`spider-canvas-wrap ${className}`}>
    <div
      ref={hostRef}
      className={`spider-3d-canvas ${dropActive ? 'drop-active' : ''}`}
      aria-label={`Interactive ${projection} ZX spider graph`}
      onDragOver={(event) => {
        if (!onDropElement || !event.dataTransfer.types.includes(pictureElementMime)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setDropActive(true)
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={(event) => {
        setDropActive(false)
        const elementId = event.dataTransfer.getData(pictureElementMime)
        if (!onDropElement || !controls.current || !isPictureElementId(elementId)) return
        event.preventDefault()
        onDropElement(elementId, controls.current.pointAt(event.clientX, event.clientY))
      }}
    />
    <div className="canvas-toolbar" aria-label="Graph canvas controls">
      <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => controls.current?.zoom(1.2)}>+</button>
      <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => controls.current?.zoom(1 / 1.2)}>−</button>
      <span />
      <button type="button" aria-label="Reset camera" title="Reset camera" onClick={() => controls.current?.reset()}>⌂</button>
      <button type="button" aria-label={projection === '3d' ? 'Switch to 2D view' : 'Switch to 3D view'} aria-pressed={projection === '2d'} onClick={() => setProjection((current) => current === '3d' ? '2d' : '3d')}>
        {projection === '3d' ? '2D' : '3D'}
      </button>
    </div>
    <div className="canvas-hint">{projection === '3d' ? 'DRAG ORBIT · SHIFT/RIGHT-DRAG PAN' : 'DRAG PAN'} · SCROLL/PINCH ZOOM · DOUBLE-CLICK FOCUS</div>
  </div>
}
