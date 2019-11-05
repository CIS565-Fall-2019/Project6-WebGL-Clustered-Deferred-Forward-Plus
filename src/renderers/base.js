import TextureBuffer from './textureBuffer';
import { vec4 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';

export const MAX_LIGHTS_PER_CLUSTER = 200;

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

    const screenH = 2.0 * Math.tan(camera.fov * (Math.PI / 180.0 / 2.0));
    const screenW = camera.aspect * screenH;
    const xStride = screenW / this._xSlices;
    const yStride = screenH / this._ySlices;
    const zStride = (camera.far - camera.near) / this._zSlices;


    for (let i = 0; i < NUM_LIGHTS; i++) {
      let radius = scene.lights[i].radius;
      let lightPosition = vec4.fromValues(scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1.0);
      vec4.transformMat4(lightPosition, lightPosition, viewMatrix);
      lightPosition[2] *= -1.0;

      let zMin = Math.max(Math.floor((lightPosition[2] - radius - camera.near) / zStride), 0);
      let zMax = Math.min(Math.floor((lightPosition[2] + radius - camera.near) / zStride), this._zSlices - 1);

      let xMin = 0;
      let xMax = this._xSlices - 1;
      let x = lightPosition[0];
      let z = lightPosition[2];
      let diff = Math.pow(x, 2) + Math.pow(z, 2) - Math.pow(radius, 2);
      if (diff >= 0) {
        let t1 = (x * z - radius * Math.sqrt(diff)) / (Math.pow(z, 2) - Math.pow(radius, 2));
        let t2 = (x * z + radius * Math.sqrt(diff)) / (Math.pow(z, 2) - Math.pow(radius, 2));
        let a = Math.min(t1, t2);
        let b = Math.max(t1, t2);
        if (x * a + z < 0) {
          xMin = Math.max(Math.floor((b + screenW/2) / xStride), 0);
        }
        else if (x * b + z < 0) {
          xMax = Math.min(Math.floor((a + screenW/2) / xStride), this._xSlices - 1);
        }
        else {
          xMin = Math.max(Math.floor((a + screenW/2) / xStride), 0);
          xMax = Math.min(Math.floor((b + screenW/2) / xStride), this._xSlices - 1);
        }
      }


      let yMin = 0;
      let yMax = this._ySlices - 1;
      let y = lightPosition[1];
      z = lightPosition[2];
      diff = Math.pow(y, 2) + Math.pow(z, 2) - Math.pow(radius, 2);
      if (diff >= 0) {
        let t1 = (y * z - radius * Math.sqrt(diff)) / (Math.pow(z, 2) - Math.pow(radius, 2));
        let t2 = (y * z + radius * Math.sqrt(diff)) / (Math.pow(z, 2) - Math.pow(radius, 2));
        let a = Math.min(t1, t2);
        let b = Math.max(t1, t2);
        if (y * a + z < 0) {
          yMin = Math.max(Math.floor((b + screenH/2) / yStride), 0);
        }
        else if (y * b + z < 0) {
          yMax = Math.min(Math.floor((a + screenH/2) / yStride), this._ySlices - 1);
        }
        else {
          yMin = Math.max(Math.floor((a + screenH/2) / yStride), 0);
          yMax = Math.min(Math.floor((b + screenH/2) / yStride), this._ySlices - 1);
        }
      }

      for (let k = zMin; k <= zMax; k++) {
        for (let j = yMin; j <= yMax; j++) {
          for (let h = xMin; h <= xMax; h++) {
            let idx = h + j * this._xSlices + k * this._xSlices * this._ySlices;
            let idx_count = this._clusterTexture.bufferIndex(idx, 0);

            let num_lights = this._clusterTexture.buffer[idx_count];
            if (num_lights < MAX_LIGHTS_PER_CLUSTER) {
              num_lights++;
              let pixel = Math.floor(num_lights / 4.0);
              let temp1 = this._clusterTexture.bufferIndex(idx, pixel);;
              let temp2 = num_lights - 4 * pixel;

              this._clusterTexture.buffer[idx_count] = num_lights;
              this._clusterTexture.buffer[temp1 + temp2] = i;
                    
            }
          }
        }
      }
    }


    this._clusterTexture.update();
  }
}