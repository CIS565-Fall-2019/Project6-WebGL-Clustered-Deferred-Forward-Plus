import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene';
import { mat4, vec4, vec3 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
	// Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
	this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
	this._xSlices = xSlices;
	this._ySlices = ySlices;
	this._zSlices = zSlices;

	this.nearWidth = 0.0;
	this.nearHeight = 0.0;
	this.farWidth = 0.0;
	this.farHeight = 0.0;
  }

  updateClusters(camera, viewMatrix, scene) {
	// TODO: Update the cluster texture with the count and indices of the lights in each cluster
	// This will take some time. The math is nontrivial...

	for (let z = 0; z < this._zSlices; ++z) {
		for (let y = 0; y < this._ySlices; ++y) {
		  for (let x = 0; x < this._xSlices; ++x) {
			let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
			// Reset the light count to 0 for every cluster
			this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
		  }
		}
	}

	var nearHeight = 2 * camera.near * Math.tan(camera.fov * 0.5 * Math.PI/180.0);
	var nearWidth  = camera.aspect * nearHeight;

	this.nearHeight = nearHeight;
	this.nearWidth = nearWidth;

	var farHeight = 2 * camera.far * Math.tan(camera.fov * 0.5 * Math.PI/180.0);
	var farWidth  = camera.aspect * farHeight;

	this.farWidth = farWidth;
	this.farHeight = farHeight;

	var depth = camera.far - camera.near;

	for(let lightId = 0; lightId < NUM_LIGHTS; lightId++) {

		var lightPos = vec4.fromValues(
			scene.lights[lightId].position[0], 
			scene.lights[lightId].position[1], 
			scene.lights[lightId].position[2], 
			1.0, 
			);
		
		var radius = scene.lights[lightId].radius;

		vec4.transformMat4(lightPos, lightPos, viewMatrix);
		lightPos[2] = -1.0 * lightPos[2];
		
		var depthAtPos = lightPos[2];
		var lambda = (Math.abs(depthAtPos) - camera.near)/(1.0*camera.far - 1.0*camera.near);
		var widthAtLightPos = nearWidth + (farWidth-nearWidth)*lambda;
		var heightAtLightPos = nearHeight + (farHeight-nearHeight)*lambda;

		var xstep = widthAtLightPos/(1.0*this._xSlices);
		var ystep = heightAtLightPos/(1.0*this._ySlices);
		var zstep = (camera.far-camera.near)/(1.0*this._zSlices);

		var xMin = parseInt(Math.floor((lightPos[0] + 0.5*widthAtLightPos - radius) / xstep));
		var xMax = parseInt(Math.floor((lightPos[0] + 0.5*widthAtLightPos + radius) / xstep));
		xMin = Math.min(Math.max(xMin, 0), this._xSlices-1);
		xMax = Math.min(Math.max(xMax, 0), this._xSlices-1);

		
		var yMin = parseInt(Math.floor((lightPos[1] + 0.5*heightAtLightPos - radius) / ystep));
		var yMax = parseInt(Math.floor((lightPos[1] + 0.5*heightAtLightPos + radius) / ystep));;
		yMin = Math.min(Math.max(yMin, 0), this._ySlices-1);
		yMax = Math.min(Math.max(yMax, 0), this._ySlices-1);


		var zMin = parseInt(Math.floor((lightPos[2] - radius - camera.near)/zstep));
		var zMax = parseInt(Math.floor((lightPos[2] + radius - camera.near)/zstep));
		zMin = Math.min(Math.max(zMin, 0), this._zSlices-1);
		zMax = Math.min(Math.max(zMax, 0), this._zSlices-1);

		//console.log(zMin, zMax, xMin, xMax);
		for (let z = zMin; z <= zMax; ++z) {
			for (let y = yMin; y <= yMax; ++y) {
			  for (let x = xMin; x <= xMax; ++x) {
				let clusterIdx = x + y *this._xSlices + z *this._xSlices*this._ySlices;

				let numLights = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterIdx, 0)];
				if(numLights < MAX_LIGHTS_PER_CLUSTER) {
					numLights = numLights + 1;
					this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterIdx, 0)] = numLights;
					let row = Math.floor(numLights/4.0);
					let col = numLights % 4.0;
					this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterIdx, row)+col] = lightId;
				}
			  }
			}
		}
	}

	this._clusterTexture.update();
  }
}