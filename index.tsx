
import React, { useState, useRef, useMemo, useEffect, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Float, Stars, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';

// --- Types ---
type ThemeKey = 'deepBlue' | 'lightBlue' | 'pink' | 'red' | 'white' | 'green' | 'purple' | 'gold';

interface AppState {
    colorTheme: ThemeKey;
    blessingText: string;
    mode: 'edit' | 'view';
    isRecording: boolean;
}

// --- Constants ---
const THEMES: Record<ThemeKey, {
    label: string;
    leavesHigh: string; 
    leavesLow: string;  
    ribbon: string;
    text: string;
    bg: string;
    star: string;
}> = {
    deepBlue: {
        label: 'Midnight',
        leavesHigh: '#3b82f6', 
        leavesLow: '#1e3a8a',  // Rich dark blue
        ribbon: '#fcd34d',     
        text: '#451a03',       
        bg: '#0b1120',
        star: '#fbbf24'
    },
    lightBlue: {
        label: 'Frozen',
        leavesHigh: '#e0f2fe', 
        leavesLow: '#0ea5e9',  // Vibrant sky blue
        ribbon: '#1e3a8a',     
        text: '#ffffff',       
        bg: '#0f172a',
        star: '#bae6fd'
    },
    pink: {
        label: 'Dreamy',
        leavesHigh: '#fbcfe8', 
        leavesLow: '#db2777',  // Deep vibrant pink
        ribbon: '#fff1f2',     
        text: '#831843',       
        bg: '#4a044e',
        star: '#fce7f3'
    },
    red: {
        label: 'Festive',
        leavesHigh: '#ef4444', 
        leavesLow: '#991b1b',  // Rich red
        ribbon: '#fde047',     
        text: '#450a0a',       
        bg: '#2d0a0a',
        star: '#facc15'
    },
    white: {
        label: 'Silver',
        leavesHigh: '#ffffff', 
        leavesLow: '#94a3b8',  // Cool grey/silver
        ribbon: '#dc2626',     
        text: '#ffffff',
        bg: '#111827',
        star: '#f1f5f9'
    },
    green: {
        label: 'Classic',
        leavesHigh: '#4ade80', 
        leavesLow: '#15803d',  // Lush dark green
        ribbon: '#ef4444',     
        text: '#ffffff',
        bg: '#022c22',
        star: '#fbbf24'
    },
    purple: {
        label: 'Royal',
        leavesHigh: '#d8b4fe', 
        leavesLow: '#7e22ce',  // Deep purple
        ribbon: '#fae8ff',     
        text: '#3b0764',       
        bg: '#1e1b4b',
        star: '#e9d5ff'
    },
    gold: {
        label: 'Luxury',
        leavesHigh: '#fde047', 
        leavesLow: '#d97706',  // Deep amber gold
        ribbon: '#b91c1c',     
        text: '#fcd34d',       
        bg: '#1c1917',
        star: '#fffbeb'
    }
};

// --- Components ---

const BackgroundController = ({ color }: { color: string }) => {
    const { scene } = useThree();
    const targetColor = useMemo(() => new THREE.Color(color), [color]);
    const currentColor = useRef(new THREE.Color(color));

    useFrame((state, delta) => {
        // Clamp delta to prevent color jumps or instability on large frame drops
        const d = Math.min(delta, 0.1);
        currentColor.current.lerp(targetColor, d * 2); 
        scene.background = currentColor.current;
        if (scene.fog) {
            scene.fog.color.copy(currentColor.current);
        }
    });

    useEffect(() => {
        scene.fog = new THREE.Fog(color, 8, 30);
    }, []);

    return null;
};

// Memoize stable components to prevent re-renders on App state changes
const FallingSnow = React.memo(() => {
    const count = 800;
    const mesh = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    const particles = useMemo(() => {
        return new Array(count).fill(0).map(() => ({
            position: new THREE.Vector3(
                (Math.random() - 0.5) * 25,
                Math.random() * 20, 
                (Math.random() - 0.5) * 25
            ),
            speed: 0.03 + Math.random() * 0.05,
            wobbleSpeed: 0.5 + Math.random(),
            wobbleOffset: Math.random() * Math.PI * 2,
            scale: 0.04 + Math.random() * 0.06
        }));
    }, []);

    useFrame((state) => {
        if (!mesh.current) return;
        const time = state.clock.elapsedTime;
        
        particles.forEach((p, i) => {
            p.position.y -= p.speed;
            if (p.position.y < -5) p.position.y = 15;
            
            const wobble = Math.sin(time * p.wobbleSpeed + p.wobbleOffset) * 0.05;
            dummy.position.copy(p.position);
            dummy.position.x += wobble;
            dummy.scale.setScalar(p.scale);
            dummy.rotation.set(time * 0.5, time * 0.3, 0);
            dummy.updateMatrix();
            mesh.current.setMatrixAt(i, dummy.matrix);
        });
        mesh.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={mesh} args={[null, null, count]}>
            <dodecahedronGeometry args={[1, 0]} /> 
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
        </instancedMesh>
    );
});

const StylizedTree = React.memo(({ themeName }: { themeName: ThemeKey }) => {
    const theme = THEMES[themeName];
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const colorAttribRef = useRef<THREE.InstancedBufferAttribute>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    const LAYER_COUNT = 9;
    const BRUSH_COUNT = 1100; 
    
    // 1. Static Structure
    const { positions, rotations, scales } = useMemo(() => {
        const pos = [];
        const rot = [];
        const sca = [];
        let index = 0;

        for (let l = 0; l < LAYER_COUNT; l++) {
            const layerProgress = l / (LAYER_COUNT - 1);
            const yBase = -3.5 + l * 1.3; 
            const radiusBase = 3.8 * (1 - layerProgress * 0.95);
            const count = Math.floor(BRUSH_COUNT / LAYER_COUNT); 
            
            for (let i = 0; i < count; i++) {
                if (index >= BRUSH_COUNT) break;

                const r = Math.sqrt(Math.random()) * radiusBase; 
                const angle = Math.random() * Math.PI * 2;
                const h = Math.random() * 1.0; 
                
                const x = Math.cos(angle) * r;
                const z = Math.sin(angle) * r;
                const y = yBase + h * (1 - r/radiusBase * 0.3); 

                dummy.position.set(x, y, z);
                dummy.lookAt(0, y + 5, 0); 
                dummy.rotation.x += (Math.random() - 0.5) * 1.0;
                dummy.rotation.z += (Math.random() - 0.5) * 1.0;
                dummy.rotation.y += (Math.random() - 0.5) * 2.0;
                
                pos.push(x, y, z);
                rot.push(dummy.rotation.x, dummy.rotation.y, dummy.rotation.z);
                
                const s = 0.3 + Math.random() * 0.5;
                sca.push(s, s, s);
                
                index++;
            }
        }
        return { positions: pos, rotations: rot, scales: sca };
    }, []);

    // 2. Initialize Geometry
    useEffect(() => {
        if (!meshRef.current) return;
        
        for (let i = 0; i < BRUSH_COUNT; i++) {
            dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
            dummy.rotation.set(rotations[i * 3], rotations[i * 3 + 1], rotations[i * 3 + 2]);
            dummy.scale.set(scales[i * 3], scales[i * 3 + 1], scales[i * 3 + 2]);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [positions]);

    // 3. Update Colors
    useEffect(() => {
        if (!colorAttribRef.current) return;

        const colorHigh = new THREE.Color(theme.leavesHigh);
        const colorLow = new THREE.Color(theme.leavesLow);
        const snowColor = new THREE.Color('#ffffff');
        const tempColor = new THREE.Color();

        const minY = -4.0;
        const maxY = 5.5;
        const range = maxY - minY;

        for (let i = 0; i < BRUSH_COUNT; i++) {
            const y = positions[i * 3 + 1];
            
            // Normalize Height Factor
            let t = (y - minY) / range;
            t = Math.max(0, Math.min(1, t)); 
            
            // Minimal noise for natural texture
            const noise = (Math.random() - 0.5) * 0.05;
            t = Math.max(0, Math.min(1, t + noise));

            if (t < 0.65) {
                // Gradient from Low to High
                const localT = t / 0.65;
                tempColor.lerpColors(colorLow, colorHigh, localT);
            } else {
                // Gradient from High to Snow (Frosted tips)
                const localT = (t - 0.65) / 0.35;
                tempColor.lerpColors(colorHigh, snowColor, localT * 0.7); 
            }
            
            colorAttribRef.current.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
        }
        
        colorAttribRef.current.needsUpdate = true;
        
    }, [themeName, positions]);

    useFrame((state) => {
        const time = state.clock.elapsedTime;
        if (meshRef.current) meshRef.current.rotation.y = Math.sin(time * 0.2) * 0.03;
    });

    return (
        <group>
            {/* Keeping receiveShadow off as per visual preference */}
            <instancedMesh ref={meshRef} args={[null, null, BRUSH_COUNT]} castShadow>
                <tetrahedronGeometry args={[0.25, 0]} />
                <meshStandardMaterial roughness={0.6} metalness={0.1} flatShading />
                <instancedBufferAttribute 
                    ref={colorAttribRef}
                    attach="instanceColor" 
                    args={[new Float32Array(BRUSH_COUNT * 3), 3]} 
                />
            </instancedMesh>

            <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
                <mesh position={[0, 6.8, 0]}>
                    <dodecahedronGeometry args={[0.6, 0]} />
                    <meshStandardMaterial 
                        color={theme.star} 
                        emissive={theme.star} 
                        emissiveIntensity={2}
                        toneMapped={false}
                    />
                </mesh>
            </Float>
        </group>
    );
});

const RibbonWithText = React.memo(({ themeName, text }: { themeName: ThemeKey, text: string }) => {
    const theme = THEMES[themeName];
    const groupRef = useRef<THREE.Group>(null);

    const { curve } = useMemo(() => {
        const points = [];
        const turns = 3.5; 
        const hStart = -3.2;
        const hEnd = 5.8;
        const segments = 200; 

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const angle = t * Math.PI * 2 * turns;
            const y = hStart + t * (hEnd - hStart);
            const r = 3.7 * (1 - t) + 0.3; 
            
            points.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
        }
        return { curve: new THREE.CatmullRomCurve3(points) };
    }, []);

    const ribbonGeometry = useMemo(() => {
        const shape = new THREE.Shape();
        const width = 0.45; 
        const height = 0.01;
        shape.moveTo(-width/2, -height/2);
        shape.lineTo(width/2, -height/2);
        shape.lineTo(width/2, height/2);
        shape.lineTo(-width/2, height/2);
        
        return new THREE.ExtrudeGeometry(shape, {
            extrudePath: curve,
            steps: 250, 
            bevelEnabled: false,
        });
    }, [curve]);

    const textLayout = useMemo(() => {
        if (!text) return [];
        const baseString = text + "   ★   "; 
        const totalCharsNeeded = 140; 
        const repeatedString = baseString.repeat(Math.ceil(totalCharsNeeded / baseString.length)).substring(0, totalCharsNeeded);
        const chars = repeatedString.split('');
        
        const layout = [];
        const startT = 0.02;
        const endT = 0.98;
        const range = endT - startT;
        const step = range / chars.length;

        for (let i = 0; i < chars.length; i++) {
            const t = endT - i * step; 
            const safeT = Math.min(0.999, Math.max(0.001, t));
            const point = curve.getPointAt(safeT);
            
            const angle = Math.atan2(point.x, point.z);

            layout.push({ 
                char: chars[i], 
                position: point,
                rotation: [0, angle, 0] 
            });
        }
        return layout;
    }, [text, curve]);

    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
        }
    });

    return (
        <group ref={groupRef}>
            <mesh geometry={ribbonGeometry} castShadow receiveShadow>
                <meshStandardMaterial 
                    color={theme.ribbon}
                    emissive={theme.ribbon}
                    emissiveIntensity={0.2}
                    roughness={0.4}
                    metalness={0.4}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {textLayout.map((item, i) => (
                <group key={i} position={item.position}>
                    {/* @ts-ignore */}
                    <group rotation={item.rotation}>
                        <group position={[0, 0, 0.06]}> 
                            <Text
                                fontSize={0.26}
                                fontWeight="bold"
                                color={theme.text}
                                anchorX="center"
                                anchorY="middle"
                                outlineWidth={0.02}
                                outlineColor={theme.ribbon} 
                                outlineOpacity={0.6}
                            >
                                {item.char}
                            </Text>
                        </group>
                    </group>
                </group>
            ))}
        </group>
    );
});

// --- Scene Container (Memoized to prevent black screen on UI update) ---
const SceneContent = React.memo(({ themeName, blessingText, isRecording }: { themeName: ThemeKey, blessingText: string, isRecording: boolean }) => {
    const theme = THEMES[themeName];
    
    return (
        <>
            <BackgroundController color={theme.bg} />
            
            <ambientLight intensity={1.5} /> 
            <spotLight 
                position={[5, 12, 5]} 
                angle={0.4} 
                penumbra={1} 
                intensity={1.5} 
                color="#ffffff"
                castShadow 
                shadow-bias={-0.0001}
            />
            <pointLight position={[-4, 2, -4]} intensity={0.8} color="#ffffff" />

            <group position={[0, 1.2, 0]}>
                <FallingSnow />
                <StylizedTree themeName={themeName} />
                <Suspense fallback={null}>
                    <RibbonWithText themeName={themeName} text={blessingText} />
                </Suspense>
            </group>
            
            <Environment preset="city" />
            <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />

            <EffectComposer enableNormalPass={false}>
                <Bloom luminanceThreshold={0.85} mipmapBlur intensity={1.0} radius={0.3} />
                <Noise opacity={0.03} />
                <Vignette eskil={false} offset={0.1} darkness={0.4} />
            </EffectComposer>

            <OrbitControls 
                target={[0, 2.5, 0]}
                enablePan={false}
                minPolarAngle={Math.PI / 3}
                maxPolarAngle={Math.PI / 1.8}
                autoRotate={true}
                autoRotateSpeed={isRecording ? 2.0 : 0.8} 
            />
        </>
    );
});

const UI = ({ state, setState }: any) => {
    const handleDownloadVideo = async () => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;

        setState((s: any) => ({ ...s, isRecording: true }));

        try {
            const stream = canvas.captureStream(30);
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
            const chunks: BlobPart[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `christmas-tree-${Date.now()}.webm`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                setState((s: any) => ({ ...s, isRecording: false }));
            };

            recorder.start();
            setTimeout(() => { recorder.stop(); }, 10000);
        } catch (e) {
            console.error("Recording failed", e);
            alert("Video recording not supported in this browser.");
            setState((s: any) => ({ ...s, isRecording: false }));
        }
    };

    return (
        <div className="ui-layer">
            {state.mode === 'edit' ? (
                <>
                    <header>
                        <h1>WINTER WISHES</h1>
                        <p>Customize your holiday magic</p>
                    </header>

                    <div className="controls-panel">
                        <div className="control-group">
                            <label>Theme Palette</label>
                            <div className="color-grid">
                                {Object.entries(THEMES).map(([key, theme]) => (
                                    <div 
                                        key={key}
                                        className={`color-item ${state.colorTheme === key ? 'active' : ''}`}
                                        onClick={() => setState((s: any) => ({ ...s, colorTheme: key }))}
                                    >
                                        <div 
                                            className="swatch" 
                                            style={{ background: `linear-gradient(to bottom, ${theme.leavesHigh}, ${theme.leavesLow})` }}
                                        ></div>
                                        <span>{theme.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="control-group">
                            <label>Ribbon Message</label>
                            <textarea 
                                value={state.blessingText}
                                onChange={(e) => setState((s: any) => ({ ...s, blessingText: e.target.value }))}
                                placeholder="Type your wish..."
                                maxLength={35} 
                            />
                        </div>

                        <button 
                            className="action-btn confirm-btn"
                            onClick={() => setState((s: any) => ({ ...s, mode: 'view' }))}
                        >
                            Confirm & Generate
                        </button>
                    </div>
                </>
            ) : (
                <div className="view-mode-controls">
                    <button 
                        className="float-btn edit-btn"
                        onClick={() => setState((s: any) => ({ ...s, mode: 'edit' }))}
                        title="Edit"
                    >
                        ✎
                    </button>
                    <button 
                        className={`action-btn download-btn ${state.isRecording ? 'recording' : ''}`}
                        onClick={handleDownloadVideo}
                        disabled={state.isRecording}
                    >
                        {state.isRecording ? 'Recording...' : 'Download Video'}
                    </button>
                </div>
            )}
        </div>
    );
};

// Stable style object to prevent Canvas re-initialization
const CANVAS_STYLE: React.CSSProperties = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 };

const App = () => {
    const [state, setState] = useState<AppState>({
        colorTheme: 'deepBlue',
        blessingText: 'MERRY CHRISTMAS',
        mode: 'edit',
        isRecording: false
    });

    return (
        <>
            <Canvas 
                shadows 
                dpr={[1, 2]} 
                camera={{ position: [0, 1.5, 12], fov: 45 }}
                style={CANVAS_STYLE}
            >
                {/* 
                    SceneContent is memoized. 
                    Changing 'mode' in parent does NOT change props passed here (themeName/blessingText/isRecording).
                    Therefore, the scene will NOT re-render/flash/turn black.
                */}
                <SceneContent 
                    themeName={state.colorTheme} 
                    blessingText={state.blessingText} 
                    isRecording={state.isRecording} 
                />
            </Canvas>
            <UI state={state} setState={setState} />
        </>
    );
};

const rootElement = document.getElementById('root');
if (rootElement) {
    createRoot(rootElement).render(<App />);
}
