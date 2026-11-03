import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { useI18n } from './i18n';
import type { Agent } from './model';

type Point = [number, number, number];
const palette = { cream: '#fff6e6', wall: '#eadbca', trim: '#e0c9b0', wood: '#e6c299', lavender: '#c5b6e7', mint: '#b8d8c7', peach: '#efbcaa', ink: '#57506a', sky: '#c5e2e4' };
// Four gentle light bands give the room a little illustrated, toy-like depth.
const ramp = new THREE.DataTexture(new Uint8Array([145, 190, 225, 255]), 4, 1, THREE.RedFormat);
ramp.minFilter = THREE.NearestFilter;
ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;
function Paint({ color }: { color: string }) { return <meshToonMaterial color={color} gradientMap={ramp} />; }
function Block({ at, size, color, radius = .08 }: { at: Point; size: Point; color: string; radius?: number }) {
 const geometry = useMemo(() => new RoundedBoxGeometry(...size, 3, Math.min(radius, ...size.map(n => n / 2))), [size[0], size[1], size[2], radius]);
 useEffect(() => () => geometry.dispose(), [geometry]);
 return <mesh position={at} geometry={geometry} castShadow receiveShadow><Paint color={color} /></mesh>;
}
function Ball({ at, size, color }: { at: Point; size: Point; color: string }) { return <mesh position={at} scale={size} castShadow><sphereGeometry args={[1, 20, 14]} /><Paint color={color} /></mesh>; }
function Plant({ at }: { at: Point }) { return <group position={at}>
 <mesh position={[0, .2, 0]} castShadow><cylinderGeometry args={[.23, .17, .4, 24]} /><Paint color={palette.peach} /></mesh>
 <Block at={[0, .55, 0]} size={[.045, .6, .045]} color="#86a68b" radius={.02} />
 <group rotation={[0, 0, -.5]}><Ball at={[-.16, .58, 0]} size={[.23, .38, .13]} color="#a6c9a8" /></group>
 <group rotation={[0, .7, .5]}><Ball at={[.16, .55, 0]} size={[.22, .34, .12]} color="#91ba9e" /></group>
 <Ball at={[0, .88, 0]} size={[.16, .28, .14]} color="#bed7ae" />
 </group>; }
function Avatar({ agent, select }: { agent: Agent; select: () => void }) {
 const group = useRef<THREE.Group>(null);
 const [hover, setHover] = useState(false);
 const color = agent.active ? agent.color : '#c1c0c6';
 useEffect(() => () => { document.body.style.cursor = 'auto'; }, []);
 useFrame(({ clock }) => { if (group.current) { group.current.position.y = 1.13 + Math.sin(clock.elapsedTime * 1.6) * .035; group.current.scale.lerp(new THREE.Vector3(hover ? 1.12 : 1, hover ? 1.12 : 1, hover ? 1.12 : 1), .12); } });
 return <group ref={group} position={[0, 1.13, .82]} onClick={e => { e.stopPropagation(); select(); }} onPointerOver={e => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}>
 {agent.avatar === 'orb' ? <Ball at={[0, 0, 0]} size={[.32, .32, .29]} color={color} /> : <>
 <Block at={[0, -.34, 0]} size={[.35, .35, .27]} color={palette.cream} radius={.14} />
 {agent.avatar === 'capsule' ? <Ball at={[0, .01, 0]} size={[.31, .37, .27]} color={color} /> : <Block at={[0, .015, 0]} size={[.65, .5, .45]} color={color} radius={.17} />}
 {[-1, 1].map(side => <group key={side}><Ball at={[side * .36, .01, 0]} size={[.065, .1, .09]} color={color} /><Ball at={[side * .25, -.32, .015]} size={[.09, .17, .1]} color={color} /></group>)}
 <Block at={[0, .32, 0]} size={[.035, .17, .035]} color={palette.ink} radius={.01} /><Ball at={[0, .42, 0]} size={[.07, .07, .07]} color={palette.peach} />
 </>}
 <Block at={[0, .015, .23]} size={[.45, .24, .075]} color="#fff9ef" radius={.09} />
 {[-1, 1].map(side => <group key={side}><Ball at={[side * .105, .04, .278]} size={[.027, .045, .015]} color={palette.ink} /><Ball at={[side * .16, -.025, .275]} size={[.037, .021, .009]} color="#f0b1ad" /></group>)}
 <mesh position={[0, -.018, .278]} rotation={[0, 0, Math.PI]}><torusGeometry args={[.042, .012, 6, 16, Math.PI]} /><Paint color={palette.ink} /></mesh>
 {hover && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.85, 0]}><ringGeometry args={[.46, .5, 40]} /><meshBasicMaterial color={agent.color} /></mesh>}
 </group>;
}
function Desk({ agent, at, select }: { agent: Agent; at: Point; select: () => void }) { return <group position={at}>
 <Block at={[0, .71, 0]} size={[1.75, .15, .92]} color={palette.wood} radius={.075} />
 {[-.65, .65].map(x => <Block key={x} at={[x, .36, 0]} size={[.13, .7, .57]} color={palette.cream} radius={.06} />)}
 <Block at={[0, 1.13, -.24]} size={[.76, .52, .11]} color={palette.cream} radius={.065} />
 <Block at={[0, 1.14, -.175]} size={[.64, .39, .025]} color={agent.active ? agent.color : '#c1c0c6'} radius={.012} />
 <Block at={[-.09, 1.19, -.157]} size={[.29, .035, .01]} color="#ffffff" radius={.005} />
 <Block at={[-.13, 1.1, -.157]} size={[.21, .025, .01]} color="#ffffff" radius={.005} />
 <Block at={[0, .87, -.24]} size={[.07, .19, .06]} color={palette.cream} radius={.025} />
 <Block at={[0, .805, .13]} size={[.44, .035, .18]} color={palette.cream} radius={.017} />
 <mesh position={[.58, .86, .08]} castShadow><cylinderGeometry args={[.065, .06, .15, 20]} /><Paint color={palette.peach} /></mesh>
 <Block at={[0, .48, .84]} size={[.58, .17, .6]} color={agent.color} radius={.08} />
 <Block at={[0, .76, 1.1]} size={[.6, .55, .14]} color={agent.color} radius={.065} />
 <Block at={[0, .23, .84]} size={[.07, .4, .07]} color={palette.cream} radius={.025} />
 <Block at={[0, .07, .84]} size={[.48, .08, .43]} color={palette.cream} radius={.04} />
 <Avatar agent={agent} select={select} />
 </group>; }
function Clock({ at }: { at: Point }) { return <group position={at}>
 <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.37, .37, .09, 40]} /><Paint color={palette.wood} /></mesh>
 <mesh position={[0, 0, .052]}><circleGeometry args={[.3, 40]} /><meshBasicMaterial color={palette.cream} /></mesh>
 <Block at={[0, .085, .065]} size={[.025, .19, .02]} color={palette.ink} radius={.01} /><Block at={[.075, 0, .065]} size={[.17, .025, .02]} color={palette.ink} radius={.01} />
 </group>; }
function Camera({ angle, scale }: { angle: number; scale: number }) {
 const { camera, size } = useThree();
 useEffect(() => { const c = camera as THREE.OrthographicCamera; c.zoom = Math.min(size.width / 14.5, size.height / 11.3) / scale; c.updateProjectionMatrix(); }, [camera, size.width, size.height, scale]);
 useFrame(() => { camera.position.lerp(new THREE.Vector3(Math.sin(angle) * 14, 12, Math.cos(angle) * 14), .08); camera.lookAt(0, .15, 0); });
 return null;
}
function OfficeFallback(){const {t}=useI18n();return <div className="scene-fallback">{t('3D rendering is unavailable. Open an agent from the team cards below.')}</div>;}
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
 state = { failed: false };
 static getDerivedStateFromError() { return { failed: true }; }
 render() { return this.state.failed ? <OfficeFallback/> : this.props.children; }
}
export default function Office({ agents, onSelect, angle }: { agents: Agent[]; onSelect: (a: Agent) => void; angle: number }) {
 const rows = Math.max(2, Math.ceil(agents.length / 2)); const extra = Math.max(0, rows - 2) * 2.05; const depth = 8.2 + extra; const scale = Math.max(1, depth / 9);
 return <Boundary><Canvas orthographic shadows camera={{ position: [9, 12, 12], zoom: 40, near: .1, far: 150 }} gl={{ antialias: true }}>
 <color attach="background" args={['#f3eee8']} /><ambientLight intensity={.6} /><hemisphereLight args={['#fffcf4', '#d3c5d9', .5]} />
 <directionalLight position={[-3, 12, 7]} intensity={1.7} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-normalBias={.04} shadow-bias={-.0002} shadow-radius={4} />
 <Camera angle={angle} scale={scale} />
 <group position={[0, -.3, 0]}>
 {/* A floating, rounded dollhouse platform and two quiet cutaway walls. */}
 <Block at={[0, -.2, 0]} size={[10.5, .46, depth]} color={palette.trim} radius={.22} />
 <Block at={[0, .035, 0]} size={[10.35, .1, depth - .14]} color={palette.cream} radius={.049} />
 <Block at={[-5.08, 1.18, -.03]} size={[.18, 2.3, depth - .22]} color={palette.wall} radius={.085} />
 <Block at={[0, 1.18, -depth / 2 + .15]} size={[10.2, 2.3, .18]} color="#f2e5d6" radius={.085} />
 {/* Three large pastel windows leave generous blank space on the walls. */}
 {[-3, -.4, 2.2].map(x => <group key={x} position={[x, 1.43, -depth / 2 + .27]}>
 <Block at={[0, 0, 0]} size={[1.65, 1.25, .13]} color={palette.cream} radius={.065} />
 <Block at={[0, 0, .075]} size={[1.4, 1.02, .03]} color={palette.sky} radius={.014} />
 <Block at={[0, 0, .1]} size={[.06, 1.05, .025]} color={palette.cream} radius={.012} />
 <Block at={[0, -.65, .08]} size={[1.82, .1, .3]} color={palette.wood} radius={.045} />
 </group>)}
 <Clock at={[4, 1.6, -depth / 2 + .28]} />
 {/* Low rugs divide the room without tall partitions or visual clutter. */}
 <Block at={[-2.25, .105, -.1]} size={[4.65, .04, 4.9 + extra]} color="#e2d8ed" radius={.019} />
 <Block at={[2.8, .105, -1.4]} size={[3.35, .04, 3.35]} color="#d8e6d6" radius={.019} />
 {/* Manager / quiet focus corner. */}
 <Block at={[2.75, .7, -1.65]} size={[1.95, .15, 1]} color={palette.wood} radius={.07} />
 {[-.7, .7].map(x => <Block key={x} at={[2.75 + x, .36, -1.65]} size={[.14, .68, .67]} color={palette.cream} radius={.065} />)}
 <Block at={[2.75, 1.04, -1.95]} size={[.75, .47, .1]} color={palette.cream} radius={.049} />
 <Block at={[2.75, 1.04, -1.89]} size={[.61, .34, .025]} color={palette.mint} radius={.012} />
 <Block at={[2.75, .49, -.8]} size={[.65, .19, .6]} color={palette.mint} radius={.09} />
 <Block at={[2.75, .79, -.55]} size={[.65, .6, .16]} color={palette.mint} radius={.075} />
 {/* Reception: soft lilac counter, with one small ceramic pot. */}
 <Block at={[-2.75, .48, 2.8 + extra / 2]} size={[2.65, .86, .8]} color={palette.lavender} radius={.16} />
 <Block at={[-2.75, .95, 2.8 + extra / 2]} size={[2.85, .13, .98]} color={palette.cream} radius={.063} />
 <Block at={[-2.75, .53, 3.215 + extra / 2]} size={[.55, .08, .025]} color={palette.cream} radius={.012} />
 {/* A little lounge: two cushions and a round, low coffee table. */}
 <Block at={[2.8, .16, 2.55]} size={[2.8, .045, 1.95]} color="#ede2d5" radius={.021} />
 <Block at={[3.1, .4, 2.9]} size={[2.2, .55, .88]} color={palette.peach} radius={.2} />
 <Block at={[3.1, .76, 3.2]} size={[2.2, .7, .26]} color={palette.peach} radius={.125} />
 {[2.6, 3.6].map(x => <Block key={x} at={[x, .7, 2.88]} size={[.83, .17, .67]} color="#f9d3be" radius={.08} />)}
 <mesh position={[1.7, .45, 2.2]} castShadow><cylinderGeometry args={[.43, .43, .13, 40]} /><Paint color={palette.wood} /></mesh>
 <Block at={[1.7, .24, 2.2]} size={[.16, .4, .16]} color={palette.cream} radius={.07} />
 {/* Document cubbies and a tiny, simple insight board. */}
 <Block at={[4.6, .68, -.1]} size={[.48, 1.3, 1.35]} color={palette.wood} radius={.08} />
 {[.32, .68, 1.04].map((y, i) => <Block key={y} at={[4.31, y, -.1]} size={[.14, .24, .98]} color={[palette.mint, palette.lavender, palette.peach][i]} radius={.04} />)}
 <Block at={[2.75, 1.35, -depth / 2 + .4]} size={[1.3, .65, .09]} color={palette.cream} radius={.04} />
 {[.17, .3, .4, .26].map((h, i) => <Block key={i} at={[2.35 + i * .25, 1.12 + h / 2, -depth / 2 + .455]} size={[.12, h, .025]} color={[palette.peach, palette.mint, palette.lavender, palette.mint][i]} radius={.012} />)}
 {agents.map((a, i) => <Desk key={a.id} agent={a} at={[-3.35 + (i % 2) * 2.35, 0, -1.85 - extra / 2 + Math.floor(i / 2) * 2.05]} select={() => onSelect(a)} />)}
 <Plant at={[-4.45, .09, -depth / 2 + .85]} /><Plant at={[4.4, .09, -depth / 2 + .9]} /><Plant at={[-4.4, .09, depth / 2 - .7]} />
 </group>
 <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.545, 0]} receiveShadow><planeGeometry args={[200, 200]} /><shadowMaterial transparent opacity={.12} /></mesh>
 </Canvas></Boundary>;
}
