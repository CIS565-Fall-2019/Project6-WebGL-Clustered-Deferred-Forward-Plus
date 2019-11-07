import TextureBuffer from './textureBuffer';
import {mat4, vec4} from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
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

    var screenH = Math.tan((camera.fov/2.0) * (Math.PI / 180.0)) * 2.0;
    var screenW = camera.aspect * screenH;
    var screenD = camera.far - camera.near;

    //var xStride = screenH / this._xSlices;
    //var yStride = screenW / this._ySlices;
    var zStride = screenD / this._zSlices;

    //////////
    for (let L_i=0;L_i<NUM_LIGHTS;++L_i){

      var pos = scene.lights[L_i].position;
      var lightPos = vec4.fromValues(pos[0],pos[1],pos[2],1);
      var radius = scene.lights[L_i].radius;

      vec4.transformMat4(lightPos, lightPos, viewMatrix);
      lightPos[2] *= -1.0;

      var z_min = (Math.abs(lightPos[2])-camera.near - radius) / zStride;
      var z_max = (Math.abs(lightPos[2])-camera.near + radius) / zStride;

      z_min = Math.max(Math.min(Math.floor(z_min), this._zSlices-1), 0);
      z_max = Math.max(Math.min(Math.floor(z_max), this._zSlices-1), 0);
      
      //xStride = screenH / this._xSlices;
      //xStride *= lightPos[2];

      var a = ((Math.abs(lightPos[2]) - 1.0 * camera.near)/(1.0 * camera.far - 1.0 * camera.near));
      var lightSliceW = (camera.near * screenW) * (1 - a) + (camera.far * screenW) * a;

      var x_min = ((0.5 * lightSliceW) + lightPos[0] - radius) * (this._xSlices/lightSliceW);
      var x_max = ((0.5 * lightSliceW) + lightPos[0] + radius) * (this._xSlices/lightSliceW);
      
      x_min = Math.max(Math.min(Math.floor(x_min), this._xSlices-1), 0);
      x_max = Math.max(Math.min(Math.floor(x_max), this._xSlices-1), 0);

      var lightSliceH = (camera.near * screenH) * (1 - a) + (camera.far * screenH) * a;

      var y_min = ((0.5 * lightSliceH) + lightPos[1] - radius) * (this._ySlices/lightSliceH);
      var y_max = ((0.5 * lightSliceH) + lightPos[1] + radius) * (this._ySlices/lightSliceH);

      y_min = Math.max(Math.min(Math.floor(y_min), this._ySlices-1), 0);
      y_max = Math.max(Math.min(Math.floor(y_max), this._ySlices-1), 0);

      for (let k = z_min;k<=z_max;k++){
        for(let j = y_min;j<=y_max;j++){
          for(let i = x_min;i<=x_max;i++){

            let index = (k * this._xSlices * this._ySlices) + (j * this._xSlices) + i;
            var numLightIdx = this._clusterTexture.bufferIndex(index, 0);
            /////////
            var numLight = this._clusterTexture.buffer[numLightIdx] + 1;
            /////////
            if (numLight-1 < MAX_LIGHTS_PER_CLUSTER){

              this._clusterTexture.buffer[numLightIdx] = numLight;

              var numLightIdx2 = this._clusterTexture.bufferIndex(index, Math.floor(numLight/4.0));
              //////
              this._clusterTexture.buffer[numLightIdx2 + Math.floor((numLight%4))] = L_i;
              

            }
          }
        }
      }

    }

    this._clusterTexture.update();
  }
}