/* =====================================================================
   Dhvani Patel
   CS 360/560 - Introduction to Computer Graphics, Fall 2026
   Project 5, Problem 1 - Modified "Baby Boxes" Babylon.js scene

   Changes from the original Baby_Boxes.js:
     - Boxes are stacked into a pyramid and a tapering tower
     - Added other shapes: sphere, cylinder pillar, cone, torus,
       torus knot, and an icosahedron (polyhedron)
     - Added three more GLB models (from the Babylon.js Assets
       repository, CC BY 4.0): HVGirl.glb, aerobatic_plane.glb,
       seagulf.glb, plus the original HeartFinalized.glb
     - Every GLB is auto-scaled to a target height and set on the
       ground, so models of very different sizes fit the scene
     - The airplane and seagull fly in circles above the scene
     - The XR grab grabs the whole GLB model, not just one piece

   Run from a local server (e.g. VS Code Live Server or
   `python -m http.server`) so the GLB files can load.
   ===================================================================== */

var canvas = document.getElementById("renderCanvas");

var startRenderLoop = function (engine, canvas) {
    engine.runRenderLoop(function () {
        if (sceneToRender && sceneToRender.activeCamera) {
            sceneToRender.render();
        }
    });
};

var engine = null;
var scene = null;
var sceneToRender = null;
var createDefaultEngine = function () {
    return new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false });
};

var camera;

/* ---------------------------------------------------------------
   Helpers (Dhvani Patel)
   --------------------------------------------------------------- */

// Simple colored material
function makeMat(name, r, g, b, scene) {
    const mat = new BABYLON.StandardMaterial(name, scene);
    mat.diffuseColor = new BABYLON.Color3(r, g, b);
    mat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    return mat;
}

// Load a GLB, scale it to `height` units tall, and stand it on the ground at (x, z).
// If the file is missing, log a warning and keep the rest of the scene running.
async function loadModel(file, height, x, z, scene, rotationY = 0) {
    try {
        const result = await BABYLON.SceneLoader.ImportMeshAsync("", "./", file, scene);
        const root = result.meshes[0];          // the "__root__" node of the GLB

        // Measure the model and scale it to the target height
        let { min, max } = root.getHierarchyBoundingVectors(true);
        const currentHeight = max.y - min.y;
        if (currentHeight > 0) {
            root.scaling.scaleInPlace(height / currentHeight);
        }
        root.rotation = new BABYLON.Vector3(0, rotationY, 0);
        root.position.set(x, 0, z);

        // Re-measure, then lift it so the bottom sits on the ground (y = 0)
        ({ min, max } = root.getHierarchyBoundingVectors(true));
        root.position.y -= min.y;

        result.meshes.forEach(m => { m.isPickable = true; });
        console.log(file + " loaded");
        return result;
    } catch (e) {
        console.warn("Could not load " + file + " (is it in the same folder? are you using a local server?)", e);
        return null;
    }
}

// Walk up from a picked child mesh to the top-level node of its model,
// so grabbing a GLB picks up the whole model instead of one piece.
function topLevelNode(mesh) {
    let node = mesh;
    while (node.parent) {
        node = node.parent;
    }
    return node;
}

var createScene = async function () {
    /* ———————————————————
       1.  BASIC SCENE SETUP
    ———————————————————— */
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.75, 0.87, 1.0, 1.0);   // light sky blue

    // Even, realistic PBR lighting for any GLB
    scene.createDefaultEnvironment({
        createGround: false,
        createSkybox: false,
        environmentIntensity: 1.0
    });

    const light = new BABYLON.PointLight("Omni", new BABYLON.Vector3(0, 100, 100), scene);
    light.intensity = 0.6;
    const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity = 1.0;
    hemi.groundColor = new BABYLON.Color3(0.35, 0.35, 0.4);

    // Camera
    camera = new BABYLON.ArcRotateCamera("Camera", -Math.PI / 2 + 0.35, 1.3, 70, new BABYLON.Vector3(0, 12, 0), scene);
    camera.lowerRadiusLimit = 10;
    camera.upperRadiusLimit = 200;
    camera.upperBetaLimit = Math.PI / 2 - 0.05;   // don't go under the ground
    camera.wheelPrecision = 5;
    camera.attachControl(canvas, true);

    // Ground
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 1000, height: 1000 }, scene);
    ground.checkCollisions = true;
    const gridMat = new BABYLON.GridMaterial("gridMat", scene);
    gridMat.mainColor = new BABYLON.Color3(0.95, 0.95, 0.95);
    gridMat.lineColor = new BABYLON.Color3(0.55, 0.6, 0.7);
    gridMat.gridRatio = 4;
    ground.material = gridMat;

    /* ———————————————————
       2.  STACKED BOXES
    ———————————————————— */

    // (a) Pyramid of 4-unit boxes in the center: 3 on the bottom, 2, then 1
    const pyramidColors = [
        [1.0, 0.1, 0.1],   // red    (the original box's color)
        [1.0, 0.55, 0.1],  // orange
        [1.0, 0.9, 0.1]    // yellow
    ];
    const boxSize = 4;
    for (let row = 0; row < 3; row++) {
        const count = 3 - row;
        for (let i = 0; i < count; i++) {
            const b = BABYLON.MeshBuilder.CreateBox("pyramidBox_" + row + "_" + i, { size: boxSize }, scene);
            b.position.x = (i - (count - 1) / 2) * (boxSize + 0.1);
            b.position.y = boxSize / 2 + row * boxSize;
            b.position.z = 0;
            b.material = makeMat("pyrMat_" + row + "_" + i, ...pyramidColors[row], scene);
            b.isPickable = true;
        }
    }

    // (b) Tapering tower on the left: 8, 6, 4, 2 (the original blue box is the base)
    const towerSizes = [8, 6, 4, 2];
    let towerY = 0;
    towerSizes.forEach((s, i) => {
        const b = BABYLON.MeshBuilder.CreateBox("towerBox_" + i, { size: s }, scene);
        b.position.set(-22, towerY + s / 2, 0);
        b.rotation.y = i * Math.PI / 12;          // each layer twists a little
        const shade = 1 - i * 0.2;
        b.material = makeMat("towerMat_" + i, 0.1, 0.1 + 0.15 * i, shade, scene);
        b.isPickable = true;
        towerY += s;
    });

    // A sphere balanced on top of the tower
    const towerBall = BABYLON.MeshBuilder.CreateSphere("towerBall", { diameter: 2 }, scene);
    towerBall.position.set(-22, towerY + 1, 0);
    towerBall.material = makeMat("ballMat", 0.9, 0.2, 0.7, scene);

    /* ———————————————————
       3.  OTHER SHAPES
    ———————————————————— */

    // Pillar (cylinder) with the heart model on top (heart loads below)
    const pillar = BABYLON.MeshBuilder.CreateCylinder("pillar", { height: 10, diameter: 3 }, scene);
    pillar.position.set(22, 5, 0);
    pillar.material = makeMat("pillarMat", 0.85, 0.85, 0.8, scene);

    // Cone (a cylinder with a top diameter of 0)
    const cone = BABYLON.MeshBuilder.CreateCylinder("cone", { height: 6, diameterTop: 0, diameterBottom: 4 }, scene);
    cone.position.set(-10, 3, 14);
    cone.material = makeMat("coneMat", 0.2, 0.75, 0.3, scene);

    // Torus standing up like a ring
    const torus = BABYLON.MeshBuilder.CreateTorus("torus", { diameter: 6, thickness: 1, tessellation: 48 }, scene);
    torus.position.set(12, 3.5, -12);
    torus.rotation.x = Math.PI / 2;
    torus.rotation.y = 0.5;
    torus.material = makeMat("torusMat", 0.1, 0.8, 0.85, scene);

    // Torus knot, spinning
    const knot = BABYLON.MeshBuilder.CreateTorusKnot("knot", { radius: 2, tube: 0.6, radialSegments: 128 }, scene);
    knot.position.set(10, 4, 14);
    knot.material = makeMat("knotMat", 0.6, 0.3, 0.9, scene);

    // Icosahedron (polyhedron type 3)
    const ico = BABYLON.MeshBuilder.CreatePolyhedron("ico", { type: 3, size: 2 }, scene);
    ico.position.set(-22, 2, 14);
    ico.material = makeMat("icoMat", 1.0, 0.75, 0.2, scene);

    // Spin the knot and the ico a little every frame
    scene.onBeforeRenderObservable.add(() => {
        const dt = engine.getDeltaTime() / 1000;
        knot.rotation.y += 0.8 * dt;
        ico.rotation.y += 0.5 * dt;
        ico.rotation.x += 0.3 * dt;
    });

    /* ———————————————————
       4.  IMPORT GLB MODELS
    ———————————————————— */

    // Original heart model, sitting on top of the pillar
    loadModel("HeartFinalized.glb", 4, 22, 0, scene).then(res => {
        if (res) res.meshes[0].position.y += 10;      // lift onto the 10-unit pillar
    });

    // Character standing in front of the pyramid, dancing
    loadModel("HVGirl.glb", 9, 0, -12, scene, Math.PI).then(res => {
        if (!res) return;
        const samba = res.animationGroups.find(a => a.name === "Samba");
        res.animationGroups.forEach(a => a.stop());
        if (samba) samba.start(true);
    });

    // Airplane circling high above the scene
    loadModel("aerobatic_plane.glb", 3, 0, 0, scene).then(res => {
        if (!res) return;
        const plane = res.meshes[0];
        res.meshes.forEach(m => { m.isPickable = false; });   // flying things can't be grabbed
        res.animationGroups.forEach(a => a.start(true));       // spin the propeller if it has one
        let t = 0;
        const radius = 35, height = 28;
        scene.onBeforeRenderObservable.add(() => {
            t += 0.35 * engine.getDeltaTime() / 1000;
            plane.position.set(radius * Math.cos(t), height, radius * Math.sin(t));
            // face along the direction of travel
            plane.rotationQuaternion = null;
            plane.rotation.y = -t;
            plane.rotation.z = -0.25;                          // bank into the turn
        });
    });

    // Seagull circling the other way, lower down
    loadModel("seagulf.glb", 3, 0, 0, scene).then(res => {
        if (!res) return;
        const gull = res.meshes[0];
        res.meshes.forEach(m => { m.isPickable = false; });
        res.animationGroups.forEach(a => a.start(true));       // flap wings
        let t = 0;
        const radius = 20, height = 16;
        scene.onBeforeRenderObservable.add(() => {
            t += 0.5 * engine.getDeltaTime() / 1000;
            gull.position.set(radius * Math.cos(-t), height + Math.sin(t * 3), radius * Math.sin(-t));
            gull.rotationQuaternion = null;
            gull.rotation.y = t + Math.PI;
        });
    });

    /* ———————————————————
       5.  WEB-XR SETUP
    ———————————————————— */
    try {
        const xrHelper = await scene.createDefaultXRExperienceAsync({
            floorMeshes: [ground]
        });

        let grabbedNode = null;
        xrHelper.input.onControllerAddedObservable.add((controller) => {
            controller.onMotionControllerInitObservable.add((mc) => {
                if (mc.handness === "left") {
                    const trigger = mc.getComponent(mc.getComponentIds()[0]); // xr-standard-trigger
                    trigger.onButtonStateChangedObservable.add(() => {
                        if (trigger.changes.pressed) {
                            if (trigger.pressed) {
                                const picked = xrHelper.pointerSelection.getMeshUnderPointer(controller.uniqueId);
                                if (picked && picked !== ground) {
                                    grabbedNode = topLevelNode(picked);   // whole model, not one piece
                                    grabbedNode.setParent(mc.rootMesh);   // grab
                                }
                            } else if (grabbedNode) {
                                grabbedNode.setParent(null);              // release
                                grabbedNode = null;
                            }
                        }
                    });
                }
            });
        });
    } catch (e) {
        console.log("WebXR not available in this browser; desktop view only.", e);
    }

    return scene;
};

window.initFunction = async function () {
    var asyncEngineCreation = async function () {
        try {
            return createDefaultEngine();
        } catch (e) {
            console.log("the available createEngine function failed. Creating the default engine instead");
            return createDefaultEngine();
        }
    };

    window.engine = await asyncEngineCreation();
    engine = window.engine;
    if (!engine) throw 'engine should not be null.';
    startRenderLoop(engine, canvas);
    window.scene = createScene();
};

initFunction().then(() => {
    scene.then(returnedScene => { sceneToRender = returnedScene; });
});

// Resize
window.addEventListener("resize", function () {
    engine.resize();
});
