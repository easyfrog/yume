/**
 * @file A simple vehicle that uses steering behaviors.
 * 
 * @author Human Interactive
 */
"use strict";

var THREE = require( "three" );

var MovingEntity = require( "./MovingEntity" );
var SteeringBehaviors = require( "../steering/SteeringBehaviors" );
var Smoother = require( "../steering/Smoother" );

/**
 * Creates a new vehicle.
 * 
 * @constructor
 * @augments MovingEntity
 * 
 * @param {EntityManager} entityManager - The reference to the entity manager.
 * @param {THREE.Vector3} velocity - The velocity of the agent.
 * @param {number} mass - The mass of the agent.
 * @param {number} maxSpeed - The maximum speed at which this entity may travel.
 * @param {number} maxForce - The maximum force this entity can produce to power itself (think rockets and thrust).
 * @param {number} maxTurnRate - The maximum rate (radians per second) at which this vehicle can rotate.
 * @param {number} numSamplesForSmoothing - How many samples the smoother will use to average the velocity.
 */
function Vehicle( entityManager, velocity, mass, maxSpeed, maxForce, maxTurnRate, numSamplesForSmoothing ) {

	MovingEntity.call( this, entityManager, velocity, mass, maxSpeed, maxForce, maxTurnRate );

	Object.defineProperties( this, {
		steering : {
			value : new SteeringBehaviors( this ),
			configurable : false,
			enumerable : true,
			writable : false
		},
		isSmoothingOn : {
			value : false,
			configurable : false,
			enumerable : true,
			writable : true
		},
		_smoother : {
			value : new Smoother( numSamplesForSmoothing || 0 ),
			configurable : false,
			enumerable : false,
			writable : false
		},
		_smoothedVelocity : {
			value : new THREE.Vector3(),
			configurable : false,
			enumerable : false,
			writable : true
		}
	} );

}

Vehicle.prototype = Object.create( MovingEntity.prototype );
Vehicle.prototype.constructor = Vehicle;

/**
 * Updates the position and orientation of the vehicle.
 * 
 * @param {number} delta - The time delta value.
 */
Vehicle.prototype.update = ( function() {

	var steeringForce = null;

	var displacement = new THREE.Vector3();
	var acceleration = new THREE.Vector3();

	return function( delta ) {

		// calculate steering force
		steeringForce = this.steering.calculate( delta );

		// acceleration = force / mass
		acceleration.copy( steeringForce ).divideScalar( this.mass );

		// update velocity
		this.velocity.add( acceleration.multiplyScalar( delta ) );

		// make sure vehicle does not exceed maximum velocity
		if ( this.velocity.length() > this.maxSpeed )
		{

			this.velocity.normalize();

			this.velocity.multiplyScalar( this.maxSpeed );
		}

		// calculate displacement
		displacement.copy( this.velocity ).multiplyScalar( delta );

		// update the position
		this.position.add( displacement );

		// update the orientation if the vehicle has a non zero velocity
		if ( this.velocity.lengthSq() > 0.00000001 )
		{
			// check smoothing
			if ( this.isSmoothingOn === true )
			{
				// decouple velocity and heading. calculate the orientation
				// with an averaged velocity to avoid oscillations/judder.
				this._smoother.update( this.velocity, this._smoothedVelocity );

				this._updateOrientation( this._smoothedVelocity );
			}
			else
			{
				// couple velocity and orientation
				this._updateOrientation( this.velocity );
			}
		}

	};

}() );

/**
 * This method rotates the vehicle to the given direction.
 * 
 * @param {THREE.Vector3} - The direction to rotate.
 */
Vehicle.prototype._updateOrientation = ( function() {

	var xAxis = new THREE.Vector3(); // right
	var yAxis = new THREE.Vector3(); // up
	var zAxis = new THREE.Vector3(); // front

	var upTemp = new THREE.Vector3( 0, 1, 0 );

	var rotationMatrix = new THREE.Matrix4();

	return function( direction ) {

		// the front vector always points to the direction vector
		zAxis.copy( direction ).normalize();

		// avoid zero-length axis
		if ( zAxis.length() === 0 )
		{
			zAxis.z = 1;
		}

		// compute right vector
		xAxis.crossVectors( zAxis, upTemp );

		// avoid zero-length axis
		if ( xAxis.length() === 0 )
		{
			zAxis.x += 0.0001;
			xAxis.crossVectors( zAxis, upTemp ).normalize();
		}

		// compute up vector
		yAxis.crossVectors( zAxis, xAxis );

		// setup a rotation matrix of the basis
		rotationMatrix.makeBasis( xAxis, yAxis, zAxis );

		// apply rotation
		this.quaternion.setFromRotationMatrix( rotationMatrix );

	};

}() );

module.exports = Vehicle;