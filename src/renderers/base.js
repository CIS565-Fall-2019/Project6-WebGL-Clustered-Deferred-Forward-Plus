import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene.js';
import { mat4, vec4 } from 'gl-matrix';

// import for auto-complete
import Scene from '../scene.js';
import { PerspectiveCamera } from 'three';

export const MAX_LIGHTS_PER_CLUSTER = 1000;

// The effective range is [0, numSlices - 1], possible returns [-1, numSlices].
function getSliceIndex(value, min, max, numSlices) {
  let stride = (max - min) / numSlices;
  let index =  Math.floor((value - min) / stride);
  if (index < 0) {
    return 0;
  }
  if (index >= numSlices ) {
    return numSlices - 1;
  }
  return index;
}

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  /**
   * 
   * @param {PerspectiveCamera} camera 
   * @param {mat4} viewMatrix 
   * @param {Scene} scene 
   */
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

    // loop through all lights
    for (let lightIdx = 0; lightIdx < NUM_LIGHTS; lightIdx++) {
      let light = scene.lights[lightIdx];

      let lightWorldPos = vec4.create();
      lightWorldPos[0] = light.position[0];
      lightWorldPos[1] = light.position[1];
      lightWorldPos[2] = light.position[2];
      lightWorldPos[3] = 1.0;

      let lightCameraPos = vec4.create();
      vec4.transformMat4(lightCameraPos, lightWorldPos, viewMatrix);

      let lightX = lightCameraPos[0];
      let lightY = lightCameraPos[1];
      let lightZ = -lightCameraPos[2];

      let maxLightZ = lightZ + light.radius;
      let minLightZ = lightZ - light.radius;

      let minClusterZidx = getSliceIndex(minLightZ, camera.near, camera.far, this._zSlices);
      let maxClusterZidx = getSliceIndex(maxLightZ, camera.near, camera.far, this._zSlices);
      minClusterZidx = minClusterZidx < 0 ? 0 : minClusterZidx;
      maxClusterZidx = maxClusterZidx >= this._zSlices - 1 ? this._zSlices : maxClusterZidx;

      let maxLightX = lightX + light.radius * 1.2;
      let minLightX = lightX - light.radius * 1.2;
      let maxLightY = lightY + light.radius * 1.2;
      let minLightY = lightY - light.radius * 1.2;

      // frustum width and height at light z
      let frustumZ = minLightZ < camera.near ? camera.near : minLightZ;
      let yRange = frustumZ * Math.tan(camera.fov * 0.5 * (Math.PI / 180));
      let xRange = yRange * camera.aspect;

      let minClusterXidx = getSliceIndex(minLightX, -xRange, xRange, this._xSlices);
      let maxClusterXidx = getSliceIndex(maxLightX, -xRange, xRange, this._xSlices);
      let minClusterYidx = getSliceIndex(minLightY, -yRange, yRange, this._ySlices);
      let maxClusterYidx = getSliceIndex(maxLightY, -yRange, yRange, this._ySlices);
      minClusterXidx = minClusterXidx < 0 ? 0 : minClusterXidx;
      maxClusterXidx = maxClusterXidx >= this._xSlices ? this._xSlices - 1 : maxClusterXidx;
      minClusterYidx = minClusterYidx < 0 ? 0 : minClusterYidx;
      maxClusterYidx = maxClusterYidx >= this._ySlices ? this._ySlices - 1 : maxClusterYidx;

      // minClusterXidx = 0; maxClusterXidx = 14;
      // minClusterYidx = 0; maxClusterYidx = 14;
      // minClusterZidx = 0; maxClusterZidx = 14;

      for (let z = minClusterZidx; z <= maxClusterZidx; z++) {
        for (let y = minClusterYidx; y <= maxClusterYidx; y++) {
          for (let x = minClusterXidx; x <= maxClusterXidx; x++) {
            let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let count = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
            count++;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)];
            let component = Math.floor(count / 4);
            let offset = count - component * 4;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = count;
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, component) + offset] = lightIdx;
          }
        }
      }

    } // end for: loop all lights

    this._clusterTexture.update();
  }
}
