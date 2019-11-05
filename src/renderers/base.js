import TextureBuffer from './textureBuffer';
import {NUM_LIGHTS} from "../scene";
import { vec3, vec4 } from "gl-matrix"

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
    // Iterate over all lights
    // 1. Find each light's frustum
    // 2. Update the relevant slices
    for (let light_idx = 0; light_idx < NUM_LIGHTS; light_idx++) {
      // Find bounds of frustrum
      let frustum_bounds = this.findFrustumBounds(light_idx, viewMatrix, camera, scene);

      // Update the relevant (based on the bounds calculate above) with this light
      for (let z = frustum_bounds.zMin; z <= frustum_bounds.zMax; z++) {
        for (let y = frustum_bounds.yMin; y <= frustum_bounds.yMax; y++) {
            for (let x = frustum_bounds.xMin; x <= frustum_bounds.xMax; x++) {
                let slice_idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
                let light_count_address = this._clusterTexture.bufferIndex(slice_idx, 0)
                let light_count = this._clusterTexture.buffer[light_count_address];
                light_count = light_count + 1; 
                // Check whether we have reached the limit of maximum lights that can affect a cluster/tile
                if (light_count <= MAX_LIGHTS_PER_CLUSTER) {
                    let pixel_idx = Math.floor(light_count / 4.0);
                    let offset = light_count % 4;
                    this._clusterTexture.buffer[this._clusterTexture.bufferIndex(slice_idx, pixel_idx) + offset] = light_idx;
                    this._clusterTexture.buffer[light_count_address] = light_count;
                }
            }
        } 
      }
    }
    this._clusterTexture.update();
  }

  findFrustumBounds(light_idx, viewMatrix, camera, scene){
    let frustum_bounds = { 'xMin': 0, 'xMax': 0, 'yMin': 0, 'yMax': 0, 'zMin': 0, 'zMax': 0 };   

    // Frustum and slice dimensions 
    let frustum_height = 2.0 * Math.tan((camera.fov / 2) * (Math.PI / 180.0));
    var frustum_dim = vec3.fromValues(camera.aspect * frustum_height, frustum_height, camera.far - camera.near);
    var slice_dim = vec3.fromValues(frustum_dim[0] / this._xSlices, frustum_dim[1] / this._ySlices, frustum_dim[2] / this._zSlices);

    // Light position and radius
    let light_pos_arr = scene.lights[light_idx].position;
    let light_pos_v4 = vec4.fromValues(light_pos_arr[0], light_pos_arr[1], light_pos_arr[2], 1);
    vec4.transformMat4(light_pos_v4, light_pos_v4, viewMatrix);
    let light_pos = vec3.fromValues(light_pos_v4[0], light_pos_v4[1], light_pos_v4[2]);
    let light_radius = scene.lights[light_idx].radius;

    // Function to clamp value between 0 and maximum number of slices
    var clamp = function (x, left, right) {
      return Math.max(left, Math.min(x, right));
    };

    // Bounds in X Dimension
    frustum_bounds.xMin = Math.floor((light_pos[0] - light_radius + 0.5 * frustum_dim[0]) / slice_dim[0] );
    frustum_bounds.xMin = clamp(frustum_bounds.xMin, 0, this._xSlices - 1);
    frustum_bounds.xMax = Math.floor((light_pos[0] + light_radius + 0.5 * frustum_dim[0]) / slice_dim[0] );
    frustum_bounds.xMax = clamp(frustum_bounds.xMax, 0, this._xSlices - 1);

    // Bounds in Y Dimension
    frustum_bounds.yMin = Math.floor((light_pos[1] - light_radius + 0.5 * frustum_dim[1]) / slice_dim[1] );
    frustum_bounds.yMin = clamp(frustum_bounds.yMin, 0, this._ySlices - 1);
    frustum_bounds.yMax = Math.floor((light_pos[1] + light_radius + 0.5 * frustum_dim[1]) / slice_dim[1] );
    frustum_bounds.yMax = clamp(frustum_bounds.yMax, 0, this._ySlices - 1);

    // Bounds in Z Dimension
    frustum_bounds.zMin = Math.floor((light_pos[2] - light_radius - camera.near) / slice_dim[2]);
    frustum_bounds.zMin = clamp(frustum_bounds.zMin, 0, this._zSlices - 1);
    frustum_bounds.zMax = Math.floor((light_pos[2] + light_radius - camera.near) / slice_dim[2]);
    frustum_bounds.zMax = clamp(frustum_bounds.zMax, 0, this._zSlices - 1);
    return frustum_bounds;
  }
}

