/**
 * @author PaulKElliott / http://vizworkshop.com
 */

var SpinControls = function ( object, trackBallRadius, camera, domElement ) {

	var _this = this;

	this.object = object;
	this.trackballRadius = trackBallRadius;
	this.camera = camera;
	this.domElement = ( domElement !== undefined ) ? domElement : document;

	// API

	this.enabled = true;

	this.screen = { left: 0, top: 0, width: 0, height: 0 };

	this.rotateSensativity = 1.0; // Keep at 1 for direct touching feel
	this.enableDamping = true;
	this.dampingFactor = 5; // Increase for more friction

	this.spinAxisConstraint; // Set to THREE.vector3 for limit spinning around specific axis

	// Internals

	var _angularVelocity = new THREE.Vector3(0, 0, 0),
		_lastQuaternion = new THREE.Quaternion(),
		_lastVelTime,

		_mousePrev = new THREE.Vector2(),
		_mouseCurr = new THREE.Vector2(),
		_lastMouseEventTime = 0,

		// Seperate touch variables as might be mouseing and touching at same time on laptop?
		_touchPrev = new THREE.Vector2(),
		_touchCurr = new THREE.Vector2(),
		_lastTouchEventTime = 0,

		_isPointerDown = false,

		_ray = new THREE.Ray(),
		_trackBallSphere = new THREE.Sphere(),

		_EPS = 0.000001,
		_OFF_TRACKBALL_VELOCITY_GAIN = 8.0; // ToDo: Base this on angle change around sphere edge?


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

		var objectPos = new THREE.Vector3(),
			objectToCamera = new THREE.Vector3(),
			objectPlane = new THREE.Plane(),

			currentInputDirection = new THREE.Vector3(),
			lastInputDirection = new THREE.Vector3(),
			currentInputPos = new THREE.Vector3(),
			lastInputPos = new THREE.Vector3(),

			deltaMouse = new THREE.Vector2(),
			polarVel = new THREE.Vector3(),

			angle;

		return function updateAngularVelocity( currentNdc, lastNdc, deltaTime ) {

			// Intersect mouse on plane at object with normal pointing to camera

			objectPos.setFromMatrixPosition( _this.object.matrixWorld );
			objectToCamera.copy( _this.camera.position ).sub( objectPos );
			objectPlane.setFromNormalAndCoplanarPoint( objectToCamera, objectPos );

			_ray.origin.copy( _this.camera.position );

			currentInputDirection.set( currentNdc.x, currentNdc.y, .5 )
			currentInputDirection.unproject( _this.camera ) // In world space
			currentInputDirection.sub( _this.camera.position ).normalize() // Subtract to put around origin
			_ray.direction.copy( currentInputDirection )

			if( _ray.intersectPlane( objectPlane, currentInputPos ) == null ) {

				return; // We could be facing 180 degrees away

			}

			// Put in object position space to find trackball radius
			currentInputPos.sub( objectPos );

			lastInputDirection.set( lastNdc.x, lastNdc.y, .5 );
			lastInputDirection.unproject( _this.camera );
			lastInputDirection.sub( _this.camera.position ).normalize();
			_ray.direction.copy( lastInputDirection );

			if( _ray.intersectPlane( objectPlane, lastInputPos ) == null ) {

				return;

			}

			lastInputPos.sub( objectPos );

			// Is pointer over trackball?
			if( currentInputPos.length() < _this.trackballRadius && lastInputPos.length() < _this.trackballRadius ) {
			
				// Project mouse on trackball sphere

				if( _this.trackballRadius <= objectToCamera.length()  ) { // If trackball smaller than camera distance

					_trackBallSphere.set( objectPos, _this.trackballRadius);
					_ray.direction.copy( currentInputDirection );

					if( _ray.intersectSphere( _trackBallSphere, currentInputPos ) == null ) {

						return;

					}

					_ray.direction.copy( lastInputDirection );

					if( _ray.intersectSphere( _trackBallSphere, lastInputPos ) == null ) {

						return;

					}

					// Put in object position space
					currentInputPos.sub( objectPos );
					lastInputPos.sub( objectPos );

				}

				angle = lastInputPos.angleTo( currentInputPos ) / deltaTime;

				// Change in angular vel
				_angularVelocity.crossVectors( lastInputPos, currentInputPos );
				_angularVelocity.setLength( angle ); // Just set it because we are touching trackball without sliding

			}	else {

				// Keep rotating based on delta mouse in normalized device coordinates

				//ToDo: Simplify by find delta mouse polar coordinates with THREE.Sphere?
				
				objectPos.project( _this.camera );
				
				deltaMouse.subVectors(currentNdc, lastNdc);

				// Find change in mouse radius to trackball center
				// var ballAngleSize = Math.atan( _this.trackballRadius / objectToCamera.length() );
				// var ndcPerDegree = 1 / ( _this.camera.fov / 2 );
				// var ndcPerBall = ndcPerDegree / ballAngleSize;				
				// Same as above in one line
				var ndcPerBall = ( 1 / ( _this.camera.fov / 2 ) ) // NDC per degree
					/ ( Math.atan( _this.trackballRadius / objectToCamera.length() ) ); // Ball angle size

				lastNdc.sub(objectPos) // Move into object space
				lastNdc.normalize();
				var deltaRadius = deltaMouse.dot( lastNdc ) * ndcPerBall / deltaTime * _OFF_TRACKBALL_VELOCITY_GAIN;

				_angularVelocity.crossVectors( objectToCamera, lastInputPos );
				_angularVelocity.setLength( deltaRadius ); // Just set it because we are touching trackball without sliding

				// Find polar angle change
				angle = lastInputPos.angleTo( currentInputPos ) / deltaTime;
				polarVel.crossVectors( lastInputPos, currentInputPos );
				polarVel.setLength( angle ); 

				_angularVelocity.add( polarVel );

			}

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
				quat.setFromAxisAngle( normalizedAxis, deltaAngle * deltaTime * _this.rotateSensativity );

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

	// listeners

	function onMouseDown( event ) {

		if ( _this.enabled === false || event.button !== 0 ) return;

		var pointerNDC = getPointerInNdc( event.pageX, event.pageY );

		event.preventDefault(); // Prevent the browser from scrolling.
		event.stopImmediatePropagation(); //Prevent other controls from working.

		// Manually set the focus since calling preventDefault above
		// prevents the browser from setting it automatically.
		_this.domElement.focus ? _this.domElement.focus() : window.focus();

		_mouseCurr.copy( pointerNDC );
		_lastMouseEventTime = performance.now();
		_angularVelocity.set( 0, 0, 0 );
		_isPointerDown = true;

		document.addEventListener( 'mousemove', onMouseMove, false );
		document.addEventListener( 'mouseup', onMouseUp, false );

		_this.dispatchEvent( startEvent );

	}

	function onMouseMove( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();

		_mousePrev.copy( _mouseCurr );
		_mouseCurr.copy( getPointerInNdc( event.pageX, event.pageY ) );
		
		var currentTime = performance.now();
		var deltaTime = ( currentTime - _lastMouseEventTime ) / 1000.0;
		_lastMouseEventTime = currentTime;

		if( deltaTime > 0 ) { // Sometimes not non zero due to timer precision?			

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

		document.removeEventListener( 'mousemove', onMouseMove );
		document.removeEventListener( 'mouseup', onMouseUp );
		_this.dispatchEvent( endEvent );

	}

	this.cancelSpin = ( function () {
		
		_angularVelocity.set( 0, 0, 0 );

	} );

	this.handleTouchStart = function( event ) { 

		_touchCurr.copy( getPointerInNdc( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );		
		_lastTouchEventTime = performance.now();
		_angularVelocity.set( 0, 0, 0 );
		_isPointerDown = true;
		_this.applyVelocity();  //ToDo HAXXX

	}

	function onTouchStart( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault(); // Prevent the browser from scrolling.
		event.stopImmediatePropagation(); //Prevent other controls from working.

		// Manually set the focus since calling preventDefault above
		// prevents the browser from setting it automatically.
		_this.domElement.focus ? _this.domElement.focus() : window.focus();

		_this.handleTouchStart( event );

		_this.dispatchEvent( startEvent );

	}

	function onTouchMove( event ) {
		
		if ( _this.enabled === false || !_isPointerDown ) return;

		event.preventDefault();
		event.stopImmediatePropagation(); //Prevent other controls from working.

		_touchPrev.copy( _touchCurr );
		_touchCurr.copy( getPointerInNdc( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );

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

		if( !_this.isPointerMovedThisFrame ) {

			var deltaTime = ( performance.now() - _lastTouchEventTime ) / 1000.0;
			_angularVelocity.multiplyScalar( 1 / ( 10 * deltaTime * _this.dampingFactor + 1 ) ) // To support subtle touches do big dampaning, not zering it
		
		}

		_isPointerDown = false;

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