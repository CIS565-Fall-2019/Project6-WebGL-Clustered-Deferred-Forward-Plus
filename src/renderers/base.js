import TextureBuffer from './textureBuffer';
import {mat4, vec4} from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
    this._maxLightsPerCluster = MAX_LIGHTS_PER_CLUSTER;
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

    // Calculate screen width and height
    var screenH = Math.tan(camera.fov * (Math.PI / 180.0) / 2.0) * 2.0;
    var screenW = camera.aspect * screenH;

    // Iterate through lights, add each to the clusters it affects
    for (var i = 0; i < scene.lights.length; i++)
    {
      var radius = scene.lights[i].radius;
      var pos = scene.lights[i].position;
      var lpos = vec4.fromValues(pos[0], pos[1], pos[2], 1.0);

      // Transform light position into screen space
      vec4.transformMat4(lpos, lpos, viewMatrix);
      lpos[2] *= -1.0;

      // Get slice strides in each dim
      var xSliceLoc = screenW * lpos[2];
      var ySliceLoc = screenH * lpos[2];
      var zSliceLoc = camera.far - camera.near;
      var xStride = xSliceLoc / this._xSlices;
      var yStride = ySliceLoc / this._ySlices;
      var zStride = zSliceLoc / this._zSlices;

      // Find start and end slices this light has impact on
      var xIn = Math.floor((lpos[0] - radius + (screenW / 2.0 * lpos[2])) / xStride) - 1;
      var yIn = Math.floor((lpos[1] - radius + (screenH / 2.0 * lpos[2])) / yStride);
      var zIn = Math.floor((lpos[2] - radius) / zStride);
      var xOut = Math.floor((lpos[0] + radius + (screenW / 2.0 * lpos[2])) / xStride) + 1;
      var yOut = Math.floor((lpos[1] + radius + (screenH / 2.0 * lpos[2])) / yStride);
      var zOut = Math.floor((lpos[2] + radius) / zStride);

      // Clamp these computed slice bounds
      xIn = Math.min(Math.max(xIn, 0), this._xSlices-1);
      yIn = Math.min(Math.max(yIn, 0), this._ySlices-1);
      zIn = Math.min(Math.max(zIn, 0), this._zSlices-1);
      xOut = Math.min(Math.max(xOut, 0), this._xSlices-1);
      yOut = Math.min(Math.max(yOut, 0), this._ySlices-1);
      zOut = Math.min(Math.max(zOut, 0), this._zSlices-1);

      for (let z = zIn; z <= zOut; ++z) {
        for (let y = yIn; y <= yOut; ++y) {
          for (let x = xIn; x <= xOut; ++x) {
            let idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            var bufIdx = this._clusterTexture.bufferIndex(idx, 0);
            
            var lightNum = this._clusterTexture.buffer[bufIdx] + 1;
            if (lightNum < MAX_LIGHTS_PER_CLUSTER)
            {
              // Update light count
              this._clusterTexture.buffer[bufIdx] = lightNum;
              // Update index of light
              var lightMapIdx = this._clusterTexture.bufferIndex(idx, Math.floor(lightNum/4)) + Math.floor(lightNum%4);
              this._clusterTexture.buffer[lightMapIdx] = i;
            }
          }
        }
      }      
    }

    this._clusterTexture.update();
  }
}