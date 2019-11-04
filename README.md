WebGL Clustered and Forward+ Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Taylor Nelms
  * [LinkedIn](https://www.linkedin.com/in/taylor-k-7b2110191/), [twitter](https://twitter.com/nelms_taylor)
* Tested on: Windows 10, Intel i3 Coffee Lake 4-core 3.6GHz processor, 16GB RAM, NVidia GeForce GTX1650 4GB

### Live Online

[![](img/thumb.png)](http://taylornelms15.github.io/Project6-WebGL-Clustered-Deferred-Forward-Plus)

### Demo Video/GIF

![Demo Gif1](img/demovid_numlights.gif)

![Demo Gif2](img/demovid_bp.gif)

### Tiled Clustered Renderer

These renderers operate on the idea that, for a given spatial region, only a few lights will have a noticeable effect on the shading of objects in that region. A pre-pass is done to correlate each tile/cluster with a number of lights in the scene. Then, in the fragment shaders themselves, shading is only computed between fragments and the lights that may affect its cluster.

The difference between the Forward+ renderer and the Deferred-Clustered renderer in this project is that the Forward+ renderer does all its memory accesses and shading calculations in a single fragment shader. For the Deferred-Clustered renderer, one fragment shader will write various geometric data for each fragment to a buffer, and then will pass that buffer to the second fragment shader which calculates the effects of each light on that particular fragment.

You can see a debug view of "how many lights are in a given tile" in this gif. In it, I add some red to a fragment for each light that is affecting its tile:

![Light Presence](img/clusterpresence.gif)

### Blinn-Phong Shading

Blinn-Phong shading is a way of representing a limited, if still useful, material model to allow for us to simulate a variety of materials using only a few properties. The basic theory is that each material will be some combination of a diffuse-reflective component, a specular component, a degree of "ambient lighting" (which is not realistic, but can be useful for displaying geometry without direct illumination), and a tuning of that specular component to a degree of "sharpness." 

My renderer implementations allow for a combination of all of these. Unfortunately, the model I was working from did not differentiate any material data within, so I instead made global changes to the material itself.

With just ambient light, we see the following results:

![Ambient](img/bp_ambient.png)

With just a diffuse component represented, we get the following:

![Diffuse](img/bp_diffuse.png)

With just a specular component, and using a "specularity" exponent of 100, we see the following results:

![Specular 100](img/bp_specular100.png)

Note that we can tune this "specularity" to modify how sharply light is reflected. With a lower exponent of 10, we get the following:

![Specular 10](img/bp_specular10.png)

And with a larger exponent of 1000, we get much sharper "reflections" of the lights:

![Specular 1000](img/bp_specular1000.png)

Combining all of these, we can create a very interesting material for our scene. The renderer itself adds the components together to get the following results:

![BP Combined](img/bp_combined.png)

#### Tile Splits

By default, we split the scene into 15x15x15 tiles, logarithmically in the Z direction, and linearly in the X and Y directions. For our test scene, the tile that each fragment was put into can be seen in the following image; its X index is represented by the red component, Y by green, and Z by blue:

![15 split](img/tilemap_15.png)

That said, other tile split sizes were possible. We could go with fewer tiles (7 shown here):

![7 split](img/tilemap_7.png)

Or more tiles (23 shown here):

![23 split](img/tilemap_23.png)

We also don't need to marry each component to the others. For instance, here are tile splits that keep the 15x15 default for the X and Y directions, but show splitting up the Z direction into 33 and 65 dimensions respectively:

![z33 split](img/tilemap_z33.png)

![z65 split](img/tilemap_z65.png)

We will analyze the performance impacts below, but the motivation for any of this would be to weigh the computational and resource cost of forming the tiles and their light lists against the benefit of being more specific about how many lights will actually affect a given fragment in a cluster. Larger tiles may mean there are fewer, but it also means that a light on one side of the tile may be checked against a fragment far away on the other side of the tile.

### Performance Analysis

In comparing my implementation of the Forward+ renderer and a Deferred-Clustered renderer, I actually had an issue finding situations where the Forward+ renderer performed better. It may be due to the testing centering purely on a single geometric model, but the Clustered renderer was faster in pretty much every implementation I had.

A note about all the performance analysis graphs: I was unable to uncap Chrome from a 60fps maximum, and the question posted on Piazza was unresolved at time of writing. As such, all of my graphs top out around 60fps, and I have focused on tuning parameters so that renderer performance ranges from a smooth 60fps down to infuriating slow-the-rest-of-my-computer-down-in-the-process sub-8fps speeds.

#### Light Count

For this scene, there were a few parameters I ended up tuning. One of the most basic ones was the number of lights in the scene. Unsurprisingly, as the number of lights increased, the framerate of the rendered scene decreased.

![Effect of Light Count on Renderer Speed](img/Effect_of_Light_Count_on_Renderering_Speed.png)

As you can see, the Clustered renderer performed significantly better, able to handle more lights before its inevitable decline to unusability.

##### Optimization

I did one particular optimization outside of the normal: I allowed for the maximum number of lights affecting a cluster to be fewer than the maximum number of lights affecting a scene. This was risky, because there was the real chance that more lights would affect a fragment in a cluster than the data structure would allow, but it let me avoid some significant overhead in both how many light indices needed to be passed into a cluster, and how many times a fragment shader might loop over the lights potentially affecting it. This is more relevant with how much loop unrolling and paralellization is going on under the hood, since many shaders likely would go through a worst-case loop length even without that many lights affecting them.

The risks when the numbers were off is that we would end up seeing strange artifacting of tiles lighting up when they had no reasonable business doing so. However, even for large numbers of lights, I found that assuming each cluster would be affected at maximum by half the lights in the scene allowed me to push the number of lights in the scene even higher:

![Effect of Light Count on Rendering Speed fewer lights in cluster](img/Effect_of_Light_Count_on_Renderer_Speed_(fewer_lights_allowed_in_cluster).png)

#### Tile Division

The way in which I split the clustering tiles up also had an effect on rendering speed. This is where I actually noticed a difference between how the Forward+ and the Clustered renderer handled things. For the clustered renderer, the tile splits ended up mattering significantly for performance. However, the Forward+ renderer maintained steady performance across wide ranges of tile divisions.

![Effect of Tile Split Dimensions on Renderer Speed All Dimensions](img/Effects_of_Tile_Split_Dimensions_on_Renderer_Speed_-_All_Dimensions.png)

![Effect of Tile Split Dimensions on Renderer Speed Z Dimension](img/Effects_of_Tile_Split_Dimensions_on_Renderer_Speed_-_Z_Dimension.png)

I did the experiment with both variations in how all dimensions were split, and also with just modifying the split in the Z dimension. We can see that the Forward+ renderer stays steady through multiple variations, while the Clustered renderer has some peak areas, and falls off on either side of them.

#### Light Radius

The radius of each light the model also had an effect on renderer speed; as each light became bigger or smaller, it ends up affecting more clusters of fragments, meaning that the computational workload for each fragment is potentially drastically increased.

I had to measure this performance across different domains of light count in order to both (a) get useful data, and (b) not crash my computer with abysmally slow operation in the worst cases. As such, this graph is a bit messy; the color is correlated to light radius, and line type is correlated to which renderer I used for each run.

![Effect of Light Radius on Renderer Speed](img/Effects_of_Light_Radius_on_Renderer_Speed.png)

As you can see, smaller lights yielded much higher rendering speeds.

#### Clustered Shading - G-Buffer Distinction

I by default packed all my relevant information into three geometry buffers to go from one fragment shader to another, packing the tile indices into one value and such to cut a buffer from the provided total. However, in the interest of analyzing its effects, I added in a duplicate buffer in some less-official trials, to see what the difference was.

In all, I only shaved a few frames per second off my baseline of three geometry buffers; the difference between a 19fps and 16fps in the 300-light case. That said, for memory-conscious applications, it could be worth it.

### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
