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

    var xStride = screenH / this._xSlices;
    var yStride = screenW / this._ySlices;
    var zStride = screenD / this._zSlices;

    for (let L_i=0;L_i<MAX_LIGHTS_PER_CLUSTER;L_i++){

      var pos = scene.lights[L_i].position;
      var lightPos = vec4.fromValues(pos[0],pos[1],pos[2],1.0);
      radius = scene.lights[L_i].radius;

      vec4.transformMat4(lightPos, lightPos, viewMatrix);
      lightPos[2] *= -1.0;

      var z_min = (lightPos[2] - radius) / zStride;
      var z_max = (lightPos[2] + radius) / zStride;

      z_min = Math.min(Math.max(Math.floor(z_min), 0), this._zSlices-1);
      z_max = Math.min(Math.max(Math.floor(z_max), 0), this._zSlices-1);

      xStride *= lightPos[2];

      var x_min = ((lightPos[2]*(screenW/2.0)) + lightPos[0] - radius)/xStride;
      var x_max = ((lightPos[2]*(screenW/2.0)) + lightPos[0] + radius)/xStride;
      x_min = Math.min(Math.max(Math.floor(x_min)-1, 0), this._xSlices-1);
      x_max = Math.min(Math.max(Math.floor(x_max)+1, 0), this._xSlices-1);


      YStride *= lightPos[2];

      var y_min = ((lightPos[2]*(screenH/2.0)) + lightPos[1] - radius)/yStride;
      var y_max = ((lightPos[2]*(screenH/2.0)) + lightPos[1] + radius)/yStride;
      y_min = Math.min(Math.max(Math.floor(y_min)-1, 0), this._ySlices-1);
      y_max = Math.min(Math.max(Math.floor(y_max)+1, 0), this._ySlices-1);

      for (let i2 = x_min;x_min<=x_max;i2++){
        for(let j = y_min;y_min<=y_max;j2++){
          for(let k = z_min;z_min<=z_max;k2++){

            let index = (k * this._xSlices * this._ySlices) + (j * this._xSlices) + i2;
            let numLightIdx = this._clusterTexture.bufferIndex(index, 0);
            let numLight = this._clusterTexture.buffer[numLightIdx] + 1.0;

            if (numLight <= MAX_LIGHTS_PER_CLUSTER){

              this._clusterTexture.buffer[numLightIdx] = numLight;

              let numLightIdx2 = this._clusterTexture.bufferIndex(index, Math.floor(numLight/4.0));
              
              this._clusterTexture.buffer[numLightIdx2 + (numLight%4)] = i;
              

            }
          }
        }
      }

    }

    this._clusterTexture.update();
  }
}