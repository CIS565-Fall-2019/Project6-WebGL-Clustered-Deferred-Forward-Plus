export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  uniform sampler2D u_lightbuffer;

  uniform sampler2D u_clusterbuffer;
  uniform int u_xSlices;
  uniform int u_ySlices;
  uniform int u_zSlices;
  uniform int u_maxLightsPerCluster;
  uniform float u_screenH;
  uniform float u_screenW;
  uniform mat4 u_viewMat;
  uniform float u_camNear;
  uniform float u_camFar;

  varying vec2 v_uv;

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
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

    light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

    light.color = v2.rgb;
    return light;
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

  void main() {
    // TODO: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    vec4 gb2 = texture2D(u_gbuffers[2], v_uv);

    vec3 position = gb0.rgb;
    vec3 albedo = gb2.rgb;
    vec3 normal = gb1.rgb;

    // Determine the cluster for this fragment
    vec4 pos = u_viewMat * vec4(position.xyz, 1.0);

    int xSlice = int(gl_FragCoord.x / (u_screenW / float(u_xSlices)));
    int ySlice = int(gl_FragCoord.y / (u_screenH / float(u_ySlices)));
    int zSlice = int((-pos.z - u_camNear) / ((u_camFar - u_camNear) / float(u_zSlices)));

    int idx = xSlice + ySlice * u_xSlices + zSlice * u_xSlices * u_ySlices;

    // Get lights in that cluster from buffer
    int nClusters =u_xSlices*u_ySlices*u_zSlices;
    float cIdx = float(idx + 1) / float(nClusters + 1);
    int nLights = int(texture2D(u_clusterbuffer, vec2(cIdx,0)).r);

    int maxDim = int(ceil(float(u_maxLightsPerCluster + 1) / 4.0));

    vec3 fragColor = vec3(0.0);

    // Compute shading for each light in this cluster
    for (int i = 0; i < ${params.numLights}; ++i) {
      if(i >= nLights) { break; } //glsl doesn't allow non constant variables in loop expression

      int tIdx = int(ExtractFloat(u_clusterbuffer, nClusters, maxDim, idx, i+1));
      Light light = UnpackLight(tIdx);
      float lightDistance = distance(light.position, position);
      vec3 L = (light.position - position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}