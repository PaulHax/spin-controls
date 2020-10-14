/**
 * @author Eberhard Graether / http://egraether.com/
 * @author Mark Lundin 	/ http://mark-lundin.com
 * @author Simone Manini / http://daron1337.github.io
 * @author Luca Antiga 	/ http://lantiga.github.io
 * @author Paul Elliott / http://vizworkshop.com
 */

var SpinControls = function ( object, trackBallRadius, camera, domElement ) {

	var _this = this;

	this.object = object;
	this.trackballRadius = trackBallRadius;
	this.camera = camera;
	this.domElement = ( domElement !== undefined ) ? domElement : document;

	// API

	this.enabled = true;

	this.rotateSensitivity = 1.0; // Keep at 1 for direct touching feel
	this.enableDamping = true;
	this.dampingFactor = 5; // Increase for more friction
	this.spinAxisConstraint; // Set to a THREE.Vector3 to limit spinning around an axis

	// Shoemake has direct touching feel of pointer on orthographically projected sphere but jumps at sphere edge.
	// Holyroyd smooths between sphere and hyperbola to avoid jump at sphere edge.
	// Azimuthal is something else from Yasuhiro Fujii.
	this.POINTER_SPHERE_MAPPING = { SHOEMAKE: 0, HOLROYD: 1, AZIMUTHAL: 2};
	this.rotateAlgorithm = this.POINTER_SPHERE_MAPPING.HOLROYD;

	// Internals

	this.screen = { left: 0, top: 0, width: 0, height: 0 };

	var _angularVelocity = new THREE.Vector3(0, 0, 0),
		_lastQuaternion = new THREE.Quaternion(),
		_lastVelTime,

		_mousePrev = new THREE.Vector3(),
		_mouseCurr = new THREE.Vector3(),
		_mouseCurrNDC = new THREE.Vector2(),
		_lastMouseEventTime = 0,

		// Separate touch variables as might be mousing and touching at same time on laptop?
		_touchPrev = new THREE.Vector3(),
		_touchCurr = new THREE.Vector3(),
		_touchCurrNDC = new THREE.Vector2(),
		_lastTouchEventTime = 0,

		_isPointerDown = false,
		_isMouseDown = false,
		_isTouchDown = false,

		_EPS = 0.000001;

	var changeEvent = { type: 'change' };
	var startEvent = { type: 'start' };
	var endEvent = { type: 'end' };

	this.update = ( function () {

		var currentTime;
		var lastTime = performance.now() / 1000.0;
		var deltaTime;

		return function update() {

			currentTime = performance.now() / 1000.0;
			deltaTime = currentTime - lastTime;
			lastTime = currentTime;

			if( !_isPointerDown && _this.enableDamping ) {

				_angularVelocity.multiplyScalar( 1 / ( deltaTime * _this.dampingFactor + 1 ) );

				_this.applyVelocity();

			}

			if( !_this.enableDamping ) {

				_lastVelTime = performance.now(); // ToDo Avoid this hack.  Causes trackball drift.

			}
			
			_this.isPointerMovedThisFrame = false;

		};

	}() );


	this.updateAngularVelocity = ( function () {

		var q0 = new THREE.Quaternion(),
			q1 = new THREE.Quaternion(),
			q0Conj = new THREE.Quaternion(),
			angleDelta;

		return function updateAngularVelocity( p1, p0, timeDelta ) {

			// path independent rotation from Shoemake
			// q0Conj.set(p0.x, p0.y, p0.z, 0.0)
			// q0Conj.normalize();
			// q0Conj.conjugate();
			// q1.set(p1.x, p1.y, p1.z, 0.0).multiply(q0Conj); 
			// timeDelta *= 2.0; // divide angleDelta by 2 to keep sphere under pointer.  Might break algorithm properties, TODO: perhaps investigate.
			
			// path dependent
			q1.setFromUnitVectors(p0, p1); 
			
			q0.set(p0.x, p0.y, p0.z, 1.0);
			angleSpeed = q1.angleTo(q0) / timeDelta;			

			// Just set velocity because we are touching trackball without sliding
			_angularVelocity.crossVectors( p0, p1);
			_angularVelocity.setLength( angleSpeed );
			_this.applyVelocity(); // DO IT NOW!

		};

	}() );


	this.applyVelocity = ( function () {

		var quat = new THREE.Quaternion(),
			normalizedAxis = new THREE.Vector3(),
			deltaAngle,
			deltaTime,
			timeStamp;

		return function applyVelocity() {

			timeStamp = performance.now();
			deltaTime = ( timeStamp - _lastVelTime ) / 1000.0;
			_lastVelTime = timeStamp;

			if( _this.spinAxisConstraint ) {

				normalizedAxis.copy( _this.spinAxisConstraint );
				deltaAngle = normalizedAxis.dot( _angularVelocity ) ;

			} else {

				normalizedAxis.copy( _angularVelocity );
				deltaAngle = _angularVelocity.length();

			}

			if ( deltaAngle && deltaTime ) {

				normalizedAxis.normalize();
				quat.setFromAxisAngle( normalizedAxis, deltaAngle * deltaTime * _this.rotateSensitivity );

				_this.object.quaternion.normalize();
				_this.object.quaternion.premultiply(quat);

				// using small-angle approximation cos(x/2) = 1 - x^2 / 8

				if ( 8 * ( 1 - _lastQuaternion.dot( _this.object.quaternion ) ) > _EPS) {

					_this.dispatchEvent( changeEvent );

					_lastQuaternion.copy( _this.object.quaternion );

				}

			}

		};

	}() );

	this.onWindowResize = ( function () {

		if ( _this.domElement === document ) {

			_this.screen.left = 0;
			_this.screen.top = 0;
			_this.screen.width = window.innerWidth;
			_this.screen.height = window.innerHeight;

		} else {

			var box = _this.domElement.getBoundingClientRect();
			// adjustments come from similar code in the jquery offset() function
			var d = _this.domElement.ownerDocument.documentElement;
			_this.screen.left = box.left + window.pageXOffset - d.clientLeft;
			_this.screen.top = box.top + window.pageYOffset - d.clientTop;
			_this.screen.width = box.width;
			_this.screen.height = box.height;

		}

	} );


	this.resetInputAfterCameraMovement = ( function () {
		
		if( _isMouseDown ) {
			_mouseCurr.copy( getPointerInSphere( getPointerInNdc( _mouseCurrNDC.x, _mouseCurrNDC.y ) ) );
		}

		if( _isTouchDown ) {
			_touchCurr.copy( getPointerInSphere( getPointerInNdc( _touchCurrNDC.x, _touchCurrNDC.y ) ) );
		}
		
	} );

	var getPointerInNdc = ( function () {

		var vector = new THREE.Vector2();

		return function getPointerInNdc( pageX, pageY ) {

			vector.set(
				( ( pageX - _this.screen.width * 0.5 - _this.screen.left ) / ( _this.screen.width * 0.5 ) ),
				( ( _this.screen.height + 2 * ( _this.screen.top - pageY ) ) / _this.screen.height )
			);

			return vector;

		};

	}() );

	var getPointerInSphere = ( function () {

		var point = new THREE.Vector3(),
			objPos = new THREE.Vector3(),
			objEdgePos = new THREE.Vector3(),
			objToPointer = new THREE.Vector2(),
			cameraRot = new THREE.Quaternion();

		return function getPointerInSphere( ndc ) {

			// Move pointer to spinning object space on screen
			_this.object.updateWorldMatrix(true, false);
			objPos.setFromMatrixPosition(_this.object.matrixWorld);
			_this.camera.updateWorldMatrix(true, false);
			objPos.project( _this.camera ); // position in ndc/screen
			//object to pointer
			objToPointer.set(objPos.x, objPos.y);
			objToPointer.subVectors(ndc, objToPointer);

			// Scale by object screen size.  TODO simplify if Orthographic camera.
			objEdgePos.setFromMatrixPosition(_this.object.matrixWorld); // objEdgePos is aspirational on this line
			var offset = new THREE.Vector3().set(_this.trackballRadius, 0, 0);
			// rotate to point at screen center. TODO Investigate
			// objPos.z = 0;
			// if(objPos.lengthSq() > 0) {
			// 	offset.applyAxisAngle(point.set(0, 0, -1),  offset.angleTo(objPos)); 
			// }
			offset.applyQuaternion(cameraRot.setFromRotationMatrix(_this.camera.matrixWorld));
			objEdgePos.add(offset);
			objEdgePos.project( _this.camera ); // position in ndc/screen
			objEdgePos.z = 0;
			objPos.z = 0;
			var objRadiusNDC = objEdgePos.distanceTo(objPos);

			objToPointer.x = objToPointer.x * (1 / objRadiusNDC);
			objToPointer.y = objToPointer.y * (1 / objRadiusNDC);
			if(_this.camera.aspect) { // Perspective camera probably
				objToPointer.y /= _this.camera.aspect;
			}

			// Pointer mapping code below derived from https://mimosa-pudica.net/3d-rotation/
			if( _this.rotateAlgorithm == _this.POINTER_SPHERE_MAPPING.HOLROYD ) {
				var t = objToPointer.lengthSq();
				if (t < 0.5) {
					point.set(objToPointer.x, objToPointer.y, Math.sqrt(1.0 - t));
				}
				else {
					point.set(objToPointer.x, objToPointer.y, 1.0 / (2.0 * Math.sqrt(t)));
					point.normalize();
				}
			}
			else if( _this.rotateAlgorithm == _this.POINTER_SPHERE_MAPPING.SHOEMAKE ) {
				//FIXME CameraSpinControls jumps when moving off/on sphere with Shoemake mapping
				var t = objToPointer.lengthSq();
				if (t < 1.0) {
					point.set(objToPointer.x, objToPointer.y, Math.sqrt(1.0 - t));
				}
				else {
					objToPointer.normalize();
					point.set(objToPointer.x, objToPointer.y, 0.0);
				}
			}
			else if( _this.rotateAlgorithm == _this.POINTER_SPHERE_MAPPING.HOLROYD ) {
				var t = (Math.PI / 2.0) * objToPointer.length();
				var sined = t < Number.EPSILON ? 1.0 : Math.sin(t) / t;
				objToPointer.multiplyScalar((Math.PI / 2.0) * sined);
				point.set(objToPointer.x, objToPointer.y, Math.cos(t));
			}
			

			point.applyQuaternion(cameraRot); // Rotate from z axis to camera direction

			return point;

		};

	}() );

	// listeners

	function onMouseDown( event ) {

		if ( _this.enabled === false || event.button !== 0 ) return;


		event.preventDefault(); // Prevent the browser from scrolling.
		event.stopImmediatePropagation(); // Stop other controls working.

		// Manually set the focus since calling preventDefault above
		// prevents the browser from setting it automatically.
		_this.domElement.focus ? _this.domElement.focus() : window.focus();
		
		_mouseCurr.copy( getPointerInSphere( getPointerInNdc( event.pageX, event.pageY ) ) );
		_mouseCurrNDC.set( event.pageX, event.pageY )
		_lastMouseEventTime = performance.now();
		_angularVelocity.set( 0, 0, 0 );
		_isPointerDown = true;
		_isMouseDown = true;

		document.addEventListener( 'mousemove', onMouseMove, false );
		document.addEventListener( 'mouseup', onMouseUp, false );

		_this.dispatchEvent( startEvent );

	}

	function onMouseMove( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();

		_mousePrev.copy( _mouseCurr );
		_mouseCurr.copy( getPointerInSphere( getPointerInNdc( event.pageX, event.pageY ) ) );
		_mouseCurrNDC.set( event.pageX, event.pageY )

		var currentTime = performance.now();
		var deltaTime = ( currentTime - _lastMouseEventTime ) / 1000.0;
		_lastMouseEventTime = currentTime;

		if( deltaTime > 0 ) { // Sometimes zero due to timer precision?			

			_this.updateAngularVelocity( _mouseCurr, _mousePrev, deltaTime);

		}
		
		_this.isPointerMovedThisFrame = true;

	}

	function onMouseUp( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();

		if( !_this.isPointerMovedThisFrame || !_this.enableDamping ) {
			_angularVelocity.set( 0, 0, 0 );
		}

		_isPointerDown = false;
		_isMouseDown = false;

		document.removeEventListener( 'mousemove', onMouseMove );
		document.removeEventListener( 'mouseup', onMouseUp );
		_this.dispatchEvent( endEvent );

	}

	// For camera controls to stop spin with 2 finger pinch
	this.cancelSpin = ( function () {
		
		_angularVelocity.set( 0, 0, 0 );

	} );

	// Function broken out for CameraSpinControls to use in touch end
	this.handleTouchStart = function( event ) {

		_touchCurr.copy( getPointerInSphere( getPointerInNdc( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) ) );
		_touchCurrNDC.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY )
		_lastTouchEventTime = performance.now();
		_angularVelocity.set( 0, 0, 0 );
		_isPointerDown = true;
		_isTouchDown = true;
		_this.applyVelocity();  //Todo Should not be needed here

	}

	function onTouchStart( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault(); // Prevent the browser from scrolling.
		event.stopImmediatePropagation(); // Prevent other controls from working.

		// Manually set the focus since calling preventDefault above
		// prevents the browser from setting it automatically.
		_this.domElement.focus ? _this.domElement.focus() : window.focus();

		_this.handleTouchStart( event );

		_this.dispatchEvent( startEvent );

	}

	function onTouchMove( event ) {
		
		if ( _this.enabled === false || !_isPointerDown ) return;

		event.preventDefault();
		event.stopImmediatePropagation(); // Prevent other controls from working.

		_touchPrev.copy( _touchCurr );
		_touchCurr.copy( getPointerInSphere( getPointerInNdc( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) ) );
		_touchCurrNDC.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY )

		var currentTime = performance.now();
		var deltaTime = ( currentTime - _lastTouchEventTime ) / 1000.0;
		_lastTouchEventTime = currentTime;

		if(deltaTime > 0) { // Sometimes zero due to timer precision?

			_this.updateAngularVelocity( _touchCurr, _touchPrev, deltaTime);

		}

		_this.isPointerMovedThisFrame = true;

	}

	function onTouchEnd( event ) {

		if( _this.enabled === false || !_isPointerDown ) return;

		if( !_this.isPointerMovedThisFrame ) { // TODO maybe set to zero if no dampening/momentum?
			
			// To support subtle touches do big dampening, not zeroing it
			var deltaTime = ( performance.now() - _lastTouchEventTime ) / 1000.0;
			_angularVelocity.multiplyScalar( 1 / ( 10 * deltaTime * _this.dampingFactor + 1 ) ) 
		
		}

		_isPointerDown = false;
		_isTouchDown = false;

		_this.dispatchEvent( endEvent );

	}

	this.dispose = function () {

		_this.domElement.removeEventListener( 'resize', onWindowResize );

		_this.domElement.removeEventListener( 'mousedown', onMouseDown );
		document.removeEventListener( 'mousemove', onMouseMove );
		document.removeEventListener( 'mouseup', onMouseUp );

		_this.domElement.removeEventListener( 'touchstart', onTouchStart );		
		_this.domElement.removeEventListener( 'touchmove', onTouchMove );
		_this.domElement.removeEventListener( 'touchend', onTouchEnd );

	};

	_this.domElement.addEventListener( 'resize', onWindowResize );	
	_this.domElement.addEventListener( 'mousedown', onMouseDown );

	_this.domElement.addEventListener( 'touchstart', onTouchStart, {passive: false} );
	_this.domElement.addEventListener( 'touchmove', onTouchMove, {passive: false} );
	_this.domElement.addEventListener( 'touchend', onTouchEnd, {passive: false} );

	_this.onWindowResize();
	// force an update at start
	_this.update();

};

SpinControls.prototype = Object.create( THREE.EventDispatcher.prototype );
SpinControls.prototype.constructor = SpinControls;