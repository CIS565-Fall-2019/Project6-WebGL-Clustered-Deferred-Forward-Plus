import { mat4, vec4, vec3, vec2 } from 'gl-matrix';
import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene';

export const MAX_LIGHTS_PER_CLUSTER = 300;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  clamp(value, lower, upper) {
    return Math.max(lower, Math.min(value, upper));
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

    let light_radius, light_pos;
    let bound_mins, bound_max;
    let v_height, v_width;

    const tan2 = 2 * Math.tan(camera.fov * Math.PI / 360.0);

    const stride_z = (camera.far - camera.near) / this._zSlices;
    let stride_x, stride_y; // Note: x and y stride depend on the light's depth

    let xMin, xMax;
    let yMin, yMax;
    let zMin, zMax;
    let cluster_idx;
    let light_count, light_count_index;
    let pixel, pixelComponent;

    for (let i = 0; i < NUM_LIGHTS; i++) {
      light_radius = scene.lights[i].radius;

      // get light pos in view space
      light_pos = vec4.fromValues(scene.lights[i].position[0], scene.lights[i].position[1], scene.lights[i].position[2], 1.0);
      vec4.transformMat4(light_pos, light_pos, viewMatrix);
      // adjust for the coordinate system
      light_pos[2] *= -1.0;;

      // get sphere bound
      bound_mins = vec3.fromValues(light_pos[0] - light_radius, light_pos[1] - light_radius, light_pos[2] - light_radius);
      bound_max = vec3.fromValues(light_pos[0] + light_radius, light_pos[1] + light_radius, light_pos[2] + light_radius);

      // get the frustrum width and height at the light's depth
      v_height = Math.abs(tan2 * light_pos[2] * 2);
      v_width = camera.aspect * v_height;

      // bin the frustrum into slices 
      stride_x = v_width / this._xSlices;
      stride_y = v_height / this._ySlices;

      xMin = Math.floor((bound_mins[0] + v_width * 0.5) / stride_x) - 1;
      xMax = Math.floor((bound_max[0] + v_width * 0.5) / stride_x) + 1;
      xMin = this.clamp(xMin, 0, this._xSlices - 1);
      xMax = this.clamp(xMax, 0, this._xSlices - 1);

      yMin = Math.floor((bound_mins[1] + v_height * 0.5) / stride_y) - 1;
      yMax = Math.floor((bound_max[1] + v_height * 0.5) / stride_y) + 1;
      yMin = this.clamp(yMin, 0, this._ySlices - 1);
      yMax = this.clamp(yMax, 0, this._ySlices - 1);

      zMin = Math.floor(bound_mins[2] / stride_z);
      zMax = Math.floor(bound_max[2] / stride_z);
      zMin = this.clamp(zMin, 0, this._zSlices - 1) - 1;
      zMax = this.clamp(zMax, 0, this._zSlices - 1) + 1;

      // update the cluster with influncing lights idx and count
      for (let z = zMin; z <= zMax; z++) {
        for (let y = yMin; y <= yMax; y++) {
          for (let x = xMin; x <= xMax; x++) {
            cluster_idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            light_count_index = this._clusterTexture.bufferIndex(cluster_idx, 0)
            light_count = this._clusterTexture.buffer[light_count_index];
            light_count++;
            if (light_count <= MAX_LIGHTS_PER_CLUSTER) { // Note: Using "continue" hurt the performance significantly!!
              pixel = Math.floor(light_count * 0.25);
              pixelComponent = light_count % 4;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(cluster_idx, pixel) + pixelComponent] = i;
              this._clusterTexture.buffer[light_count_index] = light_count;
            }
          } // x loop
        }  // y loop
      } // z loop
    }
    this._clusterTexture.update();
  }
}