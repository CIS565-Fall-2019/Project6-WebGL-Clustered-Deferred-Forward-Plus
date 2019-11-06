import TextureBuffer from './textureBuffer';
import { mat4, vec3, vec4 } from "gl-matrix"

export const MAX_LIGHTS_PER_CLUSTER = 1000;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;

    //Store the scence's min/max Width/Height 
    //with respect to the field of view of the camera
    this.viewNearW = 0.0;
    this.viewNearH = 0.0;
    this.viewFarW = 0.0;
    this.viewFarH = 0.0;

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

    // Compute the render screen width and height from fov and aspectRatio
    let screenHhalf = Math.tan(0.5* camera.fov *(Math.PI / 180.0));
    let screenWhalf = screenHhalf * camera.aspect;

    this.viewNearH = camera.near * screenHhalf  * 2.0;
    this.viewNearW = this.viewNearH  * camera.aspect;

    this.viewFarH = camera.far * screenHhalf  * 2.0;
    this.viewFarW = this.viewFarH  * camera.aspect;

    // console.log(camera.aspect, this.viewNearH, this.viewNearW);

    // For Each light location 
    // Spheres 
    for(let lightID = 0; lightID < scene.lights.length; lightID++) {

      // Compute ranges in the 3d space formed by the x,y,z slices 
      // Where the light is
      let x1 = 0.0;
      let y1 = 0.0;
      let z1 = 0.0;
      let x2 = 0.0;
      let y2 = 0.0;
      let z2 = 0.0;
      
      // Get light poition and radius
      let lightPosVec4 = vec4.fromValues(scene.lights[lightID].position[0], scene.lights[lightID].position[1], scene.lights[lightID].position[2], 1);
      
      // tranform to camera corrdinates
      vec4.transformMat4(lightPosVec4, lightPosVec4, viewMatrix);
      
      // compute light position
      let lightPos = vec3.fromValues(lightPosVec4[0], lightPosVec4[1], lightPosVec4[2]);
      
      // get light radius
      let lightRadius = scene.lights[lightID].radius;
      let depthFactor = ((Math.abs(lightPos[2]) - 1.0 * camera.near)/(1.0 * camera.far - 1.0 * camera.near));
  
      // Get the height/width range of the slice of the scene space with respt to the depth
      // since the frustum stips get wider as the depth increases with respect to the camera
      let xyplaneWidth = this.viewNearW + (this.viewFarW - this.viewNearW) * depthFactor;
      let xyplaneHeight = this.viewNearH + (this.viewFarH - this.viewNearH) * depthFactor;

      x1 = Math.floor((lightPos[0] - lightRadius + 0.5 * xyplaneWidth) / (xyplaneWidth / this._xSlices));
      x2 = Math.floor((lightPos[0] + lightRadius + 0.5 * xyplaneWidth) / (xyplaneWidth / this._xSlices));
  
      y1 = Math.floor((lightPos[1] - lightRadius + 0.5 * xyplaneHeight) / (xyplaneHeight / this._ySlices));
      y2 = Math.floor((lightPos[1] + lightRadius + 0.5 * xyplaneHeight) / (xyplaneHeight / this._ySlices));
  
      z1 = Math.floor((Math.abs(lightPos[2]) - lightRadius - camera.near) / ((camera.far - camera.near) / this._zSlices));
      z2 = Math.floor((Math.abs(lightPos[2]) + lightRadius - camera.near) / ((camera.far - camera.near) / this._zSlices));
  
      x1 = Math.max(0, Math.min(this._xSlices - 1, x1));
      x2 = Math.max(0, Math.min(this._xSlices - 1, x2));

      y1 = Math.max(0, Math.min(this._ySlices - 1, y1));
      y2 = Math.max(0, Math.min(this._ySlices - 1, y2));

      z1 = Math.max(0, Math.min(this._zSlices - 1, z1));
      z2 = Math.max(0, Math.min(this._zSlices - 1, z2));
      
      for(let x = x1; x <= x2; x++) {
        for(let y = y1; y <= y2; y++) {
          for(let z = z1; z <= z2; z++) {

            // linearise cluster index
            let idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            
            // first item for a 2d texture (for each cluster) is the lightcountIdx
            let countIndex = this._clusterTexture.bufferIndex(idx, 0);
            
            // Fetch light count, increment light count per cluster
            let newCount = this._clusterTexture.buffer[countIndex] + 1;
            if (newCount < MAX_LIGHTS_PER_CLUSTER)
            {
              this._clusterTexture.buffer[countIndex] = newCount;

              // Get the next linear location from a 2D texture of width 4 at idx ( cluster idx )
              let nextlightID = this._clusterTexture.bufferIndex(idx, Math.floor(newCount / 4)) + (newCount % 4);
              
              // Store the light ID at the next position 
              this._clusterTexture.buffer[nextlightID] = lightID;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}