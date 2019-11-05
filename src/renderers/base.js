import TextureBuffer from './textureBuffer';
import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';

export const MAX_LIGHTS_PER_CLUSTER = 100;

function degreeToRadian(degree){
  let pi = Math.PI;
  return (degree * (pi/180.0));
}

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
    //console.log("Here!!");

    var frustum_height = 2.0 * Math.tan(degreeToRadian(camera.fov / 2.0));
    var frustum_width = camera.aspect * frustum_height;
    var frustum_depth = camera.far - camera.near;

    // Calculate width and height of near and far planes of the frustum
    var near_width = frustum_width * camera.near;
    var near_height = frustum_height * camera.near;
    var far_width = frustum_width * camera.far;
    var far_height = frustum_height * camera.far;

    var tile_x = frustum_width / this._xSlices;
    var tile_y = frustum_height / this._ySlices;
    var tile_z = frustum_depth / this._zSlices;


    for (let current_light = 0; current_light < NUM_LIGHTS; ++current_light){
      var light = scene.lights[current_light];
      var light_radius = light.radius;
      var light_position = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1);
      vec4.transformMat4(light_position, light_position, viewMatrix);
      light_position[2] *= -1.0;

      var alpha = ( (Math.abs(light_position[2]) - 1.0 * camera.near)/(1.0 * camera.far - 1.0 * camera.near) );
      var light_slice_width = near_width * (1 - alpha) + far_width * alpha;
      var light_slice_height = near_height * (1 - alpha) + far_height * alpha;

      var x_min = Math.floor((light_position[0] - light_radius + 0.5 * light_slice_width) / (light_slice_width / this._xSlices));  
      var x_max = Math.floor((light_position[0] + light_radius + 0.5 * light_slice_width) / (light_slice_width / this._xSlices));
      var y_min = Math.floor((light_position[1] - light_radius + 0.5 * light_slice_height) / (light_slice_height / this._ySlices));
      var y_max = Math.floor((light_position[1] + light_radius + 0.5 * light_slice_height) / (light_slice_height / this._ySlices));
      var z_min = Math.floor((Math.abs(light_position[2]) - light_radius - camera.near) / tile_z);
      var z_max = Math.floor((Math.abs(light_position[2]) + light_radius - camera.near) / tile_z);

      //Make sure all above values are between 0 and respective max
      x_min = Math.min(x_min, this._xSlices - 1);
      x_min = Math.max(0, x_min);
      x_max = Math.min(x_max, this._xSlices - 1);
      x_max = Math.max(0, x_max);

      y_min = Math.min(y_min, this._ySlices - 1);
      y_min = Math.max(0, y_min);
      y_max = Math.min(y_max, this._ySlices - 1);
      y_max = Math.max(0, y_max);

      z_min = Math.min(z_min, this._zSlices - 1);
      z_min = Math.max(0, z_min);
      z_max = Math.min(z_max, this._zSlices - 1);
      z_max = Math.max(0, z_max);
    
    //console.log("Scene lights: ", scene.lights.length, " NUM_LIGHTS: ", NUM_LIGHTS);
    //console.log("x_min: ", x_min, " x_max: ", x_max);

      // Loop through all points between the calculated min and max indices in all dimensions for current_light
      for(let z = z_min; z <= z_max; ++z){
        for(let y = y_min; y <= y_max; ++y){
          for(let x = x_min; x <= x_max; ++x){
            let index = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            var lightIndex = this._clusterTexture.bufferIndex(index, 0);
            if(this._clusterTexture.buffer[lightIndex] < MAX_LIGHTS_PER_CLUSTER){
              var numberOfLights = this._clusterTexture.buffer[lightIndex] + 1;
              var row = Math.floor(numberOfLights % 4);
              var col = Math.floor(numberOfLights / 4);
              this._clusterTexture.buffer[lightIndex] = numberOfLights;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index, col) + row] = current_light;
            }
          }
        }
      }
    }
    

    this._clusterTexture.update();
  }
}