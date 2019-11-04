import TextureBuffer from './textureBuffer';
import {vec3, vec4, mat4} from 'gl-matrix';
import {NUM_LIGHTS} from '../scene'

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

    // Components of projection matrix
    let radians = Math.PI / 180.0;
    let S = 1.0 / Math.tan(radians * camera.fov / 2.0);
    let A = camera.aspect;
    let SA = S / A;
    // Had P and Q as well, but it got wonky so I just used the dist / maxDist proportion
    let maxDist = camera.far - camera.near;

    for (let i = 0; i < NUM_LIGHTS; ++i) {
      var r = scene.lights[i].radius;

      // Getting light origin in camera space
      var camPos = vec4.fromValues(scene.lights[i].position[0], 
                                   scene.lights[i].position[1], 
                                   scene.lights[i].position[2], 
                                   1.0);
      vec4.transformMat4(camPos, camPos, viewMatrix);
      camPos[2] *= -1.0;

      // HELPER FUNC to get minimum and maximum cardinal bounds on light via radius // Maybe outside loop
      /// UNIFORM NDC!!!!!! - This function doesn't work, the next function is what's used
      var minMaxTrans = function(displacement, xSl, ySl, zSl) {
        // Transform into screen space
        var newPos = vec4.create();
        vec4.add(newPos, camPos, displacement);
        vec4.transformMat4(newPos, newPos, camera.projectionMatrix.elements);
        var pos3 = vec3.fromValues(newPos.x, newPos.y, newPos.z);
        pos3 /= newPos.w;

        // Tried to clamp to [-1, 1) here but those vector functions crashed

        // Scale from [0, 1]
        pos3 += 1.0;
        pos3 *= 0.5;

        // [0, slice#]
        vec3.multiply(pos3, pos3, vec3.fromValues(xSl, ySl, zSl));

        return pos3;
      }

      // NEW HELPER FUNC BC PROJECTION MATRIX DOESNT LIKE ME shoulda just passed it in with viewMat :/
      var nonProjMat = function(displacement, xSl, ySl, zSl) {
        // Displace the vector by the given vector (radius)
        var newPos = vec4.create();
        vec4.add(newPos, camPos, displacement);

        let wDiv = newPos[2]; // Value for perdpective divide

        // Mimicking projection matrix multiplication, perspective divide, and scaling the resulting values to [0, slice#]
        var pos3 = vec3.fromValues(Math.floor((SA * newPos[0] / wDiv + 1.0) / 2.0 * xSl),       
                                   Math.floor((S  * newPos[1] / wDiv + 1.0) / 2.0 * ySl),       
                                   Math.floor((newPos[2] / maxDist) * zSl)); 

        return pos3;
      }

      // Get minimum cardinal bounds on light via radius
      var lowPos = nonProjMat(vec4.fromValues(-r, -r, -r, 0.0), this._xSlices, this._ySlices, this._zSlices);
      
      // Get maximum cardinal bounds on light via radius
      var topPos = nonProjMat(vec4.fromValues(r, r, r, 0.0), this._xSlices, this._ySlices, this._zSlices);
      
      // Clamp values from [0, slice#]
      let zLow = Math.max(lowPos[2], 0.0);
      let yLow = Math.max(lowPos[1] - 1, 0.0);   // Offsets to help with bug
      let xLow = Math.max(lowPos[0] - 2, 0.0);

      let zHigh = Math.min(topPos[2], this._zSlices);
      let yHigh = Math.min(topPos[1] + 1, this._ySlices);
      let xHigh = Math.min(topPos[0] + 2, this._xSlices);

      // Can check for a "sphere" of clusters overlapping the light sphere, but notes say:
      // "The traditional approach of checking the six frustum planes has false intersections at the frustum corners.  
      //  These are usually not a problem, but they come up often when the frustum is small and the sphere is large."
      // So I'll roll with the AABB, but may optimize later!
      for (let z = zLow; z <= zHigh; ++z) {
        for (let y = yLow; y <= yHigh; ++y) {
          for (let x = xLow; x <= xHigh; ++x) {
            let idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let clustIdx = this._clusterTexture.bufferIndex(idx, 0);
            let numL = this._clusterTexture.buffer[clustIdx];

            // Check the light count at this cluster
            if (numL < MAX_LIGHTS_PER_CLUSTER) {
              let disp1 = Math.floor((numL + 1) / 4);
              let disp2 = Math.floor((numL + 1) % 4);

              this._clusterTexture.buffer[clustIdx] = numL + 1;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, disp1) + disp2] = i;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}