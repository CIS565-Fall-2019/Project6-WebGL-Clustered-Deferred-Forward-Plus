export default function(params) {
  return `

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  uniform sampler2D u_clusterbuffer;

  uniform mat4 u_viewProjectionMatrix;
  uniform mat4 u_viewMatrix;
  uniform ivec3 u_numslices;
  uniform vec4 u_filmextents;/*0: fov, 1: aspectratio, 2: near, 3: far */ 
  uniform vec3 u_cameraPos;
  uniform vec4 u_material;/*0: diffuse multiplier, 1:specular multiplier, 2:ambient multiplier, 3:shininess coefficient */

  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec2 v_uv;

  #define MAX_LIGHTS_PER_CLUSTER ${params.maxLights}

  vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
  }

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

  struct LightList{
	int numberOfLights;
	int lightList[MAX_LIGHTS_PER_CLUSTER];
  };

  float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
    float u = float(index + 1) / float(textureWidth + 1);
    int pixel = component / 4;
    float v = float(pixel + 1) / float(textureHeight + 1);
    vec4 texel = texture2D(texture, vec2(u, v));
    int pixelComponent = component - pixel * 4;
    if (pixelComponent == 0) {
      return texel[0];
    } else if (pixelComponent == 1) {
      return texel[1];
    } else if (pixelComponent == 2) {
      return texel[2];
    } else if (pixelComponent == 3) {
      return texel[3];
    }
  }

  Light UnpackLight(int index) {
    Light light;
    float u = float(index + 1) / float(${params.numLights + 1});
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
    light.position = v1.xyz;

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
    light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

    light.color = v2.rgb;
    return light;
  }

  /**
  Note: the starting index will include the "numLights" value at the front end of things
  Throw out this value, probably
  */
  vec4 getLightIndexesFromClusterBuffer(float u, int startingIndex){
	//there are (MAX_LIGHTS_PER_CLUSTER + 1) / 4 texels within our v value
	float delta = 4.0 / float(MAX_LIGHTS_PER_CLUSTER + 1);
	float v = float(startingIndex) / 4.0 * delta;
	return texture2D(u_clusterbuffer, vec2(u, v));
  }

  void UnpackLightList(int cIndex, inout LightList list){
	int numSliceTotal = u_numslices.x * u_numslices.y * u_numslices.z;
	float u = float(cIndex + 1) / float(numSliceTotal + 1);
	vec4 firstFour = texture2D(u_clusterbuffer, vec2(u, 0));
	int thisOneLightTotal = int(firstFour.x);
	list.numberOfLights = thisOneLightTotal;
	//our 101 values are spread around the v dimension of the texture, which ranges from 0 to 1
	for(int i = 0; i < MAX_LIGHTS_PER_CLUSTER + 1; i += 4){
		if (i > thisOneLightTotal + 1) break;
		vec4 next4 = getLightIndexesFromClusterBuffer(u, i);
		for(int j = 0; j < 4; j++){
			if (i == 0 && j == 0) continue;//skip very first element
			int listIndex = i + j - 1;
			if (listIndex > thisOneLightTotal) break;
			//list.lightList[i + j - 1] = int(next4[j]);
			list.lightList[i + j - 1] = int((j == 0) ? next4.x : (j == 1) ? next4.y : (j == 2) ? next4.z : next4.w);
		}//for j
	}//for i

  }

  // Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
  float cubicGaussian(float h) {
    if (h < 1.0) {
      return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
    } else if (h < 2.0) {
      return 0.25 * pow(2.0 - h, 3.0);
    } else {
      return 0.0;
    }
  }

  /* $slice = \lfloor log(Z) * \frac{numSlices}{log(\frac{Far_z}{Near_z})} - \frac{numSlices*log(Near_z)}{log(\frac{Far_z}{Near_z})} \rfloor$ */
  int indexZ(float near, float far, int numslices, float pos){
	float logFarOverNear = log(far / near); 
	float sliceNum = log(pos) * (float(numslices) / logFarOverNear) - ((float(numslices) * log(near)) / logFarOverNear);
	return int(sliceNum);
  }

  ivec2 indicesLinear(int numslicesX, int numslicesY, vec3 screenPos, int zIndex){
	float zDistFar = u_filmextents.z * pow((u_filmextents.w / u_filmextents.z), ((float(zIndex) + 1.0) / float(u_numslices.z)));
	float halfTangent = tan(radians(u_filmextents.x * 0.5));
	float frustumHeight = 2.0 * zDistFar * halfTangent;
	float frustumWidth = frustumHeight * u_filmextents.y;
	float xPercentage = (screenPos.x + (frustumWidth * 0.5)) / frustumWidth;
	float yPercentage = (screenPos.y + (frustumHeight * 0.5)) / frustumHeight;
	//float xPercentage = gl_FragCoord.x / float(u_resolution.x);
	//float yPercentage = gl_FragCoord.y / float(u_resolution.y);
	int xIndex = int(xPercentage * float(numslicesX));
	int yIndex = int(yPercentage * float(numslicesY));
	return ivec2(xIndex, yIndex);
  }

  ivec3 index3ForScreenPosition(vec3 screenPos){
	float z = -1.0 * screenPos.z;
	int zIndex = indexZ(u_filmextents.z, u_filmextents.w, u_numslices.z, z);
	ivec2 xyIndex = indicesLinear(u_numslices.x, u_numslices.y, screenPos, zIndex);
	return ivec3(xyIndex.x, xyIndex.y, zIndex);
  }

  int indexForScreenPosition(vec3 screenPos){
	ivec3 i3 = index3ForScreenPosition(screenPos);
	return (i3.x + i3.y * u_numslices.x + i3.z * u_numslices.x * u_numslices.y);
  }

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);
	vec3 E = normalize(v_position - u_cameraPos);
	vec3 reflected = reflect(E, normal);
	float diffuseFactor = u_material.x;
	float specularFactor = u_material.y;
	float ambientFactor = u_material.z;
	float shininess = u_material.w;

    vec3 fragColor = vec3(0.0);

	vec4 screenSpaceCoord = u_viewMatrix * vec4(v_position, 1.0);
	ivec3 indices = index3ForScreenPosition(screenSpaceCoord.xyz);
	int cIndex = indexForScreenPosition(screenSpaceCoord.xyz);
	LightList clusterList;
	UnpackLightList(cIndex, clusterList);
    for (int i = 0; i < ${params.numLights}; ++i) {
      //Light light = UnpackLight(i);
	  if (i >= clusterList.numberOfLights) break;
      Light light = UnpackLight(clusterList.lightList[i]);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
	  float specangle = max(dot(L, reflected), 0.0);
	  float specular = pow(specangle, shininess / 4.0);

      fragColor += diffuseFactor * albedo * lambertTerm * light.color * vec3(lightIntensity);
	  fragColor += specularFactor * specular * light.color * vec3(lightIntensity);
    }
	//fragColor.x += float(clusterList.numberOfLights) * 0.1;
	//fragColor.z = float(indices.z) / float(u_numslices.z);

    vec3 ambientLight = vec3(u_material.z);
    fragColor += albedo * ambientLight;

	//fragColor.xyz = vec3(indices.xyz) / vec3(u_numslices.xyz);

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
