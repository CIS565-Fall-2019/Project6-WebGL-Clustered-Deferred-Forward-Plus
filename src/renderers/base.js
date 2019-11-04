import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene';
import { mat4, vec4, vec3 } from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 100;

//implement the clamp of value
//http://www.ajaybadgujar.com/clamping-value-using-math-library-javascript/
function clamp(val, min, max){
  return Math.max(min, Math.min(val,max));
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


    //how do we do the clustering? by interacting with the object in the scene?

    // we first need to calculate the frustum's height and width based on the camera's field of view and aspect ratio
    // determine the stride of z based on the camera's far clip plane and near clip plane and number of slices

    let frustum_height = 2.0 * Math.tan(camera.fov / 2.0 * Math.PI / 180);
    let frustum_width = frustum_height * camera.aspect;
    let frustum_depth = camera.far - camera.near;

    // determine the stride of x and y based on frustum's height and width and the number of slices
    let stride_x = frustum_width / this._xSlices;
    let stride_y = frustum_height / this._ySlices;
    let stride_z = frustum_depth / this._zSlices;

    // compute the starting point of our camear frustum grid
    // for each light, we need to get its position in world position from scene
    for(let curr_light = 0; curr_light < NUM_LIGHTS; ++curr_light)
    {
      //get world position from the scene
      let curr_light_pos = vec4.fromValues(scene.lights[curr_light].position[0],
                                          scene.lights[curr_light].position[1],
                                          scene.lights[curr_light].position[2],
                                          1);
      // transfer the position to view space -- why? -- because we consider the frustum in view space and get radius of effect
      vec4.transformMat4(curr_light_pos,curr_light_pos,viewMatrix);
      // reverse the z value
      curr_light_pos[2] = -curr_light_pos[2];
      let light_radius = scene.lights[curr_light].radius;

      //we frist find the boundary of z coordinate
      let z_min = Math.floor((curr_light_pos[2] - light_radius - camera.near)/stride_z);
      let z_max = Math.floor((curr_light_pos[2] + light_radius - camera.near)/stride_z);
      // then we need to clamp the index within the range of 0 to xyz_sliced, which is how many pieces we divided into
      z_min = clamp(z_min,0,this._zSlices - 1);
      z_max = clamp(z_max,0,this._zSlices - 1);
      //this part is helped significantly by Jiangping Xu
      //we uses the math formula to compute the tangent line of the sphere and then compute the indices of x and y based on that
      //compute the x_min and x_max
      let a = curr_light_pos[0];
      let b = curr_light_pos[2];
      let delta = a * a + b * b - light_radius * light_radius;
      //reset x_min and x_max from previous use
      let x_min = 0;
      let x_max = this._xSlices - 1;
      if(delta >= 0) {
        let o = a * b;
        let p = light_radius * Math.sqrt(delta);
        let q = b * b - light_radius * light_radius;
        let tmp1 = (o - p) / q;
        let tmp2 = (o + p) / q;
        let left = Math.min(tmp1, tmp2);
        let right = Math.max(tmp1, tmp2);
        if(a * left + b < 0) {
          x_min = Math.floor((right + 0.5 * frustum_width) / stride_x);
          x_max = this._xSlices - 1;
        } else if(a * right + b < 0) {
          x_min = 0;
          x_max = Math.floor((left + 0.5 * frustum_width) / stride_x);
        } else {
          x_min = Math.floor((left + 0.5 * frustum_width) / stride_x);
          x_max = Math.floor((right + 0.5 * frustum_width) / stride_x);
        }
      }
      //compute the y_min and y_max
      a = curr_light_pos[1];
      b = curr_light_pos[2];
      delta = a * a + b * b - light_radius * light_radius;
      //reset x_min and x_max from previous use
      let y_min = 0;
      let y_max = this._ySlices - 1;
      if(delta >= 0) {
        let o = a * b;
        let p = light_radius * Math.sqrt(delta);
        let q = b * b - light_radius * light_radius;
        let tmp1 = (o - p) / q;
        let tmp2 = (o + p) / q;
        let bot = Math.min(tmp1, tmp2);
        let top = Math.max(tmp1, tmp2);
        if(a * bot + b < 0) {
          y_min = Math.floor((top + 0.5 * frustum_height) / stride_y);
          y_max = this._ySlices - 1;
        } else if(a * top + b < 0) {
          y_min = 0;
          y_max = Math.floor((bot + 0.5 * frustum_height) / stride_y);
        } else {
          y_min = Math.floor((bot + 0.5 * frustum_height) / stride_y);
          y_max = Math.floor((top + 0.5 * frustum_height) / stride_y);
        }
      }
      //clamp them within the range
      x_min = clamp(x_min,0,this._xSlices - 1);
      x_max = clamp(x_max,0,this._xSlices - 1);

      y_min = clamp(y_min,0,this._ySlices - 1);
      y_max = clamp(y_max,0,this._ySlices - 1);
      // traverse each clusterTexture slot the light affect to populate the count of light and their indices
      for (let z = z_min; z <= z_max; ++z) {
        for (let y = y_min; y <= y_max; ++y) {
          for (let x = x_min; x <= x_max; ++x) {
            let idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            // here, remember to compute the row and offset, each row contains 4 elements, why? 
            // -- because in the buffertexture, it is four indices in a row
            let light_count = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)];
            
            if(light_count < MAX_LIGHTS_PER_CLUSTER)
            {
                //we have one more light to count in
                light_count += 1;

                //update the light_count
                this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)] = light_count;

                //store the indices into the list
                //first get the row number inside the texture buffer
                let pixel_index = Math.floor(light_count / 4);
                let index_within_pixel = light_count % 4;

                this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, pixel_index) + index_within_pixel] = curr_light; //light index here
            }
          }
        }
      }

    }

    this._clusterTexture.update();
  }
}