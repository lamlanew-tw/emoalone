import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Global Vars
const { Engine, World, Bodies, Body, Runner, Composite, Mouse, MouseConstraint, Events, Query, Vector } = Matter;

let scene, camera, renderer, engine, world;
let introGroup; 
const INTRO_COUNT = 35; // 背景卡牌數量

// Hybrid Globals
let physicsEngine, physicsRunner;
let dollScene, dollCamera, dollRenderer;
let dollMeshes = [];
let isMatterActive = false;
let dollReqId;

// Assets
const CARD_TEXTURES = [
    './img/卡_1217圓-02.png', './img/卡_1217圓-04.png', './img/卡_1217圓-18.png',
    './img/卡_1217圓-38.png', './img/卡_1217圓-52.png', './img/卡_1217圓-102.png', './img/卡_1217圓-92.png'
];
const CARD_BACK_TEXTURE = ['./img/事件卡1.png', './img/事件卡2.png', './img/事件卡3.png']; 
const DOLL_MODEL_PATH = './model/emo棋.glb'; 

// ★ 文字排版：精準切割平均字數
const QUIZ_DATA = [
    { 
      q: "伴侶因為工作太累，忘記了你們期待已久的<br>紀念日晚餐，你的第一反應是？", 
      a1: "感到失落，但心想「他那麼辛苦，我不該<br>為這種小事發脾氣」，默默把委屈吞下去", 
      a2: "感到憤怒，並冷冷地說：「沒關係啊，<br>反正工作永遠比我重要，我早就習慣了」", 
      s1: "victim", s2: "blackmailer" 
    },
    { 
      q: "朋友臨時有事，取消了你們週末的旅行，<br>你在回覆訊息時會？", 
      a1: "趕緊說「沒關係啦，正事要緊！」但其實內心<br>充滿焦慮，擔心對方是不是不想跟自己出去", 
      a2: "嘆口氣回覆：「好吧，雖然我為了這趟旅行<br>推掉了其他約會，但既然你這麼忙就算了」", 
      s1: "victim", s2: "blackmailer" 
    },
    { 
      q: "家人總是過度干涉你的職涯選擇，常常說<br>「我們這都是為了你好」，你的感受是？", 
      a1: "覺得壓力很大、很痛苦，但又覺得如果<br>不聽他們的話，自己就是個不知感恩的人", 
      a2: "覺得不耐煩，反嗆：「你們根本不懂我！<br>如果我以後過得不好，都是你們害的！」", 
      s1: "victim", s2: "blackmailer" 
    },
    { 
      q: "團隊合作時，同事把應該他負責的<br>麻煩工作推到你身上，你會怎麼做？", 
      a1: "不知如何拒絕，怕破壞辦公室的<br>和平氣氛，只好加班默默把事情做完", 
      a2: "在群組標記他：「如果這個專案因為你進度<br>落後，大家的心血就全毀了，你自己看著辦」", 
      s1: "victim", s2: "blackmailer" 
    },
    { 
      q: "當你和親密的人發生激烈爭吵，對方為了冷靜<br>選擇先離開現場，你的內心戲是？", 
      a1: "陷入恐慌，覺得自己做錯了什麼即將被拋棄，<br>想立刻傳長篇大論道歉求對方回來", 
      a2: "覺得被挑戰底線，心想：「你今天敢<br>踏出這個門，我們之間就完了」", 
      s1: "victim", s2: "blackmailer" 
    }
];

let currentQ = 0, scores = { victim: 0, blackmailer: 0 };

document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader-wrap');
    if(loader) loader.style.display = 'none';

    window.toggleMenu = () => {
        const menu = document.getElementById('mobile-menu-overlay');
        const burger = document.querySelector('.hamburger');
        menu.classList.toggle('active');
        burger.classList.toggle('active');
    };

    window.openQuizModal = () => {
        document.getElementById('quiz-modal').classList.remove('hidden');
        startQuiz();
    };
    
    window.closeModal = (id) => document.getElementById(id).classList.add('hidden');
    
    window.handleDecrypt = () => {
        const input = document.getElementById('user-input');
        if(input && input.value.trim().length < 1) { 
            alert("請先輸入內容喔！"); return; 
        }
        document.getElementById('decrypt-input-state').classList.add('hidden');
        document.getElementById('decrypt-result-state').classList.remove('hidden');
    };
    
    window.resetDecrypt = () => {
        document.getElementById('user-input').value = "";
        document.getElementById('decrypt-input-state').classList.remove('hidden');
        document.getElementById('decrypt-result-state').classList.add('hidden');
    };
    
    window.restartQuiz = () => startQuiz();
    
    window.showQuotesBlock = () => {
        document.getElementById('result-blackmailer').classList.add('hidden');
        document.getElementById('result-quotes').classList.remove('hidden');
    };
    
    window.goToDecryptInput = () => {
        document.getElementById('quiz-modal').classList.add('hidden');
        document.getElementById('decrypt-modal').classList.remove('hidden'); 
        window.resetDecrypt();
    };

    window.answer = (c) => { 
        scores[c===1?'victim':'blackmailer']++; 
        currentQ++; 
        renderQuiz(); 
    };

    const input = document.getElementById('user-input');
    if(input) input.addEventListener("keypress", (e) => { if (e.key === "Enter") window.handleDecrypt(); });

    const bttBtn = document.getElementById('back-to-top');
    if (bttBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                bttBtn.classList.add('show');
            } else {
                bttBtn.classList.remove('show');
            }
        });
    }

    initInteractiveCube();

    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined' && typeof Matter !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
        
        if(document.getElementById('webgl-container')) initThree();
        
        ScrollTrigger.create({
            trigger: "#quiz-entry",
            start: "top bottom",
            onEnter: initHybridPhysics,
            onLeaveBack: stopHybridPhysics
        });

        initParallaxImages();
        initFogAnimation(); 
        animate();
    }
});

function initInteractiveCube() {
    const cubeWrapper = document.querySelector('.cube-wrapper');
    const cube = document.querySelector('.cube');
    const reloadBtn = document.getElementById('reload-box-btn');
    if (!cubeWrapper || !cube) return;

    let rot = { x: -15, y: 25 };         
    let targetRot = { x: -15, y: 25 };   
    let state = { z: 0, scale: 1 }; 
    
    let isDragging = false;
    let isReloading = false;
    let prevMouse = { x: 0, y: 0 };

    const getBaseZ = () => window.innerWidth <= 768 ? -50 : 0;

    const onDown = (e) => {
        if (isReloading || !e.target.closest('.cube')) return;
        isDragging = true;
        
        const touch = e.touches ? e.touches[0] : e;
        prevMouse = { x: touch.clientX, y: touch.clientY };
        cube.style.cursor = 'grabbing';
        
        gsap.killTweensOf(targetRot); 
    };

    const onMove = (e) => {
        if (!isDragging || isReloading) return;
        e.preventDefault(); 
        
        const touch = e.touches ? e.touches[0] : e;
        const dx = touch.clientX - prevMouse.x;
        const dy = touch.clientY - prevMouse.y;
        
        targetRot.y += dx * 0.4;
        targetRot.x -= dy * 0.4;

        prevMouse = { x: touch.clientX, y: touch.clientY };
    };

    const onUp = () => {
        if (!isDragging) return;
        isDragging = false;
        cube.style.cursor = 'grab';
    };

    cubeWrapper.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove, { passive: false });
    document.addEventListener('mouseup', onUp);
    cubeWrapper.addEventListener('touchstart', onDown, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);

    if (reloadBtn) {
        reloadBtn.addEventListener('click', () => {
            if (isReloading) return;
            isReloading = true;
            isDragging = false;

            let finalRotX = targetRot.x;
            let finalRotY = targetRot.y;

            gsap.to(state, {
                z: -1500,
                scale: 0,
                duration: 0.7,
                ease: "power2.in"
            });

            gsap.to(targetRot, {
                x: targetRot.x + 360,
                y: targetRot.y - 360,
                duration: 0.7,
                ease: "power2.in",
                onComplete: () => {
                    state.z = -500; 
                    rot.x = finalRotX;
                    rot.y = finalRotY;
                    targetRot.x = finalRotX;
                    targetRot.y = finalRotY;
                    
                    gsap.to(state, {
                        z: 0,
                        scale: 1,
                        duration: 1.2,
                        ease: "expo.out",
                        onComplete: () => {
                            isReloading = false;
                        }
                    });
                }
            });
        });
    }

    function loopCube() {
        if (!isDragging && !isReloading) {
            targetRot.y += 0.05;
        }
        
        rot.x += (targetRot.x - rot.x) * 0.1;
        rot.y += (targetRot.y - rot.y) * 0.1;

        cube.style.transform = `translateZ(${getBaseZ() + state.z}px) scale(${state.scale}) rotateX(${rot.x}deg) rotateY(${rot.y}deg)`;
        requestAnimationFrame(loopCube);
    }
    loopCube();
}


function initFogAnimation() {
    window.addEventListener('load', () => ScrollTrigger.refresh());

    const tl = gsap.timeline({ scrollTrigger: { trigger: "#knowledge-section", start: "top 80%" } });
    
    tl.fromTo(".fog-header", { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1 });
    
    gsap.fromTo(".fog-card", 
        { y: 50, opacity: 0 }, 
        { scrollTrigger: { trigger: ".fog-grid", start: "top 80%" }, y: 0, opacity: 1, duration: 1, stagger: 0.2 }
    );
    
    gsap.fromTo(".timeline-line", 
        { height: 0 }, 
        { scrollTrigger: { trigger: ".timeline-container", start: "top 80%" }, height: "100%", duration: 1.5, ease: "none" }
    );
    
    gsap.utils.toArray(".timeline-item").forEach(item => { 
        gsap.fromTo(item, 
            { y: 30, opacity: 0 }, 
            { scrollTrigger: { trigger: item, start: "top 85%" }, y: 0, opacity: 1, duration: 0.8 }
        ); 
    });
    
    gsap.fromTo(".sos-tactical-card", 
        { y: 50, opacity: 0 }, 
        { scrollTrigger: { trigger: ".sos-section", start: "top 80%" }, y: 0, opacity: 1, duration: 0.8, stagger: 0.2 }
    );
}

function initParallaxImages() {
    if (window.innerWidth <= 768) return; 

    const images = document.querySelectorAll('.images img');
    images.forEach(img => {
        const speed = img.getAttribute('data-speed') || 1;
        gsap.to(img, { 
            y: -10 * speed, 
            scrollTrigger: { 
                trigger: "#section-2", 
                start: "top 70%", 
                end: "bottom top", 
                scrub: true 
            }, 
            force3D: true, 
            ease: "none" 
        });
    });
}

function startQuiz() {
    currentQ = 0; scores = { victim: 0, blackmailer: 0 }; 
    const modalContent = document.querySelector('#quiz-modal .modal-content');
    if(modalContent) modalContent.classList.remove('result-mode');
    ['result-blackmailer', 'result-victim', 'result-quotes'].forEach(id => { const el = document.getElementById(id); if(el) el.classList.add('hidden'); });
    const qBlock = document.getElementById('quiz-question-block');
    if(qBlock) qBlock.classList.remove('hidden');
    renderQuiz(); 
}

function renderQuiz() {
    const container = document.getElementById('quiz-container');
    const modalContent = document.querySelector('#quiz-modal .modal-content');
    const resultBlackmailer = document.getElementById('result-blackmailer');
    const resultVictim = document.getElementById('result-victim');
    if(!container) return;
    
    if(currentQ >= QUIZ_DATA.length) {
        document.getElementById('quiz-question-block').classList.add('hidden');
        modalContent.classList.add('result-mode');
        if (scores.blackmailer > scores.victim) resultBlackmailer.classList.remove('hidden');
        else resultVictim.classList.remove('hidden');
        return;
    }
    const d = QUIZ_DATA[currentQ];
    
    // ★ 關鍵修復：用 <span> 把文字包起來，這樣 <br> 標籤在 Flex 容器裡才不會失效，保證排版絕對精準對稱！
    container.innerHTML = `
        <div style="font-size:5rem; font-family:serif; margin-bottom:10px; color:#ddd;">${(currentQ + 1).toString().padStart(2, '0')}</div>
        <h3 style="font-size:1.3rem; margin-bottom:30px; color:#333; line-height: 1.6; text-align: center; display: flex; align-items: center; justify-content: center; height: 85px;">
            <span>${d.q}</span>
        </h3>
        <div class="quiz-options">
            <button class="quiz-option-btn" onclick="window.answer(1)">
                <span>${d.a1}</span>
            </button>
            <button class="quiz-option-btn" onclick="window.answer(2)">
                <span>${d.a2}</span>
            </button>
        </div>
    `;
}

// ★★★ GLB + Matter.js Hybrid Engine ★★★
function initHybridPhysics() {
    if (isMatterActive) return;
    isMatterActive = true;
    
    const container = document.getElementById('matter-container');
    container.innerHTML = ''; 
    const w = container.clientWidth;
    const h = container.clientHeight;

    physicsEngine = Engine.create();
    physicsEngine.world.gravity.y = 0; 
    const world = physicsEngine.world;

    const thick = 200;
    const wallOpts = { isStatic: true, restitution: 1, friction: 0 };
    const ground = Bodies.rectangle(w / 2, h + thick/2, w + thick*2, thick, wallOpts);
    const roof = Bodies.rectangle(w / 2, -thick/2, w + thick*2, thick, wallOpts);
    const wallL = Bodies.rectangle(-thick/2, h / 2, thick, h + thick*2, wallOpts);
    const wallR = Bodies.rectangle(w + thick/2, h / 2, thick, h + thick*2, wallOpts);
    
    const dollsBodies = [];
    const DOLL_SIZE = 120; 
    
    for (let i = 0; i < 8; i++) {
        const physicsRadius = (DOLL_SIZE / 2) * 1.35;
        const body = Bodies.circle(Math.random() * w, Math.random() * h, physicsRadius, { 
            restitution: 0.6, 
            frictionAir: 0.01 
        });
        Body.setVelocity(body, { x: (Math.random()-0.5)*5, y: (Math.random()-0.5)*5 });
        dollsBodies.push(body);
    }
    Composite.add(world, [ground, roof, wallL, wallR, ...dollsBodies]);

    let currentMousePos = { x: -1000, y: -1000 };
    
    const updateRepelPos = (clientX, clientY) => {
        if(!container) return;
        const rect = container.getBoundingClientRect();
        currentMousePos.x = clientX - rect.left;
        currentMousePos.y = clientY - rect.top;
    };

    window.addEventListener('mousemove', (e) => updateRepelPos(e.clientX, e.clientY));
    
    window.addEventListener('touchmove', (e) => {
        if(e.touches.length > 0) updateRepelPos(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    
    window.addEventListener('touchstart', (e) => {
        if(e.touches.length > 0) updateRepelPos(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    
    window.addEventListener('touchend', () => {
        currentMousePos = { x: -1000, y: -1000 }; 
    });

    Events.on(physicsEngine, 'beforeUpdate', function() {
        const blastRadius = 100; 
        const forceStrength = 0.02; 

        const bodiesNearMouse = Query.region(dollsBodies, {
            min: { x: currentMousePos.x - blastRadius, y: currentMousePos.y - blastRadius },
            max: { x: currentMousePos.x + blastRadius, y: currentMousePos.y + blastRadius }
        });

        bodiesNearMouse.forEach(body => {
            let forceVector = Vector.sub(body.position, currentMousePos);
            forceVector = Vector.normalise(forceVector);
            const finalForce = Vector.mult(forceVector, forceStrength * body.mass);
            Body.applyForce(body, body.position, finalForce);
        });
    });

    dollScene = new THREE.Scene();
    dollCamera = new THREE.OrthographicCamera(w / -2, w / 2, h / 2, h / -2, 1, 1000);
    dollCamera.position.z = 500;

    dollRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    dollRenderer.setSize(w, h);
    dollRenderer.setPixelRatio(window.devicePixelRatio);
    dollRenderer.outputColorSpace = THREE.SRGBColorSpace; 
    container.appendChild(dollRenderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); 
    dollScene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5); 
    dirLight.position.set(200, 300, 500); 
    dollScene.add(dirLight);

    dollMeshes = [];
    const loader = new GLTFLoader();

    loader.load(DOLL_MODEL_PATH, (gltf) => {
        const model = gltf.scene;

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        model.position.sub(center); 

        model.traverse((child) => {
            if (child.isMesh) {
                child.material.transparent = true;
                child.material.opacity = 0.85; 
                child.material.color.setHex(0x00999a); 
                child.material.roughness = 0.25; 
                child.material.metalness = 0.4; 
                child.material.depthWrite = false; 
                child.material.needsUpdate = true;
            }
        });

        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleTarget = DOLL_SIZE / maxDim; 

        const wrapper = new THREE.Group();
        wrapper.add(model);
        wrapper.scale.set(scaleTarget, scaleTarget, scaleTarget);

        dollsBodies.forEach(body => {
            const clone = wrapper.clone();
            clone.rotation.x = Math.random() * Math.PI;
            clone.rotation.y = Math.random() * Math.PI;
            dollScene.add(clone);
            dollMeshes.push({ mesh: clone, body: body });
        });
    }, undefined, (err) => {
        console.warn(`GLB 載入失敗 (${DOLL_MODEL_PATH})，使用備用方塊。請確認檔案路徑。`, err);
        const geo = new THREE.BoxGeometry(DOLL_SIZE, DOLL_SIZE, DOLL_SIZE);
        const mat = new THREE.MeshStandardMaterial({ color: 0x00999a }); 
        dollsBodies.forEach(body => {
            const mesh = new THREE.Mesh(geo, mat);
            dollScene.add(mesh);
            dollMeshes.push({ mesh: mesh, body: body });
        });
    });

    const mouse = Mouse.create(dollRenderer.domElement);
    mouse.pixelRatio = window.devicePixelRatio || 1;
    mouse.element.removeEventListener("mousewheel", mouse.mousewheel);
    mouse.element.removeEventListener("DOMMouseScroll", mouse.mousewheel);

    const mouseConstraint = MouseConstraint.create(physicsEngine, {
        mouse: mouse,
        constraint: { stiffness: 0.2, render: { visible: false } }
    });
    Composite.add(world, mouseConstraint);

    physicsRunner = Runner.create();
    Runner.run(physicsRunner, physicsEngine);

    function animateDolls() {
        dollReqId = requestAnimationFrame(animateDolls);
        dollMeshes.forEach(obj => {
            obj.mesh.position.x = obj.body.position.x - w / 2;
            obj.mesh.position.y = -(obj.body.position.y - h / 2);
            obj.mesh.rotation.z = -obj.body.angle;
            obj.mesh.rotation.x += obj.body.speed * 0.01;
            obj.mesh.rotation.y += obj.body.speed * 0.01;
        });
        dollRenderer.render(dollScene, dollCamera);
    }
    animateDolls();
}

function stopHybridPhysics() {
    if (!isMatterActive) return;
    Runner.stop(physicsRunner);
    cancelAnimationFrame(dollReqId);
    if(dollRenderer) {
        dollRenderer.dispose();
        dollRenderer.domElement.remove();
    }
    physicsEngine = null;
    physicsRunner = null;
    dollScene = null;
    dollCamera = null;
    dollRenderer = null;
    dollMeshes = [];
    isMatterActive = false;
}

function initThree() {
    const container = document.getElementById('webgl-container');
    if (!container) return;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 1, 3000);
    camera.position.z = 600; 
    
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    
    const ambient = new THREE.AmbientLight(0xffffff, 0.8); scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); dirLight.position.set(500, 500, 1000); scene.add(dirLight);

    const textureLoader = new THREE.TextureLoader();
    introGroup = new THREE.Group(); scene.add(introGroup);
    
    const loadTexture = (path) => {
        return textureLoader.load(path, (t) => { t.colorSpace = THREE.SRGBColorSpace; });
    };

    for(let i=0; i<INTRO_COUNT; i++) {
        const frontPath = CARD_TEXTURES[i % CARD_TEXTURES.length];
        const backPath = CARD_BACK_TEXTURE[i % CARD_BACK_TEXTURE.length]; 
        
        const frontTex = loadTexture(frontPath);
        const backTex = loadTexture(backPath);

        const cardGroup = createDoubleSidedCard(frontTex, backTex);
        cardGroup.userData.index = i; 
        resetIntroCard(cardGroup, true);
        introGroup.add(cardGroup);
    }
    window.addEventListener('resize', onResize);
}

function createDoubleSidedCard(front, back) {
    const width = 150, height = 250, radius = 20, depth = 0.2; 
    
    const shape = new THREE.Shape();
    shape.moveTo(-width/2 + radius, height/2);
    shape.lineTo(width/2 - radius, height/2);
    shape.absarc(width/2 - radius, height/2 - radius, radius, Math.PI/2, 0, true);
    shape.lineTo(width/2, -height/2 + radius);
    shape.absarc(width/2 - radius, -height/2 + radius, radius, 0, -Math.PI/2, true);
    shape.lineTo(-width/2 + radius, -height/2);
    shape.absarc(-width/2 + radius, -height/2 + radius, radius, -Math.PI/2, Math.PI, true);
    shape.lineTo(-width/2, height/2 - radius);
    shape.absarc(-width/2 + radius, height/2 - radius, radius, Math.PI, Math.PI/2, true);

    const grp = new THREE.Group();
    const faceGeo = new THREE.ShapeGeometry(shape); 
    fixUVs(faceGeo);

    const f = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ 
        map: front, color: 0xffffff, transparent: true,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    })); 
    f.position.z = depth / 2 + 0.5; 
    grp.add(f);

    // ★ 修復：new Mesh -> new THREE.Mesh，解決 3D 背景報錯問題
    const b = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ 
        map: back, color: 0xffffff, transparent: true,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    })); 
    b.rotation.y = Math.PI; 
    b.position.z = -(depth / 2 + 0.5); 
    grp.add(b);

    const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false, steps: 1 });
    bodyGeo.center();

    const bodyMesh = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    grp.add(bodyMesh);

    return grp;
}

function fixUVs(geo) { 
    geo.computeBoundingBox(); 
    const max = geo.boundingBox.max, min = geo.boundingBox.min; 
    const w = max.x - min.x, h = max.y - min.y; 
    const uv = geo.attributes.uv, pos = geo.attributes.position; 
    for(let i=0; i<pos.count; i++) {
        uv.setXY(i, (pos.getX(i)-min.x)/w, (pos.getY(i)-min.y)/h); 
    }
    uv.needsUpdate = true; 
}

function resetIntroCard(card, isInit = false) { 
    const uniqueZ = -150 - (Math.random() * 200); 

    if (isInit) {
        card.position.x = 0; 
        card.position.y = 0; 
        card.position.z = uniqueZ;

        const aspect = window.innerWidth / window.innerHeight;
        const t = card.userData.index / INTRO_COUNT;
        const theta = Math.atan2(Math.sin(t * Math.PI * 2) * aspect, Math.cos(t * Math.PI * 2));

        const baseBurstForce = 15 + Math.random() * 15; 
        const randomDirShuffle = (Math.random() - 0.5) * 0.3;

        card.userData.vx = Math.cos(theta + randomDirShuffle) * baseBurstForce;
        card.userData.vy = Math.sin(theta + randomDirShuffle) * baseBurstForce;
        
        card.userData.baseSpeed = 0.5 + Math.random() * 0.5; 
        card.userData.baseRotX = (Math.random() - 0.5) * 0.006; 
        card.userData.baseRotY = (Math.random() - 0.5) * 0.006;  
        
        card.userData.burstRotX = (Math.random() - 0.5) * 0.15;
        card.userData.burstRotY = (Math.random() - 0.5) * 0.15;
    } else {
        card.position.x = (Math.random() - 0.5) * window.innerWidth * 0.9;
        card.position.y = -window.innerHeight * 0.8 - (Math.random() * 200); 
        card.position.z = uniqueZ;
        
        card.userData.vx = 0; 
        card.userData.vy = 0;
        card.userData.burstRotX = 0;
        card.userData.burstRotY = 0;
        
        card.userData.baseSpeed = 0.5 + Math.random() * 0.5; 
        card.userData.baseRotX = (Math.random() - 0.5) * 0.006; 
        card.userData.baseRotY = (Math.random() - 0.5) * 0.006;  
    }
    
    card.rotation.x = Math.random() * Math.PI; 
    card.rotation.y = Math.random() * Math.PI; 
}

function animate() { 
    requestAnimationFrame(animate); 
    
    if(introGroup) {
        const edgeX = window.innerWidth * 0.48; 
        const cards = introGroup.children;
        
        const MIN_DIST = 220; 
        for (let i = 0; i < cards.length; i++) {
            for (let j = i + 1; j < cards.length; j++) {
                const c1 = cards[i];
                const c2 = cards[j];
                
                const dx = c1.position.x - c2.position.x;
                const dy = c1.position.y - c2.position.y;
                const dz = c1.position.z - c2.position.z;
                const distSq = dx*dx + dy*dy + dz*dz;
                
                if (distSq < MIN_DIST * MIN_DIST && distSq > 0) {
                    const dist = Math.sqrt(distSq);
                    const force = (MIN_DIST - dist) * 0.001; 
                    
                    c1.userData.vx += (dx / dist) * force;
                    c1.userData.vy += (dy / dist) * force;
                    c2.userData.vx -= (dx / dist) * force;
                    c2.userData.vy -= (dy / dist) * force;
                }
            }
        }

        cards.forEach(c => { 
            c.position.x += c.userData.vx;
            c.position.y += c.userData.vy;

            c.userData.vx *= 0.93;
            c.userData.vy *= 0.93;
            c.userData.burstRotX *= 0.95;
            c.userData.burstRotY *= 0.95;

            c.position.y += c.userData.baseSpeed; 
            c.rotation.x += c.userData.baseRotX + c.userData.burstRotX; 
            c.rotation.y += c.userData.baseRotY + c.userData.burstRotY; 

            if (c.position.x > edgeX) {
                c.position.x -= (c.position.x - edgeX) * 0.05;
            } else if (c.position.x < -edgeX) {
                c.position.x -= (c.position.x + edgeX) * 0.05;
            }

            if(c.position.y > window.innerHeight * 1.5) {
                resetIntroCard(c, false); 
            }
        }); 
    }
    
    camera.lookAt(scene.position); 
    renderer.render(scene, camera); 
}

function onResize() { 
    camera.aspect = window.innerWidth/window.innerHeight; 
    camera.updateProjectionMatrix(); 
    renderer.setSize(window.innerWidth, window.innerHeight); 
}
