import { makeRenderLoop, camera, cameraControls, gui, gl } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredRenderer from './renderers/clustered';
import Scene from './scene';

import { NUM_LIGHTS } from './scene';
import { MAX_LIGHTS_PER_CLUSTER } from './scene';

const FORWARD = 'Forward';
const FORWARD_PLUS = 'Forward+';
const DEFFERED = 'Deferred';

const Lambertian = 'Lambertian';
const BlinnPhong = 'BlinnPhong';

var shadertype = 0;
var numLights = 0;
var maxLightsPerCluster = 0;

const params = {
  renderer: FORWARD_PLUS,
  numLights:NUM_LIGHTS,
  maxLightsPerCluster: MAX_LIGHTS_PER_CLUSTER,
  ShadingModel: Lambertian,
  _renderer: null,
};

setRenderer(params.renderer);

function setRenderer(renderer) {
  if(params.ShadingModel == 'Lambertian')
  {
    shadertype = 0;
  }
  else if(params.ShadingModel == 'BlinnPhong')
  {
    shadertype = 1;
  }

  if(params.numLights == '100')
  {
    numLights = 100;
  }
  else if(params.numLights == '250')
  {
    numLights = 250;
  }
    else if(params.numLights == '500')
  {
    numLights = 500;
  }
  else if(params.numLights == '1000')
  {
    numLights = 1000;
  }
  else if(params.numLights == '2000')
  {
    numLights = 2000;
  }
  else
  {
    numLights = NUM_LIGHTS;
  }


  if(params.maxLightsPerCluster == '100')
  {
    maxLightsPerCluster = 100;
  }
  else if(params.maxLightsPerCluster == '25')
  {
    maxLightsPerCluster = 25;
  }
  else if(params.maxLightsPerCluster == '50')
  {
    maxLightsPerCluster = 50;
  }
  else if(params.maxLightsPerCluster == '200')
  {
    maxLightsPerCluster = 200;
  }
  else if(params.maxLightsPerCluster == '75')
  {
    maxLightsPerCluster = 75;
  }
  else
  {
    maxLightsPerCluster = MAX_LIGHTS_PER_CLUSTER;
  }


  switch(renderer) {
    case FORWARD:
      params._renderer = new ForwardRenderer();
      break;
    case FORWARD_PLUS:
      params._renderer = new ForwardPlusRenderer(15, 15, 15, camera,maxLightsPerCluster,shadertype,numLights);
      break;
    case DEFFERED:
      params._renderer = new ClusteredRenderer(15, 15, 15, camera,maxLightsPerCluster,shadertype,numLights);
      break;
  }
}

gui.add(params, 'renderer', [FORWARD, FORWARD_PLUS, DEFFERED]).onChange(setRenderer);

gui.add(params, 'ShadingModel', [Lambertian, BlinnPhong]).onChange(function(newVal) {
  setRenderer(params.renderer);
});

gui.add(params, 'numLights', ['100', '250','500','1000','2000']).onChange(function(newVal) {
  setRenderer(params.numLights);
});

gui.add(params, 'maxLightsPerCluster', ['100', '25','50','200','75']).onChange(function(newVal) {
  setRenderer(params.maxLightsPerCluster);
});

const scene = new Scene();
scene.loadGLTF('models/sponza/sponza.gltf');

camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
gl.enable(gl.DEPTH_TEST);

function render() {
  scene.update();
  params._renderer.render(camera, scene);
}

makeRenderLoop(render)();