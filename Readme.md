# Spin Controls for Three.JS

A control to rotate Object3Ds as if touching a trackball.  Momentum support. 

## Example
https://paulkelliott.github.io/spin-controls/

## Use
```javascript
var mesh = new THREE.Mesh(
  new THREE.SphereBufferGeometry( 50, 16, 8 ),
  new THREE.MeshBasicMaterial( { color: 0x00ff00, wireframe: true } )
);
scene.add( mesh );
        
// Construct before other controls so it can event.stopImmediatePropagation()
spinControlSmall = new SpinControls( mesh, radius, camera, renderer.domElement );  
```