import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { ZXGraph3D, ZXNode, Vector3 } from '../../types/zx'

interface Spider3DCanvasViewProps {
  graph: ZXGraph3D
  selectedId?: string
  onSelect: (id: string) => void
  onMove: (id: string, position: Vector3) => void
  className?: string
}

const asVector = (position: Vector3) => new THREE.Vector3(position.x, position.y, position.z)

function labelSprite(node: ZXNode) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const context = canvas.getContext('2d')!
  context.font = 'bold 30px monospace'
  context.textAlign = 'center'
  context.shadowColor = '#72ffe1'
  context.shadowBlur = 12
  context.fillStyle = '#f4fbff'
  const text = node.kind === 'boundary' ? node.label ?? '' : `${node.phase}`
  context.fillText(text, 128, 58)
  const texture = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
  sprite.scale.set(1.45, 0.54, 1)
  sprite.position.y = node.kind === 'boundary' ? 0.62 : 0.82
  return sprite
}

export function Spider3DCanvasView({ graph, selectedId, onSelect, onMove, className = '' }: Spider3DCanvasViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const callbacks = useRef({ onSelect, onMove })
  callbacks.current = { onSelect, onMove }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#08111d')
    scene.fog = new THREE.Fog('#08111d', 20, 65)
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 150)
    const target = new THREE.Vector3()
    const initial = graph.nodes.length ? asVector(graph.nodes[0].position) : new THREE.Vector3()
    camera.position.set(initial.x + 3, initial.y + 5, initial.z + 15)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
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
    const pickables: THREE.Object3D[] = []
    const edgeObjects: { from: string; to: string; line: THREE.Mesh; pulse: THREE.Mesh }[] = []
    const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]))
    for (const edge of graph.edges) {
      const from = nodeMap.get(edge.source)
      const to = nodeMap.get(edge.target)
      if (!from || !to) continue
      const start = asVector(from.position)
      const end = asVector(to.position)
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
      edgeObjects.push({ from: edge.source, to: edge.target, line: tube, pulse })
    }

    for (const node of graph.nodes) {
      const color = node.kind === 'z' ? '#10b981' : node.kind === 'x' ? '#ef4444' : node.kind === 'hadamard' ? '#f59e0b' : '#9eb5c7'
      const geometry = node.kind === 'hadamard'
        ? new THREE.BoxGeometry(0.65, 0.65, 0.65)
        : new THREE.SphereGeometry(node.kind === 'boundary' ? 0.2 : 0.52, 32, 24)
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: selectedId === node.id ? 1.8 : 0.85,
        roughness: 0.2,
        metalness: 0.22,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.copy(asVector(node.position))
      mesh.userData.nodeId = node.id
      mesh.add(labelSprite(node))
      scene.add(mesh)
      nodeMeshes.set(node.id, mesh)
      pickables.push(mesh)
      if (selectedId === node.id) {
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(node.kind === 'boundary' ? 0.3 : 0.68, 24, 20),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.BackSide }),
        )
        mesh.add(halo)
      }
    }

    const resize = () => {
      const width = host.clientWidth
      const height = host.clientHeight
      if (!width || !height) return
      camera.aspect = width / height
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
    let orbiting = false
    let panning = false
    let previous = { x: 0, y: 0 }
    const spherical = new THREE.Spherical()
    const updatePointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
    }
    const down = (event: PointerEvent) => {
      updatePointer(event)
      previous = { x: event.clientX, y: event.clientY }
      const hit = raycaster.intersectObjects(pickables, false)[0]?.object as THREE.Mesh | undefined
      if (hit) {
        const id = hit.userData.nodeId as string
        callbacks.current.onSelect(id)
        if (nodeMap.get(id)?.kind !== 'boundary') {
          dragging = hit
          dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), hit.position)
          raycaster.ray.intersectPlane(dragPlane, dragPoint)
          dragOffset.copy(hit.position).sub(dragPoint)
        }
      } else if (event.button === 2 || event.button === 1) {
        panning = true
      } else {
        orbiting = true
      }
      renderer.domElement.setPointerCapture(event.pointerId)
    }
    const move = (event: PointerEvent) => {
      if (!dragging && !orbiting && !panning) return
      const dx = event.clientX - previous.x
      const dy = event.clientY - previous.y
      previous = { x: event.clientX, y: event.clientY }
      if (dragging) {
        updatePointer(event)
        if (raycaster.ray.intersectPlane(dragPlane, dragPoint)) dragging.position.copy(dragPoint.add(dragOffset))
      } else if (orbiting) {
        spherical.setFromVector3(camera.position.clone().sub(target))
        spherical.theta -= dx * 0.006
        spherical.phi = THREE.MathUtils.clamp(spherical.phi + dy * 0.006, 0.12, Math.PI - 0.12)
        camera.position.setFromSpherical(spherical).add(target)
        camera.lookAt(target)
      } else {
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0)
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1)
        target.addScaledVector(right, -dx * 0.012).addScaledVector(up, dy * 0.012)
        camera.position.addScaledVector(right, -dx * 0.012).addScaledVector(up, dy * 0.012)
      }
    }
    const up = () => {
      if (dragging) {
        const nodeId = dragging.userData.nodeId as string
        const position = dragging.position
        callbacks.current.onMove(nodeId, { x: position.x, y: position.y, z: position.z })
      }
      dragging = undefined
      orbiting = false
      panning = false
    }
    const wheel = (event: WheelEvent) => {
      camera.position.sub(target).multiplyScalar(event.deltaY > 0 ? 1.08 : 0.92).add(target)
    }
    const doubleClick = (event: MouseEvent) => {
      updatePointer(event as PointerEvent)
      const hit = raycaster.intersectObjects(pickables, false)[0]?.object as THREE.Mesh | undefined
      if (!hit) return
      target.copy(hit.position)
      camera.lookAt(target)
    }
    const contextMenu = (event: Event) => event.preventDefault()
    renderer.domElement.addEventListener('pointerdown', down)
    renderer.domElement.addEventListener('pointermove', move)
    renderer.domElement.addEventListener('pointerup', up)
    renderer.domElement.addEventListener('pointercancel', up)
    renderer.domElement.addEventListener('wheel', wheel, { passive: true })
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
      renderer.render(scene, camera)
    }
    render()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', down)
      renderer.domElement.removeEventListener('pointermove', move)
      renderer.domElement.removeEventListener('pointerup', up)
      renderer.domElement.removeEventListener('pointercancel', up)
      renderer.domElement.removeEventListener('wheel', wheel)
      renderer.domElement.removeEventListener('dblclick', doubleClick)
      renderer.domElement.removeEventListener('contextmenu', contextMenu)
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          for (const material of materials) {
            if ('map' in material && material.map) material.map.dispose()
            material.dispose()
          }
        }
      })
      renderer.dispose()
      host.removeChild(renderer.domElement)
    }
  }, [graph, selectedId])

  return <div ref={hostRef} className={`spider-3d-canvas ${className}`} aria-label="Interactive 3D ZX spider graph" />
}
