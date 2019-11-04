import TextureBuffer from './textureBuffer';
import {NUM_LIGHTS, MAX_LIGHTS_PER_CLUSTER} from '../scene';
import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import {Sphere, Box3, Vector3} from 'three';


function squared(val){return val * val;}
function distBetweenSqrd(point1, point2){
	return (squared(point2[0] - point1[0]) + squared(point2[1] - point1[1])  + squared(point2[2] - point1[2]));
}



function degToRad(deg){
	let pi = Math.PI;
	return deg * (pi / 180.0);
}


export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
	//DEFAULT: 1.0, 0.0, 0.025, 100.0
	this._material = [1.0, 0.0, 0.025, 100.0];
  }

  updateClusters(camera, viewMatrix, scene) {
    // TDO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...
	//Note: initialized with (15, 15, 15) for relevant renderers
    //For finding tile index in depth, using DOOM method:
    //Z = Near_z * \frac{Far_z}{Near_z}^\frac{slice}{numSlices}
    //Going the opposite way:
    //$slice = \lfloor log(Z) * \frac{numSlices}{log(\frac{Far_z}{Near_z})} - \frac{numSlices*log(Near_z)}{log(\frac{Far_z}{Near_z})} \rfloor$
    var util = require('util');

	let invXform = mat4.create();
	mat4.invert(invXform, viewMatrix);

	let zMin = camera.near;
	let zMax = camera.far;
	//let zTitantic = camera.whereverYouAre;

	var xformedLights = [];
	for (let i = 0; i < NUM_LIGHTS; i++){
		let lightPos = scene.lights[i].position;
		let posVec = [lightPos[0], lightPos[1], lightPos[2], 1.0];
		xformedLights[i] = vec4.create();
		vec4.transformMat4(xformedLights[i], posVec, viewMatrix);
	}

    for (let z = 0; z < this._zSlices; ++z) {
	  let zLo = zMin * Math.pow((zMax / zMin), (z / this._zSlices));
	  let zHi = zMin * Math.pow((zMax / zMin), ((z + 1) / this._zSlices));
	  let temp = zHi;
	  zHi = -zLo;
	  zLo = -temp;//fuck this backwards-ass coordinate system
	  //zLo will be the lower value, but have the higher absolute value, because they end up negative like dummies
	  let halfTangent = Math.tan(degToRad(camera.fov * 0.5));
	  let frustumHeight = -2.0 * zLo * halfTangent;
	  let frustumWidth = frustumHeight * camera.aspect;
	  let yMin = -1.0 * (frustumHeight / 2.0);
	  let xMin = -1.0 * (frustumWidth / 2.0);
	  let yDelta = frustumHeight / this._ySlices;
	  let xDelta = frustumWidth / this._xSlices;

      for (let y = 0; y < this._ySlices; ++y) {
		let yLo = yMin + yDelta * y;
		let yHi = yMin + yDelta * (y + 1);
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
		  let bufIdx = this._clusterTexture.bufferIndex(i, 0);
          this._clusterTexture.buffer[bufIdx] = 0;

		  let xLo = xMin + xDelta * x;
		  let xHi = xMin + xDelta * (x + 1);

		  //making an AABB for our camera-space tile
		  let blCorner = new Vector3(xLo, yLo, zLo);
		  let trCorner = new Vector3(xHi, yHi, zHi);
		  let aabb = new Box3(blCorner, trCorner);

		  var numLights = 0;
		  for(let j = 0; j < NUM_LIGHTS; j++){
			let radius = scene.lights[j].radius;
			let lightPos = new Vector3(xformedLights[j][0], xformedLights[j][1], xformedLights[j][2]);
			let sphere = new Sphere(lightPos, radius);
			let doesEncroach = sphere.intersectsBox(aabb);
			if (doesEncroach){
				numLights += 1;
				let wholePart = Math.floor(numLights / 4);
				let extraPart = numLights % 4;
				let lightIndex = this._clusterTexture.bufferIndex(i, wholePart) + extraPart;
				this._clusterTexture.buffer[lightIndex] = j;
				if (numLights >= MAX_LIGHTS_PER_CLUSTER) break;
			}
		  }//for
          this._clusterTexture.buffer[bufIdx] = numLights;

		  //Fill clusterTexture
		  //For each (tile?) cluster, are MAX_LIGHTS_PER_CLUSTER + 1 floats at the cluster's coordinate
		  //first float is number of lights at this one, every float after that an index for next light in list
		  // - alternative, set of booleans for "this light present or not" - would work for packing more efficiently, could bitmask inside ints (later)
		  // Clusters are just dividing the screen space
			}
		  }
		}

    this._clusterTexture.update();
  }
}
