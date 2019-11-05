**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 6**

* Disha Jindal: [Linkedin](https://www.linkedin.com/in/disha-jindal/)
* Tested on: Google Chrome Version 78.0.3904.70 (Official Build) (64-bit) on MacBook Pro, 2.3 GHz Intel Core i5 @ 8GB, Intel Iris Plus Graphics 640 1536 MB

WebGL Clustered and Forward+ Shading
======================
<p align="center"><img src="https://github.com/DishaJindal/Project6-WebGL-Clustered-Deferred-Forward-Plus/blob/master/img/screenshot.png"></p>

<p align="center"><img src="https://github.com/DishaJindal/Project6-WebGL-Clustered-Deferred-Forward-Plus/blob/master/img/smallgif.gif"></p>

## Introduction
The project implements WebGL based forward and deferred renderers. Following is the list of different implementations:

**Forward**

The first and simplest rendering technique is forward. In this, all lights are considered for shading every object thus making the shading process very slow. 

**Forward+**

To alleviate the speed issues in forward, in case of forward+ the number of lights which are checked for each object are reduced. This is implemented using a clustering technique in which the view frustrum portion from the near clip plane to the far clip plane is divided into voxels. We then figure out which light affect which voxel and save this information in a texture which is unpacked while shading to find which lights should be considered for which object.

**Deferred**

In Deferred shading technique, the main is to get rid of nested loops in the forward shaders. This is done by adding an additional pass in which we save the object's geometric information into a series of textures which are known is g-buffers. There are then then referred at the final shading stage and improves the performance significantly.

## Features
   - [x] Forward+ Rendering
   - [x] Clustered Rendering
   - [x] Blinn-Phong shading
   - [X] G-buffer format Optimization
   - [x] Performance Analysis

## Performance Analysis

Following is the plot of different shading techniques with varying number of lights. The y-axis corresponds to the time taken to render a frame and x-axis denotes the number of lights in the scene. It is evident from the plot that forward rendering is not a feasible technique in case of large number of lights. Clustering the lights into tiles in forward+ gives significant improvement over forward. The performance is further improved with deferred rendering.

<p align="center"><img src="https://github.com/DishaJindal/Project6-WebGL-Clustered-Deferred-Forward-Plus/blob/master/img/perf.png" width="600"></p>

**Optimization: g-buffer**

<p align="center"><img src="https://github.com/DishaJindal/Project6-WebGL-Clustered-Deferred-Forward-Plus/blob/master/img/octa.png" width="400"></p>

To optimize the deferred rendering technique further, I reduced the number of number of g-buffers used. Earlier, I was using 3 vectors to store normal, position and color information which where reduced to 2 by encoding the normal vector using `Octahedron normal vector encoding` technique. As we can see from the following plot, it helps in improving the performance which increases with increase in the number of lights. 

<p align="center"><img src="https://github.com/DishaJindal/Project6-WebGL-Clustered-Deferred-Forward-Plus/blob/master/img/gbuffer.png" width="600"></p>

**Blinn-Phong reflection**

<p align="center"><img src="https://github.com/DishaJindal/Project6-WebGL-Clustered-Deferred-Forward-Plus/blob/master/img/blinn.png" width="400"></p>

To simulate better reflections, I implemented blinn-phong reflections in deferred shading. It subtely improved the scene and due to some additional computation it has slight affect on the performance of the renderer which can be seen in the following graph. This being a constant factor computation addition, the gap doesn't increase with the increase in the number of lights.

<p align="center"><img src="https://github.com/DishaJindal/Project6-WebGL-Clustered-Deferred-Forward-Plus/blob/master/img/blinnphong.png" width="600"></p>

## Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
