export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer; 
  uniform vec3 u_cameraPos;
  uniform vec4 u_material;/*0: diffuse multiplier, 1:specular multiplier, 2:ambient multiplier, 3:shininess coefficient */

  uniform ivec3 u_numslices;
  varying vec2 v_uv;

  #define MAX_LIGHTS_PER_CLUSTER ${params.maxLights}

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

  struct LightList{
	int numberOfLights;
	int lightList[MAX_LIGHTS_PER_CLUSTER];
  };

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

  vec4 getLightIndexesFromClusterBuffer(float u, int startingIndex){
	//there are (MAX_LIGHTS_PER_CLUSTER + 1) / 4 texels within our v value
	float delta = 4.0 / float(MAX_LIGHTS_PER_CLUSTER + 1);
	float v = float(startingIndex) / 4.0 * delta;
	return texture2D(u_clusterbuffer, vec2(u, v));
  }

  void UnpackLightList(int cIndex, inout LightList list, ivec3 u_numslices){
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

  int overallIndex(ivec3 i3, ivec3 numslices){
	return (i3.x + i3.y * numslices.x + i3.z * numslices.x * numslices.y);
  }
  
	int packIndices(ivec3 indices) {
		return (indices.x + indices.y * 256 + indices.z * 256 * 256);
	}

	ivec3 unpackIndices(int indices) {
		int zval = indices / (256 * 256);
		int working = indices - (zval * 256 * 256);
		int yval = working / 256;
		working = working - (yval * 256);
		int xval = working;
		return ivec3(xval, yval, zval);
	}

  void main() {
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
	vec3 position = vec3(gb0.xyz);
	vec3 normal = vec3(gb1.xyz);
	vec3 albedo = vec3(gb2.xyz);
	ivec3 clusterIndex = unpackIndices(int(gb0.w));
	ivec3 numSlices = u_numslices;
	float diffuseFactor = u_material.x;
	float specularFactor = u_material.y;
	float ambientFactor = u_material.z;
	float shininess = u_material.w;

	vec3 E = normalize(position - u_cameraPos);
	vec3 reflected = reflect(E, normal);

	int cIndex = overallIndex(clusterIndex, numSlices);
	LightList clusterList;
	UnpackLightList(cIndex, clusterList, numSlices);

	vec3 fragColor = vec3(0);
	for (int i = 0; i < ${params.numLights}; ++i) {
	  if (i >= clusterList.numberOfLights) break;
      Light light = UnpackLight(clusterList.lightList[i]);
      float lightDistance = distance(light.position, position);
      vec3 L = (light.position - position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
	  float specangle = max(dot(L, reflected), 0.0);
	  float specular = pow(specangle, shininess / 4.0);

      fragColor += diffuseFactor * albedo * lambertTerm * light.color * vec3(lightIntensity);
	  fragColor += specularFactor * specular * light.color * vec3(lightIntensity);
    }


    vec3 ambientLight = vec3(ambientFactor);
    fragColor += albedo * ambientLight;

	//for the tile map output
	//fragColor.xyz = vec3(clusterIndex.xyz) / vec3(numSlices.xyz);

	gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}