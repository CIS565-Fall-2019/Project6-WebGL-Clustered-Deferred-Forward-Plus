import TextureBuffer from './textureBuffer';
import { vec4 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import { Sphere, Plane, Vector3, Matrix4 } from 'three';

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
    // Each light has a center and a radius.
    // Light will always be in cluster that center is in.
    // Check if the radius is past any near/far plane bouncds
    // If so, check those bounds. If not, the light is local to one cluster.

    // Alternatively, use an adaption of the Avalanche solution
    // Loop over z and reduce the spehere to the XY plance
    // Loop over y and reduce the sphere to the X plane
    // Loop over x and test against the sphere.
    // http://paulbourke.net/geometry/circlesphere/

    // Need some bounds for the view frustrum
    let zMin = camera.near;
    let zMax = camera.far;
    let zDelta = (zMax - zMin) / this._zSlices;

    // For each light we have...
    for (let lightIdx = 0; lightIdx < NUM_LIGHTS; lightIdx++) {
      // Get center + radius, extract from scene struct to three.js Sphere
      let center = new Vector3(
        scene.lights[lightIdx].position[0],
        scene.lights[lightIdx].position[1],
        scene.lights[lightIdx].position[2]
      );
      let lightSphere = new Sphere(
        center,
        scene.lights[lightIdx].radius);

      // Apply transform
      let tm = new Matrix4;
      tm.fromArray(viewMatrix);
      lightSphere.applyMatrix4(tm);

      // Run it through the segments and mark the ones that matter
      // Instead of worrying about volume, we look at projections
      for (let z = 0; z < this._zSlices; ++z) {
        // Check for intersection between plane defined by this z depth and sphere
        // If sphere, does not intersect the z plane, then continue
        let zPlane = new Plane(new Vector3(0, 0, 1), -1 * (zMin + zDelta * z));
        if(!lightSphere.intersectsPlane(zPlane)) {
          continue;
        }

        for (let y = 0; y < this._ySlices; ++y) {
          var xLeft = -1;
          var xRight = -1; 

          // Left scan on X
          for (let x = 0; x < this._xSlices; ++x) {
            let clusterIdx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            // if(collision) {
            //   xLeft = x;
            // }
          }

          // Right scan on X
          for (let x = this._xSlices - 1; x >= xLeft; --x) {
            let clusterIdx = x + y * this._xSlices + z * this._xSlices * this._ySlices;

            // if(collision) {
            //   xRight = x;
            // }
          }

          // Fill in 
          for(let x = xLeft; x <= xRight; x++) {

          }

          // thank u, next
        }
      }
    }

    this._clusterTexture.update();
  }
}