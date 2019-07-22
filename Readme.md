# SpinControls for Three.JS

A control to rotate Object3Ds as if touching a trackball.  So the point clicked on by the mouse stays under the moving mouse.  Touch and momentum support. 

## Example
https://paulkelliott.github.io/spin-controls/

## Use
```javascript
var radius = 50;
var mesh = new THREE.Mesh(
  new THREE.SphereBufferGeometry( radius, 16, 8 ),
  new THREE.MeshBasicMaterial( { color: 0x00ff00, wireframe: true } )
);
scene.add( mesh );

var spinControl = new SpinControls( mesh, radius, camera, renderer.domElement );  

//Call every frame
  spinControl.update();
```