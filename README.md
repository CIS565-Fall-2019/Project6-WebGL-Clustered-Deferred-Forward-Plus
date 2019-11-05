WebGL Clustered and Forward+ Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* SOMANSHU AGARWAL
  * [LinkedIn](https://www.linkedin.com/in/somanshu25/)
* Tested on: **Google Chrome Version 76.0.3809.132 ** on
  MacBook Pro 2.3 GHz Intel Core i5 @ 8 GB 2133 MHz LPDDR3, Intel Iris Plus Graphics 640 1536 MB

<p align="center"><img src="https://github.com/somanshu25/Project6-WebGL-Clustered-Deferred-Forward-Plus/blob/master/Cluster.png" width="700"/></p>

### Demo Video/GIF

![](vedio2.gif)

### Table of Contents

1. [Introduction](#Introduction)
2. [Forward Plus](#Forward-Plus)
3. [Clustering](#CLustering)
4. [Effects](#Effects)
5. [Optimization](#Optimization)
6. [Analysis](#Analysis)
7. [Credits](#Credits)

### Introduction
In this project, we will be performing analysis of three rendering techniques, forward, forward plus and clusgtering (using deferred). I will be also performing some of the lightning effect such as Blinn Phong lightning model and also tried to perform the optimization by using two slots int eh texture buffer instead of three by saving the normal 2-components.

### Forward Plus
In the forward rendering technique, we go over all the light sources and then loop over all the object geometries and then check whether the light has an impact on the geometry adn then shade the point/geometry according to it. In forward plus, we divide the screen in tiles of same size. Hence, we get tiles in the shape of frustum in which the light source will lie. FOr each frustum tile, we will be storing the corresponding number of lights impacted and the list of light indices. AFter performing this, for the geometry lying in the space, we calculate the frustum it les and loop over those lights only, rather than the total number of lights, giving us performance improvement.

<p align="center"><img src="https://github.com/somanshu25/Project6-WebGL-Clustered-Deferred-Forward-Plus/blob/master/Forwardplus.png" width="600"/></p>

### Clustering
Here, we reuse the forward plus logic of storing the lights for eahc frustum and we stor the geometry related data (posirtion, normal and color of the point) in the g-buffer (geometry buffer) and then use the data when the geometry is called and then loop over the lights. Here, we are not looping all over the geometries in case of previous techniques.

### Effects
In the clustering rendering technique, we can add the specular to the fragment color which can make the lights more brighter which are visible in the screenshot below.

### Optimization
To optimize the memory, we can save the memory usage for the g-buffer by using 2 slots intead of 3 slots. We can compress the 3D normal representation into two dimension using [Octahedron-normal vectors encoding](https://knarkowicz.wordpress.com/2014/04/16/octahedron-normal-vector-encoding/). We can observe the FPS optimization in the table below.

<p align="center"><img src="https://github.com/somanshu25/Project6-WebGL-Clustered-Deferred-Forward-Plus/blob/master/anaylsis_2.png" width="600"/></p>

### Analysis
The below graph shows the frame rate per seconf for the three techniques for varying the number of lights.
<p align="center"><img src="https://github.com/somanshu25/Project6-WebGL-Clustered-Deferred-Forward-Plus/blob/master/Analysis1.png" width="600"/></p>

We can clearly observe that clustering using ForwardPlus logic gives the best result as it uses the advantage of tiling and using g-buffers for optimization and improving performance. The forward technique is chosen as baseline here.

### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
