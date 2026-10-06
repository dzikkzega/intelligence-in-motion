import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FILM_SECONDS, cameraAt, makeChoreography, smooth } from './choreography.js';

const studioVertex = `
  varying vec3 vNormal; varying vec3 vView; varying vec3 vWorld; varying vec2 vUv;
  void main(){
    vUv=uv; vec4 p=vec4(position,1.);vec3 n=normal;
    #ifdef USE_INSTANCING
      p=instanceMatrix*p;
      mat3 m=mat3(instanceMatrix);
      n/=vec3(dot(m[0],m[0]),dot(m[1],m[1]),dot(m[2],m[2]));
      n=m*n;
    #endif
    vNormal=normalize(normalMatrix*n);vec4 view=modelViewMatrix*p;
    vView=-view.xyz;vWorld=(modelMatrix*p).xyz;gl_Position=projectionMatrix*view;
  }`;
const studioFragment = `
  uniform vec3 uTint;uniform float uTime,uWarm,uSpectral,uOpacity,uEmission,uGlass;
  varying vec3 vNormal;varying vec3 vView;varying vec3 vWorld;varying vec2 vUv;
  void main(){
    vec3 n=normalize(vNormal)*(gl_FrontFacing?1.:-1.);vec3 eye=normalize(vView);
    vec3 r=reflect(-eye,n);float rim=pow(1.-abs(dot(n,eye)),2.5);
    float softbox=pow(max(dot(r,normalize(vec3(-.6,.9,.6))),0.),14.);
    float strip=exp(-abs(r.x+.22*r.y-.26)*32.)*smoothstep(-.3,.3,r.y);
    float edge=1.-smoothstep(.012,.038,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));
    float light=.13+.38*max(dot(n,normalize(vec3(-.5,1.,.6))),0.);
    float paper=step(.64,fract(vUv.x*35.))*step(.14,vUv.y)*step(vUv.y,.88);
    vec3 color=uTint*(light+softbox*1.8+strip*1.1);
    color=mix(color,uTint*(.34+light*.9)*(1.-paper*.17),uWarm);
    vec3 spectral=.5+.5*cos(r.y*3.5+r.x*2.+vec3(0.,2.,4.));
    color+=spectral*uSpectral*(rim*.9+strip*.5)+vec3(.5,.57,.61)*rim*.55;
    float pulse=pow(max(0.,sin(vWorld.y*2.+vWorld.z*.7-uTime*2.6)),18.);
    color+=uTint*(edge*(.1+uEmission)+pulse*.09*uEmission);
    color=mix(color,color*.35+spectral*rim*1.8+vec3(1.)*(strip+softbox),uGlass);
    float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
    color+=(grain-.5)*.007;
    gl_FragColor=vec4(color,uOpacity*mix(1.,.45+rim*.5,uGlass));
  }`;

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const windowAt = (t,a,b,c,d) => smooth(a,b,t)*(1-smooth(c,d,t));

function createRng(seed = 0x12345678) {
  let s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Palette definitions matching the 4 giants and prologue/epilogue
const PALETTE = {
  bg: new THREE.Color('#030305'),
  origin: new THREE.Color('#94a3b8'),
  codex: new THREE.Color('#10b981'),
  codexBright: new THREE.Color('#6ee7b7'),
  claude: new THREE.Color('#f59e0b'),
  claudeIvory: new THREE.Color('#fef3c7'),
  geminiCyan: new THREE.Color('#38bdf8'),
  geminiViolet: new THREE.Color('#a855f7'),
  grokSteel: new THREE.Color('#e2e8f0'),
  white: new THREE.Color('#ffffff'),
};

/**
 * Procedural texture atlas for circuits, manuscripts, waveforms, and telemetry.
 */
function createCinematicAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable for atlas');

  // Tile 0: Codex circuit traces & logic gates
  ctx.fillStyle = '#040d07';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 30; i++) {
    const y = 20 + i * 16;
    ctx.moveTo(20, y);
    ctx.lineTo(160 + (i % 5) * 40, y);
    ctx.lineTo(220 + (i % 5) * 40, y + (i % 2 ? 16 : -16));
    ctx.lineTo(480, y + (i % 2 ? 16 : -16));
  }
  ctx.stroke();
  ctx.fillStyle = '#6ee7b7';
  for (let i = 0; i < 40; i++) {
    ctx.fillRect(40 + (i * 37) % 430, 30 + (i * 29) % 450, 6, 6);
  }

  // Tile 1: Claude manuscript scripts & knowledge ribbons
  ctx.fillStyle = '#0c0a06';
  ctx.fillRect(512, 0, 512, 512);
  ctx.fillStyle = 'rgba(254, 243, 199, 0.75)';
  for (let i = 0; i < 24; i++) {
    const y = 30 + i * 19;
    const len = 340 - (i % 4) * 60;
    ctx.fillRect(540, y, len, 4);
  }
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(530, 20, 470, 470);

  // Tile 2: Gemini multimodal waves & caustics
  ctx.fillStyle = '#060814';
  ctx.fillRect(0, 512, 512, 512);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = 0; x < 512; x += 4) {
    const y = 768 + Math.sin(x * 0.05) * 50 * Math.cos(x * 0.015);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = '#a855f7';
  ctx.beginPath();
  for (let x = 0; x < 512; x += 4) {
    const y = 768 + Math.sin(x * 0.08 + 1) * 35;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Tile 3: Grok high-contrast data stream
  ctx.fillStyle = '#020203';
  ctx.fillRect(512, 512, 512, 512);
  ctx.fillStyle = '#ffffff';
  for (let y = 530; y < 1000; y += 14) {
    for (let x = 530; x < 1000; x += 18) {
      if ((x * y) % 7 === 0) {
        ctx.fillRect(x, y, 4, 8);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Creates the continuous 3D cinematic film environment.
 * All 6 worlds are rendered as continuous physical transformations of a unified matter pool.
 */
export async function createEnvironment(
  canvas,
  { reducedMotion = false, onProgress = () => {}, onContextLost = () => {} } = {}
) {
  if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('A canvas is required');
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
  });
  if (!gl) throw new Error('WebGL2 unavailable');

  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const resources = new Set();
  const own = obj => {
    resources.add(obj);
    return obj;
  };

  let disposed = false;
  let lost = false;
  let isReduced = Boolean(reducedMotion);
  let width = 1;
  let height = 1;
  let lastTime = 0;
  let lastPointer = { x: 0, y: 0 };
  let lastLobby = true;
  let composer = null;

  const mobile = matchMedia('(max-width: 767px), (pointer: coarse)').matches;
  const scene = new THREE.Scene();
  scene.background = PALETTE.bg.clone();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 150);
  camera.position.set(0, 0, 7.8);

  const handleLost = e => {
    e.preventDefault();
    if (!disposed && !lost) {
      lost = true;
      onContextLost();
    }
  };
  const handleRestored = () => {
    if (!disposed) {
      lost = false;
      resize();
      renderFrame(lastTime, lastPointer, lastLobby);
    }
  };
  canvas.addEventListener('webglcontextlost', handleLost);
  canvas.addEventListener('webglcontextrestored', handleRestored);

  function dispose() {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('webglcontextlost', handleLost);
    canvas.removeEventListener('webglcontextrestored', handleRestored);
    resources.forEach(res => res.dispose?.());
    resources.clear();
    renderer.renderLists.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  function resize() {
    if (disposed) return;
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width || window.innerWidth);
    height = Math.max(1, rect.height || window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, mobile || width < 768 ? 1.3 : 1.7);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    if (composer) {
      composer.setPixelRatio(dpr);
      composer.setSize(width, height);
    }
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  try {
    onProgress(0.15);

    // =========================================================================
    // 1. ATMOSPHERIC BACKGROUND DOME
    // =========================================================================
    const bgUniforms = {
      uTint: { value: new THREE.Color('#0a101d') },
      uAccent: { value: new THREE.Color('#10b981') },
      uGlow: { value: 0.12 },
      uFade: { value: 1.0 },
    };
    const bgMat = own(
      new THREE.ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        uniforms: bgUniforms,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.9999, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform vec3 uTint;
          uniform vec3 uAccent;
          uniform float uGlow;
          uniform float uFade;
          void main() {
            vec2 p = vUv - vec2(0.5, 0.5);
            float dist = length(p * vec2(1.0, 1.25));
            float vignette = smoothstep(1.15, 0.08, dist);
            float halo = exp(-dist * 3.4) * uGlow;
            vec3 color = vec3(0.015, 0.018, 0.024) + uTint * (vignette * 0.08) + uAccent * halo;
            gl_FragColor = vec4(color * uFade, 1.0);
          }
        `,
      })
    );
    const bgMesh = new THREE.Mesh(own(new THREE.PlaneGeometry(2, 2)), bgMat);
    bgMesh.frustumCulled = false;
    bgMesh.renderOrder = -1000;
    scene.add(bgMesh);

    const atlas = own(createCinematicAtlas());

    onProgress(0.35);

    // =========================================================================
    // 2. UNIFIED METAMORPHIC MATTER POOL (1536 desktop / 768 mobile)
    // =========================================================================
    const instanceCount = mobile ? 768 : 1536;
    const { frames, links } = makeChoreography(instanceCount);

    const boxGeo = own(new THREE.BoxGeometry(1, 1, 1));
    const boxUniforms = {
      uTint: { value: new THREE.Color('#94a3b8') },
      uTime: { value: 0 },
      uWarm: { value: 0 },
      uSpectral: { value: 0.2 },
      uOpacity: { value: 1 },
      uEmission: { value: 0 },
      uGlass: { value: 0 },
    };
    const boxMat = own(
      new THREE.ShaderMaterial({
        uniforms: boxUniforms,
        vertexShader: studioVertex,
        fragmentShader: studioFragment,
        transparent: true,
        depthWrite: true,
      })
    );

    const matterMesh = own(new THREE.InstancedMesh(boxGeo, boxMat, instanceCount));
    matterMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    matterMesh.frustumCulled = false;
    scene.add(matterMesh);

    const dummy = new THREE.Object3D();

    composer = own(new EffectComposer(renderer));
    composer.addPass(own(new RenderPass(scene, camera)));
    const bloom = own(new UnrealBloomPass(new THREE.Vector2(width, height), 0.28, 0.45, 0.88));
    composer.addPass(bloom);
    composer.addPass(own(new OutputPass()));

    // Structural connection links (network segments)
    const linkPositions = new Float32Array(links.length * 2 * 3);
    const linkGeo = own(new THREE.BufferGeometry());
    linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPositions, 3));
    const linkMat = own(
      new THREE.LineBasicMaterial({
        color: PALETTE.geminiCyan,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      })
    );
    const linkLines = own(new THREE.LineSegments(linkGeo, linkMat));
    linkLines.frustumCulled = false;
    scene.add(linkLines);

    // One continuous membrane: machined shell, manuscript rivers, portal, wave terrain, crystal.
    const ribbonGeo = own(new THREE.BufferGeometry());
    const ribbonVertices = [], ribbonUv = [], ribbonIndices = [];
    const bands = mobile ? 18 : 26, segments = mobile ? 80 : 128;
    for (let b = 0; b < bands; b++) {
      const offset = ribbonVertices.length / 3;
      for (let j = 0; j <= segments; j++) for (let edge = 0; edge < 2; edge++) {
        ribbonVertices.push(j / segments, b / (bands - 1), edge);
        ribbonUv.push(j / segments, edge);
      }
      for (let j = 0; j < segments; j++) {
        const v = offset + j * 2;
        ribbonIndices.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
      }
    }
    ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(ribbonVertices, 3));
    ribbonGeo.setAttribute('uv', new THREE.Float32BufferAttribute(ribbonUv, 2));
    ribbonGeo.setIndex(ribbonIndices);
    const ribbonUniforms = THREE.UniformsUtils.clone(boxUniforms);
    Object.assign(ribbonUniforms, { uFrom: {value: 0}, uTo: {value: 0}, uMorph: {value: 0} });
    const ribbonMat = own(new THREE.ShaderMaterial({
      uniforms: ribbonUniforms, side: THREE.DoubleSide, transparent: true, depthWrite: true,
      vertexShader: `
        uniform float uTime,uFrom,uTo,uMorph;
        varying vec3 vNormal,vView,vWorld; varying vec2 vUv;
        vec3 form(float k,vec3 q){
          float a=q.x*6.283185;float band=q.y;float side=(q.z-.5)*.14;
          float phi=(band-.5)*2.75+side;
          if(k<.5){float r=3.5+.15*sin(a*3.+band*8.);return vec3(cos(a)*cos(phi),sin(phi),sin(a)*cos(phi))*r;}
          if(k<1.5){float x=(q.x-.5)*24.;float z=(band-.5)*16.+side*3.;return vec3(x,-2.+sin(x*.43+band*4.+uTime*.2)*1.25+cos(z*.4)*.6,z);}
          if(k<2.5){float r=3.6+side*2.+band*.75;return vec3(cos(a)*r,sin(a)*r,(band-.5)*5.);}
          if(k<3.5){float x=(q.x-.5)*24.;float z=(band-.5)*19.+side;return vec3(x,-1.8+sin(x*.5+uTime*.5)*cos(z*.25)*2.+sin(z*.4+x*.25),z);}
          if(k<4.5){vec3 p=vec3(cos(a)*cos(phi),sin(phi),sin(a)*cos(phi));return p*4.8/(abs(p.x)+abs(p.y)+abs(p.z));}
          if(k<5.5)return vec3((band-.5)*23.+side*.12,-2.9,(q.x-.5)*48.);
          return vec3(cos(a)*cos(phi),sin(phi),sin(a)*cos(phi))*(3.95+.17*sin(a*3.+phi*4.));
        }
        void main(){vUv=uv;vec3 p=mix(form(uFrom,position),form(uTo,position),uMorph);
          vWorld=(modelMatrix*vec4(p,1.)).xyz;vec4 view=modelViewMatrix*vec4(p,1.);
          vView=-view.xyz;vNormal=vec3(0.,1.,0.);gl_Position=projectionMatrix*view;}
      `,
      fragmentShader: studioFragment.replace('normalize(vNormal)', 'normalize(cross(dFdx(-vView),dFdy(-vView)))'),
    }));
    const membrane = new THREE.Mesh(ribbonGeo, ribbonMat);
    membrane.frustumCulled = false;
    scene.add(membrane);
    const ribbonKeys = [[0,0,.1],[6,0,.32],[12,0,0],[29,0,0],[34,0,1],[36,0,1],
      [40,1,1],[44,1,.35],[46,1,0],[48,1,0],[51,1,.3],[55,2,.7],[58,2,1],
      [61,3,.9],[65,3,.55],[68,3,.12],[70,3,0],[71,3,0],[75,3,.8],[77,4,1],
      [79,4,.15],[81,5,0],[84,5,.6],[88,5,.5],[91,5,0],[96,5,0],[102,6,.3],
      [104,6,0],[106,6,0],[110,6,1],[113,6,1],[115,3,.9],[117,3,0],[118,3,0]];

    // Physical branching knowledge tree, grown along connected spline tubes.
    const tree = new THREE.Group();scene.add(tree);
    const treeMat = own(new THREE.MeshBasicMaterial({color:'#b9996c',transparent:true,opacity:0}));
    const treeNodes = [];
    for (let branch = 0; branch < 24; branch++) {
      const angle = branch * 2.39996;
      const y = -2.6 + (branch % 8) * .46;
      const radius = 1.4 + (branch % 5) * .47;
      const points = [new THREE.Vector3(0,-3,0),new THREE.Vector3(0,y,0),
        new THREE.Vector3(Math.cos(angle)*radius*.55,y+1.5,Math.sin(angle)*radius*.55),
        new THREE.Vector3(Math.cos(angle)*radius,y+2.2,Math.sin(angle)*radius)];
      const curve = new THREE.CatmullRomCurve3(points);
      tree.add(new THREE.Mesh(own(new THREE.TubeGeometry(curve,36,.024+(branch%3)*.009,5,false)),treeMat));
      treeNodes.push(points[3]);
    }
    const fruitMat=own(new THREE.MeshBasicMaterial({color:'#ffe4bd',transparent:true,opacity:0}));
    const fruit=own(new THREE.InstancedMesh(own(new THREE.IcosahedronGeometry(.085,1)),fruitMat,treeNodes.length));
    tree.add(fruit);
    treeNodes.forEach((point,i)=>{dummy.position.copy(point);dummy.rotation.set(0,0,0);dummy.scale.setScalar(1);dummy.updateMatrix();fruit.setMatrixAt(i,dummy.matrix);});

    // Faceted glass nucleus physically opens out of the spectral landscape.
    const prismUniforms=THREE.UniformsUtils.clone(boxUniforms);
    prismUniforms.uGlass.value=1;prismUniforms.uSpectral.value=1.4;
    const prismMat=own(new THREE.ShaderMaterial({uniforms:prismUniforms,vertexShader:studioVertex,
      fragmentShader:studioFragment,side:THREE.DoubleSide,transparent:true,depthWrite:false}));
    const prism=new THREE.Mesh(own(new THREE.OctahedronGeometry(3.4,0)),prismMat);
    scene.add(prism);
    const prismEdgeMat=own(new THREE.LineBasicMaterial({color:'#c7d9ff',transparent:true,opacity:0}));
    const prismEdges=new THREE.LineSegments(own(new THREE.EdgesGeometry(prism.geometry)),prismEdgeMat);prism.add(prismEdges);

    // Sequential image/video fields carry code-generated spectral imagery.
    const mediaMat=own(new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uOpacity:{value:0}},
      side:THREE.DoubleSide,transparent:true,depthWrite:false,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;uniform float uTime,uOpacity;
        void main(){vec2 p=vUv-.5;float a=atan(p.y,p.x);float r=length(p);
          float field=sin(r*22.-uTime*.5+sin(a*3.+uTime*.13)*2.);
          vec3 c=.5+.5*cos(field*1.4+vec3(0.,2.,4.));
          float edge=1.-smoothstep(.004,.018,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));
          gl_FragColor=vec4(c*(.25+field*.12)+edge*.6,uOpacity*(.55+edge*.4));}`,
    }));
    const mediaGeo=own(new THREE.PlaneGeometry(2.5,1.55));
    const mediaPlanes=Array.from({length:7},()=>{const mesh=new THREE.Mesh(mediaGeo,mediaMat);scene.add(mesh);return mesh;});


    // The processor die exposes the circuit atlas only while architecture collapses.
    const chipMat=own(new THREE.MeshBasicMaterial({map:atlas,color:'#b8d8cc',transparent:true,opacity:0}));
    const chipGeo=own(new THREE.PlaneGeometry(10,10));
    const chipUvs=chipGeo.attributes.uv;
    for(let i=0;i<chipUvs.count;i++)chipUvs.setXY(i,chipUvs.getX(i)*.5,.5+chipUvs.getY(i)*.5);
    const chip=new THREE.Mesh(chipGeo,chipMat);chip.rotation.x=-Math.PI/2;chip.position.y=-.12;scene.add(chip);

    onProgress(0.65);

    // =========================================================================
    // 3. GLOBAL PROCEDURAL PARTICLE SYSTEM (4800 GPU Dust)
    // =========================================================================
    const pCount = mobile ? 1800 : 4800;
    const pPos = new Float32Array(pCount * 3);
    const pSeeds = new Float32Array(pCount * 4);
    const rng = createRng(0xdeadbeef);
    for (let i = 0; i < pCount; i++) {
      const u = rng();
      const v = rng();
      const theta = u * TAU;
      const phi = Math.acos(2 * v - 1);
      const r = 2.5 + rng() * 5.0;
      pPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pPos[i * 3 + 2] = r * Math.cos(phi);
      pSeeds[i * 4] = rng();
      pSeeds[i * 4 + 1] = rng();
      pSeeds[i * 4 + 2] = rng();
      pSeeds[i * 4 + 3] = i / pCount;
    }

    const pGeo = own(new THREE.BufferGeometry());
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('aSeed', new THREE.BufferAttribute(pSeeds, 4));

    const pUniforms = {
      uTime: { value: 0 },
      uMotion: { value: 0 },
      uPixel: { value: 1 },
      uFade: { value: 1.0 },
      uWeights: { value: new Float32Array(6) },
    };
    const pMat = own(
      new THREE.ShaderMaterial({
        uniforms: pUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `
          attribute vec4 aSeed;
          uniform float uTime;
          uniform float uMotion;
          uniform float uPixel;
          uniform float uWeights[6];
          varying vec3 vColor;
          varying float vAlpha;

          void main() {
            vec3 p = position;
            float seed = aSeed.x * 6.28318;
            float m = uMotion;

            // 0: Origin cloud
            vec3 p0 = p * (1.0 + sin(seed + m * 0.4) * 0.22);
            // 1: Codex matrix grid
            vec3 p1 = vec3(
              (mod(aSeed.w * 32.0, 8.0) - 4.0) * 1.8,
              sin(aSeed.z * 10.0 + m * 2.0) * 2.0,
              (floor(aSeed.w * 32.0 / 8.0) - 2.0) * 1.8
            );
            // 2: Claude organic ribbons
            vec3 p2 = vec3(
              cos(seed + m * 0.1) * (3.0 + aSeed.y * 3.0),
              sin(seed * 2.0 + m * 0.15) * 2.2,
              sin(seed + m * 0.1) * 2.5
            );
            // 3: Gemini waveform field
            vec3 p3 = vec3(
              (aSeed.x - 0.5) * 16.0,
              sin(aSeed.x * 12.0 + m * 0.8) * 1.5 * cos(aSeed.y * 6.0),
              (aSeed.y - 0.5) * 12.0
            );
            // 4: Grok high-speed data stream
            vec3 p4 = vec3(
              (mod(aSeed.w * 20.0, 5.0) - 2.5) * 1.5,
              (aSeed.z - 0.5) * 4.0,
              mod(aSeed.y * 80.0 - m * 14.0, 60.0) - 30.0
            );
            // 5: Convergence unified core
            vec3 p5 = normalize(p) * (2.8 + sin(aSeed.z * 12.0 + m * 0.4) * 0.4);

            vec3 blended = p0 * uWeights[0] + p1 * uWeights[1] + p2 * uWeights[2] +
                           p3 * uWeights[3] + p4 * uWeights[4] + p5 * uWeights[5];

            vec4 mvPos = modelViewMatrix * vec4(blended, 1.0);
            gl_Position = projectionMatrix * mvPos;
            gl_PointSize = clamp(uPixel * (20.0 / -mvPos.z), 1.0, 4.0 * uPixel);

            vColor = vec3(0.58, 0.64, 0.72) * uWeights[0] +
                     vec3(0.1, 0.85, 0.5) * uWeights[1] +
                     vec3(0.96, 0.65, 0.2) * uWeights[2] +
                     vec3(0.25, 0.75, 1.0) * uWeights[3] +
                     vec3(0.92, 0.94, 0.98) * uWeights[4] +
                     vec3(0.7, 0.8, 0.95) * uWeights[5];

            vAlpha = 0.5 + aSeed.y * 0.5;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vAlpha;
          uniform float uFade;
          void main() {
            float dist = length(gl_PointCoord - 0.5);
            if (dist > 0.5) discard;
            float intensity = exp(-dist * dist * 10.0);
            gl_FragColor = vec4(vColor, vAlpha * intensity * uFade);
          }
        `,
      })
    );
    const particlePoints = new THREE.Points(pGeo, pMat);
    particlePoints.frustumCulled = false;
    scene.add(particlePoints);

    onProgress(0.95);

    // =========================================================================
    // 4. FRAME RENDERER: Synchronized with GSAP Timeline clock (0 - 118s)
    // =========================================================================
    function renderFrame(time, pointer = { x: 0, y: 0 }, lobby = false) {
      if (disposed || lost) return;
      lastTime = Number.isFinite(time) ? clamp(time, 0, FILM_SECONDS) : 0;
      lastPointer = pointer || { x: 0, y: 0 };
      lastLobby = Boolean(lobby);

      // In reduced motion, evaluate at chapter tableaux to freeze motion without artifacts
      let evalTime = lastTime;
      if (isReduced) {
        if (lastTime < 12) evalTime = 6;
        else if (lastTime < 35) evalTime = 18;
        else if (lastTime < 58) evalTime = 43;
        else if (lastTime < 81) evalTime = 65;
        else if (lastTime < 103) evalTime = 88;
        else if (lastTime < 117) evalTime = 112;
        else evalTime = 118;
      }

      const t = lobby ? 112 : evalTime;
      let motionTime = t;
      if (t >= 94.5 && t <= 96) {
        motionTime = 94.5;
      } else if (t > 96) {
        motionTime = t - 1.5;
      }
      const m = isReduced ? 0 : motionTime;

      // 1. Continuous Virtual Camera Path
      const cam = cameraAt(t, width / height);
      const px = lobby && !isReduced ? clamp(pointer.x, -1, 1) * 0.35 : 0;
      const py = lobby && !isReduced ? clamp(pointer.y, -1, 1) * 0.25 : 0;
      camera.position.set(cam.position[0] + px, cam.position[1] + py, cam.position[2]);
      camera.lookAt(cam.target[0], cam.target[1], cam.target[2]);
      camera.rotation.z = cam.roll || 0;
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();

      // 2. Continuous Chapter Transitions
      const cuts = [
        smooth(10, 13, t),
        smooth(33, 36, t),
        smooth(56, 59, t),
        smooth(79, 82, t),
        smooth(101, 104, t),
      ];

      const w = pUniforms.uWeights.value;
      w[0] = 1 - cuts[0];
      w[1] = cuts[0] - cuts[1];
      w[2] = cuts[1] - cuts[2];
      w[3] = cuts[2] - cuts[3];
      w[4] = cuts[3] - cuts[4];
      w[5] = cuts[4];

      // Dynamic Material & Ambient Color Shifts
      const tints = [PALETTE.origin, PALETTE.codexBright, PALETTE.claudeIvory, PALETTE.geminiCyan, PALETTE.grokSteel, PALETTE.white];
      let tr = 0, tg = 0, tb = 0;
      for (let i = 0; i < 6; i++) {
        tr += tints[i].r * w[i];
        tg += tints[i].g * w[i];
        tb += tints[i].b * w[i];
      }
      boxUniforms.uTint.value.setRGB(tr, tg, tb);
      boxUniforms.uTime.value = m;
      boxUniforms.uWarm.value = w[2] * 0.82;
      boxUniforms.uSpectral.value = w[3] * 0.75 + w[5] * 0.22;
      boxUniforms.uGlass.value = w[3] * 0.25;
      boxUniforms.uEmission.value = 0.1 + w[1] * windowAt(t, 28, 31, 32, 35) * 1.2;

      const masterFade = smooth(0.2, 2.0, t) * (1 - smooth(115.5, 117.2, t));
      boxUniforms.uOpacity.value = masterFade;
      bgUniforms.uFade.value = masterFade;
      pUniforms.uFade.value = masterFade;
      scene.background.setRGB(PALETTE.bg.r * masterFade, PALETTE.bg.g * masterFade, PALETTE.bg.b * masterFade);

      bgUniforms.uAccent.value.copy(boxUniforms.uTint.value);
      bgUniforms.uGlow.value = (0.004 + w[2] * 0.005 + w[3] * 0.006) * masterFade;
      for (const key of ['uTime', 'uWarm', 'uSpectral', 'uEmission', 'uGlass']) {
        ribbonUniforms[key].value = boxUniforms[key].value;
      }
      ribbonUniforms.uTint.value.copy(boxUniforms.uTint.value);

      // 3. Dynamic Metamorphic Matter Update from Choreography Frames
      let fIdx = 0;
      while (fIdx < frames.length - 2 && frames[fIdx + 1].time < t) fIdx++;
      const f0 = frames[fIdx];
      const f1 = frames[fIdx + 1];
      const u = smooth(f0.time, f1.time, t);

      const p0 = f0.positions, p1 = f1.positions;
      const s0 = f0.scales, s1 = f1.scales;
      const r0 = f0.rotations, r1 = f1.rotations;

      for (let i = 0; i < instanceCount; i++) {
        const i3 = i * 3;
        const pxVal = p0[i3] + (p1[i3] - p0[i3]) * u;
        const pyVal = p0[i3 + 1] + (p1[i3 + 1] - p0[i3 + 1]) * u;
        const pzVal = p0[i3 + 2] + (p1[i3 + 2] - p0[i3 + 2]) * u;

        const sxVal = s0[i3] + (s1[i3] - s0[i3]) * u;
        const syVal = s0[i3 + 1] + (s1[i3 + 1] - s0[i3 + 1]) * u;
        const szVal = s0[i3 + 2] + (s1[i3 + 2] - s0[i3 + 2]) * u;

        const rxVal = r0[i3] + (r1[i3] - r0[i3]) * u;
        const ryVal = r0[i3 + 1] + (r1[i3 + 1] - r0[i3 + 1]) * u;
        const rzVal = r0[i3 + 2] + (r1[i3 + 2] - r0[i3 + 2]) * u;

        dummy.position.set(pxVal, pyVal, pzVal);
        dummy.scale.set(sxVal, syVal, szVal);
        dummy.rotation.set(rxVal, ryVal, rzVal);
        dummy.updateMatrix();
        matterMesh.setMatrixAt(i, dummy.matrix);
      }
      matterMesh.instanceMatrix.needsUpdate = true;

      // Update structural link line vertices
      const linkAlpha = smooth(96, 100, t) * (1 - smooth(101, 103, t));
      linkLines.visible = linkAlpha > 0.01;
      if (linkLines.visible) {
        linkMat.opacity = linkAlpha * 0.45;
        const posAttr = linkGeo.attributes.position;
        const posArr = posAttr.array;
        for (let l = 0; l < links.length; l++) {
          const { a, b } = links[l];
          const a3 = a * 3, b3 = b * 3;
          const l6 = l * 6;
          posArr[l6] = p0[a3] + (p1[a3] - p0[a3]) * u;
          posArr[l6 + 1] = p0[a3 + 1] + (p1[a3 + 1] - p0[a3 + 1]) * u;
          posArr[l6 + 2] = p0[a3 + 2] + (p1[a3 + 2] - p0[a3 + 2]) * u;
          posArr[l6 + 3] = p0[b3] + (p1[b3] - p0[b3]) * u;
          posArr[l6 + 4] = p0[b3 + 1] + (p1[b3 + 1] - p0[b3 + 1]) * u;
          posArr[l6 + 5] = p0[b3 + 2] + (p1[b3 + 2] - p0[b3 + 2]) * u;
        }
        posAttr.needsUpdate = true;
      }

      // 5. Update Continuous Carrier Membrane & Authored Artifacts
      let rk = 0;
      while (rk < ribbonKeys.length - 2 && ribbonKeys[rk + 1][0] < t) rk++;
      const rk0 = ribbonKeys[rk], rk1 = ribbonKeys[rk + 1];
      const ru = smooth(rk0[0], rk1[0], t);
      ribbonUniforms.uFrom.value = rk0[1];
      ribbonUniforms.uTo.value = rk1[1];
      ribbonUniforms.uMorph.value = ru;
      ribbonUniforms.uOpacity.value = (rk0[2] + (rk1[2] - rk0[2]) * ru) * (isReduced ? 0.3 : 1);
      ribbonUniforms.uTime.value = m;
      membrane.visible = ribbonUniforms.uOpacity.value > 0.01;

      // Knowledge Tree & Fruits (35 - 58s)
      const claudeHold = windowAt(t, 45, 46, 48.5, 49.5);
      const treeAlpha = smooth(37, 44, t) * (1 - smooth(50, 54, t)) * (1 - claudeHold * 0.9);
      tree.visible = treeAlpha > 0.01;
      if (tree.visible) {
        treeMat.opacity = treeAlpha * 0.85;
        fruitMat.opacity = treeAlpha * 0.95;
        tree.rotation.y = isReduced ? 0 : m * 0.04;
      }

      // Faceted Prism & Light Shaft (58 - 81s)
      const geminiHold = windowAt(t, 69.2, 70, 71.5, 72.3);
      const prismAlpha = smooth(59, 66, t) * (1 - smooth(75, 78, t)) * (1 - geminiHold * 0.85);
      prism.visible = prismAlpha > 0.01;
      if (prism.visible) {
        prismUniforms.uOpacity.value = prismAlpha * 0.75;
        prismEdgeMat.opacity = prismAlpha * 0.9;
        prism.rotation.set(isReduced ? 0.1 : m * 0.12, isReduced ? 0.2 : m * 0.18, 0);
      }

      // Multimodal Media Slabs (58 - 81s)
      const mediaAlpha = smooth(60, 68, t) * (1 - smooth(72, 76, t)) * (1 - geminiHold * 0.9);
      mediaPlanes.forEach((plane, idx) => {
        plane.visible = mediaAlpha > 0.01;
        if (plane.visible) {
          mediaMat.uniforms.uOpacity.value = mediaAlpha;
          mediaMat.uniforms.uTime.value = m;
          const a = (idx / 7) * TAU + (isReduced ? 0 : m * 0.15);
          plane.position.set(Math.cos(a) * 5.2, Math.sin(a * 2) * 1.6, Math.sin(a) * 5.2);
          plane.rotation.set(0, a + Math.PI / 2, 0);
        }
      });

      // Processor Chip Glow (26 - 35s)
      const chipAlpha = smooth(26, 29, t) * (1 - smooth(33, 35, t));
      chip.visible = chipAlpha > 0.01;
      if (chip.visible) {
        chipMat.opacity = chipAlpha * (0.4 + smooth(30, 33, t) * 0.6);
      }

      // 4. Global Morphing Particle System
      pUniforms.uTime.value = t;
      pUniforms.uMotion.value = m;
      pUniforms.uPixel.value = renderer.getPixelRatio();

      composer.render();
    }

    resize();
    renderer.compile(scene, camera);
    renderFrame(0, { x: 0, y: 0 }, true);

    return {
      render: renderFrame,
      resize,
      dispose,
      setReducedMotion(value) {
        isReduced = Boolean(value);
      },
    };
  } catch (err) {
    dispose();
    throw err;
  }
}
