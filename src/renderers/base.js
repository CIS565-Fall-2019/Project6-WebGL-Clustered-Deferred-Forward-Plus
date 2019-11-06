import TextureBuffer from './textureBuffer';
import { mat4, vec4, vec3, vec2 } from 'gl-matrix';

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

        var fHeight = 2.0 * Math.tan(camera.fov * 0.5 * (Math.PI / 180.0));

        for (let lightIndex = 0; lightIndex < scene.lights.length; ++lightIndex){
            var light = scene.lights[lightIndex];
            var lPos = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1);
            vec4.transformMat4(lPos, lPos, viewMatrix);

            var alpha =(Math.abs(lPos[2]) - 1.0 * camera.near)/(1.0 * camera.far - 1.0 * camera.near);
            var lHeight = fHeight * camera.near * (1 - alpha) + fHeight * camera.far * alpha;
            var lWidth = camera.aspect * lHeight;

            var xMin = Math.max(0, Math.min(Math.floor((lPos[0] - light.radius + 0.5 * lWidth) / (lWidth / this._xSlices)), this._xSlices - 1));  
            var xMax = Math.max(0, Math.min(Math.floor((lPos[0] + light.radius + 0.5 * lWidth) / (lWidth / this._xSlices)), this._xSlices - 1));
            var yMin = Math.max(0, Math.min(Math.floor((lPos[1] - light.radius + 0.5 * lHeight) / (lHeight / this._ySlices)), this._ySlices - 1));
            var yMax = Math.max(0, Math.min(Math.floor((lPos[1] + light.radius + 0.5 * lHeight) / (lHeight / this._ySlices)), this._ySlices - 1));
            var zMin = Math.max(0, Math.min(Math.floor((Math.abs(-1.0 * lPos[2]) - light.radius - camera.near) / ((camera.far - camera.near) / this._zSlices)), this._zSlices - 1));
            var zMax = Math.max(0, Math.min(Math.floor((Math.abs(-1.0 * lPos[2]) + light.radius - camera.near) / ((camera.far - camera.near) / this._zSlices)), this._zSlices - 1));

            for(let z = zMin; z <= zMax; ++z){
                for(let y = yMin; y <= yMax; ++y){
                    for(let x = xMin; x <= xMax; ++x){
                        let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
                        var lightId = this._clusterTexture.bufferIndex(i, 0);
                        var numLights = this._clusterTexture.buffer[lightId] + 1;
                        if(numLights <= MAX_LIGHTS_PER_CLUSTER){
                            this._clusterTexture.buffer[lightId] = numLights;
                                this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, Math.floor(numLights / 4)) + (numLights % 4)] = lightIndex;
                        }
                    }
                }
            }
        }
        this._clusterTexture.update();
    }
}