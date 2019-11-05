import { makeRenderLoop, camera, cameraControls, gui, gl } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredRenderer from './renderers/clustered';
import Scene from './scene';

const FORWARD = 'Forward';
const FORWARD_PLUS = 'Forward+';
const CLUSTERED = 'Clustered(P)';
const CLUSTERED_BP = 'Clustered(BP)'

const params = {
  renderer: FORWARD_PLUS,
  _renderer: null,
};

setRenderer(params.renderer);

function setRenderer(renderer) {
  switch(renderer) {
    case FORWARD:
      params.renderer = FORWARD;
      params._renderer = new ForwardRenderer();
      break;
    case FORWARD_PLUS:
      params.renderer = FORWARD_PLUS;
      params._renderer = new ForwardPlusRenderer(15, 15, 15);
      break;
    case CLUSTERED:
      params.renderer = CLUSTERED;
      params._renderer = new ClusteredRenderer(15, 15, 15, false);
      break;
    case CLUSTERED_BP:
      params.renderer = CLUSTERED_BP;
      params._renderer = new ClusteredRenderer(15, 15, 15, true);
      break;
  }
}

var gui_dropdown = gui.add(params, 'renderer', [FORWARD, FORWARD_PLUS, CLUSTERED, CLUSTERED_BP]);
gui_dropdown.onChange(setRenderer);

// respond to key press (1 - forward, 2 - forward+, 3 - clustered)
document.body.onkeypress = function(e){
  if(e.keyCode == 49){            // 1
    setRenderer(FORWARD);
    gui_dropdown.setValue(FORWARD);
  } else if (e.keyCode == 50) {   // 2
    setRenderer(FORWARD_PLUS);
    gui_dropdown.setValue(FORWARD_PLUS);
  } else if (e.keyCode == 51) {   // 3
    setRenderer(CLUSTERED);
    gui_dropdown.setValue(CLUSTERED);
  } else if (e.keyCode == 52) {
    setRenderer(CLUSTERED_BP);
    gui_dropdown.setValue(CLUSTERED_BP);
  }
}

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