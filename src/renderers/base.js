import TextureBuffer from './textureBuffer';
import { vec4 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import { Sphere, Plane, Vector3, Matrix4, Box3 } from 'three';
import { SSL_OP_PKCS1_CHECK_2 } from 'constants';
import { sqrDist } from 'gl-matrix/src/gl-matrix/vec3';

export const MAX_LIGHTS_PER_CLUSTER = 100;

class SphereRayIntersectionTest {
  // Equation from 
  // http://paulbourke.net/geometry/circlesphere/

  // sphere: THREE.Sphere
  // point1: Three.Vector3, point 1 of line
  // point2: Three.Vector3, point 2 of line
  constructor(sphere, p1, p2) {
    // Init values
    this._intersects = false;
    this._i1 = new Vector3(0, 0, 0);
    this._i2 = new Vector3(0, 0, 0);

    // Extract values
    let lx = p2.x - p1.x;
    let ly = p2.x - p1.x;
    let lz = p2.x - p1.x;
    let sc = sphere.center;
    let sr = sphere.radius;

    // Calculate componenrts of quadratic equation
    let a = lx*lx + ly*ly + lz*lz;
    let b = 2 * (lx*(p1.x - sc.x) + ly*(p1.y - sc.y) + lz*(p1.z-sc.z));
    let c = sc.x*sc.x + sc.y*sc.y + sc.z*sc.z 
            + p1.x*p1.x + p1.y*p1.y + p1.z*p1.z
            - 2 * (sc.x*p1.x + sc.y*p1.y + sc.z*p1.z)
            - sr*sr;

    // Check for a solution
    let inner_quadratic = b*b - 4*a*c;
    if(inner_quadratic <= 0) {
      // Already set to failure
    }
    else {
      // A solution exists, solve the quadratic
      this._intersects = true;

      let q1 = (-b + Math.sqrt(inner_quadratic)) / (2*a);
      let q2 = (-b - Math.sqrt(inner_quadratic)) / (2*a);

      // Have to use crazy functions because JS
      //this._i1 = (p1 + q1*(p2 - p1));
      let tmp = new Vector3();
      this._i1.copy(tmp.copy(p2).sub(p1).multiplyScalar(q1).add(p1));
      this._i2.copy(tmp.copy(p2).sub(p1).multiplyScalar(q2).add(p1));
    }
  }

  valid() {
    return this._intersects;
  }

  getPoint1() {
    return this._i1;
  }

  getPoint2() {
    return this._i2;
  }
}

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

    // For each light we have...
    for (let lightIdx = 0; lightIdx < NUM_LIGHTS; lightIdx++) {
      // Get center + radius, extract from scene struct to three.js Sphere
      let lightSphere = new Sphere(
        new Vector3(
          scene.lights[lightIdx].position[0],
          scene.lights[lightIdx].position[1],
          scene.lights[lightIdx].position[2]
        ),
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
        //let zDepth = -1 * (zMin + zDelta * z);
        let z0 = -zMin * Math.pow((zMax / zMin), (z / this._zSlices));
        let z1 = -zMin * Math.pow((zMax / zMin), ((z+1) / this._zSlices));
        let zDepth = -z0;
        let zPlane = new Plane(new Vector3(0, 0, 1), zDepth);

        if(!lightSphere.intersectsPlane(zPlane)) {
          continue;
        }

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
          var xLeft = -1;
          var xRight = -1; 

          // At the intersection of the Zplane and the XY plane we have lines at each 
          // ySlice. We can calculate a line from (x_min, yn, z) to (x_max, yn, z) for 
          // each n (that is, _yslice). If a line intersects, find the intersection points.
          // From those points, we can find which box defined by _xSlice contains the leftmost
          // intersection and again for the rightmost intersection.

          // Intersections of a line and sphere are defined by the quadratic equation
          // Specifically the result of ( b*b - 4*a*c)
          // If < 0, no intersect
          // If == 0, tangential (we will say this does not intersect since light affect only within the bound)
          // If > 0, intersections at two points. defined by quadratic equation
          /*
           * NOTE: Ditching line intersection in favor of box intersection
           */
          // let thisY = minY + (yDelta * y); 
          // let p1 = new Vector3(minX, thisY, zDepth);
          // let p2 = new Vector3(maxX, thisY, zDepth);
          // let intersection = new SphereRayIntersectionTest(lightSphere, p1, p2);

          // if(intersection.valid()) {
          //   // Left scan on X
          //   for (let x = 0; x < this._xSlices; ++x) {
          //     if(minX + (xDelta * x) > intersection.getPoint1().x) {
          //       xLeft = x - 1;
          //       break;
          //     }
          //   }

          //   // Right scan on X
          //   for (let x = this._xSlices - 1; x >= xLeft; --x) {
          //     if(minX + (xDelta * x) < intersection.getPoint2().x) {
          //       xRight = x;
          //       break;
          //     }
          //   }

          //   // Fill in the cluster texture with our intersections
          //   for(let x = xLeft; x <= xRight; x++) {
          //     let clusterIdx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          //     let clusterLightIdx = this._clusterTexture.bufferIndex(clusterIdx, 0);

          //     let currLights = this._clusterTexture.buffer[clusterLightIdx];
          //     if(currLights < MAX_LIGHTS_PER_CLUSTER) {
          //       // We good, increment our light count.
          //       currLights++;

          //       // Locate the correct part of the pixel to populate
          //       let pixel = Math.floor(currLights / 4);

          //       // We have to do this because of the way that  the buffers are defined
          //       // Each _clusterBuffer contains many pixels that are really 4 floats
          //       // So we are abusing that fact to carry over non-rgba data
          //       // Why doesn't webGL have NORMAL DATA? Because whoever wrote it is dumb.
          //       let base = this._clusterTexture.bufferIndex(clusterIdx, pixel);
          //       let offset = currLights - pixel * 4;

          //       this._clusterTexture.buffer[base + offset]   = lightIdx;
          //       this._clusterTexture.buffer[clusterLightIdx] = currLights;
          //     }
          //   }
          // }

          // Will form a box using xyz from bottom left to top right
          // this is defined by the box formed by the cluster
          let y0 = minY + y * yDelta;
          let y1 = minY + (y+1) * yDelta;

          for (let x = 0; x < this._xSlices; ++x) {
            let x0 = minX + x * xDelta;
            let x1 = minX + (x+1) * xDelta;

            // z0 and z1 calculated above, uses log instead of linear
            // Create box to test against sphere intersection
            let bound = new Box3(new Vector3(x0, y0, z0), new Vector3(x1, y1, z1));

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
                let offset = currLights - pixel * 4;

                this._clusterTexture.buffer[base + offset]   = lightIdx;
                this._clusterTexture.buffer[clusterLightIdx] = currLights;
              }

            }
          }

          // thank u, next
        }
      }
    }

    this._clusterTexture.update();
  }
}