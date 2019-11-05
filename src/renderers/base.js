import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS, LIGHT_RADIUS } from '../scene';
import { vec3, vec4, mat4 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, projectionMatrix, scene) {
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
    
    let clusterSizes = vec4.fromValues(2 / this._xSlices, 2 / this._ySlices, 2 / this._zSlices, 1);

    for (let l = 0; l < NUM_LIGHTS; ++l) {
      let lx = scene.lights[l].position[0];
      let ly = scene.lights[l].position[1];
      let lz = scene.lights[l].position[2];
      let lPosCamSpace = vec4.fromValues(0, 0, 0, 1);
      vec4.transformMat4(lPosCamSpace, vec4.fromValues(lx, ly, lz, 1), viewMatrix);
      let min = vec4.fromValues(lPosCamSpace[0] - scene.lights[l].radius, lPosCamSpace[1] - scene.lights[l].radius, lPosCamSpace[2] - scene.lights[l].radius, 1);
      let max = vec4.fromValues(lPosCamSpace[0] + scene.lights[l].radius, lPosCamSpace[1] + scene.lights[l].radius, lPosCamSpace[2] + scene.lights[l].radius, 1);

      vec4.transformMat4(min, min, projectionMatrix);
      min = vec4.fromValues(min[0] / min[3], min[1] / min[3], min[2] / min[3], 1);
      vec4.transformMat4(max, max, projectionMatrix);
      max = vec4.fromValues(max[0] / max[3], max[1] / max[3], max[2] / max[3], 1);
      min = vec4.fromValues(min[0]+1, min[1]+1, min[2]+1);
      max = vec4.fromValues(max[0]+1, max[1]+1, max[2]+1);

      vec4.divide(min, min, clusterSizes);
      vec4.divide(max, max, clusterSizes);
      vec4.floor(min, min);
      vec4.floor(max, max);
      min = vec4.fromValues(Math.max(Math.min(min[0], this._xSlices - 1), 0) - 1, Math.max(Math.min(min[1], this._ySlices - 1), 0) - 1, Math.max(Math.min(min[2], this._zSlices - 1), 0) - 1, 1);
      max = vec4.fromValues(Math.max(Math.min(max[0], this._xSlices - 1), 0) + 2, Math.max(Math.min(max[1], this._ySlices - 1), 0) + 2, Math.max(Math.min(max[2], this._zSlices - 1), 0) + 2, 1);

      for (let z = min[2]; z <= max[2]; ++z) {
        for (let y = min[1]; y <= max[1]; ++y) {
          for (let x = min[0]; x <= max[0]; ++x) {
            let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let count = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] + 1;
            if (count <= MAX_LIGHTS_PER_CLUSTER) {
              let countMod = Math.floor(count % 4);
              let countDiv = Math.floor(count / 4);
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = count;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, countDiv) + countMod] = l;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}