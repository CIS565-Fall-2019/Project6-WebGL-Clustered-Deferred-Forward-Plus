export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  uniform sampler2D u_lightbuffer;

  uniform sampler2D u_clusterbuffer;
  uniform float u_near;
  uniform float u_far;
  uniform vec2 u_screenSize;
  uniform mat4 u_viewMatrix;
  uniform mat4 u_viewProjMatInv;
  uniform vec3 u_camPos;

  varying vec2 v_uv;

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
  
  void main() {
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv); // pos
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv); // col

    vec3 albedo = gb1.xyz;

    // decode normal
    vec4 nn = vec4(gb0.xy * 2.0 + vec2(-1.0,-1.0), 1.0, -1.0);
    float ll = dot(nn.xyz, -nn.xyw);
    nn.z = ll;
    nn.xy *= sqrt(ll);
    vec3 normal = nn.xyz * 2.0 + vec3(0.0, 0.0, -1.0);

    // calculate position in world space
    vec2 screenPos = vec2(2.0 * v_uv.x - 1.0, 2.0 * v_uv.y - 1.0);
    vec3 worldPos = (u_viewProjMatInv * vec4(screenPos * u_far, u_far, u_far)).xyz;
    float t = (gb0.z - u_camPos.z) / (worldPos.z - u_camPos.z);
    worldPos = t * worldPos + (1.0 - t) * u_camPos;


    vec3 camSpacePos = (u_viewMatrix * vec4(worldPos, 1.0)).xyz;
    vec3 fragColor = vec3(0.0);

    int xSlices = ${params.xSlices};
    int ySlices = ${params.ySlices};
    int zSlices = ${params.zSlices};
    
    int clusterNum = xSlices * ySlices * zSlices;
    int textureHeight = int(floor(float(${params.maxLights} + 1) * 0.25)) + 1;

    int xid = int(gl_FragCoord.x * float(xSlices) / u_screenSize.x);
    int yid = int(gl_FragCoord.y * float(ySlices) / u_screenSize.y);
    int zid = int((-camSpacePos.z - u_near) * float(zSlices) / (u_far - u_near));
    int clusterIdx =  xid + yid * xSlices + zid * xSlices * ySlices;

    vec2 uv = vec2(float(clusterIdx + 1) / float(clusterNum + 1), 0.0);
    int lightNum = int(texture2D(u_clusterbuffer, uv)[0]);

    for (int i = 1; i <= ${params.maxLights}; ++i) {
      if (i > lightNum) {
        break;
      }
      float lightIdx = ExtractFloat(u_clusterbuffer, clusterNum, textureHeight, clusterIdx, i);
      // doing the lighting calculations
      Light light = UnpackLight(int(lightIdx));
      float lightDistance = distance(light.position, worldPos);
      vec3 L = (light.position - worldPos) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);
      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
      
      // Blinn-Phong shading
      // vec3 halfDir = normalize(L + normalize(u_camPos - worldPos));
      // float specularTerm = pow(max(dot(halfDir, normal), 0.0), 20.0);
      // fragColor += specularTerm * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}