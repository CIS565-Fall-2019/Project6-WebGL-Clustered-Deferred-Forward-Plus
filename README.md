WebGL Clustered and Deferred Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 6**
* Jiangping Xu
  * [LinkedIn](https://www.linkedin.com/in/jiangping-xu-365b19134/)
* Tested on: Windows 10, i7-4700MQ @ 2.40GHz 8GB, GT 755M 6100MB (personal laptop)
___

## Live Online

[Online Demo](https://haco77.github.io/Project6-WebGL-Clustered-Deferred-Forward-Plus/)

## Demo Video/GIF

[![](img/video.png)](TODO)

## Introduction
This is a WebGL implementation of clustered and deferred shading.

#### Clustered Shading
The basic forward shading technique simply loops over all the geometry and shades with all the lights. When there are hundreds of light sources, it's not an elegent way to consider every light when shading since only a small amount of lights that close to the geometry contribute to the color.

In clustered shading, space is divided into clusters and for each cluster we determine which light spheres overlap it. Then we only shading geometry using the corresponding lights.

The main challenge of this method is how to determine the intersection between a sphere and a cluster.

<p align="center">
    <img src = img/ClusteredShading.png>
<p

In z direction (in camera space. the same in following discussion), we can evenly divide the space and it's easy to find the overlapping range by checking the nearest and farest point on the sphere. But in x/y direction, we need to find the tangent line through the origin (camera) on xz/yz plane. This is equivalent to sovling a quadratic function which has analytic solution.

If we simply calculate the tangent line and take the area in between of these two line as the overlapping range, we may find some lights disappear. The reason is for each pair of tangent line there are three possible cases. We have to calculate the dot product between the tangent and the light direction to know which case is the right one. 

<p align="center">
    <img src = img/tangent.png>
<p

#### Deferred Shading
This is a technique to decoupling lights from geometry. In the first pass we generate textures recording normal, albedo and other information we need to do shading. In the second pass we calculate the color for each pixel by looping the lights and using the textures generated before.

## Performance Analysis
#### Compare the shading methods
<p align="center">
    <img src = img/plot1.png>
<p

The figure above shows the performance of the three shading methods as increasing number of lights. Clusterred shading improves performance a lot compared to the basic forward shading, and deffered shading is able to continue optimizing the rendering pipeline.

#### Optimize Deferred Shading
<p align="center">
    <img src = img/plot3.png>
<p

We are able to optimize the original deferred shading by several steps. First we can use "Spheremap Transform" to encode the normals into `vec2`s. This method introduces small error to the final result while requires a little extra computation resources. Now we only need two textures (each pixel is `vec4`) to record the position, normal and albedo. The time per frame of clustered + deferred shading when 400 lights exsit decreases from 171ms to 141ms by applying this optimization.Besides, position texture also has redundant data since we can reconstruct the position using only the depth information. Now the totol storage size we need for each pixel is 6(1 for position, 2 for normal, 3 for albedo). This leads to the final arrangement of two textures in RGB format (instead of RGBA). We can see the performance almost keeps the same after making this change. The reason might be the extra computation for reconstructing the position counterweigh the optimization of less data transmission.

#### Blinn-Phong Shading
<p align="center">
    <img src = img/plot4.png>
<p

After implementing Blinn-Phong Shading, the performance becomes worse a little bit beacause of the extra compuatation for each pixel. The figure above shows the performance of Blinn-Phong and Lambert shading as number of light increasing, with or without the optimization described in the last section.

## Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
* [Encoding Normal](https://aras-p.info/texts/CompactNormalStorage.html)
