import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS } from '../scene.js';
import { vec3, vec4, vec2 } from 'gl-matrix';
import { min, max } from 'gl-matrix/src/gl-matrix/vec4';


export const MAX_LIGHTS_PER_CLUSTER = 300;

function getDis(scale, lightPos)
{
  let v0 = 1.0 / Math.sqrt(1.0 + scale * scale);
  let v1 = - scale * v0;
  let normal = vec2.create();
  vec2.set(normal, v0, v1);
  return vec2.dot(normal, lightPos);
}

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  calDist(ratio, position){
    let temp = Math.sqrt(1 + ratio * ratio);
    let a1 = 1 / temp;
    let a2 = -ratio * a1;
    let normal = vec2.create();
    vec2.set(normal, a1, a2);
    return vec2.dot(position, normal);
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

    for(let i = 0; i < NUM_LIGHTS; i++) {
      let pos = vec3.fromValues(scene.lights[i].position[0], 
                                scene.lights[i].position[1], 
                                scene.lights[i].position[2]);
      let posinc = vec4.fromValues(pos[0], pos[1], pos[2], 1.0);
      vec3.transformMat4(posinc, posinc, viewMatrix);//transform in the camera
      posinc[2] = -1 * posinc[2];

      //for the light
      let radius = scene.lights[i].radius;
      let maxz = posinc[2] + radius*1.2;
      let minz = posinc[2] - radius*1.2;
      let maxx = posinc[0] + radius*1.2;
      let minx = posinc[0] - radius*1.2;
      let maxy = posinc[1] + radius*1.2;
      let miny = posinc[1] - radius*1.2;


     /* if (maxz < camera.near || minz > camera.far) {
        continue;
      }*/

      let frustz = minz < camera.near? camera.near : minz;
      let yRange = frustz * Math.tan(camera.fov * 0.5 * (Math.PI / 180));//100?
      let xRange = camera.aspect * yRange;

      /*if (maxx < -xRange || minx > xRange || maxy < -yRange || miny > yRange) { 
        continue;
      } */

      //calculate index
      //let fovx = camera.aspect * camera.fov;
      //let halffov = ((0.5 * fovx) / 180.0) * Math.PI;//degree to radian
      //y
      let halffovy = (0.5 * camera.fov) / 180.0 * Math.PI;
      let dis = minz < camera.near? camera.near:minz;
      let nearminy = -Math.tan(halffovy) * dis;
      let nearmaxy = Math.tan(halffovy) * dis;
      let strideneary = (nearmaxy - nearminy) / this._ySlices;
      let indnearminy = Math.floor((miny - nearminy) / strideneary)>=0? Math.floor((miny - nearminy) / strideneary):0;
      let indnearmaxy = Math.floor((maxy - nearminy) / strideneary)<=this._ySlices-1? Math.floor((maxy - nearminy) / strideneary):this._ySlices-1; 

      //x
      let nearmaxx = Math.tan((0.5 * camera.fov) / 180.0 * Math.PI) * dis * camera.aspect;
      let nearminx = -Math.tan((0.5 * camera.fov) / 180.0 * Math.PI) * dis * camera.aspect;
      let stridenearx = (nearmaxx - nearminx) / this._xSlices;
      let indnearminx = Math.floor((minx - nearminx) / stridenearx)>= 0? Math.floor((minx - nearminx) / stridenearx) : 0;
      let indnearmaxx = Math.floor((maxx - nearminx) / stridenearx)<=this._xSlices-1? Math.floor((maxx - nearminx) / stridenearx):this._xSlices-1;

      let stridez = (camera.far - camera.near) / this._zSlices;
      let indminz = Math.floor((dis - camera.near) / stridez)>=0? Math.floor((dis - camera.near) / stridez) : 0;
      let indmaxz = Math.floor((maxz - camera.near) / stridez)<=this._zSlices-1? Math.floor((maxz - camera.near) / stridez):this._zSlices-1;

      /*if(i < 10){
        console.log("index:",i, "pos", posinc, "maxz:", indmaxz, "minz:", indminz, "maxy", indnearmaxy, "miny", indnearminy, "xmax",indnearmaxx, "xmin", indnearminx);
      }*/

      for(let z = indminz; z <= indmaxz; z++) {
        for(let y = indnearminy; y <= indnearmaxy; y++) {
          for(let x = indnearminx; x <= indnearmaxx; x++) {
              let ind = x + y * this._xSlices + z * this._xSlices * this._ySlices;
              // the index of cluster count->cluster count!
              // get the current light count! 
              let count = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(ind, 0)];
                if((count + 1) <= MAX_LIGHTS_PER_CLUSTER) {
                count = count + 1;
                this._clusterTexture.buffer[this._clusterTexture.bufferIndex(ind, 0)] = count;
                let rowc = Math.floor(count / 4);
                let colc = count - rowc * 4;
                //set the light index!
                this._clusterTexture.buffer[this._clusterTexture.bufferIndex(ind, rowc) + colc] = i; 
            }
              //console.log("index:", ind, "count:", count, "rowc: ", rowc, "colc: ",  colc);
          }
        }
      }
    }
    this._clusterTexture.update();
  }
}