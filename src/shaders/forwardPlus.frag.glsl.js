export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  uniform mat4 u_viewProjectionMatrix;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec2 v_uv;

  vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap[1] * surftan + normap.x * surfbinor + normap[2] * geomnor;
  }

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

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
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

  float CalculateSpecularCoefficient(vec3 incidentLightRay, vec3 normal, float specularPower)
  {
    vec3 reflectedRay = normalize(reflect(incidentLightRay, normal));
    if (dot(normal, -incidentLightRay) < 0.0) return 0.0;
    float clampdot = max(dot(reflectedRay, -incidentLightRay), 0.0);
    float coefficient = pow(clampdot, specularPower);
    return coefficient;
  }

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    vec3 fragColor = vec3(0.0);

    vec4 screenSpace = u_viewProjectionMatrix * vec4(v_position, 1);
    screenSpace /= screenSpace[3];

    float xSlices = float(${params._xSlices});
    float ySlices = float(${params._ySlices});
    float zSlices = float(${params._zSlices});
    vec4 clusterSizes = vec4(2.0 / xSlices, 2.0 / ySlices, 2.0 / zSlices, 1.0);
    vec4 whichCluster = (screenSpace + 1.0) / clusterSizes;
    whichCluster = vec4(floor(whichCluster[0]), floor(whichCluster[1]), floor(whichCluster[2]), 1);
    whichCluster[0] = max(min(whichCluster[0], xSlices - 1.0), 0.0);
    whichCluster[1] = max(min(whichCluster[1], ySlices - 1.0), 0.0);
    whichCluster[2] = max(min(whichCluster[2], zSlices - 1.0), 0.0);
    int clusterIndex = int(whichCluster[0] + whichCluster[1] * xSlices + whichCluster[2] * xSlices * ySlices);
    int numClusters = int(xSlices * ySlices * zSlices);
    int textureHeight = int(ceil(float(${params.maxNumLights} + 1) / 4.0));
    int numLights = int(ExtractFloat(u_clusterbuffer, numClusters, textureHeight, clusterIndex, 0));

    for (int i = 0; i < ${params.maxNumLights}; ++i) {
      if (i >= numLights) break;
      int lightIndex = int(ExtractFloat(u_clusterbuffer, numClusters, textureHeight, clusterIndex, i + 1));
      Light light = UnpackLight(lightIndex);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
      float specularTerm = 1.0 * CalculateSpecularCoefficient(-L, normal.xyz, 2.0);

      fragColor += albedo * (lambertTerm + specularTerm) * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
