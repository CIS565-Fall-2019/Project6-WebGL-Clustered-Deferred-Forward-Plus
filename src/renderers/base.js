import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene';
import { mat4, vec4, vec3 } from 'gl-matrix';


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

    // Create the dimension grid for the near plane and the end plane for each tile furstum. 
    // Taking the depth of camera near plane as 1.

    var frustHeight = 2.0 * Math.tan(camera.fov * (Math.PI)/360.0);
    var aspectRatio = camera.aspect; 
    var frustWidth =  aspectRatio * frustHeight;

    var depth = camera.far - camera.near;
    
    for (let light = 0; light < NUM_LIGHTS; ++light){
      var lightPosition = vec4.fromValues(scene.lights[light].position[0],scene.lights[light].position[1],scene.lights[light].position[2],1.0);
      var lightRadius = scene.lights[light].radius;

      vec4.transformMat4(lightPosition,lightPosition,viewMatrix);
      lightPosition[2] *= -1.0;  // As camera z-axis is along negative z-axis

      // From the similar triangles, we can get the width and height of the fractum at the depth of the lightSource

      var lightFractWidth = frustWidth * lightPosition[2];
      var lightFractHeight = frustHeight * lightPosition[2];

      var strideLightFractWidth = lightFractWidth/this._xSlices;
      var strideLightFractHeight = lightFractHeight/this._ySlices; 

      var strideLightFractDepth = depth/this._zSlices; 
      // Calculate the bounding x & y coordinates for the light source point

      var minX = Math.floor((lightPosition[0] - lightRadius + 0.5 *lightFractWidth)/strideLightFractWidth);
      var maxX = Math.floor((lightPosition[0] + lightRadius + 0.5 *lightFractWidth)/strideLightFractWidth);

      var minY = Math.floor((lightPosition[1] - lightRadius + 0.5 *lightFractHeight)/strideLightFractHeight);
      var maxY = Math.floor((lightPosition[1] + lightRadius + 0.5 *lightFractHeight)/strideLightFractHeight);

      var minZ = Math.floor((lightPosition[2] - lightRadius)/strideLightFractDepth);
      var maxZ = Math.floor((lightPosition[2] + lightRadius)/strideLightFractDepth);

      // Need to clamp the above min and max values

      minX = Math.min(this._xSlices -1 , minX);
      minX = Math.max(0,minX);

      maxX = Math.min(this._xSlices -1 , maxX);
      maxX = Math.max(0,maxX);

      minY = Math.min(this._ySlices -1 , minY);
      minY = Math.max(0,minY);

      maxY = Math.min(this._ySlices -1 , maxY);
      maxY = Math.max(0,maxY);

      minZ = Math.min(this._zSlices -1 , minZ);
      minZ = Math.max(0,minZ);

      maxZ = Math.min(this._zSlices -1 , maxZ);
      maxZ = Math.max(0,maxZ);

      for (let x = minX; x <= maxX ; ++x){
        for (let y = minY; y <= maxY ; ++y){
          for (let z = minZ; z <= maxZ ; ++z){
            let idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            var lightIdx = this._clusterTexture.bufferIndex(idx, 0);
            var countMaxLights = this._clusterTexture.buffer[lightIdx];
            if (countMaxLights < MAX_LIGHTS_PER_CLUSTER){
              countMaxLights++;
              this._clusterTexture.buffer[lightIdx] = countMaxLights;
              var row = Math.floor(countMaxLights * 0.25);
              var component = countMaxLights % 4;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, row) + component] = light;
            }
          }
        }
      }
    }
    this._clusterTexture.update();
  }
}