# SpinControls for three.js

Trackball style control for three.js Object3Ds and Cameras. Featuring pointer to trackball accuracy and unlimited rotation. 


## [Demo](https://paulhax.github.io/spin-controls/)


## Features

- Accurate pointer to trackball feel by perspective raycast
- Rotation continues relatively when pointer is beyond trackball
- Camera or object control
- Touchscreen support so 2+ fingers zoom, pan, and rotate
- Camera can pivot about a point of interest, not just view center
- Momentum for rotation after releasing a pointer
- Raycast, Shoemake, Holroyd, and Fujii's pointer to trackball mapping methods
- Axis of spin constraint option


## When to use SpinControls

Like other trackball style controls, SpinControls does not limit rotation about a "up" axis.  THREE.OrbitControls and other “turntable” style controls limit rotation across the Y axis.  Constraints are good.  But when a model has no natural up direction, or you must view a scene from a “rolled” orientation, use a trackball style control.

Unlike other trackball implementations, SpinControls keeps the trackball point clicked on under the cursor with raycasting.  To support unlimited rotation until the cursor hits the edge of the screen, a relative rotation option kicks in when the cursor is off the trackball.


## Spin Object3D
```javascript
var radius = 50;
var mesh = new THREE.Mesh(
  new THREE.SphereBufferGeometry( radius, 16, 8 ),
  new THREE.MeshBasicMaterial( { color: 0x00ff00, wireframe: true } )
);
scene.add( mesh );

var spinControl = new SpinControls( mesh, radius, camera, renderer.domElement );  

// Call every frame, like before renderer.render( scene, camera ) in function animate()
  spinControl.update();

// Call when viewport HTML element resizes or moves, like 'resize' event callback
// window.addEventListener( 'resize', onWindowResize, false );
  cameraSpinControl.onWindowResize();
```


## Spin Camera
```javascript
var camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 10000 );
camera.position.set( 0, 0, 500 ); // set initial pivot distance before creating CameraSpinControls

var cameraSpinControl = new CameraSpinControls( camera, renderer.domElement );

// Call every frame, like before renderer.render( scene, camera ) in function animate()
  cameraSpinControl.update();

// Call onWindowResize when viewport HTML element resizes or moves, probably in 
// window.addEventListener( 'resize', onWindowResize, false );
  cameraSpinControl.onWindowResize();

// To draw some rotation UI, can register for start, change, and end events
cameraSpinControl.addEventListener( 'start', function ( event ) {
  trackballWidget.visible = true;
  updateCameraSpinUI();
} );
```


## Differences from THREE.TrackballControls


### Raycasting of pointer to trackball

To keep trackball point clicked on under the pointer, SpinControls casts a ray through the camera projection.

THREE.TrackballControls, along with Shoemake’s arcball, use an orthographic projection in their pointer to trackball mapping.  When the pointer moves over the trackball closer to the edges of the screen, the trackball rotates too much and the trackball point clicked on disconnects from the cursor position.  With an orthographic camera, this is not a problem.   With the more common perspective camera, the trackball appears to swim under the pointer.  

### Continuous rotation beyond 3D viewport or trackball

For large rotations with one gesture, SpinControls continues to rotate when the pointer is off the trackball.  THREE.TrackballControls/Shoemake stop responding to pointer movement along the line from the pointer to the trackball center.  Sadly, without using the browser pointer lock API, SpinControls can’t get the relative movement of the mouse when it reaches the edge of the screens and rotation will stop.

### Camera pivot at application defined point

Sometimes you'd like the camera to rotate around a point of interest that is not in the center of the screen.  The application can set the pivot point to say the intersection of the mouse/pointer with a 3D model. Also enables dolly/zoom towards pointer position.  See index.html.

### Rotation of THREE.Object3D

At its core SpinControls rotates THREE.Object3Ds.  Option for an axis of spin constraint.

### Less efficient, more complicated and buggy than THREE.TrackballControls =)

Use SpinControls when you want:

*   Direct touch feel for THREE.Objects or the camera.
*   Rotation when pointer is beyond object or viewport.


## Links that helped

Short trackball introduction: [https://www.mattkeeter.com/projects/rotation/](https://www.mattkeeter.com/projects/rotation/)

Trackballs Revisited paper: [http://hjemmesider.diku.dk/~kash/papers/DSAGM2002_henriksen.pdf](http://hjemmesider.diku.dk/~kash/papers/DSAGM2002_henriksen.pdf)

Digestible formulas: [https://www.khronos.org/opengl/wiki/Object_Mouse_Trackball](https://www.khronos.org/opengl/wiki/Object_Mouse_Trackball)

Yasuhiro Fujii inspired the implementation of the traditional Shoemake/Holroyd pointer-trackball mappings: [https://mimosa-pudica.net/3d-rotation/](https://mimosa-pudica.net/3d-rotation/)
