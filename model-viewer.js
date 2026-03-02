/**
 * model-viewer.js — 3D GLB renderer
 *
 * Improvements:
 *   • Bigger canvas (380px render / 320px CSS display)
 *   • Model "follows" cursor — both rotates AND slightly translates
 *     toward the mouse for a true "looking at cursor" feel
 *   • Faster lerp (0.12) for snappy response
 *   • Mouse rotation works whether or not the GLB has built-in animations
 */

(() => {

    if (typeof THREE === 'undefined') return;

    const canvas = document.getElementById('model-canvas');
    if (!canvas) return;

    const SIZE = 380; // internal render resolution

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(SIZE, SIZE);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 3.6);

    // ── Lighting ────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));

    const key = new THREE.DirectionalLight(0xFFE8C0, 3.2);
    key.position.set(3, 4, 3);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xC8DFFF, 1.0);
    fill.position.set(-3, 1, 2);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xFFD080, 1.4);
    rim.position.set(0, -2, -3);
    scene.add(rim);

    // ── Mouse state ─────────────────────────────────────────────────
    let nX = 0, nY = 0; // normalized cursor: -1 to 1

    window.addEventListener('mousemove', ({ clientX, clientY }) => {
        nX = (clientX / window.innerWidth - 0.5) * 2;
        nY = -(clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    // Current lerped values for rotation + translation
    let cRotX = 0, cRotY = 0;   // rotation
    let cPosX = 0, cPosY = 0;   // position drift

    // ── Load model ──────────────────────────────────────────────────
    let model, mixer;
    const clock = new THREE.Clock();

    const loaderScript = document.createElement('script');
    loaderScript.src = 'https://cdn.jsdelivr.net/npm/three@0.134.0/examples/js/loaders/GLTFLoader.js';
    loaderScript.onload = () => {
        new THREE.GLTFLoader().load(
            'Vrindopnishad - Official.glb',
            ({ scene: gltf, animations }) => {
                model = gltf;

                // Centre + fit
                const box = new THREE.Box3().setFromObject(model);
                const c = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const sc = 2.2 / Math.max(size.x, size.y, size.z);
                model.position.sub(c.multiplyScalar(sc));
                model.scale.setScalar(sc);
                scene.add(model);

                // Play embedded animations if present
                if (animations?.length) {
                    mixer = new THREE.AnimationMixer(model);
                    animations.forEach(clip => mixer.clipAction(clip).play());
                }

                // Breathing + floating via GSAP (runs alongside rotation fine)
                if (typeof gsap !== 'undefined') {
                    gsap.to(model.scale, {
                        x: sc * 1.05, y: sc * 1.05, z: sc * 1.05,
                        duration: 2.6, repeat: -1, yoyo: true, ease: 'sine.inOut'
                    });
                    gsap.to(model.position, {
                        y: '+=0.14',
                        duration: 2.9, repeat: -1, yoyo: true, ease: 'sine.inOut'
                    });
                }
            },
            null,
            () => fallback()
        );
    };
    loaderScript.onerror = () => fallback();
    document.head.appendChild(loaderScript);

    // ── Fallback geometry ───────────────────────────────────────────
    function fallback() {
        model = new THREE.Mesh(
            new THREE.IcosahedronGeometry(1, 3),
            new THREE.MeshStandardMaterial({ color: 0xFFD97A, roughness: 0.2, metalness: 0.7 })
        );
        scene.add(model);
        if (typeof gsap !== 'undefined') {
            gsap.to(model.rotation, { y: Math.PI * 2, duration: 5, repeat: -1, ease: 'none' });
        }
    }

    // ── Render loop ─────────────────────────────────────────────────
    (function loop() {
        requestAnimationFrame(loop);
        if (mixer) mixer.update(clock.getDelta());

        if (model) {
            const LERP = 0.90;  // very snappy — feels instant

            // Target rotation: wide range so it feels like model "looks at" cursor
            const tRotY = nX * 0.990;   // horizontal: ±0.95 rad (≈ ±54°)
            const tRotX = -nY * 0.990;   // vertical:   ±0.60 rad (≈ ±34°)

            // Target position drift: model physically moves toward cursor
            const tPosX = nX * 0.90;
            const tPosY = nY * 0.90;

            cRotX += (tRotX - cRotX) * LERP;
            cRotY += (tRotY - cRotY) * LERP;
            cPosX += (tPosX - cPosX) * LERP;
            cPosY += (tPosY - cPosY) * LERP;

            model.rotation.x = cRotX;
            model.rotation.y = cRotY;

            // Only override base position if no GSAP float is running (fallback case)
            if (!mixer && typeof gsap === 'undefined') {
                model.position.x = cPosX;
                model.position.y = cPosY;
            }
        }

        renderer.render(scene, camera);
    })();

})();
