import { makeRenderLoop, camera, cameraControls, gui, gl } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredRenderer from './renderers/clustered';
import Scene from './scene';

const FORWARD = 'Forward';
const FORWARD_PLUS = 'Forward+';
const CLUSTERED = 'Clustered';

const params = {
  renderer: FORWARD_PLUS,
  _renderer: null,
};

setRenderer(params.renderer);

function setRenderer(renderer) {
  console.log(params.renderer);
  switch(renderer) {
    case FORWARD:
      params._renderer = new ForwardRenderer();
      break;
    case FORWARD_PLUS:
      params._renderer = new ForwardPlusRenderer(15, 15, 15);
      break;
    case CLUSTERED:
      params._renderer = new ClusteredRenderer(15, 15, 15);
      break;
  }
}

gui.add(params, 'renderer', [FORWARD, FORWARD_PLUS, CLUSTERED]).onChange(setRenderer);

const scene = new Scene();
scene.loadGLTF('models/sponza/sponza.gltf');

camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
gl.enable(gl.DEPTH_TEST);

function render() {
  scene.update();
  params._renderer.render(camera, scene);
}

let forwardplus = true;
let lastnum = 0;
let num = 0;

function changetype() {
    if(lastnum == num) {
      return;
    }
    if(forwardplus) {
      params.renderer = FORWARD_PLUS;
      lastnum = num;
      //console.log("0");
    } else {
      params.renderer = FORWARD;
      lastnum = num;
     // console.log("1");
    }
    //console.log(params.renderer);
    setRenderer(params.renderer);
}

function main() {
  window.addEventListener('keyup', function (e) {
    switch(e.key) {
      case 'w':
      forwardplus = !forwardplus;
      num++;
      changetype();
      break;
    }
  }, false);
}
main();
makeRenderLoop(render)();
makeRenderLoop(changetype)();