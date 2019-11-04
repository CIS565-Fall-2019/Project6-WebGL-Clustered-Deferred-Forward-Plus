import TextureBuffer from './textureBuffer';
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

    let yfov = Math.tan(camera.fov * 0.5 * (Math.PI / 180.0));
    let xfov = yfov * camera.aspect;

    for (let i = 0; i < NUM_LIGHTS; ++i){
      let lightRadius = scene.lights[i].radius;
      let homoLightPos = vec4.fromValues(scene.lights[i].position[0],
                                         scene.lights[i].position[1],
                                         scene.lights[i].position[2], 1.0);
      vec4.transformMat4(homoLightPos, homoLightPos, viewMatrix);
      homoLightPos[2] *= -1.0;

      //Determine Frustum Box Extent
      //1: Frustum Z Dimension (Clip Planes)
      let sliceDepth = homoLightPos[2];
      let zInterval = (camera.far - camera.near) / this._zSlices;
      let zMin = Math.max(Math.floor((sliceDepth - radius) / zInterval), 0);
      let zMax = Math.min(Math.floor((sliceDepth + radius) / zInterval), this._zSlices - 1);

      //2: Frustum X Dimension 
      let sliceWidth = 2.0 * xfov * sliceDepth;
      let xInterval = sliceWidth / this._xSlices;
      let xMin = Math.max(Math.floor((homoLightPos[0] + xfov * sliceDepth - radius) / xInterval), 0);
      let xMax = Math.min(Math.floor((homoLightPos[0] + xfov * sliceDepth + radius) / xInterval), this._xSlices - 1);

      //3: Frustum Y Dimension
      let sliceHeight = 2.0 * yfov * sliceDepth;
      let yInterval = sliceHeight / this._ySlices;
      let yMin = Math.max(Math.floor((homoLightPos[1] + yfov * sliceDepth - radius) / yInterval), 0);
      let yMax = Math.max(Math.floor((homoLightPos[1] + yfov * sliceDepth + radius) / yInterval), this._ySlices - 1);

      for(let z = zMin; z <= zMax; ++z){
        for(let y = yMin; y <= yMax; ++y){
          for(let x = xMin; x <= xMax; ++x){
            let linearIdx = x + y*this._xSlices + z * this._ySlices * this._xSlices;
            let numAffectedLights = this._clusterTexture[this._clusterTexture.bufferIndex(linearIdx, 0)] + 1;

            if(numAffectedLights <= MAX_LIGHTS_PER_CLUSTER){
              let col = Math.floor(numAffectedLights / 4);
              let row = Math.floor(numAffectedLights % 4);
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(linearIdx, 0)] = numAffectedLights;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(linearIdx, 0) + row] = 1;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}