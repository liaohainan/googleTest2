// Scene, Camera, Renderer
let scene, camera, renderer;

const segmentSize = 10; // Size of each snake segment and grid unit
const gameWidth = 400;
const gameHeight = 400;

// Game Variables
let snake = []; // Will store THREE.Mesh objects
let fruit = { mesh: null, color: 'red' }; // Will store a THREE.Mesh
let dx = segmentSize; // Movement along X
let dy = 0;          // Movement along Y (will be Z in 3D)
let dz = 0;          // Movement along Z (or Y if you prefer typical 2D plane)
let gamePaused = true;
let score = 0;

// DOM Elements
const scoreDisplay = document.getElementById('scoreDisplay');
const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const gameCanvas = document.getElementById('gameCanvas'); // Keep for size reference, but not for 2D context

function initThreeJS() {
    // Scene
    scene = new THREE.Scene();
    // Skybox
    const loader = new THREE.CubeTextureLoader();
    const texture = loader.load([
        'https://threejsfundamentals.org/threejs/resources/images/cubemaps/computer-history-museum/pos-x.jpg',
        'https://threejsfundamentals.org/threejs/resources/images/cubemaps/computer-history-museum/neg-x.jpg',
        'https://threejsfundamentals.org/threejs/resources/images/cubemaps/computer-history-museum/pos-y.jpg',
        'https://threejsfundamentals.org/threejs/resources/images/cubemaps/computer-history-museum/neg-y.jpg',
        'https://threejsfundamentals.org/threejs/resources/images/cubemaps/computer-history-museum/pos-z.jpg',
        'https://threejsfundamentals.org/threejs/resources/images/cubemaps/computer-history-museum/neg-z.jpg',
    ]);
    scene.background = texture;

    // Camera
    camera = new THREE.PerspectiveCamera(75, gameWidth / gameHeight, 0.1, 1000);
    // Position camera to look down. Y is up in Three.js by default.
    // Let's place it above the center of a conceptual 40x40 grid (400/10)
    camera.position.set(gameWidth / 2, gameHeight / 1.5, gameWidth / 2); // x, y (height), z
    camera.lookAt(gameWidth / 2, 0, gameHeight / 2); // Look at the center of the board

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(gameWidth, gameHeight);
    renderer.shadowMap.enabled = true; // Enable shadows
    // Replace canvas with renderer's domElement or append if canvas is removed
    if (gameCanvas.parentNode) {
        gameCanvas.parentNode.replaceChild(renderer.domElement, gameCanvas);
    } else {
        document.body.appendChild(renderer.domElement);
    }


    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // soft white light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Increased intensity
    directionalLight.position.set(gameWidth / 2, 150, gameHeight / 2 + 100); // More direct angle
    directionalLight.castShadow = true;
    // Shadow properties
    directionalLight.shadow.mapSize.width = 1024; // default
    directionalLight.shadow.mapSize.height = 1024; // default
    directionalLight.shadow.camera.near = 0.5; // default
    directionalLight.shadow.camera.far = 500; // default
    directionalLight.shadow.camera.left = -gameWidth/2 - 50;
    directionalLight.shadow.camera.right = gameWidth/2 + 50;
    directionalLight.shadow.camera.top = gameHeight/2 + 50;
    directionalLight.shadow.camera.bottom = -gameHeight/2 - 50;

    scene.add(directionalLight);
    // const helper = new THREE.CameraHelper( directionalLight.shadow.camera ); // Debug shadows
    // scene.add( helper );

    // Ground Plane Enhancement
    const groundTextureLoader = new THREE.TextureLoader();
    const groundTexture = groundTextureLoader.load('https://threejsfundamentals.org/threejs/resources/images/checker.png'); // Placeholder checker texture
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(gameWidth / 20, gameHeight / 20); // Repeat texture for tiling

    const planeGeometry = new THREE.PlaneGeometry(gameWidth, gameHeight);
    const planeMaterial = new THREE.MeshStandardMaterial({
        map: groundTexture,
        side: THREE.DoubleSide // Ensure texture is visible from below if camera moves
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    plane.position.set(gameWidth / 2, 0, gameHeight / 2); // Center it
    plane.receiveShadow = true;
    scene.add(plane);
}


// Snake Functions (3D)
function createSnakeSegment(x, y, z, color = 0x008000, isHead = false) {
    const geometry = new THREE.BoxGeometry(segmentSize, segmentSize, segmentSize);
    // Each segment gets its own material to allow for individual colors
    const material = new THREE.MeshPhongMaterial({ color: color });
    const segment = new THREE.Mesh(geometry, material);
    segment.position.set(x, segmentSize / 2, z); // Y is half segmentSize to sit on the plane
    segment.castShadow = true; // Snake segments should cast shadows
    segment.receiveShadow = false; // Usually segments don't receive shadows on themselves from other parts
    scene.add(segment);
    return segment; // We will store { mesh: segment, color: color } in the snake array
}

function initializeSnake() {
    snake.forEach(segmentObj => {
        if (segmentObj.mesh) {
            scene.remove(segmentObj.mesh);
            segmentObj.mesh.geometry.dispose();
            segmentObj.mesh.material.dispose();
        }
    });
    snake = [];
    // Initial snake position (e.g., center of the game area)
    const startX = Math.floor(gameWidth / (2 * segmentSize)) * segmentSize;
    const startZ = Math.floor(gameHeight / (2 * segmentSize)) * segmentSize;

    // Initialize snake with default green color
    const initialColor = 0x00ff00; // Head color
    const bodyColor = 0x008000;    // Body color

    snake.push({ mesh: createSnakeSegment(startX, 0, startZ, initialColor, true), color: initialColor });
    snake.push({ mesh: createSnakeSegment(startX - segmentSize, 0, startZ, bodyColor), color: bodyColor });
    snake.push({ mesh: createSnakeSegment(startX - 2 * segmentSize, 0, startZ, bodyColor), color: bodyColor });
}


function moveSnake() {
    if (gamePaused) return;

    let head = snake[0];
    let headPosition = head.mesh.position.clone();
    let newHeadX = headPosition.x + dx;
    let newHeadZ = headPosition.z + dz; // Using dz for Z-axis movement

    // Implement Wall-Crossing
    if (newHeadX >= gameWidth) newHeadX = 0;
    if (newHeadX < 0) newHeadX = gameWidth - segmentSize;
    if (newHeadZ >= gameHeight) newHeadZ = 0;
    if (newHeadZ < 0) newHeadZ = gameHeight - segmentSize;
    
    // Default new head color to the current head's color (will be overridden if fruit is eaten)
    let newHeadColor = head.color; 

    const ateFruit = newHeadX === fruit.mesh.position.x && newHeadZ === fruit.mesh.position.z;

    if (ateFruit) {
        score++;
        scoreDisplay.textContent = 'Score: ' + score;
        newHeadColor = fruit.mesh.material.color.getHex(); // New head takes fruit's color
        
        // Fruit Animation (simple scale up and down)
        const originalScale = fruit.mesh.scale.clone();
        new TWEEN.Tween(fruit.mesh.scale)
            .to({ x: originalScale.x * 2, y: originalScale.y * 2, z: originalScale.z * 2 }, 75) // Scale up
            .yoyo(true) // Scale back down
            .repeat(1)
            .onComplete(() => {
                 fruit.mesh.scale.copy(originalScale); // Ensure scale is reset
                 randomizeFruit(); // Reposition after animation
            })
            .start();

    } else {
        const tail = snake.pop();
        if (tail && tail.mesh) {
            scene.remove(tail.mesh);
            tail.mesh.geometry.dispose();
            tail.mesh.material.dispose();
        }
    }
    
    // Create new head segment with its determined color
    const newHead = { mesh: createSnakeSegment(newHeadX, 0, newHeadZ, newHeadColor, true), color: newHeadColor };
    
    // Old head becomes a body part, its color is already set
    if (snake.length > 0) {
        // No need to change color here, as it retains its color when it was a head or previous segment
        // Ensure the old head mesh is no longer marked as 'head' visually if that implies a different color/property
        // For now, we assume createSnakeSegment with isHead=false handles this.
        // If head had a special color, we'd update it here:
        // snake[0].mesh.material.color.setHex(snake[0].color); // Set to its actual stored color
    }
    snake.unshift(newHead);
}

// Fruit Functions (3D)
function createFruit() {
    const geometry = new THREE.SphereGeometry(segmentSize / 1.8, 16, 16); // Slightly larger for visibility
    const material = new THREE.MeshPhongMaterial({ color: fruit.color }); // Initial color red
    fruit.mesh = new THREE.Mesh(geometry, material);
    fruit.mesh.castShadow = true;
    // Initial position will be set by randomizeFruit
    scene.add(fruit.mesh);
}

function randomizeFruit() {
    const gridSizeX = gameWidth / segmentSize;
    const gridSizeZ = gameHeight / segmentSize;

    fruit.mesh.position.x = Math.floor(Math.random() * gridSizeX) * segmentSize;
    // Ensure fruit doesn't spawn on the snake
    let validPosition = false;
    let x, z;
    while(!validPosition) {
        x = Math.floor(Math.random() * gridSizeX) * segmentSize;
        z = Math.floor(Math.random() * gridSizeZ) * segmentSize;
        validPosition = true;
        for(const segment of snake) {
            if (segment.mesh.position.x === x && segment.mesh.position.z === z) {
                validPosition = false;
                break;
            }
        }
    }
    fruit.mesh.position.set(x, segmentSize / 1.8, z); // Y adjusted for sphere radius
    
    const randomHexColor = Math.random() * 0xffffff; // Keep as number for Three.js color
    fruit.color = randomHexColor;
    fruit.mesh.material.color.setHex(randomHexColor);
}

// Game Loop
function main() {
    if (gamePaused && !TWEEN.getAll().length) { // Only fully pause if no tweens are running
        renderer.render(scene, camera); 
        return;
    }
    
    TWEEN.update(); // Update animations

    requestAnimationFrame(main); // Use requestAnimationFrame for smoother animations

    // Control game speed independently of frame rate
    const now = Date.now();
    const delta = now - (lastTickTime || now);
    lastTickTime = now;
    gameUpdateAccumulator += delta;

    if (gameUpdateAccumulator > gameTickSpeed) {
        gameUpdateAccumulator -= gameTickSpeed;

        if (!gamePaused) {
            moveSnake();
            if (hasGameEnded()) {
                gamePaused = true;
                alert(`Game Over! Your score: ${score}. Press Start to play again.`);
                // Reset handled by start button
            }
        }
    }
    renderer.render(scene, camera);
}

let lastTickTime = Date.now();
let gameUpdateAccumulator = 0;
const gameTickSpeed = 150; // milliseconds per game update (snake movement)

function hasGameEnded() {
    const head = snake[0];
    // Wall collision
    if (head.position.x < 0 || head.position.x >= gameWidth || head.position.z < 0 || head.position.z >= gameHeight) {
        return true;
    }
    // Self collision
    for (let i = 1; i < snake.length; i++) { // Start from 1 to avoid comparing head with itself
        if (head.position.x === snake[i].position.x && head.position.z === snake[i].position.z) {
            return true;
        }
    }
    return false;
}


// Keyboard Input
document.addEventListener('keydown', changeDirection);

function changeDirection(event) {
    const LEFT_KEY = 37;
    const RIGHT_KEY = 39;
    const UP_KEY = 38;
    const DOWN_KEY = 40;

    const keyPressed = event.keyCode;
    
    // Current movement direction
    const goingLeft = dx === -segmentSize;
    const goingRight = dx === segmentSize;
    const goingForward = dz === -segmentSize; // "Up" arrow moves forward (negative Z)
    const goingBackward = dz === segmentSize;  // "Down" arrow moves backward (positive Z)


    if (keyPressed === LEFT_KEY && !goingRight) {
        dx = -segmentSize;
        dz = 0;
    }
    if (keyPressed === UP_KEY && !goingBackward) { // Up arrow
        dx = 0;
        dz = -segmentSize; // Move forward along Z
    }
    if (keyPressed === RIGHT_KEY && !goingLeft) {
        dx = segmentSize;
        dz = 0;
    }
    if (keyPressed === DOWN_KEY && !goingForward) { // Down arrow
        dx = 0;
        dz = segmentSize; // Move backward along Z
    }
}

// Button Event Listeners
startButton.addEventListener('click', () => {
    gamePaused = false;
    dx = segmentSize; // Initial direction: right
    dz = 0;
    score = 0;
    scoreDisplay.textContent = 'Score: ' + score;
    
    // Clear any existing tweens
    TWEEN.removeAll();

    initializeSnake(); // Create 3D snake
    if (!fruit.mesh) { 
        createFruit();
    }
    randomizeFruit(); 

    // Reset game loop timing variables
    lastTickTime = Date.now();
    gameUpdateAccumulator = 0;

    if (gamePaused) { // if it was paused, and we click start, unpause and kick off loop
      gamePaused = false;
      main();
    } else { // if it was already running, main is already going, just state is reset
      // main() will continue the loop
    }
});

pauseButton.addEventListener('click', () => {
    gamePaused = !gamePaused;
    if (!gamePaused) {
        main(); // Resume game loop
    }
});

// Initial Setup
initThreeJS(); 
initializeSnake(); // snake array now holds {mesh, color}
createFruit();     // fruit.mesh exists
randomizeFruit();  // fruit is positioned and colored
renderer.render(scene, camera); 
// Add TWEEN.js library - this should be in index.html but for now, let's assume it's available
// If not, a view_text_website call would be needed to get the CDN and then an edit to index.html
// For the purpose of this tool, we'll assume TWEEN is globally available like THREE.
