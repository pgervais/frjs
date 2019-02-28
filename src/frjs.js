const frjs = (function () {

  // Set to `true` to display debug messages.
  // TODO: make that configurable.
  const debug = false;

  // Width of the side bar, in pixels.
  const inventoryWidth_ = 200;

  const allCameras_ = {};
  const allLookats_ = {};
  const allCameraNames_ = [];
  const allObjs_ = {};

  // Returns the object under `loc` for a specific camera.
  function getObjectUnderPointer(camera, loc) {
    // TODO: check performance impact of recreating this object.
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(loc, camera);

	  // Get objects intersecting the picking ray
	  const intersects = raycaster.intersectObjects(scene.children, true);
    // Returns the first one found, which is at the forefront.
    if (intersects.length == 0) {
      return {'name': '' };
    }
    let obj = intersects[0].object;

    // Workaround for the Blender exporter creating a group when a mesh
    // has several materials.
    if (obj.parent.type == 'Group') {
      obj = obj.parent;
    }
    return obj;
  }

  // Contains information about the 3D scene the game takes place in.
  const world = (function (inventoryWidth) {
    const that = {};
    let outlinePass_;

    // Camera transitions
    let cameraPositions_ = [];
    let cameraLookats_ = [];
    let cameraAnimationStep_ = -1;
    let viewReadyCallback;  // called when a camera animation stops.
    let playerLookat_ = {position: new THREE.Vector3(0,0,0)};

    // Player's viewpoint camera.
    const playerCamera_ = new THREE.PerspectiveCamera(
        40,
        (window.innerWidth - inventoryWidth) / window.innerHeight,
        0.1,
        1000);
    playerCamera_.name = "player_camera";

    that.getPlayerCamera = function() {
      return playerCamera_;
    };

    // Set the camera location and orientation without animation.
    that.movePlayerCamera = function(x, y, z, lookat) {
      playerCamera_.position.set(x, y, z);
      playerCamera_.lookAt(lookat);
      playerLookat_ = lookat;
      playerCamera_.updateProjectionMatrix();
    };

    // Smoothly moves the camera to a new location and orientation.
    that.animatePlayerCamera = function(newPos, newLookat, viewReadyCallback) {
      function interpolate(sPos, ePos, steps) {
        const values = [];
        for (let i=0; i<steps; i+=1) {
          values.push(new THREE.Vector3(
            sPos.x + 1.0 * (ePos.x - sPos.x) * i/steps,
            sPos.y + 1.0 * (ePos.y - sPos.y) * i/steps,
            sPos.z + 1.0 * (ePos.z - sPos.z) * i/steps
          ));
        }
        return values;
      }
      const steps = 60;
      cameraPositions_ = interpolate(playerCamera_.position, newPos, 60);
      cameraLookats_ = interpolate(playerLookat_, newLookat, 60);
      cameraAnimationStep_ = 0;
      viewReadyCallback_ = viewReadyCallback;
    };

    // Returns true when camera animation is in progress.
    that.isInAnimation = function() {
      return cameraAnimationStep_ >= 0;
    };

    // Returns the object under mouse pointer for the player camera.
    that.getObjectUnderPointer = function(loc) {
       return getObjectUnderPointer(playerCamera_, loc);
    }

    that.animationCallback = function() {
      if (cameraAnimationStep_ == -1) {
        return;
      }

      if (cameraAnimationStep_ >= cameraPositions_.length) {
        cameraAnimationStep_ = -1;
        cameraPositions_ = [];
        cameraLookats_ = [];
        if (viewReadyCallback_) {
          viewReadyCallback_();
        }
        return;
      }

      const pos = cameraPositions_[cameraAnimationStep_];
      const lookat = cameraLookats_[cameraAnimationStep_];
      that.movePlayerCamera(pos.x, pos.y, pos.z, lookat);
      cameraAnimationStep_ += 1;
    };

    that.getOutlinePass = function() {
      return outlinePass_;
    }

    that.setUp = function(renderer, scene, width, height) {
      that.movePlayerCamera(5, 2, 5, new THREE.Vector3(0, 2, 0));
      const composerFp = addOutlinePass(renderer, scene, playerCamera_,
                                        width, height);
      outlinePass_ = composerFp.passes[1];
      return composerFp;
    };
    return that;
  })(inventoryWidth_);

  // Deals with text overlay next to the mouse pointer (in the `world`), and
  // navigation buttons.
  const overlay = (function () {
    const that = {};
    let canvas_;
    let scene_;
    let camera_;
    let bitmap_;
    let texture_;
    let tmpMessage_ = "";
    let tmpMessageCounter_ = -1;

    // Which of the navigation button to show.
    // One of the values in allButtonNames_
    let button_ = "";
    // Text to write next to the pointer and location.
    let pointerText_ = "";
    let textLocX_;
    let textLocY_;

    // Whether the entire overlay is visible or not.
    let visible_ = false;
    // Whether the entire overlay should update (used when game is finished).
    let frozen_ = false;

    // Canvas size
    // We need powers of two because it becomes a texture.
    const width_ = 1024;
    const height_ = 512;

    // Whether each button is clickable. Set with setActiveButtons().
    // <button name>: boolean
    const clickableButtons_ = [];
    const allButtonNames_ = ['left', 'right', 'top', 'bottom'];
    const mousePos_ = new THREE.Vector2();

    // Name of the button the mouse pointer is currently above.
    // Use to save some overlay texture redrawing.
    let buttonHovered_;

    function onMouseMove(event) {
      mousePos_.x = event.clientX;
      mousePos_.y = event.clientY;
      updateHoveredButton();
    }

    function updateHoveredButton(forceUpdate) {
      const button = that.getNavigationAction(mousePos_.x, mousePos_.y);
      if (buttonHovered_ !== button) {
        buttonHovered_ = button;
        forceUpdate = true;
      }
      if (forceUpdate) {
        updateTexture();
      }
    }

    // Button sizes.
    const xs_ = [5, 100,
                 window.innerWidth - inventoryWidth_ - 100,
                 window.innerWidth - inventoryWidth_ - 5];
    const ys_ = [5, 100,
                 window.innerHeight - 100,
                 window.innerHeight - 5];

    function updateTexture() {
      if (frozen_) {
        return;
      }
      texture_.needsUpdate = true;

      const scaleX = width_ / (window.innerWidth - inventoryWidth_);
      const scaleY = height_ / window.innerHeight;

      bitmap_.clearRect(0, 0, width_, height_);
      // TODO: Make those colors configurable.
      // alpha strictly less than .5 is completely transparent.
      const highlightColor = "rgba(95, 94, 50, .9)";
      const normalColor = "rgba(95, 94, 50, 0.5)";

      const buttonColors = {};
      for (let button of allButtonNames_) {
        buttonColors[button] = "rgba(0, 0, 0, 0.0)";;
      }
      for (let button of clickableButtons_) {
        buttonColors[button] = normalColor;
      }

      let showText = true;

      if (buttonHovered_ !== undefined) {
        buttonColors[buttonHovered_] = highlightColor;
        showText = false;
      }

      bitmap_.fillStyle = buttonColors['left'];
      bitmap_.fillRect(xs_[0] * scaleX,
                       ys_[1] * scaleY,
                       (xs_[1]-xs_[0]) * scaleX,
                       (ys_[2]-ys_[1]) * scaleY
                      );

      bitmap_.fillStyle = buttonColors['right'];
      bitmap_.fillRect(xs_[2] * scaleX,
                         ys_[1] * scaleY,
                         (xs_[3]-xs_[2]) * scaleX,
                         (ys_[2]-ys_[1]) * scaleY
                      );

      bitmap_.fillStyle = buttonColors['top'];
      bitmap_.fillRect(xs_[1] * scaleX,
                       ys_[0] * scaleY,
                       (xs_[2]-xs_[1]) * scaleX,
                       (ys_[1]-ys_[0]) * scaleY
                      );

      bitmap_.fillStyle = buttonColors['bottom'];
      bitmap_.fillRect(xs_[1] * scaleX,
                       ys_[2] * scaleY,
                       (xs_[2]-xs_[1]) * scaleX,
                       (ys_[3]-ys_[2]) * scaleY
                      );

      if (showText) {
        // Write the text following the pointer.
	      bitmap_.font = "Bold 25px sans-serif";
        bitmap_.textAlign = 'center';
        bitmap_.fillStyle = "rgba(0,0,0,0.99)";
        bitmap_.fillText(pointerText_,
                         textLocX_ * scaleX,
                         textLocY_ * scaleY);
        bitmap_.strokeStyle = "rgba(245,245,245,0.99)";
        bitmap_.lineWidth = '1.5';
        bitmap_.strokeText(pointerText_,
                           textLocX_ * scaleX,
                           textLocY_ * scaleY);
      }
    };

    that.writeFinalText = function(message) {
      texture_.needsUpdate = true;
      frozen_ = true;
      const scaleX = width_ / (window.innerWidth - inventoryWidth_);
      const scaleY = height_ / window.innerHeight;

      bitmap_.clearRect(0, 0, width_, height_);

      const textLocX_ = (window.innerWidth - inventoryWidth_) / 2;
      const textLocY_ = window.innerHeight / 2;

      // If no button is to be shown, write the text following the pointer.
	    bitmap_.font = "Bold 40px sans-serif";
      bitmap_.textAlign = 'center';
      bitmap_.fillStyle = "rgba(0,0,0,0.99)";
      bitmap_.fillText(message,
                       textLocX_ * scaleX,
                       textLocY_ * scaleY);
      bitmap_.strokeStyle = "rgba(245,245,245,0.99)";
      bitmap_.lineWidth = '1.5';
      bitmap_.strokeText(message,
                         textLocX_ * scaleX,
                         textLocY_ * scaleY);
    };

    that.writeText = function(text) {
      const loc_x = mousePos_.x; // + 15;
      const loc_y = mousePos_.y + 70;
      if (tmpMessageCounter_ >= 0) {
        text = tmpMessage_;
      }
      if (pointerText_ == text
          && textLocX_ == loc_x
          && textLocY_ == loc_y) {
        return;
      }
      pointerText_ = text;
      textLocX_ = loc_x;
      textLocY_ = loc_y;
      updateTexture();
    };

    that.writeTemporaryText = function(message, steps) {
      tmpMessage_ = message;
      tmpMessageCounter_ = steps || 80;
      that.writeText();
    };

    // Sets the list of clickable buttons.
    // Takes an array of button names as strings.
    // Example: setActiveButtons(['top']);
    that.setActiveButtons = function(buttons) {
      // This happens to be a standard way of clearing an array in javascript.
      clickableButtons_.length = 0;
      for (let button of buttons) {
        clickableButtons_.push(button);
      }
      updateHoveredButton(true);
    }

    // TODO: Rename getNavigationButton for consistency (or replace button
    // by action everywhere else)
    that.getNavigationAction = function(clientX, clientY) {
      let xBand;
      if (clientX < xs_[1]) {
        xBand = 'left';
      } else if (clientX > xs_[2]) {
        xBand = 'right';
      } else {
        xBand = 'middle';
      }
      let yBand;
      if (clientY < ys_[1]) {
        yBand = 'top';
      } else if (clientY > ys_[2]) {
        yBand = 'bottom';
      } else {
        yBand = 'middle';
      }

      let navigation_action;
      if (xBand != 'middle' && yBand == 'middle') {
        navigation_action = xBand;
      }
      if (yBand != 'middle' && xBand == 'middle') {
        navigation_action = yBand;
      }

      if (clickableButtons_.includes(navigation_action)) {
        return navigation_action;
      }
      return undefined;
    };

    that.animationCallback = function() {
      if (tmpMessageCounter_ == -1) {
        return;
      }
      if (tmpMessageCounter_ == 0) {
        tmpMessage_ = "";
        that.writeText();
      }
      tmpMessageCounter_ -= 1;
    };

    that.getAllButtonNames = function() {
      return allButtonNames_;
    };

    that.setVisible = function(isVisible) {
      visible_ = isVisible;
    }

    that.setUp = function(renderer) {
      canvas_ = document.createElement('canvas');

      canvas_.width = width_;
      canvas_.height = height_;

      bitmap_ = canvas_.getContext('2d');

      // Create the camera and set the viewport to match the screen dimensions.
      camera_ = new THREE.OrthographicCamera(-width_/2, width_/2,
                                             height_/2, -height_/2, 0, 30);

      // TODO: create a separate scene for the sidebar.
      scene_ = new THREE.Scene();

	    // Create texture from rendered graphics.
	    texture_ = new THREE.CanvasTexture(canvas_);

      // Create textured plane to render the HUD. This plane fills the
      // whole screen.
      const material = new THREE.MeshBasicMaterial({map: texture_,
                                                    alphaTest: 0.5,
                                                    transparent: true});
      const planeGeometry = new THREE.PlaneGeometry(width_, height_);

      scene_.add(new THREE.Mesh(planeGeometry, material));
      window.addEventListener('mousemove', onMouseMove, false);

      return {'render': function() {
        if (visible_) {
          renderer.render(scene_, camera_);
        }
      }};
    };

    return that;
  })();  // overlay


  // Object responsible for inventory UX.
  const inventory = (function () {
    const that = {};
    // Content of the inventory. Three.js objects.
    const collectedObjects_ = [];
    // Index of selected object in collectedObjects_. null if no object
    // is selected.
    let selectedObject_ = null;
    let scene_;
    let cameraViewHeight_ = -1;

    // For object highlights.
    let outlinePass_;

    // Number of items in inventory.
    let inventoryCapacity = 3;

    // Used for object picking.
    const mouseLoc_ = new THREE.Vector2();  // normalized

    that.setUp = function (renderer, scene, inventoryWidth_) {
      const inventoryLight = new THREE.PointLight(0xffffff, .8, 30);
      inventoryLight.position.set(0, 100, -30);
      scene.add(inventoryLight);

      // Create the inventory's camera
      cameraViewHeight_ = window.innerHeight / inventoryWidth_ * 2,
      that.camera = new THREE.OrthographicCamera(
        -1,
        1,
        100 + cameraViewHeight_ / 2,
        100 - cameraViewHeight_ / 2,
        0,
        100);
      that.camera.name = "inventory_camera";
      scene_ = scene;
      scene_.add(that.camera);

      const composer = addOutlinePass(renderer, scene, that.camera,
                                      inventoryWidth_, window.innerHeight);
      outlinePass_ = composer.passes[1];
      return composer;
    };

    // Call when an object has been added or removed from the inventory.
    const updateObjectLocations = function () {
      for (let i=0; i<collectedObjects_.length; i+=1) {
        // Normalize object size.
        const obj = collectedObjects_[i];
        obj.geometry.center();
        const bb = obj.geometry.boundingBox;
        const sx = obj.scale.x;
        const sy = obj.scale.y;
        const sz = obj.scale.z;
        const dx = sx * (bb.max.x - bb.min.x);
        const dy = sy * (bb.max.y - bb.min.y);
        const dz = sz * (bb.max.z - bb.min.z);
        const scale = 0.8 * Math.min(2, (cameraViewHeight_ / inventoryCapacity)) / Math.max(dx, dy, dz);
        obj.scale.set(scale*sx, scale*sy, scale*sz);
        const spacing = cameraViewHeight_ / inventoryCapacity;
        obj.position.set(0,
                         100 + spacing * (inventoryCapacity -1) / 2
                         - i*spacing,
                         -50  // in the middle of the near-end range.
                        );
        const m = new THREE.Matrix4();
        m.makeRotationX(0.5);
        m.makeRotationAxis(new THREE.Vector3(0.707,0.707,0),0.8);
        obj.setRotationFromMatrix(m);
        obj.userData.inventoryRank = i;
      }
    };
    // Move an object into the inventory.
    that.collectObject = function(collected_game_object) {
      const collectedObject = collected_game_object.getObject();
      // TODO: make this work for a group.
      collectedObject.geometry.computeBoundingBox();
      collectedObjects_.push(collectedObject);
      updateObjectLocations();
    };

    function toggleSelectedObject(index) {
      if (selectedObject_ === index) {
        selectedObject_ = null;
        outlinePass_.selectedObjects = [];
        return;
      }
      if (index >= 0 && index < collectedObjects_.length) {
        selectedObject_ = index;
        outlinePass_.selectedObjects = [collectedObjects_[selectedObject_]];
      } else {
        console.error('invalid index passed to toggleSelectedObject:',
                      index);
      }
    };

    function getIndex(obj) {
      for (let i=0 ; i < collectedObjects_.length ; i+=1) {
        if (obj.getObject().name == collectedObjects_[i].name) {
          return i;
        }
      }
      return -1;
    };

    that.dropObject = function(collectedObject) {
      const index = getIndex(collectedObject);
      if (index == -1) {
        console.error("Trying to drop non-collected object: ",
                      collectedObject.name);
      }
      const objectToDrop = collectedObjects_.splice(index, 1)[0];
      outlinePass_.selectedObjects = [];
      selectedObject_ = null;
      scene_.remove(objectToDrop);
      updateObjectLocations();
    };

    that.isObjectSelected = function(obj) {
      const index = getIndex(obj);
      if (index == -1) {
        return false;
      }
      return selectedObject_ === index;
    };

    that.isObjectCollected = function(obj) {
      return getIndex(obj) != -1;
    };

    that.onMouseClick = function(event) {
      // Check if the click is in the inventory panel. If no, return false
      // immediately.
      if (event.clientX < window.innerWidth - inventoryWidth_) {
        return false;
      }

      mouseLoc_.x = (
        (event.clientX - (window.innerWidth - inventoryWidth_))
          / inventoryWidth_
      ) * 2 - 1;
	    mouseLoc_.y = - (event.clientY / window.innerHeight) * 2 + 1;

      const objectName = getObjectUnderPointer(that.camera, mouseLoc_).name;
      for (let i=0; i<collectedObjects_.length; i+=1) {
        if (collectedObjects_[i].name === objectName) {
          toggleSelectedObject(i);
        }
      }

      return true;
    };
    return that;
  })();  // inventory

  const renderManager = (function(){
    const that = {};
    let callbacks_ = [];
    let composer_;
    let inventoryComposer_;
    let overlayComposer_;
    let worldComposer_;

    that.setUp = function(renderer, scene, world, inventory, overlay,
                          callbacks) {
      inventoryComposer_ = inventory.setUp(renderer, scene, inventoryWidth_);
      overlayComposer_ = overlay.setUp(renderer);
      worldComposer_ = world.setUp(renderer, scene,
                                   window.innerWidth, window.innerHeight);

      callbacks_ = callbacks;
    };

    function render() {
      const windowWidth  = window.innerWidth;
		  const windowHeight = window.innerHeight;

      let left = 0.;
      let top = 0.;
		  let width  = Math.floor(windowWidth  - inventoryWidth_);
		  let height = Math.floor(windowHeight);

      // Player's viewpoint
		  renderer.setViewport(left, top, width, height);
		  renderer.setScissor(left, top, width, height);
		  renderer.setScissorTest(true);

      worldComposer_.render();
      overlayComposer_.render();

      // Inventory
      left = width;
      width = Math.floor(inventoryWidth_);
		  renderer.setViewport(left, top, width, height);
		  renderer.setScissor(left, top, width, height);
		  renderer.setScissorTest(true);

      inventoryComposer_.render();
    }

    that.animate = function() {
      requestAnimationFrame(() => that.animate());
      for (const callback of callbacks_) {
        callback();
      }
      render();
    };

    return that;
  })();  // renderManager


  function addOutlinePass(renderer, scene, camera, width, height) {
    const composerFp = new THREE.EffectComposer( renderer );
    const renderPass = new THREE.RenderPass( scene, camera );
    composerFp.addPass(renderPass);

    const outlinePass = new THREE.OutlinePass(
      new THREE.Vector2(Math.round(width), Math.round(height)),
      scene, camera);
    composerFp.addPass(outlinePass);

    // This is necessary for the outline pass to work, for some reason.
    const effectFXAA = new THREE.ShaderPass(THREE.FXAAShader);
    effectFXAA.uniforms[ 'resolution' ].value.set( 2 / window.innerWidth, 2 / window.innerHeight );
    effectFXAA.renderToScreen = true;
    composerFp.addPass(effectFXAA);

    outlinePass.edgeStrength = 3.0;
    outlinePass.edgeGlow = 0.0;
    outlinePass.edgeThickness = 1.0;
    outlinePass.pulsePeriod = 2.;
    outlinePass.rotate = false;
    outlinePass.usePatternTexture = false;
    outlinePass.visibleEdgeColor.set(new THREE.Color(1.0, 1.0, 1.0));
    outlinePass.hiddenEdgeColor.set(new THREE.Color(0.0, 0.0, 0.0));
    outlinePass.selectedObjects = [];
    return composerFp;
  }

  // Object used to define the game logic and handle all user interactions.

  // GameHandler maintains an index of all cameras:
  // Index: camera -> object clicked -> handler for this.

  const GameHandler = function (allObjs, allCameraNames, world, overlay, inventory,
                                debug) {
    const that = {};
    // allObjs_ contains all clickable objects (dict).
    const allObjs_ = allObjs;
    // allCameraNames_ contains the name of all cameras (~= views).
    const allCameraNames_ = allCameraNames;
    const debug_ = debug;
    const world_ = world;
    const overlay_ = overlay;
    const inventory_ = inventory;
    let outlinePass_;
    const mouseNormLoc_ = new THREE.Vector2(); // normalized
    const mouseLoc_ = new THREE.Vector2(); // client coordinates.
    let initialView_ = undefined;
    let gameFinished_ = false;

    let currentView_;

    // viewIndex contains all the game actions.
    // viewName: {
    //   'left': targetViewName,
    //   'right': targetViewName,
    //   'top': targetViewName,
    //   'bottom': targetViewName,
    // 'objects': {
    //   objectName: {
    // TODO: get rid of 'action' which is not needed anymore.
    //     'action': {  // can be turned into a class.
    //        'message': str or func,
    //        'deps': [objNames]
    //        'callback': func
    //     }
    //  }
    const viewIndex_ = {};
    for (const cameraName of allCameraNames_) {
      if (debug_) {
        console.log("registering camera: ", cameraName);
      }
      viewIndex_[
        cameraName.substring(0, cameraName.length-4)] = {'objects': {}};
    }

    function onMouseMove(event) {
      if (gameFinished_) {
        return;
      };

      mouseLoc_.x = event.clientX;
      mouseLoc_.y = event.clientY;

	    // Calculate mouse position in normalized device coordinates
	    // (-1 to +1) for both components
	    mouseNormLoc_.x = (event.clientX / (window.innerWidth - inventoryWidth_)
                    ) * 2 - 1;
	    mouseNormLoc_.y = - (event.clientY / window.innerHeight) * 2 + 1;

      return updateInterface();
    }

    function updateInterface() {
      if (gameFinished_) {
        return;
      }
      // Are we over the inventory?
      // TODO: Make this test a method of the inventory.
      if (mouseLoc_.x > window.innerWidth - inventoryWidth_) {
        outlinePass_.selectedObjects = [];
        document.body.style.cursor = 'default';
        overlay_.setVisible(false);
        return;
      }

      // Don't show any UI during camera animation.
      if (world.isInAnimation()) {
        return;
      }

      // Now we know the pointer is over the 3D scene.
      overlay_.setVisible(true);

      // Are we over a navigation button?
      const navigationAction = overlay_.getNavigationAction(mouseLoc_.x,
                                                            mouseLoc_.y);
      if (navigationAction != undefined) {
        document.body.style.cursor = 'pointer';
        return;
      }

      // Then we are over the 3D scene: highlight objects.
      const objectName = world_.getObjectUnderPointer(mouseNormLoc_).name;

      const currentObject = allObjs_[objectName];
      if (currentObject != undefined) {
        const message = getActionMessage(currentView_, objectName);
        overlay_.writeText(message);
        if (message == "") {
          outlinePass_.selectedObjects = [];
          document.body.style.cursor = 'default';
        } else {
          outlinePass_.selectedObjects = [currentObject.getObject()];
          document.body.style.cursor = 'pointer';
        }
        return;
      }

      document.body.style.cursor = 'default';
      outlinePass_.selectedObjects = [];
      overlay_.writeText("");
    }

    function onMouseClick(event) {
      if (gameFinished_) {
        return true;
      };
      if (inventory_.onMouseClick(event)) {
        return true;
      }
      // Ignore clicks during camera animation.
      if (world_.isInAnimation()) {
        return true;
      }

      // Are we over a navigation button?
      navigationAction = overlay_.getNavigationAction(event.clientX, event.clientY);
      if (navigationAction != undefined) {
        const newView = getViewLink(
          currentView_, navigationAction);
        if (newView != undefined) {
          console.log("Navigation: ", currentView_ , " -> ", newView);
          switchToView(newView);
          return true;
        }
      }

      // If we arrived there, it's a click on the 3D world.
      const objectName = world_.getObjectUnderPointer(mouseNormLoc_).name;
      if(debug) {
        console.log("Intersects:", objectName);
      }
      runAction(currentView_, objectName);
      return false;
    }

    function setView(viewName) {
      const lookatName = viewName + "_lookat";
      const cameraName = viewName + "_cam";
      if(debug) {
        console.log("Setting view: " + " (" + viewName + ")");
      }

      const pos = allCameras_[cameraName].position;

      const lookat = allLookats_[lookatName].position;
      world_.movePlayerCamera(pos.x, pos.y, pos.z, lookat);
      setUpView(viewName);
    }

    // Call this to tell the player they won the game.
    function finishGame(message) {
      console.log("Game finished");
      gameFinished_ = true;
      overlay_.writeFinalText(message);
      document.body.style.cursor = 'default';
      outlinePass_.selectedObjects = [];
    };

    // Show a message next to the mouse pointer for a few seconds.
    function showMessage(message, steps) {
      overlay_.writeTemporaryText(message, steps);
    };

    // Called when camera transition is done.
    function setUpView(viewName) {
      console.log('Arrived at view: ', viewName);
      currentView_ = viewName;

      let buttons = [];
      for (let action of overlay_.getAllButtonNames()) {
        if (getViewLink(currentView_, action) !== undefined) {
          buttons.push(action);
        }
      }
      overlay_.setActiveButtons(buttons);
      updateInterface();
    }

    // Move the camera to another view.
    function switchToView(viewName) {
      const lookatName = viewName + "_lookat";
      const cameraName = viewName + "_cam";
      console.log("Switching to view: " + " (" + viewName + ")");
      world_.animatePlayerCamera(allCameras_[cameraName].position,
                                 allLookats_[lookatName].position,
                                 ()=>{setUpView(viewName);});
      currentView_ = null;
      // Hide UI elements.
      outlinePass_.selectedObjects = [];

      overlay_.setActiveButtons([]);
      overlay_.writeText("");
      overlay_.setVisible(false);
    };

    function setInitialView(viewName) {
      initialView_ = viewName;
    }

    function getInitialView() {
      return initialView_;
    }

    function setViewLink(viewName, viewLinks) {
      for (const key of Object.keys(viewLinks)) {
        viewIndex_[viewName][key] = viewLinks[key];
      }
    }

    function getViewLink(viewName, navigationAction) {
      return viewIndex_[viewName][navigationAction];
    }

    // `message` is either a string or a function returning a string.
    // `callback` and `message` signature:
    // callback(viewName, object, objectDep1, objectDep2, ...)
    function setAction(viewName, objectName, objectDeps, message, callback) {
      let depObjects = [];
      for (let objectName of objectDeps) {
        depObjects.push(allObjs_[objectName].getPublicApi());
      }
      const action = {
        'message': message,
        'deps': depObjects,
        'callback': callback
      };
      let objectActions = viewIndex_[viewName]['objects'][objectName];
      if (objectActions == undefined) {
        objectActions = {};
        viewIndex_[viewName]['objects'][objectName] = objectActions;
      }
      objectActions['action'] = action;
    }

    // Shortcut for setting an action that simply switches to another
    // view when an object is clicked.
    function setSwitchViewAction(viewName, objectName, newView, message) {
      setAction(
        viewName, objectName, [], message,
        function() {
          switchToView(newView);
        });
    }

    // Shortcut for putting an object in the inventory.
    function setTakeObjectAction(viewName, objectName, message) {
      setAction(
        viewName, objectName, [], message,
        function (viewName, obj) {
          obj.putInInventory();
        });
    }

    function getAction_(viewName, objectName) {
      const view_actions = viewIndex_[viewName]['objects'];
      if (view_actions == undefined) {
        log.console("No actions defined for view: ", viewName);
        return undefined;
      }
      const object_actions = view_actions[objectName];
      if (object_actions == undefined) {
        return undefined;
      }
      return object_actions['action'];
    }

    function getActionMessage(viewName, objectName) {
      const action = getAction_(viewName, objectName);
      if (action == undefined) {
        return "";
      }
      if (typeof action.message === "function") {
        const obj = allObjs_[objectName];
        const args = [viewName, obj.getReadOnlyApi()].concat(action.deps);
        return action.message.apply(undefined, args);
      }
      return action.message || "";
    }

    function runAction(viewName, objectName) {
      const action = getAction_(viewName, objectName);
      if (action == undefined) {
        if (debug_) {
          console.log("No action");
        }
        return;
      }
      const obj = allObjs_[objectName];
      const args = [viewName, obj.getPublicApi()].concat(action.deps);
      action.callback.apply(getCallbackApi(), args);
      updateInterface();
    }

    // Prints all known object in the console.
    function objectDump() {
      console.log("** All objects dump **");
      for (const objName of Object.keys(allObjs_)) {
        console.log(objName);
      }
      console.log("** End of object dump **");
    }

    function debugDump() {
      console.log("** DebugDump **");
      for (const k of Object.keys(viewIndex_)) {
        console.log("view: ", k, JSON.stringify(viewIndex_[k]));
      }
      console.log("** End of DebugDump **");
    }

    that.setUp = function(world) {
      // Must be called after `world` has been initialized (i.e. after
      // renderManager.setUp()).
      outlinePass_ = world.getOutlinePass();
      window.addEventListener('mousemove', onMouseMove, false);
      window.addEventListener('mousedown', onMouseClick, false);
      setView(getInitialView());
    };

    // These are the methods accessible from action callbacks (for ex.
    // a callback passed to setAction()).
    function getCallbackApi() {
      return {
        switchToView: switchToView,
        finishGame: finishGame,
        showMessage: showMessage
      };
    }

    // This is the subset of methods that are exposed to the game definition
    // code.
    // TODO: make sure these methods are no-ops after setUp() has been called.
    that.getPublicApi = function() {
      return {
        setInitialView: setInitialView,
        setViewLink: setViewLink,
        setAction: setAction,
        setSwitchViewAction: setSwitchViewAction,
        setTakeObjectAction: setTakeObjectAction,
        debug: debug_,
        debugDump: debugDump,
        objectDump: objectDump,
      };
    }

    return that;
  }  // GameHandler

  // Thin wrapper around Object3D, to provide a restricted interface
  // for game logic definition.
  function GameObject(obj, world, inventory) {
    // an Object3D instance.
    const object_ = obj;
    const inventory_ = inventory;
    const world_ = world;
    let isDropped_ = false;

    function getObject() {
      return object_;
    }

    function setInventory(inventory) {
      inventory_ = inventory;
    }

    function isVisible() {
      // TODO: return false when in inventory
      return object_.visible;
    }

    function selectedInInventory() {
      return inventory_.isObjectSelected(that);
    }

    function putInInventory() {
      inventory_.collectObject(that);
    }

    function drop() {
      if (inventory_.isObjectCollected(that)) {
        inventory_.dropObject(that);
      }
      isDropped_ = true;
      object_.visible = false;
    }

    function hide() {
      // TODO: this shouldn't do anything when objet is in inventory.
      if (isDropped_) {
        console.error("Trying to hide dropped object: ", object_.name);
        return;
      }
      world_.getOutlinePass().selectedObjects = [];
      object_.visible = false;
    }

    function show() {
      // TODO: this shouldn't do anything when objet is in inventory.
      if (isDropped_) {
        console.error("Trying to show dropped object: ", object_.name);
        return;
      }
      object_.visible = true;
    }

    function getReadOnlyApi() {
      return {
        isVisible: isVisible,
        selectedInInventory: selectedInInventory,
      };
    }

    function getPublicApi() {
      return {
        isVisible: isVisible,
        selectedInInventory: selectedInInventory,
        putInInventory: putInInventory,
        drop: drop,
        hide: hide,
        show: show,
      };
    }

    const that = {
      getObject: getObject,
      getPublicApi: getPublicApi,
      getReadOnlyApi: getReadOnlyApi
    }

    return that;
  }  // GameObject

  // Scene setup.
  let scene = new THREE.Scene();
  let renderer = new THREE.WebGLRenderer();
  renderer.autoClear = false;  // required for the transparent overlay
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  let stats = null;
  if (debug) {
    stats = new Stats();
    document.body.appendChild(stats.dom);
  }

  // Rendering and interactions

  function setupLight(light) {
    if (light.isPointLight || light.isSpotLight) {
      light.castShadow = true;
      // TODO: this is not passed through gltf. Use a custom property instead.
      light.distance = 30;
      light.shadow.mapSize.width = 1024;
      light.shadow.mapSize.height = 1024;
    }
  }

  // gameHandlerInit is the function defining the game logic.
  // `sceneFile` should be a path toward a gltf file defining the scene objects.
  // This code assumes the file has been generated using the Blender exporter.
  function startGame(sceneFile, gameHandlerInit) {
    // TODO: make that configurable.
    const dynamicShadows = false;
    // TODO: make that color configurable.
    scene.background = new THREE.Color(0x91904c);
    scene.add(world.getPlayerCamera());

    // Calls gameHandlerInit once the scene file has been loaded because we
    // need the list of objects to define interactions.
    function onLoadSetup() {
      const gameHandler = GameHandler(allObjs_, allCameraNames_, world, overlay,
                                      inventory, debug);
      gameHandlerInit(gameHandler.getPublicApi());
      let callbacks = [overlay.animationCallback,
                       world.animationCallback]
      if (stats) {
        callbacks.push(()=>stats.update());
      }
      renderManager.setUp(renderer, scene, world, inventory, overlay,
                          callbacks);
      gameHandler.setUp(world);
      renderManager.animate();
    }

    const loader = new THREE.GLTFLoader();
    loader.load(
      sceneFile,
      function (gltf) {

        gltf.scene.traverse( function(node) {
          if (node instanceof THREE.Mesh) {
            if (dynamicShadows) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          }
        });
        scene.add(gltf.scene);

        function traverse_object (obj, depth) {
          if (obj.isCamera) {
            if (debug) {
              console.log(" ".repeat(depth) + "Camera: " + obj.name);
            }
            obj_name = obj.name;
            // The Blender exporter changes camera names and it's not even
            // considered a bug.
            // https://github.com/KhronosGroup/glTF-Blender-IO/issues/18
            if (obj_name.startsWith("Correction_")) {
              obj_name = obj_name.substr(11);
            }
            // Prevents code-created cameras from being added to the list.
            if (obj_name.endsWith("_cam")) {
              allCameras_[obj_name] = obj.parent;
              allCameraNames_.push(obj_name);
            }
          } else {
            if (debug) {
              let objType = "Other: ";
              if (obj.isMesh) {
                objType = "Mesh: ";
              }
              if (obj.isPointLight) {
                objType = "PointLight: ";
              }
              if (obj.isSpotLight) {
                objType = "SpotLight: ";
              }
              if (obj.isAmbientLight) {
                objType = "AmbientLight: ";
              }
              console.log(" " .repeat(depth) + objType, obj.name,
                          " ", obj.type);
            }

            if (obj.isLight) {
              setupLight(obj);
            }

            if (obj.name.endsWith("_lookat")) {
              allLookats_[obj.name] = obj;
            } else {
              if (obj.userData.interactive) {
                const gameObject = GameObject(obj, world, inventory);
                allObjs_[obj.name] = gameObject;
              }
              if (obj.userData.init_invisible) {
                obj.visible = false;
              }
            }
          }

          for (let child of obj.children) {
            traverse_object(child, depth+2);
          }
        }
        traverse_object(scene, 0);
        onLoadSetup();
      },
      function () {} ,
      function (e) {
        console.error("Some error happened:" + e);
      }
    );
  }
  return {"startGame": startGame};
}
             )();
