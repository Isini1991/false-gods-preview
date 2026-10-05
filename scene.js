import * as THREE from './vendor/three.module.js';
import { setupTilt } from './tilt.js';

const canvas = document.querySelector('#depth-scene');
const stage = document.querySelector('.scene');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const target = new THREE.Vector2();
const pointer = new THREE.Vector2();
let renderer, camera, scene, background, foreground, logo, width, height;
let currentFrame = 0;
let visible = true;
let ready = false;
let currentScroll = 0;
let foregroundOrigin = 0;
let photoAspect = 1200 / 798;
let touchingScene = false, resumeMotionAt = 0, lastRenderTime = 0;
let tiltActive = false;

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const photoShader = `
  uniform sampler2D photo;
  uniform sampler2D cutout;
  uniform sampler2D expanded;
  uniform float bottomFade;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(expanded, vUv);
    float fade = bottomFade > 0.0 ? smoothstep(0.0, bottomFade, vUv.y) : 1.0;
    gl_FragColor = vec4(c.rgb, c.a * fade);
  }
`;
const backdropShader = `
  uniform sampler2D photo;
  uniform vec2 resolution;
  uniform vec2 imageSize;
  uniform float top;
  uniform vec2 offset;
  varying vec2 vUv;
  void main() {
    vec2 pixel = vUv * resolution;
    vec2 uv = vec2((pixel.x - offset.x) / imageSize.x, 1.0 - (resolution.y - pixel.y - top - offset.y) / imageSize.y);
    vec2 texel = 4.0 / imageSize;
    uv = clamp(uv, vec2(0.004), vec2(0.996));
    vec3 c = texture2D(photo, uv).rgb * 0.28;
    c += texture2D(photo, uv + vec2(texel.x, 0.0)).rgb * 0.12;
    c += texture2D(photo, uv - vec2(texel.x, 0.0)).rgb * 0.12;
    c += texture2D(photo, uv + vec2(0.0, texel.y)).rgb * 0.12;
    c += texture2D(photo, uv - vec2(0.0, texel.y)).rgb * 0.12;
    c += texture2D(photo, uv + texel).rgb * 0.12;
    c += texture2D(photo, uv - texel).rgb * 0.12;
    gl_FragColor = vec4(c * 0.58, 1.0);
  }
`;

function schedule() {
  if (ready && visible && !document.hidden && !currentFrame) currentFrame = requestAnimationFrame(render);
}

function layout() {
  width = stage.clientWidth;
  height = stage.clientHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  camera.left = -width / 2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.updateProjectionMatrix();

  const logoSize = width < 600 ? Math.min(width * 0.66, 290) : Math.min(width * 0.50, height * 0.46, 430);
  const logoTop = 60;
  const headAnchor = logoTop + logoSize * 0.72;
  const headFraction = 40 / 866;
  const fittedHeight = (height + 18 - headAnchor) / (1 - headFraction);
  const photoHeight = width < 600 ? width * 1.30 / photoAspect : Math.min(width * 0.98 / photoAspect, fittedHeight);
  const photoWidth = photoHeight * photoAspect;
  const photoTop = headAnchor - photoHeight * headFraction;
  foregroundOrigin = height / 2 - photoTop - photoHeight / 2;
  foreground.scale.set(photoWidth, photoHeight, 1);
  foreground.material.uniforms.bottomFade.value = width < 600 ? 0.30 : 0.0;
  foreground.position.set(width < 600 ? -width * .04 : 0, foregroundOrigin, 6);
  background.scale.set(width, height, 1);
  const backdropAspect = background.material.uniforms.photo.value.image.width / background.material.uniforms.photo.value.image.height;
  const backdropWidth = Math.max(width, height * backdropAspect) * 1.04;
  const backdropHeight = backdropWidth / backdropAspect;
  background.material.uniforms.resolution.value.set(width, height);
  background.material.uniforms.imageSize.value.set(backdropWidth, backdropHeight);
  background.material.uniforms.top.value = (height - backdropHeight) * 0.25;
  background.userData.originX = (width - backdropWidth) / 2;
  background.material.uniforms.offset.value.set(background.userData.originX, 0);

  logo.scale.set(logoSize, logoSize, 1);
  logo.position.set(0, height / 2 - logoTop - logoSize / 2, 3);
  logo.userData.originY = logo.position.y;
  stage.dataset.logoSize = String(logoSize);
  stage.dataset.logoTop = String(logoTop);
  currentScroll = window.scrollY;
  schedule();
}

function render(time = performance.now()) {
  currentFrame = 0;
  const mobile = width < 600;
  const automatic = mobile && visible && !document.hidden && !reducedMotion.matches && !document.documentElement.classList.contains('intro-active');
  if (automatic && time - lastRenderTime < 32) { schedule(); return; }
  lastRenderTime = time;
  if (automatic && !tiltActive && !touchingScene && time >= resumeMotionAt) {
    target.set(Math.sin(time / 2800) * .45, Math.sin(time / 3700) * .28);
  }
  const dt = 0.075;
  pointer.lerp(reducedMotion.matches ? new THREE.Vector2() : target, dt);
  currentScroll += (window.scrollY - currentScroll) * dt;
  const scroll = reducedMotion.matches || width >= 600 ? 0 : Math.min(currentScroll / height, 1);
  foreground.position.x = (mobile ? -width * .04 : 0) + pointer.x * (mobile ? 10 : 7);
  foreground.position.y = foregroundOrigin - pointer.y * 4 + scroll * 20;
  logo.position.x = -pointer.x * (mobile ? 7 : 5);
  logo.position.y = logo.userData.originY + pointer.y * 3 + scroll * 7;
  background.material.uniforms.offset.value.set(background.userData.originX - pointer.x * (mobile ? 5 : 3), pointer.y * 2 + scroll * 2);
  stage.dataset.parallaxX = pointer.x.toFixed(4);
  stage.dataset.parallaxY = pointer.y.toFixed(4);
  renderer.render(scene, camera);
  if (automatic || pointer.distanceTo(target) > 0.002 && !reducedMotion.matches || Math.abs(currentScroll - window.scrollY) > 0.5) schedule();
}

async function initialise() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
    renderer.setClearColor(0x17191a);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.z = 20;
    const loader = new THREE.TextureLoader();
    const [photo, cutout, plate, mark, expanded] = await Promise.all([
      loader.loadAsync('assets/band-enhanced.png'),
      loader.loadAsync('assets/band-cutout.png'),
      loader.loadAsync('assets/alley-background.png'),
      loader.loadAsync('assets/false-gods-white.svg'),
      loader.loadAsync('assets/band-expanded-v2.png'),
    ]);
    photoAspect = expanded.image.width / expanded.image.height;
    [photo, cutout, plate, mark, expanded].forEach(texture => {
      texture.colorSpace = THREE.NoColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
    });
    const geometry = new THREE.PlaneGeometry(1, 1);
    background = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      vertexShader, fragmentShader: backdropShader,
      uniforms: { photo: { value: plate }, resolution: { value: new THREE.Vector2() }, imageSize: { value: new THREE.Vector2() }, top: { value: 0 }, offset: { value: new THREE.Vector2() } },
    }));
    foreground = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      vertexShader, fragmentShader: photoShader, transparent: true, depthWrite: false,
      uniforms: { photo: { value: photo }, cutout: { value: cutout }, expanded: { value: expanded }, bottomFade: { value: 0 } },
    }));
    logo = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: `uniform sampler2D mark; varying vec2 vUv; void main() { vec4 c = texture2D(mark, vUv); gl_FragColor = vec4(c.rgb, c.a * 0.94); }`,
      transparent: true, depthWrite: false, uniforms: { mark: { value: mark } },
    }));
    background.renderOrder = 0;
    logo.renderOrder = 1;
    foreground.renderOrder = 2;
    scene.add(background, logo, foreground);
    ready = true;
    layout();
    renderer.render(scene, camera);
    stage.classList.add('ready');
    document.body.dataset.sceneStatus = 'ready';
    new ResizeObserver(layout).observe(stage);
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }).observe(stage);
    function trackScene(event) {
      if (reducedMotion.matches) return;
      const rect = stage.getBoundingClientRect();
      resumeMotionAt = performance.now() + 1800;
      target.set(THREE.MathUtils.clamp((event.clientX - rect.left) / width * 2 - 1, -1, 1), THREE.MathUtils.clamp((event.clientY - rect.top) / height * 2 - 1, -1, 1));
      schedule();
    }
    stage.addEventListener('pointermove', trackScene, { passive: true });
    stage.addEventListener('pointerdown', event => { touchingScene = event.pointerType !== 'mouse'; trackScene(event); }, { passive: true });
    function releaseScene() { touchingScene = false; resumeMotionAt = performance.now() + 1800; target.set(0, 0); schedule(); }
    stage.addEventListener('pointerup', releaseScene);
    stage.addEventListener('pointercancel', releaseScene);
    stage.addEventListener('pointerleave', () => { target.set(0, 0); schedule(); });
    window.addEventListener('scroll', schedule, { passive: true });
    document.addEventListener('visibilitychange', schedule);
    new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    reducedMotion.addEventListener('change', () => { target.set(0, 0); schedule(); });
    setupTilt((x, y) => {
      if (!visible || document.hidden || reducedMotion.matches) return;
      target.set(x, y);
      schedule();
    }, active => { tiltActive = active; target.set(0, 0); schedule(); });
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); ready = false; stage.classList.remove('ready'); document.body.dataset.sceneStatus = 'fallback'; });
    canvas.addEventListener('webglcontextrestored', () => location.reload());
  } catch (error) {
    stage.classList.remove('ready');
    document.body.dataset.sceneStatus = 'fallback';
    console.error('Entrance scene could not load:', error);
  }
}

initialise();
