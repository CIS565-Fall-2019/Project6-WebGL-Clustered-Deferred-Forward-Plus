import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene';
import { vec4 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 300;

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

    const screenH = 2.0 * Math.tan(camera.fov / 2.0 * Math.PI / 180);
    const screenW = camera.aspect * screenH;
    const frustumDepth = camera.far - camera.near;

    const stride_x = screenW / this._xSlices;
    const stride_y = screenH / this._ySlices;
    const stride_z = frustumDepth / this._zSlices;

    for(let i = 0; i <NUM_LIGHTS; i++) {
      let lightPos = vec4.fromValues(scene.lights[i].position[0],
                                    scene.lights[i].position[1], 
                                    scene.lights[i].position[2], 1.0);
      vec4.transformMat4(lightPos, lightPos, viewMatrix);
      lightPos[2] *= -1.0;
      let r = scene.lights[i].radius;
      let zmin = Math.floor((lightPos[2] - r - camera.near) / stride_z);
      let zmax = Math.floor((lightPos[2] + r - camera.near) / stride_z);
      zmin = Math.max(zmin, 0);
      zmax = Math.min(zmax, this._zSlices - 1);

      let a = lightPos[0];
      let b = lightPos[2];
      let delta = a * a + b * b - r * r;
      let xmin = 0;
      let xmax = this._xSlices - 1;
      if(delta >= 0) {
        let o = a * b;
        let p = r * Math.sqrt(delta);
        let q = b * b - r * r;
        let tmp1 = (o - p) / q;
        let tmp2 = (o + p) / q;
        let left = Math.min(tmp1, tmp2);
        let right = Math.max(tmp1, tmp2);
        if(a * left + b < 0) {
          xmin = Math.max(0, Math.floor((right + 0.5 * screenW) / stride_x));
          xmax = this._xSlices - 1;
        } else if(a * right + b < 0) {
          xmin = 0;
          xmax = Math.min(this._xSlices - 1, Math.floor((left + 0.5 * screenW) / stride_x));
        } else {
          xmin = Math.max(0, Math.floor((left + 0.5 * screenW) / stride_x));
          xmax = Math.min(this._xSlices - 1, Math.floor((right + 0.5 * screenW) / stride_x));
        }
      }

      a = lightPos[1];
      b = lightPos[2];
      delta = a * a + b * b - r * r;
      let ymin = 0;
      let ymax = this._ySlices - 1;
      if(delta >= 0) {
        let o = a * b;
        let p = r * Math.sqrt(delta);
        let q = b * b - r * r;
        let tmp1 = (o - p) / q;
        let tmp2 = (o + p) / q;
        let left = Math.min(tmp1, tmp2);
        let right = Math.max(tmp1, tmp2);
        if(a * left + b < 0) {
          ymin = Math.max(0, Math.floor((right + 0.5 * screenH) / stride_y));
          ymax = this._ySlices - 1;
        } else if(a * right + b < 0) {
          ymin = 0;
          ymax = Math.min(this._ySlices - 1, Math.floor((left + 0.5 * screenH) / stride_y));
        } else {
          ymin = Math.max(0, Math.floor((left + 0.5 * screenH) / stride_y));
          ymax = Math.min(this._ySlices - 1, Math.floor((right + 0.5 * screenH) / stride_y));
        }
      }

      for (let z = zmin; z <= zmax; ++z) {
        for (let y = ymin; y <= ymax; ++y) {
          for (let x = xmin; x <= xmax; ++x) {
            let index_1D =  x
            + y * this._xSlices
            + z * this._xSlices * this._ySlices;
            let index_light_count = this._clusterTexture.bufferIndex(index_1D, 0);

            // new light count with this light added to this cluster
            let num_lights_in_cluster = 1.0 + this._clusterTexture.buffer[index_light_count];

            // check if updating count based on this light
            if (num_lights_in_cluster <= MAX_LIGHTS_PER_CLUSTER) {
              let tex_pixel = Math.floor(num_lights_in_cluster * 0.25);
              let index_to_fill = this._clusterTexture.bufferIndex(index_1D, tex_pixel);
              let this_index = num_lights_in_cluster - tex_pixel * 4;

              this._clusterTexture.buffer[index_to_fill + this_index] = i;
              this._clusterTexture.buffer[index_light_count] = num_lights_in_cluster;
            }
          }
        }
      }
    }
    this._clusterTexture.update();
  }
}