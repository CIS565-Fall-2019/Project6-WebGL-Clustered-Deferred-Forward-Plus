import TextureBuffer from './textureBuffer';
import { vec4 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import { Sphere, Plane, Vector3, Matrix4, Box3, Vector4 } from 'three';
import { SSL_OP_PKCS1_CHECK_2 } from 'constants';
import { sqrDist } from 'gl-matrix/src/gl-matrix/vec3';

export const MAX_LIGHTS_PER_CLUSTER = 100;

function GetFrustrumWidth(camera, depth) {
  return 2 * depth * Math.tan(camera.fov * 0.5 * (Math.PI / 180.0));
}

function GetFrustrumHeight(camera, depth) {
  return GetFrustrumWidth(camera, depth) / camera.aspect;
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
    // NOTE:  This is done on CPU, won't benefit from GPU (possible EC?)

    // Clear all clusters (defined in _clusterTexture by i below)
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    // Basic Goal: Find which lights intersect which clusters.
    // http://www.aortiz.me/2018/12/21/CG.html
    //  for tile in tileArray
    //    for light in scene
    //        if lightInTile(tile, light)
    //            tile += light

    // I decideed to use an adaption of Avalanche's solution
    // http://www.humus.name/Articles/PracticalClusteredShading.pdf
    // Loop over z and reduce the spehere to the XY plance
    // Loop over y and reduce the sphere to the X plane
    // Loop over x and test against the sphere.
    // http://paulbourke.net/geometry/circlesphere/

    // Need some bounds for the view frustrum
    let zMin = camera.near;
    let zMax = camera.far;
    let zDelta = (zMax - zMin) / this._zSlices;

    // Get width and height for xy respectively
    // Is dependent on distance.
    // https://docs.unity3d.com/Manual/FrustumSizeAtDistance.html

    // preallocate
    let lightSphere = new Sphere();

    // Transform light information now to avoid having to reach out far into memory for it
    var localLights = [];
    for (let lightIdx = 0; lightIdx < NUM_LIGHTS; lightIdx++) {
      var l = scene.lights[lightIdx].position;
      localLights[lightIdx] = vec4.create();
      vec4.set(localLights[lightIdx], l[0], l[1], l[2], 1);
      vec4.transformMat4(localLights[lightIdx], localLights[lightIdx], viewMatrix);
      localLights[lightIdx][3] = scene.lights[lightIdx].radius;
    }

    // Run it through the segments and mark the ones that matter
    // Instead of worrying about volume, we look at projections
    for (let z = 0; z < this._zSlices; ++z) {
      // Check for intersection between plane defined by this z depth and sphere
      // If sphere, does not intersect the z plane, then continue
      //let zDepth = -1 * (zMin + zDelta * z);
      let z0 = -zMin * Math.pow((zMax / zMin), ((z+1) / this._zSlices));
      let z1 = -zMin * Math.pow((zMax / zMin), ((z) / this._zSlices));
      let zDepth = -z0;

      // Get width and height for xy respectively
      // Is dependent on distance.
      // https://docs.unity3d.com/Manual/FrustumSizeAtDistance.html
      let width = GetFrustrumWidth(camera, zDepth);
      let height = GetFrustrumHeight(camera, zDepth);
      let minX = -1.0 * (width/2.0);
      let maxX = (width/2.0);
      let minY = -1.0 * (height/2.0);
      let maxY = height/2.0;
      let xDelta = (maxX - minX) / this._xSlices;
      let yDelta = (maxY - minY) / this._ySlices;

      // Check each Y line for intersections
      for (let y = 0; y < this._ySlices; ++y) {
        // Will form a box using xyz from bottom left to top right
        // this is defined by the box formed by the cluster
        let y0 = minY + y * yDelta;
        let y1 = minY + (y+1) * yDelta;

        for (let x = 0; x < this._xSlices; ++x) {
          let x0 = minX + x * xDelta;
          let x1 = minX + (x+1) * xDelta;

          // z0 and z1 calculated above, uses log instead of linear
          // Create box to test against sphere intersection
          let bound = new Box3(
            new Vector3(x0, y0, z0),
            new Vector3(x1, y1, z1)
          );

          // For each light we have...
          for (let lightIdx = 0; lightIdx < NUM_LIGHTS; lightIdx++) {
            // Get center + radius, extract from scene struct to three.js Sphere
            lightSphere.set(
                new Vector3(
                    localLights[lightIdx][0],
                    localLights[lightIdx][1],
                    localLights[lightIdx][2]
                ),
                localLights[lightIdx][3]);

            // Check if the lightsphere abd box intersect
            if(lightSphere.intersectsBox(bound)) {
              let clusterIdx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
              let clusterLightIdx = this._clusterTexture.bufferIndex(clusterIdx, 0);

              let currLights = this._clusterTexture.buffer[clusterLightIdx];
              if(currLights < MAX_LIGHTS_PER_CLUSTER) {
                // We good, increment our light count.
                currLights++;

                // Locate the correct part of the pixel to populate
                let pixel = Math.floor(currLights / 4);

                // We have to do this because of the way that  the buffers are defined
                // Each _clusterBuffer contains many pixels that are really 4 floats
                // So we are abusing that fact to carry over non-rgba data
                // Why doesn't webGL have NORMAL DATA? Because whoever wrote it is dumb.
                let base = this._clusterTexture.bufferIndex(clusterIdx, pixel);
                let offset = currLights % 4;

                this._clusterTexture.buffer[base + offset]   = lightIdx;
                this._clusterTexture.buffer[clusterLightIdx] = currLights;
              }
            }
          }
        }

        // thank u, next
      }
    }

    this._clusterTexture.update();
  }
}