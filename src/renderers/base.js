import TextureBuffer from './textureBuffer';
import {Sphere, Box3, Vector3} from 'three';
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

        let depthLength = camera.far - camera.near;
        let viewHeight = 2.0 * Math.tan(camera.fov*Math.PI/360.0);

        let nearHeight = viewHeight * camera.near;
        let nearWidth = viewHeight * camera.aspect * camera.near;

        let farHeight = viewHeight * camera.far;
        let farWidth = viewHeight * camera.aspect * camera.far;

        let dz = depthLength / this._zSlices;

        for(let light = 0; light < scene.lights.length; light++){
            let radius = scene.lights[light].radius;
            let position = scene.lights[light].position;
            var screenPos = vec4.fromValues(position[0], position[1], position[2], 1.0);
            vec4.transformMat4(screenPos, screenPos, viewMatrix);
            screenPos[2] *= -1.0;

            let lambda = (screenPos[2] - camera.near)/depthLength;

            let width = nearWidth * (1-lambda) + farWidth * lambda;
            let height = nearHeight * (1-lambda) + farHeight * lambda;
            let dx = width / this._xSlices;
            let dy = height / this._ySlices;

            let xStart = Math.floor((screenPos[0] - radius + width/2) / dx);
            let xEnd = Math.floor((screenPos[0] + radius + width/2) / dx);

            let yStart = Math.floor((screenPos[1] - radius + height/2) / dy);
            let yEnd = Math.floor((screenPos[1] + radius + height/2) / dy);

            let zStart = Math.floor((Math.abs(screenPos[2]) - radius - camera.near) / dz);
            let zEnd = Math.floor((Math.abs(screenPos[2]) + radius - camera.near) / dz);

            xStart = Math.max(0, Math.min(this._xSlices - 1, xStart));
            xEnd = Math.max(0, Math.min(this._xSlices - 1, xEnd));

            yStart = Math.max(0, Math.min(this._ySlices - 1, yStart));
            yEnd = Math.max(0, Math.min(this._ySlices - 1, yEnd));

            zStart = Math.max(0, Math.min(this._zSlices - 1, zStart));
            zEnd = Math.max(0, Math.min(this._zSlices - 1, zEnd));

            for (let z = zStart; z <= zEnd; ++z) {
                for (let y = yStart; y <= yEnd; ++y) {
                    for (let x = xStart; x <= xEnd; ++x) {
                        let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
                        let lightIdx = this._clusterTexture.bufferIndex(i, 0);
                        let num_lights = this._clusterTexture.buffer[lightIdx] + 1;

                        if(num_lights <= MAX_LIGHTS_PER_CLUSTER){
                            this._clusterTexture.buffer[lightIdx] = num_lights;

                            let t = Math.floor(num_lights/4.0);
                            let nextIdx = this._clusterTexture.bufferIndex(i, t) + num_lights - t*4;;

                            this._clusterTexture.buffer[nextIdx] = light;
                        }
                    }
                }
            }

        }

        this._clusterTexture.update();
    }
}